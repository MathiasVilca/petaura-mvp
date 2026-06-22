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
    `- ${MOODS.PLAYFUL}: con mucha energía y ganas de jugar AHORA. SEÑAL DEFINITORIA: correr, perseguir, jugar con pelota, saltar sobre objetos o personas con intención lúdica. Si el animal corrió con su pelota, persiguió algo o realizó actividad lúdica motora → SIEMPRE ${MOODS.PLAYFUL}, nunca ${MOODS.HAPPY}. OJO: usar patas para oler/inspeccionar un objeto es exploración (${MOODS.CURIOUS}), no juego.\n` +
    `- ${MOODS.HAPPY}: afecto positivo y buen ánimo SIN juego activo ni búsqueda de contacto. Animado, mueve la cola, está contento — pero NO está corriendo con pelota, NO está jugando con objeto, NO está persiguiendo. ${MOODS.HAPPY} es el estado residual positivo cuando no hay juego ni contacto físico buscado. Si el relato menciona correr, pelota, juguete o persecución → usa ${MOODS.PLAYFUL}, nunca ${MOODS.HAPPY}.\n` +
    `- ${MOODS.CALM}: relajado, sereno, en reposo. Solo si no hay conducta activa ni señal de otro estado. Relatos genéricos como "estuvo bien", "normal", "igual que siempre" → SIEMPRE ${MOODS.CALM}.\n` +
    `- ${MOODS.AFFECTIONATE}: busca activamente proximidad y contacto físico (se pega, viene a buscar al dueño, no se separa, pide caricias, lame, se echa encima). IMPORTANTE: cuando la búsqueda de contacto es CAUSADA por un gatillo de miedo (fuegos artificiales, tormenta, ruidos fuertes, visitas inesperadas) → mood: ${MOODS.AFFECTIONATE}, mood_secondary: ${MOODS.ANXIOUS}, stress alto (≥ 0.7). El miedo que empuja a buscar contacto no cancela el ${MOODS.ANXIOUS} — genera un par obligatorio: ${MOODS.AFFECTIONATE} + ${MOODS.ANXIOUS}.\n` +
    `- ${MOODS.CURIOUS}: explorando, atento e interesado en su entorno o en un objeto. Incluye olfatear, inspeccionar, empujar con la pata para oler mejor, recorrer un lugar nuevo con cautela. NO confundir con juego: si el animal solo huele o inspecciona → ${MOODS.CURIOUS}.\n` +
    `- ${MOODS.ANXIOUS}: nervioso, inquieto o con miedo; incluye miedo agudo a un gatillo (ruidos, visitas, tormenta), dar vueltas sin poder quedarse quieto, echarse y levantarse repetidamente, sobresaltarse. Refléjalo con stress alto (≥ 0.7). OJO: "daba vueltas y se echaba y se volvía a levantar" = inquietud ansiosa, UN solo estado — NO ${MOODS.CURIOUS}. ${MOODS.CURIOUS} requiere que el animal esté activamente olfateando o investigando algo concreto.\n` +
    `- ${MOODS.TIRED}: baja energía, somnoliento, en descanso. TAMBIÉN aplica cuando la mascota está enferma y sin energía (vomitó, no come, decaída). Si el relato describe solo síntomas físicos (vómito, inapetencia, letargo) SIN conducta agresiva ni ansiosa → mood: ${MOODS.TIRED}. El jadeo post-actividad es termorregulación fisiológica — NO es ansiedad ni enfermedad.\n` +
    `- ${MOODS.IRRITABLE}: molesto o a la defensiva por razones conductuales o de sobreestimulación (gruñe, evita el contacto, muestra agresión ante estímulos externos o personas). Puede coexistir con health_concern true si además hay síntoma físico. NO usar solo porque se aísla sin gruñir ni agredir.\n` +
    `- REGLA CRÍTICA ${MOODS.PLAYFUL} vs ${MOODS.HAPPY}: cualquier relato que mencione correr, jugar con pelota/juguete, perseguir o realizar actividad lúdica motora → mood: ${MOODS.PLAYFUL}. Ejemplos:\n` +
    `  · «Estuvo jugando un buen rato con su pelota, corría de un lado al otro, y después vino solita a echarse encima de mí en el sofá» → mood: ${MOODS.PLAYFUL}, mood_secondary: ${MOODS.AFFECTIONATE}. Jugó con pelota y corrió = ${MOODS.PLAYFUL}; se echó encima = ${MOODS.AFFECTIONATE} secundario. NUNCA ${MOODS.HAPPY} cuando hay juego activo con objeto o carrera.\n` +
    `  · «Está persiguiéndome por la casa ladrando y me pone las patas encima» → mood: ${MOODS.PLAYFUL}, mood_secondary: ${MOODS.AFFECTIONATE}.\n` +
    `  · «Cuando llegué salió corriendo a recibirme, saltando y moviendo la cola como loca» → mood: ${MOODS.HAPPY}, mood_secondary: null. Salir a recibir con alegría SIN objeto ni persecución lúdica = ${MOODS.HAPPY}.\n` +
    `- Diferenciación clave ${MOODS.CURIOUS} vs ${MOODS.PLAYFUL}: «Olfateó la bolsa, le puso las patas encima para olerla mejor, la inspeccionó bien» → mood: ${MOODS.CURIOUS}, mood_secondary: null. Poner las patas encima para OLER = exploración. Solo es ${MOODS.PLAYFUL} cuando hay intención lúdica clara (morder jugando, perseguir, zarandear).\n\n` +
    `EMOCIÓN PRINCIPAL Y SECUNDARIA:\n` +
    `- Muchos relatos describen DOS estados a la vez. Tu trabajo es detectar el secundario cuando exista, no solo el dominante.\n` +
    `- "mood" es SIEMPRE la emoción dominante del relato.\n` +
    `- Asigna "mood_secondary" siempre que el relato mencione una SEGUNDA conducta o estado distinguible del dominante (dos verbos/momentos/matices distintos). Es lo normal, no la excepción.\n` +
    `- Solo deja "mood_secondary" en null si el relato describe un único estado homogéneo sin conducta secundaria distinguible, o si es vago/insuficiente.\n` +
    `- IMPORTANTE: si el relato describe la MISMA conducta todo el rato sin cambios de estado ni segunda conducta, mood_secondary es null aunque la energía sea alta. Ejemplo: jugar sin parar durante toda la mañana es un único estado continuo → null.\n` +
    `- REGLA DE PRIORIDAD TEMPORAL: cuando el relato describe una secuencia "primero X... después/al final Y", el PRIMARY mood ("mood") es el que ocurrió PRIMERO y duró MÁS, no el último. La fase final breve va como mood_secondary. Ejemplo: "primero olfateó el juguete (fase larga) ... al final se puso a jugar (breve)" → mood: ${MOODS.CURIOUS}, mood_secondary: ${MOODS.PLAYFUL}. NO invertir el orden.\n` +
    `- Único par PROHIBIDO: dos estados físicamente imposibles en el MISMO instante (p. ej. ${MOODS.PLAYFUL} y ${MOODS.TIRED} a la vez, o ${MOODS.CALM} y ${MOODS.IRRITABLE} a la vez). Si los dos estados ocurren en momentos distintos del relato ("primero… luego…"), SÍ son un par válido.\n` +
    `- Combinaciones de distinta valencia o activación SÍ son válidas si coexisten de forma realista (p. ej. ${MOODS.AFFECTIONATE} + ${MOODS.ANXIOUS} = busca contacto por miedo; ${MOODS.CURIOUS} + ${MOODS.ANXIOUS} = explora con cautela; ${MOODS.IRRITABLE} + ${MOODS.ANXIOUS} = alerta territorial con tensión).\n` +
    `- Ejemplos de estado ÚNICO (mood_secondary null):\n` +
    `  · «Estuvo jugando sin parar toda la mañana, con su pelota, con su juguete, con todo lo que encontraba» → mood: ${MOODS.PLAYFUL}, mood_secondary: null. Una sola conducta sostenida.\n` +
    `  · «Está echada en su sitio tranquila, la cola se le mueve despacito de vez en cuando y bosteza» → mood: ${MOODS.CALM}, mood_secondary: null. Cola suave y bostezo son señales del mismo estado calm.\n` +
    `  · «No sé, como que estaba inquieta pero tampoco hacía nada, daba vueltas y se echaba y se volvía a levantar» → mood: ${MOODS.ANXIOUS}, mood_secondary: null. "Dar vueltas + echarse + levantarse" son manifestaciones del MISMO estado de inquietud ansiosa — no es ${MOODS.CURIOUS} porque no está investigando nada.\n` +
    `  · «durmió toda la tarde, tranquilo» → mood: ${MOODS.TIRED}, mood_secondary: null.\n` +
    `  · «olfateó la bolsa, le puso las patas encima para olerla mejor, la inspeccionó bien» → mood: ${MOODS.CURIOUS}, mood_secondary: null.\n` +
    `- Ejemplos de estado MIXTO (mood_secondary distinto):\n` +
    `  · «jugó un rato y después vino a echarse pegado a mí» → mood: ${MOODS.PLAYFUL}, mood_secondary: ${MOODS.AFFECTIONATE}. Dos momentos distintos.\n` +
    `  · «Llegaron los fuegos artificiales y Luna se me vino corriendo, temblando y sin querer separarse para nada de mí» → mood: ${MOODS.AFFECTIONATE}, mood_secondary: ${MOODS.ANXIOUS}, stress: 0.85. Busca contacto POR el miedo al gatillo — el temblor y la reacción a los fuegos = ${MOODS.ANXIOUS} secundario obligatorio. NUNCA mood_secondary: null cuando hay gatillo de miedo explícito.\n` +
    `  · «olfateaba todo el jardín pero se sobresaltaba con cada ruido» → mood: ${MOODS.CURIOUS}, mood_secondary: ${MOODS.ANXIOUS}.\n` +
    `  · «estuvo olfateando cada rincón de la casa nueva, muy atenta, sin relajarse del todo» → mood: ${MOODS.CURIOUS}, mood_secondary: ${MOODS.ANXIOUS}.\n` +
    `  · «ladraba sin parar a la ventana y cuando me acerqué me gruñó» → mood: ${MOODS.IRRITABLE}, mood_secondary: ${MOODS.ANXIOUS}.\n` +
    `  · «llegué y me saltó encima, me lamió la cara, movía la cola como loca» → mood: ${MOODS.HAPPY}, mood_secondary: ${MOODS.AFFECTIONATE}.\n` +
    `  · «primero lo olfateó desconfiada, lo empujó con la pata, y al final se puso a jugar con él» → mood: ${MOODS.CURIOUS}, mood_secondary: ${MOODS.PLAYFUL}. La fase de exploración (olfatear, empujar, inspeccionar) fue la más larga y dominante — es el primario. Jugar "al final" es el secundario breve. NUNCA invertir: no es playful + curious, es curious + playful.\n` +
    `- "mood" y "mood_secondary" no pueden ser iguales. Cuando sea null, usa el valor null de JSON (sin comillas), NUNCA la cadena de texto "null". Ejemplo CORRECTO: "mood_secondary": null. Ejemplo INCORRECTO: "mood_secondary": "null".\n\n` +
    `SALUD (independiente de la emoción):\n` +
    `- "health_concern": true SOLO si el relato menciona síntomas físicos CONCRETOS: pérdida o reducción del apetito (no come, apenas come, comió poco, casi no comió), no bebe agua, vómito, diarrea, cojera, temblores por malestar, letargo marcado o quejidos de dolor. En cualquier otro caso, false.\n` +
    `- REGLA CRÍTICA — síntomas físicos sin conducta agresiva ni ansiosa: si el relato describe únicamente síntomas físicos (vomitó, no quiso comer, está decaída, no bebe) SIN mencionar que gruñó, se mostró nerviosa, dio vueltas o tuvo otro comportamiento conductual → mood: ${MOODS.TIRED}, mood_secondary: null, health_concern: true. NO uses ${MOODS.IRRITABLE} ni ${MOODS.ANXIOUS} si no hay conducta agresiva o ansiosa explícita.\n` +
    `- Una mascota puede estar "${MOODS.TIRED}" con health_concern true (vomitó + no come), "${MOODS.PLAYFUL}" con health_concern true (juega pero cojea), o "${MOODS.IRRITABLE}" con health_concern true (gruñó Y ADEMÁS casi no comió). El mood lo determina la CONDUCTA, la salud lo determina el SÍNTOMA FÍSICO — son canales independientes.\n` +
    `- Evalúa la salud SIEMPRE por separado de la emoción: aunque el mood dominante sea conductual (p. ej. ${MOODS.IRRITABLE} porque gruñó), si el relato TAMBIÉN menciona un síntoma físico real (apenas comió, vomitó, cojea, etc.), marca health_concern: true de todas formas.\n` +
    `- Aislarse, irse a un rincón, esconderse o evitar el contacto son CONDUCTAS, no síntomas físicos: por sí solas NO activan health_concern.\n` +
    `- REGLA CRÍTICA — jadeo post-ejercicio: si el relato menciona que acaban de llegar del parque, de correr o de hacer ejercicio, el jadeo es NORMAL. NO es ansiedad, NO es enfermedad. → health_concern: false, mood: ${MOODS.TIRED}.\n` +
    `- Conducta destructiva por soledad (romper cojines, destrozar objetos cuando el dueño estaba fuera) = ansiedad por separación → mood: ${MOODS.ANXIOUS}, mood_secondary: null, health_concern: false.\n` +
    `- Ejemplos explícitos:\n` +
    `  · «Vomitó dos veces en la mañana y desde ahí no quiso comer nada, ni sus galletas que le encantan» → mood: ${MOODS.TIRED}, mood_secondary: null, health_concern: true. Solo síntomas físicos (vómito + inapetencia), sin conducta agresiva ni ansiosa reportada → TIRED. NUNCA irritable ni anxious si no hay conducta conductual.\n` +
    `  · «Luna está echada jadeando, recién llegamos del parque después de correr bastante» → mood: ${MOODS.TIRED}, mood_secondary: null, health_concern: false. Jadeo post-actividad = normal.\n` +
    `  · «Desde esta mañana está cojeando de la pata trasera, no la apoya bien cuando camina» → mood: ${MOODS.TIRED}, mood_secondary: ${MOODS.ANXIOUS}, health_concern: true.\n` +
    `  · «Comió bien, estuvo jugando con su pelota como siempre, pero la noto que cojea un poco de la pata delantera» → mood: ${MOODS.PLAYFUL}, mood_secondary: null, health_concern: true.\n` +
    `  · «Casi no comió en todo el día, estuvo muy quieta, y cuando me acerqué me gruñó» → mood: ${MOODS.IRRITABLE}, mood_secondary: null, health_concern: true. Hay CONDUCTA (gruñó) + síntoma físico → irritable + health_concern true.\n` +
    `  · «Cuando intenté acariciarla me gruñó y se fue debajo de la cama» → mood: ${MOODS.IRRITABLE}, mood_secondary: null, health_concern: false. Solo conducta, sin síntoma físico.\n` +
    `  · «Estuvo todo el día sola, cuando llegué estaba bien pero había roto un cojín» → mood: ${MOODS.ANXIOUS}, mood_secondary: null, health_concern: false.\n\n` +
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
    `- 3-4 oraciones. NO describas ni parafrasees el relato — interpreta qué significa el comportamiento, qué dice del vínculo con el dueño o qué contexto veterinario es útil. En español.\n` +
    `- NO termines el summary con una recomendación ni consejo de acción. Las recomendaciones van ÚNICAMENTE en el campo "actions". El summary termina con una interpretación o contexto, nunca con "te recomiendo...", "sería bueno...", "procura...", etc.\n` +
    `- Si el perfil incluye raza (con un nombre de raza real), agrega UNA oración final conectando el comportamiento observado con una característica conocida de esa raza. Si el perfil NO incluye raza, la tiene en blanco, o dice "mestizo" o "criollo" → NO menciones raza ni hagas suposiciones sobre ella. El summary funciona igual sin esa oración.\n` +
    `- IMPORTANTE: los ejemplos de summary son referencias de TONO Y ESTRUCTURA, no para copiar literalmente. Crea siempre un summary original para el relato específico, usando las conductas y el contexto de ESE relato, no de los ejemplos.\n` +
    `- Ejemplo BUENO (relato: jugaba con su pelota, corría, y después vino a echarse encima del dueño): "[Nombre] descargó toda su energía jugando y luego buscó completar eso con contacto físico — esa secuencia habla de un vínculo muy sólido. Los perros que terminan el juego buscando cercanía están emocionalmente satisfechos y bien conectados con su dueño. Es una de las señales más sanas que puede mostrar un perro."\n` +
    `- Ejemplo MALO (NO hagas esto): "Luna estuvo jugando un buen rato con su pelota y luego vino a echarse encima de su dueño en el sofá, buscando atención y caricias. Su dueño la recibió con amor y ella se sintió cómoda y segura." — Solo repite lo que dijo el dueño, no interpreta.\n` +
    `- Ejemplo INCORRECTO de forma: "Tito tuvo un día muy cariñoso." (asume el día completo) o "El relato indica que la mascota estuvo normal." (meta-comentario).\n\n` +
    `RECOMENDACIONES:\n` +
    `- Devuelve SIEMPRE EXACTAMENTE 3 acciones en el array "actions", ni más ni menos.\n` +
    `- Cada acción incluye "reason" específico para ESTA mascota (raza si se indicó, estado emocional, conductas mencionadas). El reason NO puede empezar con frases genéricas ("para ayudar a reducir", "es importante", "es fundamental", "para determinar", "para evitar"); debe dar detalles concretos de por qué beneficia a esta mascota en este momento.\n\n` +
    `Devuelve EXACTAMENTE este formato JSON (sin texto adicional antes ni después):\n` +
    `{\n` +
    `  "mood": "${MOODS.HAPPY}|${MOODS.CALM}|${MOODS.PLAYFUL}|${MOODS.AFFECTIONATE}|${MOODS.CURIOUS}|${MOODS.ANXIOUS}|${MOODS.TIRED}|${MOODS.IRRITABLE}",\n` +
    `  "mood_secondary": null,\n` +
    `  "energy": 0.0,\n` +
    `  "stress": 0.0,\n` +
    `  "warmth": 0.0,\n` +
    `  "health_concern": false,\n` +
    `  "summary": "Exactamente 3 a 4 oraciones interpretativas (no parafrasear el relato)",\n` +
    `  "actions": [\n` +
    `    { "action": "acción concreta 1", "reason": "razón específica para esta mascota" },\n` +
    `    { "action": "acción concreta 2", "reason": "razón específica para esta mascota" },\n` +
    `    { "action": "acción concreta 3", "reason": "razón específica para esta mascota" }\n` +
    `  ]\n` +
    `}\n` +
    `OBLIGATORIO: el array "actions" debe tener SIEMPRE 3 elementos exactos.`;


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
        temperature: 0.1,
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
