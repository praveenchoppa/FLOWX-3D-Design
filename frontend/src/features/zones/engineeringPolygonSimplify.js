/**
 * engineeringPolygonSimplify.js — Step 6 engineering placement prep (Phase 2).
 *
 * Reduces staircase vertices on engineering polygons destined for placement.
 * Display / simulation / stored zoneEdits are NOT modified — this runs only
 * inside the placementReady pipeline.
 *
 * Algorithm: Turf Douglas–Peucker (simplify) with adaptive tolerance chosen to
 * land in a practical engineering vertex budget while preserving area.
 */

import {
  polygon as turfPolygon,
  simplify as turfSimplify,
  booleanValid,
  kinks,
} from "@turf/turf";

import { shoelaceAreaM2 } from "./placementReady";
import { countPolygonVertices } from "./engineeringRegionMerge";

// ── Tunables (change here only) ───────────────────────────────────────────────

/** Starting Douglas–Peucker tolerance (metres, scene XZ). */
export const SIMPLIFY_TOLERANCE_M = 0.12;

/** Max relative area loss allowed after simplification (fraction). */
export const SIMPLIFY_MAX_AREA_LOSS = 0.02;

/** Target outer-ring vertex count band (engineering corners). */
export const SIMPLIFY_TARGET_OUTER_MIN = 12;
export const SIMPLIFY_TARGET_OUTER_MAX = 32;

// ── Ring helpers ──────────────────────────────────────────────────────────────

function xzToClosedRing(ring) {
  if (!ring?.length) return [];
  const pts = ring.map(([x, z]) => [x, z]);
  const first = pts[0];
  const last  = pts[pts.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) pts.push([first[0], first[1]]);
  return pts;
}

function openRing(closed) {
  if (!closed?.length) return [];
  const pts = closed.map(([x, z]) => [x, z]);
  const first = pts[0];
  const last  = pts[pts.length - 1];
  if (pts.length > 1 && first[0] === last[0] && first[1] === last[1]) {
    return pts.slice(0, -1);
  }
  return pts;
}

function ringAreaWithHoles(outerRing, holes = []) {
  const outerA = shoelaceAreaM2(outerRing);
  const holesA = holes.reduce((s, h) => s + shoelaceAreaM2(h), 0);
  return Math.max(0, outerA - holesA);
}

function turfToPolygon(feature) {
  if (!feature?.geometry || feature.geometry.type !== "Polygon") return null;
  const outerRing = openRing(feature.geometry.coordinates[0]);
  if (outerRing.length < 3) return null;
  const holes = feature.geometry.coordinates
    .slice(1)
    .map(openRing)
    .filter((h) => h.length >= 3);
  return { outerRing, holes };
}

function isValidSimplified(feature) {
  if (!feature?.geometry) return false;
  try {
    if (!booleanValid(feature)) return false;
    const selfKinks = kinks(feature);
    if (selfKinks?.features?.length > 0) return false;
    return true;
  } catch {
    return false;
  }
}

function trySimplify(polygon, tolerance) {
  const outer = xzToClosedRing(polygon.outerRing);
  const holes = (polygon.holes ?? []).map(xzToClosedRing).filter((h) => h.length >= 4);
  const feat  = turfPolygon([outer, ...holes]);
  const simplified = turfSimplify(feat, { tolerance, highQuality: true });
  if (!isValidSimplified(simplified)) return null;
  return turfToPolygon(simplified);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Simplify an engineering polygon for placement input.
 * Falls back to the original if no tolerance satisfies constraints.
 *
 * @param {{ outerRing, holes? }} polygon
 * @returns {{ polygon, verticesBefore, verticesAfter, simplified: boolean }}
 */
export function simplifyEngineeringPolygon(polygon) {
  const verticesBefore = countPolygonVertices(polygon);
  const origArea       = ringAreaWithHoles(polygon.outerRing, polygon.holes);

  if (verticesBefore <= SIMPLIFY_TARGET_OUTER_MAX) {
    return { polygon, verticesBefore, verticesAfter: verticesBefore, simplified: false };
  }

  const tolerances = [
    SIMPLIFY_TOLERANCE_M,
    SIMPLIFY_TOLERANCE_M * 0.75,
    SIMPLIFY_TOLERANCE_M * 1.25,
    SIMPLIFY_TOLERANCE_M * 1.75,
    SIMPLIFY_TOLERANCE_M * 2.25,
    SIMPLIFY_TOLERANCE_M * 0.5,
  ];

  let best = null;
  let bestScore = Infinity;

  for (const tol of tolerances) {
    const candidate = trySimplify(polygon, tol);
    if (!candidate) continue;

    const newArea  = ringAreaWithHoles(candidate.outerRing, candidate.holes);
    const areaLoss = origArea > 0 ? (origArea - newArea) / origArea : 0;
    if (areaLoss > SIMPLIFY_MAX_AREA_LOSS) continue;

    const outerVerts = candidate.outerRing.length;
    if (outerVerts < 3) continue;

    const vertsAfter = countPolygonVertices(candidate);
    const inBand = outerVerts >= SIMPLIFY_TARGET_OUTER_MIN
      && outerVerts <= SIMPLIFY_TARGET_OUTER_MAX;
    const score = inBand
      ? Math.abs(outerVerts - 22)
      : Math.abs(outerVerts - 22) + 50;

    if (score < bestScore) {
      bestScore = score;
      best = { polygon: candidate, verticesAfter: vertsAfter };
    }
  }

  if (best) {
    return {
      polygon:       best.polygon,
      verticesBefore,
      verticesAfter: best.verticesAfter,
      simplified:    true,
    };
  }

  return { polygon, verticesBefore, verticesAfter: verticesBefore, simplified: false };
}

/**
 * Simplify a batch of merged engineering regions; returns stats aggregate.
 *
 * @param {object[]} mergedRegions  output of mergeEngineeringRegionsByClass
 * @returns {{ regions: object[], stats: { verticesBefore, verticesAfter, simplifiedCount } }}
 */
export function simplifyMergedEngineeringRegions(mergedRegions) {
  let verticesBefore = 0;
  let verticesAfter  = 0;
  let simplifiedCount = 0;

  const regions = mergedRegions.map((region) => {
    const result = simplifyEngineeringPolygon(region.polygon);
    verticesBefore += result.verticesBefore;
    verticesAfter  += result.verticesAfter;
    if (result.simplified) simplifiedCount += 1;
    return { ...region, polygon: result.polygon };
  });

  return {
    regions,
    stats: { verticesBefore, verticesAfter, simplifiedCount },
  };
}
