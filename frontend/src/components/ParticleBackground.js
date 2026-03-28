// components/ParticleBackground.js
// Canvas-based warp-speed starfield / particle system.
// All intensity values are configurable via props.
import React, { useEffect, useRef } from 'react';

const COLORS = [
  'rgba(200,255,0,BASE)',
  'rgba(0,212,255,BASE)',
  'rgba(255,255,255,BASE)',
  'rgba(255,255,255,BASE)',
  'rgba(255,255,255,BASE)',
];

function randomColor(opacity) {
  const tpl = COLORS[Math.floor(Math.random() * COLORS.length)];
  return tpl.replace('BASE', opacity.toFixed(2));
}

class Particle {
  constructor(cx, cy, cfg) {
    this.cfg = cfg;
    this.reset(cx, cy);
  }
  reset(cx, cy) {
    this.x  = cx + (Math.random() - 0.5) * 4;
    this.y  = cy + (Math.random() - 0.5) * 4;
    this.ox = this.x;
    this.oy = this.y;
    const angle = Math.random() * Math.PI * 2;
    const speed = this.cfg.speedMin + Math.random() * (this.cfg.speedMax - this.cfg.speedMin);
    this.vx      = Math.cos(angle) * speed;
    this.vy      = Math.sin(angle) * speed;
    this.size    = 0.4 + Math.random() * 1.2;
    this.opacity = (0.08 + Math.random() * 0.35) * this.cfg.opacityFactor;
    this.color   = randomColor(this.opacity);
    this.life    = 0;
    this.maxLife = 140 + Math.random() * 220;
    this.trail   = 0.3 + Math.random() * 0.6;
  }
}

export default function ParticleBackground({
  count        = 80,
  speedMin     = 0.2,
  speedMax     = 1.0,
  opacityFactor= 0.5,
  fadeStrength = 0.28,   // higher = trails clear faster
}) {
  const canvasRef = useRef(null);
  const cfg = { speedMin, speedMax, opacityFactor };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];
    let W, H, cx, cy;

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      cx = W / 2;
      cy = H / 2;
    }

    function init() {
      resize();
      particles = Array.from({ length: count }, () => {
        const p = new Particle(cx, cy, cfg);
        p.life = Math.random() * p.maxLife;
        const t = p.life;
        p.x = p.ox + p.vx * t;
        p.y = p.oy + p.vy * t;
        return p;
      });
    }

    function draw() {
      ctx.fillStyle = `rgba(10,10,10,${fadeStrength})`;
      ctx.fillRect(0, 0, W, H);

      for (const p of particles) {
        p.life++;
        const t   = p.life / p.maxLife;
        const spd = 1 + t * 2.5;
        p.x += p.vx * spd;
        p.y += p.vy * spd;

        const prevX = p.x - p.vx * spd * p.trail * 3;
        const prevY = p.y - p.vy * spd * p.trail * 3;
        const alpha = Math.min(1, t * 3) * (1 - t * 0.5) * p.opacity;

        ctx.strokeStyle = p.color.replace(/[\d.]+\)$/, `${alpha.toFixed(2)})`);
        ctx.lineWidth   = p.size * (0.5 + t);
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${Math.min(1, alpha * 1.5).toFixed(2)})`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.4), 0, Math.PI * 2);
        ctx.fill();

        if (p.life >= p.maxLife || p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
          p.reset(cx, cy);
        }
      }
      animId = requestAnimationFrame(draw);
    }

    init();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', display: 'block' }}
    />
  );
}
