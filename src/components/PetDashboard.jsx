import AuraCanvas from './AuraCanvas';
import { useState, useEffect, useRef, useMemo } from 'react';
import { MOODS,COLORS_MOOD,MOOD_ES } from '../moods.js';
import { unstable_renderSubtreeIntoContainer } from 'react-dom';

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
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const confirmDeleteAction = () => {
    if (!confirmDelete) return;
    const petId = confirmDelete;
    const updatedProfiles = profiles.filter(p => p.id !== petId);
    localStorage.setItem('petaura_profiles', JSON.stringify(updatedProfiles));
    
    const remainingHistory = history.filter(e => e.petId !== petId);
    localStorage.setItem('petaura_history', JSON.stringify(remainingHistory));
    
    if (activeId === petId) {
      if (updatedProfiles.length > 0) {
        localStorage.setItem('petaura_active_pet', updatedProfiles[0].id);
        localStorage.setItem('petaura_profile', JSON.stringify(updatedProfiles[0]));
      } else {
        localStorage.removeItem('petaura_active_pet');
        localStorage.removeItem('petaura_profile');
      }
    }
    
    window.location.reload();
  };

  const confirmDeleteBulkAction = () => {
    const updatedProfiles = profiles.filter(p => !selected.has(p.id));
    localStorage.setItem('petaura_profiles', JSON.stringify(updatedProfiles));
    
    const remainingHistory = history.filter(e => !selected.has(e.petId));
    localStorage.setItem('petaura_history', JSON.stringify(remainingHistory));
    
    if (selected.has(activeId)) {
      if (updatedProfiles.length > 0) {
        localStorage.setItem('petaura_active_pet', updatedProfiles[0].id);
        localStorage.setItem('petaura_profile', JSON.stringify(updatedProfiles[0]));
      } else {
        localStorage.removeItem('petaura_active_pet');
        localStorage.removeItem('petaura_profile');
      }
    }
    
    window.location.reload();
  };

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

  const nameAscSort="Nombre (A-Z)";
  const nameDescSort="Nombre (Z-A)";
  const dateAscSort="Añadidos recientemente";
  const dateDescSort="Primeros Agregados";
  const stateAscSort="Actualización más antigua";
  const stateDescSort="Última actualización";
  const needAttentionSort="Prioridad: Atención";
  const staleSort="Prioridad: Sin registro";
  const sortOptions = {
    "STATE_DESC": stateDescSort,
    "STATE_ASC": stateAscSort,
    "NAME_ASC" : nameAscSort,
    "NAME_DESC": nameDescSort,
    "PRIORITY_ATTENTION": needAttentionSort,
    "PRIORITY_STALE": staleSort,
    "DATE_ASC": dateAscSort,
    "DATE_DESC": dateDescSort,
  }
  const [selectedSort,setSelectedSort] = useState(stateDescSort);

  const sortedProfiles = filteredProfiles.toSorted(
    (a,b) => {
      if(selectedSort === sortOptions.DATE_ASC){
        //orden al reves
        return -1;
      } else if (selectedSort === sortOptions.DATE_DESC){
        //orden normal
        return 0;
      } else if (selectedSort === sortOptions.NAME_ASC){
        return a.name.localeCompare(b.name);
      } else if (selectedSort === sortOptions.NAME_DESC){
        return b.name.localeCompare(a.name);
      } else if (selectedSort === sortOptions.STATE_ASC){
        const lastA = lastEntryForPet(a.id,history);
        const lastB = lastEntryForPet(b.id,history);
        const timestampA= lastA? new Date(lastA.timestamp).getTime() : Infinity;
        const timestampB= lastB? new Date(lastB.timestamp).getTime() : Infinity;
        return timestampA-timestampB;
      } else if (selectedSort === sortOptions.STATE_DESC){
        const lastA = lastEntryForPet(a.id,history);
        const lastB = lastEntryForPet(b.id,history);
        const timestampA= lastA? new Date(lastA.timestamp).getTime() : 0;
        const timestampB= lastB? new Date(lastB.timestamp).getTime() : 0;
        return timestampB-timestampA;
      } else if (selectedSort === sortOptions.PRIORITY_ATTENTION){
        const lastA = lastEntryForPet(a.id,history);
        const lastB = lastEntryForPet(b.id,history);
        const isAlertA=lastA? isPetAlert(lastA): false;
        const isAlertB=lastB? isPetAlert(lastB): false;
        return isAlertB-isAlertA;
      } else if (selectedSort === sortOptions.PRIORITY_STALE){
        const lastA = lastEntryForPet(a.id,history);
        const lastB = lastEntryForPet(b.id,history);
        const isStaleA=lastA? isPetStale(lastA): true;
        const isStaleB=lastB? isPetStale(lastB): true;
        return isStaleB-isStaleA;
      }
      return 0;
    }
  );
  const resultProfiles = sortedProfiles;

  const allSelected = selected.size === resultProfiles.length && resultProfiles.length > 0;

  const toggleSelectMode = () => {
    setSelectMode(v => !v);
    setSelected(new Set());
  };

  const toggleOne = id => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(resultProfiles.map(p => p.id)));
    }
  };

  const resultCards = 
    resultProfiles.map(pet => {
            const last = lastEntryForPet(pet.id,history);
            const color = last?.color ?? COLORS_MOOD[MOODS.CALM];
            const secondaryColor = last?.secondaryColor ?? null;
            const isAlert = last ? isPetAlert(last) : false;
            const isStale = !last || isPetStale(last);
            const isActive = pet.id === activeId;
            const isSelected = selected.has(pet.id);

            return (
              <div
                key={pet.id}
                onClick={() => {
                  if (selectMode) toggleOne(pet.id);
                  else onSelectPet(pet.id);
                }}
                style={{ 
                  ...s.card, 
                  ...(isActive && !selectMode ? s.cardActive : {}), 
                  ...(isSelected ? s.cardSelected : {}),
                  position: 'relative' 
                }}
                aria-label={`Ver aura de ${pet.name}`}
                role="button"
                tabIndex={0}
              >
                {selectMode ? (
                  <div style={isSelected ? s.checkOn : s.checkOff} aria-hidden>
                    {isSelected && <span style={s.checkMark}>✓</span>}
                  </div>
                ) : (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(pet.id);
                    }}
                    style={s.deleteBtn}
                    title="Eliminar mascota"
                  >
                    ✕
                  </div>
                )}
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
                        {isAlert && <span style={s.badgeAlert}>&#9888;&#65039; Atención</span>}
                        {isStale && <span style={s.badgeStale}>&#127774; Sin registro hoy</span>}
                      </div>
                    )}
                  </div>
                </div>
                <span style={s.cta}>Ver aura →</span>
              </div>
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {profiles.length > 0 && (
              <button
                onClick={toggleSelectMode}
                style={selectMode ? s.btnSelectActive : s.btnSelect}
              >
                {selectMode ? 'Cancelar' : 'Seleccionar'}
              </button>
            )}
            <button onClick={onAddPet} style={s.addBtn} aria-label="Agregar mascota">
              + Agregar
            </button>
          </div>
        </div>
        
        {selectMode && resultProfiles.length > 0 && (
          <div style={s.selectionBar}>
            <button onClick={toggleAll} style={s.btnSelAll}>
              {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            <span style={s.selCount}>
              {selected.size > 0 ? `${selected.size} seleccionada${selected.size > 1 ? 's' : ''}` : 'Ninguna'}
            </span>
            <button
              onClick={() => selected.size > 0 && setConfirmBulk(true)}
              style={selected.size > 0 ? s.btnDeleteSel : s.btnDeleteSelDisabled}
              disabled={selected.size === 0}
            >
              Eliminar
            </button>
          </div>
        )}

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

          <div style={s.dropdownContainer}>
            <div 
              className="filter-select-trigger" 
              onClick={() => setIsSortOpen(!isSortOpen)}
            >
              {/*Se imprime directamente Filtro seleccionado*/}
              <span>{selectedSort}</span>
              {/*flechas del dropdown*/}
              <i className={`fa-solid fa-chevron-${isSortOpen ? 'up' : 'down'}`} style={s.chevronIcon}></i>
            </div>

            {/*solo se muestra menu si esta abietrto*/}
            {isSortOpen && (
              <div style={s.dropdownMenu}>
                {/*Opciones para ordenar*/}
                <div style={s.dropdownGroupLabel}>Ordenar por</div>
                {Object.keys(sortOptions).map(moodKey => (
                  <div 
                    key={moodKey}
                    className={`dropdown-item ${selectedSort === sortOptions[moodKey] ? 'active' : ''}`}
                    onClick={() => { setSelectedSort(sortOptions[moodKey]); setIsSortOpen(false); }}
                  >
                    {sortOptions[moodKey]}
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

        {confirmDelete && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <p style={s.modalTitle}>¿Eliminar mascota?</p>
              <p style={s.modalSub}>
                Esta acción no se puede deshacer. Se eliminará permanentemente la mascota y todo su historial de auras.
              </p>
              <div style={s.modalActions}>
                <button onClick={() => setConfirmDelete(null)} style={s.btnCancel}>Cancelar</button>
                <button onClick={confirmDeleteAction} style={s.btnConfirm}>Eliminar</button>
              </div>
            </div>
          </div>
        )}

        {confirmBulk && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <p style={s.modalTitle}>¿Eliminar {selected.size} mascota{selected.size > 1 ? 's' : ''}?</p>
              <p style={s.modalSub}>
                Esta acción no se puede deshacer. Se eliminarán permanentemente las mascotas seleccionadas y todo su historial de auras.
              </p>
              <div style={s.modalActions}>
                <button onClick={() => setConfirmBulk(false)} style={s.btnCancel}>Cancelar</button>
                <button onClick={confirmDeleteBulkAction} style={s.btnConfirm}>Eliminar {selected.size}</button>
              </div>
            </div>
          </div>
        )}

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
    margin: '0 0 .25rem', color: 'var(--text-subtitle-color)',
    fontSize: '.85rem', letterSpacing: '.06em', textTransform: 'uppercase',
  },
  title: { margin: 0, fontSize: '1.75rem', color: '#f0f0ff' },
  addBtn: {
    padding: '.65rem 1.25rem', minHeight: 48,
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,.25)',
    background: 'transparent', color: 'var(--text-intermediate-color)',
    fontSize: '.9rem', cursor: 'pointer',
    fontWeight: 500,
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
  petName: { color: 'var(--text-regular-color)', fontWeight: 700, fontSize: '1.05rem' },
  petSpecies: { color: 'var(--text-subtitle-color)', fontSize: '.85rem' },
  badges: { display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginTop: '.25rem' },
  badgeAlert: {
    display: 'inline-block', padding: '.2rem .6rem', borderRadius: 999,
    fontSize: '.75rem', fontWeight: 600,
    background: 'rgba(220,38,38,.12)', color: '#fca5a5',
    border: '1px solid rgba(220,38,38,.4)',
  },
  badgeStale: {
    display: 'inline-block', padding: '.2rem .6rem', borderRadius: 999,
    fontSize: '.75rem', fontWeight: 600,
    background: 'rgba(217, 119, 6, 0.12)', color: '#fcd34d',
    border: '1px solid rgba(217, 119, 6, 0.4)',
  },
  cta: { color: '#7c6bff', fontSize: '.85rem', fontWeight: 600, alignSelf: 'flex-end' },
  deleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: '50%',
    border: '1px solid rgba(248,113,113,.35)',
    background: 'rgba(248,113,113,.15)',
    color: '#f87171',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '.85rem',
    transition: 'all .2s',
  },
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#1e293b', border: '1px solid rgba(148,163,184,.2)',
    borderRadius: 24, padding: '2rem', width: '90%', maxWidth: 360,
    boxShadow: '0 20px 40px rgba(0,0,0,.4)', textAlign: 'center',
  },
  modalTitle: { margin: '0 0 .5rem', color: '#f0f0ff', fontSize: '1.25rem', fontWeight: 600 },
  modalSub: { margin: '0 0 1.5rem', color: '#94a3b8', fontSize: '.9rem', lineHeight: 1.5 },
  modalActions: { display: 'flex', gap: '1rem' },
  btnCancel: {
    flex: 1, padding: '.75rem', borderRadius: 999, border: '1px solid rgba(148,163,184,.3)',
    background: 'transparent', color: '#cbd5e1', fontWeight: 600, cursor: 'pointer',
  },
  btnConfirm: {
    flex: 1, padding: '.75rem', borderRadius: 999, border: 'none',
    background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer',
  },
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
    color: 'var(--text-subtitle-color)',
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
  cardSelected: {
    border: '1px solid rgba(96,165,250,.45)',
    background: 'rgba(30,58,138,.18)',
  },
  checkOff: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '2px solid rgba(148,163,184,.35)',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '2px solid #60a5fa',
    background: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: '.7rem',
    fontWeight: 800,
    lineHeight: 1,
  }
};
