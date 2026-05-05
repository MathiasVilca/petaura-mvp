import { useState } from 'react';
import AuraCanvas from './components/AuraCanvas';

// 1. Nuestros JSONs simulados (Lo que devolvería Claude)
const mockStates = {
  happy: { mood: 'happy', color: '#22c55e', energy: 0.9, pattern: 'burst' },
  calm: { mood: 'calm', color: '#14b8a6', energy: 0.2, pattern: 'flow' },
  sick: { mood: 'sick', color: '#581c87', energy: 0.05, pattern: 'pulse' }
};

function App() {
  const [auraState, setAuraState] = useState(mockStates.calm);

  // 2. Función para simular la entrada de voz y el cambio de estado
  const simulateVoiceInput = (stateKey) => {
    setAuraState(mockStates[stateKey]);
    
    // Extra: Feedback háptico (vibra si estás en un móvil)
    if (navigator.vibrate) {
      navigator.vibrate([80]); 
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: 'white', minHeight: '100vh', padding: '2rem' }}>
      
      <h1>PetAura MVP</h1>
      <p>Simulación de interacción no convencional</p>
      
      {/* Nuestro Canvas interactivo */}
      <div style={{ margin: '2rem 0' }}>
        <AuraCanvas parameters={auraState} />
      </div>

      {/* Botones para simular los estados */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button onClick={() => simulateVoiceInput('happy')} style={{ padding: '10px', backgroundColor: '#22c55e', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          Simular: "Muy feliz y activo"
        </button>
        <button onClick={() => simulateVoiceInput('calm')} style={{ padding: '10px', backgroundColor: '#14b8a6', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          Simular: "Tranquilo"
        </button>
        <button onClick={() => simulateVoiceInput('sick')} style={{ padding: '10px', backgroundColor: '#581c87', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          Simular: "Decaído / Enfermo"
        </button>
      </div>

    </div>
  );
}

export default App;