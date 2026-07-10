/**
 * roofGeometry3d.js
 *
 * Also exports insetPolygon() for parapet geometry.
 *
 * Original file header below ↓
 *
 * Pure utilities for converting roof section data into Three.js-ready
 * coordinates and rotation values.
 *
 * Coordinate convention used throughout:
 *   X = East  (metres from design centre, positive = east)
 *   Y = Up    (metres, positive = up)
 *   Z = South (metres from design centre, positive = south, negative = north)
 *
 * THREE.Shape is defined in its own XY plane.  A parent group with
 * rotation=[-π/2, 0, 0] lays it flat so that:
 *   shape (x_s, y_s, 0) → world (x_s, 0, −y_s)
 *
 * Therefore we define shape points as:
 *   x_s = east metres   (positive = east)
 *   y_s = north metres  (positive = north)
 * so that after rotation the world Z = −y_s = south metres. ✓
 */

import * as THREE from "three";

// ── Design centre ─────────────────────────────────────────────────────────────

/**
 * Centroid of every vertex across all roof sections.
 * Used as the 3D scene origin to keep coordinates numerically stable.
 *
 * @param {Array<{coordinates: Array<[number,number]>}>} roofSections
 * @returns {{ lat: number, lng: number }}
 */
export function computeDesignCenter(roofSections) {
  const all = roofSections.flatMap((s) => s.coordinates);
  if (!all.length) return { lat: 0, lng: 0 };
  return {
    lat: all.reduce((s, [la]) => s + la, 0) / all.length,
    lng: all.reduce((s, [, lo]) => s + lo, 0) / all.length,
  };
}

// ── Lat/lng → shape XY ────────────────────────────────────────────────────────

/**
 * Convert a section's [lat, lng] coordinates to shape-space XY relative to
 * the design centre, and return the shape centroid for pivot-centering.
 *
 * Flat-earth approximation; accurate to < 1 % for building-scale distances.
 *
 * @param {Array<[number,number]>} coordinates  [[lat,lng], …]
 * @param {{ lat: number, lng: number }}        centre
 * @returns {{ pts: Array<[number,number]>, cx: number, cy: number }}
 *   pts – shape-space [x_s, y_s] points
 *   cx/cy – centroid of pts (used to centre the shape at the pivot)
 */
export function sectionToLocal(coordinates, centre) {
  const cosLat = Math.cos((centre.lat * Math.PI) / 180);

  const pts = coordinates.map(([lat, lng]) => [
    (lng - centre.lng) * 111_320 * cosLat, // east  → x_s
    (lat - centre.lat) * 111_320,           // north → y_s
  ]);

  const n  = pts.length;
  const cx = pts.reduce((s, [x]) => s + x, 0) / n;
  const cy = pts.reduce((s, [, y]) => s + y, 0) / n;

  return { pts, cx, cy };
}

// ── Roof rotation ─────────────────────────────────────────────────────────────

// ── Polygon inset (parapet inner face) ───────────────────────────────────────

/**
 * Inset a polygon inward by `d` metres using proper edge-normal offsetting.
 *
 * Algorithm:
 *   1. For each edge, compute the inward-facing unit normal.
 *      "Inward" is determined by checking which side the centroid is on.
 *   2. Translate each edge inward by `d` along its normal.
 *   3. Find the intersection of each pair of adjacent translated edges →
 *      these intersections are the inset polygon vertices.
 *
 * Works correctly for convex polygons and well-behaved concave ones (typical
 * building footprints).  Returns the same-length array as input.
 *
 * @param {Array<[number,number]>} pts   Polygon vertices in shape-space [x,y]
 * @param {number}                 d     Inset distance in metres (> 0 = inward)
 * @returns {Array<[number,number]>}     Inset polygon vertices
 */
