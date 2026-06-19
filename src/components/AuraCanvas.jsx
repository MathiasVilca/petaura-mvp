import { useRef, useEffect } from 'react';

const AuraCanvas = ({ parameters, size, reduction_parameter=1,reduce_particles=false, reduce_particle_multiplier=false, reducedBaseParticleCount=25, reducedBaseParticleMult=30 }) => {
  const canvasRef = useRef(null);
  const actualSize = Number(size) || 340;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let lastTime = 0;
    let visible = false;

    const width = actualSize;
    const height = actualSize;
    canvas.width = width;
    canvas.height = height;
    const particleBaseCount = reduce_particles? reducedBaseParticleCount : 55
    const particleBaseMultiplier = reduce_particle_multiplier? reducedBaseParticleMult : 65
    const particleCount = particleBaseCount + Math.round(parameters.energy * particleBaseMultiplier * reduction_parameter); // Ajustar cantidad de partículas según energía y reducción
    const jitterMultiplier = 0.25
    const particles = Array.from({ length: particleCount }).map(() => {
      
      // 1. Calculamos la distancia inicial según el patrón activo
      const initialDistance = parameters.pattern === 'burst' 
        ? (Math.random() * (width * 0.55)) // Distribución amplia para evitar el "anillo"
        : (16 + Math.random() * 110)*(reduction_parameter);      // Distribución agrupada original para flow, orbit y pulse

      // 2. Asignar color primario o secundario (70/30) — UNA SOLA VEZ al crear la partícula
      const isSecondary = parameters.secondaryColor && Math.random() < 0.25;
      const speed = parameters.pattern === 'burst'? (0.4 + Math.random() * 0.8 + parameters.energy * 1.4)*reduction_parameter :0.4 + Math.random() * 0.8 + parameters.energy * 1.4

      return {
        angle: Math.random() * Math.PI * 2,
        speed: speed,
        radius: (1.2 + Math.random() * 2.8 + parameters.warmth * 2)*(reduction_parameter**0.5), // Ajustar tamaño de partículas según calidez y reducción
        
        distance: initialDistance, 
        
        offset: Math.random() * Math.PI * 2,
        alpha: 0.35 + Math.random() * 0.55,
        isSecondary, // Propiedad persistente: esta partícula es color secundario sí/no
      };
    });
    const STARTING_CIRCLE_RADIUS_GRADIENT = width/17.0
    const backgroundGradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      STARTING_CIRCLE_RADIUS_GRADIENT,
      width / 2,
      height / 2,
      width * 0.8
    );
    backgroundGradient.addColorStop(0, `${parameters.color}33`);
    backgroundGradient.addColorStop(0.6, '#0f172a');
    backgroundGradient.addColorStop(1, '#020617');

    const render = (time) => {
      if (!visible) return;
      const t = time * 0.001;
      const dt = lastTime ? Math.min(0.05, (time - lastTime) * 0.001) : 0.016;
      lastTime = time;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.globalCompositeOperation = 'lighter';
      const MAX_SPAWN_RADIUS = width/17.0
      particles.forEach((p) => {
        const stressFactor = parameters.stress * 0.1;
        const pulseSpeed = 2 + parameters.stress * 3;
        //const pulse = 1 + Math.sin(t * pulseSpeed + p.offset) * parameters.energy * 0.2;
        const pulse = 1 + Math.sin(t * pulseSpeed + p.offset) * (0.1 + parameters.stress * 0.5);
        let x = 0;
        let y = 0;
        let radius = p.radius * pulse;
        let fade = 1;

        if (parameters.pattern === 'orbit') {
          p.angle += dt * p.speed * 2 + stressFactor * 0.01;
          const distance = p.distance * (0.8 + 0.2 * Math.sin(t * 1.1 + p.offset));
          x = Math.cos(p.angle) * distance;
          y = Math.sin(p.angle) * distance;
          radius *= 0.7;
        } else if (parameters.pattern === 'flow') {
          p.angle += dt * p.speed * 1.0;
          x = Math.cos(p.angle) * p.distance * (0.6 + 0.4 * parameters.energy);
          y = Math.sin(p.angle) * p.distance * 0.75;
          radius *= 0.9;
        } else if (parameters.pattern === 'pulse') {
          const pulseRadius = Math.sin(t * 1.4 + p.offset) * 8 * reduction_parameter * parameters.energy + p.distance * 0.25;
          x = Math.cos(p.angle) * (p.distance * 0.45 + pulseRadius);
          y = Math.sin(p.angle) * (p.distance * 0.45 + pulseRadius);
          radius *= 1.1;
          p.angle += dt * 0.4;
        } else {
          //p.angle += dt * p.speed * 0.05;
          x = Math.cos(p.angle) * (p.distance + Math.sin(t + p.offset) * 8 * reduction_parameter * parameters.energy);
          y = Math.sin(p.angle) * (p.distance + Math.cos(t + p.offset) * 8 * reduction_parameter * parameters.energy);
          radius *= 1.05;
          p.distance += dt * (p.speed * 40);
          const maxDistance = width * 0.55 + p.radius*2;

          fade = Math.min(1, p.distance / 30);
          
          if (p.distance > maxDistance) {
            p.radius=(1.2 + Math.random() * 2.8 + parameters.warmth * 2)*(reduction_parameter**0.5);
            p.distance = Math.random() * MAX_SPAWN_RADIUS;
            p.angle = Math.random() * Math.PI * 2;
          }
        }
        //jitter, necesita ajustes
        const jitterRadius = p.radius * parameters.stress * jitterMultiplier //radio de que posicion puede cambiar (EJEMPLO)
        //como p.radius ya afectado por reduction_parameter...
        //considerando que stress esta entre 0 y 1
        //angulo al azar 
        const jitterAngle = Math.random() * Math.PI * 2
        //se mueve en ese angulo
        //se le suma a x e y :P
        x += jitterRadius*Math.cos(jitterAngle);
        y += jitterRadius*Math.sin(jitterAngle);
        //x += (Math.random() - 0.5) * jitterMultiplier * parameters.stress;
        //y += (Math.random() - 0.5) * jitterMultiplier * parameters.stress;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        
        // Elegir color basado en la propiedad asignada al crear la partícula
        const particleColor = p.isSecondary ? parameters.secondaryColor : parameters.color;

        ctx.globalAlpha = Math.min(1, Math.max(0, (p.alpha - stressFactor * 0.2) * pulse * fade));
        const SHADOW_BLUR = 1
        ctx.shadowBlur = SHADOW_BLUR;
        ctx.fillStyle = particleColor;
        ctx.shadowColor = particleColor;
        
        ctx.fill();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          lastTime = 0; // evita un dt gigante al reanudar
          animationFrameId = requestAnimationFrame(render);
        } else {
          cancelAnimationFrame(animationFrameId);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [parameters, size, reduction_parameter, reduce_particles, reducedBaseParticleCount, reduce_particle_multiplier, reducedBaseParticleMult]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ width: actualSize, height: actualSize, borderRadius: '50%', boxShadow: `0 0 ${Math.round(actualSize / 17)}px rgba(0,0,0,0.5)` }}
    />
  );
};

export default AuraCanvas;