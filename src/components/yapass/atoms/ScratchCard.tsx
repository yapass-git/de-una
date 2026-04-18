"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/cn";

export type ScratchCardProps = {
  /** Logical CSS width in px. Canvas is internally scaled by DPR. */
  width?: number;
  /** Logical CSS height in px. */
  height?: number;
  /** Prize / reveal content rendered underneath the foil. */
  children: ReactNode;
  /** Fraction (0→1) of foil that must be scratched before auto-reveal. */
  threshold?: number;
  /** Brush radius in CSS px (half of the stroke width). */
  brushRadius?: number;
  /** Text painted on the foil as a hint ("Rasca aquí"). Erases naturally. */
  hintText?: string;
  /** Foil gradient stops — from top-left → bottom-right. */
  foilColors?: [string, string, string];
  /** Called exactly once when the reveal threshold is crossed. */
  onReveal?: () => void;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_FOIL: [string, string, string] = ["#D8D8DB", "#A8A9AC", "#C6C7CA"];

/**
 * Atom — interactive scratch-to-reveal card.
 *
 * Layout:
 *   ┌─────────────────────────────┐
 *   │  prize content (children)   │  ← absolute, always rendered
 *   │     ┌─────────────────┐     │
 *   │     │  silver foil    │     │  ← canvas on top, erased on drag
 *   │     └─────────────────┘     │
 *   └─────────────────────────────┘
 *
 * Pointer events are unified (mouse + touch + pen). The foil is drawn
 * once on mount and then erased with `globalCompositeOperation = "destination-out"`.
 * After each pointer up we sample the alpha channel to decide whether
 * the `threshold` has been crossed; if so we fade out the canvas and
 * call `onReveal`.
 */
export function ScratchCard({
  width = 260,
  height = 150,
  children,
  threshold = 0.55,
  brushRadius = 22,
  hintText = "Rasca aquí ✨",
  foilColors = DEFAULT_FOIL,
  onReveal,
  className,
  style,
}: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const revealedRef = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const [scratching, setScratching] = useState(false);

  // ── Particle system (foil "dust" that falls when you scratch) ──────────
  type Particle = {
    x: number;
    y: number;
    vx: number; // px / ms
    vy: number; // px / ms
    size: number;
    color: string;
    life: number; // ms remaining
    maxLife: number;
    rotation: number;
    rotationSpeed: number; // rad / ms
  };
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const foilColorsRef = useRef<[string, string, string]>(foilColors);
  foilColorsRef.current = foilColors;

  // The furry-hand cursor PNG (`/assets/mano_raspadita_cursor.png`) is 415×400,
  // which is far above the CSS `cursor:` size limit (~32px on Windows, 128px
  // on most other platforms). Browsers silently fall back to the default
  // cursor in that case, which is why the hand was "missing".
  //
  // We render the hand as a DOM element that follows the pointer instead, so
  // its actual painted size is whatever we choose (HAND_SIZE) regardless of
  // any browser cursor cap. The native cursor is hidden over the foil.
  const HAND_SIZE = 110;
  // Hotspot inside the PNG (golden coin, bottom-left) measured as a fraction
  // of the image so the on-screen "scratch tip" sits exactly where the foil
  // is being erased.
  const HOTSPOT_X_FRAC = 60 / 415;
  const HOTSPOT_Y_FRAC = 360 / 400;
  const handRef = useRef<HTMLDivElement>(null);
  const [handVisible, setHandVisible] = useState(false);

  // Paint the foil once on mount / when dimensions change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Metallic silver foil gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, foilColors[0]);
    grad.addColorStop(0.5, foilColors[1]);
    grad.addColorStop(1, foilColors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Sparkle specks — purely decorative
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 60; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hint text in the center
    if (hintText) {
      ctx.fillStyle = "rgba(30,30,35,0.6)";
      ctx.font = "700 15px system-ui, -apple-system, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(hintText, width / 2, height / 2);
    }

    // Switch mode so subsequent strokes erase pixels
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushRadius * 2;

    revealedRef.current = false;
    setRevealed(false);
  }, [width, height, hintText, foilColors, brushRadius]);

  // Resize the particle overlay canvas in lockstep with the foil canvas.
  useEffect(() => {
    const canvas = particlesCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, [width, height]);

  // Tear down the RAF loop on unmount so we don't leak callbacks.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      particlesRef.current = [];
    };
  }, []);

  /** Run the particle physics + render loop until the array empties. */
  const ensureParticleLoop = useCallback(() => {
    if (rafRef.current != null) return;
    lastFrameRef.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - lastFrameRef.current);
      lastFrameRef.current = now;

      const canvas = particlesCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        rafRef.current = null;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const gravity = 0.0022; // px/ms²
      const drag = 0.0008; // air resistance on horizontal velocity
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0 || p.y > height + 6) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += gravity * dt;
        p.vx *= Math.max(0, 1 - drag * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotationSpeed * dt;

        const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        // Tiny rectangular fleck — looks more like foil shavings than circles
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
      }

      if (particles.length === 0) {
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [width, height]);

  /** Spawn a small burst of foil flecks at (x, y). */
  const spawnParticles = useCallback(
    (x: number, y: number, count: number) => {
      const palette = foilColorsRef.current;
      const particles = particlesRef.current;
      // Cap the live particle count so a long drag can't OOM the loop.
      if (particles.length > 220) return;
      for (let i = 0; i < count; i += 1) {
        const speed = 0.04 + Math.random() * 0.1;
        // Mostly downward (π/2) with ±40° spread
        const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        const life = 550 + Math.random() * 650;
        particles.push({
          x: x + (Math.random() - 0.5) * brushRadius * 0.9,
          y: y + (Math.random() - 0.5) * 4,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.04, // small initial upward "kick"
          size: 1.4 + Math.random() * 2.6,
          color: palette[Math.floor(Math.random() * palette.length)],
          life,
          maxLife: life,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.012,
        });
      }
      ensureParticleLoop();
    },
    [brushRadius, ensureParticleLoop],
  );

  const getPoint = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  /** Translate the floating hand so the "tip" (golden coin) sits at (x, y). */
  const positionHand = useCallback((x: number, y: number) => {
    const el = handRef.current;
    if (!el) return;
    const tx = x - HAND_SIZE * HOTSPOT_X_FRAC;
    const ty = y - HAND_SIZE * HOTSPOT_Y_FRAC;
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  }, [HOTSPOT_X_FRAC, HOTSPOT_Y_FRAC]);

  const drawLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    },
    [],
  );

  /** Sample the alpha channel to compute how much of the foil is gone. */
  const computeRevealedFraction = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Sample every 16th pixel for performance. Alpha is the 4th byte.
    const stride = 16;
    let transparent = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * stride) {
      total += 1;
      if (data[i] === 0) transparent += 1;
    }
    return total === 0 ? 0 : transparent / total;
  }, []);

  const checkReveal = useCallback(() => {
    if (revealedRef.current) return;
    const fraction = computeRevealedFraction();
    if (fraction >= threshold) {
      revealedRef.current = true;
      setRevealed(true);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.transition = "opacity 450ms ease";
        canvas.style.opacity = "0";
        // Disable further pointer events on the canvas
        canvas.style.pointerEvents = "none";
      }
      onReveal?.();
    }
  }, [computeRevealedFraction, onReveal, threshold]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (revealedRef.current) return;
    drawingRef.current = true;
    setScratching(true);
    const p = getPoint(e);
    if (!p) return;
    lastPointRef.current = p;
    positionHand(p.x, p.y);
    setHandVisible(true);
    drawLine(p, { x: p.x + 0.01, y: p.y + 0.01 });
    spawnParticles(p.x, p.y, 5);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers (older Safari) don't support pointer capture on canvas
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (revealedRef.current) return;
    const p = getPoint(e);
    if (!p) return;
    positionHand(p.x, p.y);
    setHandVisible(true);
    if (!drawingRef.current) return;
    const last = lastPointRef.current ?? p;
    drawLine(last, p);
    // Emit particles proportional to the stroke length so fast drags throw
    // off more dust than slow ones (but capped to keep things tidy).
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    const dist = Math.hypot(dx, dy);
    const count = Math.min(8, 1 + Math.floor(dist / 6));
    spawnParticles(p.x, p.y, count);
    lastPointRef.current = p;
  };

  const handlePointerEnter = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (revealedRef.current) return;
    const p = getPoint(e);
    if (!p) return;
    positionHand(p.x, p.y);
    setHandVisible(true);
  };

  const endStroke = () => {
    if (!drawingRef.current) {
      setScratching(false);
      setHandVisible(false);
      return;
    }
    drawingRef.current = false;
    lastPointRef.current = null;
    setScratching(false);
    setHandVisible(false);
    checkReveal();
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-md)] bg-white",
        "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06),0_4px_12px_rgba(75,29,140,0.15)]",
        className,
      )}
      style={{ width, height, ...style }}
    >
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center p-3 text-center transition-transform duration-500 ease-out",
          revealed ? "animate-[yp-prize-pop_450ms_ease-out]" : "",
        )}
      >
        {children}
      </div>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{ cursor: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onPointerCancel={endStroke}
        aria-hidden="true"
      />

      {/* Falling foil dust — sits on top so flecks are visible while scratching.
          pointer-events: none so it never steals interaction from the foil. */}
      <canvas
        ref={particlesCanvasRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      {/* Custom "hand" cursor rendered as a DOM image. The native CSS cursor
          can't be used here because the source PNG (415×400) exceeds every
          browser's cursor size cap, so we follow the pointer manually. */}
      <div
        ref={handRef}
        className={cn(
          "pointer-events-none absolute left-0 top-0 transition-opacity duration-100 ease-out will-change-transform",
          handVisible && !revealed ? "opacity-100" : "opacity-0",
          scratching ? "scale-[0.96]" : "",
        )}
        style={{
          width: HAND_SIZE,
          height: HAND_SIZE,
          backgroundImage: "url('/assets/mano_raspadita_cursor.png')",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          filter: "drop-shadow(0 6px 8px rgba(75,29,140,0.25))",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
