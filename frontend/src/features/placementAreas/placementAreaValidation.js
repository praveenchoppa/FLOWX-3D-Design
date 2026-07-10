/**
 * placementAreaValidation.js — Placement Area polygon validation (pure).
 *
 * Reuses the same geometric algorithms as zonePolygonValidation but lives in the
 * Placement Area subsystem — no engineering zone state or config dependencies.
 */

import {
  polygon as turfPolygon,
  booleanValid,
  booleanWithin,
  kinks,
} from "@turf/turf";

import { getRoofBoundaryRing } from "../zones/zonePolygonValidation";
import { shoelaceAreaM2 } from "../zones/placementReady";
import { pointInRing } from "../zones/zoneGeometryUtils";

import {
  MIN_PLACEMENT_AREA_M2,
  MIN_OUTER_VERTICES,
  ROOF_CONTAINMENT_TOLERANCE_M,
} from "./placementAreaConfig";

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

function polygonToTurf(outerRing, holes = []) {
  const outer = xzToClosedRing(outerRing);
  const holeRings = holes.map(xzToClosedRing).filter((h) => h.length >= 4);
  return turfPolygon([outer, ...holeRings]);
}

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

function isWithinRoofBoundary(areaPoly, roofPoly, roofOpenRing, outerRing, holes) {
  if (booleanWithin(areaPoly, roofPoly)) return true;
  if (ROOF_CONTAINMENT_TOLERANCE_M <= 0) return false;
  return allVerticesWithinRoofBoundary(
    outerRing,
    holes,
    roofOpenRing,
    ROOF_CONTAINMENT_TOLERANCE_M,
  );
}

/**
 * Validate a placement area polygon before persisting.
 *
 * @param {{ outerRing: [number,number][], holes?: [number,number][][] }} polygon
 * @param {object | null} roofSection
 * @param {{ lat: number, lng: number }} centre
 * @returns {{ valid: boolean, message: string }}
 */
export function validatePlacementAreaPolygon(polygon, roofSection, centre) {
  const outerRing = polygon?.outerRing;
  const holes     = polygon?.holes ?? [];

  if (!outerRing || outerRing.length < MIN_OUTER_VERTICES) {
    return { valid: false, message: "Polygon needs at least 3 vertices." };
  }

  const areaM2 = ringAreaWithHoles(outerRing, holes);
  if (areaM2 < MIN_PLACEMENT_AREA_M2) {
    return { valid: false, message: `Polygon too small (min ${MIN_PLACEMENT_AREA_M2} m²).` };
  }

  for (const hole of holes) {
    if (!hole || hole.length < MIN_OUTER_VERTICES) {
      return { valid: false, message: "Invalid hole — needs at least 3 vertices." };
    }
    if (shoelaceAreaM2(hole) < MIN_PLACEMENT_AREA_M2 * 0.25) {
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
