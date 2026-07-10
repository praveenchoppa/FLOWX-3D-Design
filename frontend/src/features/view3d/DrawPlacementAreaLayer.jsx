/**
 * DrawPlacementAreaLayer.jsx — Click-to-place vertex polygon drawing for Placement Areas.
 *
 * Independent of engineering zones and business zones. Uses the same DOM raycast +
 * deck-plane pattern as DrawBizZoneLayer / ZonePolygonEditor.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

import { sectionToLocal } from "./roofGeometry3d";
import {
  CLOSE_POLYGON_THRESHOLD_M,
  MIN_VERTEX_SPACING_M,
  MIN_OUTER_VERTICES,
} from "../placementAreas/placementAreaConfig";

function PreviewPolygon({ vertices, cursor, y }) {
  if (!vertices.length) return null;
  const pts = vertices.map(([x, z]) => new THREE.Vector3(x, y, z));
  if (cursor) pts.push(new THREE.Vector3(cursor.x, y, cursor.z));
  if (vertices.length >= MIN_OUTER_VERTICES) {
    pts.push(new THREE.Vector3(vertices[0][0], y, vertices[0][1]));
  }
  return (
    <Line
      points={pts}
      color="#06B6D4"
      lineWidth={2.5}
      dashed
      dashSize={0.5}
      gapSize={0.25}
      raycast={() => null}
    />
  );
}

function FirstVertexMarker({ x, z, y, canClose }) {
  return (
    <mesh position={[x, y + 0.05, z]} renderOrder={21} raycast={() => null}>
      <sphereGeometry args={[canClose ? 0.28 : 0.18, 12, 12]} />
      <meshBasicMaterial
        color={canClose ? "#00E38C" : "#06B6D4"}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function DrawPlacementAreaLayer({
  roofSections,
  centre,
  orbitRef,
  onComplete,
  onCancelDraw,
}) {
  const { gl, raycaster, camera } = useThree();

  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const getSceneXZ = useCallback((clientX, clientY, deckY) => {
    const canvas = gl.domElement;
    const deckPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -deckY);
    const tmp = new THREE.Vector3();
    const r  = canvas.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width)  *  2 - 1;
    const ny = ((clientY - r.top)  / r.height) * -2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    if (raycaster.ray.intersectPlane(deckPlane, tmp)) {
      return { x: tmp.x, z: tmp.z };
    }
    return null;
  }, [gl, raycaster, camera]);

  const finishPolygon = useCallback((roofId, vertices) => {
    if (vertices.length < MIN_OUTER_VERTICES) return;
    onComplete({
      roofId,
      outerRing: vertices.map(([x, z]) => [x, z]),
    });
    setSession(null);
  }, [onComplete]);

  const handleDown = useCallback((e, roofId, deckY) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();

    const pt = { x: e.point.x, z: e.point.z };
    const current = sessionRef.current;

    if (!current || current.roofId !== roofId) {
      setSession({
        roofId,
        deckY,
        vertices: [[pt.x, pt.z]],
        cursor:   pt,
      });
      return;
    }

    const verts = current.vertices;
    const first = verts[0];
    const canClose = verts.length >= MIN_OUTER_VERTICES
      && Math.hypot(pt.x - first[0], pt.z - first[1]) <= CLOSE_POLYGON_THRESHOLD_M;

    if (canClose) {
      finishPolygon(roofId, verts);
      return;
    }

    const last = verts[verts.length - 1];
    if (Math.hypot(pt.x - last[0], pt.z - last[1]) < MIN_VERTEX_SPACING_M) return;

    setSession({
      ...current,
      vertices: [...verts, [pt.x, pt.z]],
      cursor:   pt,
    });
  }, [finishPolygon]);

  useEffect(() => {
    if (!session) return;
    const canvas = gl.domElement;

    const onMove = (evt) => {
      const pt = getSceneXZ(evt.clientX, evt.clientY, session.deckY);
      if (pt) setSession((prev) => prev ? { ...prev, cursor: pt } : null);
    };

    const onKey = (evt) => {
      if (evt.key === "Enter") {
        const cur = sessionRef.current;
        if (cur?.vertices?.length >= MIN_OUTER_VERTICES) {
          finishPolygon(cur.roofId, cur.vertices);
        }
      }
    };

    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [session, gl.domElement, getSceneXZ, finishPolygon]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setSession(null);
      onCancelDraw();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancelDraw]);

  const canClose = session
    && session.vertices.length >= MIN_OUTER_VERTICES
    && session.cursor
    && Math.hypot(
      session.cursor.x - session.vertices[0][0],
      session.cursor.z - session.vertices[0][1],
    ) <= CLOSE_POLYGON_THRESHOLD_M;

  return (
    <>
      {roofSections.map((sec) => {
        const deckY = (sec.height ?? 3) + 0.03;
        const { cx, cy } = sectionToLocal(sec.coordinates, centre);
        return (
          <mesh
            key={sec.id}
            position={[cx, deckY, -cy]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerDown={(e) => handleDown(e, sec.id, deckY)}
          >
            <planeGeometry args={[2000, 2000]} />
            <meshBasicMaterial
              transparent
              opacity={0.001}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {session && (
        <>
          <PreviewPolygon
            vertices={session.vertices}
            cursor={session.cursor}
            y={session.deckY + 0.11}
          />
          {session.vertices.length > 0 && (
            <FirstVertexMarker
              x={session.vertices[0][0]}
              z={session.vertices[0][1]}
              y={session.deckY + 0.11}
              canClose={canClose}
            />
          )}
        </>
      )}
    </>
  );
}
