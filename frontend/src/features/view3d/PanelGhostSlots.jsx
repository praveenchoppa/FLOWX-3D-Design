/**
 * PanelGhostSlots.jsx — Step 6B-1 add-mode ghost rectangles (pre-validated empty slots).
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three";

const PANEL_THICKNESS_M = 0.04;
const PANEL_DECK_OFFSET_M = 0.14;
const GHOST_Y_BUMP = 0.02; // slightly above placed panels

function buildDeckYMap(roofSections) {
  const m = {};
  for (const sec of roofSections) {
    m[sec.id] = (sec.height ?? 3) + PANEL_DECK_OFFSET_M + PANEL_THICKNESS_M / 2 + GHOST_Y_BUMP;
  }
  return m;
}

export default function PanelGhostSlots({
  ghostSlots   = [],
  roofSections = [],
  onAddSlot    = () => {},
}) {
  const deckYMap = useMemo(() => buildDeckYMap(roofSections), [roofSections]);

  const geometry = useMemo(() => {
    if (!ghostSlots.length) return null;
    const { width, length } = ghostSlots[0];
    return new THREE.BoxGeometry(width, PANEL_THICKNESS_M, length);
  }, [ghostSlots]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!ghostSlots.length || !geometry) return null;

  return (
    <>
      {ghostSlots.map((slot) => {
        const y = deckYMap[slot.roofId] ?? 3.18;
        return (
          <mesh
            key={slot.slotId}
            geometry={geometry}
            position={[slot.center.x, y, slot.center.z]}
            rotation={[0, slot.rotation, 0]}
            renderOrder={4}
            onClick={(e) => {
              e.stopPropagation();
              onAddSlot(slot.slotId);
            }}
          >
            <meshBasicMaterial
              color="#4F8CFF"
              transparent
              opacity={0.22}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </>
  );
}
