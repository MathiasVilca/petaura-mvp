import { useState, useEffect } from 'react';
import AuraCanvas        from './components/AuraCanvas';
import OnboardingScreen  from './components/OnboardingScreen';
import VoiceScreen       from './components/VoiceScreen';
import LoadingScreen     from './components/LoadingScreen';
import HistoryScreen     from './components/HistoryScreen';
import { analyzeTranscriptWithAI } from './ai/analyzeTranscript';

/* ── Mock states — 8 moods ──────────────────────────────────── */
const mockStates = {
  happy: {
    mood: 'happy', color: '#22c55e', energy: 0.92, stress: 0.18, warmth: 0.88, pattern: 'burst',
    description: 'Muy activo y alegre. Su aura muestra vitalidad expansiva, brillo y movimiento rápido.',
    actions: ['Juega 15 minutos con su juguete favorito.', 'Refuerza el vínculo con caricias y premios.', 'Aprovecha para dar un paseo enérgico.'],
  },
  calm: {
    mood: 'calm', color: '#14b8a6', energy: 0.28, stress: 0.12, warmth: 0.74, pattern: 'flow',
    description: 'Tranquilo y equilibrado. La aura es suave, fluida y reposada.',
    actions: ['Mantén el ambiente sereno y con poca estimulación.', 'Ofrece un espacio cómodo para descansar.', 'Observa si prefiere contacto silencioso o distancia.'],
  },
  tired: {
    mood: 'tired', color: '#facc15', energy: 0.22, stress: 0.36, warmth: 0.58, pattern: 'pulse',
    description: 'Baja energía y ritmo lento. El aura se siente suave y agotada.',
    actions: ['Permítele descansar en su lugar favorito.', 'Reduce la actividad y evita estímulos intensos.', 'Asegura agua fresca y un ambiente calmado.'],
  },
  anxious: {
    mood: 'anxious', color: '#fb7185', energy: 0.42, stress: 0.82, warmth: 0.44, pattern: 'orbit',
    description: 'Nervioso y alerta. La aura se mueve con tensión y oscilaciones inquietas.',
    actions: ['Crea un espacio seguro y sin ruido.', 'Habla con voz suave y acaricia lentamente.', 'Observa sus señales de calma antes de acercarte.'],
  },
  playful: {
    mood: 'playful', color: '#8b5cf6', energy: 0.85, stress: 0.22, warmth: 0.88, pattern: 'burst',
    description: 'Lleno de ganas de jugar. El aura es brillante y expansiva.',
    actions: ['Ofrece un juguete nuevo o una sesión de juegos corta.', 'Premia su entusiasmo con caricias y elogios.', 'Aprovecha para fortalecer el vínculo con actividades lúdicas.'],
  },
  affectionate: {
    mood: 'affectionate', color: '#ec4899', energy: 0.62, stress: 0.18, warmth: 0.95, pattern: 'flow',
    description: 'Cariñoso y conectado. El aura es cálida, fluida y acogedora.',
    actions: ['Ofrece un abrazo suave o caricias cerca de su cabeza.', 'Permite tiempo de calidad en contacto tranquilo.', 'Refuerza la conexión con palabras suaves y cercanía.'],
  },
  curious: {
    mood: 'curious', color: '#38bdf8', energy: 0.68, stress: 0.28, warmth: 0.72, pattern: 'flow',
    description: 'Interesado y atento. El aura se desplaza explorando con movimientos suaves.',
    actions: ['Deja objetos seguros para que los inspeccione con calma.', 'Observa su lenguaje corporal antes de interactuar.', 'Ofrece estímulos nuevos de manera gradual.'],
  },
  sick: {
    mood: 'sick', color: '#581c87', energy: 0.06, stress: 0.72, warmth: 0.32, pattern: 'pulse',
    description: 'Muy bajo de energía y algo tenso. El aura es lenta y opaca.',
    actions: ['Observa si come y bebe normalmente.', 'Permítele descansar en un lugar cálido y cómodo.', 'Consulta al veterinario si el estado persiste.'],
  },
};

