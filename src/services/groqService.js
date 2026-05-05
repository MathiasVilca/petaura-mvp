const BACKEND_API_URL =
  import.meta.env.VITE_BACKEND_URL?.trim() || '/api/analyze';

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
  const profileText = String(profile || '').trim();
  const transcriptText = String(transcript || '').trim();

  if (!profileText || !transcriptText) {
    throw new Error('Perfil de mascota y transcript de voz son requeridos');
  }

  const response = await fetch(BACKEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profile: profileText,
      transcript: transcriptText,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `Error en backend: ${response.status} ${response.statusText} - ${bodyText}`
    );
  }

  const payload = await response.json();
  return normalizeAuraPayload(payload);
}
