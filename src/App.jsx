import { useState } from 'react';
import AuraCanvas from './components/AuraCanvas';
import { analyzeTranscriptWithAI } from './ai/analyzeTranscript';

const moodColors = {
  happy: '#4ADE80', calm: '#60A5FA', tired: '#94A3B8',
  anxious: '#F87171', playful: '#FB923C', affectionate: '#F472B6',
  curious: '#A78BFA', sick: '#6B7280'
};
// Estados de ánimo de mascota con configuraciones de aura (usados por Groq API)
const mockStates = {
  happy: {
    mood: 'happy',
    color: moodColors.happy,
    energy: 0.92,
    stress: 0.18,
    warmth: 0.88,
    pattern: 'burst',
    description: 'Muy activo y alegre. Su aura muestra vitalidad expansiva, brillo y movimiento rápido.',
    actions: [
      'Juega 15 minutos con su juguete favorito.',
      'Refuerza el vínculo con caricias y premios.',
      'Aprovecha para dar un paseo enérgico.'
    ],
    exampleText: 'Toby estuvo súper activo hoy, jugó todo el día con la pelota, comió bien y estuvo muy cariñoso con todos en casa.'
  },
  calm: {
    mood: 'calm',
    color: moodColors.calm,
    energy: 0.28,
    stress: 0.12,
    warmth: 0.74,
    pattern: 'flow',
    description: 'Tranquilo y equilibrado. La aura es suave, fluida y reposada, con movimiento constante pero relajado.',
    actions: [
      'Mantén el ambiente sereno y con poca estimulación.',
      'Ofrece un espacio cómodo para descansar.',
      'Observa si prefiere contacto silencioso o distancia.'
    ],
    exampleText: 'Hoy estuvo muy tranquilo, durmió bastante y se mostró relajado mientras paseábamos cerca de casa.'
  },
  tired: {
    mood: 'tired',
    color: moodColors.tired,
    energy: 0.22,
    stress: 0.36,
    warmth: 0.58,
    pattern: 'pulse',
    description: 'Baja energía y ritmo lento. El aura se siente suave, agotada y con movimiento pausado.',
    actions: [
      'Permítele descansar en su lugar favorito.',
      'Reduce la actividad y evita estímulos intensos.',
      'Asegura agua fresca y un ambiente calmado.'
    ],
    exampleText: 'Estuvo más quieto de lo normal, se acomodó a descansar y no mostró ganas de jugar mucho.'
  },
  anxious: {
    mood: 'anxious',
    color: moodColors.anxious,
    energy: 0.42,
    stress: 0.82,
    warmth: 0.44,
    pattern: 'orbit',
    description: 'Nervioso y alerta. La aura se mueve con tensión, oscilando entre círculos pequeños y energía contenida.',
    actions: [
      'Crea un espacio seguro y sin ruido.',
      'Habla con voz suave y acaricia lentamente.',
      'Observa sus señales de calma antes de acercarte.'
    ],
    exampleText: 'Estuvo inquieto, se movía de un lado a otro y reaccionaba con sensibilidad a sonidos y movimientos.'
  },
  playful: {
    mood: 'playful',
    color: moodColors.playful,
    energy: 0.85,
    stress: 0.22,
    warmth: 0.88,
    pattern: 'burst',
    description: 'Lleno de ganas de jugar. El aura es brillante, expansiva y con destellos rápidos de energía positiva.',
    actions: [
      'Ofrece un juguete nuevo o una sesión de juegos corta.',
      'Premia su entusiasmo con caricias y elogios.',
      'Aprovecha para fortalecer el vínculo con actividades lúdicas.'
    ],
    exampleText: 'Jugó con gran energía, persiguió su juguete favorito y buscó atención para jugar más.'
  },
  affectionate: {
    mood: 'affectionate',
    color: moodColors.affectionate,
    energy: 0.62,
    stress: 0.18,
    warmth: 0.95,
    pattern: 'flow',
    description: 'Cariñoso y conectado. El aura es cálida, fluida y rodeada de una sensación acogedora.',
    actions: [
      'Ofrece un abrazo suave o caricias cerca de su cabeza.',
      'Permite tiempo de calidad en contacto tranquilo.',
      'Refuerza la conexión con palabras suaves y cercanía.'
    ],
    exampleText: 'Buscó estar cerca, se acomodó junto a ti y respondió con lamidos y caricias calmadas.'
  },
  curious: {
    mood: 'curious',
    color: moodColors.curious,
    energy: 0.68,
    stress: 0.28,
    warmth: 0.72,
    pattern: 'flow',
    description: 'Interesado y atento. El aura se desplaza con curiosidad, explorando el entorno con movimientos suaves.',
    actions: [
      'Deja objetos seguros para que los inspeccione con calma.',
      'Observa su lenguaje corporal antes de interactuar.',
      'Ofrece estímulos nuevos de manera gradual.'
    ],
    exampleText: 'Estuvo olisqueando y atento a lo que pasaba, explorando objetos nuevos sin perder la calma.'
  },
  sick: {
    mood: 'sick',
    color: moodColors.sick,
    energy: 0.06,
    stress: 0.72,
    warmth: 0.32,
    pattern: 'pulse',
    description: 'Muy bajo de energía y algo tenso. El aura es lenta, opaca y concentra la atención hacia el centro.',
    actions: [
      'Observa si come y bebe normalmente.',
      'Permítele descansar en un lugar cálido y cómodo.',
      'Consulta al veterinario si el estado persiste.'
    ],
    exampleText: 'Hoy estuvo decaído, casi no jugó, respiró lento y comió muy poco. Se mostró más quieto de lo normal.'
  }
};



