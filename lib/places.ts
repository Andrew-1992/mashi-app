import type { LatLng } from "./geo";

export type Place = { label: string; detail?: string; lat: number; lng: number };

// OpenStreetMap place search. Fine for testing and early launch; move to a paid
// geocoder or your own server before heavy traffic (limit: about 1 request per second).
const NOMINATIM = "https://nominatim.openstreetmap.org";
const JUBA_BOX = "31.40,5.00,31.75,4.70"; // west,north,east,south

type NominatimResult = {
  place_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
};

function areaOf(a: Record<string, string> = {}) {
  return a.suburb || a.neighbourhood || a.quarter || a.village || a.city_district || "";
}

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const url =
    `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=8&accept-language=en` +
    `&countrycodes=ss&viewbox=${JUBA_BOX}&bounded=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Place search isn't available right now. Choose the place on the map.");
  const data = (await res.json()) as NominatimResult[];
  return data.map((r) => {
    const label = r.name || r.display_name.split(",")[0];
    const detail = [r.address?.road, areaOf(r.address)].filter((x) => x && x !== label).join(", ");
    return { label, detail: detail || "Juba", lat: Number(r.lat), lng: Number(r.lon) };
  });
}

export async function reverseLabel(p: LatLng, signal?: AbortSignal): Promise<string> {
  try {
    const res = await fetch(
      `${NOMINATIM}/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=en&lat=${p.lat}&lon=${p.lng}`,
      { signal },
    );
    if (!res.ok) return "Pinned location";
    const r = (await res.json()) as NominatimResult;
    const a = r.address ?? {};
    const main = r.name || a.amenity || a.shop || a.building || a.road;
    return [main, areaOf(a)].filter(Boolean).join(", ") || "Pinned location";
  } catch {
    return "Pinned location";
  }
}

// Home and Work are kept on the phone, per account.
export type SavedPlaces = { home?: Place; work?: Place };

export function loadSaved(userId: string): SavedPlaces {
  try {
    return JSON.parse(localStorage.getItem(`mashi:saved:${userId}`) || "{}") as SavedPlaces;
  } catch {
    return {};
  }
}

export function storeSaved(userId: string, saved: SavedPlaces) {
  try {
    localStorage.setItem(`mashi:saved:${userId}`, JSON.stringify(saved));
  } catch {
    /* storage unavailable: saved places just won't persist */
  }
}

/** Minutes for a driver to cover a road distance in Juba traffic (~20 km/h), at least 1. */
export function etaMinutes(km: number) {
  return Math.max(1, Math.round((km / 20) * 60));
}
