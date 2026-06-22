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
    `- ${MOODS.HAPPY}: alegría con señales positivas CONCRETAS (recibir contento, saltar de alegría, mover la cola) SIN pelota, SIN juguete, SIN juego activo y SIN contacto dominante. Si aparece jugar/jugó con pelota o juguete, correr de un lado a otro o persecución lúdica, NUNCA uses ${MOODS.HAPPY}: usa ${MOODS.PLAYFUL}. Relatos genéricos como "Hoy estuvo bien"/"normal" son ${MOODS.CALM}.\n` +
    `- ${MOODS.CALM}: relajado, sereno, en reposo.\n` +
    `- ${MOODS.PLAYFUL}: juego activo AHORA; si menciona jugar con pelota/juguete, correr o persecución lúdica, mood SIEMPRE es ${MOODS.PLAYFUL} y NUNCA ${MOODS.HAPPY}. Si solo juega sin parar con pelota/juguete/todo lo que encuentra, es un ÚNICO estado: mood_secondary null. Solo usa ${MOODS.AFFECTIONATE} si hay contacto físico explícito.\n` +
    `- ${MOODS.AFFECTIONATE}: busca proximidad/contacto (se pega, viene al dueño, no se separa, pide caricias). Si hay fuegos artificiales/ruidos/tormenta + temblor/miedo + busca contacto o no se separa, mood SIEMPRE es ${MOODS.AFFECTIONATE} y mood_secondary ${MOODS.ANXIOUS}; NUNCA null ni ${MOODS.ANXIOUS}/${MOODS.AFFECTIONATE}.\n` +
    `- ${MOODS.CURIOUS}: exploración activa (olfatear, buscar, inspeccionar, recorrer). BOLSA/SUPER/OBJETO + oler/inspeccionar/poner patas para oler = mood ${MOODS.CURIOUS}, mood_secondary null. JARDÍN/LUGAR + olfatear/buscar como actividad dominante + ruidos/sobresaltos/asustada = mood SIEMPRE ${MOODS.CURIOUS}, mood_secondary ${MOODS.ANXIOUS}; NUNCA ${MOODS.ANXIOUS}/${MOODS.CURIOUS}. JUGUETE NUEVO + primero olfateó/desconfiada/empujó + al final jugó = ${MOODS.CURIOUS}/${MOODS.PLAYFUL}.\n` +
    `- ${MOODS.ANXIOUS}: nervioso, inquieto o con miedo; incluye miedo agudo a un gatillo. Si dice inquieta/daba vueltas/se echaba y se volvía a levantar, mood ${MOODS.ANXIOUS}, mood_secondary null, health_concern false. Si estuvo sola y rompió/destrozó un cojín u objeto, es ansiedad por separación: mood ${MOODS.ANXIOUS}, mood_secondary null, health_concern false; NO es ${MOODS.CALM}.\n` +
    `- ${MOODS.TIRED}: baja energía, somnoliento o en descanso. Dormir casi todo el día, levantarse a tomar agua y volver a echarse = mood ${MOODS.TIRED}, mood_secondary null, health_concern false si NO hay vómito, diarrea, cojera, dolor, falta de apetito, no beber ni quejidos; NO inventes enfermedad.\n` +
    `- ${MOODS.IRRITABLE}: defensivo/conductual: gruñe, evita contacto o reacciona a estímulos externos. Si ladra a ventana/afuera y luego gruñe, mood ${MOODS.IRRITABLE}, mood_secondary ${MOODS.ANXIOUS}, health_concern false. Si gruñe al acariciarla y se esconde SIN síntoma físico, mood ${MOODS.IRRITABLE}, mood_secondary null, health_concern false. Si casi no comió/está muy quieta Y gruñe, mood ${MOODS.IRRITABLE}, mood_secondary null, health_concern true; NO inventes ${MOODS.ANXIOUS}.\n` +
    `- Diferenciación clave ${MOODS.HAPPY} vs ${MOODS.PLAYFUL}: «Está persiguiéndome por la casa ladrando y poniendo las patas en mí» → mood: ${MOODS.PLAYFUL}, mood_secondary: ${MOODS.AFFECTIONATE}, health_concern: false. Conducta activa y dirigida hacia el dueño = ${MOODS.PLAYFUL}, no ${MOODS.HAPPY}. Cuando hay acción motora iniciada por el animal hacia una persona, el estado es ${MOODS.PLAYFUL}.\n\n` +
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
    `- Si SOLO hay síntomas físicos (vómito, no quiso comer, inapetencia, no bebe, decaimiento) y NO hay gruñido/agresión/inquietud/miedo explícito, mood SIEMPRE ${MOODS.TIRED}, mood_secondary null, health_concern true. Si el único síntoma es cojera/no apoya bien la pata, mood ${MOODS.TIRED}, mood_secondary ${MOODS.ANXIOUS}, health_concern true; NUNCA ${MOODS.IRRITABLE}.\n` +
    `- Evalúa la salud SIEMPRE por separado de la emoción: aunque el mood dominante sea conductual (p. ej. ${MOODS.IRRITABLE} porque gruñó), si el relato TAMBIÉN menciona un síntoma físico real (apenas comió, vomitó, cojea, etc.), marca health_concern: true de todas formas.\n` +
    `- Aislarse, irse a un rincón, esconderse o evitar el contacto son CONDUCTAS, no síntomas físicos: por sí solas NO activan health_concern.\n` +
    `- Ejemplos: «apenas comió y estuvo decaído, aunque gruñó al acercarme» → health_concern true (apenas comió = apetito reducido = síntoma físico). «gruñó y se fue a un rincón toda la tarde, sin más» → health_concern false (solo conducta de aislamiento).\n` +
    `- «Está jadeando y echada en su cama, recién llegamos del parque» → mood: ${MOODS.TIRED}, mood_secondary: null, health_concern: false. El jadeo post-ejercicio es termorregulación normal — no es estrés ni enfermedad.\n` +
    `- «Come bien, jugó normal, pero cojea de la pata delantera» → mood: ${MOODS.PLAYFUL}, mood_secondary: null, health_concern: true. La salud es independiente del estado emocional: puede estar ${MOODS.PLAYFUL} y tener health_concern: true si hay síntoma físico.\n\n` +
    `PARÁMETROS NUMÉRICOS (0.0 a 1.0, coherentes con el mood):\n` +
    `- "energy": nivel de actividad (0 = aletargado, 1 = muy activo).\n` +
    `- "stress": tensión o malestar (0 = relajado, 1 = muy alterado). El miedo agudo va aquí, alto.\n` +
    `- "warmth": intensidad de presencia o confort físico percibido.\n\n` +
    `RELATO VAGO:\n` +
    `- Si el relato es insuficiente, responde mood "${MOODS.CALM}", mood_secondary null, health_concern false, e indícalo en summary.\n` +
    `- Ante relatos genéricos sin conductas específicas («Hoy estuvo bien», «estuvo bien», «normal», «bien», «igual que siempre»), mood SIEMPRE ${MOODS.CALM}, mood_secondary null, health_concern false; PROHIBIDO inferir alegría, actividad, ejercicio, juego, contacto, raza o necesidad de recomendaciones si no están escritos.\n\n` +
    `RESUMEN (summary):\n` +
    `- Describe el MOMENTO que cuenta el relato, no el día completo. Es un registro puntual (el dueño puede registrar varias veces al día), así que NO uses "tuvo un día...". Usa el marco temporal del relato si lo hay ("esta mañana", "esta tarde", "hace un rato") o ninguno.\n` +
    `- Describe lo que VIVIÓ la mascota, no lo que dijo el dueño. NUNCA menciones "el relato", "la transcripción" ni hagas meta-comentarios sobre la calidad o suficiencia del input.\n` +
    `- Usa el nombre de la mascota si aparece en el perfil.\n` +
    `- Tono cálido, empático y personal, como un observador que conoce a la mascota y se preocupa por el vínculo con su dueño.\n` +
    `- 3-4 oraciones. NO describas ni parafrasees el relato — interpreta qué significa el comportamiento, qué dice del vínculo con el dueño o qué contexto veterinario es útil. En español.\n` +
    `- Si el perfil incluye raza, agrega UNA oración final conectando el comportamiento observado con una característica conocida de esa raza. Si no hay raza o es mestizo/criollo, el summary funciona igual sin ella.\n` +
    `- Ejemplo correcto: "Tito estuvo muy cariñoso y pegajoso esta tarde, buscando compañía en el sofá."\n` +
    `- Ejemplo INCORRECTO: "Tito tuvo un día muy cariñoso." (asume el día completo) o "El relato indica que la mascota estuvo normal." (meta-comentario).\n\n` +
    `RECOMENDACIONES:\n` +
    `- Devuelve EXACTAMENTE 3 acciones en "actions".\n` +
    `- Cada action debe ser breve, concreta y relacionada SOLO con el relato.\n` +
    `- Cada reason debe empezar con "Porque" y no con "para".\n` +
    `- En actions/reasons tambien aplica NO inventar: juguetes, juego, atencion, compania, carino, dueno observa, salud/veterinario si no aparecen en el relato.\n` +
    `- Si health_concern es false, NO menciones ni recomiendes salud, veterinario, dieta, enfermedad, revision medica ni problema de salud.\n\n` +
    `{\n` +
    `  "mood": "${MOODS.HAPPY}|${MOODS.CALM}|${MOODS.PLAYFUL}|${MOODS.AFFECTIONATE}|${MOODS.CURIOUS}|${MOODS.ANXIOUS}|${MOODS.TIRED}|${MOODS.IRRITABLE}",\n` +
    `  "mood_secondary": "otro de esos valores (distinto del principal) o null si hay un solo estado",\n` +
    `  "energy": 0.0,\n` +
    `  "stress": 0.0,\n` +
    `  "warmth": 0.0,\n` +
    `  "health_concern": false,\n` +
    `  "summary": "3 a 4 oraciones interpretativas, sin consejos ni raza inventada",\n` +
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
        max_tokens: 800,
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
