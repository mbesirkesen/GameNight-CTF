import { useEffect, useRef } from "react";

const GLYPHS = "0123456789ABCDEF<>/\\|$#*%+=";
const LINE1 = "Sanırım uykun geldi";
const LINE2 = "Masanın altını kontrol ettin mi";

function glyph(n) {
  return GLYPHS[((n % GLYPHS.length) + GLYPHS.length) % GLYPHS.length];
}

/**
 * Sadece: yoğun Matrix rain + typewriter yazılar.
 * Yazılardan sonrası video ile devam eder (SponsorTakeover).
 */
export default function MatrixIntro({ className = "", onDone }) {
  const canvasRef = useRef(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return undefined;

    let raf = 0;
    let alive = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const t0 = performance.now();
    doneRef.current = false;

    const cols = 96;
    const perCol = 28;
    const streams = Array.from({ length: cols * perCol }, (_, i) => {
      const col = i % cols;
      const row = (i / cols) | 0;
      return {
        col,
        row,
        speed: 52 + (col % 11) * 14 + (row % 7) * 5,
        seed: col * 131 + row * 17,
      };
    });

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function typedLen(full, start, cps, t) {
      if (t < start) return 0;
      return Math.min(full.length, Math.floor((t - start) * cps));
    }

    function drawLine(text, y, visible, t) {
      if (visible <= 0) return;
      const size = Math.max(18, Math.min(42, w * 0.038));
      ctx.font = `bold ${size}px "Share Tech Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const shown = text.slice(0, visible);
      const blink = Math.floor(t * 2) % 2 === 0;
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#7CFFB2";
      ctx.fillText(shown + (visible < text.length && blink ? "_" : ""), w / 2, y);
      ctx.shadowBlur = 0;
    }

    function draw(now) {
      if (!alive) return;
      const t = (now - t0) / 1000;

      // ~0.3–2.2 satır1 · 2.3–4.8 satır2 · 4.8–5.6 tut · sonra video
      const line1Len = typedLen(LINE1, 0.35, 13, t);
      const line2Len = typedLen(LINE2, 2.4, 12, t);
      const doneAt = 5.6;
      if (t >= doneAt && !doneRef.current) {
        doneRef.current = true;
        onDoneRef.current?.();
      }

      ctx.fillStyle = "#000800";
      ctx.fillRect(0, 0, w, h);

      const fontBg = Math.max(10, Math.floor(w / 110));
      const gapY = h / 40;
      ctx.font = `bold ${fontBg}px "Share Tech Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const s of streams) {
        const x = ((s.col + 0.5) / cols) * w + Math.sin(s.seed + t * 0.7) * 3;
        const head = ((t * s.speed + s.seed) % (h + 28 * gapY)) - 10 * gapY;
        const y = head + s.row * gapY;
        if (y < -30 || y > h + 30) continue;
        const headness = 1 - s.row / perCol;
        const a = s.row === 0 ? 0.95 : 0.38 + headness * 0.45;
        ctx.fillStyle =
          s.row === 0
            ? `rgba(210,255,220,${a})`
            : `rgba(18,230,95,${a})`;
        ctx.fillText(glyph(s.seed + s.row + ((t * 11) | 0)), x, y);
      }

      const bloom = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.08,
        w / 2,
        h / 2,
        Math.min(w, h) * 0.55
      );
      bloom.addColorStop(0, "rgba(0,255,100,0.1)");
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);

      drawLine(LINE1, h * 0.4, line1Len, t);
      drawLine(LINE2, h * 0.48, line2Len, t);

      const vig = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.4,
        w / 2,
        h / 2,
        Math.min(w, h) * 0.9
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-label="Matrix intro"
    />
  );
}
