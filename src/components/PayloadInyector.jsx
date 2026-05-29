import { useState } from 'react';

export const PayloadInjector = ({ applyAnalysisResult }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Un JSON base de ejemplo para que no tengas que escribirlo de cero cada vez
  const [customPayload, setCustomPayload] = useState(`{
  "mood": "anxious",
  "mood_secondary": null,
  "energy": 0.5,
  "stress": 0.5,
  "warmth": 0.5,
  "pattern": "burst",
  "summary": "Texto de prueba para el hover",
  "actions": [
    { "action": "Prueba 1", "reason": "Razón 1" }
  ]
}`);

  const handleInject = () => {
    try {
      // 1. Convertimos el texto a un objeto JavaScript real
      const parsedData = JSON.parse(customPayload);
      
      // 2. Lo enviamos directamente a tu función procesadora
      applyAnalysisResult(parsedData);
      
      alert("Payload inyectado con éxito");
    } catch (error) {
      // Si te falta una coma o una comilla en el JSON, esto te avisará
      alert("Error: El JSON es inválido. Revisa la sintaxis.");
      console.error(error);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', zIndex: 50, marginTop: '1rem' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ color: '#fb7185', background: 'transparent', border: '1px solid #fb7185', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
      >
        🛠️ {isOpen ? 'Cerrar Injector' : 'Dev: Inyectar Payload'}
      </button>

      {isOpen && (
        <div style={{ 
          position: 'absolute', top: '100%', left: 0, marginTop: '0.5rem',
          background: '#0f172a', padding: '1rem', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.8)', zIndex: 999, width: '300px'
        }}>
          <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 0 }}>Pega el JSON del LLM aquí:</p>
          <textarea
            value={customPayload}
            onChange={(e) => setCustomPayload(e.target.value)}
            style={{
              width: '100%', height: '200px', background: '#1e293b',
              color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.8rem',
              border: 'none', borderRadius: '4px', padding: '0.5rem',
              resize: 'vertical'
            }}
          />
          <button 
            onClick={handleInject}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', background: '#38bdf8', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Inyectar al Canvas
          </button>
        </div>
      )}
    </div>
  );
};