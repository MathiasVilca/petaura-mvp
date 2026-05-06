import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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
    mood: 'calm',
    energy: 0.5,
    stress: 0.5,
    warmth: 0.5,
    pattern: 'flow',
    summary: 'No fue posible generar un análisis completo. Intenta con más contexto o revisa la entrada.',
    actions: [
      'Observa el comportamiento de tu mascota durante el día.',
      'Mantén un ambiente tranquilo y cómodo.',
      'Consulta al veterinario si notas cambios persistentes.',
    ],
  };

  if (!payload || typeof payload !== 'object') {
    return defaultAura;
  }

  return {
    mood:
      typeof payload.mood === 'string'
        ? payload.mood.toLowerCase().trim()
        : defaultAura.mood,
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
    actions: Array.isArray(payload.actions)
      ? payload.actions.map((item) => String(item)).slice(0, 5)
      : defaultAura.actions,
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
    `Recibes un perfil de mascota y un transcript de voz. Responde únicamente con un JSON válido sin texto adicional.\n\n` +
    `Perfil de la mascota:\n${profile}\n\n` +
    `Transcripción de voz:\n${transcript}\n\n` +
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

  try {
    console.log('Enviando petición a Groq API...');
    console.log('API Key presente:', !!GROQ_API_KEY);
    console.log('Modelo:', 'mixtral-8x7b-32768');

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
        max_tokens: 400,
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
