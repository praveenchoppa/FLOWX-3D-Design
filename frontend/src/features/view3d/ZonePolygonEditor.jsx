/**
 * ZonePolygonEditor.jsx — Step 5 Engineering Zone polygon editing in 3D.
 *
 * Active only when a zone is selected, visible, unlocked, and editing is enabled.
 * Supports:
 *   • Move entire polygon (translate outer ring + holes)
 *   • Move / add / delete outer-ring vertices
 *
 * Validation happens upstream via onCommit; rejected edits revert via prop sync.
 * Pattern follows DrawBizZoneLayer (DOM pointer events + deck-plane raycast).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

import { ZONE_EDIT_MODES } from "../zones/engineeringZoneConfig";
import { cloneEngineeringPolygon } from "../zones/zoneEditorUtils";

const HANDLE_R     = 0.22;
const MID_HANDLE_R = 0.14;
const MIN_VERTICES = 3;

// ── Vertex handle ─────────────────────────────────────────────────────────────

function VertexHandle({ x, z, y, selected, midpoint, onPointerDown }) {
  const color = selected ? "#ffffff" : midpoint ? "#94A3B8" : "#4F8CFF";
  const r     = midpoint ? MID_HANDLE_R : HANDLE_R;

  return (
    <mesh
      position={[x, y, z]}
      renderOrder={20}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
    >
      <sphereGeometry args={[r, 12, 12]} />
      <meshBasicMaterial color={color} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

export default function ZonePolygonEditor({
  zone,
  baseY           = 0,
  editMode        = ZONE_EDIT_MODES.VERTICES,
  orbitRef,
  onCommit        = () => {},
  onMeasureUpdate = () => {},
  onDragActiveChange = () => {},
}) {
  const { gl, raycaster, camera } = useThree();
  const deckY     = baseY + 0.06;
  const handleY   = deckY + 0.04;
  const deckPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -deckY), [deckY]);
  const tmp       = useMemo(() => new THREE.Vector3(), []);

  const [draft, setDraft] = useState(() =>
    cloneEngineeringPolygon(zone.engineeringPolygon),
  );
  const [selectedVertex, setSelectedVertex] = useState(null);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const committedKeyRef = useRef("");
  useEffect(() => { dragRef.current = drag; }, [drag]);

  const committedKey = useMemo(
    () => JSON.stringify({ o: zone.activeOuterRing, h: zone.activeHoles }),
    [zone.activeOuterRing, zone.activeHoles],
  );

  useEffect(() => {
    onMeasureUpdate({
      editing:   !!drag,
      outerRing: draft.outerRing.map(([x, z]) => [x, z]),
    });
  }, [drag, draft.outerRing, onMeasureUpdate]);

  useEffect(() => () => {
    onMeasureUpdate({ editing: false, outerRing: null });
  }, [onMeasureUpdate]);

  const getSceneXZ = useCallback((clientX, clientY) => {
    const canvas = gl.domElement;
    const r  = canvas.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width)  *  2 - 1;
    const ny = ((clientY - r.top)  / r.height) * -2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    if (raycaster.ray.intersectPlane(deckPlane, tmp)) {
      return { x: tmp.x, z: tmp.z };
    }
    return null;
  }, [gl, raycaster, camera, deckPlane, tmp]);

  // Sync draft when zone selection or committed geometry changes externally.
  useEffect(() => {
    if (drag) return;
    if (committedKeyRef.current === committedKey && committedKeyRef.current !== "") return;
    committedKeyRef.current = committedKey;
    setDraft(cloneEngineeringPolygon(zone.engineeringPolygon));
    setSelectedVertex(null);
  }, [zone.id, committedKey, drag, zone.engineeringPolygon]);

  const commitDraft = useCallback((nextDraft) => {
    const accepted = onCommit({
      outerRing: nextDraft.outerRing.map(([x, z]) => [x, z]),
      holes:     (nextDraft.holes ?? []).map((h) => h.map(([x, z]) => [x, z])),
    });
    if (accepted === false) {
      committedKeyRef.current = "";
      setDraft(cloneEngineeringPolygon(zone.engineeringPolygon));
      setSelectedVertex(null);
    }
  }, [onCommit, zone.engineeringPolygon]);

  // ── DOM drag listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!drag) return;
    const canvas = gl.domElement;

    const onMove = (evt) => {
      const pt = getSceneXZ(evt.clientX, evt.clientY);
      if (!pt) return;
      const current = dragRef.current;
      if (!current) return;

      setDraft((prev) => {
        if (current.type === "move") {
          const dx = pt.x - current.startX;
          const dz = pt.z - current.startZ;
          return {
            outerRing: current.origOuter.map(([x, z]) => [x + dx, z + dz]),
            holes:     current.origHoles.map((h) => h.map(([x, z]) => [x + dx, z + dz])),
          };
        }
        if (current.type === "vertex") {
          const ring = prev.outerRing.map((p, i) =>
            i === current.vertexIndex ? [pt.x, pt.z] : [...p],
          );
          return { ...prev, outerRing: ring };
        }
        return prev;
      });
    };

    const onUp = () => {
      if (orbitRef?.current) orbitRef.current.enabled = true;
      const current = dragRef.current;
      if (current?.type === "move" || current?.type === "vertex") {
        setDraft((prev) => {
          commitDraft(prev);
          return prev;
        });
      }
      setDrag(null);
      onDragActiveChange(false);
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup",   onUp);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup",   onUp);
    };
  }, [drag, gl.domElement, getSceneXZ, orbitRef, commitDraft, onDragActiveChange]);

  // Delete selected vertex via keyboard.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (selectedVertex == null) return;
      if (draft.outerRing.length <= MIN_VERTICES) return;

      setDraft((prev) => {
        const ring = prev.outerRing.filter((_, i) => i !== selectedVertex);
        const next = { ...prev, outerRing: ring };
        commitDraft(next);
        return next;
      });
      setSelectedVertex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedVertex, draft.outerRing.length, commitDraft]);

  const startMoveDrag = useCallback((nativeEvent) => {
    const pt = getSceneXZ(nativeEvent.clientX, nativeEvent.clientY);
    if (!pt) return;
    if (orbitRef?.current) orbitRef.current.enabled = false;
    onDragActiveChange(true);
    setDrag({
      type:      "move",
      startX:    pt.x,
      startZ:    pt.z,
      origOuter: draft.outerRing.map(([x, z]) => [x, z]),
      origHoles: (draft.holes ?? []).map((h) => h.map(([x, z]) => [x, z])),
    });
  }, [draft, getSceneXZ, orbitRef, onDragActiveChange]);

  const startVertexDrag = useCallback((vertexIndex, nativeEvent) => {
    setSelectedVertex(vertexIndex);
    if (orbitRef?.current) orbitRef.current.enabled = false;
    onDragActiveChange(true);
    setDrag({ type: "vertex", vertexIndex });
  }, [orbitRef, onDragActiveChange]);

  const insertVertex = useCallback((edgeIndex, x, z) => {
    setDraft((prev) => {
      const ring = [...prev.outerRing];
      ring.splice(edgeIndex + 1, 0, [x, z]);
      const next = { ...prev, outerRing: ring };
      commitDraft(next);
      return next;
    });
    setSelectedVertex(edgeIndex + 1);
  }, [commitDraft]);

  const moveHitShape = useMemo(() => {
    const ring = draft.outerRing;
    if (ring.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], ring[i][1]);
    shape.closePath();
    return shape;
  }, [draft.outerRing]);

  const outlinePts = useMemo(
    () => draft.outerRing.map(([x, z]) => new THREE.Vector3(x, handleY, z)),
    [draft.outerRing, handleY],
  );

  const midpoints = useMemo(() => {
    const n = draft.outerRing.length;
    const mids = [];
    for (let i = 0; i < n; i++) {
      const [x0, z0] = draft.outerRing[i];
      const [x1, z1] = draft.outerRing[(i + 1) % n];
      mids.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, edgeIndex: i });
    }
    return mids;
  }, [draft.outerRing]);

  return (
    <group>
      <Line
        points={[...outlinePts, outlinePts[0] ?? new THREE.Vector3()]}
        color="#ffffff"
        lineWidth={4}
        closed
        renderOrder={18}
        raycast={() => null}
      />

      {editMode === ZONE_EDIT_MODES.MOVE && moveHitShape && (
        <mesh
          position={[0, deckY, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          renderOrder={19}
          onPointerDown={(e) => {
            e.stopPropagation();
            startMoveDrag(e.nativeEvent);
          }}
        >
          <shapeGeometry args={[moveHitShape]} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {editMode === ZONE_EDIT_MODES.VERTICES && (
        <>
          {draft.outerRing.map(([x, z], i) => (
            <VertexHandle
              key={`v-${i}`}
              x={x}
              z={z}
              y={handleY}
              selected={selectedVertex === i}
              onPointerDown={(e) => startVertexDrag(i, e.nativeEvent)}
            />
          ))}
          {midpoints.map(({ x, z, edgeIndex }) => (
            <VertexHandle
              key={`m-${edgeIndex}`}
              x={x}
              z={z}
              y={handleY}
              midpoint
              onPointerDown={(e) => {
                e.stopPropagation();
                insertVertex(edgeIndex, x, z);
              }}
            />
          ))}
        </>
      )}
    </group>
  );
}
