// MATIAS — F1 miniaura:
// Reemplazar <MiniAuraSlot> por <MiniAuraCanvas parameters={last} size={72} />
// cuando el componente de canvas estático esté listo. Tamaño fijo: 72×72 px.
function MiniAuraSlot({ color = '#14b8a6' }) {
  return (
    <div style={{
      width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
      background: `radial-gradient(circle at 38% 38%, ${color}cc 0%, ${color}55 45%, ${color}18 70%, transparent 100%)`,
      boxShadow: `0 0 18px ${color}44, inset 0 0 14px ${color}22`,
    }} />
  );
}

const ALERT_MOODS = new Set(['sick', 'anxious']);

function lastEntryForPet(/* petId, */ history) {
  // TODO (F1 Día 3): filtrar history por petId cuando el schema lo incluya.
  // Por ahora muestra la entrada más reciente del historial global.
  return history[0] ?? null;
}

export default function PetDashboard({ profiles, history, activeId, onSelectPet, onAddPet }) {
  return (
    <div style={s.page}>
      <div style={s.container}>

        <div style={s.header}>
          <div>
            <p style={s.eyebrow}>PetAura</p>
            <h2 style={s.title}>Mis mascotas</h2>
          </div>
          <button onClick={onAddPet} style={s.addBtn} aria-label="Agregar mascota">
            + Agregar
          </button>
        </div>

        <div style={s.grid}>
          {profiles.map(pet => {
            const last = lastEntryForPet(history);
            const color = last?.color ?? '#14b8a6';
            const isAlert = last ? ALERT_MOODS.has(last.mood) : false;
            const isStale = !last || Date.now() - new Date(last.timestamp).getTime() > 86_400_000;
            const isActive = pet.id === activeId;

            return (
              <button
                key={pet.id}
                onClick={() => onSelectPet(pet.id)}
                style={{ ...s.card, ...(isActive ? s.cardActive : {}) }}
                aria-label={`Ver aura de ${pet.name}`}
              >
                <div style={s.cardTop}>
                  <MiniAuraSlot color={color} />
                  <div style={s.petInfo}>
                    <span style={s.petName}>{pet.name}</span>
                    <span style={s.petSpecies}>
                      {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
                    </span>
                    {(isAlert || isStale) && (
                      <div style={s.badges}>
                        {isAlert && <span style={s.badgeAlert}>⚠ Atención</span>}
                        {isStale && <span style={s.badgeStale}>Sin registro hoy</span>}
                      </div>
                    )}
                  </div>
                </div>
                <span style={s.cta}>Ver aura →</span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top, #111827 0%, #020617 65%, #000 100%)',
    padding: '1.5rem',
  },
  container: {
    maxWidth: 600, margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '1.5rem',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  eyebrow: {
    margin: '0 0 .25rem', color: '#94a3b8',
    fontSize: '.85rem', letterSpacing: '.06em', textTransform: 'uppercase',
  },
  title: { margin: 0, fontSize: '1.75rem', color: '#f0f0ff' },
  addBtn: {
    padding: '.65rem 1.25rem', minHeight: 48,
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,.25)',
    background: 'transparent', color: '#94a3b8',
    fontSize: '.9rem', cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '1rem',
  },
  card: {
    display: 'flex', flexDirection: 'column', gap: '1rem',
    padding: '1.25rem',
    background: 'rgba(15,23,42,.88)',
    border: '1px solid rgba(148,163,184,.12)',
    borderRadius: 20, cursor: 'pointer', textAlign: 'left',
    transition: 'border-color .2s ease, box-shadow .2s ease',
  },
  cardActive: {
    border: '1px solid rgba(124,107,255,.45)',
    boxShadow: '0 0 24px rgba(124,107,255,.15)',
  },
  cardTop: { display: 'flex', gap: '1rem', alignItems: 'center' },
  petInfo: { display: 'flex', flexDirection: 'column', gap: '.25rem', flex: 1 },
  petName: { color: '#f0f0ff', fontWeight: 700, fontSize: '1.05rem' },
  petSpecies: { color: '#8899b0', fontSize: '.85rem' },
  badges: { display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginTop: '.25rem' },
  badgeAlert: {
    display: 'inline-block', padding: '.2rem .6rem', borderRadius: 999,
    fontSize: '.75rem', fontWeight: 600,
    background: 'rgba(248,113,113,.15)', color: '#f87171',
    border: '1px solid rgba(248,113,113,.25)',
  },
  badgeStale: {
    display: 'inline-block', padding: '.2rem .6rem', borderRadius: 999,
    fontSize: '.75rem', fontWeight: 600,
    background: 'rgba(250,204,21,.1)', color: '#fbbf24',
    border: '1px solid rgba(250,204,21,.2)',
  },
  cta: { color: '#7c6bff', fontSize: '.85rem', fontWeight: 600, alignSelf: 'flex-end' },
};
