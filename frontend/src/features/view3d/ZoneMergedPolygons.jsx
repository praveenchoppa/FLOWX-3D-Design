/**
 * ZoneMergedPolygons — R3F component for Step 5B/5C/5E zone region visualization.
 *
 * Renders each zone region as:
 *   • A filled THREE.ShapeGeometry (semi-transparent, colored by effectiveClass)
 *     — holes are properly punched out via THREE.Shape.holes (THREE.Path)
 *   • A thin outline tracing the outer boundary
 *
 * Geometry is rebuilt when zoneDisplayList engineering polygons change.
 * Simulation stats (areaM2, avgScore) still read original 5B values upstream.
 *
 * Engineering polygons (Step 5 Phase 1):
 *   activeOuterRing / activeHoles from zoneDisplayList drive rendering.
 *   autoPolygon (immutable) is never modified here.
 *
 * Coordinate mapping:
 *   ShapeGeometry lives in the XY plane.  We pass shape (Sx, Sy) = scene (x, z).
 *   With rotation +Math.PI/2 around X the mapping is:
 *     (Sx, Sy, 0) → (Sx, 0, Sy)  i.e. world (x, 0, z) ✓
 */
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { ZONE_META } from "../zones/zoneClassification";

// ── Display-only smoothing parameters (tune here) ─────────────────────────────

const SMOOTH_ITERS = 2;
const SMOOTH_RATIO = 0.25;

function chaikinSmooth(ring, iters, ratio) {
  if (ring.length < 3) return ring;
  let pts = ring;
  const r = ratio;
  const s = 1 - ratio;
  for (let iter = 0; iter < iters; iter++) {
    const n    = pts.length;
    const next = [];
    for (let j = 0; j < n; j++) {
      const [x0, z0] = pts[j];
      const [x1, z1] = pts[(j + 1) % n];
      next.push([s * x0 + r * x1, s * z0 + r * z1]);
      next.push([r * x0 + s * x1, r * z0 + s * z1]);
    }
    pts = next;
  }
  return pts;
}

function buildFillGeo(outerRing, holes, fillY) {
  const smoothOuter = chaikinSmooth(outerRing, SMOOTH_ITERS, SMOOTH_RATIO);
  const shape = new THREE.Shape();
  shape.moveTo(smoothOuter[0][0], smoothOuter[0][1]);
  for (let i = 1; i < smoothOuter.length; i++) shape.lineTo(smoothOuter[i][0], smoothOuter[i][1]);
  shape.closePath();

  for (const hole of holes) {
    if (!hole || hole.length < 3) continue;
    const smoothHole = chaikinSmooth(hole, SMOOTH_ITERS, SMOOTH_RATIO);
    const path = new THREE.Path();
    path.moveTo(smoothHole[0][0], smoothHole[0][1]);
    for (let i = 1; i < smoothHole.length; i++) path.lineTo(smoothHole[i][0], smoothHole[i][1]);
    path.closePath();
    shape.holes.push(path);
  }

  return { fillGeo: new THREE.ShapeGeometry(shape), outlineY: fillY + 0.01 };
}

export default function ZoneMergedPolygons({
  mergeResult     = null,
  zoneDisplayList = [],
  selectedZoneId  = null,
  dimmed          = false,
}) {
  const baseYByRoof = useMemo(() => {
    const m = {};
    if (!mergeResult) return m;
    for (const roofId in mergeResult.byRoof) {
      m[roofId] = mergeResult.byRoof[roofId].baseY ?? 0;
    }
    return m;
  }, [mergeResult]);

  const geometryItems = useMemo(() => {
    if (!zoneDisplayList.length) return [];
    const items = [];

    for (const z of zoneDisplayList) {
      if (z.deleted) continue;
      const outer = z.activeOuterRing;
      if (!outer || outer.length < 3) continue;

      const baseY  = baseYByRoof[z.roofId] ?? 0;
      const fillY  = baseY + 0.04;
      const holes  = z.activeHoles ?? [];
      const { fillGeo, outlineY } = buildFillGeo(outer, holes, fillY);
      const outlinePts = outer.map(([rx, rz]) => [rx, outlineY, rz]);

      items.push({ id: z.id, fillGeo, outlinePts, fillY });
    }

    return items;
  }, [zoneDisplayList, baseYByRoof]);

  useEffect(() => {
    return () => {
      for (const { fillGeo } of geometryItems) fillGeo.dispose();
    };
  }, [geometryItems]);

  const displayMap = useMemo(() => {
    const m = new Map();
    for (const z of zoneDisplayList) {
      m.set(z.id, {
        color:      ZONE_META[z.effectiveClass]?.color ?? "#94A3B8",
        deleted:    z.deleted,
        locked:     z.locked,
        isSelected: z.id === selectedZoneId,
      });
    }
    return m;
  }, [zoneDisplayList, selectedZoneId]);

  if (!geometryItems.length) return null;

  return (
    <>
      {geometryItems.map(({ id, fillGeo, outlinePts, fillY }) => {
        const display = displayMap.get(id);
        if (!display || display.deleted) return null;

        const { color, isSelected } = display;

        return (
          <group key={id}>
            <mesh
              geometry={fillGeo}
              position={[0, fillY, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              renderOrder={3}
              raycast={() => null}
            >
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isSelected ? (dimmed ? 0.32 : 0.85) : (dimmed ? 0.25 : 0.58)}
                depthWrite={false}
                toneMapped={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Selection glow — wider semi-transparent outline beneath */}
            {isSelected && (
              <Line
                points={outlinePts}
                color={color}
                lineWidth={6}
                transparent
                opacity={0.35}
                closed
                renderOrder={3}
              />
            )}

            <Line
              points={outlinePts}
              color={isSelected ? "#ffffff" : color}
              lineWidth={isSelected ? 3.5 : 1.8}
              closed
              renderOrder={4}
            />
          </group>
        );
      })}
    </>
  );
}
