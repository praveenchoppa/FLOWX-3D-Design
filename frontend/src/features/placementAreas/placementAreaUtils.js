/**
 * placementAreaUtils.js — Placement Area geometry helpers (pure, no engineering zone deps).
 */

/** Deep-clone a placement area polygon ({ outerRing, holes }). */
export function clonePlacementAreaPolygon(polygon) {
  if (!polygon) return { outerRing: [], holes: [] };
  return {
    outerRing: (polygon.outerRing ?? []).map(([x, z]) => [x, z]),
    holes:     (polygon.holes ?? []).map((h) => h.map(([x, z]) => [x, z])),
  };
}

/** Active non-deleted placement areas. */
export function activePlacementAreas(placementAreas = []) {
  return placementAreas.filter((a) => !a.deleted);
}
