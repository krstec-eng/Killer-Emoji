import React, { useRef, useEffect } from 'react';

interface Particle {
  x: number; // pozycja względem środka
  y: number; // pozycja względem środka
  radius: number;
  speed: number;
  angle: number; // kierunek w radianach
  opacity: number;
  maxDistance: number;
}

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let centerX: number;
    let centerY: number;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      centerX = canvas.width / 2;
      centerY = canvas.height / 2;
      createParticles(); // Odtwórz cząsteczki przy zmianie rozmiaru
    };
    
    const createParticles = () => {
      const particleCount = 200; // Zwiększona liczba dla lepszego efektu
      particles = []; // Wyczyść istniejące cząsteczki
      const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const initialDist = Math.random() * maxDist;
        
        particles.push({
          x: Math.cos(angle) * initialDist,
          y: Math.sin(angle) * initialDist,
          radius: Math.random() * 1.5 + 0.5,
          speed: Math.random() * 0.4 + 0.1, // Znacznie wolniejsza prędkość
          angle: angle,
          opacity: Math.random() * 0.5 + 0.2, // 0.2 do 0.7
          maxDistance: maxDist,
        });
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgba(200, 200, 255, 1)`; // Chłodna biel

      ctx.save();
      ctx.translate(centerX, centerY);

      particles.forEach(p => {
        // Zaktualizuj pozycję
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;

        // Oblicz odległość od środka
        const currentDist = Math.sqrt(p.x * p.x + p.y * p.y);
        
        // Zaktualizuj promień w oparciu o odległość (efekt perspektywy)
        p.radius = (currentDist / p.maxDistance) * 2.5 + 0.5;

        // Zresetuj, jeśli jest poza ekranem
        if (currentDist > p.maxDistance) {
            const newAngle = Math.random() * Math.PI * 2;
            const resetRadius = Math.random() * 50; // Resetuj w losowym miejscu blisko środka
            p.x = Math.cos(newAngle) * resetRadius;
            p.y = Math.sin(newAngle) * resetRadius;
            p.angle = newAngle;
            p.speed = Math.random() * 0.4 + 0.1; // Ustaw wolną prędkość także przy resecie
        }

        // Narysuj cząsteczkę
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2, false);
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1; // Zresetuj alpha
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-0" />;
};

export default ParticleBackground;