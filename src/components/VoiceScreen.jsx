import { useState, useEffect, useRef } from 'react';

const KEYFRAMES = `
  @keyframes vs-idle {
    0%, 100% { box-shadow: 0 0 0  0px rgba(124,107,255,.5); }
    50%       { box-shadow: 0 0 0 18px rgba(124,107,255,.0); }
  }
  @keyframes vs-active {
    0%, 100% { box-shadow: 0 0 0  0px rgba(248,113,113,.5); }
    50%       { box-shadow: 0 0 0 22px rgba(248,113,113,.0); }
  }
`;

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

export default function VoiceScreen({ petName, onConfirm, onBack }) {
  const [isListening, setIsListening]   = useState(false);
  const [transcript, setTranscript]     = useState('');
  const [amplitude, setAmplitude]       = useState(0);
  const [supported, setSupported]       = useState(true);
  const [permError, setPermError]       = useState(false);

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

  const micScale = isListening ? 1 + Math.min(amplitude, 1) * 0.28 : 1;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={s.page}>
        <div style={s.card}>

          {/* Header */}
          <div style={s.header}>
            <button onClick={onBack} style={s.backBtn} aria-label="Volver">
              ← Volver
            </button>
            <div>
              <p style={s.eyebrow}>Registro de voz</p>
              <h2 style={s.title}>¿Cómo estuvo {petName} hoy?</h2>
            </div>
          </div>

          {/* Mic button */}
          <div style={s.micZone}>
            <button
              onClick={toggleListening}
              disabled={!supported}
              aria-label={isListening ? 'Detener grabación' : 'Iniciar grabación'}
              style={{
                ...s.micBtn,
                transform: `scale(${micScale})`,
                background: isListening
                  ? 'linear-gradient(135deg, #f87171, #ef4444)'
                  : 'linear-gradient(135deg, #7c6bff, #5b4de0)',
                animation: isListening
                  ? 'vs-active 1s ease-in-out infinite'
                  : 'vs-idle 2.5s ease-in-out infinite',
              }}
            >
              {isListening ? <StopIcon /> : <MicIcon />}
            </button>

            <p style={s.micLabel}>
              {!supported
                ? 'Tu navegador no soporta reconocimiento de voz'
                : permError
                ? 'Permite el acceso al micrófono e intenta de nuevo'
                : isListening
                ? 'Escuchando — toca para detener'
                : transcript
                ? 'Toca para seguir grabando'
                : 'Toca el micrófono para empezar'}
            </p>
          </div>

          {/* Transcript */}
          <div>
            <label style={s.label} htmlFor="transcript-edit">
              Transcripción{transcript ? '' : ' (aquí aparecerá lo que digas)'}
            </label>
            <textarea
              id="transcript-edit"
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder={`Cuenta cómo estuvo ${petName} hoy...`}
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
    </>
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
  backBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '.9rem',
    padding: '0.5rem 0',
    minHeight: 48,
  },
  eyebrow: { margin: 0, color: '#94a3b8', fontSize: '.85rem', letterSpacing: '.06em', textTransform: 'uppercase' },
  title: { margin: '.25rem 0 0', fontSize: '1.4rem', color: '#f0f0ff' },
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
    transition: 'transform .08s ease, background .3s ease',
  },
  micLabel: {
    margin: 0,
    color: '#64748b',
    fontSize: '.88rem',
    textAlign: 'center',
  },
  label: {
    display: 'block',
    marginBottom: '.4rem',
    color: '#94a3b8',
    fontSize: '.85rem',
    fontWeight: 600,
  },
  textarea: {
    width: '100%',
    minHeight: 100,
    borderRadius: 16,
    border: '1px solid rgba(148,163,184,.25)',
    background: 'rgba(15,23,42,.9)',
    color: '#f0f0ff',
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
    color: '#64748b',
    fontSize: '.95rem',
    cursor: 'pointer',
  },
};
