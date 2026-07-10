/**
 * Geocoding service — Nominatim / OpenStreetMap (temporary free stack).
 *
 * This file is the ONLY place in the codebase that knows about Nominatim.
 * When the project migrates to Google Geocoding / Places API, replace the
 * implementations here; callers are unchanged.
 *
 * Nominatim usage policy:
 *   - Max 1 request/second (enforced by low traffic in development).
 *   - The browser automatically sets User-Agent and Referer, which satisfies
 *     the policy requirement for client-side requests.
 *   - Do not cache results for longer than the tile cache lifetime.
 */

const BASE = "https://nominatim.openstreetmap.org";

const HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en",
};

/**
 * Forward-geocode an address or city string.
 * Returns { address, lat, lng } or null if no result found.
 * Throws on network error.
 */
export async function searchLocation(query) {
  const url = `${BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=0`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);
  const data = await res.json();
  if (!data.length) return null;
  const r = data[0];
  return {
    address: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  };
}

/**
 * Reverse-geocode coordinates to a human-readable address string.
 * Returns the display_name string, or an empty string on failure.
 * Throws on network error.
 */
export async function reverseGeocode(lat, lng) {
  const url = `${BASE}/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);
  const data = await res.json();
  return data.display_name ?? "";
}
