"use client";

import { useEffect, useReducer, useRef } from "react";

import type { Campaign, Location } from "@/lib/api-types";
import { buildStreamUrl, fetchNearbyCampaigns } from "@/lib/api";

const DISMISSED_KEY = "yapass:dismissed-campaigns";

type State = {
  campaigns: Campaign[];
  dismissedIds: Set<string>;
  connected: boolean;
  error: string | null;
};

type Action =
  | { type: "connect" }
  | { type: "disconnect"; error?: string | null }
  | { type: "seed"; campaigns: Campaign[] }
  | { type: "append"; campaign: Campaign }
  | { type: "dismiss"; id: string }
  | { type: "hydrate-dismissed"; ids: string[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "connect":
      return { ...state, connected: true, error: null };
    case "disconnect":
      return { ...state, connected: false, error: action.error ?? null };
    case "seed":
      // Merge instead of replacing so the list survives reconnects
      // (the SSE server will re-send `hello` but not historical
      // campaigns, that's what `/nearby` is for).
      return { ...state, campaigns: dedupe([...action.campaigns, ...state.campaigns]) };
    case "append":
      if (state.campaigns.some((c) => c.id === action.campaign.id)) return state;
      return { ...state, campaigns: [action.campaign, ...state.campaigns] };
    case "dismiss": {
      const next = new Set(state.dismissedIds);
      next.add(action.id);
      return { ...state, dismissedIds: next };
    }
    case "hydrate-dismissed":
      return { ...state, dismissedIds: new Set(action.ids) };
    default:
      return state;
  }
}

function dedupe(list: Campaign[]): Campaign[] {
  const seen = new Set<string>();
  const out: Campaign[] = [];
  for (const c of list) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

function loadDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Private mode / quota — best effort, drop silently.
  }
}

export type UseCampaignStreamOptions = {
  enabled: boolean;
  location: Location | null;
  radiusM?: number;
};

export type UseCampaignStreamResult = {
  campaigns: Campaign[];
  /** Newest non-dismissed campaign, or null. */
  latest: Campaign | null;
  connected: boolean;
  error: string | null;
  dismiss: (id: string) => void;
};

/**
 * Opens a long-lived SSE connection to `deuna-api` and collects live
 * campaign broadcasts. Also hydrates once on mount via `/campaigns/nearby`
 * so an alert that was launched *before* the user opened the tab is
 * still surfaced.
 *
 * Dismissed ids persist in `localStorage` so the modal doesn't keep
 * popping up after a page reload.
 */
export function useCampaignStream({
  enabled,
  location,
  radiusM = 800,
}: UseCampaignStreamOptions): UseCampaignStreamResult {
  const [state, dispatch] = useReducer(reducer, null, () => ({
    campaigns: [],
    dismissedIds: new Set<string>(),
    connected: false,
    error: null,
  }));

  const esRef = useRef<EventSource | null>(null);
  const locationKey = location ? `${location.lat},${location.lng}` : "none";

  // Rehydrate dismissed ids from localStorage once on mount.
  useEffect(() => {
    const ids = loadDismissed();
    if (ids.length > 0) dispatch({ type: "hydrate-dismissed", ids });
  }, []);

  // Persist dismissed ids whenever they change.
  useEffect(() => {
    saveDismissed(state.dismissedIds);
  }, [state.dismissedIds]);

  useEffect(() => {
    if (!enabled) return;
    if (locationKey === "none") return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    // Parse the primitive key back into a `Location` — this keeps the
    // deps list hash-stable (object identity would force a reconnect
    // on every parent render even when coordinates didn't change).
    const [latStr, lngStr] = locationKey.split(",");
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const current: Location = { lat, lng };

    let cancelled = false;

    // Hydrate synchronously-ish (one tick) so we don't miss anything
    // that happened while the tab was closed.
    void fetchNearbyCampaigns(current, radiusM)
      .then((nearby) => {
        if (!cancelled) dispatch({ type: "seed", campaigns: nearby });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "fetch_nearby_failed";
          dispatch({ type: "disconnect", error: message });
        }
      });

    const streamUrl = buildStreamUrl(current, radiusM);
    console.debug("[yapass:sse] opening", streamUrl);
    const es = new EventSource(streamUrl);
    esRef.current = es;

    es.addEventListener("hello", (event) => {
      if (cancelled) return;
      console.debug("[yapass:sse] hello", (event as MessageEvent).data);
      dispatch({ type: "connect" });
    });

    es.addEventListener("campaign", (event) => {
      if (cancelled) return;
      try {
        const data = JSON.parse((event as MessageEvent).data) as Campaign;
        console.debug("[yapass:sse] campaign", data.id, data.title);
        dispatch({ type: "append", campaign: data });
      } catch (err) {
        console.warn("[yapass:sse] bad frame", err);
      }
    });

    es.onerror = (event) => {
      // EventSource reconnects automatically; we just surface the blip
      // in state so the UI can show a connecting indicator.
      console.warn("[yapass:sse] error / reconnecting", event);
      if (!cancelled) dispatch({ type: "disconnect" });
    };

    return () => {
      cancelled = true;
      es.close();
      esRef.current = null;
    };
    // Stringified location key keeps the deps list primitive-only.
  }, [enabled, locationKey, radiusM]);

  const visible = state.campaigns.filter((c) => !state.dismissedIds.has(c.id));
  const latest = visible.length > 0 ? visible[0] : null;

  return {
    campaigns: visible,
    latest,
    connected: state.connected,
    error: state.error,
    dismiss: (id) => dispatch({ type: "dismiss", id }),
  };
}
