/**
 * PlacementAreasLayer.jsx — Render engineer-drawn Placement Areas in 3D.
 *
 * Visual language: semi-transparent cyan fill + solid outline (distinct from sim zones
 * and hatched business zones). Renders above sim zones, below business zones.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";

import { PLACEMENT_AREA_STYLE } from "../placementAreas/placementAreaConfig";

const FILL_Y_OFFSET    = 0.07;
const OUTLINE_Y_OFFSET = 0.08;
const LABEL_Y_OFFSET   = 0.45;

function PlacementAreaMesh({ area, deckY, isSelected }) {
  const outerRing = area.polygon?.outerRing;
  const fillY    = deckY + FILL_Y_OFFSET;
  const outlineY = deckY + OUTLINE_Y_OFFSET;
  const labelY   = deckY + LABEL_Y_OFFSET;

  const fillGeo = useMemo(() => {
    if (!outerRing || outerRing.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(outerRing[0][0], outerRing[0][1]);
    for (let i = 1; i < outerRing.length; i++) shape.lineTo(outerRing[i][0], outerRing[i][1]);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [outerRing]);

  const outlinePts = useMemo(() => {
    if (!outerRing || outerRing.length < 3) return [];
    return [...outerRing, outerRing[0]].map(([x, z]) => new THREE.Vector3(x, outlineY, z));
  }, [outerRing, outlineY]);

  const centroid = useMemo(() => {
    if (!outerRing?.length) return { x: 0, z: 0 };
    let sx = 0;
    let sz = 0;
    for (const [x, z] of outerRing) { sx += x; sz += z; }
    return { x: sx / outerRing.length, z: sz / outerRing.length };
  }, [outerRing]);

  if (!fillGeo) return null;

  return (
    <group>
      <mesh
        geometry={fillGeo}
        position={[0, fillY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={6}
        raycast={() => null}
      >
        <meshBasicMaterial
          color={PLACEMENT_AREA_STYLE.color}
          transparent
          opacity={isSelected ? 0.38 : 0.24}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <Line
        points={outlinePts}
        color={isSelected ? PLACEMENT_AREA_STYLE.selected : PLACEMENT_AREA_STYLE.color}
        lineWidth={isSelected ? 3.5 : 2}
        renderOrder={7}
        raycast={() => null}
      />

      <Html
        position={[centroid.x, labelY, centroid.z]}
        center
        distanceFactor={18}
        style={{ pointerEvents: "none" }}
      >
        <div
          className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap shadow-lg border"
          style={{
            background: PLACEMENT_AREA_STYLE.bg,
            color:      "#F8FAFC",
            borderColor: `${PLACEMENT_AREA_STYLE.color}66`,
          }}
        >
          {area.name}
        </div>
      </Html>
    </group>
  );
}

export default function PlacementAreasLayer({
  placementAreas   = [],
  roofSections     = [],
  selectedPlacementAreaId = null,
}) {
  const deckYByRoof = useMemo(() => {
    const m = {};
    for (const sec of roofSections) {
      m[sec.id] = sec.height ?? 3;
    }
    return m;
  }, [roofSections]);

  const visible = placementAreas.filter((a) => !a.deleted);

  return (
    <>
      {visible.map((area) => (
        <PlacementAreaMesh
          key={area.id}
          area={area}
          deckY={deckYByRoof[area.roofId] ?? 3}
          isSelected={area.id === selectedPlacementAreaId}
        />
      ))}
    </>
  );
}
