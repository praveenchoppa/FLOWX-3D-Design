/**
 * PvMountRows.jsx — Shared continuous rails + supports per panel row (visual only).
 */

import { useMemo } from "react";
import * as THREE from "three";
import {
  getSharedMaterials,
  getRowGeometries,
  getModuleGeometries,
  applyRowAssemblyTransform,
  buildRowPartMatrices,
  buildMidClampMatrix,
} from "./pvModuleAssets.js";
import { resolvePanelMountVisual } from "./panelMountVisual.js";
import { clusterPanelsIntoMountRows, midClampPositionsForRow } from "./panelRowCluster.js";

function RowAssembly({ row, deckY, mountVisual }) {
  const materials = useMemo(() => getSharedMaterials(), []);
  const rowGeos = useMemo(
    () => getRowGeometries(row.rowWidth, row.moduleLength),
    [row.rowWidth, row.moduleLength],
  );
  const modGeos = useMemo(
    () => getModuleGeometries(row.moduleWidth, row.moduleLength),
    [row.moduleWidth, row.moduleLength],
  );

  const parts = useMemo(() => {
    const root = new THREE.Object3D();
    applyRowAssemblyTransform(root, row, deckY, mountVisual);
    return buildRowPartMatrices(row, mountVisual, root);
  }, [row, deckY, mountVisual]);

  const midClampMatrices = useMemo(() => {
    const root = new THREE.Object3D();
    return midClampPositionsForRow(row).map((c) => (
      buildMidClampMatrix(c, mountVisual, deckY, root)
    ));
  }, [row, mountVisual, deckY]);

  return (
    <group>
      <mesh geometry={rowGeos.rail} material={materials.rail} matrix={parts.railL} matrixAutoUpdate={false} castShadow receiveShadow />
      <mesh geometry={rowGeos.rail} material={materials.rail} matrix={parts.railR} matrixAutoUpdate={false} castShadow receiveShadow />
      <mesh geometry={rowGeos.crossRail} material={materials.rail} matrix={parts.crossFront} matrixAutoUpdate={false} castShadow />
      <mesh geometry={rowGeos.crossRail} material={materials.rail} matrix={parts.crossRear} matrixAutoUpdate={false} castShadow />

      {parts.supports.map((mat, i) => (
        <mesh
          key={`sup-${i}`}
          geometry={rowGeos.support}
          material={materials.support}
          matrix={mat}
          matrixAutoUpdate={false}
          castShadow
          receiveShadow
        />
      ))}

      {parts.brackets.map((mat, i) => (
        <mesh
          key={`br-${i}`}
          geometry={rowGeos.bracket}
          material={materials.clamp}
          matrix={mat}
          matrixAutoUpdate={false}
          castShadow
        />
      ))}

      {midClampMatrices.map((mat, i) => (
        <mesh
          key={`mc-${i}`}
          geometry={modGeos.midClamp}
          material={materials.clamp}
          matrix={mat}
          matrixAutoUpdate={false}
          castShadow
        />
      ))}
    </group>
  );
}

export default function PvMountRows({ panels, deckYMap, panelVisualContext }) {
  const regionMap = panelVisualContext?.regionMap;
  const rows = useMemo(() => clusterPanelsIntoMountRows(panels), [panels]);

  return (
    <>
      {rows.map((row) => {
        const deckY = deckYMap[row.roofId] ?? 3.02;
        const mountVisual = resolvePanelMountVisual(
          row.panels[0],
          regionMap,
          panelVisualContext?.projectPanelDefaults,
        );
        const rowKey = `${row.roofId}::${row.center.x.toFixed(2)}::${row.center.z.toFixed(2)}::${row.panels.length}`;
        return (
          <RowAssembly
            key={rowKey}
            row={row}
            deckY={deckY}
            mountVisual={mountVisual}
          />
        );
      })}
    </>
  );
}
