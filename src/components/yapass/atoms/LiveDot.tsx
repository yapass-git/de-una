import { cn } from "@/lib/cn";

export type LiveDotState = "live" | "connecting" | "offline";

export type LiveDotProps = {
  state: LiveDotState;
  label?: string;
  className?: string;
};

const toneMap: Record<LiveDotState, { dot: string; text: string }> = {
  live: {
    dot: "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)] animate-pulse",
    text: "text-emerald-700",
  },
  connecting: {
    dot: "bg-amber-500 animate-pulse",
    text: "text-amber-700",
  },
  offline: {
    dot: "bg-rose-500",
    text: "text-rose-700",
  },
};

const defaultLabel: Record<LiveDotState, string> = {
  live: "En vivo",
  connecting: "Conectando…",
  offline: "Sin conexión",
};

/**
 * Atom — tiny status pill used to visualize realtime connectivity
 * (e.g. the SSE campaign stream). Subtle by default so it can float in
 * a corner without being noisy, but legible enough to debug at a glance.
 */
export function LiveDot({ state, label, className }: LiveDotProps) {
  const tone = toneMap[state];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] shadow-[0_2px_6px_rgba(0,0,0,0.08)] backdrop-blur",
        tone.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden />
      {label ?? defaultLabel[state]}
    </span>
  );
}
