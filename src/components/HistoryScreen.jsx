import { useState } from 'react';

const MOOD_ES = {
  happy:       'Feliz',
  calm:        'Tranquilo',
  tired:       'Cansado',
  anxious:     'Ansioso',
  playful:     'Juguetón',
  affectionate:'Cariñoso',
  curious:     'Curioso',
  sick:        'Decaído',
};

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('petaura_history') || '[]');
  } catch {
    return [];
  }
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function AuraMini({ color, size = 64 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: `radial-gradient(circle at 38% 38%, ${color}cc 0%, ${color}55 45%, ${color}18 70%, transparent 100%)`,
        boxShadow: `0 0 18px ${color}44, inset 0 0 14px ${color}22`,
      }}
    />
  );
}

function EmptyState({ petName }) {
  return (
    <div style={s.empty}>
      <p style={s.emptyTitle}>Sin auras todavía</p>
      <p style={s.emptySub}>
        Registra cómo estuvo {petName} hoy para ver su primera aura aquí.
      </p>
    </div>
  );
}

export default function HistoryScreen({ petName, onBack }) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const history = loadHistory();

  const toggleSelect = idx => setSelectedIdx(prev => (prev === idx ? null : idx));

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <button onClick={onBack} style={s.backBtn} aria-label="Volver">
            ← Volver
          </button>
          <div>
            <p style={s.eyebrow}>Historial de auras</p>
            <h2 style={s.title}>{petName}</h2>
          </div>
        </div>

        {history.length === 0 ? (
          <EmptyState petName={petName} />
        ) : (
          <div style={s.list}>
            {history.map((entry, idx) => {
              const isOpen = selectedIdx === idx;
              return (
                <div key={idx} style={s.entryWrap}>
                  {/* Summary row — always visible */}
                  <button
                    onClick={() => toggleSelect(idx)}
                    style={s.entryRow}
                    aria-expanded={isOpen}
                  >
                    <AuraMini color={entry.color} />

                    <div style={s.entryInfo}>
                      <span style={s.entryMood}>
                        {MOOD_ES[entry.mood] || entry.mood}
                      </span>
                      <span style={s.entryDate}>{formatDate(entry.date)}</span>
                    </div>

                    <div style={s.bars}>
                      <MiniBar label="E" value={entry.energy} color={entry.color} />
                      <MiniBar label="S" value={entry.stress}  color="#f97316"     />
                      <MiniBar label="C" value={entry.warmth}  color="#facc15"     />
                    </div>

                    <span style={{ color: '#475569', fontSize: '.8rem' }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Detail panel */}
                  {isOpen && (
                    <div style={s.detail}>
                      {entry.description && (
                        <p style={s.detailText}>{entry.description}</p>
                      )}
                      {Array.isArray(entry.actions) && entry.actions.length > 0 && (
                        <>
                          <p style={s.detailLabel}>Recomendaciones</p>
                          <ul style={s.actionList}>
                            {entry.actions.map((a, i) => (
                              <li key={i} style={s.actionItem}>{a}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniBar({ label, value, color }) {
  return (
    <div style={mb.wrap}>
      <span style={mb.label}>{label}</span>
      <div style={mb.track}>
        <div style={{ ...mb.fill, width: `${(value ?? 0) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */

const s = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top, #111827 0%, #020617 65%, #000 100%)',
    padding: '1.5rem',
  },
  container: {
    maxWidth: 600,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '.5rem' },
  backBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '.9rem',
    padding: '.5rem 0',
    minHeight: 48,
  },
  eyebrow: { margin: 0, color: '#94a3b8', fontSize: '.85rem', letterSpacing: '.06em', textTransform: 'uppercase' },
  title: { margin: '.2rem 0 0', fontSize: '1.5rem', color: '#f0f0ff' },
  list: { display: 'flex', flexDirection: 'column', gap: '.65rem' },
  entryWrap: {
    background: 'rgba(15,23,42,.88)',
    border: '1px solid rgba(148,163,184,.12)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  entryRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem 1.25rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 56,
  },
  entryInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '.15rem' },
  entryMood: { color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' },
  entryDate: { color: '#64748b', fontSize: '.8rem' },
  bars: { display: 'flex', flexDirection: 'column', gap: '.2rem', minWidth: 80 },
  detail: {
    padding: '0 1.25rem 1.25rem',
    borderTop: '1px solid rgba(148,163,184,.1)',
  },
  detailText: { color: '#cbd5e1', fontSize: '.9rem', lineHeight: 1.6, margin: '.75rem 0 .5rem' },
  detailLabel: { color: '#94a3b8', fontSize: '.8rem', fontWeight: 600, margin: '.75rem 0 .4rem', textTransform: 'uppercase', letterSpacing: '.06em' },
  actionList: { margin: 0, paddingLeft: '1.2rem' },
  actionItem: { color: '#94a3b8', fontSize: '.88rem', lineHeight: 1.7 },
  empty: {
    background: 'rgba(15,23,42,.88)',
    border: '1px solid rgba(148,163,184,.12)',
    borderRadius: 24,
    padding: '3rem 2rem',
    textAlign: 'center',
  },
  emptyTitle: { margin: '0 0 .5rem', fontSize: '1.1rem', color: '#e2e8f0', fontWeight: 600 },
  emptySub: { margin: 0, color: '#64748b', fontSize: '.9rem', lineHeight: 1.6 },
};

const mb = {
  wrap: { display: 'flex', alignItems: 'center', gap: '.3rem' },
  label: { color: '#475569', fontSize: '.72rem', fontWeight: 700, width: 10 },
  track: { flex: 1, height: 4, background: 'rgba(148,163,184,.15)', borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, transition: 'width .3s ease' },
};
