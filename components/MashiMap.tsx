"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { JUBA } from "@/lib/geo";

export type PinKind = "pickup" | "dropoff" | "driver" | "me";
export type Pin = { kind: PinKind; lat: number; lng: number; pulse?: boolean; icon?: string };

type Props = {
  pins: Pin[];
  onPick?: (lat: number, lng: number) => void;
  /** Change this value to re-frame the map around the pins. */
  fitKey?: string;
  /** Show a fixed pin in the middle; the rider drags the map under it. */
  centerMode?: boolean;
  onCenter?: (lat: number, lng: number) => void;
  /** Move the map to a point whenever `key` changes. */
  focus?: { lat: number; lng: number; key: string; zoom?: number };
};

function pinHtml(p: Pin) {
  if (p.kind === "driver") return `<div class="mashi-vehicle">${p.icon ?? "🏍️"}</div>`;
  return `<div class="mashi-pin mashi-pin--${p.kind}${p.pulse ? " mashi-pin--pulse" : ""}"></div>`;
}

export default function MashiMap({ pins, onPick, fitKey, centerMode, onCenter, focus }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  const onCenterRef = useRef(onCenter);
  const pinsRef = useRef(pins);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    onPickRef.current = onPick;
    onCenterRef.current = onCenter;
    pinsRef.current = pins;
  });

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { zoomControl: false }).setView(JUBA, 14);
    // OpenStreetMap tiles are fine for testing. Switch to a paid tile provider before a public launch.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
    map.on("movestart", () => setMoving(true));
    map.on("moveend", () => {
      setMoving(false);
      const c = map.getCenter();
      onCenterRef.current?.(c.lat, c.lng);
    });
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    const pickup = pins.find((p) => p.kind === "pickup");
    const dropoff = pins.find((p) => p.kind === "dropoff");
    if (pickup && dropoff) {
      L.polyline(
        [
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ],
        { color: "#1B2A41", weight: 4, opacity: 0.85, dashArray: "2 9", lineCap: "round" },
      ).addTo(layer);
    }
    for (const p of pins) {
      const size = p.kind === "driver" ? 38 : 26;
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: "", html: pinHtml(p), iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: p.kind === "driver" ? 1000 : 0,
      }).addTo(layer);
    }
  }, [pins]);

  useEffect(() => {
    const map = mapRef.current;
    const current = pinsRef.current;
    if (!map || !fitKey || current.length === 0) return;
    if (current.length === 1) {
      map.setView([current[0].lat, current[0].lng], Math.max(map.getZoom(), 15));
    } else {
      map.fitBounds(L.latLngBounds(current.map((p) => [p.lat, p.lng] as [number, number])), {
        paddingTopLeft: [40, 90],
        paddingBottomRight: [40, 380],
        maxZoom: 16,
      });
    }
  }, [fitKey]);

  const focusKey = focus?.key;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.setView([focus.lat, focus.lng], focus.zoom ?? 17);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  return (
    <>
      <div ref={container} className="absolute inset-0 z-0" role="application" aria-label="Map of Juba" />
      {centerMode && (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center" aria-hidden="true">
          {/* Shift up by half its height so the tip of the stem sits exactly on the map centre. */}
          <div className="-translate-y-1/2">
            <div className="mashi-center-pin flex flex-col items-center" data-moving={moving}>
              <div className="flex size-11 items-center justify-center rounded-full border-4 border-white bg-ink shadow-lg">
                <div className="size-3 rounded-full bg-vest" />
              </div>
              <div className="h-5 w-1 rounded-b bg-ink" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
