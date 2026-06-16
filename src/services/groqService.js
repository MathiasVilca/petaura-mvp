const BACKEND_API_URL =
  import.meta.env.VITE_BACKEND_URL?.trim() || '/api/analyze';

const BACKEND_PHOTO_URL = (import.meta.env.VITE_BACKEND_URL?.trim() || '/api/analyze')
  .replace(/\/analyze$/, '') + '/analyze-photo';

const DEFAULT_AURA = {
  mood: 'calm',
  mood_secondary: null,
  energy: 0.5,
  stress: 0.5,
  warmth: 0.5,
  pattern: 'flow',
  // MVP: booleano. Futuro: nivel 0-2 con badge graduado + atenuación del aura.
  health_concern: false,
  summary:
    'No fue posible generar un análisis completo. Intenta con más contexto o revisa la entrada.',
  actions: [
    { action: 'Observa el comportamiento de tu mascota durante el día.', reason: 'El seguimiento diario ayuda a detectar cambios de salud a tiempo.' },
    { action: 'Mantén un ambiente tranquilo y cómodo.', reason: 'Un entorno estable reduce el estrés y favorece el bienestar general.' },
    { action: 'Consulta al veterinario si notas cambios persistentes.', reason: 'Un profesional puede descartar causas médicas y darte orientación específica.' },
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

  const mood_secondary =
    typeof payload.mood_secondary === 'string' && payload.mood_secondary.trim().length > 0
      ? payload.mood_secondary.toLowerCase().trim()
      : null;

  const pattern =
    typeof payload.pattern === 'string'
      ? payload.pattern.toLowerCase().trim()
      : DEFAULT_AURA.pattern;

  const summary =
    typeof payload.summary === 'string' && payload.summary.trim().length > 0
      ? payload.summary.trim()
      : DEFAULT_AURA.summary;

  // Normalizar actions: acepta string[] o {action, reason}[]
  let actions = DEFAULT_AURA.actions;
  if (Array.isArray(payload.actions) && payload.actions.length > 0) {
    actions = payload.actions.slice(0, 5).map((item) => {
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
    mood,
    mood_secondary,
    energy: clampValue(payload.energy, 0, 1) ?? DEFAULT_AURA.energy,
    stress: clampValue(payload.stress, 0, 1) ?? DEFAULT_AURA.stress,
    warmth: clampValue(payload.warmth, 0, 1) ?? DEFAULT_AURA.warmth,
    pattern,
    summary,
    health_concern: payload.health_concern === true,
    actions,
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

export async function generateAuraFromPhoto({ imageBase64, mimeType, profileText, contextText }) {
  const response = await fetch(BACKEND_PHOTO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, profileText, contextText }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Error en backend: ${response.status} ${response.statusText} - ${bodyText}`);
  }

  const data = await response.json();
  return normalizeAuraPayload(data);
}
