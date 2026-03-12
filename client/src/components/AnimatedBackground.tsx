import { useEffect, useRef, useState } from "react";

const COLOR_PALETTES = [
  { bg: ["#0a0e2e", "#0d1544", "#0a1628"], star: "#a8c5ff", glow: "#3b6fff", accent: "#60a5fa" },
  { bg: ["#1a0a2e", "#2d0a44", "#1a0828"], star: "#d8b4fe", glow: "#9333ea", accent: "#c084fc" },
  { bg: ["#00171f", "#003049", "#001a24"], star: "#99f6e4", glow: "#06b6d4", accent: "#34d399" },
  { bg: ["#1f0a1a", "#3d0d2b", "#200a1a"], star: "#fda4af", glow: "#e11d48", accent: "#fb7185" },
  { bg: ["#1a0f00", "#2e1a00", "#1a0e00"], star: "#fed7aa", glow: "#ea580c", accent: "#fb923c" },
];

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  alphaSpeed: number;
  alphaDir: number;
  pulse: number;
}

interface Meteor {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  alpha: number;
  active: boolean;
  trail: { x: number; y: number }[];
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteRef = useRef(0);
  const starsRef = useRef<Star[]>([]);
  const meteorsRef = useRef<Meteor[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastMeteorTimeRef = useRef(0);
  const transitionRef = useRef({ progress: 1, from: 0, to: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (paletteRef.current + 1) % COLOR_PALETTES.length;
      transitionRef.current = { progress: 0, from: paletteRef.current, to: next };
      paletteRef.current = next;
      setPaletteIndex(next);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      const count = Math.floor((canvas.width * canvas.height) / 4000);
      starsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.8 + 0.3,
        alpha: Math.random(),
        alphaSpeed: Math.random() * 0.008 + 0.002,
        alphaDir: Math.random() > 0.5 ? 1 : -1,
        pulse: Math.random() * Math.PI * 2,
      }));
    };

    const spawnMeteor = () => {
      const angle = (Math.PI / 5) + (Math.random() * Math.PI) / 8;
      meteorsRef.current.push({
        x: Math.random() * canvas.width * 1.2 - canvas.width * 0.1,
        y: -20,
        length: Math.random() * 180 + 80,
        speed: Math.random() * 12 + 8,
        angle,
        alpha: 1,
        active: true,
        trail: [],
      });
    };

    const lerpColor = (a: string, b: string, t: number): string => {
      const ah = parseInt(a.slice(1), 16);
      const bh = parseInt(b.slice(1), 16);
      const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
      const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
      const rr = Math.round(ar + (br - ar) * t);
      const rg = Math.round(ag + (bg - ag) * t);
      const rb = Math.round(ab + (bb - ab) * t);
      return `rgb(${rr},${rg},${rb})`;
    };

    const hexToRgba = (hex: string, alpha: number): string => {
      const h = parseInt(hex.slice(1), 16);
      const r = (h >> 16) & 0xff, g = (h >> 8) & 0xff, b = h & 0xff;
      return `rgba(${r},${g},${b},${alpha})`;
    };

    resize();
    window.addEventListener("resize", resize);

    let lastTime = 0;
    const draw = (time: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dt = time - lastTime;
      lastTime = time;

      const tr = transitionRef.current;
      if (tr.progress < 1) {
        tr.progress = Math.min(1, tr.progress + dt / 2000);
      }

      const fromP = COLOR_PALETTES[tr.from];
      const toP = COLOR_PALETTES[tr.to];
      const t = tr.progress;

      const bgColors = [
        lerpColor(fromP.bg[0], toP.bg[0], t),
        lerpColor(fromP.bg[1], toP.bg[1], t),
        lerpColor(fromP.bg[2], toP.bg[2], t),
      ];
      const starColor = lerpColor(fromP.star, toP.star, t);
      const glowColor = lerpColor(fromP.glow, toP.glow, t);
      const accentColor = lerpColor(fromP.accent, toP.accent, t);

      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
      );
      grad.addColorStop(0, bgColors[1]);
      grad.addColorStop(0.5, bgColors[0]);
      grad.addColorStop(1, bgColors[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      starsRef.current.forEach((star) => {
        star.pulse += star.alphaSpeed;
        star.alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(star.pulse));

        const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.radius * 4);
        glow.addColorStop(0, hexToRgba(starColor.startsWith("rgb") ? "#ffffff" : starColor, star.alpha));
        glow.addColorStop(0.4, hexToRgba(glowColor.startsWith("rgb") ? "#8888ff" : glowColor, star.alpha * 0.4));
        glow.addColorStop(1, "rgba(0,0,0,0)");

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
        ctx.fill();
      });

      if (time - lastMeteorTimeRef.current > 800 + Math.random() * 1200) {
        spawnMeteor();
        lastMeteorTimeRef.current = time;
      }

      meteorsRef.current = meteorsRef.current.filter((meteor) => meteor.active);
      meteorsRef.current.forEach((meteor) => {
        meteor.trail.push({ x: meteor.x, y: meteor.y });
        if (meteor.trail.length > 30) meteor.trail.shift();

        meteor.x += Math.cos(meteor.angle) * meteor.speed;
        meteor.y += Math.sin(meteor.angle) * meteor.speed;
        meteor.alpha -= 0.012;

        if (meteor.alpha <= 0 || meteor.y > canvas.height + 50 || meteor.x > canvas.width + 50) {
          meteor.active = false;
          return;
        }

        if (meteor.trail.length > 1) {
          for (let i = 1; i < meteor.trail.length; i++) {
            const segAlpha = (i / meteor.trail.length) * meteor.alpha;
            const segWidth = (i / meteor.trail.length) * 2.5;
            const grad = ctx.createLinearGradient(
              meteor.trail[i - 1].x, meteor.trail[i - 1].y,
              meteor.trail[i].x, meteor.trail[i].y
            );
            grad.addColorStop(0, `rgba(255,255,255,0)`);
            grad.addColorStop(1, `rgba(255,255,255,${segAlpha})`);
            ctx.beginPath();
            ctx.moveTo(meteor.trail[i - 1].x, meteor.trail[i - 1].y);
            ctx.lineTo(meteor.trail[i].x, meteor.trail[i].y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = segWidth;
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }

        const headGrad = ctx.createRadialGradient(meteor.x, meteor.y, 0, meteor.x, meteor.y, 6);
        headGrad.addColorStop(0, `rgba(255,255,255,${meteor.alpha})`);
        headGrad.addColorStop(0.4, `rgba(200,220,255,${meteor.alpha * 0.6})`);
        headGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(meteor.x, meteor.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = headGrad;
        ctx.fill();
      });

      const nebulaGrad = ctx.createRadialGradient(
        canvas.width * 0.7, canvas.height * 0.3, 0,
        canvas.width * 0.7, canvas.height * 0.3, canvas.width * 0.4
      );
      nebulaGrad.addColorStop(0, hexToRgba(accentColor.startsWith("rgb") ? "#8888ff" : accentColor, 0.04));
      nebulaGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = nebulaGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const nebula2 = ctx.createRadialGradient(
        canvas.width * 0.2, canvas.height * 0.7, 0,
        canvas.width * 0.2, canvas.height * 0.7, canvas.width * 0.35
      );
      nebula2.addColorStop(0, hexToRgba(glowColor.startsWith("rgb") ? "#6644ff" : glowColor, 0.05));
      nebula2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
