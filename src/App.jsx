import { useState } from 'react';
import AuraCanvas from './components/AuraCanvas';

// 1. Nuestros JSONs simulados (Lo que devolvería Claude)
const mockStates = {
  happy: {
    mood: 'happy',
    color: '#22c55e',
    energy: 0.92,
    stress: 0.18,
    warmth: 0.88,
    pattern: 'burst',
    description: 'Muy activo y alegre. Su aura muestra vitalidad expansiva, brillo y movimiento rápido.',
    actions: [
      'Juega 15 minutos con su juguete favorito.',
      'Refuerza el vínculo con caricias y premios.',
      'Aprovecha para dar un paseo enérgico.'
    ],
    exampleText: 'Toby estuvo súper activo hoy, jugó todo el día con la pelota, comió bien y estuvo muy cariñoso con todos en casa.'
  },
  calm: {
    mood: 'calm',
    color: '#14b8a6',
    energy: 0.28,
    stress: 0.12,
    warmth: 0.74,
    pattern: 'flow',
    description: 'Tranquilo y equilibrado. La aura es suave, fluida y reposada, con movimiento constante pero relajado.',
    actions: [
      'Mantén el ambiente sereno y con poca estimulación.',
      'Ofrece un espacio cómodo para descansar.',
      'Observa si prefiere contacto silencioso o distancia.'
    ],
    exampleText: 'Hoy estuvo muy tranquilo, durmió bastante y se mostró relajado mientras paseábamos cerca de casa.'
  },
  sick: {
    mood: 'sick',
    color: '#581c87',
    energy: 0.06,
    stress: 0.72,
    warmth: 0.32,
    pattern: 'pulse',
    description: 'Muy bajo de energía y algo tenso. El aura es lenta, opaca y concentra la atención hacia el centro.',
    actions: [
      'Observa si come y bebe normalmente.',
      'Permítele descansar en un lugar cálido y cómodo.',
      'Consulta al veterinario si el estado persiste.'
    ],
    exampleText: 'Hoy estuvo decaído, casi no jugó, respiró lento y comió muy poco. Se mostró más quieto de lo normal.'
  }
};

function App() {
  const [auraState, setAuraState] = useState(mockStates.calm);
  const [showLegend, setShowLegend] = useState(false);

  // 2. Función para simular la entrada de voz y el cambio de estado
  const simulateVoiceInput = (stateKey) => {
    setAuraState(mockStates[stateKey]);

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