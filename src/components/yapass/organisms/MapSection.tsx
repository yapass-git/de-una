"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { AddLayerObject, StyleSpecification } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoNavigateOutline, IoStorefront } from "react-icons/io5";
import {
  AttributionControl,
  Map as MapGL,
  type MapRef,
  Marker,
  NavigationControl,
  Popup,
} from "react-map-gl/maplibre";

import { cn } from "@/lib/cn";

export type MapLocal = {
  id: string;
  title: string;
  desc: string;
  lat: number;
  lng: number;
};

export type MapSectionProps = {
  center: { lat: number; lng: number };
  locales: MapLocal[];
  zoom?: number;
  height?: number | string;
  onSelectLocal?: (local: MapLocal) => void;
  /**
   * When provided, renders a pulsing teal "you are here" marker on top of
   * the basemap. Typically fed by the `useGeolocation` hook.
   */
  userLocation?: { lat: number; lng: number } | null;
  /**
   * Path under `/public` to use as the user-location avatar. When set, the
   * default teal pulse-dot is replaced by the image inside a circular badge
   * (still wrapped by the soft pulse ring). Defaults to the YaPass mascot.
   */
  userAvatarSrc?: string;
};

/**
 * Base map style. OpenFreeMap's Positron is a free, production-safe
 * vector style (no API key) with a minimalist white/beige palette.
 */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

/** Tilted initial view so the basemap feels 3D instead of flat. */
const MAP_PITCH = 35;
const MAP_BEARING = -10;

/**
 * Organism — interactive MapLibre map rendered with `react-map-gl`.
 * Custom YaPass-branded pins + 3D building extrusions + gentle tilt.
 */
export function MapSection({
  center,
  locales,
  zoom = 16.2,
  height = 380,
  onSelectLocal,
  userLocation,
  userAvatarSrc = "/assets/position.png",
}: MapSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => locales.find((l) => l.id === selectedId) ?? null,
    [locales, selectedId],
  );

  const mapRef = useRef<MapRef | null>(null);

  /** Re-center the map when `center` changes (typically when GPS resolves).
   *  Uses `flyTo` for a smooth camera transition and skips the animation
   *  on first render when the map is already at the target. */
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const cur = map.getCenter();
    const delta = Math.hypot(cur.lat - center.lat, cur.lng - center.lng);
    if (delta < 1e-5) return;
    map.flyTo({
      center: [center.lng, center.lat],
      duration: 900,
      essential: true,
    });
  }, [center.lat, center.lng]);

  /** On first load, inject a 3D building extrusion layer. */
  const handleLoad = useCallback((event: { target: ReturnType<MapRef["getMap"]> }) => {
    const map = event.target;
    if (map.getLayer("yp-3d-buildings")) return;

    const style = map.getStyle() as StyleSpecification;
    const firstSymbol = style.layers?.find((l) => l.type === "symbol")?.id;

    const layer: AddLayerObject = {
      id: "yp-3d-buildings",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "render_height"],
          0,
          "#F3EEF8",
          25,
          "#E9DFF3",
          80,
          "#D9C9EC",
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          14.5,
          ["coalesce", ["get", "render_height"], 0],
        ],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.85,
      },
    };

    try {
      map.addLayer(layer, firstSymbol);
    } catch {
      // Source/layer schema differs → silently skip 3D buildings.
    }
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--radius-md)] bg-[#F6F3FA]"
      style={{ height }}
    >
      <MapGL
        ref={mapRef}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom,
          pitch: MAP_PITCH,
          bearing: MAP_BEARING,
        }}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        dragRotate={false}
        touchPitch={false}
        maxPitch={60}
        maxZoom={19}
        minZoom={13}
        style={{ width: "100%", height: "100%" }}
        onClick={() => setSelectedId(null)}
        onLoad={handleLoad}
      >
        <NavigationControl
          position="top-right"
          showCompass={false}
          visualizePitch={false}
        />
        <AttributionControl
          position="bottom-right"
          compact
          customAttribution="© YaPass"
        />

        {userLocation ? (
          <Marker
            longitude={userLocation.lng}
            latitude={userLocation.lat}
            anchor="center"
          >
            <div
              className="relative flex h-12 w-12 items-center justify-center"
              aria-label="Tu ubicación"
            >
              <span className="absolute h-12 w-12 animate-ping rounded-full bg-primary/25" />
              <span
                className="relative h-11 w-11 overflow-hidden rounded-full bg-white ring-[3px] ring-white shadow-[0_2px_8px_rgba(75,29,140,0.45)]"
                style={{
                  backgroundImage: `url('${userAvatarSrc}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            </div>
          </Marker>
        ) : null}

        {locales.map((local) => {
          const isActive = local.id === selectedId;
          return (
            <Marker
              key={local.id}
              longitude={local.lng}
              latitude={local.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedId(local.id);
              }}
            >
              <button
                type="button"
                aria-label={local.title}
                aria-pressed={isActive}
                className={cn(
                  "group yp-pin relative flex cursor-pointer items-center justify-center",
                  isActive && "yp-pin--active",
                )}
              >
                {isActive ? <span className="yp-pin__pulse" aria-hidden="true" /> : null}
                <span className="yp-pin__chip">
                  <IoStorefront className="h-4 w-4 text-white drop-shadow-sm" />
                </span>
                <span className="yp-pin__tail" aria-hidden="true" />
              </button>
            </Marker>
          );
        })}

        {selected ? (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="bottom"
            offset={42}
            closeOnClick={false}
            closeButton={false}
            onClose={() => setSelectedId(null)}
            className="yp-popup"
          >
            <div className="flex flex-col gap-2 p-1">
              <div>
                <div className="text-title-sm text-primary">{selected.title}</div>
                <div className="text-body-sm">{selected.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => onSelectLocal?.(selected)}
                className="flex items-center justify-center gap-1.5 self-start rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold text-white transition-opacity active:opacity-80 cursor-pointer"
              >
                <IoNavigateOutline className="h-3.5 w-3.5" />
                Ver local
              </button>
            </div>
          </Popup>
        ) : null}
      </MapGL>

      {/* Branded vignette: soft purple haze at the top/bottom edges */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[var(--color-primary-softer)]/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--color-primary-softer)]/70 to-transparent" />
    </div>
  );
}
