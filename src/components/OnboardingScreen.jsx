import { useState } from 'react';

const SPECIES = ['Perro', 'Gato', 'Otro'];

const KEYFRAMES = `
  @keyframes ob-pulse {
    0%, 100% { transform: scale(1);   opacity: 0.55; }
    50%       { transform: scale(1.1); opacity: 0.9;  }
  }
  @keyframes ob-ring {
    0%   { transform: scale(0.85); opacity: 0.35; }
    100% { transform: scale(1.65); opacity: 0;    }
  }
`;

function LatentAura() {
  return (
    <div style={la.wrap}>
      <div style={la.ring} />
      <div style={{ ...la.ring, animationDelay: '-1.5s' }} />
      <div style={la.core} />
    </div>
  );
}

export default function OnboardingScreen({ onComplete }) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Perro');
  const canSubmit = name.trim().length >= 1;

  const handleSubmit = () => {
    if (canSubmit) onComplete(name.trim(), species);
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={s.page}>
        <LatentAura />

        <div style={s.card}>
          <p style={s.eyebrow}>PetAura</p>
          <h1 style={s.title}>Tu aura comienza hoy</h1>
          <p style={s.body}>
            Cuéntanos sobre tu mascota para despertar su primera aura.
          </p>

          <div style={s.stack}>
            <div>
              <label htmlFor="pet-name" style={s.label}>
                ¿Cómo se llama tu mascota?
              </label>
              <input
                id="pet-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="Nombre"
                style={s.input}
                autoFocus
              />
            </div>

            <div>
              <span style={s.label}>¿Qué tipo de mascota es?</span>
              <div style={s.row}>
                {SPECIES.map(sp => (
                  <button
                    key={sp}
                    onClick={() => setSpecies(sp)}
                    style={species === sp
                      ? { ...s.speciesBtn, ...s.speciesBtnOn }
                      : s.speciesBtn}
                  >
                    {sp}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={canSubmit ? s.btn : { ...s.btn, ...s.btnOff }}
            >
              Comenzar
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2rem',
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
    maxWidth: 440,
  },
  eyebrow: {
    margin: '0 0 .4rem',
    color: '#94a3b8',
    fontSize: '.85rem',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '0 0 .5rem',
    fontSize: 'clamp(1.5rem, 4vw, 2rem)',
    color: '#f0f0ff',
  },
  body: {
    margin: '0 0 1.5rem',
    color: '#94a3b8',
    lineHeight: 1.6,
    fontSize: '.95rem',
  },
  stack: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: {
    display: 'block',
    marginBottom: '.4rem',
    color: '#cbd5e1',
    fontSize: '.88rem',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    padding: '.85rem 1rem',
    borderRadius: 16,
    border: '1px solid rgba(148,163,184,.25)',
    background: 'rgba(15,23,42,.9)',
    color: '#f0f0ff',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  row: { display: 'flex', gap: '.5rem' },
  speciesBtn: {
    flex: 1,
    padding: '.75rem',
    minHeight: 48,
    borderRadius: 16,
    border: '1px solid rgba(148,163,184,.25)',
    background: 'rgba(15,23,42,.6)',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '.9rem',
    fontWeight: 600,
  },
  speciesBtnOn: {
    border: '1px solid #7c6bff',
    background: 'rgba(124,107,255,.18)',
    color: '#b9b0ff',
  },
  btn: {
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
  btnOff: { opacity: 0.4, cursor: 'not-allowed' },
};

const la = {
  wrap: {
    position: 'relative',
    width: 160,
    height: 160,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'radial-gradient(circle, #6b728088 0%, #37415166 60%, transparent 100%)',
    animation: 'ob-pulse 3s ease-in-out infinite',
    position: 'absolute',
    boxShadow: '0 0 32px rgba(107,114,128,.35)',
  },
  ring: {
    width: 130,
    height: 130,
    borderRadius: '50%',
    border: '1px solid rgba(107,114,128,.3)',
    position: 'absolute',
    animation: 'ob-ring 3s ease-out infinite',
  },
};
