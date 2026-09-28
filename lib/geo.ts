import type { FareSetting } from "./types";

export type LatLng = { lat: number; lng: number };

/** Juba town centre. */
export const JUBA: [number, number] = [4.8594, 31.5713];

const ROAD_FACTOR = 1.3;

/** Straight-line distance × 1.3. Must match road_distance_km() in schema.sql. */
export function roadKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const km = 6371 * 2 * Math.asin(Math.sqrt(h)) * ROAD_FACTOR;
  return Math.round(km * 100) / 100;
}

/** Same formula as request_ride() in schema.sql. The server price is final. */
export function estimateFare(km: number, s: FareSetting): number {
  return Math.max(s.minimum_fare, Math.round((s.base_fare + s.per_km * km) / 100) * 100);
}
