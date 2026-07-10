/**
 * zonePolygonValidation.js — Step 5 engineering polygon validation.
 *
 * Pure functions — no React, no Three.js.
 * Rejects invalid geometry before it is stored in zoneEdits.
 *
 * Checks:
 *   • Minimum vertex count and area
 *   • Turf topology validity (booleanValid)
 *   • Self-intersections (kinks)
 *   • Containment within roof outer footprint
 *   • Hole validity (count, area, containment)
 */

import {
  polygon as turfPolygon,
  booleanValid,
  booleanWithin,
  kinks,
} from "@turf/turf";

import {
  MIN_ENGINEERING_AREA_M2,
  MIN_OUTER_VERTICES,
  ROOF_CONTAINMENT_TOLERANCE_M,
} from "./engineeringZoneConfig";
import { shoelaceAreaM2 } from "./placementReady";
import { pointInRing } from "./zoneGeometryUtils";

// ── Ring helpers ──────────────────────────────────────────────────────────────

function xzToClosedRing(ring) {
  if (!ring?.length) return [];
  const pts = ring.map(([x, z]) => [x, z]);
  const first = pts[0];
  const last  = pts[pts.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) pts.push([first[0], first[1]]);
  return pts;
}

function ringAreaWithHoles(outerRing, holes = []) {
  const outerA = shoelaceAreaM2(outerRing);
  const holesA = holes.reduce((s, h) => s + shoelaceAreaM2(h), 0);
  return Math.max(0, outerA - holesA);
}

/**
 * Roof outer footprint in scene XZ from lat/lng coordinates.
 * Uses the same flat-earth mapping as RoofView3D / zoneMerge.
 *
 * @param {object} roofSection
 * @param {{ lat: number, lng: number }} centre
 * @returns {[number, number][] | null}  open ring [[x,z],…]
 */
export function getRoofBoundaryRing(roofSection, centre) {
  if (!roofSection?.coordinates?.length || centre?.lat == null) return null;
  const cosLat = Math.cos((centre.lat * Math.PI) / 180);
  return roofSection.coordinates.map(([lat, lng]) => [
    (lng - centre.lng) * 111_320 * cosLat,
    -(lat - centre.lat) * 111_320,
  ]);
}

function polygonToTurf(outerRing, holes = []) {
  const outer = xzToClosedRing(outerRing);
  const holeRings = holes.map(xzToClosedRing).filter((h) => h.length >= 4);
  return turfPolygon([outer, ...holeRings]);
}

/**
 * True when engineeringPoly is inside roofPoly, allowing a small outward buffer on
 * the roof reference for floating-point / Turf boundary precision only.
 *
 * Strategy:
 *   1. Strict Turf booleanWithin (fast path, unchanged behaviour for well-inside polys).
 *   2. If that fails, every outer/hole vertex must lie inside the roof ring OR within
 *      ROOF_CONTAINMENT_TOLERANCE_M of the roof boundary (planar metres).
 *
 * Vertex distance is used instead of Turf buffer() because scene-XZ coordinates are
 * planar metres — Turf buffer assumes geographic features and is unreliable here.
 *
 * @param {import('@turf/helpers').Feature} engineeringPoly
 * @param {import('@turf/helpers').Feature} roofPoly
 * @param {[number,number][]} roofOpenRing
 * @param {[number,number][]} outerRing
 * @param {[number,number][][]} holes
 */
function distPointToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-12) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function distPointToRing(px, pz, ring) {
  let min = Infinity;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % n];
    min = Math.min(min, distPointToSegment(px, pz, ax, az, bx, bz));
  }
  return min;
}

function vertexWithinRoofBoundary(x, z, roofOpenRing, toleranceM) {
  if (pointInRing(x, z, roofOpenRing)) return true;
  if (toleranceM <= 0) return false;
  return distPointToRing(x, z, roofOpenRing) <= toleranceM + 1e-9;
}

function allVerticesWithinRoofBoundary(outerRing, holes, roofOpenRing, toleranceM) {
  for (const [x, z] of outerRing) {
    if (!vertexWithinRoofBoundary(x, z, roofOpenRing, toleranceM)) return false;
  }
  for (const hole of holes) {
    if (!hole) continue;
    for (const [x, z] of hole) {
      if (!vertexWithinRoofBoundary(x, z, roofOpenRing, toleranceM)) return false;
    }
  }
  return true;
}

function isWithinRoofBoundary(engineeringPoly, roofPoly, roofOpenRing, outerRing, holes) {
  if (booleanWithin(engineeringPoly, roofPoly)) return true;
  if (ROOF_CONTAINMENT_TOLERANCE_M <= 0) return false;
  return allVerticesWithinRoofBoundary(
    outerRing,
    holes,
    roofOpenRing,
    ROOF_CONTAINMENT_TOLERANCE_M,
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate an engineering polygon before persisting.
 *
 * @param {{ outerRing: [number,number][], holes?: [number,number][][] }} polygon
 * @param {object | null} roofSection
 * @param {{ lat: number, lng: number }} centre
 * @returns {{ valid: boolean, message: string }}
 */
export function validateEngineeringPolygon(polygon, roofSection, centre) {
  const outerRing = polygon?.outerRing;
  const holes     = polygon?.holes ?? [];

  if (!outerRing || outerRing.length < MIN_OUTER_VERTICES) {
    return { valid: false, message: "Polygon needs at least 3 vertices." };
  }

  const areaM2 = ringAreaWithHoles(outerRing, holes);
  if (areaM2 < MIN_ENGINEERING_AREA_M2) {
    return { valid: false, message: `Polygon too small (min ${MIN_ENGINEERING_AREA_M2} m²).` };
  }

  for (const hole of holes) {
    if (!hole || hole.length < MIN_OUTER_VERTICES) {
      return { valid: false, message: "Invalid hole — needs at least 3 vertices." };
    }
    if (shoelaceAreaM2(hole) < MIN_ENGINEERING_AREA_M2 * 0.25) {
      return { valid: false, message: "Hole is too small." };
    }
  }

  let turfPoly;
  try {
    turfPoly = polygonToTurf(outerRing, holes);
  } catch {
    return { valid: false, message: "Invalid polygon topology." };
  }

  if (!booleanValid(turfPoly)) {
    return { valid: false, message: "Invalid polygon topology." };
  }

  const selfKinks = kinks(turfPoly);
  if (selfKinks?.features?.length > 0) {
    return { valid: false, message: "Polygon self-intersects." };
  }

  const roofRing = getRoofBoundaryRing(roofSection, centre);
  if (roofRing && roofRing.length >= 3) {
    try {
      const roofPoly = turfPolygon([xzToClosedRing(roofRing)]);
      if (!isWithinRoofBoundary(turfPoly, roofPoly, roofRing, outerRing, holes)) {
        return { valid: false, message: "Polygon extends outside the roof boundary." };
      }
    } catch {
      return { valid: false, message: "Polygon extends outside the roof boundary." };
    }
  }

  return { valid: true, message: "" };
}