/* ── localStorage helpers ───────────────────────────────────── */
const PROFILE_KEY = 'petaura_profile';
const HISTORY_KEY = 'petaura_history';
const STREAK_KEY  = 'petaura_streak';

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch { return null; }
}
function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function loadStreak() {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || { count: 0, lastDate: '' }; }
  catch { return { count: 0, lastDate: '' }; }
}
function calcStreak() {
  const today = new Date().toISOString().split('T')[0];
  const prev  = loadStreak();
  const yd    = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const count = prev.lastDate === today ? prev.count
              : prev.lastDate === yd    ? prev.count + 1
              : 1;
  localStorage.setItem(STREAK_KEY, JSON.stringify({ count, lastDate: today }));
  return count;
}
function getMilestone(total, streak) {
  if (total === 1) return 'Primera aura guardada';
  if (total === 3) return '3 auras registradas — vas bien';
  if (total === 7) return 'Una semana de seguimiento';
  if (streak === 3) return '3 dias seguidos';
  if (streak === 7) return 'Racha de 7 dias';
  return null;
}

function saveAuraToHistory(auraState) {
  try {
    const entry = {
      date:        new Date().toISOString().split('T')[0],
      timestamp:   new Date().toISOString(),
      mood:        auraState.mood,
      color:       auraState.color,
      energy:      auraState.energy,
      stress:      auraState.stress,
      warmth:      auraState.warmth,
      pattern:     auraState.pattern,
      description: auraState.description,
      actions:     auraState.actions,
    };
    const current = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    current.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(current.slice(0, 30)));
  } catch {}
}

