const KEYFRAMES = `
  @keyframes ls-pulse {
    0%, 100% { transform: scale(1);    opacity: 0.6; }
    50%       { transform: scale(1.18); opacity: 1;   }
  }
  @keyframes ls-ring {
    0%   { transform: scale(0.85); opacity: 0.4; }
    100% { transform: scale(1.7);  opacity: 0;   }
  }
  @keyframes ls-dot {
    0%, 80%, 100% { transform: scale(0); opacity: 0;   }
    40%           { transform: scale(1); opacity: 0.8; }
  }
`;

export default function LoadingScreen({ petName }) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={s.page}>
        <div style={s.auraWrap}>
          <div style={s.ring} />
          <div style={{ ...s.ring, animationDelay: '-1s' }} />
          <div style={s.core} />
        </div>

        <div style={s.textBlock}>
          <p style={s.text}>
            Analizando a <strong style={{ color: '#b9b0ff' }}>{petName}</strong>...
          </p>
          <p style={s.sub}>La IA está leyendo su estado emocional</p>

          <div style={s.dots}>
            {[0, 1, 2].map(i => (
              <span
                key={i}
                style={{ ...s.dot, animationDelay: `${i * 0.32}s` }}
              />
            ))}
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2.5rem',
    padding: '1.5rem',
    background: 'radial-gradient(circle at top, #111827 0%, #020617 65%, #000 100%)',
  },
  auraWrap: {
    position: 'relative',
    width: 180,
    height: 180,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 90,
    height: 90,
    borderRadius: '50%',
    background: 'radial-gradient(circle, #7c6bffaa 0%, #5b4de055 55%, transparent 100%)',
    animation: 'ls-pulse 2s ease-in-out infinite',
    position: 'absolute',
    boxShadow: '0 0 40px rgba(124,107,255,.4)',
  },
  ring: {
    width: 150,
    height: 150,
    borderRadius: '50%',
    border: '1px solid rgba(124,107,255,.35)',
    position: 'absolute',
    animation: 'ls-ring 2s ease-out infinite',
  },
  textBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '.5rem',
  },
  text: {
    margin: 0,
    fontSize: '1.25rem',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  sub: {
    margin: 0,
    fontSize: '.9rem',
    color: '#64748b',
    textAlign: 'center',
  },
  dots: {
    display: 'flex',
    gap: '.4rem',
    marginTop: '.5rem',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#7c6bff',
    display: 'inline-block',
    animation: 'ls-dot 1.4s ease-in-out infinite',
  },
};
