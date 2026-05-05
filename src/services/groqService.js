const GROQ_API_URL =
  'https://api.groq.ai/v1/llms/llama-3.1-8b-instant/completions';

const DEFAULT_AURA = {
  mood: 'calm',
  energy: 0.5,
  stress: 0.5,
  warmth: 0.5,
  pattern: 'flow',
  summary:
    'No fue posible generar un análisis completo. Intenta con más contexto o revisa la entrada.',
  actions: [
    'Observa el comportamiento de tu mascota durante el día.',
    'Mantén un ambiente tranquilo y cómodo.',
    'Consulta al veterinario si notas cambios persistentes.',
  ],
};

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
  if (!payload || typeof payload !== 'object') {
    return DEFAULT_AURA;
  }

  const mood =
    typeof payload.mood === 'string'
      ? payload.mood.toLowerCase().trim()
      : DEFAULT_AURA.mood;

  const pattern =
    typeof payload.pattern === 'string'
      ? payload.pattern.toLowerCase().trim()
      : DEFAULT_AURA.pattern;

  const summary =
    typeof payload.summary === 'string' && payload.summary.trim().length > 0
      ? payload.summary.trim()
      : DEFAULT_AURA.summary;

  return {
    mood,
    energy: clampValue(payload.energy, 0, 1) ?? DEFAULT_AURA.energy,
    stress: clampValue(payload.stress, 0, 1) ?? DEFAULT_AURA.stress,
    warmth: clampValue(payload.warmth, 0, 1) ?? DEFAULT_AURA.warmth,
    pattern,
    summary,
    actions: Array.isArray(payload.actions)
      ? payload.actions.map((item) => String(item)).slice(0, 5)
      : DEFAULT_AURA.actions,
  };
}

export async function generateAura(profile, transcript) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Falta la variable de entorno VITE_GROQ_API_KEY');
  }

  const profileText = String(profile || '').trim();
  const transcriptText = String(transcript || '').trim();

  if (!profileText || !transcriptText) {
    throw new Error('Perfil de mascota y transcript de voz son requeridos');
  }

  const prompt = `Eres un asistente especializado en analizar el estado emocional y físico de una mascota.\n` +
    `Recibes un perfil de mascota y un transcript de voz. Responde únicamente con un JSON válido sin texto adicional.\n\n` +
    `Perfil de la mascota:\n${profileText}\n\n` +
    `Transcripción de voz:\n${transcriptText}\n\n` +
    `Devuelve exactamente este formato JSON:\n` +
    `{\n` +
    `  "mood": "happy|calm|tired|anxious|playful|affectionate|curious|sick",\n` +
    `  "energy": 0.0-1.0,\n` +
    `  "stress": 0.0-1.0,\n` +
    `  "warmth": 0.0-1.0,\n` +
    `  "pattern": "burst|orbit|flow|pulse",\n` +
    `  "summary": "texto en español, máximo 2 oraciones",\n` +
    `  "actions": ["acción 1", "acción 2", "acción 3"]\n` +
    `}`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: prompt,
      temperature: 0.3,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `Error en Groq API: ${response.status} ${response.statusText} - ${bodyText}`
    );
  }

  const payload = await response.json();

  const outputText =
    payload?.output?.[0]?.content?.find((item) => item.type === 'output_text')?.text ||
    payload?.output?.[0]?.content?.[0]?.text ||
    payload?.output?.[0]?.text ||
    (typeof payload?.output?.[0] === 'string' ? payload.output[0] : null);

  const parsed = parseOutputText(
    typeof outputText === 'string' ? outputText : JSON.stringify(outputText)
  );

  return normalizeAuraPayload(parsed);
}
