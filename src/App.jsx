import { useState, useEffect, useRef } from 'react';
import AuraCanvas        from './components/AuraCanvas';
import OnboardingScreen  from './components/OnboardingScreen';
import VoiceScreen       from './components/VoiceScreen';
import LoadingScreen     from './components/LoadingScreen';
import HistoryScreen     from './components/HistoryScreen';
import PetDashboard      from './components/PetDashboard';
// import { PayloadInjector } from './components/PayloadInyector.jsx';
import { analyzeTranscriptWithAI } from './ai/analyzeTranscript';
import { generateAuraFromPhoto } from './services/groqService';
import PhotoAnalysisMenu from './components/PhotoAnalysisMenu';
import { MOODS , COLORS_MOOD, MOOD_ES ,mockStates } from './moods.js';

/* ── localStorage helpers ─────────────────────────────────────────────── */
// PROFILE_KEY se mantiene por compatibilidad con datos antiguos de perfil único
const PROFILE_KEY  = 'petaura_profile';
const PROFILES_KEY = 'petaura_profiles';   // nuevo: array de perfiles
const ACTIVE_PET_KEY = 'petaura_active_pet'; // nuevo: id del perfil activo
const HISTORY_KEY  = 'petaura_history';
const STREAK_KEY   = 'petaura_streak';
const historyTotalLength= JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').length;

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch { return null; }
}
function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/* ── Multi-pet helpers ────────────────────────────────────────────── */
function loadProfiles() {
  try {
    const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY));
    if (Array.isArray(profiles) && profiles.length > 0) return profiles;
    // Migración desde perfil único legacy
    const legacy = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (legacy?.name) {
      const migrated = [{ ...legacy, id: 'pet_' + Date.now() }]; // asignar nuevo id unico, puede cambiar
      localStorage.setItem(PROFILES_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return [];
  } catch { return []; }
}
function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}
function getActiveProfile(profiles) {
  const activeId = localStorage.getItem(ACTIVE_PET_KEY);
  if (activeId) {
    const found = profiles.find(p => p.id === activeId);
    if (found) return found;
  }
  return profiles[0] ?? null;
}
function setActiveProfile(id) {
  localStorage.setItem(ACTIVE_PET_KEY, id);
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

function saveAuraToHistory(auraState,petId) {
  try {
    const entry = {
      petId:       petId,
      date:        new Date().toISOString().split('T')[0],
      timestamp:   new Date().toISOString(),
      mood:        auraState.mood,
      mood_secondary: auraState.mood_secondary ?? null,
      color:       auraState.color,
      secondaryColor:auraState.secondaryColor ?? null,
      energy:      auraState.energy,
      stress:      auraState.stress,
      warmth:      auraState.warmth,
      pattern:     auraState.pattern,
      description: auraState.description,
      summary:     auraState.summary ?? null,
      health_concern: auraState.health_concern ?? false,
      actions:     auraState.actions,
    };
    const current = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    current.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(current.slice(0, 30)));
  } catch {}
}

/* ── SA1: Web Speech Synthesis ─────────────────────────────── */
const VOICE_MUTED_KEY = 'petaura_voice_muted';

function speakSummary(text, muted) {
  if (muted) return;
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();           // cancela cualquier lectura previa
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'es-ES';
  utter.rate = 0.95;
  utter.pitch = 1;
  // Preferir voz en español si está disponible
  const voices = window.speechSynthesis.getVoices();
  const esVoice = voices.find(v => v.lang.startsWith('es'));
  if (esVoice) utter.voice = esVoice;
  window.speechSynthesis.speak(utter);
}

//para summaries
const DemoMenu = ({ simulateState }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div style={{ 
        marginTop: '.25rem',
        position: 'relative', 
        display: 'inline-block',
        zIndex: 999,
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen} 
        style={{ 
          color: '#7080a0', 
          fontSize: '.85rem', 
          cursor: 'pointer', 
          background: 'transparent', 
          border: 'none',
          padding: 0,
          userSelect: 'none',
          
        }}
      >
        {isOpen ? '▼' : '▶'} Probar estados (demo)
      </button>
      <div 
        className="state-buttons" 
        role="group"
        aria-label="Simular estados"
        style={{ 
          marginTop: '.75rem', 
          display: isOpen? 'flex':'none',
          gap: '0.5rem',
          flexDirection: 'column',
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 999,
          background: '#1a1a2e', 
          padding: '0.75rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          marginTop: '0.5rem',
          width:300
        }}
      >
        {Object.keys(mockStates).map(key => (
          <button
            key={key}
            className={`state-button`}
            style={{ background: mockStates[key].color, color: '#fff' }}
            onClick={() => {simulateState(key) ; setIsOpen(!isOpen)}}
          >
            {MOOD_ES[key] || key}
          </button>
        ))}
      </div>
    </div>
  );
};

