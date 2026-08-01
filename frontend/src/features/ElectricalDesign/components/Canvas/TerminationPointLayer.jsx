/**
 * TerminationPointLayer.jsx — P5E termination marker + workspace placement plane.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

import {
  raycastWorkspaceXZ,
  resolveTerminationVisualY,
  TERMINATION_PLACEMENT_PLANE_Y,
} from "../../utils/terminationPlacement.js";

const MARKER_COLOR = "#00E38C";
const MARKER_SELECTED_COLOR = "#34F5A8";
const PLACEMENT_PLANE_SIZE = 2000;
/** Screen-space movement before orbit is disabled and drag begins. */
const DRAG_THRESHOLD_PX = 4;
/** Invisible pick volume (visible marker stays unchanged). */
const PICK_RADIUS = 0.75;
const PICK_HEIGHT = 1.6;

/**
 * @param {object} props
 * @param {import('../../models/terminationPoint.js').TerminationPoint|null} props.terminationPoint
 * @param {boolean} props.placementMode
 * @param {boolean} props.selected
 * @param {object[]} props.roofSections
 * @param {{ lat: number, lng: number }} props.centre
 * @param {(x: number, z: number) => void} props.onPlace
 * @param {(x: number, z: number) => void} props.onMove
 * @param {() => void} props.onSelect
 * @param {(active: boolean) => void} props.onDragActiveChange
 */
export default function TerminationPointLayer({
  terminationPoint = null,
  placementMode = false,
  selected = false,
  roofSections = [],
  centre = { lat: 0, lng: 0 },
  onPlace = () => {},
  onMove = () => {},
  onSelect = () => {},
  onDragActiveChange = () => {},
}) {
  const { camera, gl, scene } = useThree();
  const dragSessionRef = useRef(null);
  const onMoveRef = useRef(onMove);
  const onDragActiveChangeRef = useRef(onDragActiveChange);

  onMoveRef.current = onMove;
  onDragActiveChangeRef.current = onDragActiveChange;

  const visualY = useMemo(() => {
    if (!terminationPoint) return TERMINATION_PLACEMENT_PLANE_Y;
    return resolveTerminationVisualY(
      terminationPoint.x,
      terminationPoint.z,
      roofSections,
      centre,
    );
  }, [terminationPoint, roofSections, centre]);

  const hitTestXZ = useCallback((clientX, clientY) => (
    raycastWorkspaceXZ(clientX, clientY, camera, gl, scene)
  ), [camera, gl, scene]);

  const endDragSession = useCallback(() => {
    const session = dragSessionRef.current;
    if (!session) return;
    window.removeEventListener("pointermove", session.onMove);
    window.removeEventListener("pointerup", session.onUp);
    window.removeEventListener("pointercancel", session.onUp);
    window.removeEventListener("blur", session.onCancel);
    if (session.orbitDisabled) {
      onDragActiveChangeRef.current(false);
    }
    dragSessionRef.current = null;
  }, []);

  const startDragTracking = useCallback((refs, clientX, clientY) => {
    endDragSession();

    const { camera: cam, gl: canvasGl, scene: sceneGraph } = refs;
    const originX = clientX;
    const originY = clientY;

    const session = {
      orbitDisabled: false,
      onMove: (e) => {
        const dx = e.clientX - originX;
        const dy = e.clientY - originY;
        if (!session.orbitDisabled) {
          if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
          session.orbitDisabled = true;
          onDragActiveChangeRef.current(true);
        }
        const hit = raycastWorkspaceXZ(e.clientX, e.clientY, cam, canvasGl, sceneGraph);
        if (hit) onMoveRef.current(hit.x, hit.z);
      },
      onUp: () => {
        endDragSession();
      },
      onCancel: () => {
        endDragSession();
      },
    };

    dragSessionRef.current = session;
    window.addEventListener("pointermove", session.onMove);
    window.addEventListener("pointerup", session.onUp);
    window.addEventListener("pointercancel", session.onUp);
    window.addEventListener("blur", session.onCancel);
  }, [endDragSession]);

  useEffect(() => () => endDragSession(), [endDragSession]);

  useEffect(() => {
    if (placementMode) endDragSession();
  }, [placementMode, endDragSession]);

  useEffect(() => {
    if (!placementMode) return undefined;
    const canvas = gl.domElement;
    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      const hit = hitTestXZ(e.clientX, e.clientY);
      if (!hit) return;
      e.stopPropagation();
      endDragSession();
      onPlace(hit.x, hit.z);
    };
    canvas.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => canvas.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [placementMode, hitTestXZ, gl, onPlace, endDragSession]);

  return (
    <group name="electrical-termination-point">
      {placementMode && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, TERMINATION_PLACEMENT_PLANE_Y + 0.001, 0]}
          userData={{ skipWorkspaceRaycast: true }}
        >
          <planeGeometry args={[PLACEMENT_PLANE_SIZE, PLACEMENT_PLANE_SIZE]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}

      {terminationPoint && !placementMode && (
        <TerminationMarker
          x={terminationPoint.x}
          y={visualY}
          z={terminationPoint.z}
          selected={selected}
          onSelect={onSelect}
          onPointerDown={(refs, clientX, clientY) => {
            startDragTracking(refs, clientX, clientY);
          }}
        />
      )}
    </group>
  );
}

function TerminationMarker({
  x, y, z, selected, onSelect, onPointerDown,
}) {
  const color = selected ? MARKER_SELECTED_COLOR : MARKER_COLOR;

  const handlePointerDown = (e) => {
    e.stopPropagation();
    onSelect();
    onPointerDown(
      { camera: e.camera, gl: e.gl, scene: e.scene },
      e.clientX,
      e.clientY,
    );
  };

  return (
    <group position={[x, y, z]} userData={{ skipWorkspaceRaycast: true }}>
      <mesh onPointerDown={handlePointerDown}>
        <cylinderGeometry args={[PICK_RADIUS, PICK_RADIUS, PICK_HEIGHT, 16]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerDown={handlePointerDown}
      >
        <cylinderGeometry args={[0.18, 0.22, 0.55, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.35 : 0.15}
          roughness={0.45}
        />
      </mesh>
      <mesh
        position={[0, 0.42, 0]}
        onPointerDown={handlePointerDown}
      >
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <Html
        center
        distanceFactor={14}
        style={{ pointerEvents: "none", userSelect: "none" }}
        position={[0, 0.85, 0]}
      >
        <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-[rgba(7,17,32,0.88)] border border-[#00E38C]/40 text-[#00E38C]">
          Termination
        </div>
      </Html>
    </group>
  );
}