/* ── App ────────────────────────────────────────────────────── */
function App() {
  const [screen,         setScreen]         = useState(null);
  const [petProfile,     setPetProfile]     = useState(null);
  const [auraState,      setAuraState]      = useState(mockStates.calm);
  const [showLegend,     setShowLegend]     = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisError,  setAnalysisError]  = useState('');
  const [transcript,     setTranscript]     = useState('');
  const [streak,         setStreak]         = useState(0);
  const [toast,          setToast]          = useState('');

  /* ── Auto-dismiss toast ─────────────────────────────────── */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── Init: check localStorage for existing profile ─────── */
  useEffect(() => {
    const profile = loadProfile();
    if (profile?.name) {
      setPetProfile(profile);
      setScreen('home');
    } else {
      setScreen('onboarding');
    }
    setStreak(loadStreak().count);
  }, []);

  /* ── Handlers ───────────────────────────────────────────── */
  const handleOnboardingComplete = (name, species) => {
    const profile = { name, species };
    setPetProfile(profile);
    saveProfile(profile);
    setScreen('home');
  };

  const applyAnalysisResult = (result) => {
    const mood = result.mood && mockStates[result.mood] ? result.mood : 'calm';
    const next = {
      ...mockStates[mood],
      ...(result.energy      !== undefined      ? { energy:      result.energy }      : {}),
      ...(result.stress      !== undefined      ? { stress:      result.stress }      : {}),
      ...(result.warmth      !== undefined      ? { warmth:      result.warmth }      : {}),
      ...(result.pattern                        ? { pattern:     result.pattern }     : {}),
      ...(result.description                    ? { description: result.description } : {}),
      ...(Array.isArray(result.actions)         ? { actions:     result.actions }     : {}),
    };
    setAuraState(next);
    saveAuraToHistory(next);

    const newStreak = calcStreak();
    setStreak(newStreak);
    const total = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').length;
    const msg   = getMilestone(total, newStreak);
    if (msg) {
      setToast(msg);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 300]);
    } else {
      if (navigator.vibrate) navigator.vibrate([80]);
    }
  };

  const handleVoiceConfirm = async (voiceTranscript) => {
    setScreen('loading');
    setAnalysisError('');
    setAnalysisStatus('');
    try {
      const profileText = `Nombre: ${petProfile.name}, Especie: ${petProfile.species}`;
      const result = await analyzeTranscriptWithAI(voiceTranscript, profileText);
      applyAnalysisResult(result);
      setAnalysisStatus('Aura generada');
    } catch (err) {
      setAnalysisError(err.message || 'No se pudo analizar');
    }
    setScreen('home');
  };

  const handleTextAnalyze = async () => {
    if (!transcript.trim()) return;
    setScreen('loading');
    setAnalysisError('');
    setAnalysisStatus('');
    try {
      const profileText = `Nombre: ${petProfile?.name ?? 'mascota'}, Especie: ${petProfile?.species ?? 'desconocida'}`;
      const result = await analyzeTranscriptWithAI(transcript, profileText);
      applyAnalysisResult(result);
      setAnalysisStatus('Análisis completado');
    } catch (err) {
      setAnalysisError(err.message || 'No se pudo analizar');
    }
    setScreen('home');
  };

  const handleReset = () => {
    if (!window.confirm(`¿Borrar el perfil de ${petProfile?.name} y todo el historial?`)) return;
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(STREAK_KEY);
    setPetProfile(null);
    setAuraState(mockStates.calm);
    setStreak(0);
    setToast('');
    setAnalysisStatus('');
    setAnalysisError('');
    setScreen('onboarding');
  };

  const simulateState = (key) => {
    setAuraState(mockStates[key]);
    setAnalysisStatus('Estado simulado');
    setAnalysisError('');
    if (navigator.vibrate) navigator.vibrate([80]);
  };

  /* ── Screen routing ─────────────────────────────────────── */
  if (screen === null)         return null;
  if (screen === 'onboarding') return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  if (screen === 'loading')    return <LoadingScreen petName={petProfile?.name ?? 'tu mascota'} />;
  if (screen === 'voice')      return (
    <VoiceScreen
      petName={petProfile?.name ?? 'tu mascota'}
      onConfirm={handleVoiceConfirm}
      onBack={() => setScreen('home')}
    />
  );
  if (screen === 'history')    return (
    <HistoryScreen
      petName={petProfile?.name ?? 'tu mascota'}
      onBack={() => setScreen('home')}
    />
  );

  /* ── Home screen ────────────────────────────────────────── */
  return (
    <div className="app-shell">
      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #7c6bff, #5b4de0)',
          color: '#fff', padding: '.75rem 1.5rem', borderRadius: 999,
          fontWeight: 600, fontSize: '.9rem', zIndex: 999,
          boxShadow: '0 4px 24px rgba(124,107,255,.45)',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
      <header className="app-header">
        <div className="hero-card">

          {/* Identity & primary actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <p className="app-tag">PetAura</p>
              <h1 style={{ margin: 0 }}>{petProfile?.name ?? 'Tu mascota'}</h1>
              <p style={{ margin: '.35rem 0 0', color: '#64748b', fontSize: '.9rem' }}>
                {petProfile?.species}
              </p>
              {streak > 0 && (
                <p style={{ margin: '.3rem 0 0', color: '#7c6bff', fontSize: '.82rem', fontWeight: 700 }}>
                  Racha: {streak} {streak === 1 ? 'dia' : 'dias'}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button onClick={() => setScreen('history')} style={btn.ghost}>
                Historial
              </button>
              <button onClick={handleReset} style={btn.danger} title="Borrar perfil e historial">
                Resetear
              </button>
            </div>
          </div>

          {/* Voice recording — main CTA */}
          <button
            onClick={() => setScreen('voice')}
            style={btn.primary}
          >
            Registrar por voz
          </button>

          {/* Demo states */}
          <details style={{ marginTop: '.25rem' }}>
            <summary style={{ color: '#475569', fontSize: '.85rem', cursor: 'pointer', userSelect: 'none' }}>
              Probar estados (demo)
            </summary>
            <div className="state-buttons" role="group" style={{ marginTop: '.75rem' }} aria-label="Simular estados">
              {Object.keys(mockStates).map(key => (
                <button
                  key={key}
                  className={`state-button ${['happy','calm','sick'].includes(key) ? key : 'calm'}`}
                  style={{ background: mockStates[key].color, color: '#fff' }}
                  onClick={() => simulateState(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          </details>

          {/* Text analysis fallback */}
          <details>
            <summary style={{ color: '#475569', fontSize: '.85rem', cursor: 'pointer', userSelect: 'none' }}>
              Analizar por texto
            </summary>
            <div style={{ marginTop: '.75rem', display: 'grid', gap: '.75rem' }}>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                placeholder="Describe cómo estuvo tu mascota..."
                style={inp.textarea}
              />
              <button className="state-button calm" onClick={handleTextAnalyze} style={{ justifyContent: 'center' }}>
                Analizar con IA
              </button>
              {analysisStatus && <p className="voice-hint">{analysisStatus}</p>}
              {analysisError  && <p className="voice-hint" style={{ color: '#fb7185' }}>{analysisError}</p>}
            </div>
          </details>
        </div>
      </header>

      <main className="app-main">
        <section className="aura-section">
          <article
            className="canvas-card"
            onClick={() => setShowLegend(v => !v)}
            style={{ cursor: 'pointer' }}
            aria-labelledby="aura-title"
          >
            <h2 id="aura-title">Aura de hoy</h2>
            <AuraCanvas parameters={auraState} />
            <p className="canvas-caption">{auraState.description}</p>
          </article>

          <div className="status-panel">
            <section className="status-card" aria-labelledby="status-title">
              <h3 id="status-title">Resumen</h3>
              <div className="status-row">
                <span className="status-label">Estado</span>
                <span className="status-value" style={{ color: auraState.color }}>
                  {auraState.mood}
                </span>
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
                {auraState.actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </section>

            <button
              className="legend-toggle"
              onClick={() => setShowLegend(v => !v)}
              aria-expanded={showLegend}
            >
              {showLegend ? 'Ocultar leyenda' : 'Ver leyenda de aura'}
            </button>

            {showLegend && (
              <section className="legend-card" aria-labelledby="legend-title">
                <h3 id="legend-title">Leyenda de colores</h3>
                <div className="legend-grid">
                  {Object.values(mockStates).map(st => (
                    <div key={st.mood} style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: st.color, flexShrink: 0, display: 'inline-block' }} />
                      <div>
                        <strong style={{ color: st.color, fontSize: '.9rem' }}>{st.mood}</strong>
                        <p style={{ margin: '0.1rem 0 0', fontSize: '.82rem' }}>{st.description.split('.')[0]}.</p>
                      </div>
                    </div>
                  ))}
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

/* ── Local inline styles (home screen extras) ───────────────── */
const btn = {
  primary: {
    width: '100%',
    padding: '1rem',
    minHeight: 52,
    borderRadius: 999,
    border: 'none',
    background: 'linear-gradient(135deg, #7c6bff, #5b4de0)',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  ghost: {
    padding: '.6rem 1.2rem',
    minHeight: 48,
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,.25)',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '.9rem',
    cursor: 'pointer',
  },
  danger: {
    padding: '.6rem 1rem',
    minHeight: 48,
    borderRadius: 999,
    border: '1px solid rgba(248,113,113,.3)',
    background: 'transparent',
    color: '#f87171',
    fontSize: '.85rem',
    cursor: 'pointer',
  },
};

const inp = {
  textarea: {
    width: '100%',
    minHeight: 90,
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,.25)',
    padding: '.95rem',
    background: 'rgba(15,23,42,.9)',
    color: 'white',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontSize: '.95rem',
  },
};
