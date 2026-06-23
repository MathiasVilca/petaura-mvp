import AuraCanvas from './AuraCanvas';
import { useState, useEffect, useRef, useMemo } from 'react';
import { MOODS,COLORS_MOOD,MOOD_ES } from '../moods.js';

const ALERT_MOODS = new Set([MOODS.ANXIOUS, MOODS.IRRITABLE]);

function lastEntryForPet( petId, history) {
  // implementacion de filtrar history por petId
  return history.find(entry => entry.petId === petId) ?? null;
}
const REDUCTION_PARAMETER=72/340.0 //para aura mini
function isPetAlert(last){
  return (ALERT_MOODS.has(last.mood) || last.health_concern === true);
}
function isPetStale(last){
  return (Date.now() - new Date(last.timestamp).getTime() > 86_400_000);
}
export default function PetDashboard({ profiles, history, activeId, onSelectPet, onAddPet }) {
  const [petSearchQuery,setPetSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const allSelector = "Todas las mascotas";
  const alertSelector = "Atención";
  const staleSelector = "Sin registro hoy";
  const needsSelector = {
    "ATTENTION": alertSelector,
    "STALE": staleSelector,
  }
  const speciesSelector = {
    "DOG": "Perro",
    "CAT": "Gato",
    "OTHER": "Otro",
  };

  const selectorOptions = {
    "ALL": allSelector,
    "NEEDS": needsSelector,
    "SPECIES": speciesSelector,
    "MOODS": MOOD_ES,
  }

  const [selectedFilter,setSelectedFilter] = useState(selectorOptions["ALL"]);
  const cleanQuery = petSearchQuery.toLowerCase().trim();
  const queryResultProfiles = (cleanQuery==='')? profiles : profiles.filter(pet => {
    const isQueryFirstInName = pet.name.toLowerCase().trim().startsWith(cleanQuery);
    return isQueryFirstInName;
  });
  const filteredProfiles = (selectedFilter===selectorOptions.ALL)? queryResultProfiles : queryResultProfiles.filter(pet => {
    
    //se descarto ALL
    //primero, species
    const isFilterSpecies = Object.values(selectorOptions.SPECIES).includes(selectedFilter)
    //solo necesita una igualdad
    if (isFilterSpecies){
      return pet.species === selectedFilter;
    }
    //para los siguientes se necesita last
    const last = lastEntryForPet(pet.id,history);
    //segundo, needs
    //incluido en needs: es isAlert o isStale
    const isFilterNeeds = Object.values(selectorOptions.NEEDS).includes(selectedFilter)
    
    if(isFilterNeeds){
      if (selectedFilter === selectorOptions.NEEDS.ATTENTION) {
        return last? isPetAlert(last):false;
      } else if (selectedFilter === selectorOptions.NEEDS.STALE) {
        return !last || isPetStale(last);
      }
    }

    //tercero, moods
    const isFilterMoods = Object.values(selectorOptions.MOODS).includes(selectedFilter)
    //solo necesita una comparacion, se pasa al español
    if(isFilterMoods){
      return last? MOOD_ES[last.mood] === selectedFilter : false;
    }
  });
  const resultProfiles = filteredProfiles;
  const resultCards = 
    resultProfiles.map(pet => {
            const last = lastEntryForPet(pet.id,history);
            const color = last?.color ?? COLORS_MOOD[MOODS.CALM];
            const secondaryColor = last?.secondaryColor ?? null;
            const isAlert = last ? isPetAlert(last) : false;
            const isStale = !last || isPetStale(last);
            const isActive = pet.id === activeId;

            return (
              <button
                key={pet.id}
                onClick={() => onSelectPet(pet.id)}
                style={{ ...s.card, ...(isActive ? s.cardActive : {}) }}
                aria-label={`Ver aura de ${pet.name}`}
              >
                <div style={s.cardTop}>
                  <AuraCanvas parameters={
                    {color,secondaryColor,
                    energy: last?.energy ?? 0.5,
                    stress: last?.stress ?? 0.5,
                    warmth: last?.warmth ?? 0.5,
                    pattern: last?.pattern ?? 'flow',}
                  } size={72} reduction_parameter={REDUCTION_PARAMETER} reduce_particles={true}/>
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
          });
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
        <div style={s.toolbar}>
          <div className="search-container">

            <input
              name="pet-name-input"
              value={petSearchQuery}
              onChange={e => setPetSearchQuery(e.target.value)}
              type="text"
              placeholder='Buscar mascotas...'
              className="search-bar"
            />
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
          </div>

          <div style={s.dropdownContainer}>
            <div 
              className="filter-select-trigger" 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              {/*Se imprime directamente Filtro seleccionado*/}
              <span>{selectedFilter}</span>
              {/*flechas del dropdown*/}
              <i className={`fa-solid fa-chevron-${isDropdownOpen ? 'up' : 'down'}`} style={s.chevronIcon}></i>
            </div>

            {/*solo se muestra menu si esta abietrto*/}
            {isDropdownOpen && (
              <div style={s.dropdownMenu}>
                
                {/*Por defecto, se muestra en morado si esta activo*/}
                <div 
                  className={`dropdown-item ${selectedFilter === selectorOptions["ALL"] ? 'active' : ''}`}
                  onClick={() => { setSelectedFilter(selectorOptions["ALL"]); setIsDropdownOpen(false); }}
                >
                  {selectorOptions["ALL"]}
                </div>

                {/*El grupo por necesidad*/}
                <div style={s.dropdownGroupLabel}>Por necesidad</div>
                <div 
                  className={`dropdown-item ${selectedFilter === selectorOptions["NEEDS"].ATTENTION ? 'active' : ''}`}
                  onClick={() => { setSelectedFilter(selectorOptions["NEEDS"].ATTENTION); setIsDropdownOpen(false); }}
                >
                  {selectorOptions["NEEDS"].ATTENTION}
                </div>
                <div 
                  className={`dropdown-item ${selectedFilter === selectorOptions["NEEDS"].STALE ? 'active' : ''}`}
                  onClick={() => { setSelectedFilter(selectorOptions["NEEDS"].STALE); setIsDropdownOpen(false); }}
                >
                  {selectorOptions["NEEDS"].STALE}
                </div>

                {/*Grupo por especie*/}
                <div style={s.dropdownGroupLabel}>Por especie</div>
                <div 
                  className={`dropdown-item ${selectedFilter === selectorOptions["SPECIES"].DOG ? 'active' : ''}`}
                  onClick={() => { setSelectedFilter(selectorOptions["SPECIES"].DOG); setIsDropdownOpen(false); }}
                >
                  {selectorOptions["SPECIES"].DOG}
                </div>
                <div 
                  className={`dropdown-item ${selectedFilter === selectorOptions["SPECIES"].CAT ? 'active' : ''}`}
                  onClick={() => { setSelectedFilter(selectorOptions["SPECIES"].CAT); setIsDropdownOpen(false); }}
                >
                  {selectorOptions["SPECIES"].CAT}
                </div>
                <div 
                  className={`dropdown-item ${selectedFilter === selectorOptions["SPECIES"].OTHER ? 'active' : ''}`}
                  onClick={() => { setSelectedFilter(selectorOptions["SPECIES"].OTHER); setIsDropdownOpen(false); }}
                >
                  {selectorOptions["SPECIES"].OTHER}
                </div>

                {/* Grupo por estado (Mapeados para evitar repeticion)*/}
                <div style={s.dropdownGroupLabel}>Por estado</div>
                {Object.values(MOODS).map(moodKey => (
                  <div 
                    key={moodKey}
                    className={`dropdown-item ${selectedFilter === selectorOptions["MOODS"][moodKey] ? 'active' : ''}`}
                    onClick={() => { setSelectedFilter(selectorOptions["MOODS"][moodKey]); setIsDropdownOpen(false); }}
                  >
                    {selectorOptions["MOODS"][moodKey]}
                  </div>
                ))}

              </div>
            )}

          </div>
        </div>
        
        
        {/*petSearchQuery !== '' && <p>Your query is {petSearchQuery}.</p>*/}
        {/*selectedFilter !== '' && <p>Your filter is {selectedFilter}.</p>*/}
        <div style={s.grid}>
          {resultCards}
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
  searchBar: {
    padding: '.65rem 1.25rem', minHeight: 48,
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,.25)',
    background: 'transparent', color: '#cee2ff',
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
  toolbar: {
    display:'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  dropdownContainer: {
    position: 'relative', 
  },
  chevronIcon: {
    marginLeft: '1.25rem',
    fontSize: '0.8rem',
    color: '#8899b0',
    transition: 'color 0.2s ease',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 'calc(100% + 8px)', 
    right: 0,                
    width: '230px',
    background: 'rgba(15, 23, 42, 0.94)', 
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(148, 163, 184, 0.15)',
    borderRadius: '16px',
    padding: '0.5rem',
    zIndex: 9999, 
    boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.6), 0 4px 12px -2px rgba(0, 0, 0, 0.4)',
  },
  dropdownGroupLabel: {
    color: '#475569', 
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    padding: '0.6rem 0.75rem 0.25rem 0.75rem',
    letterSpacing: '0.06em',
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
