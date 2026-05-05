import { useRef, useEffect } from 'react';

const AuraCanvas = ({ parameters }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let lastTime = 0;

    const width = 340;
    const height = 340;
    canvas.width = width;
    canvas.height = height;

    const particleCount = 55 + Math.round(parameters.energy * 65);
    const particles = Array.from({ length: particleCount }).map(() => ({
      angle: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.8 + parameters.energy * 1.4,
      radius: 1.2 + Math.random() * 2.8 + parameters.warmth * 2,
      distance: 16 + Math.random() * 110,
      offset: Math.random() * Math.PI * 2,
      alpha: 0.35 + Math.random() * 0.55,
    }));

    const backgroundGradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      20,
      width / 2,
      height / 2,
      width * 0.8
    );
    backgroundGradient.addColorStop(0, `${parameters.color}33`);
    backgroundGradient.addColorStop(0.6, '#0f172a');
    backgroundGradient.addColorStop(1, '#020617');

    const render = (time) => {
      const t = time * 0.001;
      const dt = lastTime ? Math.min(0.05, (time - lastTime) * 0.001) : 0.016;
      lastTime = time;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.globalCompositeOperation = 'lighter';

      particles.forEach((p) => {
        const stressFactor = parameters.stress * 0.1;
        const pulse = 1 + Math.sin(t * 2 + p.offset) * parameters.energy * 0.2;
        const jitter = (Math.random() - 0.5) * stressFactor;
        let x = 0;
        let y = 0;
        let radius = p.radius * pulse;

        if (parameters.pattern === 'orbit') {
          p.angle += dt * p.speed * 2 + stressFactor * 0.01;
          const distance = p.distance * (0.8 + 0.2 * Math.sin(t * 1.1 + p.offset));
          x = Math.cos(p.angle + jitter) * distance;
          y = Math.sin(p.angle + jitter) * distance;
          radius *= 0.7;
        } else if (parameters.pattern === 'flow') {
          p.angle += dt * p.speed * 1.8 + jitter * 0.5;
          x = Math.cos(p.angle) * p.distance * (0.6 + 0.4 * parameters.energy);
          y = Math.sin(p.angle) * p.distance * 0.75;
          radius *= 0.9;
        } else if (parameters.pattern === 'pulse') {
          const pulseRadius = Math.sin(t * 1.4 + p.offset) * 8 * parameters.energy + p.distance * 0.25;
          x = Math.cos(p.angle + jitter) * (p.distance * 0.45 + pulseRadius);
          y = Math.sin(p.angle + jitter) * (p.distance * 0.45 + pulseRadius);
          radius *= 1.1;
          p.angle += dt * 0.4;
        } else {
          p.angle += jitter * 0.15;
          x = Math.cos(p.angle) * (p.distance + Math.sin(t + p.offset) * 8 * parameters.energy);
          y = Math.sin(p.angle) * (p.distance + Math.cos(t + p.offset) * 8 * parameters.energy);
          radius *= 1.05;
          p.distance += dt * (0.05 + parameters.energy * 0.1);
          if (p.distance > width * 0.55) {
            p.distance = 16 + Math.random() * 60;
          }
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = parameters.color;
        ctx.globalAlpha = Math.max(0.2, p.alpha - stressFactor * 0.2);
        ctx.shadowBlur = 14;
        ctx.shadowColor = parameters.color;
        ctx.fill();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render(0);

    return () => cancelAnimationFrame(animationFrameId);
  }, [parameters]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ borderRadius: '50%', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
    />
  );
};

export default AuraCanvas;