const TextAnalysisMenu = ({transcript,setTranscript,handleTextAnalyze,analysisStatus,analysisError}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        style={{ 
          color: '#7080a0', 
          fontSize: '.85rem', 
          cursor: 'pointer', 
          userSelect: 'none',
          background: 'transparent', 
          border: 'none',
          padding: 0
        }}
      >
        {isOpen ? '▼' : '▶'} Analizar por texto
      </button>
      <div style={{ marginTop: '.75rem', display: 'grid', gap: '.75rem' }}>
        { isOpen && (
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="Describe cómo estuvo tu mascota..."
            display='none'
            style={
              inp.textarea
            }
          />
        )}
        <button 
          className="state-button calm" 
          onClick={handleTextAnalyze} 
          style={{ 
            justifyContent: 'center',
            display: isOpen? 'flex':'none'
          }}
        >
          Analizar con IA
        </button>
        {analysisStatus && <p className="voice-hint">{analysisStatus}</p>}
        {analysisError  && <p className="voice-hint" style={{ color: '#fb7185' }}>{analysisError}</p>}
      </div>
    </div>
  )
}

/* ── App ────────────────────────────────────────────────────── */
function App() {
  const [screen,         setScreen]         = useState(null);
  const [petProfile,     setPetProfile]     = useState(null);
  const [profiles,       setProfiles]       = useState([]);  // F1: multi-perfil
  const [auraState,      setAuraState]      = useState(mockStates.calm);
  const [isDemoAura, setIsDemoAura] = useState(true);
  const [showLegend,     setShowLegend]     = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisError,  setAnalysisError]  = useState('');
  const [transcript,     setTranscript]     = useState('');
  const [streak,         setStreak]         = useState(0);
  const [toast,          setToast]          = useState('');
  const [showSummary,    setShowSummary]    = useState(false);
  // SA1: voz — leer del localStorage para recordar preferencia
  const [voiceMuted,     setVoiceMuted]     = useState(
    () => localStorage.getItem(VOICE_MUTED_KEY) === 'true'
  );

  const longPressRef    = useRef(null);
  const suppressClickRef = useRef(false);
  const avatarInputRef  = useRef(null);

  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

  /* ── Auto-dismiss toast ─────────────────────────────────── */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── Init: check localStorage for existing profile ───────────────── */
  useEffect(() => {
    const allProfiles = loadProfiles();
    if (allProfiles.length > 1) {
      setProfiles(allProfiles);
      const active = getActiveProfile(allProfiles);
      setPetProfile(active);
      setScreen('dashboard');
    } else if (allProfiles.length === 1) {
      setProfiles(allProfiles);
      setPetProfile(allProfiles[0]);
      setScreen('home');
    } else {
      setScreen('onboarding');
    }
    setStreak(loadStreak().count);
  }, []);

  /* ── Handlers ────────────────────────────────────────────── */
  const handleOnboardingComplete = (name, species, breed) => {
    const newProfile = { id: 'pet_' + Date.now(), name, species, breed: breed || '' };
    const updatedProfiles = [...profiles, newProfile];
    setProfiles(updatedProfiles);
    saveProfiles(updatedProfiles);
    // Mantener compatibilidad con el key legacy (un solo perfil activo)
    saveProfile(newProfile);
    setActiveProfile(newProfile.id);
    setPetProfile(newProfile);
    setScreen(updatedProfiles.length > 1 ? 'dashboard' : 'home');
  };

  const applyAnalysisResult = (result) => {
    const mood = result.mood && mockStates[result.mood] ? result.mood : MOODS.CALM;
    // Solo acepta secondary si existe en COLORS_MOOD y no duplica el primario
    const secondary =
      result.mood_secondary && result.mood_secondary !== mood && COLORS_MOOD[result.mood_secondary]
        ? result.mood_secondary
        : null;
    const next = {
      ...mockStates[mood],   // pattern siempre derivado del mood, el LLM ya no lo decide
      ...(result.energy      !== undefined      ? { energy:         result.energy }         : {}),
      // Piso de stress: el LLM suele emitir 0 en moods positivos, lo que apaga el latido del aura
      stress: Math.max(0.1, result.stress ?? mockStates[mood].stress),
      ...(result.warmth      !== undefined      ? { warmth:         result.warmth }         : {}),
      ...(result.description                    ? { description:    result.description }    : {}),
      ...(result.summary                        ? { summary:        result.summary }        : {}),
      mood_secondary: secondary,
      secondaryColor: secondary ? COLORS_MOOD[secondary] : null,
      // MVP: booleano. Futuro: nivel 0-2 con badge graduado + atenuación del aura.
      health_concern: result.health_concern === true,
      ...(Array.isArray(result.actions)         ? { actions:        result.actions }        : {}),
    };
    setAuraState(next);
    setIsDemoAura(false);
    saveAuraToHistory(next, petProfile?.id);

    // SA1: leer el summary en voz alta al generar aura
    if (next.summary) speakSummary(next.summary, voiceMuted);

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
      const breed = petProfile?.breed ? `, Raza: ${petProfile.breed}` : '';
      const profileText = `Nombre: ${petProfile.name}, Especie: ${petProfile.species}${breed}`;
      const result = await analyzeTranscriptWithAI(voiceTranscript, profileText);
      applyAnalysisResult(result);
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
      const breed = petProfile?.breed ? `, Raza: ${petProfile.breed}` : '';
      const profileText = `Nombre: ${petProfile?.name ?? 'mascota'}, Especie: ${petProfile?.species ?? 'desconocida'}${breed}`;
      const result = await analyzeTranscriptWithAI(transcript, profileText);
      applyAnalysisResult(result);
      setTranscript('');
    } catch (err) {
      setAnalysisError(err.message || 'No se pudo analizar');
    }
    setScreen('home');
  };

  const handlePhotoAnalyze = async (imageBase64, mimeType, contextText) => {
    if (!petProfile || screen === 'loading') return;
    setScreen('loading');
    setAnalysisError('');
    setAnalysisStatus('');
    try {
      const breed = petProfile.breed ? `, Raza: ${petProfile.breed}` : '';
      const profileText = `Nombre: ${petProfile.name}, Especie: ${petProfile.species}${breed}`;
      const result = await generateAuraFromPhoto({ imageBase64, mimeType, profileText, contextText });
      applyAnalysisResult(result);
    } catch (err) {
      const fallbackResult = {
        ...mockStates[MOODS.CALM],
        summary: `No se pudo analizar la foto de ${petProfile.name}. Intenta de nuevo con mejor iluminación.`,
        actions: [],
        health_concern: false,
        mood_secondary: null,
      };
      applyAnalysisResult(fallbackResult);
      setAnalysisError(err.message || 'No se pudo analizar la foto');
    }
    setScreen('home');
  };

  const handleReset = () => {
    if (!window.confirm(`¿Borrar el perfil de ${petProfile?.name} y todo el historial?`)) return;
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(PROFILES_KEY);
    localStorage.removeItem(ACTIVE_PET_KEY);
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(STREAK_KEY);
    setPetProfile(null);
    setProfiles([]);
    setAuraState(mockStates[MOODS.CALM]);
    setStreak(0);
    setToast('');
    setAnalysisStatus('');
    setAnalysisError('');
    setScreen('onboarding');
  };

  const simulateState = (key) => {
    setAuraState(mockStates[key]);
    setIsDemoAura(true);
    setAnalysisError('');
    if (navigator.vibrate) navigator.vibrate([80]);
  };

  const handleSelectPet = (petId) => {
    const found = profiles.find(p => p.id === petId);
    if (!found) return;
    setActiveProfile(petId);
    saveProfile(found);
    setPetProfile(found);

    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      const last = history.find(e => e.petId === petId);
      if (last) {
        const mood = last.mood && mockStates[last.mood] ? last.mood : MOODS.CALM;
        setAuraState({
          ...mockStates[mood],
          energy:         last.energy         ?? mockStates[mood].energy,
          stress:         last.stress         ?? mockStates[mood].stress,
          warmth:         last.warmth         ?? mockStates[mood].warmth,
          pattern:        last.pattern        ?? mockStates[mood].pattern,
          description:    last.description    ?? mockStates[mood].description,
          summary:        last.summary        ?? null,
          mood_secondary: last.mood_secondary ?? null,
          secondaryColor: last.mood_secondary ? COLORS_MOOD[last.mood_secondary] : null,
          health_concern: last.health_concern ?? false,
          actions:        Array.isArray(last.actions) ? last.actions : mockStates[mood].actions,
        });
        setIsDemoAura(false);
      } else {
        setAuraState(mockStates[MOODS.CALM]);
        setIsDemoAura(true);
      }
    } catch {
      setAuraState(mockStates[MOODS.CALM]);
    }

    setTranscript('');
    setAnalysisStatus('');
    setAnalysisError('');
    setScreen('home');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !petProfile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, 80, 80);
        const avatarData = canvas.toDataURL('image/jpeg', 0.8);
        const updated = { ...petProfile, avatar: avatarData };
        setPetProfile(updated);
        const updatedProfiles = profiles.map(p => p.id === updated.id ? updated : p);
        setProfiles(updatedProfiles);
        saveProfiles(updatedProfiles);
        saveProfile(updated);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ── Screen routing ─────────────────────────────────────── */
  if (screen === null)         return null;
  if (screen === 'onboarding') return (
    <OnboardingScreen
      onComplete={handleOnboardingComplete}
      onBack={profiles.length > 1 ? () => setScreen('dashboard')
            : profiles.length === 1 ? () => setScreen('home')
            : null}
    />
  );
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
      petId={petProfile?.id}
      onBack={() => setScreen('home')}
    />
  );
  if (screen === 'dashboard')  return (
    <PetDashboard
      profiles={profiles}
      history={JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')}
      activeId={petProfile?.id}
      onSelectPet={handleSelectPet}
      onAddPet={() => setScreen('onboarding')}
    />
  );

  //contiene cuenta de estados de todos los perfiles
  const auraCountByPet = history.reduce((counts, entry) => {
    counts[entry.petId] = (counts[entry.petId] || 0) + 1;
    return counts;
  }, {});
  //se fija la cantidad de auras del perfil
  const activePetAuraCount = petProfile?.id
    ? auraCountByPet[petProfile.id] || 0
    : 0;
  //tiene menos de tres perfiles
  const hasLessThanThreeProfiles = profiles.length < 3;
  //tiene cualquier perfil con más de una aura
  const hasAnyPetWithMoreThanOneAura = profiles.some((profile) => {
    return (auraCountByPet[profile.id] || 0) > 1;
  });


const shouldShowHint =
  !isDemoAura &&
  activePetAuraCount > 0 &&
  hasLessThanThreeProfiles &&
  !hasAnyPetWithMoreThanOneAura;

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

      <section className="home-layout">
        {/* ── Columna izquierda: controles + resumen + recomendaciones ── */}
        <div className="home-left">
          <div className="hero-card">
            {/* Identity & primary actions */}
            <div style={{ display: 'grid', gap: '.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}>
                  <button
                    onClick={() => setScreen('dashboard')}
                    style={btn.icon}
                    aria-label="Ir al dashboard"
                  >
                    ←
                  </button>
                  <p className="app-tag" style={{ margin: 0 }}>Inicio</p>
                </div>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {profiles.length >= 1 && (
                    <button onClick={() => setScreen('onboarding')} style={btn.ghost}>
                      + Mascota
                    </button>
                  )}
                  <button onClick={() => setScreen('history')} style={btn.ghost}>
                    Historial
                  </button>
                  <button
                    id="voice-mute-btn"
                    onClick={() => {
                      const next = !voiceMuted;
                      setVoiceMuted(next);
                      localStorage.setItem(VOICE_MUTED_KEY, String(next));
                      if (next) window.speechSynthesis?.cancel();
                    }}
                    style={{ ...btn.ghost, fontSize: '1.1rem', padding: '.6rem 1rem' }}
                    title={voiceMuted ? 'Activar voz del aura' : 'Silenciar voz del aura'}
                    aria-label={voiceMuted ? 'Activar síntesis de voz' : 'Silenciar síntesis de voz'}
                  >
                    {voiceMuted ? '🔇' : '🔊'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingLeft: '.15rem', marginTop: '.15rem' }}>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  style={avatarStyles.wrap}
                  aria-label="Cambiar foto de mascota"
                >
                  {petProfile?.avatar ? (
                    <img src={petProfile.avatar} alt="" style={avatarStyles.img} />
                  ) : (
                    <span style={avatarStyles.initial}>
                      {(petProfile?.name ?? '?')[0].toUpperCase()}
                    </span>
                  )}
                  <span style={avatarStyles.badge}>📷</span>
                </button>
                <div style={{ display: 'grid', gap: '.25rem' }}>
                  <h1 style={{ margin: 0, lineHeight: 1.05 }}>{petProfile?.name ?? 'Tu mascota'}</h1>
                  <p style={{ margin: 0, color: '#8899b0', fontSize: '.9rem' }}>
                    {petProfile?.species}{petProfile?.breed ? ` · ${petProfile.breed}` : ''}
                  </p>
                  {streak > 0 && (
                    <p style={{ margin: '.2rem 0 0', color: '#7c6bff', fontSize: '.82rem', fontWeight: 700 }}>
                      Racha: {streak} {streak === 1 ? 'dia' : 'dias'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button onClick={() => setScreen('voice')} style={btn.primary}>
              Registrar por voz
            </button>

            <DemoMenu simulateState={simulateState} />

            <TextAnalysisMenu
              transcript={transcript}
              setTranscript={setTranscript}
              handleTextAnalyze={handleTextAnalyze}
              analysisStatus={analysisStatus}
              analysisError={analysisError}
            />

            <PhotoAnalysisMenu
              key={petProfile?.id}
              petProfile={petProfile}
              onAnalyzePhoto={handlePhotoAnalyze}
              isAnalyzing={screen === 'loading'}
            />

          </div>

          <section className="status-card" aria-labelledby="status-title">
            <h3 id="status-title">Resumen</h3>
            <div className="status-row">
              <span className="status-label">Estado</span>
              <span className="status-value" style={{ color: auraState.color }}>
                {MOOD_ES[auraState.mood] || auraState.mood}
              </span>
            </div>
            {auraState.mood_secondary && auraState.mood_secondary != "null" && (
              <div className="status-row">
                <span className="status-label">Estado Secundario</span>
                <span className="status-value" style={{ color: auraState.secondaryColor }}>
                  {MOOD_ES[auraState.mood_secondary] || auraState.mood_secondary}
                </span>
              </div>
            )}
            <div className="parameter-bar">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Energía</span>
                <span style={{ color: '#8899b0', fontSize: '.82rem' }}>{Math.round(auraState.energy * 100)}</span>
              </div>
              <div className="meter">
                <span style={{ width: `${auraState.energy * 100}%`, background: auraState.color }} />
              </div>
            </div>
            <div className="parameter-bar">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Estrés</span>
                <span style={{ color: '#8899b0', fontSize: '.82rem' }}>{Math.round(auraState.stress * 100)}</span>
              </div>
              <div className="meter">
                <span style={{ width: `${auraState.stress * 100}%`, background: '#f97316' }} />
              </div>
            </div>
          </section>

          <section className="detail-card" aria-labelledby="actions-title">
            <h3 id="actions-title">Recomendaciones</h3>
            <div style={ac.list}>
              {auraState.actions.map((a, i) => {
                const action = typeof a === 'string' ? a : a.action;
                const reason = typeof a === 'string' ? '' : (a.reason || '');
                return (
                  <div key={i} style={ac.card}>
                    <p style={ac.action}>{action}</p>
                    {reason && <p style={ac.reason}>{reason}</p>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* <PayloadInjector applyAnalysisResult={applyAnalysisResult} /> */}

          {/* <button onClick={handleReset} style={btn.dangerSm} title="Borrar perfil e historial">
            Resetear cuenta
          </button> */}
        </div>

        {/* ── Columna derecha: Aura protagonista + leyenda ── */}
        <div className="home-right">
          <article
            className="canvas-card"
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                setShowSummary(false);
                return;
              }
            }}
            onMouseEnter={() => { if (auraState.summary) setShowSummary(true); }}
            onMouseLeave={() => setShowSummary(false)}
            onTouchStart={() => {
              if (!auraState.summary || showSummary) return;
              longPressRef.current = setTimeout(() => {
                setShowSummary(true);
                suppressClickRef.current = true;
              }, 400);
            }}
            onTouchMove={() => clearTimeout(longPressRef.current)}
            onTouchEnd={() => clearTimeout(longPressRef.current)}
            style={{ cursor: 'pointer' }}
            aria-labelledby="aura-title"
          >
            <h2 id="aura-title">Aura</h2>
            <AuraCanvas parameters={auraState} />
            <p className="canvas-caption">{auraState.description}</p>

            {auraState.health_concern && (
              <p style={healthBadge}> &#9888;&#65039; Posible problema de salud — obsérvalo de cerca</p>
            )}

            
            {shouldShowHint && (
              <p style={hintBadge}> &#128161; Tip: Al pasar el mouse por encima del aura, puedes ver el razonamiento de la IA! Coso {JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').length}</p>
            )}


            {showSummary && auraState.summary && (
              <div style={summaryOverlay}>
                <p style={so.label}>Razonamiento del aura</p>
                <p style={so.text}>{auraState.summary}</p>
                <p style={so.hint}>
                  Desktop: mueve el cursor · Móvil: toca para cerrar
                </p>
              </div>
            )}
          </article>

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
                      <strong style={{ color: st.color, fontSize: '.9rem' }}>{MOOD_ES[st.mood] || st.mood}</strong>
                      <p style={{ margin: '0.1rem 0 0', fontSize: '.82rem' }}>{st.description.split('.')[0]}.</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
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
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
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
  dangerSm: {
    alignSelf: 'flex-start',
    padding: '.35rem .85rem',
    minHeight: 36,
    borderRadius: 999,
    border: '1px solid rgba(248,113,113,.2)',
    background: 'transparent',
    color: '#7080a0',
    fontSize: '.78rem',
    cursor: 'pointer',
  },
  icon: {
    width: 38,
    height: 38,
    minWidth: 38,
    borderRadius: '50%',
    border: '1px solid rgba(148,163,184,.25)',
    background: 'rgba(15,23,42,.85)',
    color: '#94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: 0,
    lineHeight: 1,
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

/* ── Action cards (F4) ──────────────────────────────────────── */
const ac = {
  list:   { display: 'flex', flexDirection: 'column', gap: '.5rem' },
  card:   { background: 'rgba(148,163,184,.06)', border: '1px solid rgba(148,163,184,.1)', borderRadius: 12, padding: '.6rem .85rem' },
  action: { margin: 0, color: '#cbd5e1', fontSize: '.88rem', lineHeight: 1.55, fontWeight: 500 },
  reason: { margin: '.3rem 0 0', color: '#7080a0', fontSize: '.8rem', lineHeight: 1.5 },
};

/* ── Health concern badge (MVP booleano) ────────────────────── */
const healthBadge = {
  margin: '.6rem auto 0',
  display: 'inline-block',
  padding: '.4rem .9rem',
  borderRadius: 999,
  background: 'rgba(220,38,38,.12)',
  border: '1px solid rgba(220,38,38,.4)',
  color: '#fca5a5',
  fontSize: '.82rem',
  fontWeight: 600,
};

/* ── Hint badge ────────────────────── */
const hintBadge = {
  margin: '.6rem auto 0',
  display: 'inline-block',
  padding: '.4rem .9rem',
  borderRadius: 999,
  background: 'rgba(220, 204, 21, 0.12)',
  border: '1px solid rgba(220, 204, 21,.4)',
  color: '#fbbf24',
  fontSize: '.82rem',
  fontWeight: 600,
};

/* ── Summary overlay (F2) ───────────────────────────────────── */
const summaryOverlay = {
  position: 'absolute', inset: 0, borderRadius: 24,
  background: 'rgba(2,6,23,.68)', backdropFilter: 'blur(2px)',
  display: 'flex', flexDirection: 'column', justifyContent: 'center',
  padding: '1.5rem', gap: '.65rem',
  pointerEvents: 'none',
};
const so = {
  label: {
    margin: 0, color: '#7c6bff', fontSize: '.75rem',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
  },
  text: {
    margin: 0, color: '#e2e8f0', fontSize: '.95rem', lineHeight: 1.65,
  },
  hint: {
    margin: 0, color: '#7080a0', fontSize: '.75rem',
  },
};

/* ── Pet avatar ────────────────────────────────────────────── */
const avatarStyles = {
  wrap: {
    position: 'relative',
    width: 64,
    height: 64,
    minWidth: 64,
    borderRadius: '50%',
    border: '2px solid rgba(148,163,184,.25)',
    background: 'rgba(124,107,255,.18)',
    cursor: 'pointer',
    padding: 0,
    overflow: 'visible',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  initial: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#b9b0ff',
    lineHeight: 1,
  },
  badge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#1e293b',
    border: '1.5px solid rgba(148,163,184,.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    lineHeight: 1,
  },
};
