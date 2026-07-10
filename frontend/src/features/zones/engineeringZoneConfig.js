/**
 * engineeringZoneConfig.js — Step 5 Engineering Zone Editor constants.
 *
 * Shared design-state labels and validation thresholds for engineering
 * polygon editing.  Simulation geometry is never modified here.
 */

/** @typedef {"CLEAN" | "DIRTY"} DesignState */

export const DESIGN_STATE = /** @type {const} */ ({
  CLEAN: "CLEAN",
  DIRTY: "DIRTY",
});

/** Minimum outer-ring area (m²) for an accepted engineering polygon. */
export const MIN_ENGINEERING_AREA_M2 = 1.0;

/** Minimum vertex count on the outer ring. */
export const MIN_OUTER_VERTICES = 3;

/**
 * Outward buffer (m) applied to the roof reference ring before containment check.
 * Absorbs Turf boolean edge noise and sub-centimetre vertex drift near boundaries.
 * Must stay well below placement edge clearance (0.3 m) — tolerance only, not slack.
 */
export const ROOF_CONTAINMENT_TOLERANCE_M = 0.05;

/** Zone polygon edit modes exposed in the 3D toolbar. */
export const ZONE_EDIT_MODES = /** @type {const} */ ({
  MOVE:     "move",
  VERTICES: "vertices",
});
