"use client";

import { useRouter } from "next/navigation";

import { useCampaignStream } from "@/hooks/use-campaign-stream";
import { useClaimedCampaigns } from "@/hooks/use-claimed-campaigns";
import { useEffectiveLocation } from "@/hooks/use-effective-location";
import { DEFAULT_RADIUS_M } from "@/lib/api";
import type { Location } from "@/lib/api-types";
import { LiveDot, type LiveDotState } from "../atoms/LiveDot";
import { CampaignAlertModal } from "./CampaignAlertModal";

/**
 * Default fallback — La Vicentina (Quito). Matches the seed in
 * `deuna-api` so a fresh demo pops the modal for users who deny GPS
 * but still want to see the flow.
 */
const FALLBACK_LOCATION: Location = { lat: -0.2082, lng: -78.4882 };

export type CampaignAlertsProps = {
  /** Override the default fallback (e.g. if a screen already knows
   *  where the user intends to be). */
  fallback?: Location;
  /** Broadcast radius filter used on both /nearby and /stream. */
  radiusM?: number;
  /** Show a small live-connection pill in the corner. Off by default —
   *  it's only useful while debugging the SSE channel; in production
   *  it adds visual noise above the header. */
  showLiveIndicator?: boolean;
};

/**
 * Controller organism. Lives once near the app shell and wires:
 *
 *   useEffectiveLocation → useCampaignStream → CampaignAlertModal
 *
 * No screen needs to know about the alert infra — the modal auto-
 * appears on top of whichever tab the user is on.
 */
export function CampaignAlerts({
  fallback = FALLBACK_LOCATION,
  radiusM = DEFAULT_RADIUS_M,
  showLiveIndicator = false,
}: CampaignAlertsProps = {}) {
  const effective = useEffectiveLocation(fallback, { enabled: true });
  const stream = useCampaignStream({
    enabled: true,
    location: effective.location,
    radiusM,
  });
  const { addClaim } = useClaimedCampaigns();
  const router = useRouter();

  const dotState: LiveDotState = stream.connected
    ? "live"
    : stream.error
      ? "offline"
      : "connecting";

  return (
    <>
      <CampaignAlertModal
        visible={stream.latest != null}
        campaign={stream.latest}
        onDismiss={() => {
          if (stream.latest) stream.dismiss(stream.latest.id);
        }}
        onAccept={(campaign) => {
          // 1) Persist the claim so the misiones view can render it
          //    as a brand-new "Desafío Diario" row.
          addClaim(campaign);
          // 2) Jump straight to the YAPASS 1 / YAPASS 2 frame so the
          //    user sees the freshly-spawned mission. The query param
          //    is consumed by `(tabs)/page.tsx`, which flips
          //    showMisiones=true and then strips the param.
          router.push("/?misiones=1");
        }}
      />
      {showLiveIndicator ? (
        <div className="pointer-events-none fixed left-1/2 top-[max(env(safe-area-inset-top),0.5rem)] z-40 -translate-x-1/2">
          <LiveDot state={dotState} />
        </div>
      ) : null}
    </>
  );
}
