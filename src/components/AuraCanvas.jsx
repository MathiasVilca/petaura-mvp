import { useRef, useEffect } from 'react';

const AuraCanvas = ({ parameters }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Ajustar tamaño del canvas
    canvas.width = 300;
    canvas.height = 300;

    // Crear partículas básicas
    const particles = Array.from({ length: 50 }).map(() => ({
      x: canvas.width / 2,
      y: canvas.height / 2,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() + (parameters.energy * 1.5), // La energía afecta la velocidad
      radius: Math.random() * 3 + 1,
    }));

    const render = () => {
      // Limpiar canvas con un rastro sutil (efecto de estela)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)'; // Fondo oscuro
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Dibujar partículas
      particles.forEach((p) => {
        // Mover partícula (patrón "burst" básico)
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;

        // Si sale del canvas, resetear al centro
        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
          p.x = canvas.width / 2;
          p.y = canvas.height / 2;
        }

        // Dibujar
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = parameters.color; // El color depende del mood
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Limpieza al desmontar
    return () => cancelAnimationFrame(animationFrameId);
  }, [parameters]); // Se vuelve a ejecutar si cambian los parámetros simulados

  return (
    <canvas 
      ref={canvasRef} 
      style={{ borderRadius: '50%', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
    />
  );
};

export default AuraCanvas;