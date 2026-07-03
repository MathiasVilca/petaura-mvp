import { useState } from 'react';
import NavBackButton from './NavBackButton';
import { MOOD_ES, mockStates } from '../moods.js';
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

function buildHistory(petId) {
  const filtered = loadHistory().filter(e => e.petId === petId);
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
}

export default function HistoryScreen({ petName, onBack, petId }) {
  const [history, setHistory] = useState(() => buildHistory(petId));
  const [expandedIdx, setExpandedIdx] = useState(null);   // detalle abierto (modo normal)
  const [selectMode, setSelectMode] = useState(false);  // modo selección múltiple
  const [selected, setSelected] = useState(new Set()); // índices seleccionados
  const [confirmSingle, setConfirmSingle] = useState(null); // idx para borrar uno solo
  const [confirmBulk, setConfirmBulk] = useState(false);  // confirmar borrado múltiple
  const [hasDeleted, setHasDeleted] = useState(false);  // flag para sincronizar al salir

  /* ── helpers de selección ── */
  const allSelected = selected.size === history.length && history.length > 0;

  const toggleSelectMode = () => {
    setSelectMode(v => !v);
    setSelected(new Set());
    setExpandedIdx(null);
  };

  const toggleOne = idx => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(history.map((_, i) => i)));
    }
  };

  /* ── eliminación individual ── */
  const requestDeleteSingle = (e, idx) => {
    e.stopPropagation();
    setConfirmSingle(idx);
  };

  const confirmDeleteSingle = () => {
    deleteByIndices(new Set([confirmSingle]));
    setConfirmSingle(null);
    setHasDeleted(true);
  };

  /* ── eliminación múltiple ── */
  const confirmDeleteBulk = () => {
    deleteByIndices(selected);
    setSelected(new Set());
    setSelectMode(false);
    setConfirmBulk(false);
    setHasDeleted(true);
  };

  /* ── lógica de borrado real ── */
  const deleteByIndices = (indices) => {
    const all = loadHistory();
    const toDelete = new Set(
      [...indices].map(i => history[i]?.timestamp).filter(Boolean)
    );
    const remaining = all.filter(e => !(e.petId === petId && toDelete.has(e.timestamp)));
    localStorage.setItem('petaura_history', JSON.stringify(remaining));
    setHistory(buildHistory(petId));
    setExpandedIdx(null);
  };

  const handleBack = () => {
    onBack();
    if (hasDeleted) {
      // Inyectar CSS para ocultar completamente el menú de estados y evitar el parpadeo
      const style = document.createElement('style');
      style.innerHTML = `.state-buttons { opacity: 0 !important; visibility: hidden !important; }`;
      document.head.appendChild(style);

      setTimeout(() => {
        try {
          const historyData = loadHistory().filter(e => e.petId === petId);
          const last = historyData.length > 0 ? historyData[0] : null;
          
          const closeDemoMenu = () => {
            setTimeout(() => {
              const demoToggle = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Probar estados (demo)'));
              if (demoToggle && demoToggle.textContent.includes('▼')) {
                demoToggle.click();
              }
              setTimeout(() => {
                if (document.head.contains(style)) document.head.removeChild(style);
              }, 50);
            }, 10);
          };
          
          if (!last) {
            const btns = Array.from(document.querySelectorAll('.state-button'));
            const calmBtn = btns.find(b => b.textContent === 'Tranquilo');
            if (calmBtn) {
              calmBtn.click();
              closeDemoMenu();
            } else {
              if (document.head.contains(style)) document.head.removeChild(style);
            }
          } else {
            const originalMock = { ...mockStates[last.mood] };
            
            mockStates[last.mood] = {
              ...originalMock,
              energy: last.energy ?? 0.5,
              stress: last.stress ?? 0.5,
              warmth: last.warmth ?? 0.5,
              pattern: last.pattern || 'flow',
              summary: last.summary || '',
              description: last.description || '',
              actions: last.actions || [],
              mood_secondary: last.mood_secondary || null,
              secondaryColor: last.secondaryColor || null,
              health_concern: last.health_concern || false
            };
            
            const btns = Array.from(document.querySelectorAll('.state-button'));
            const targetBtn = btns.find(b => b.textContent === (MOOD_ES[last.mood] || last.mood));
            
            if (targetBtn) {
              targetBtn.click();
              closeDemoMenu();
            } else {
              if (document.head.contains(style)) document.head.removeChild(style);
            }
            
            setTimeout(() => {
              mockStates[last.mood] = originalMock;
            }, 10);
          }
        } catch (e) {
          console.error("Sincronización fallida", e);
          if (document.head.contains(style)) document.head.removeChild(style);
        }
      }, 50);
    }
  };

  /* ── render ── */
  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerTop}>
            <NavBackButton onClick={handleBack} />
            {history.length > 0 && (
              <button
                id="toggle-select-mode"
                onClick={toggleSelectMode}
                style={selectMode ? s.btnSelectActive : s.btnSelect}
              >
                {selectMode ? 'Cancelar' : 'Seleccionar'}
              </button>
            )}
          </div>
          <div>
            <p style={s.eyebrow}>Historial de auras</p>
            <h2 style={s.title}>{petName}</h2>
          </div>
        </div>

        {/* Barra de selección múltiple */}
        {selectMode && history.length > 0 && (
          <div style={s.selectionBar}>
            <button id="toggle-select-all" onClick={toggleAll} style={s.btnSelAll}>
              {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            <span style={s.selCount}>
              {selected.size > 0 ? `${selected.size} seleccionada${selected.size > 1 ? 's' : ''}` : 'Ninguna'}
            </span>
            <button
              id="delete-selected-auras"
              onClick={() => selected.size > 0 && setConfirmBulk(true)}
              style={selected.size > 0 ? s.btnDeleteSel : s.btnDeleteSelDisabled}
              disabled={selected.size === 0}
            >
              Eliminar
            </button>
          </div>
        )}

        {history.length === 0 ? (
          <EmptyState petName={petName} />
        ) : (
          <div style={s.list}>
            {history.map((entry, idx) => {
              const isOpen = !selectMode && expandedIdx === idx;
              const isSelected = selected.has(idx);
              return (
                <div
                  key={idx}
                  style={{
                    ...s.entryWrap,
                    ...(isSelected ? s.entryWrapSelected : {}),
                  }}
                >
                  {/* Fila principal */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => {
                        if (selectMode) {
                          toggleOne(idx);
                        } else {
                          setExpandedIdx(prev => prev === idx ? null : idx);
                        }
                      }}
                      style={s.entryRow}
                      aria-expanded={isOpen}
                    >
                      {/* Checkbox en modo selección */}
                      {selectMode && (
                        <div style={isSelected ? s.checkOn : s.checkOff} aria-hidden>
                          {isSelected && <span style={s.checkMark}>✓</span>}
                        </div>
                      )}

                      <AuraCanvas
                        parameters={entry.canvasParams}
                        size={64}
                        reduction_parameter={64 / 340.0}
                        reduce_particles={true}
                        reduce_particle_multiplier={true}
                        reducedBaseParticleCount={20}
                      />

                      <div style={s.entryInfo}>
                        <span>
                          <span style={s.entryMood}>
                            {MOOD_ES[entry.mood] || entry.mood}
                          </span>
                          {' '}
                          {entry.mood_secondary && (
                            <span style={s.entrySecondaryMood}>
                              {' \u2022 '}{MOOD_ES[entry.mood_secondary] || entry.mood_secondary.charAt(0).toUpperCase() + entry.mood_secondary.slice(1)}
                            </span>
                          )}
                        </span>
                        <span style={s.entryDate}>
                          {formatDate(entry.date)}
                          {entry.showTime && entry.timestamp ? ` · ${formatTime(entry.timestamp)}` : ''}
                        </span>
                      </div>

                      {!selectMode && (
                        <div style={s.bars}>
                          <MiniBar label="E" value={entry.energy} color={entry.color} />
                          <MiniBar label="S" value={entry.stress} color="#f97316" />
                        </div>
                      )}

                      {!selectMode && (
                        <span style={{ color: 'var(--text-intermediate-color)', fontSize: '.8rem' }}>
                          {isOpen ? '▲' : '▼'}
                        </span>
                      )}
                    </button>

                    {/* Botón X (solo en modo normal) */}
                    {!selectMode && (
                      <button
                        id={`delete-aura-${idx}`}
                        onClick={(e) => requestDeleteSingle(e, idx)}
                        style={s.deleteBtn}
                        aria-label="Eliminar aura"
                        title="Eliminar aura"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Panel de detalle */}
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

        {/* Modal — eliminar una */}
        {confirmSingle !== null && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <p style={s.modalTitle}>¿Eliminar esta aura?</p>
              <p style={s.modalSub}>
                Esta acción no se puede deshacer. El registro de{' '}
                <strong>{formatDate(history[confirmSingle]?.date)}</strong> se eliminará permanentemente.
              </p>
              <div style={s.modalActions}>
                <button id="cancel-delete-aura" onClick={() => setConfirmSingle(null)} style={s.btnCancel}>Cancelar</button>
                <button id="confirm-delete-aura" onClick={confirmDeleteSingle} style={s.btnConfirm}>Eliminar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal — eliminar seleccionadas */}
        {confirmBulk && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <p style={s.modalTitle}>¿Eliminar {selected.size} aura{selected.size > 1 ? 's' : ''}?</p>
              <p style={s.modalSub}>
                Esta acción no se puede deshacer. Se eliminarán permanentemente{' '}
                <strong>{selected.size} registro{selected.size > 1 ? 's' : ''}</strong>.
              </p>
              <div style={s.modalActions}>
                <button id="cancel-delete-bulk" onClick={() => setConfirmBulk(false)} style={s.btnCancel}>Cancelar</button>
                <button id="confirm-delete-bulk" onClick={confirmDeleteBulk} style={s.btnConfirm}>
                  Eliminar {selected.size}
                </button>
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
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { margin: 0, color: 'var(--text-subtitle-color)', fontSize: '.85rem', letterSpacing: '.06em', textTransform: 'uppercase' },
  title: { margin: '.2rem 0 0', fontSize: '1.5rem', color: 'var(--text-regular-color)' },

  btnSelect: {
    padding: '.4rem 1rem',
    borderRadius: 20,
    border: '1px solid rgba(148,163,184,.25)',
    background: 'transparent',
    color: 'var(--text-intermediate-color)',
    fontSize: '.85rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  btnSelectActive: {
    padding: '.4rem 1rem',
    borderRadius: 20,
    border: '1px solid rgba(239,68,68,.4)',
    background: 'rgba(239,68,68,.1)',
    color: '#f87171',
    fontSize: '.85rem',
    cursor: 'pointer',
    fontWeight: 600,
  },

  selectionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '.75rem',
    background: 'rgba(15,23,42,.9)',
    border: '1px solid rgba(148,163,184,.15)',
    borderRadius: 16,
    padding: '.65rem 1rem',
  },
  btnSelAll: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    fontSize: '.85rem',
    cursor: 'pointer',
    fontWeight: 600,
    padding: 0,
    whiteSpace: 'nowrap',
  },
  selCount: {
    flex: 1,
    color: '#8899b0',
    fontSize: '.85rem',
    textAlign: 'center',
  },
  btnDeleteSel: {
    padding: '.4rem 1rem',
    borderRadius: 12,
    border: 'none',
    background: 'rgba(239,68,68,.85)',
    color: '#fff',
    fontSize: '.85rem',
    cursor: 'pointer',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  btnDeleteSelDisabled: {
    padding: '.4rem 1rem',
    borderRadius: 12,
    border: 'none',
    background: 'rgba(148,163,184,.12)',
    color: '#4a5568',
    fontSize: '.85rem',
    cursor: 'not-allowed',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  list: { display: 'flex', flexDirection: 'column', gap: '.65rem' },
  entryWrap: {
    background: 'rgba(15,23,42,.88)',
    border: '1px solid rgba(148,163,184,.12)',
    borderRadius: 20,
    overflow: 'hidden',
    transition: 'border-color .2s',
  },
  entryWrapSelected: {
    border: '1px solid rgba(96,165,250,.45)',
    background: 'rgba(30,58,138,.18)',
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

  /* Checkbox */
  checkOff: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '2px solid rgba(148,163,184,.35)',
    background: 'transparent',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '2px solid #60a5fa',
    background: '#2563eb',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: '.7rem',
    fontWeight: 800,
    lineHeight: 1,
  },

  entryInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '.15rem' },
  entryMood: { color: 'var(--text-regular-color)', fontWeight: 700, fontSize: '1rem' },
  entrySecondaryMood: { color: 'var(--text-intermediate-color)', fontWeight: 'normal', fontSize: '1rem' },
  entryDate: { color: 'var(--text-subtitle-color)', fontSize: '.8rem' },
  bars: { display: 'flex', flexDirection: 'column', gap: '.2rem', minWidth: 80 },
  detail: {
    padding: '0 1.25rem 1.25rem',
    borderTop: '1px solid rgba(148,163,184,.1)',
  },
  detailText: { color: 'var(--text-intermediate-color)', fontSize: '.9rem', lineHeight: 1.6, margin: '.75rem 0 .5rem' },
  detailLabel: { color: 'var(--text-regular-color)', fontSize: '.8rem', fontWeight: 600, margin: '.75rem 0 .5rem', textTransform: 'uppercase', letterSpacing: '.06em' },
  actionCards: { display: 'flex', flexDirection: 'column', gap: '.5rem' },
  actionCard: {
    background: 'rgba(148,163,184,.06)',
    border: '1px solid rgba(148,163,184,.1)',
    borderRadius: 12,
    padding: '.6rem .85rem',
  },
  actionText: { margin: 0, color: 'var(--text-intermediate-color)', fontSize: '.88rem', lineHeight: 1.55, fontWeight: 500 },
  actionReason: { margin: '.3rem 0 0', color: 'var(--text-subtitle-color)', fontSize: '.8rem', lineHeight: 1.5 },
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
    transition: 'background .18s',
    zIndex: 2,
    padding: 0,
  },

  /* Modales */
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
  modalTitle: { margin: '0 0 .5rem', fontSize: '1.1rem', fontWeight: 700, color: '#f0f0ff' },
  modalSub: { margin: '0 0 1.5rem', fontSize: '.9rem', color: '#8899b0', lineHeight: 1.55 },
  modalActions: { display: 'flex', gap: '.75rem', justifyContent: 'flex-end' },
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
  label: { color: 'var(--text-subtitle-color)', fontSize: '.72rem', fontWeight: 700, width: 10 },
  track: { flex: 1, height: 4, background: 'rgba(148,163,184,.15)', borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, transition: 'width .3s ease' },
  value: { color: 'var(--text-subtitle-color)', fontSize: '.7rem', minWidth: 20, textAlign: 'right' },
};
