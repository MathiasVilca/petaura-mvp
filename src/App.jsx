import { useState } from 'react';
import AuraCanvas from './components/AuraCanvas';

// 1. Nuestros JSONs simulados (Lo que devolvería Claude)
const mockStates = {
  happy: {
    mood: 'happy',
    color: '#22c55e',
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
    color: '#14b8a6',
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
  sick: {
    mood: 'sick',
    color: '#581c87',
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

  // 2. Función para simular la entrada de voz y el cambio de estado
  const simulateVoiceInput = (stateKey) => {
    setAuraState(mockStates[stateKey]);

    if (navigator.vibrate) {
      navigator.vibrate([80]);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="hero-card">
          <p className="app-tag">PetAura MVP</p>
          <h1>Conecta con el aura de tu mascota</h1>
          <p className="app-subtitle">
            Simula la entrada por voz y observa cómo cambia la visualización de aura en tiempo real.
            Este prototipo cumple el flujo inicial de interacción con feedback inmediato.
          </p>

          <div className="state-buttons" role="group" aria-label="Simular estados de mascota">
            <button
              className="state-button happy"
              onClick={() => simulateVoiceInput('happy')}
            >
              Muy feliz y activo
            </button>
            <button
              className="state-button calm"
              onClick={() => simulateVoiceInput('calm')}
            >
              Tranquilo
            </button>
            <button
              className="state-button sick"
              onClick={() => simulateVoiceInput('sick')}
            >
              Decaído / enfermo
            </button>
          </div>

          <p className="voice-hint">Presiona un estado para cambiar la aura y ver recomendaciones instantáneas.</p>
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