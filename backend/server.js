import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MOODS,COLORS_MOOD } from '../src/moods.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

function clampValue(value, min = 0, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.max(min, Math.min(max, number));
}

function parseOutputText(text) {
  if (typeof text !== 'string') {
    return null;
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function normalizeAuraPayload(payload) {
  const defaultAura = {
    mood: MOODS.CALM,
    mood_secondary: null,
    energy: 0.5,
    stress: 0.5,
    warmth: 0.5,
    pattern: 'flow',
    // MVP: booleano. Futuro: nivel 0-2 con badge graduado + atenuación del aura.
    health_concern: false,
    summary: 'No fue posible generar un análisis completo. Intenta con más contexto o revisa la entrada.',
    actions: [
      { action: 'Observa el comportamiento de tu mascota durante el día.', reason: 'El seguimiento diario ayuda a detectar cambios de salud a tiempo.' },
      { action: 'Mantén un ambiente tranquilo y cómodo.', reason: 'Un entorno estable reduce el estrés y favorece el bienestar general.' },
      { action: 'Consulta al veterinario si notas cambios persistentes.', reason: 'Un profesional puede descartar causas médicas y darte orientación específica.' },
    ],
  };

  if (!payload || typeof payload !== 'object') {
    return defaultAura;
  }

  // Normalizar actions: acepta string[] o {action, reason}[]
  let normalizedActions = defaultAura.actions;
  if (Array.isArray(payload.actions) && payload.actions.length > 0) {
    normalizedActions = payload.actions.slice(0, 5).map((item) => {
      if (typeof item === 'string') {
        return { action: item, reason: '' };
      }
      if (item && typeof item === 'object') {
        return {
          action: typeof item.action === 'string' ? item.action.trim() : String(item),
          reason: typeof item.reason === 'string' ? item.reason.trim() : '',
        };
      }
      return { action: String(item), reason: '' };
    });
  }

  return {
    mood:
      typeof payload.mood === 'string'
        ? payload.mood.toLowerCase().trim()
        : defaultAura.mood,
    mood_secondary:
      typeof payload.mood_secondary === 'string' && payload.mood_secondary.trim().length > 0
        ? payload.mood_secondary.toLowerCase().trim()
        : null,
    energy: clampValue(payload.energy, 0, 1) ?? defaultAura.energy,
    stress: clampValue(payload.stress, 0, 1) ?? defaultAura.stress,
    warmth: clampValue(payload.warmth, 0, 1) ?? defaultAura.warmth,
    pattern:
      typeof payload.pattern === 'string'
        ? payload.pattern.toLowerCase().trim()
        : defaultAura.pattern,
    summary:
      typeof payload.summary === 'string' && payload.summary.trim().length > 0
        ? payload.summary.trim()
        : defaultAura.summary,
    health_concern: payload.health_concern === true,
    actions: normalizedActions,
  };
}

app.post('/api/analyze', async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'Falta GROQ_API_KEY en el backend' });
  }

  const { profile, transcript } = req.body;
  if (!profile || !transcript) {
    return res.status(400).json({ error: 'Perfil y transcript son requeridos' });
  }

  const prompt = `Eres un asistente especializado en analizar el estado emocional y físico de una mascota.\n` +
    `Recibes un perfil (nombre, especie, raza si se indica) y un relato en texto. Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni markdown.\n\n` +
    `Perfil de la mascota:\n${profile}\n\n` +
    `Relato del dueño:\n${transcript}\n\n` +
    `ESTADOS VÁLIDOS (usa EXCLUSIVAMENTE estos valores en inglés; no inventes ni traduzcas variaciones):\n` +
    `- ${MOODS.HAPPY}: afecto positivo y buen ánimo general SIN buscar contacto físico (alegre, mueve la cola, animado) con activación media-baja. Diferente de ${MOODS.CALM} (reposo pasivo sin conducta particular) y de ${MOODS.AFFECTIONATE} (que sí busca proximidad).\n` +
    `- ${MOODS.CALM}: relajado, sereno, en reposo.\n` +
    `- ${MOODS.PLAYFUL}: con mucha energía y ganas de jugar AHORA.\n` +
    `- ${MOODS.AFFECTIONATE}: busca activamente proximidad y contacto físico (se pega, viene a buscar al dueño, no se separa, pide caricias).\n` +
    `- ${MOODS.CURIOUS}: explorando, atento e interesado en su entorno.\n` +
    `- ${MOODS.ANXIOUS}: nervioso, inquieto o con miedo; incluye miedo agudo a un gatillo (ruidos, visitas, tormenta) — refléjalo con stress alto.\n` +
    `- ${MOODS.TIRED}: baja energía, somnoliento, en descanso.\n` +
    `- ${MOODS.IRRITABLE}: molesto o a la defensiva por razones conductuales o de sobreestimulación (gruñe, evita el contacto, muestra agresión ante estímulos externos). NO usar cuando el aislamiento se debe a malestar físico — en ese caso usar ${MOODS.TIRED} o ${MOODS.ANXIOUS} según el nivel de activación, y marcar health_concern: true.\n\n` +
    `EMOCIÓN PRINCIPAL Y SECUNDARIA:\n` +
    `- Muchos relatos describen DOS estados a la vez. Tu trabajo es detectar el secundario cuando exista, no solo el dominante.\n` +
    `- "mood" es SIEMPRE la emoción dominante del relato.\n` +
    `- Asigna "mood_secondary" siempre que el relato mencione una SEGUNDA conducta o estado distinguible del dominante (dos verbos/momentos/matices distintos). Es lo normal, no la excepción.\n` +
    `- Solo deja "mood_secondary" en null si el relato describe un único estado homogéneo, o si es vago/insuficiente.\n` +
    `- Único par PROHIBIDO: dos estados físicamente imposibles en el MISMO instante (p. ej. ${MOODS.PLAYFUL} y ${MOODS.TIRED} a la vez, o ${MOODS.CALM} y ${MOODS.IRRITABLE} a la vez). Si los dos estados ocurren en momentos distintos del relato ("primero… luego…"), SÍ son un par válido.\n` +
    `- Combinaciones de distinta valencia o activación SÍ son válidas si coexisten de forma realista (p. ej. ${MOODS.AFFECTIONATE} + ${MOODS.ANXIOUS} = busca contacto por miedo; ${MOODS.CURIOUS} + ${MOODS.ANXIOUS} = explora con cautela).\n` +
    `- Ejemplos:\n` +
    `  · «jugó un rato y después vino a echarse pegado a mí» → mood ${MOODS.PLAYFUL}, mood_secondary ${MOODS.AFFECTIONATE}.\n` +
    `  · «olfateaba todo el jardín pero se sobresaltaba con cada ruido» → mood ${MOODS.CURIOUS}, mood_secondary ${MOODS.ANXIOUS}.\n` +
    `  · «durmió toda la tarde, tranquilo» → mood ${MOODS.TIRED}, mood_secondary null (un solo estado).\n` +
    `- "mood" y "mood_secondary" no pueden ser iguales. Cuando sea null, usa el valor null de JSON, NUNCA el texto "null".\n\n` +
    `SALUD (independiente de la emoción):\n` +
    `- "health_concern": true SOLO si el relato menciona síntomas físicos: pérdida o reducción del apetito (no come, apenas come o come menos de lo normal), no bebe, vómito, diarrea, cojera, temblores por malestar, letargo marcado o quejidos de dolor. En cualquier otro caso, false.\n` +
    `- Una mascota puede estar p. ej. "${MOODS.TIRED}" con health_concern true.\n` +
    `- Evalúa la salud SIEMPRE por separado de la emoción: aunque el mood dominante sea conductual (p. ej. ${MOODS.IRRITABLE} porque gruñó), si el relato TAMBIÉN menciona un síntoma físico real (apenas comió, vomitó, cojea, etc.), marca health_concern: true de todas formas.\n` +
    `- Aislarse, irse a un rincón, esconderse o evitar el contacto son CONDUCTAS, no síntomas físicos: por sí solas NO activan health_concern.\n` +
    `- Ejemplos: «apenas comió y estuvo decaído, aunque gruñó al acercarme» → health_concern true (apenas comió = apetito reducido = síntoma físico). «gruñó y se fue a un rincón toda la tarde, sin más» → health_concern false (solo conducta de aislamiento).\n\n` +
    `PARÁMETROS NUMÉRICOS (0.0 a 1.0, coherentes con el mood):\n` +
    `- "energy": nivel de actividad (0 = aletargado, 1 = muy activo).\n` +
    `- "stress": tensión o malestar (0 = relajado, 1 = muy alterado). El miedo agudo va aquí, alto.\n` +
    `- "warmth": intensidad de presencia o confort físico percibido.\n\n` +
    `RELATO VAGO:\n` +
    `- Si el relato es insuficiente, responde mood "${MOODS.CALM}", mood_secondary null, health_concern false, e indícalo en summary.\n` +
    `- Ante relatos genéricos sin conductas específicas («estuvo bien», «normal», «bien», «igual que siempre»), usa ${MOODS.CALM}, no ${MOODS.HAPPY} ni ningún estado con valencia positiva.\n\n` +
    `RESUMEN (summary):\n` +
    `- Describe el MOMENTO que cuenta el relato, no el día completo. Es un registro puntual (el dueño puede registrar varias veces al día), así que NO uses "tuvo un día...". Usa el marco temporal del relato si lo hay ("esta mañana", "esta tarde", "hace un rato") o ninguno.\n` +
    `- Describe lo que VIVIÓ la mascota, no lo que dijo el dueño. NUNCA menciones "el relato", "la transcripción" ni hagas meta-comentarios sobre la calidad o suficiencia del input.\n` +
    `- Usa el nombre de la mascota si aparece en el perfil.\n` +
    `- Tono cálido, empático y personal, como un observador que conoce a la mascota y se preocupa por el vínculo con su dueño.\n` +
    `- Máximo 2 oraciones, en español.\n` +
    `- Ejemplo correcto: "Tito estuvo muy cariñoso y pegajoso esta tarde, buscando compañía en el sofá."\n` +
    `- Ejemplo INCORRECTO: "Tito tuvo un día muy cariñoso." (asume el día completo) o "El relato indica que la mascota estuvo normal." (meta-comentario).\n\n` +
    `RECOMENDACIONES:\n` +
    `- Cada acción incluye "reason" específico para ESTA mascota (raza si se indicó, estado emocional, conductas mencionadas). El reason NO puede empezar con frases genéricas ("para ayudar a reducir", "es importante", "es fundamental"); debe dar detalles concretos de por qué beneficia a esta mascota.\n\n` +
    `Devuelve EXACTAMENTE este formato JSON:\n` +
    `{\n` +
    `  "mood": "${MOODS.HAPPY}|${MOODS.CALM}|${MOODS.PLAYFUL}|${MOODS.AFFECTIONATE}|${MOODS.CURIOUS}|${MOODS.ANXIOUS}|${MOODS.TIRED}|${MOODS.IRRITABLE}",\n` +
    `  "mood_secondary": "otro de esos valores (distinto del principal) o null si hay un solo estado",\n` +
    `  "energy": 0.0,\n` +
    `  "stress": 0.0,\n` +
    `  "warmth": 0.0,\n` +
    `  "health_concern": false,\n` +
    `  "summary": "resumen cálido y personal del momento que cuenta el relato, máximo 2 oraciones en español",\n` +
    `  "actions": [\n` +
    `    { "action": "acción concreta 1", "reason": "por qué es útil para esta mascota" },\n` +
    `    { "action": "acción concreta 2", "reason": "por qué es útil para esta mascota" },\n` +
    `    { "action": "acción concreta 3", "reason": "por qué es útil para esta mascota" }\n` +
    `  ]\n` +
    `}`;

  try {
    console.log('Enviando petición a Groq API...');
    console.log('API Key presente:', !!GROQ_API_KEY);
    console.log('Modelo:', 'llama-3.1-8b-instant');

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    console.log('Respuesta de Groq:', response.status, response.statusText);

    if (!response.ok) {
      const bodyText = await response.text();
      return res.status(response.status).json({
        error: `Error en Groq API: ${response.status} ${response.statusText}`,
        details: bodyText,
      });
    }

    const payload = await response.json();
    console.log('Payload recibido:', JSON.stringify(payload, null, 2));
    const outputText = payload?.choices?.[0]?.message?.content;
    console.log('Output text:', outputText);

    const parsed = parseOutputText(
      typeof outputText === 'string' ? outputText : JSON.stringify(outputText)
    );

    return res.json(normalizeAuraPayload(parsed));
  } catch (error) {
    console.error('Error en backend Groq:', error);
    return res.status(500).json({ error: 'Error interno del servidor', details: String(error) });
  }
});

