import { useState, useEffect, useRef } from 'react';
import NavBackButton from './NavBackButton';

const MicIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="1" width="6" height="11" rx="3" fill="white" stroke="none" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8"  y1="23" x2="16" y2="23" />
  </svg>
);

const StopIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24">
    <rect x="5" y="5" width="14" height="14" rx="3" fill="white" />
  </svg>
);

const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function VoiceScreen({ petName, onConfirm, onBack }) {
  const [isListening, setIsListening]   = useState(false);
  const [transcript, setTranscript]     = useState('');
  const [amplitude, setAmplitude]       = useState(0);
  const [supported, setSupported]       = useState(true);
  const [permError, setPermError]       = useState(false);
  const [duration, setDuration]         = useState(0);

  const recognitionRef  = useRef(null);
  const isListeningRef  = useRef(false);
  const audioCtxRef     = useRef(null);
  const analyserRef     = useRef(null);
  const streamRef       = useRef(null);
  const rafRef          = useRef(null);
  const frameCountRef   = useRef(0);

  /* ── Web Speech API setup ─────────────────────────────── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'es-ES';

    rec.onresult = e => {
      let full = '';
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      setTranscript(full);
    };

    // Auto-restart while user is still in listening mode
    rec.onend = () => {
      if (isListeningRef.current) {
        try { rec.start(); } catch (_) {}
      } else {
        setIsListening(false);
        stopAmplitude();
      }
    };

    recognitionRef.current = rec;
    return () => { rec.abort(); stopAmplitude(); };
  }, []);

  /* ── Duration counter ─────────────────────────────────── */
  useEffect(() => {
    if (!isListening) return;
    setDuration(0);
    const id = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(id);
  }, [isListening]);

  /* ── Web Audio amplitude ──────────────────────────────── */
  const startAmplitude = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        frameCountRef.current++;
        if (frameCountRef.current % 5 === 0) {
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setAmplitude(avg / 100);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // microphone access denied — skip amplitude, voice capture still works
    }
  };

  const stopAmplitude = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    audioCtxRef.current = null;
    streamRef.current   = null;
    setAmplitude(0);
  };

  /* ── Toggle listening ─────────────────────────────────── */
  const toggleListening = () => {
    if (!supported) return;

    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current?.stop();
      stopAmplitude();
    } else {
      isListeningRef.current = true;
      setIsListening(true);
      setTranscript('');
      setPermError(false);

      navigator.mediaDevices?.getUserMedia({ audio: true }).catch(() => setPermError(true));

      try {
        recognitionRef.current?.start();
      } catch (_) {}

      startAmplitude();
      if (navigator.vibrate) navigator.vibrate([40]);
    }
  };

  /* ── Confirm ──────────────────────────────────────────── */
  const handleConfirm = () => {
    if (!transcript.trim()) return;
    if (isListeningRef.current) {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
      stopAmplitude();
    }
    onConfirm(transcript.trim());
  };

  /* ── Derived state ────────────────────────────────────── */
  const recState = isListening ? 'recording' : transcript ? 'reviewing' : 'idle';

  const micScale = recState === 'recording' ? 1 + Math.min(amplitude, 1) * 0.28 : 1;

  const micBg = recState === 'recording'
    ? 'linear-gradient(135deg, #f87171, #ef4444)'
    : 'linear-gradient(135deg, #7c6bff, #5b4de0)';

  // Reactive double ring: inner border marks state color, outer spread reacts to amplitude
  const micBoxShadow = recState === 'recording'
    ? `0 0 0 3px #f87171, 0 0 0 ${Math.round(3 + Math.min(amplitude, 1.5) * 20)}px rgba(248,113,113,0.25)`
    : recState === 'reviewing'
    ? '0 0 0 2px rgba(124,107,255,0.45)'
    : 'none';

  const micAriaLabel = recState === 'recording' ? 'Detener grabación' : 'Iniciar grabación';

  const micLabelText = !supported
    ? 'Tu navegador no soporta reconocimiento de voz'
    : permError
    ? 'Permite el acceso al micrófono e intenta de nuevo'
    : recState === 'recording'
    ? `Grabando... ${formatDuration(duration)}`
    : recState === 'reviewing'
    ? 'Toca para seguir grabando'
    : 'Toca el micrófono para empezar';

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Header */}
        <div style={s.header}>
          <NavBackButton onClick={onBack} />
          <div>
            <p style={s.eyebrow}>Registro de voz</p>
            <h2 style={s.title}>¿Cómo está {petName} ahora?</h2>
          </div>
        </div>

        {/* Mic button */}
        <div style={s.micZone}>
          <button
            onClick={toggleListening}
            disabled={!supported}
            aria-label={micAriaLabel}
            style={{
              ...s.micBtn,
              transform: `scale(${micScale})`,
              background: micBg,
              boxShadow: micBoxShadow,
            }}
          >
            {recState === 'recording' ? <StopIcon /> : <MicIcon />}
          </button>

          <p style={s.micLabel} aria-live="polite" aria-atomic="true">
            {recState === 'recording' ? (
              <>
                {`Grabando... ${formatDuration(duration)}`}
                <span style={s.micHint}>Toca para detener</span>
              </>
            ) : micLabelText}
          </p>
        </div>

        {/* Transcript */}
        <div>
          <label style={s.label} htmlFor="transcript-edit">
            Transcripción
          </label>
          <p id="voice-hint" style={s.hint}>
            Describe qué hizo, cómo se comportó o qué llamó tu atención.
          </p>
          <textarea
            id="transcript-edit"
            className="voice-textarea"
            aria-describedby="voice-hint"
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder={`Cuenta cómo estuvo ${petName}...`}
            style={s.textarea}
            rows={4}
          />
        </div>

        {/* Actions */}
        <div style={s.actions}>
          <button
            onClick={handleConfirm}
            disabled={!transcript.trim()}
            style={transcript.trim() ? s.confirmBtn : { ...s.confirmBtn, ...s.disabledBtn }}
          >
            Generar aura
          </button>
          <button onClick={onBack} style={s.cancelBtn}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    background: 'radial-gradient(circle at top, #111827 0%, #020617 65%, #000 100%)',
  },
  card: {
    background: 'rgba(15,23,42,.88)',
    border: '1px solid rgba(148,163,184,.12)',
    borderRadius: 24,
    backdropFilter: 'blur(12px)',
    padding: '2rem',
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '.75rem' },
  eyebrow: { margin: 0, color: 'var(--text-subtitle-color)', fontSize: '.85rem', letterSpacing: '.06em', textTransform: 'uppercase' },
  title: { margin: '.25rem 0 0', fontSize: '1.4rem', color: 'var(--text-regular-color)' },
  micZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem 0',
  },
  micBtn: {
    width: 88,
    height: 88,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform .08s ease, background .3s ease, box-shadow .1s ease',
  },
  micLabel: {
    margin: 0,
    color: '#a78bfa',
    fontSize: '.88rem',
    textAlign: 'center',
    fontWeight: 500,
  },
  micHint: {
    display: 'block',
    fontSize: '.8rem',
    fontWeight: 400,
    marginTop: '.15rem',
    opacity: 0.75,
  },
  label: {
    display: 'block',
    marginBottom: '.25rem',
    color: 'var(--text-regular-color)',
    fontSize: '.85rem',
    fontWeight: 600,
  },
  hint: {
    margin: '0 0 .6rem',
    color: '#8899b0',
    fontSize: '.82rem',
    lineHeight: 1.5,
  },
  textarea: {
    width: '100%',
    minHeight: 100,
    borderRadius: 16,
    border: '1px solid rgba(148,163,184,.25)',
    background: 'rgba(15,23,42,.9)',
    color: 'var(--text-regular-color)',
    fontSize: '.95rem',
    padding: '.85rem 1rem',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    lineHeight: 1.6,
  },
  actions: { display: 'flex', flexDirection: 'column', gap: '.65rem' },
  confirmBtn: {
    width: '100%',
    padding: '.95rem',
    minHeight: 48,
    borderRadius: 999,
    border: 'none',
    background: 'linear-gradient(135deg, #7c6bff, #5b4de0)',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  disabledBtn: { opacity: 0.4, cursor: 'not-allowed' },
  cancelBtn: {
    width: '100%',
    padding: '.85rem',
    minHeight: 48,
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,.2)',
    background: 'transparent',
    color: 'var(--text-intermediate-color)',
    fontSize: '.95rem',
    cursor: 'pointer',
  },
};
