/**
 * zoneGeometryUtils.js — shared scene-XZ polygon containment helpers.
 *
 * Ray-casting point-in-polygon — same algorithm as panelPlacement.js pointInRing().
 * Used by the engineering zone resampler (Update Design Step 0).
 */

/**
 * Ray-casting point-in-polygon for a single open ring [[x,z],…].
 * Valid for convex and concave polygons.
 *
 * @param {number} x
 * @param {number} z
 * @param {[number, number][]} ring
 * @returns {boolean}
 */
export function pointInRing(x, z, ring) {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (
      (zi > z) !== (zj > z) &&
      x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * True when (x,z) is inside outerRing and outside all holes.
 *
 * @param {number} x
 * @param {number} z
 * @param {{ outerRing: [number,number][], holes?: [number,number][][] }} polygon
 * @returns {boolean}
 */
export function pointInZonePolygon(x, z, polygon) {
  const { outerRing, holes = [] } = polygon ?? {};
  if (!pointInRing(x, z, outerRing)) return false;
  for (const hole of holes) {
    if (hole?.length >= 3 && pointInRing(x, z, hole)) return false;
  }
  return true;
}
