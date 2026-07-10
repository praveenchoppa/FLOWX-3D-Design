/**
 * PvModulesInstanced.jsx — GPU-instanced module surfaces + row mount structure.
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  getSharedMaterials,
  getModuleGeometries,
  applyPanelAssemblyTransform,
  buildModulePartMatrices,
} from "./pvModuleAssets.js";
import { resolvePanelMountVisual } from "./panelMountVisual.js";
import PvMountRows from "./PvMountRows.jsx";

const MODULE_PART_KEYS = [
  "glass", "frameTop", "frameBottom", "frameLeft", "frameRight",
  "frameBevel", "endClampL", "endClampR",
];

const PART_GEO = {
  glass: "glass",
  frameTop: "frameTop",
  frameBottom: "frameBottom",
  frameLeft: "frameLeft",
  frameRight: "frameRight",
  frameBevel: "frameBevel",
  endClampL: "endClamp",
  endClampR: "endClamp",
};

const PART_MAT = {
  glass: "glass",
  frameTop: "frame",
  frameBottom: "frame",
  frameLeft: "frame",
  frameRight: "frame",
  frameBevel: "frameEdge",
  endClampL: "clamp",
  endClampR: "clamp",
};

function InstancedPartLayer({ partKey, count, geometry, material, matrices }) {
  const meshRef = useRef(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !matrices?.length) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    if (partKey === "glass") {
      mesh.userData.zoomFocusType = "panel";
    }
  }, [matrices, partKey]);

  if (!count || !geometry) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      castShadow
      receiveShadow
      renderOrder={5}
    />
  );
}

export default function PvModulesInstanced({
  panels,
  deckYMap,
  panelVisualContext,
}) {
  const materials = useMemo(() => getSharedMaterials(), []);
  const rootTemp = useMemo(() => new THREE.Object3D(), []);

  const { width, length } = panels[0] ?? { width: 1, length: 2 };
  const geos = useMemo(() => getModuleGeometries(width, length), [width, length]);

  const regionMap = panelVisualContext?.regionMap;

  const partMatrices = useMemo(() => {
    const buckets = Object.fromEntries(MODULE_PART_KEYS.map((k) => [k, []]));

    for (const panel of panels) {
      const deckY = deckYMap[panel.roofId] ?? 3.02;
      const mountVisual = resolvePanelMountVisual(
        panel,
        regionMap,
        panelVisualContext?.projectPanelDefaults,
      );

      applyPanelAssemblyTransform(rootTemp, panel, deckY, mountVisual);
      const parts = buildModulePartMatrices(panel, mountVisual, rootTemp);

      for (const key of MODULE_PART_KEYS) {
        buckets[key].push(parts[key]);
      }
    }

    return buckets;
  }, [panels, deckYMap, regionMap, panelVisualContext?.projectPanelDefaults, rootTemp]);

  const count = panels.length;

  return (
    <>
      <PvMountRows
        panels={panels}
        deckYMap={deckYMap}
        panelVisualContext={panelVisualContext}
      />
      {MODULE_PART_KEYS.map((partKey) => (
        <InstancedPartLayer
          key={partKey}
          partKey={partKey}
          count={count}
          geometry={geos[PART_GEO[partKey]]}
          material={materials[PART_MAT[partKey]]}
          matrices={partMatrices[partKey]}
        />
      ))}
    </>
  );
}
