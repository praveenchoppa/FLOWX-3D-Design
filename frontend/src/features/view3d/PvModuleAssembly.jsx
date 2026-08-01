/**
 * PvModuleAssembly.jsx — Module surface + frame only (rails/supports via PvMountRows).
 */

import { useMemo, useEffect } from "react";
import {
  getSharedMaterials,
  getModuleGeometries,
  tintGlassMaterial,
  ROOF_CONTACT_EPS,
} from "./pvModuleAssets.js";
import { computeModuleStack } from "./panelMountVisual.js";

export default function PvModuleAssembly({
  panel,
  deckY,
  mountVisual,
  selected = false,
  dragging = false,
  arrayHighlight = false,
  dimmed = false,
  onClick,
  onPointerDown,
  showSelectionRing = false,
  electricalSelected = false,
  stringMemberHighlight = false,
}) {
  const materials = useMemo(() => getSharedMaterials(), []);
  const geos = useMemo(
    () => getModuleGeometries(panel.width, panel.length),
    [panel.width, panel.length],
  );

  const glassMat = useMemo(() => {
    if (stringMemberHighlight && !electricalSelected) {
      const mat = materials.glass.clone();
      mat.emissive.set("#00E38C");
      mat.emissiveIntensity = 0.32;
      mat.transparent = true;
      mat.opacity = 0.95;
      return mat;
    }
    return tintGlassMaterial(materials.glass, { selected, dragging, arrayHighlight, dimmed });
  }, [materials.glass, selected, dragging, arrayHighlight, dimmed, stringMemberHighlight, electricalSelected]);

  useEffect(() => () => {
    if (glassMat !== materials.glass) glassMat.dispose();
  }, [glassMat, materials.glass]);

  const stack = useMemo(
    () => computeModuleStack(mountVisual.mountHeight ?? 0),
    [mountVisual.mountHeight],
  );

  const hw = panel.width / 2;
  const hl = panel.length / 2;
  const tiltRad = ((mountVisual.tilt ?? 0) * Math.PI) / 180;

  return (
    <group
      position={[panel.center.x, deckY + ROOF_CONTACT_EPS, panel.center.z]}
      rotation={[-tiltRad, panel.rotation ?? 0, 0, "YXZ"]}
    >
      <mesh geometry={geos.glass} material={glassMat} position={[0, stack.moduleCenterY, 0]} castShadow receiveShadow userData={{ zoomFocusType: "panel" }} />
      <mesh geometry={geos.frameTop} material={materials.frame} position={[0, stack.frameCenterY, -hl + 0.024 / 2]} castShadow receiveShadow />
      <mesh geometry={geos.frameBottom} material={materials.frame} position={[0, stack.frameCenterY, hl - 0.024 / 2]} castShadow receiveShadow />
      <mesh geometry={geos.frameLeft} material={materials.frame} position={[-hw + 0.024 / 2, stack.frameCenterY, 0]} castShadow receiveShadow />
      <mesh geometry={geos.frameRight} material={materials.frame} position={[hw - 0.024 / 2, stack.frameCenterY, 0]} castShadow receiveShadow />
      <mesh geometry={geos.frameBevel} material={materials.frameEdge} position={[0, stack.frameBottomY + 0.037 + 0.003, 0]} castShadow />
      <mesh geometry={geos.endClamp} material={materials.clamp} position={[-hw + 0.023, stack.railCenterY + 0.014, 0]} castShadow />
      <mesh geometry={geos.endClamp} material={materials.clamp} position={[hw - 0.023, stack.railCenterY + 0.014, 0]} castShadow />

      <mesh
        geometry={geos.hit}
        material={materials.hit}
        position={[0, stack.moduleCenterY, 0]}
        renderOrder={10}
        userData={{ zoomFocusType: "panel" }}
        onClick={onClick}
        onPointerDown={onPointerDown}
      />

      {showSelectionRing && (
        <mesh position={[0, stack.moduleCenterY + 0.03, 0]} renderOrder={11}>
          <boxGeometry args={[panel.width + 0.06, 0.01, panel.length + 0.06]} />
          <meshBasicMaterial color="#4F8CFF" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      )}

      {electricalSelected && (
        <mesh position={[0, stack.moduleCenterY + 0.035, 0]} renderOrder={12}>
          <boxGeometry args={[panel.width + 0.1, 0.008, panel.length + 0.1]} />
          <meshBasicMaterial
            color="#06B6D4"
            wireframe
            transparent
            opacity={1}
            depthWrite={false}
          />
        </mesh>
      )}

      {stringMemberHighlight && !electricalSelected && (
        <>
          <mesh position={[0, stack.moduleCenterY + 0.032, 0]} renderOrder={12}>
            <boxGeometry args={[panel.width + 0.14, 0.012, panel.length + 0.14]} />
            <meshBasicMaterial
              color="#00E38C"
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, stack.moduleCenterY + 0.042, 0]} renderOrder={13}>
            <boxGeometry args={[panel.width + 0.14, 0.01, panel.length + 0.14]} />
            <meshBasicMaterial
              color="#00E38C"
              wireframe
              transparent
              opacity={1}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
    </group>
  );
}
