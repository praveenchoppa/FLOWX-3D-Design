/**
 * CadDimensionSvg2D.jsx — CAD dimension annotation as SVG (2D map overlay).
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

function DimensionLabelSvg2D({ textPt, label, style }) {
  const box = estimateLabelBox(label);
  const x = textPt.x - box.width / 2;
  const y = textPt.y - box.height - 2;

  return (
    <g>
      <rect
        x={x}
        y={y}
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
        x={textPt.x}
        y={y + box.height / 2 + 1}
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
      <DimensionLabelSvg2D textPt={textPt} label={axis.label} style={style} />
    </g>
  );
}

export default function CadDimensionSvg2D({
  map,
  centre,
  centerX,
  centerZ,
  rotationY,
  widthX,
  lengthY,
  category = "roof",
  dimOffset,
}) {
  const style = getCadCategoryStyle(category);

  const spec = buildCadDimensionSpec({
    centerX,
    centerZ,
    rotationY,
    widthX,
    lengthY,
    offset: dimOffset,
  });

  if (!spec || !map) return null;

  return (
    <g className="pointer-events-none select-none">
      <CadAxisSvg2D axis={spec.width} map={map} centre={centre} style={style} />
      <CadAxisSvg2D axis={spec.length} map={map} centre={centre} style={style} />
    </g>
  );
}
