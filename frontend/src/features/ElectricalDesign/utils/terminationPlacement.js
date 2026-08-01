/**
 * terminationPlacement.js — Termination point placement plane + visual Y resolution.
 *
 * Stored coordinates: scene XZ from the workspace raycast hit (roof, ground, panels, etc.).
 * Marker/render Y: roof deck height when XZ is over a roof footprint, else ground level.
 * Homerun length uses horizontal XZ only (P5D convention).
 */

import * as THREE from "three";

import { sectionToLocal } from "../../view3d/roofGeometry3d.js";
import { WIRING_VISUAL_LIFT_M } from "./geometry.js";

/** Fallback horizontal plane when no scene geometry is hit (Y = 0). */
export const TERMINATION_PLACEMENT_PLANE_Y = 0;

const _ndc = new THREE.Vector2();
const _planeHit = new THREE.Vector3();
const _fallbackPlane = new THREE.Plane(
  new THREE.Vector3(0, 1, 0),
  -TERMINATION_PLACEMENT_PLANE_Y,
);

function isRaycastSkipped(object) {
  let node = object;
  while (node) {
    if (node.userData?.skipWorkspaceRaycast) return true;
    node = node.parent;
  }
  return false;
}

/**
 * Resolve workspace XZ from a canvas pointer — uses the first scene hit (not Y=0 projection).
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {THREE.Camera} camera
 * @param {import('three').WebGLRenderer} gl
 * @param {THREE.Scene} scene
 * @returns {{ x: number, z: number } | null}
 */
export function raycastWorkspaceXZ(clientX, clientY, camera, gl, scene) {
  const canvas = gl.domElement;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  _ndc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(_ndc, camera);
  const hits = raycaster.intersectObjects(scene.children, true);

  for (const hit of hits) {
    if (isRaycastSkipped(hit.object)) continue;
    return { x: hit.point.x, z: hit.point.z };
  }

  if (raycaster.ray.intersectPlane(_fallbackPlane, _planeHit)) {
    return { x: _planeHit.x, z: _planeHit.z };
  }

  return null;
}

/** Marker height when off-roof (above GroundPlane at Y ≈ -0.06). */
export const TERMINATION_GROUND_MARKER_Y = 0.08;

const PANEL_DECK_OFFSET_M = 0.14;
const ROOF_DECK_EPS_M = 0.02;

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    const intersect = ((zi > z) !== (zj > z))
      && (x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Roof footprint rings in scene XZ for hit testing.
 *
 * @param {object[]} roofSections
 * @param {{ lat: number, lng: number }} centre
 */
export function roofFootprintRings(roofSections, centre) {
  const rings = [];
  for (const sec of roofSections ?? []) {
    if ((sec.coordinates?.length ?? 0) < 3) continue;
    const { pts, cx, cy } = sectionToLocal(sec.coordinates, centre);
    if (pts.length < 3) continue;
    rings.push({
      roofId: sec.id,
      ring:   pts.map(([px, py]) => [px + cx, py + cy]),
      deckY:  Math.max(sec.height ?? 3, 0.15) + ROOF_DECK_EPS_M + PANEL_DECK_OFFSET_M,
    });
  }
  return rings;
}

/**
 * Resolve marker / wiring visual Y for termination at (x, z).
 *
 * @param {number} x
 * @param {number} z
 * @param {object[]} roofSections
 * @param {{ lat: number, lng: number }} centre
 */
export function resolveTerminationVisualY(x, z, roofSections, centre) {
  for (const { ring, deckY } of roofFootprintRings(roofSections, centre)) {
    if (pointInRing(x, z, ring)) {
      return deckY + WIRING_VISUAL_LIFT_M;
    }
  }
  return TERMINATION_GROUND_MARKER_Y;
}

/**
 * Wiring anchor for termination point (lifted for canvas visibility).
 *
 * @param {{ x: number, z: number }} terminationPoint
 * @param {object[]} roofSections
 * @param {{ lat: number, lng: number }} centre
 */
export function terminationWiringAnchor(terminationPoint, roofSections, centre) {
  const y = resolveTerminationVisualY(
    terminationPoint.x,
    terminationPoint.z,
    roofSections,
    centre,
  );
  return {
    x: terminationPoint.x,
    y,
    z: terminationPoint.z,
  };
}
