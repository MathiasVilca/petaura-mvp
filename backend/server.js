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
app.use(express.json());

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
    `- ${MOODS.HAPPY}: afecto positivo expresado activamente (mueve la cola, busca interacción suave, muestra bienestar de forma visible) con activación media-baja. Diferente de ${MOODS.CALM}, que es reposo pasivo sin conducta particular.\n` +
    `- ${MOODS.CALM}: relajado, sereno, en reposo.\n` +
    `- ${MOODS.PLAYFUL}: con mucha energía y ganas de jugar AHORA.\n` +
    `- ${MOODS.AFFECTIONATE}: busca contacto, cercanía y vínculo.\n` +
    `- ${MOODS.CURIOUS}: explorando, atento e interesado en su entorno.\n` +
    `- ${MOODS.ANXIOUS}: nervioso, inquieto o con miedo; incluye miedo agudo a un gatillo (ruidos, visitas, tormenta) — refléjalo con stress alto.\n` +
    `- ${MOODS.TIRED}: baja energía, somnoliento, en descanso.\n` +
    `- ${MOODS.IRRITABLE}: molesto o a la defensiva por razones conductuales o de sobreestimulación (gruñe, evita el contacto, muestra agresión ante estímulos externos). NO usar cuando el aislamiento se debe a malestar físico — en ese caso usar ${MOODS.TIRED} o ${MOODS.ANXIOUS} según el nivel de activación, y marcar health_concern: true.\n\n` +
    `EMOCIÓN PRINCIPAL Y SECUNDARIA:\n` +
    `- "mood" es SIEMPRE la emoción dominante del relato.\n` +
    `- Asigna "mood_secondary" SOLO si el relato describe DOS estados claramente distintos Y compatibles en nivel de activación: no combines un estado muy activo (${MOODS.PLAYFUL}, ${MOODS.ANXIOUS}, ${MOODS.IRRITABLE}) con uno muy apático (${MOODS.TIRED}, ${MOODS.CALM}).\n` +
    `- Si solo hay una emoción, o si dudas, "mood_secondary" DEBE ser null (el valor null de JSON, NUNCA el texto "null").\n` +
    `- "mood" y "mood_secondary" no pueden ser iguales.\n\n` +
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
    `- Describe lo que VIVIÓ la mascota ese día, no lo que dijo el dueño. NUNCA menciones "el relato", "la transcripción" ni hagas meta-comentarios sobre la calidad o suficiencia del input.\n` +
    `- Usa el nombre de la mascota si aparece en el perfil.\n` +
    `- Tono cálido, empático y personal, como un observador que conoce a la mascota y se preocupa por el vínculo con su dueño.\n` +
    `- Máximo 2 oraciones, en español.\n` +
    `- Ejemplo de tono correcto: "Tito tuvo un día tranquilo y equilibrado, sin señales de tensión ni de búsqueda activa de atención."\n` +
    `- Ejemplo de tono INCORRECTO (no hacer): "El relato indica que la mascota estuvo normal."\n\n` +
    `RECOMENDACIONES:\n` +
    `- Cada acción incluye "reason" específico para ESTA mascota (raza si se indicó, estado emocional, conductas mencionadas). El reason NO puede empezar con frases genéricas ("para ayudar a reducir", "es importante", "es fundamental"); debe dar detalles concretos de por qué beneficia a esta mascota.\n\n` +
    `Devuelve EXACTAMENTE este formato JSON:\n` +
    `{\n` +
    `  "mood": "${MOODS.HAPPY}|${MOODS.CALM}|${MOODS.PLAYFUL}|${MOODS.AFFECTIONATE}|${MOODS.CURIOUS}|${MOODS.ANXIOUS}|${MOODS.TIRED}|${MOODS.IRRITABLE}",\n` +
    `  "mood_secondary": null,\n` +
    `  "energy": 0.0,\n` +
    `  "stress": 0.0,\n` +
    `  "warmth": 0.0,\n` +
    `  "health_concern": false,\n` +
    `  "summary": "resumen cálido y personal del día de la mascota, máximo 2 oraciones en español",\n` +
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

app.listen(PORT, () => {
  console.log(`PetAura backend started on port ${PORT}`);
});
