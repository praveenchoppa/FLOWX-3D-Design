/**
 * placementAreaConfig.js — Placement Area subsystem constants (independent of engineering zones).
 */

import { createDefaultPanelProperties } from "../panels/panelConfig.js";

/** Minimum outer-ring area (m²) for an accepted placement area polygon. */
export const MIN_PLACEMENT_AREA_M2 = 1.0;

/** Minimum vertex count on the outer ring. */
export const MIN_OUTER_VERTICES = 3;

/**
 * Outward tolerance (m) for roof containment — matches engineering validation (5 cm).
 */
export const ROOF_CONTAINMENT_TOLERANCE_M = 0.05;

/** Visual styling for rendered placement areas in 3D. */
export const PLACEMENT_AREA_STYLE = {
  color:    "#06B6D4",
  bg:       "rgba(6,182,212,0.22)",
  selected: "#ffffff",
};

/** Minimum distance between consecutive draw clicks (m). */
export const MIN_VERTEX_SPACING_M = 0.25;

/** Distance to first vertex that closes the polygon while drawing (m). */
export const CLOSE_POLYGON_THRESHOLD_M = 0.45;

/** Placement area polygon edit modes. */
export const PLACEMENT_AREA_EDIT_MODES = /** @type {const} */ ({
  MOVE:     "move",
  VERTICES: "vertices",
});

/**
 * Quality bands derived from blended avgScore (display labels for Placement Areas).
 * Distinct from sim zone class thresholds — applied to honest cell averages.
 */
export const PLACEMENT_QUALITY_THRESHOLDS = {
  EXCELLENT_MIN: 90,
  GOOD_MIN:      75,
  AVERAGE_MIN:   55,
};

/**
 * Stable id: pa::<roofId>::<uuid>
 *
 * @param {string} roofId
 * @returns {string}
 */
export function createPlacementAreaId(roofId) {
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `pa::${roofId}::${uuid}`;
}

/**
 * Auto-name: "Area 1", "Area 2", …
 *
 * @param {object[]} existingPlacementAreas
 * @returns {string}
 */
export function autoNamePlacementArea(existingPlacementAreas = []) {
  const count = existingPlacementAreas.filter((a) => !a.deleted).length;
  return `Area ${count + 1}`;
}

/**
 * Factory for a new placement area record.
 *
 * @param {object} params
 * @param {string} params.roofId
 * @param {[number, number][]} params.outerRing
 * @param {string} params.name
 * @returns {object}
 */
export function createPlacementAreaRecord({ roofId, outerRing, name }) {
  return {
    id:              createPlacementAreaId(roofId),
    roofId,
    name,
    polygon:         { outerRing, holes: [] },
    deleted:         false,
    stats:           null,
    panelProperties: createDefaultPanelProperties(),
    generatedLayout: null,
    electrical:      null,
  };
}
