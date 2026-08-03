/**
 * CadDimensionSvg2D.jsx — CAD dimension annotation as SVG (2D map overlay).
 *
 * Presentation-only. Geometry comes from buildCadDimensionSpec (rectangle) or
 * a prebuilt axes[] array (roof edge dimensions).
 */

import {
  buildCadDimensionSpec,
  CAD_LABEL_BG,
  CAD_LABEL_RADIUS,
  CAD_TEXT_SIZE_2D_PX,
  estimateLabelBox,
  getCadCategoryStyle,
  sceneXZToLatLng,
} from "./cadDimensionRenderer";

function xzToPixel(map, x, z, centre) {
  const { lat, lng } = sceneXZToLatLng(x, z, centre);
  const pt = map.latLngToContainerPoint([lat, lng]);
  return { x: pt.x, y: pt.y };
}

function segmentToPixel(map, seg, centre) {
  return {
    start: xzToPixel(map, seg.start.x, seg.start.z, centre),
    end:   xzToPixel(map, seg.end.x, seg.end.z, centre),
  };
}

function SvgSegment({ start, end, color, strokeWidth = 1.5 }) {
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  );
}

function DimensionLabelSvg2D({ textPt, label, style, labelAngleDeg = 0 }) {
  const box = estimateLabelBox(label);
  const cx = textPt.x;
  const cy = textPt.y;

  return (
    <g transform={`rotate(${labelAngleDeg} ${cx} ${cy})`}>
      <rect
        x={cx - box.width / 2}
        y={cy - box.height / 2}
        width={box.width}
        height={box.height}
        rx={CAD_LABEL_RADIUS}
        ry={CAD_LABEL_RADIUS}
        fill={CAD_LABEL_BG}
        stroke={style.border}
        strokeWidth={0.85}
        opacity={0.96}
      />
      <text
        x={cx}
        y={cy}
        fill={style.text}
        fontSize={CAD_TEXT_SIZE_2D_PX}
        fontWeight="600"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {label}
      </text>
    </g>
  );
}

function CadAxisSvg2D({ axis, map, centre, style }) {
  if (!axis) return null;

  const dim = segmentToPixel(map, axis.dimensionLine, centre);
  const textPt = xzToPixel(map, axis.textAnchor.x, axis.textAnchor.z, centre);

  return (
    <g>
      {axis.extensionLines.map((seg, i) => {
        const px = segmentToPixel(map, seg, centre);
        return <SvgSegment key={`e-${i}`} start={px.start} end={px.end} color={style.line} />;
      })}
      <SvgSegment start={dim.start} end={dim.end} color={style.line} strokeWidth={2} />
      {axis.arrowLeft.map((seg, i) => {
        const px = segmentToPixel(map, seg, centre);
        return <SvgSegment key={`al-${i}`} start={px.start} end={px.end} color={style.line} strokeWidth={1.8} />;
      })}
      {axis.arrowRight.map((seg, i) => {
        const px = segmentToPixel(map, seg, centre);
        return <SvgSegment key={`ar-${i}`} start={px.start} end={px.end} color={style.line} strokeWidth={1.8} />;
      })}
      {!axis.suppressLabel && (
        <DimensionLabelSvg2D
          textPt={textPt}
          label={axis.label}
          style={style}
          labelAngleDeg={axis.labelAngleDeg ?? 0}
        />
      )}
    </g>
  );
}

/**
 * @param {{
 *   map: object,
 *   centre: { lat: number, lng: number },
 *   axes?: object[]|null,
 *   centerX?: number,
 *   centerZ?: number,
 *   rotationY?: number,
 *   widthX?: number,
 *   lengthY?: number,
 *   category?: string,
 *   dimOffset?: number,
 * }} props
 */
export default function CadDimensionSvg2D({
  map,
  centre,
  axes = null,
  centerX,
  centerZ,
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

  if (!resolvedAxes?.length || !map) return null;

  return (
    <g className="pointer-events-none select-none">
      {resolvedAxes.map((axis, i) => (
        <CadAxisSvg2D key={`axis-${i}`} axis={axis} map={map} centre={centre} style={style} />
      ))}
    </g>
  );
}
