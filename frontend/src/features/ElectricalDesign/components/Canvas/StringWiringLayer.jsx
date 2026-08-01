/**
 * StringWiringLayer.jsx — P5D intra-string wiring overlay (3D, Step 7 only).
 *
 * Renders panel-to-panel segments along orderedPanelSequence using real geometry.
 * Distinct from selection/highlight overlays (amber/cyan/green).
 */
import { useMemo } from "react";
import { Line } from "@react-three/drei";

const WIRING_COLOR = "#FFB547";
const WIRING_SELECTED_COLOR = "#FFD166";
const WIRING_DIM_COLOR = "#6B4F2A";

/**
 * @param {object} props
 * @param {import('../../services/intraStringWiring.js').IntraStringSegment[]} props.segments
 * @param {string|null} [props.selectedStringId]
 * @param {string[]} [props.highlightStringIds]
 */
export default function StringWiringLayer({
  segments = [],
  selectedStringId = null,
  highlightStringIds = [],
}) {
  const highlightSet = useMemo(
    () => new Set(highlightStringIds ?? []),
    [highlightStringIds],
  );

  const hasHighlight = highlightSet.size > 0 || !!selectedStringId;

  if (!segments.length) return null;

  return (
    <group name="electrical-string-wiring">
      {segments.map((seg) => {
        const key = `${seg.stringId}::${seg.fromPanelId}::${seg.toPanelId}::${seg.sequenceIndex}`;
        const isSelected = seg.stringId === selectedStringId;
        const isHighlighted = isSelected || highlightSet.has(seg.stringId);
        const color = isHighlighted
          ? WIRING_SELECTED_COLOR
          : hasHighlight
            ? WIRING_DIM_COLOR
            : WIRING_COLOR;
        const lineWidth = isHighlighted ? 2.5 : 1.5;

        return (
          <Line
            key={key}
            points={[
              [seg.from.x, seg.from.y, seg.from.z],
              [seg.to.x, seg.to.y, seg.to.z],
            ]}
            color={color}
            lineWidth={lineWidth}
            transparent
            opacity={isHighlighted ? 0.95 : 0.72}
            depthTest
            renderOrder={12}
          />
        );
      })}
    </group>
  );
}
