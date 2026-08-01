/**
 * HomerunWiringLayer.jsx — P5E homerun wiring overlay (3D, Step 7 only).
 */
import { useMemo } from "react";
import { Line } from "@react-three/drei";

const HOMERUN_COLOR = "#06B6D4";
const HOMERUN_SELECTED_COLOR = "#22D3EE";
const HOMERUN_DIM_COLOR = "#0E7490";

/**
 * @param {object} props
 * @param {import('../../services/homerunWiring.js').HomerunSegment[]} props.segments
 * @param {string|null} [props.selectedStringId]
 */
export default function HomerunWiringLayer({
  segments = [],
  selectedStringId = null,
}) {
  const hasHighlight = !!selectedStringId;

  if (!segments.length) return null;

  return (
    <group name="electrical-homerun-wiring">
      {segments.map((seg) => {
        const key = `${seg.stringId}::homerun::${seg.fromPanelId}`;
        const isSelected = seg.stringId === selectedStringId;
        const color = isSelected
          ? HOMERUN_SELECTED_COLOR
          : hasHighlight
            ? HOMERUN_DIM_COLOR
            : HOMERUN_COLOR;
        const lineWidth = isSelected ? 2.5 : 1.5;
        const points = (seg.path?.length >= 2 ? seg.path : [seg.from, seg.to]).map(
          (p) => [p.x, p.y, p.z],
        );

        return (
          <Line
            key={key}
            points={points}
            color={color}
            lineWidth={lineWidth}
            transparent
            opacity={isSelected ? 0.95 : 0.78}
            depthTest
            renderOrder={13}
          />
        );
      })}
    </group>
  );
}
