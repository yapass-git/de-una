"use client";

import { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Card } from "./Card";

export type MissionsCardProps = {
  /** Section title — "Desafíos Semanales" / "Desafíos Diarios". */
  title: string;
  /** One or more `MissionRow` children. */
  children: ReactNode;
  className?: string;
};

/**
 * Molecule — framed container for a stack of `MissionRow`s. Mirrors the
 * "Desafíos Semanales" / "Desafíos Diarios" panels from the YAPASS Figma.
 *
 * Pure layout: it doesn't know what missions it contains, so daily, weekly,
 * monthly, or sponsored variants all reuse the same surface.
 */
export function MissionsCard({ title, children, className }: MissionsCardProps) {
  return (
    <Card
      variant="elevated"
      padding="lg"
      className={cn("flex flex-col gap-2", className)}
    >
      <span className="text-title-sm text-primary">{title}</span>
      <div className="flex flex-col divide-y divide-line/70">{children}</div>
    </Card>
  );
}
