/**
 * zoomToCursor.js — Zoom-to-cursor focus for OrbitControls (navigation UX only).
 *
 * On wheel: raycast under cursor, nudge OrbitControls target toward the hit point,
 * then let OrbitControls perform its normal dolly zoom.
 */

import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

/** Lower number = higher pick priority when distances are equal. */
export const ZOOM_FOCUS_PRIORITY = /** @type {const} */ ({
  roof:     1,
  ground:   2,
  panel:    3,
  obstacle: 4,
});

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _mouse = new THREE.Vector2();
const _planeHit = new THREE.Vector3();
const _targetDelta = new THREE.Vector3();

/**
 * Pick the best zoom focus point along a ray.
 *
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @returns {THREE.Vector3|null}
 */
export function pickZoomFocusPoint(raycaster, scene, camera) {
  const intersects = raycaster.intersectObjects(scene.children, true);

  /** @type {{ point: THREE.Vector3, priority: number, distance: number } | null} */
  let best = null;

  for (const hit of intersects) {
    const type = hit.object?.userData?.zoomFocusType;
    if (!type || ZOOM_FOCUS_PRIORITY[type] == null) continue;

    const priority = ZOOM_FOCUS_PRIORITY[type];
    const replace = !best
      || hit.distance < best.distance - 0.02
      || (Math.abs(hit.distance - best.distance) <= 0.02 && priority < best.priority);

    if (replace) {
      best = { point: hit.point.clone(), priority, distance: hit.distance };
    }
  }

  if (best) return best.point;

  // Ground plane fallback (y = 0) when no tagged mesh is hit.
  if (raycaster.ray.intersectPlane(GROUND_PLANE, _planeHit)) {
    _targetDelta.copy(_planeHit).sub(camera.position);
    if (_targetDelta.dot(raycaster.ray.direction) > 0) {
      return _planeHit.clone();
    }
  }

  return null;
}

/**
 * Shift OrbitControls target (and camera) toward focus before the default dolly.
 *
 * @param {import('three-stdlib').OrbitControls} controls
 * @param {THREE.Camera} camera
 * @param {THREE.Vector3} focusPoint
 * @param {number} deltaY  wheel deltaY
 */
export function nudgeOrbitTargetTowardFocus(controls, camera, focusPoint, deltaY) {
  if (!controls || !focusPoint) return;

  const strength = Math.min(0.22, Math.abs(deltaY) * 0.00085);
  const t = deltaY > 0 ? strength * 0.85 : strength;

  const prevTarget = controls.target.clone();
  controls.target.lerp(focusPoint, t);
  _targetDelta.copy(controls.target).sub(prevTarget);
  camera.position.add(_targetDelta);
  controls.update();
}

/**
 * Attach zoom-to-cursor wheel handler (capture phase, before OrbitControls).
 *
 * @param {{ orbitRef: React.RefObject, enabled?: boolean }} params
 */
export function useZoomToCursor({ orbitRef, enabled = true }) {
  const { camera, scene, gl } = useThree();
  const raycaster = useThree((s) => s.raycaster);

  useEffect(() => {
    if (!enabled) return undefined;

    const dom = gl.domElement;

    function onWheel(event) {
      const controls = orbitRef.current;
      if (!controls?.enabled) return;

      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_mouse, camera);
      const focus = pickZoomFocusPoint(raycaster, scene, camera);
      if (!focus) return;

      nudgeOrbitTargetTowardFocus(controls, camera, focus, event.deltaY);
    }

    dom.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => dom.removeEventListener("wheel", onWheel, { capture: true });
  }, [enabled, gl.domElement, camera, scene, raycaster, orbitRef]);
}
