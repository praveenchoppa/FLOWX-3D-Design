/**
 * DrawBizZoneLayer.jsx — R3F component for drawing rectangle business zones in Top view.
 *
 * Architecture:
 *   • One transparent hit-plane mesh per roof section, positioned at y = deckY + 0.03
 *     (just above the roof deck).  The plane is invisible but receives R3F pointer events.
 *   • pointerDown on a hit plane starts the rectangle drag and captures `roofId` + `deckY`.
 *   • During drag, native DOM pointermove / pointerup events are used for reliability
 *     (so the pointer can leave the mesh and the drag keeps working).  We ray-intersect
 *     against a THREE.Plane(up, −deckY) to get the current scene-XZ cursor position.
 *   • A preview rectangle (<Line />) is shown while dragging.
 *   • Esc cancels via a keydown listener.
 *   • On release (if rectangle is large enough): calls onAddBizZone({ roofId, outerRing }).
 *     outerRing is [[x,z],...] in scene XZ — same format as sim zone rings.
 *
 * Coordinate convention:
 *   scene X = East,  scene Z = South  (metres from design centre)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useThree }                                  from "@react-three/fiber";
import { Line }                                      from "@react-three/drei";
import * as THREE                                    from "three";

import { sectionToLocal } from "./roofGeometry3d";

// Minimum rectangle dimension (metres) to accept the drawing.
const MIN_RECT_M = 0.5;

// ── Preview rectangle ─────────────────────────────────────────────────────────
function PreviewRect({ x0, z0, x1, z1, y }) {
  const pts = [
    new THREE.Vector3(Math.min(x0, x1), y, Math.min(z0, z1)),
    new THREE.Vector3(Math.max(x0, x1), y, Math.min(z0, z1)),
    new THREE.Vector3(Math.max(x0, x1), y, Math.max(z0, z1)),
    new THREE.Vector3(Math.min(x0, x1), y, Math.max(z0, z1)),
    new THREE.Vector3(Math.min(x0, x1), y, Math.min(z0, z1)), // close
  ];
  return (
    <Line
      points={pts}
      color="#4F8CFF"
      lineWidth={2.5}
      dashed
      dashSize={0.5}
      gapSize={0.25}
      raycast={() => null}
    />
  );
}

// ── Main drawing layer ────────────────────────────────────────────────────────
export default function DrawBizZoneLayer({
  roofSections,
  centre,
  orbitRef,
  onAddBizZone,
  onCancelDraw,
}) {
  const { gl, raycaster, camera } = useThree();

  // drag state: null = idle, object = dragging
  const [drag, setDrag] = useState(null);
  // Keep a ref for the drag so DOM event callbacks have fresh access without
  // needing to be recreated on every state update.
  const dragRef = useRef(null);
  useEffect(() => { dragRef.current = drag; }, [drag]);

  // ── DOM drag listeners (active only while dragging) ───────────────────────
  useEffect(() => {
    if (!drag) return;                     // no drag in progress, nothing to do
    const canvas = gl.domElement;
    const deckPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -drag.deckY);
    const tmp       = new THREE.Vector3();

    const getSceneXZ = (evt) => {
      const r  = canvas.getBoundingClientRect();
      const nx = ((evt.clientX - r.left) / r.width)  *  2 - 1;
      const ny = ((evt.clientY - r.top)  / r.height) * -2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      if (raycaster.ray.intersectPlane(deckPlane, tmp)) {
        return { x: tmp.x, z: tmp.z };
      }
      return null;
    };

    const onMove = (evt) => {
      const pt = getSceneXZ(evt);
      if (pt) setDrag((prev) => prev ? { ...prev, x1: pt.x, z1: pt.z } : null);
    };

    const onUp = (evt) => {
      const current = dragRef.current;
      if (!current) return;
      const pt = getSceneXZ(evt);
      // Re-enable orbit controls.
      if (orbitRef?.current) orbitRef.current.enabled = true;

      if (pt) {
        const fx1 = pt.x;
        const fz1 = pt.z;
        const dx  = Math.abs(fx1 - current.x0);
        const dz  = Math.abs(fz1 - current.z0);
        if (dx >= MIN_RECT_M && dz >= MIN_RECT_M) {
          const outerRing = [
            [Math.min(current.x0, fx1), Math.min(current.z0, fz1)],
            [Math.max(current.x0, fx1), Math.min(current.z0, fz1)],
            [Math.max(current.x0, fx1), Math.max(current.z0, fz1)],
            [Math.min(current.x0, fx1), Math.max(current.z0, fz1)],
          ];
          onAddBizZone({ roofId: current.roofId, outerRing });
        }
      }

      setDrag(null);
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup",   onUp);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup",   onUp);
    };
    // Re-register only when a new drag starts (not on every mouse-move state update).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag, gl, raycaster, camera, orbitRef, onAddBizZone]);

  // ── Esc key cancels drawing ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (orbitRef?.current) orbitRef.current.enabled = true;
      setDrag(null);
      onCancelDraw();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancelDraw, orbitRef]);

  // ── pointerDown on hit planes ─────────────────────────────────────────────
  const handleDown = useCallback((e, roofId, deckY) => {
    // Only respond to left mouse button.
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    if (orbitRef?.current) orbitRef.current.enabled = false;
    setDrag({
      roofId,
      deckY,
      x0: e.point.x,
      z0: e.point.z,
      x1: e.point.x,
      z1: e.point.z,
    });
  }, [orbitRef]);

  return (
    <>
      {/* ── Per-roof transparent hit planes ─────────────────────────────── */}
      {roofSections.map((sec) => {
        const deckY = (sec.height ?? 3) + 0.03;
        // We only need the centroid to correctly position the plane in scene XZ.
        // The plane is 2000m wide so it extends well beyond any building.
        const { cx, cy } = sectionToLocal(sec.coordinates, centre);
        return (
          <mesh
            key={sec.id}
            position={[cx, deckY, -cy]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerDown={(e) => handleDown(e, sec.id, deckY)}
          >
            <planeGeometry args={[2000, 2000]} />
            {/* Fully transparent but still raycastable (opacity > 0 for R3F). */}
            <meshBasicMaterial
              transparent
              opacity={0.001}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {/* ── Live preview rectangle while dragging ────────────────────────── */}
      {drag && (
        <PreviewRect
          x0={drag.x0}
          z0={drag.z0}
          x1={drag.x1}
          z1={drag.z1}
          y={drag.deckY + 0.1}
        />
      )}
    </>
  );
}
