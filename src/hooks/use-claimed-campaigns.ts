"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { Campaign } from "@/lib/api-types";

/**
 * Lightweight, derived snapshot of a `Campaign` once the user has
 * tapped "Quiero mi X% OFF" in the popup. We only persist the fields
 * the daily-mission row needs so old entries stay tiny in
 * localStorage and survive future Campaign shape changes.
 */
export type ClaimedCampaign = {
  id: string;
  businessName: string;
  barrio?: string;
  discountPct: number;
  /** ISO timestamp — used to sort newest first when rendering. */
  claimedAt: string;
};

const STORAGE_KEY = "yapass.claimed-campaigns";

/**
 * Module-level pub/sub so a `addClaim()` from the popup wakes up the
 * misiones view in the same tab. The native `storage` event only
 * fires across tabs, so we layer our own bus on top — same pattern as
 * `use-once-flag.ts`.
 */
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function readSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getServerSnapshot(): string {
  return "[]";
}

function parse(raw: string): ClaimedCampaign[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is ClaimedCampaign =>
        typeof c?.id === "string" &&
        typeof c?.businessName === "string" &&
        typeof c?.discountPct === "number" &&
        typeof c?.claimedAt === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Tracks campaigns the user has accepted from the popup. Mirrors the
 * shape of `useOnceFlag` (snapshot + mutators that notify subscribers)
 * so the misiones view re-renders the moment someone taps "Quiero mi
 * X% OFF" elsewhere in the tree.
 *
 * Returns `{ claimed, addClaim, removeClaim, reset }`. `claimed` is
 * sorted newest-first so the freshly-accepted campaign always
 * surfaces at the top of "Desafíos Diarios".
 */
export function useClaimedCampaigns(): {
  claimed: ClaimedCampaign[];
  addClaim: (campaign: Campaign) => void;
  removeClaim: (id: string) => void;
  reset: () => void;
} {
  const raw = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot);
  const claimed = parse(raw).sort((a, b) =>
    b.claimedAt.localeCompare(a.claimedAt),
  );

  const write = useCallback((next: ClaimedCampaign[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota / private mode — fail open so the UI still updates */
    }
    notify();
  }, []);

  const addClaim = useCallback(
    (campaign: Campaign) => {
      const current = parse(readSnapshot());
      // Idempotent: re-accepting the same campaign just refreshes its
      // timestamp so it bubbles to the top instead of duplicating.
      const filtered = current.filter((c) => c.id !== campaign.id);
      const next: ClaimedCampaign[] = [
        {
          id: campaign.id,
          businessName: campaign.business.name,
          barrio: campaign.business.barrio,
          discountPct: campaign.discountPct,
          claimedAt: new Date().toISOString(),
        },
        ...filtered,
      ];
      write(next);
    },
    [write],
  );

  const removeClaim = useCallback(
    (id: string) => {
      const current = parse(readSnapshot());
      write(current.filter((c) => c.id !== id));
    },
    [write],
  );

  const reset = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    notify();
  }, []);

  return { claimed, addClaim, removeClaim, reset };
}