app.post('/api/analyze-photo', async (req, res) => {
  try {
    const { imageBase64, mimeType, profileText, contextText } = req.body;

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'imageBase64 y mimeType son requeridos' });
    }
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Falta GROQ_API_KEY en el backend' });
    }

    const imageUrl = `data:${mimeType};base64,${imageBase64}`;
    const contextSection = contextText?.trim()
      ? `\nContexto del dueño: "${contextText.trim()}"`
      : '';

    const razaMatch = profileText?.match(/Raza:\s*(.+)/i);
    const raza = razaMatch ? razaMatch[1].trim() : null;

    const razaSection = raza ? `

INFORMACIÓN DE RAZA: ${raza}
Usa la raza ÚNICAMENTE para:
1. Contextualizar señales anatómicas ambiguas (ej: orejas caídas en Basset Hound = anatómico, no tristeza; jadeo en braquicéfalos = basal, no estrés)
2. Agregar al final del summary UNA oración que conecte lo observado con características típicas de esta raza — solo si es relevante al caso concreto
3. Incluir en actions al menos una recomendación específica para las necesidades de esta raza

NUNCA uses la raza para:
- Inferir mood sin señal visual que lo respalde (ej: "es Chihuahua → ansioso" sin evidencia)
- Reducir o aumentar health_concern si la foto no muestra síntoma claro
- Hacer afirmaciones genéricas sobre la raza que no apliquen a lo que se ve en la foto` : '';

    const prompt = `Eres un experto en comportamiento canino y bienestar animal.
Analiza la foto adjunta de un perro y determina su estado emocional actual.

Perfil: ${profileText}${contextSection}${razaSection}

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después.

PROCESO DE ANÁLISIS:
1. Primero observa las señales físicas VISIBLES: postura corporal, posición de cola
   (si visible), posición de orejas (si visibles), expresión facial, nivel de
   actividad, contexto del entorno, contacto físico con personas
2. Luego infiere el estado emocional a partir de esas señales
3. Si el dueño proporcionó contexto textual, úsalo para resolver ambigüedades
4. Si las señales son ambiguas o la imagen no es clara, usa "calm" como estado base

REGLA CRÍTICA DEL JADEO: si ves boca abierta con lengua fuera:
- Con contexto de ejercicio reciente → mood: "tired", health_concern: false
- Sin contexto → mood: "tired", health_concern: false (NUNCA asignar "anxious" solo por jadeo)
- Con señales adicionales de estrés claras → mood: "anxious"

REGLA DE health_concern (INDEPENDIENTE del mood):
- true: cojera visible, herida, postura de dolor, inflamación observable
- false: jadeo solo, comportamiento emocional, mal humor
- Un perro puede estar "playful" con health_concern: true si hay síntoma físico visible

MOODS disponibles (usar exactamente estos valores):
happy | playful | affectionate | calm | tired | anxious | curious | irritable

El campo summary debe tener 3-4 oraciones. NO describas la foto.
INTERPRETA qué significa lo que ves: qué dice del estado emocional del animal,
qué dice del vínculo con el dueño, o qué contexto es útil para el dueño.
Usa el nombre de la mascota. Si hay incertidumbre por imagen poco clara, menciónala.
Nunca termines el summary con una recomendación.

Responde con este JSON:
{
  "mood": "estado principal",
  "mood_secondary": "segundo estado o null",
  "energy": 0.0,
  "stress": 0.0,
  "warmth": 0.0,
  "health_concern": false,
  "summary": "3-4 oraciones interpretando el estado emocional",
  "actions": [{"action": "qué hacer", "reason": "por qué"}]
}`;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Groq vision API error:', errorData);
      return res.status(response.status).json({ error: 'Error del modelo de visión', details: errorData });
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';
    const parsed = parseOutputText(rawText);
    return res.json(normalizeAuraPayload(parsed));

  } catch (error) {
    console.error('Error en /api/analyze-photo:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

app.listen(PORT, () => {
  console.log(`PetAura backend started on port ${PORT}`);
});