export function insetPolygon(pts, d) {
  const n = pts.length;
  if (n < 3) return pts;

  // Centroid for inward-direction test
  const cx = pts.reduce((s, [x]) => s + x, 0) / n;
  const cy = pts.reduce((s, [, y]) => s + y, 0) / n;

  // Shift each edge inward
  const shifted = pts.map((p, i) => {
    const q      = pts[(i + 1) % n];
    const edgeDx = q[0] - p[0];
    const edgeDy = q[1] - p[1];
    const len    = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
    if (len < 1e-10) return { x1: p[0], y1: p[1], x2: q[0], y2: q[1] };

    // The two perpendicular unit normals of this edge
    const nx1 =  edgeDy / len,  ny1 = -edgeDx / len;
    const nx2 = -edgeDy / len,  ny2 =  edgeDx / len;

    // Choose the normal pointing toward the centroid (= inward)
    const midX = (p[0] + q[0]) / 2;
    const midY = (p[1] + q[1]) / 2;
    const dot1 = nx1 * (cx - midX) + ny1 * (cy - midY);
    const [nx, ny] = dot1 >= 0 ? [nx1, ny1] : [nx2, ny2];

    return {
      x1: p[0] + d * nx,  y1: p[1] + d * ny,
      x2: q[0] + d * nx,  y2: q[1] + d * ny,
    };
  });

  // Intersect consecutive shifted edges to find the new polygon vertices
  const result = [];
  for (let i = 0; i < n; i++) {
    const e1  = shifted[(i + n - 1) % n]; // previous translated edge
    const e2  = shifted[i];               // current  translated edge

    const d1x   = e1.x2 - e1.x1,  d1y = e1.y2 - e1.y1;
    const d2x   = e2.x2 - e2.x1,  d2y = e2.y2 - e2.y1;
    const denom = d1x * d2y - d1y * d2x;

    if (Math.abs(denom) < 1e-8) {
      // Parallel edges — use the start of the current shifted edge
      result.push([e2.x1, e2.y1]);
      continue;
    }

    const t = ((e2.x1 - e1.x1) * d2y - (e2.y1 - e1.y1) * d2x) / denom;
    result.push([e1.x1 + t * d1x, e1.y1 + t * d1y]);
  }
  return result;
}

// ── Roof rotation ─────────────────────────────────────────────────────────────

/**
 * Compute Euler rotation angles [x, y, z] for a pitched, azimuth-oriented
 * roof plane mesh (THREE.ShapeGeometry lying in the XY plane by default).
 *
 * Two-step composition:
 *   q_base  : rotate −90° around X  → makes the XY shape lie flat in XZ
 *   q_pitch : rotate the flat normal (0,1,0) toward the target normal that
 *             points `pitch` degrees above the `azimuth` facing direction
 *   q_final = q_pitch * q_base   (THREE convention: rightmost applied first)
 *
 * Target normal formula:
 *   n = ( sin(az)·sin(p),  cos(p),  −cos(az)·sin(p) )
 *
 * Verification:
 *   az=180 (south), p=30° → (0, 0.866, 0.5)  points up-and-south  ✓
 *   az=0   (north), p=30° → (0, 0.866, −0.5) points up-and-north  ✓
 *   any az, p=0           → (0, 1,     0   )  straight up (flat)   ✓
 *
 * @param {number} pitch   degrees from horizontal (0 = flat)
 * @param {number} azimuth degrees clockwise from north (0=N 90=E 180=S 270=W)
 * @returns {[number, number, number]}  Euler [x, y, z] in radians (order XYZ)
 */
export function computeRoofEuler(pitch, azimuth) {
  const p  = (pitch   * Math.PI) / 180;
  const az = (azimuth * Math.PI) / 180;

  // Step 1 – base quaternion: lay shape flat
  const qBase = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2, 0, 0)
  );

  // Step 2 – tilt quaternion: rotate flat-normal → target-normal
  const targetNormal = new THREE.Vector3(
    Math.sin(az) * Math.sin(p),
    Math.cos(p),
    -Math.cos(az) * Math.sin(p),
  ).normalize();

  const qPitch = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    targetNormal,
  );

  // Compose: apply qBase first, then qPitch
  // THREE.multiplyQuaternions(a, b) = a * b → b applied first
  const qFinal = new THREE.Quaternion().multiplyQuaternions(qPitch, qBase);
  const euler  = new THREE.Euler().setFromQuaternion(qFinal, "XYZ");

  return [euler.x, euler.y, euler.z];
}
