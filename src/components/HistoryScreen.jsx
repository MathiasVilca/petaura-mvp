import { useState } from 'react';
import NavBackButton from './NavBackButton';
import { MOOD_ES } from '../moods.js';
import AuraCanvas from './AuraCanvas';

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

function formatTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
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

export default function HistoryScreen({ petName, onBack, petId }) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [confirmIdx, setConfirmIdx] = useState(null); // índice pendiente de eliminar

  const [history, setHistory] = useState(() => {
    const filtered = loadHistory().filter(entry => entry.petId === petId);
    const dateCounts = {};
    filtered.forEach(e => { dateCounts[e.date] = (dateCounts[e.date] || 0) + 1; });
    return filtered.map(entry => ({
      ...entry,
      showTime: dateCounts[entry.date] > 1,
      canvasParams: {
        color: entry.color,
        secondaryColor: entry.secondaryColor,
        energy: entry.energy ?? 0.5,
        stress: entry.stress ?? 0.5,
        warmth: entry.warmth ?? 0.5,
        pattern: entry.pattern ?? 'flow',
      },
    }));
  });

  const toggleSelect = idx => setSelectedIdx(prev => (prev === idx ? null : idx));

  // Pide confirmación antes de borrar
  const requestDelete = (e, idx) => {
    e.stopPropagation();
    setConfirmIdx(idx);
  };

  // Confirma y elimina del localStorage + estado local
  const confirmDelete = () => {
    const all = loadHistory();
    const petEntries = all.filter(e => e.petId === petId);
    const entryToDelete = history[confirmIdx];
    const globalIdx = all.findIndex(
      e => e.petId === petId && e.timestamp === entryToDelete.timestamp
    );
    if (globalIdx !== -1) all.splice(globalIdx, 1);
    localStorage.setItem('petaura_history', JSON.stringify(all));

    const newHistory = history.filter((_, i) => i !== confirmIdx);
    setHistory(newHistory);
    if (selectedIdx === confirmIdx) setSelectedIdx(null);
    else if (selectedIdx > confirmIdx) setSelectedIdx(selectedIdx - 1);
    setConfirmIdx(null);
  };

  const cancelDelete = () => setConfirmIdx(null);

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <NavBackButton onClick={onBack} />
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
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => toggleSelect(idx)}
                      style={s.entryRow}
                      aria-expanded={isOpen}
                    >
                      <AuraCanvas parameters=
                        {entry.canvasParams}
                      size={64}  reduction_parameter={64/340.0} reduce_particles={true} reduce_particle_multiplier={true} reducedBaseParticleCount={20}/>

                      <div style={s.entryInfo}>
                        <span>
                          <span style={s.entryMood}>
                          {MOOD_ES[entry.mood] || entry.mood}
                          </span>
                          {' '}
                          { (entry.mood_secondary &&
                          <span style={s.entrySecondaryMood}>
                            {" \u2022 "} {MOOD_ES[entry.mood_secondary] || entry.mood_secondary.charAt(0).toUpperCase() + entry.mood_secondary.slice(1)}
                          </span>)
                          }
                          
                        </span>
                        
                        <span style={s.entryDate}>
                          {formatDate(entry.date)}
                          {entry.showTime && entry.timestamp ? ` · ${formatTime(entry.timestamp)}` : ''}
                        </span>
                      </div>

                      <div style={s.bars}>
                        <MiniBar label="E" value={entry.energy} color={entry.color} />
                        <MiniBar label="S" value={entry.stress}  color="#f97316"     />
                      </div>

                      <span style={{ color: '#7080a0', fontSize: '.8rem' }}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {/* Botón eliminar X */}
                    <button
                      id={`delete-aura-${idx}`}
                      onClick={(e) => requestDelete(e, idx)}
                      style={s.deleteBtn}
                      aria-label="Eliminar aura"
                      title="Eliminar aura"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Detail panel */}
                  {isOpen && (
                    <div style={s.detail}>
                      {(entry.summary || entry.description) && (
                        <p style={s.detailText}>{entry.summary || entry.description}</p>
                      )}
                      {Array.isArray(entry.actions) && entry.actions.length > 0 && (
                        <>
                          <p style={s.detailLabel}>Recomendaciones</p>
                          <div style={s.actionCards}>
                            {entry.actions.map((a, i) => {
                              const action = typeof a === 'string' ? a : a.action;
                              const reason = typeof a === 'string' ? '' : (a.reason || '');
                              return (
                                <div key={i} style={s.actionCard}>
                                  <p style={s.actionText}>{action}</p>
                                  {reason && <p style={s.actionReason}>{reason}</p>}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de confirmación de eliminación */}
        {confirmIdx !== null && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <p style={s.modalTitle}>¿Eliminar esta aura?</p>
              <p style={s.modalSub}>
                Esta acción no se puede deshacer. El registro de{' '}
                <strong>{formatDate(history[confirmIdx]?.date)}</strong> se eliminará permanentemente.
              </p>
              <div style={s.modalActions}>
                <button id="cancel-delete-aura" onClick={cancelDelete} style={s.btnCancel}>Cancelar</button>
                <button id="confirm-delete-aura" onClick={confirmDelete} style={s.btnConfirm}>Eliminar</button>
              </div>
            </div>
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
      <span style={mb.value}>{Math.round((value ?? 0) * 100)}</span>
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
  entrySecondaryMood: { color: '#6B819E', fontWeight: 'normal', fontSize: '1rem' },
  entryDate: { color: '#8899b0', fontSize: '.8rem' },
  bars: { display: 'flex', flexDirection: 'column', gap: '.2rem', minWidth: 80 },
  detail: {
    padding: '0 1.25rem 1.25rem',
    borderTop: '1px solid rgba(148,163,184,.1)',
  },
  detailText: { color: '#cbd5e1', fontSize: '.9rem', lineHeight: 1.6, margin: '.75rem 0 .5rem' },
  detailLabel: { color: '#94a3b8', fontSize: '.8rem', fontWeight: 600, margin: '.75rem 0 .5rem', textTransform: 'uppercase', letterSpacing: '.06em' },
  actionCards: { display: 'flex', flexDirection: 'column', gap: '.5rem' },
  actionCard: {
    background: 'rgba(148,163,184,.06)',
    border: '1px solid rgba(148,163,184,.1)',
    borderRadius: 12,
    padding: '.6rem .85rem',
  },
  actionText: { margin: 0, color: '#cbd5e1', fontSize: '.88rem', lineHeight: 1.55, fontWeight: 500 },
  actionReason: { margin: '.3rem 0 0', color: '#7080a0', fontSize: '.8rem', lineHeight: 1.5 },
  empty: {
    background: 'rgba(15,23,42,.88)',
    border: '1px solid rgba(148,163,184,.12)',
    borderRadius: 24,
    padding: '3rem 2rem',
    textAlign: 'center',
  },
  emptyTitle: { margin: '0 0 .5rem', fontSize: '1.1rem', color: '#e2e8f0', fontWeight: 600 },
  emptySub: { margin: 0, color: '#8899b0', fontSize: '.9rem', lineHeight: 1.6 },
  deleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: '50%',
    border: '1px solid rgba(248,113,113,.35)',
    background: 'rgba(239,68,68,.12)',
    color: '#f87171',
    fontSize: '.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    transition: 'background .18s, transform .12s',
    zIndex: 2,
    padding: 0,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '1rem',
  },
  modal: {
    background: '#0f1729',
    border: '1px solid rgba(148,163,184,.18)',
    borderRadius: 24,
    padding: '2rem 1.75rem 1.5rem',
    maxWidth: 340,
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,.6)',
  },
  modalTitle: {
    margin: '0 0 .5rem',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#f0f0ff',
  },
  modalSub: {
    margin: '0 0 1.5rem',
    fontSize: '.9rem',
    color: '#8899b0',
    lineHeight: 1.55,
  },
  modalActions: {
    display: 'flex',
    gap: '.75rem',
    justifyContent: 'flex-end',
  },
  btnCancel: {
    padding: '.55rem 1.25rem',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,.2)',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '.9rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  btnConfirm: {
    padding: '.55rem 1.25rem',
    borderRadius: 12,
    border: 'none',
    background: 'rgba(239,68,68,.85)',
    color: '#fff',
    fontSize: '.9rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
};

const mb = {
  wrap: { display: 'flex', alignItems: 'center', gap: '.3rem' },
  label: { color: '#7080a0', fontSize: '.72rem', fontWeight: 700, width: 10 },
  track: { flex: 1, height: 4, background: 'rgba(148,163,184,.15)', borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, transition: 'width .3s ease' },
  value: { color: '#7080a0', fontSize: '.7rem', minWidth: 20, textAlign: 'right' },
};
