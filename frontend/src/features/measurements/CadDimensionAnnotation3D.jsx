/**
 * CadDimensionAnnotation3D.jsx — Engineering CAD dimension annotation (3D deck plane).
 *
 * Presentation-only. Geometry comes from buildCadDimensionSpec (rectangle) or
 * a prebuilt axes[] array (roof edge dimensions).
 */

import { Html, Line } from "@react-three/drei";

import {
  buildCadDimensionSpec,
  CAD_LABEL_BG,
  CAD_LABEL_RADIUS,
  CAD_TEXT_SIZE_3D,
  getCadCategoryStyle,
} from "./cadDimensionRenderer";

const TEXT_Y_LIFT = 0.04;

const LABEL_FONT_PX = Math.round(CAD_TEXT_SIZE_3D * 48);

function DeckSegment({ start, end, y, color, lineWidth = 1.5 }) {
  return (
    <Line
      points={[[start.x, y, start.z], [end.x, y, end.z]]}
      color={color}
      lineWidth={lineWidth}
      renderOrder={30}
      toneMapped={false}
      depthTest={false}
    />
  );
}

function DimensionLabel3D({ axis, y, style }) {
  if (axis.suppressLabel) return null;

  const useEdgeAlign = Number.isFinite(axis.labelAngleDeg);
  const labelAngleRad = useEdgeAlign ? (axis.labelAngleDeg * Math.PI) / 180 : 0;

  return (
    <Html
      position={[axis.textAnchor.x, y + TEXT_Y_LIFT, axis.textAnchor.z]}
      rotation={[-Math.PI / 2, 0, labelAngleRad]}
      transform
      center={useEdgeAlign}
      occlude={false}
      distanceFactor={10}
      zIndexRange={[100, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          padding:        "4px 9px",
          borderRadius:   `${CAD_LABEL_RADIUS}px`,
          background:     CAD_LABEL_BG,
          border:         `1px solid ${style.border}`,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          color:          style.text,
          fontSize:       `${LABEL_FONT_PX}px`,
          fontWeight:     600,
          fontFamily:     "ui-monospace, SFMono-Regular, Menlo, monospace",
          whiteSpace:     "nowrap",
          lineHeight:     1.2,
          boxShadow:      "0 2px 10px rgba(0, 0, 0, 0.38)",
          letterSpacing:  "0.01em",
        }}
      >
        {axis.label}
      </div>
    </Html>
  );
}

function CadDimensionAxis3D({ axis, y, style }) {
  if (!axis) return null;

  return (
    <group>
      {axis.extensionLines.map((seg, i) => (
        <DeckSegment key={`ext-${i}`} start={seg.start} end={seg.end} y={y} color={style.line} />
      ))}
      <DeckSegment
        start={axis.dimensionLine.start}
        end={axis.dimensionLine.end}
        y={y}
        color={style.line}
        lineWidth={2}
      />
      {axis.arrowLeft.map((seg, i) => (
        <DeckSegment key={`al-${i}`} start={seg.start} end={seg.end} y={y} color={style.line} lineWidth={1.8} />
      ))}
      {axis.arrowRight.map((seg, i) => (
        <DeckSegment key={`ar-${i}`} start={seg.start} end={seg.end} y={y} color={style.line} lineWidth={1.8} />
      ))}
      <DimensionLabel3D axis={axis} y={y} style={style} />
    </group>
  );
}

/**
 * @param {{
 *   axes?: object[]|null,
 *   centerX?: number,
 *   centerZ?: number,
 *   y: number,
 *   rotationY?: number,
 *   widthX?: number,
 *   lengthY?: number,
 *   category?: string,
 *   dimOffset?: number,
 * }} props
 */
export default function CadDimensionAnnotation3D({
  axes = null,
  centerX,
  centerZ,
  y,
  rotationY,
  widthX,
  lengthY,
  category = "roof",
  dimOffset,
}) {
  const style = getCadCategoryStyle(category);

  const resolvedAxes = axes ?? (() => {
    const spec = buildCadDimensionSpec({
      centerX,
      centerZ,
      rotationY,
      widthX,
      lengthY,
      offset: dimOffset,
    });
    if (!spec) return null;
    return [spec.width, spec.length];
  })();

  if (!resolvedAxes?.length) return null;

  return (
    <group>
      {resolvedAxes.map((axis, i) => (
        <CadDimensionAxis3D key={`axis-${i}`} axis={axis} y={y} style={style} />
      ))}
    </group>
  );
}
