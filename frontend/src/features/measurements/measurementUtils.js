/**
 * measurementUtils.js — Dynamic measurement calculations (pure, visual-only).
 *
 * Internal units: metres (scene XZ). Display axis labels: X = width, Y = length
 * (maps to scene Z — consistent with roof/obstacle footprint convention).
 *
 * Structured for future unit conversion (e.g. feet) via formatMeasurement().
 */

/** @typedef {{ widthX: number, lengthY: number }} AxisDimensions */

export const MEASUREMENT_UNIT = "m";

/**
 * Format a length value for display.
 *
 * @param {number} metres
 * @param {string} [unit]
 * @returns {string}
 */
export function formatMeasurement(metres, unit = MEASUREMENT_UNIT) {
  if (!Number.isFinite(metres)) return `— ${unit}`;
  return `${metres.toFixed(2)} ${unit}`;
}

/**
 * Axis-aligned bounding box of a scene-XZ ring [[x,z],…].
 *
 * @param {number[][]} ring
 * @returns {AxisDimensions}
 */
export function computeRingAxisDimensions(ring) {
  if (!ring?.length) return { widthX: 0, lengthY: 0 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const pt of ring) {
    const x = pt[0];
    const z = pt[1] ?? pt[2] ?? 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }

  return {
    widthX:  Math.max(0, maxX - minX),
    lengthY: Math.max(0, maxZ - minZ),
  };
}

/**
 * Roof section footprint dimensions from lat/lng coordinates.
 *
 * @param {number[][]} coordinates  [[lat,lng],…]
 * @param {{ lat: number, lng: number }} centre
 * @returns {AxisDimensions}
 */
export function computeRoofSectionDimensions(coordinates, centre) {
  if (!coordinates?.length || !centre) return { widthX: 0, lengthY: 0 };

  const cosLat = Math.cos((centre.lat * Math.PI) / 180);
  const ring = coordinates.map(([lat, lng]) => [
    (lng - centre.lng) * 111_320 * cosLat,
    -(lat - centre.lat) * 111_320,
  ]);

  return computeRingAxisDimensions(ring);
}

/**
 * Obstacle footprint width (X) and length (Y) in metres.
 *
 * @param {{ width: number, length: number, scale?: number }} obstacle
 * @param {number} [liveScale]  optional in-progress scale during gizmo drag
 * @returns {AxisDimensions}
 */
export function computeObstacleDimensions(obstacle, liveScale) {
  const s = liveScale ?? obstacle?.scale ?? 1;
  const w = (obstacle?.width ?? 0) * s;
  const l = (obstacle?.length ?? 0) * s;
  return { widthX: w, lengthY: l };
}

/**
 * Solar panel module footprint dimensions.
 *
 * @param {{ width: number, length: number }} panel
 * @returns {AxisDimensions}
 */
export function computePanelDimensions(panel) {
  return {
    widthX:  panel?.width  ?? 0,
    lengthY: panel?.length ?? 0,
  };
}

/**
 * Centroid of a scene-XZ ring (for label placement).
 *
 * @param {number[][]} ring
 * @returns {{ x: number, z: number }}
 */
export function ringCentroidXZ(ring) {
  if (!ring?.length) return { x: 0, z: 0 };
  let sx = 0;
  let sz = 0;
  for (const pt of ring) {
    sx += pt[0];
    sz += pt[1] ?? pt[2] ?? 0;
  }
  return { x: sx / ring.length, z: sz / ring.length };
}

/**
 * Whether measurements should render for a supported object.
 *
 * @param {boolean} showDimensions  user toggle
 * @param {boolean} isEditing       object is actively being transformed
 * @param {boolean} isSelected      object is selected (toggle-on path)
 */
export function shouldShowMeasurements(showDimensions, isEditing, isSelected) {
  if (isEditing) return true;
  return showDimensions && isSelected;
}