function App() {
  const [auraState, setAuraState] = useState(mockStates.calm);
  const [showLegend, setShowLegend] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [detectedMood, setDetectedMood] = useState('calm');
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisError, setAnalysisError] = useState('');

  // 2. Función para simular la entrada de voz y el cambio de estado
  const simulateVoiceInput = (stateKey) => {
    setAuraState(mockStates[stateKey]);
    setDetectedMood(stateKey);
    setAnalysisStatus('Seleccionado desde botones');
    setAnalysisError('');

    if (navigator.vibrate) {
      navigator.vibrate([80]);
    }
  };

  const handleTranscriptChange = (event) => {
    setTranscript(event.target.value);
    setAnalysisStatus('');
    setAnalysisError('');
  };

  const analyzeTranscript = async () => {
    setAnalysisStatus('Analizando con IA...');
    setAnalysisError('');

    try {
      const petProfile = `${auraState.description} ${auraState.exampleText || ''}`.trim();
      const result = await analyzeTranscriptWithAI(transcript, petProfile);
      const mood = result.mood && mockStates[result.mood] ? result.mood : 'calm';
      const nextState = {
        ...mockStates[mood],
        color: moodColors[mood] || moodColors.calm,
        ...(result.energy !== undefined ? { energy: result.energy } : {}),
        ...(result.stress !== undefined ? { stress: result.stress } : {}),
        ...(result.warmth !== undefined ? { warmth: result.warmth } : {}),
        ...(result.pattern ? { pattern: result.pattern } : {}),
        ...(result.description ? { description: result.description } : {}),
        ...(Array.isArray(result.actions) ? { actions: result.actions } : {}),
      };

      setAuraState(nextState);
      setDetectedMood(mood);
      setAnalysisStatus('¡Análisis con IA completado! Revisa la aura y recomendaciones.');
    } catch (error) {
      setAnalysisStatus('Error en el análisis con IA');
      setAnalysisError(error.message || 'Error al analizar con IA. Verifica tu conexión e intenta nuevamente.');
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="hero-card">
          <p className="app-tag">PetAura con IA</p>
          <h1>Analiza el aura emocional de tu mascota con IA</h1>
          <p className="app-subtitle">
            Describe el comportamiento de tu mascota y usa IA avanzada para analizar su estado emocional.
            Explora los 8 estados de ánimo con visualizaciones dinámicas y recomendaciones personalizadas.
          </p>

          <div className="state-buttons" role="group" aria-label="Ejemplos de estados de ánimo de mascota">
            <button
              className="state-button happy"
              onClick={() => simulateVoiceInput('happy')}
            >
              Feliz y activo
            </button>
            <button
              className="state-button calm"
              onClick={() => simulateVoiceInput('calm')}
            >
              Tranquilo
            </button>
            <button
              className="state-button tired"
              onClick={() => simulateVoiceInput('tired')}
            >
              Cansado
            </button>
            <button
              className="state-button anxious"
              onClick={() => simulateVoiceInput('anxious')}
            >
              Ansioso
            </button>
            <button
              className="state-button playful"
              onClick={() => simulateVoiceInput('playful')}
            >
              Juguetón
            </button>
            <button
              className="state-button affectionate"
              onClick={() => simulateVoiceInput('affectionate')}
            >
              Cariñoso
            </button>
            <button
              className="state-button curious"
              onClick={() => simulateVoiceInput('curious')}
            >
              Curioso
            </button>
            <button
              className="state-button sick"
              onClick={() => simulateVoiceInput('sick')}
            >
              Enfermo
            </button>
          </div>

          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.85rem' }}>
            <textarea
              id="voice-input"
              value={transcript}
              onChange={handleTranscriptChange}
              placeholder="Describe cómo se comportó tu mascota hoy: ¿jugó mucho?, ¿estuvo tranquilo?, ¿mostró signos de cansancio o ansiedad?..."
              style={{
                width: '100%',
                minHeight: '90px',
                borderRadius: '18px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                padding: '0.95rem',
                background: 'rgba(15, 23, 42, 0.9)',
                color: 'white',
                resize: 'vertical',
              }}
            />
            <button
              className="state-button calm"
              onClick={analyzeTranscript}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Analizar con IA (Groq)
            </button>
            {analysisStatus && <p className="voice-hint">{analysisStatus}</p>}
            {analysisError && <p className="voice-hint" style={{ color: '#fb7185' }}>{analysisError}</p>}
          </div>

          <p className="voice-hint">Usa los botones para probar estados predefinidos, o describe el comportamiento de tu mascota y presiona "Analizar texto con IA" para obtener un análisis personalizado con Groq.</p>
        </div>
      </header>

      <main className="app-main">
        <section className="aura-section">
          <article className="canvas-card" aria-labelledby="aura-title">
            <h2 id="aura-title">Aura actual</h2>
            <AuraCanvas parameters={auraState} />
            <p className="canvas-caption">{auraState.description}</p>
          </article>

          <div className="status-panel">
            <section className="status-card" aria-labelledby="status-title">
              <h3 id="status-title">Resumen</h3>
              <div className="status-row">
                <span className="status-label">Estado</span>
                <span className="status-value">{auraState.mood}</span>
              </div>
              <div className="parameter-bar">
                <span>Energía</span>
                <div className="meter">
                  <span style={{ width: `${auraState.energy * 100}%`, background: auraState.color }} />
                </div>
              </div>
              <div className="parameter-bar">
                <span>Estrés</span>
                <div className="meter">
                  <span style={{ width: `${auraState.stress * 100}%`, background: '#f97316' }} />
                </div>
              </div>
              <div className="parameter-bar">
                <span>Calidez</span>
                <div className="meter">
                  <span style={{ width: `${auraState.warmth * 100}%`, background: '#facc15' }} />
                </div>
              </div>
            </section>

            <section className="detail-card" aria-labelledby="actions-title">
              <h3 id="actions-title">Recomendaciones</h3>
              <ul>
                {auraState.actions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </section>

            <button
              className="legend-toggle"
              onClick={() => setShowLegend((current) => !current)}
              aria-expanded={showLegend}
            >
              {showLegend ? 'Ocultar leyenda' : 'Ver leyenda de aura'}
            </button>

            {showLegend && (
              <section className="legend-card" aria-labelledby="legend-title">
                <h3 id="legend-title">Leyenda de aura</h3>
                <div className="legend-grid">
                  <div>
                    <strong>Verde</strong>
                    <p>Vitalidad, energía positiva, momento activo.</p>
                  </div>
                  <div>
                    <strong>Turquesa</strong>
                    <p>Calma, equilibrio y bienestar sereno.</p>
                  </div>
                  <div>
                    <strong>Púrpura</strong>
                    <p>Baja energía, estrés o molestia emocional.</p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;