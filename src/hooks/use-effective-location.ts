"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { Location } from "@/lib/api-types";
import { useGeolocation } from "./use-geolocation";

type EffectiveLocationResult = {
  location: Location;
  source: "mock" | "demo" | "gps" | "fallback";
  gpsStatus: ReturnType<typeof useGeolocation>["status"];
  refresh: () => void;
};

const DEMO_LOCATION_KEY = "yapass:demo-location-started-at";
const DEMO_LOCATION_WINDOW_MS = 30 * 60_000; // 30 minutes
// USFQ Cumbayá (approx) — used only for the temporary demo window.
const USFQ_CUMBAYA: Location = { lat: -0.1979, lng: -78.4362 };

function demoLocationActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DEMO_LOCATION_KEY);
    const startedAt = raw ? Number(raw) : NaN;
    const now = Date.now();
    if (!Number.isFinite(startedAt)) {
      window.localStorage.setItem(DEMO_LOCATION_KEY, String(now));
      return true;
    }
    if (now - startedAt <= DEMO_LOCATION_WINDOW_MS) return true;
    window.localStorage.removeItem(DEMO_LOCATION_KEY);
    return false;
  } catch {
    // If localStorage is blocked, keep normal behavior.
    return false;
  }
}

/**
 * Resolves the "current user" location combining (in order):
 *   1. `?mock=lat,lng` — demo escape hatch, wins if present.
 *   2. Demo override (30 min) — forces USFQ Cumbayá coordinates.
 *   2. Real browser geolocation.
 *   3. `fallback` — keeps the UI usable before GPS resolves.
 */
export function useEffectiveLocation(
  fallback: Location,
  options: { enabled?: boolean; watch?: boolean } = {},
): EffectiveLocationResult {
  const { enabled = true, watch = false } = options;
  const params = useSearchParams();

  const mockParam = params.get("mock");
  const mockLocation = useMemo<Location | null>(() => {
    if (!mockParam) return null;
    const [latStr, lngStr] = mockParam.split(",");
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [mockParam]);

  const demoActive = useMemo(() => !mockLocation && demoLocationActive(), [mockLocation]);

  const geo = useGeolocation({
    enabled: enabled && !mockLocation && !demoActive,
    watch,
  });

  if (mockLocation) {
    return {
      location: mockLocation,
      source: "mock",
      gpsStatus: "idle",
      refresh: () => {},
    };
  }

  if (demoActive) {
    return {
      location: USFQ_CUMBAYA,
      source: "demo",
      gpsStatus: "idle",
      refresh: () => {},
    };
  }

  if (geo.position) {
    return {
      location: geo.position,
      source: "gps",
      gpsStatus: geo.status,
      refresh: geo.refresh,
    };
  }

  return {
    location: fallback,
    source: "fallback",
    gpsStatus: geo.status,
    refresh: geo.refresh,
  };
}
