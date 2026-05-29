import { generateAura } from '../services/groqService';
import { MOODS } from '../moods.js';

export async function analyzeTranscriptWithAI(transcript, profile = '') {
  const text = transcript.trim();
  if (!text) {
    throw new Error('No hay texto para analizar');
  }

  try {
    const payload = await generateAura(profile, text);
    return normalizeAIResponse(payload);
  } catch (error) {
    const endpoint = import.meta.env.VITE_AI_ENDPOINT;
    if (!endpoint) {
      return keywordAnalyzeTranscript(text);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || 'Error en la petición de IA');
    }

    const payload = await response.json();
    return normalizeAIResponse(payload);
  }
}

export function normalizeAIResponse(payload) {
  if (!payload) {
    throw new Error('Respuesta de IA vacía');
  }

  const mood = payload.mood?.toString().toLowerCase();
  const mood_secondary =
    typeof payload.mood_secondary === 'string' && payload.mood_secondary.trim().length > 0
      ? payload.mood_secondary.toLowerCase().trim()
      : undefined;

  return {
    mood,
    mood_secondary,
    energy: parseNumber(payload.energy),
    stress: parseNumber(payload.stress),
    warmth: parseNumber(payload.warmth),
    pattern: payload.pattern,
    summary: payload.summary,
    actions: Array.isArray(payload.actions) ? payload.actions : undefined,
  };
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function keywordAnalyzeTranscript(text) {
  const lower = text.toLowerCase();
  if (/\b(feliz|activo|alegre|energ[ií]a|jueg|salt|contento|contenta)\b/.test(lower)) {
    return { mood: MOODS.HAPPY };
  }
  if (/\b(enfermo|deca[ií]do|triste|let[aá]rgic|apat[ií]a|quieto|silencioso)\b/.test(lower)) {
    return { mood: MOODS.SICK };
  }
  if (/\b(tranquilo|relajado|sereno|calmo|descansado|paz)\b/.test(lower)) {
    return { mood: MOODS.CALM };
  }

  return { mood: MOODS.CALM };
}
