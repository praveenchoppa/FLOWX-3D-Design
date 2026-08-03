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
 * Legacy AABB helper — retained for non-overlay callers. Roof CAD dimensions
 * use computeRoofEdgeMeasurements() instead.
 *
 * @param {number[][]} coordinates  [[lat,lng],…]
 * @param {{ lat: number, lng: number }} centre
 * @returns {AxisDimensions}
 */
export function computeRoofSectionDimensions(coordinates, centre) {
  if (!coordinates?.length || !centre) return { widthX: 0, lengthY: 0 };
  return computeRingAxisDimensions(projectRoofCoordinatesToSceneXZ(coordinates, centre));
}

/** Minimum edge length (m) to keep as a measurable roof edge. */
export const ROOF_EDGE_EPSILON_M = 1e-4;

/** Sample distance (m) along candidate normal for point-in-polygon outward check. */
export const ROOF_NORMAL_VERIFY_EPS_M = 0.05;

/**
 * Project roof lat/lng coordinates to scene-XZ metres.
 *
 * @param {number[][]} coordinates  [[lat,lng],…]
 * @param {{ lat: number, lng: number }} centre
 * @returns {number[][]}  [[x,z],…]
 */
export function projectRoofCoordinatesToSceneXZ(coordinates, centre) {
  if (!coordinates?.length || !centre) return [];
  const cosLat = Math.cos((centre.lat * Math.PI) / 180);
  return coordinates.map(([lat, lng]) => [
    (lng - centre.lng) * 111_320 * cosLat,
    -(lat - centre.lat) * 111_320,
  ]);
}

/**
 * Normalize a scene-XZ ring: drop consecutive duplicates and a closing
 * duplicate of the first vertex. Returns an open ring (not explicitly closed).
 *
 * @param {number[][]} ring
 * @param {number} [epsilon]
 * @returns {number[][]}
 */
export function normalizeRoofRing(ring, epsilon = ROOF_EDGE_EPSILON_M) {
  if (!ring?.length) return [];

  /** @type {number[][]} */
  const cleaned = [];
  for (const pt of ring) {
    const x = pt[0];
    const z = pt[1] ?? pt[2] ?? 0;
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const prev = cleaned[cleaned.length - 1];
    if (prev && Math.hypot(x - prev[0], z - prev[1]) < epsilon) continue;
    cleaned.push([x, z]);
  }

  if (cleaned.length >= 2) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < epsilon) {
      cleaned.pop();
    }
  }

  return cleaned;
}

/**
 * Shoelace signed area of an open ring in scene XZ (viewed from +Y).
 * Positive → CCW, negative → CW.
 *
 * @param {number[][]} ring
 * @returns {number}
 */
export function roofRingSignedArea(ring) {
  if (!ring || ring.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[i];
    const [x1, z1] = ring[(i + 1) % ring.length];
    area += x0 * z1 - x1 * z0;
  }
  return area / 2;
}

/**
 * Ray-casting point-in-polygon for a scene-XZ open ring (convex or concave).
 *
 * @param {number} x
 * @param {number} z
 * @param {number[][]} ring
 * @returns {boolean}
 */
export function pointInRoofRing(x, z, ring) {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const zi = ring[i][1];
    const xj = ring[j][0];
    const zj = ring[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Per-edge roof measurements for CAD-aligned dimensions.
 *
 * @param {number[][]} coordinates  [[lat,lng],…]
 * @param {{ lat: number, lng: number }} centre
 * @returns {{
 *   ring: number[][],
 *   winding: 'ccw'|'cw',
 *   signedArea: number,
 *   edges: Array<{
 *     index: number,
 *     start: { x: number, z: number },
 *     end: { x: number, z: number },
 *     lengthM: number,
 *     midpoint: { x: number, z: number },
 *     tangent: { x: number, z: number },
 *     outwardNormal: { x: number, z: number },
 *   }>,
 * } | null}
 */
export function computeRoofEdgeMeasurements(coordinates, centre) {
  const projected = projectRoofCoordinatesToSceneXZ(coordinates, centre);
  const ring = normalizeRoofRing(projected);
  if (ring.length < 3) return null;

  const signedArea = roofRingSignedArea(ring);
  if (!Number.isFinite(signedArea) || Math.abs(signedArea) < 1e-12) return null;

  const winding = signedArea > 0 ? "ccw" : "cw";
  const verifyEps = ROOF_NORMAL_VERIFY_EPS_M;

  /** @type {ReturnType<typeof computeRoofEdgeMeasurements> extends infer R ? NonNullable<R>['edges'] : never} */
  const edges = [];

  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[i];
    const [x1, z1] = ring[(i + 1) % ring.length];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const lengthM = Math.hypot(dx, dz);
    if (lengthM < ROOF_EDGE_EPSILON_M) continue;

    const tangent = { x: dx / lengthM, z: dz / lengthM };
    // 90° CCW in XZ (viewed from +Y): (tx, tz) → (−tz, tx)
    const nLeft = { x: -tangent.z, z: tangent.x };
    // CCW: interior left → outward = −nLeft; CW: interior right → outward = +nLeft
    let outwardNormal = winding === "ccw"
      ? { x: -nLeft.x, z: -nLeft.z }
      : { x: nLeft.x, z: nLeft.z };

    const midpoint = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
    const sampleX = midpoint.x + outwardNormal.x * verifyEps;
    const sampleZ = midpoint.z + outwardNormal.z * verifyEps;
    if (pointInRoofRing(sampleX, sampleZ, ring)) {
      outwardNormal = { x: -outwardNormal.x, z: -outwardNormal.z };
    }

    edges.push({
      index: edges.length,
      start: { x: x0, z: z0 },
      end:   { x: x1, z: z1 },
      lengthM,
      midpoint,
      tangent,
      outwardNormal,
    });
  }

  if (!edges.length) return null;

  return { ring, winding, signedArea, edges };
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
