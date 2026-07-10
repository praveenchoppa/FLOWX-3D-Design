/**
 * BusinessZonesLayer.jsx — R3F component for rendering business zones in 3D.
 *
 * Visual language (distinct from sim zones):
 *   • Diagonal-stripe canvas texture as fill (hatched pattern, per-type colour).
 *   • Thin solid outline (per-type colour).
 *   • Floating Html label above the zone centre.
 *   • Selected state: thicker white outline + higher opacity.
 *
 * Coordinate convention:
 *   outerRing: [[x, z], ...]  — scene XZ metres, same as sim zone rings.
 *   Rendered at y = deckY + 0.12 (above sim zone polygons which live at +0.04).
 *
 * THREE.Shape note:
 *   The shape is defined in XY (shape-space), then the mesh is given
 *   rotation={[-π/2, 0, 0]} so shape XY maps to world XZ:
 *     shape x → world X,  shape y → world Z (after rotation)
 *   Therefore we define shape points as (x, z) directly.
 */

import { useMemo, useRef } from "react";
import * as THREE          from "three";
import { Html, Line }      from "@react-three/drei";

import { BIZ_TYPE_CONFIG } from "../zones/bizZoneConfig";

// Y-offset above the roof deck where biz zone fills sit.
// Sim zones render at baseY + 0.04; use +0.12 to ensure biz zones are on top.
const BIZ_FILL_Y_OFFSET    = 0.12;
const BIZ_OUTLINE_Y_OFFSET = 0.13;
const BIZ_LABEL_Y_OFFSET   = 0.50; // label floats higher for readability

// ── Canvas-based diagonal-stripe texture ─────────────────────────────────────
/**
 * Returns a cached THREE.CanvasTexture for the given hex colour.
 * The texture is a repeating tile of diagonal stripes.
 */
const textureCache = new Map();

function getHatchTexture(colorHex) {
  if (textureCache.has(colorHex)) return textureCache.get(colorHex);

  const SIZE = 24; // px
  const canvas = document.createElement("canvas");
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, SIZE, SIZE);

  // Diagonal stripes (45°).  Draw 3 lines per tile for good density.
  ctx.strokeStyle = colorHex;
  ctx.lineWidth   = 2.5;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (let d = -SIZE; d < SIZE * 2; d += 8) {
    ctx.moveTo(d,        0);
    ctx.lineTo(d + SIZE, SIZE);
  }
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS  = THREE.RepeatWrapping;
  tex.wrapT  = THREE.RepeatWrapping;
  tex.repeat.set(0.25, 0.25);   // tile every 4 metres at 1m-per-unit scale
  textureCache.set(colorHex, tex);
  return tex;
}

// ── Single business zone mesh ─────────────────────────────────────────────────
function BizZoneMesh({ biz, deckY, isSelected, onSelect }) {
  const cfg = BIZ_TYPE_CONFIG[biz.businessType] ?? BIZ_TYPE_CONFIG.restricted;

  const fillY    = deckY + BIZ_FILL_Y_OFFSET;
  const outlineY = deckY + BIZ_OUTLINE_Y_OFFSET;
  const labelY   = deckY + BIZ_LABEL_Y_OFFSET;

  // ── Build THREE.ShapeGeometry from outerRing ────────────────────────────
  const fillGeo = useMemo(() => {
    const ring = biz.outerRing;
    if (!ring || ring.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], ring[i][1]);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [biz.outerRing]);

  // ── Hatch texture ────────────────────────────────────────────────────────
  const hatchTex = useMemo(() => getHatchTexture(cfg.color), [cfg.color]);

  // ── Outline points ────────────────────────────────────────────────────────
  const outlinePts = useMemo(() => {
    const ring = biz.outerRing;
    if (!ring || ring.length < 3) return [];
    return [...ring, ring[0]].map(([x, z]) => new THREE.Vector3(x, outlineY, z));
  }, [biz.outerRing, outlineY]);

  // ── Centroid for label placement ─────────────────────────────────────────
  const centroid = useMemo(() => {
    const ring = biz.outerRing;
    if (!ring || !ring.length) return [0, 0];
    const cx = ring.reduce((s, [x]) => s + x, 0) / ring.length;
    const cz = ring.reduce((s, [, z]) => s + z, 0) / ring.length;
    return [cx, cz];
  }, [biz.outerRing]);

  if (!fillGeo || outlinePts.length < 2) return null;

  const opacity     = isSelected ? 0.82 : 0.55;
  const outlineCol  = isSelected ? "#ffffff" : cfg.color;
  const outlineW    = isSelected ? 3.5 : 2.0;

  return (
    <group>
      {/* ── Hatched fill ─────────────────────────────────────────────── */}
      <mesh
        geometry={fillGeo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, fillY, 0]}
        onClick={(e) => { e.stopPropagation(); onSelect(biz.id); }}
        renderOrder={2}
      >
        <meshBasicMaterial
          map={hatchTex}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── Outline ──────────────────────────────────────────────────── */}
      {outlinePts.length >= 2 && (
        <Line
          points={outlinePts}
          color={outlineCol}
          lineWidth={outlineW}
          renderOrder={3}
        />
      )}

      {/* ── Label ────────────────────────────────────────────────────── */}
      <Html
        position={[centroid[0], labelY, centroid[1]]}
        center
        zIndexRange={[10, 20]}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            background: "rgba(7,17,32,0.82)",
            border:     `1px solid ${cfg.color}`,
            borderRadius: 6,
            padding:    "2px 7px",
            display:    "flex",
            alignItems: "center",
            gap:        4,
            fontSize:   11,
            fontWeight: 600,
            color:      cfg.color,
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          <span>{cfg.icon}</span>
          <span>{biz.name}</span>
        </div>
      </Html>
    </group>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
export default function BusinessZonesLayer({
  businessZones    = [],
  roofSections     = [],
  selectedBizZoneId = null,
  onSelectBizZone  = () => {},
}) {
  if (!businessZones.length) return null;

  // Build a map from roofId → deckY for quick look-up.
  const deckYByRoof = useMemo(() => {
    const m = {};
    roofSections.forEach((s) => { m[s.id] = (s.height ?? 3); });
    return m;
  }, [roofSections]);

  return (
    <>
      {businessZones
        .filter((b) => !b.deleted)
        .map((biz) => {
          const deckY = deckYByRoof[biz.roofId] ?? 3;
          return (
            <BizZoneMesh
              key={biz.id}
              biz={biz}
              deckY={deckY}
              isSelected={biz.id === selectedBizZoneId}
              onSelect={onSelectBizZone}
            />
          );
        })}
    </>
  );
}
