"use client";

import Image from "next/image";
import { useEffect } from "react";
import { IoClose } from "react-icons/io5";

import { cn } from "@/lib/cn";
import { Button } from "../atoms/Button";
import { IconButton } from "../atoms/IconButton";

export type DesafioStep = string;

export type DesafioModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Hero image shown at the top (under /public). */
  heroSrc: string;
  /** Green pill above the title — e.g. "Desafío de Compras", "Apoyo Local". */
  category: string;
  /** Bold title — e.g. "3 Locales Diferentes". */
  title: string;
  /** Short paragraph under the title. */
  description: string;
  /** "Vigencia" range — e.g. "Del 1 al 31 de mayo de 2026.". */
  validity: string;
  /** Numbered steps shown under "Cómo acceder a la promoción:". */
  steps: DesafioStep[];
  /** CTA label, defaults to "Volver". */
  ctaLabel?: string;
  /** Triggered after the CTA — defaults to closing the modal. */
  onCta?: () => void;
};

/**
 * Organism — fullscreen "Desafío" detail modal.
 *
 * Composition follows the Figma frames "Desafío Uno / Dos / Tres":
 *   ┌─────────────────────────┐
 *   │  hero image (purple)    │
 *   ├─────────────────────────┤
 *   │  [green pill: category] │
 *   │  Bold title             │
 *   │  Short description.     │
 *   │                         │
 *   │  Vigencia:              │
 *   │  Del X al Y de mes…     │
 *   │                         │
 *   │  Cómo acceder a la …    │
 *   │   1. Step one.          │
 *   │   2. Step two.          │
 *   │   3. Step three.        │
 *   ├─────────────────────────┤
 *   │     [ Volver button ]   │
 *   └─────────────────────────┘
 */
export function DesafioModal({
  visible,
  onClose,
  heroSrc,
  category,
  title,
  description,
  validity,
  steps,
  ctaLabel = "Volver",
  onCta,
}: DesafioModalProps) {
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const handleCta = () => {
    onCta?.();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className={cn(
        "fixed inset-0 z-50 flex items-stretch justify-center",
        "bg-[rgba(17,13,25,0.55)] p-0 sm:p-3",
        "animate-[fadeIn_140ms_ease-out]",
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative flex w-full max-w-[480px] flex-col overflow-hidden",
          "bg-white shadow-[var(--shadow-elevated)]",
          "h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-[var(--radius-lg)]",
          "animate-[yp-expand-in_280ms_ease-out]",
        )}
      >
        <div className="relative h-[280px] w-full shrink-0 bg-primary-dark">
          <Image
            src={heroSrc}
            alt=""
            fill
            sizes="(max-width: 480px) 100vw, 480px"
            className="object-cover"
            priority
          />
          <IconButton
            aria-label="Cerrar"
            onClick={onClose}
            size="sm"
            className="absolute right-3 top-3 z-10 bg-primary-dark/70 backdrop-blur-sm"
            icon={<IoClose className="h-[22px] w-[22px] text-white" />}
          />
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4 pt-4">
          <span className="self-start rounded-md bg-success px-3 py-1 text-[14px] font-medium leading-5 text-white">
            {category}
          </span>

          <h2 className="text-title-md leading-7 text-ink">{title}</h2>

          <p className="text-[13px] leading-[18px] text-ink">{description}</p>

          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-ink">Vigencia:</span>
            <span className="text-[13px] leading-[18px] text-ink">{validity}</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink">
              Cómo acceder a la promoción:
            </span>
            <ol className="flex flex-col gap-2 pl-4">
              {steps.map((step, idx) => (
                <li
                  key={idx}
                  className="text-[13px] leading-[18px] text-ink"
                >
                  <span className="font-semibold">{idx + 1}.</span> {step}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="border-t border-divider px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <Button label={ctaLabel} onClick={handleCta} size="lg" />
        </div>
      </div>
    </div>
  );
}
