import type { Campaign, Location } from "./api-types";

/**
 * Base URL of the realtime backend. Resolved at build time via the
 * `NEXT_PUBLIC_API_URL` env var. Falls back to the deployed Fly.io
 * URL so `npm run dev` works out of the box; override to
 * `http://localhost:4000` in `.env.local` when testing a local API.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://deuna-api-marcado993.fly.dev";

/**
 * Default geofence radius for both the hydration and live-stream calls.
 * MVP deliberately picks a generous value (50 km ≈ whole Quito metro
 * area) so the demo works regardless of where the tester physically
 * sits relative to the seeded business in La Vicentina.
 */
export const DEFAULT_RADIUS_M = 50_000;

/**
 * One-shot poll used to hydrate the UI on mount, so an alert that was
 * created *before* the user opened the app still surfaces. The SSE
 * stream takes care of live deltas afterwards.
 */
export async function fetchNearbyCampaigns(
  location: Location,
  radiusM = DEFAULT_RADIUS_M,
): Promise<Campaign[]> {
  const url = new URL(`${API_BASE}/campaigns/nearby`);
  url.searchParams.set("lat", String(location.lat));
  url.searchParams.set("lng", String(location.lng));
  url.searchParams.set("radiusM", String(radiusM));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`nearby_${res.status}`);
  const { campaigns } = (await res.json()) as { campaigns: Campaign[] };
  return campaigns;
}

export function buildStreamUrl(
  location: Location,
  radiusM = DEFAULT_RADIUS_M,
): string {
  const url = new URL(`${API_BASE}/campaigns/stream`);
  url.searchParams.set("lat", String(location.lat));
  url.searchParams.set("lng", String(location.lng));
  url.searchParams.set("radiusM", String(radiusM));
  return url.toString();
}
