"use client";

import Image from "next/image";

import { cn } from "@/lib/cn";
import { ProgressBar } from "../atoms/ProgressBar";

export type MissionRowProps = {
  /** Path under /public for the small left-side illustration. */
  iconSrc: string;
  /** Headline copy describing the mission. */
  description: string;
  /** Numerator of the progress meter ("compras hechas", dollars, etc.). */
  progress: number;
  /** Denominator of the progress meter. */
  total: number;
  /**
   * Right-side progress label. Either:
   *   - a single line ("$4/$10")
   *   - or a two-liner like "2/3 / locales"  → pass `unit="locales"`
   */
  unit?: string;
  /** Override the default "{progress}/{total}" label (for $ amounts, %, etc.). */
  progressLabel?: string;
  /** "Más Información" CTA. Opens the corresponding `DesafioModal`. */
  onMoreInfo?: () => void;
  /** Hide the dotted "Más Información" link (used by the daily mission row,
   *  which shows "Ver Ubicación" instead). */
  hideMoreInfo?: boolean;
  /** Optional CTA shown in place of "Más Información". */
  customLink?: { label: string; onPress?: () => void };
};

/**
 * Molecule — single mission row inside a `MissionsCard`.
 *
 * Layout (matches the Figma "YAPASS 1" weekly/daily missions):
 *
 *   [icon]  description ────────── progress
 *           ── progress bar ──     label
 *               Más Información
 *
 * The icon + description + link block is intentionally narrow (≤ ~70%
 * of the row) so that long progress labels like "$4/$10" never wrap.
 */
export function MissionRow({
  iconSrc,
  description,
  progress,
  total,
  unit,
  progressLabel,
  onMoreInfo,
  hideMoreInfo = false,
  customLink,
}: MissionRowProps) {
  const pct = total > 0 ? Math.min(1, progress / total) : 0;
  const label = progressLabel ?? `${progress}/${total}`;

  return (
    <div className="flex items-start gap-3 py-1">
      <div className="relative h-10 w-10 shrink-0">
        <Image
          src={iconSrc}
          alt=""
          fill
          sizes="40px"
          className="object-contain"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[13px] font-medium leading-[16px] text-ink">
          {description}
        </span>
        <ProgressBar
          value={pct}
          fillClassName="bg-success"
          trackClassName="bg-line"
          aria-label={description}
          className="my-0.5"
        />
        {customLink ? (
          <button
            type="button"
            onClick={customLink.onPress}
            className={cn(
              "self-center text-[12px] font-medium leading-4 text-primary underline underline-offset-2 transition-opacity",
              "hover:opacity-80",
            )}
          >
            {customLink.label}
          </button>
        ) : hideMoreInfo ? null : (
          <button
            type="button"
            onClick={onMoreInfo}
            className="self-center text-[12px] font-medium leading-4 text-primary underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            Más Información
          </button>
        )}
      </div>

      <div className="flex w-[58px] shrink-0 flex-col items-center text-center text-[12px] font-medium leading-[14px] text-ink">
        <span>{label}</span>
        {unit ? <span className="text-text-secondary">{unit}</span> : null}
      </div>
    </div>
  );
}
