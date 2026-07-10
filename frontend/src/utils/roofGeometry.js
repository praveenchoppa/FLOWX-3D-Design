/**
 * roofGeometry.js — shared geometry utilities for roof sections.
 *
 * All functions handle the Leaflet ↔ turf coordinate swap internally.
 * PROJECT_CONTEXT locked decision: Leaflet gives [lat, lng]; turf / GeoJSON
 * expects [lng, lat]. ALWAYS swap inside these functions — callers use whatever
 * coordinate representation they already have.
 */
import {
  polygon as turfPolygon,
  area    as turfArea,
  buffer  as turfBuffer,
} from "@turf/turf";

/**
 * Compute area (m²) from an array of Leaflet LatLng objects.
 * Used by GeomanDrawing on pm:create / pm:edit events.
 */
export function computeArea(latLngs) {
  if (!latLngs || latLngs.length < 3) return 0;
  const coords = latLngs.map((ll) => [ll.lng, ll.lat]); // swap: Leaflet → GeoJSON
  coords.push(coords[0]); // close ring
  try {
    return turfArea(turfPolygon([coords]));
  } catch {
    return 0;
  }
}

/**
 * Compute usable area (m²) by shrinking the boundary inward by `setback`
 * metres on all sides (uniform negative buffer).
 *
 * @param {Array<[number, number]>} coordinates - Stored as [[lat, lng], …]
 * @param {number} setback - Inward buffer distance in metres (≥ 0)
 */
export function computeUsableArea(coordinates, setback) {
  if (!coordinates || coordinates.length < 3) return 0;
  const coords = coordinates.map(([lat, lng]) => [lng, lat]); // swap: stored → GeoJSON
  coords.push(coords[0]); // close ring
  try {
    const poly = turfPolygon([coords]);
    if (setback <= 0) return turfArea(poly);
    const shrunk = turfBuffer(poly, -setback, { units: "meters" });
    // Buffer can return null/empty if setback exceeds polygon size
    if (!shrunk?.geometry?.coordinates?.length) return 0;
    return turfArea(shrunk);
  } catch {
    return 0;
  }
}
