import { cn } from "@/lib/cn";
import { LevelAmount } from "../atoms/LevelAmount";
import { LevelLabel } from "../atoms/LevelLabel";
import type { StandardLevel, StandardLevelVariant } from "../types";

export type LevelChipProps = Pick<StandardLevel, "amount" | "label"> & {
  variant?: StandardLevelVariant;
  className?: string;
};

/**
 * Every chip shares the exact same shape, border and surface. The only
 * thing that distinguishes a locked level from an unlocked one is a
 * semi-transparent dark scrim painted ON TOP of the chip — as if a
 * shadow were being cast onto its front face. No lock icons.
 */
const SHAPE_BASE =
  "h-[84px] w-[110px] shrink-0 rounded-[var(--radius-md)] border border-divider";

const SURFACE =
  "bg-[linear-gradient(165deg,#FFFFFF_0%,#F4ECEC_55%,#E7D8D8_100%)] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_3px_8px_rgba(75,29,140,0.10)]";

/**
 * Molecule — the standard level chip (110×84). All variants share the
 * same surface; `upcoming` simply receives a dark overlay rendered on
 * top of the contents to read as "shadowed / locked".
 */
export function LevelChip({
  amount,
  label,
  variant = "upcoming",
  className,
}: LevelChipProps) {
  const isLocked = variant === "upcoming";

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 overflow-hidden px-3 py-2",
        SHAPE_BASE,
        SURFACE,
        className,
      )}
    >
      <LevelAmount amount={amount} tone="dark" className="text-primary" />
      <LevelLabel label={label} tone="dark" className="text-primary/80" />

      {isLocked ? (
        // Front-cast shadow: a soft dark scrim that gradually darkens
        // toward the bottom-right, mimicking an object casting a shadow
        // onto the chip's face. Sits above the text but below pointer
        // events of any future CTA inside the chip (none today).
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,rgba(20,15,30,0.18)_0%,rgba(20,15,30,0.42)_60%,rgba(20,15,30,0.55)_100%)]"
        />
      ) : null}
    </div>
  );
}
