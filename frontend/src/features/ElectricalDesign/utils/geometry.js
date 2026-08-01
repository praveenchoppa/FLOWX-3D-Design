/**
 * geometry.js — Panel position helpers for P5D wiring and Step 7 array rotation.
 *
 * Connection convention (MVP):
 * Panel module center in scene XZ (`panel.center.x`, `panel.center.z`).
 * Segment length = horizontal Euclidean distance between consecutive centers.
 * Visualization Y is lifted slightly above the roof deck for visibility only;
 * length numbers exclude vertical offset (center-to-center horizontal estimate).
 */

const PANEL_DECK_OFFSET_M = 0.14;
export const WIRING_VISUAL_LIFT_M = 0.18;

/**
 * Rotate a point in scene XZ around a pivot (radians).
 *
 * @param {number} x
 * @param {number} z
 * @param {number} angleRad
 * @param {number} pivotX
 * @param {number} pivotZ
 */
export function rotate2D(x, z, angleRad, pivotX, pivotZ) {
  const dx = x - pivotX;
  const dz = z - pivotZ;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: pivotX + dx * cos - dz * sin,
    z: pivotZ + dx * sin + dz * cos,
  };
}

/**
 * @param {object|null} panelLayout
 * @returns {Map<string, object>}
 */
export function buildPlacedPanelBySlotId(panelLayout) {
  const map = new Map();
  for (const panel of panelLayout?.placedPanels ?? []) {
    const slotId = panel.slotId ?? panel.id;
    if (slotId) map.set(slotId, panel);
  }
  return map;
}

/**
 * @param {object[]} roofSections
 * @returns {Record<string, number>}
 */
export function buildDeckYByRoofId(roofSections = []) {
  const deckYMap = {};
  for (const sec of roofSections) {
    deckYMap[sec.id] = (sec.height ?? 3) + PANEL_DECK_OFFSET_M;
  }
  return deckYMap;
}

/**
 * Horizontal center-to-center distance (meters) between two panel records.
 *
 * @param {object} panelA
 * @param {object} panelB
 */
export function horizontalCenterDistanceM(panelA, panelB) {
  return Math.hypot(
    panelB.center.x - panelA.center.x,
    panelB.center.z - panelA.center.z,
  );
}

/**
 * Wiring anchor at panel module center, lifted for canvas visibility.
 *
 * @param {object} panel
 * @param {Record<string, number>} deckYMap
 */
export function panelWiringAnchor(panel, deckYMap) {
  const deckY = deckYMap[panel.roofId] ?? 3.02;
  return {
    x: panel.center.x,
    y: deckY + 0.004 + WIRING_VISUAL_LIFT_M,
    z: panel.center.z,
  };
}
