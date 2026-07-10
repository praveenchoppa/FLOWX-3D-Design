/**
 * RoofView3D.jsx  —  Step 2b-1 (inputs → 3D, read-only)
 *
 * Premium engineering-grade 3D roof workspace.
 *
 * Geometry per section (three layers):
 *   1. Building walls   — ExtrudeGeometry(footprint, depth=height)
 *   2. Parapet ring     — ExtrudeGeometry(outer−inner ring, depth=PARAPET_H)
 *                         sitting at Y=height, gives the raised parapet rim
 *   3. Roof deck        — ShapeGeometry(inset footprint) at Y=height+ε
 *                         pitched/azimuth-tilted; unselected = neutral grey,
 *                         selected = accent blue (ONLY colour indicator)
 *
 * Visual style:
 *   • Light, matte materials (meshStandardMaterial, roughness≈0.85)
 *   • Key shadow light + ambient fill + soft sky rim
 *   • Canvas alpha=true so the CSS radial gradient shows as the background
 *   • Dark slate ground plane so the light buildings lift off visually
 */

import { useRef, useMemo, useEffect, useLayoutEffect, useCallback, useState, Suspense } from "react";
import { Canvas, useThree }                                   from "@react-three/fiber";
import { OrbitControls, TransformControls }                   from "@react-three/drei";
import { FiMove, FiRotateCcw, FiMaximize2, FiTrash2, FiMousePointer, FiPlus, FiCornerUpLeft, FiCornerUpRight, FiEdit2 } from "react-icons/fi";
import * as THREE                                             from "three";

import { ZONE_EDIT_MODES } from "../zones/engineeringZoneConfig";
import { PLACEMENT_AREA_EDIT_MODES } from "../placementAreas/placementAreaConfig";
import {
  computeDesignCenter,
  sectionToLocal,
  computeRoofEuler,
  insetPolygon,
} from "./roofGeometry3d";
import { getObstacleDef } from "../obstacles/obstacleTypes";
import SunSystem from "./SunSystem";
import { getSun, getDayTimes } from "../simulation/solar";
import {
  chooseCellSize, summarizeShade,
  SHADOW_CELL_SIZE, MAX_CELLS_PER_ROOF, SHADOW_STEP_MIN,
} from "../simulation/shadowGrid";
import { ZONE_META } from "../zones/zoneClassification";
import ZoneMergedPolygons   from "./ZoneMergedPolygons";
import ZonePolygonEditor    from "./ZonePolygonEditor";
import BusinessZonesLayer   from "./BusinessZonesLayer";
import DrawBizZoneLayer     from "./DrawBizZoneLayer";
import PlacementAreasLayer  from "./PlacementAreasLayer";
import DrawPlacementAreaLayer from "./DrawPlacementAreaLayer";
import PlacementAreaPolygonEditor from "./PlacementAreaPolygonEditor";
import PlacedPanels         from "./PlacedPanels";
import PanelGhostSlots      from "./PanelGhostSlots";
import MeasurementOverlay3D from "../measurements/MeasurementOverlay3D";

// ── Scene constants ───────────────────────────────────────────────────────────
const PARAPET_H = 0.45;   // parapet height above building top (metres)
const PARAPET_T = 0.25;   // parapet wall thickness / inset amount (metres)

// ── Colour palette ────────────────────────────────────────────────────────────
// Keep it desaturated everywhere except the selected-roof accent.
const C = {
  wall:            "#c2c6cf",  // light cool-grey building exterior
  parapet:         "#cacdd6",  // slightly lighter parapet rim
  deckNormal:      "#dde0e7",  // near-white unselected deck
  deckSelected:    "#4F8CFF",  // accent ONLY for the selected roof deck
  ground:          "#111d2b",  // dark slate ground
  obstacle:        "#8b97a8",  // mid-grey primitive
  obstacleSel:     "#FFB547",  // amber — distinct from blue roof selection
};

// ── Transform toolbar config ──────────────────────────────────────────────────
const GIZMO_MODES = [
  { mode: "translate", Icon: FiMove,      label: "Move"   },
  { mode: "rotate",   Icon: FiRotateCcw,  label: "Rotate" },
  { mode: "scale",    Icon: FiMaximize2,  label: "Scale"  },
];

// ── Obstacle boundary containment ─────────────────────────────────────────────
//
// Obstacles are confined to the ROOF DECK SURFACE — the full roof boundary inset
// by the parapet rim (PARAPET_T).  This is the exact polygon the obstacle is
// placed on (raycast deck) and visually rests on, so it reaches the visible deck
// edge without clipping the parapet.  Deliberately NOT the setback/usable area
// (that constrains panels, not equipment).
//
// Containment uses a ray-casting point-in-polygon test over the obstacle's four
// rotated footprint corners, so it works for ANY polygon — convex, concave, or
// notched (L-shaped) — unlike the old convex edge-normal/circumradius clamp.
//
// Coordinate mapping (from sectionToLocal):
//   world X =  (lng-centre.lng)·K·cosLat   (east metres)
//   world Z = -(lat-centre.lat)·K          (south metres, sign flip)

/** Roof deck polygon in world XZ: outer boundary inset by the parapet thickness. */
function roofDeckPolygon(roofId, roofSections, centre) {
  const sec = roofSections.find((s) => s.id === roofId);
  if (!sec || sec.coordinates.length < 3) return null;

  const cosLat = Math.cos((centre.lat * Math.PI) / 180);
  const outer = sec.coordinates.map(([lat, lng]) => [
    (lng - centre.lng) * 111_320 * cosLat, // x
    -(lat - centre.lat) * 111_320,         // z
  ]);
  const inset = insetPolygon(outer, PARAPET_T);
  const src = inset && inset.length >= 3 ? inset : outer;
  return src.map(([x, z]) => ({ x, z }));
}

/** Ray-casting point-in-polygon — valid for convex AND concave polygons. */
function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, zi = poly[i].z;
    const xj = poly[j].x, zj = poly[j].z;
    if (
      (zi > z) !== (zj > z) &&
      x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * The four footprint corners (world XZ) of a w×l box centred at (cx,cz) rotated
 * by `rot` about the vertical axis.  Three.js +Y rotation maps a local offset
 * (lx,lz) → (lx·cos + lz·sin, −lx·sin + lz·cos).
 */
function footprintCorners(cx, cz, w, l, rot) {
  const hw = w / 2, hl = l / 2;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([lx, lz]) => ({
    x: cx + lx * cos + lz * sin,
    z: cz - lx * sin + lz * cos,
  }));
}

/** True when every footprint corner lies inside the polygon. */
function footprintInside(cx, cz, w, l, rot, poly) {
  return footprintCorners(cx, cz, w, l, rot).every((c) =>
    pointInPolygon(c.x, c.z, poly),
  );
}

/**
 * Constrain a proposed centre so the whole footprint stays inside ANY polygon.
 * If the diagonal move would exit, fall back to axis-separated sliding (X-only,
 * then Z-only) so the obstacle slides along edges / notch walls instead of
 * escaping or sticking.  If neither axis is valid, keep the last valid centre.
 */
function constrainFootprint(prev, proposed, w, l, rot, poly) {
  if (footprintInside(proposed.x, proposed.z, w, l, rot, poly)) return proposed;

  const slideX = { x: proposed.x, z: prev.z };
  const slideZ = { x: prev.x, z: proposed.z };
  const okX = footprintInside(slideX.x, slideX.z, w, l, rot, poly);
  const okZ = footprintInside(slideZ.x, slideZ.z, w, l, rot, poly);

  if (okX && okZ) {
    return Math.abs(proposed.x - prev.x) >= Math.abs(proposed.z - prev.z)
      ? slideX
      : slideZ;
  }
  if (okX) return slideX;
  if (okZ) return slideZ;
  return prev;
}

// ── Shadow heatmap (4B-1): measured per-cell shade via raycasting ─────────────
//
// SEPARATE from 4A's GPU shadow-mapping: a CPU THREE.Raycaster pass.  For each
// roof we sample a coarse grid over the deck polygon, then for each cell cast a
// ray toward the sun at 30-min daylight steps; a hit on any shadow-caster mesh
// (wall / parapet / deck / obstacle) means that step is shaded.

/** HSL ramp for shade view: 0 = sunny → green(120°), 1 = fully shaded → red(0°). */
function shadeColor(target, shadePct) {
  const hue = (1 - shadePct) * 120; // 120 green → 60 yellow → 30 orange → 0 red
  return target.setHSL(hue / 360, 0.78, 0.5);
}

/** HSL ramp for exposure-score view: 0 = poor → red(0°), 100 = excellent → green(120°). */
function scoreColor(target, score) {
  const hue = (score / 100) * 120; // 0 red → 60 yellow → 120 green
  return target.setHSL(hue / 360, 0.78, 0.5);
}

// Pre-built THREE.Color objects for zone classes (avoids allocation in the hot loop).
const ZONE_COLORS = Object.fromEntries(
  Object.entries(ZONE_META).map(([cls, { color }]) => [cls, new THREE.Color(color)])
);

/** Fixed color for zone-class view. */
function zoneColor(target, zoneClass) {
  const c = ZONE_COLORS[zoneClass] ?? ZONE_COLORS.blocked;
  return target.copy(c);
}

/**
 * True if (cx, cz) falls inside the 2D footprint of any obstacle on this roof.
 *
 * Ray-origin cells that start inside an obstacle mesh are skipped by Three.js
 * front-face culling, so they would read sunny even though they're blocked.
 * We short-circuit them to fully-shaded before raycasting instead, which also
 * gives zoning the "underObstacle" non-usable flag it will need.
 *
 * Boxes:     check via point-in-rotated-rectangle using footprintCorners.
 * Cylinders: simpler radius check (radius = effectiveWidth / 2).
 */
function cellUnderObstacle(cx, cz, obstacles, roofId) {
  for (const o of obstacles) {
    if (o.roofId !== roofId) continue;
    const s   = o.scale ?? 1;
    const w   = (o.width  ?? 1) * s;
    const def = getObstacleDef(o.type);
    if (def?.shape === "cylinder") {
      if (Math.hypot(cx - o.position.x, cz - o.position.z) <= w / 2) return true;
    } else {
      const l   = (o.length ?? 1) * s;
      const rot = o.rotation ?? 0;
      const corners = footprintCorners(o.position.x, o.position.z, w, l, rot);
      if (pointInPolygon(cx, cz, corners)) return true;
    }
  }
  return false;
}

/**
 * Run the measured day-shadow analysis.
 *
 * @param {THREE.Scene} scene        live scene (source of shadow-caster meshes)
 * @param {Array}       roofSections roof model
 * @param {Array}       obstacles    current obstacle list (renderer-agnostic model)
 * @param {{lat:number,lng:number}} centre  design centre
 * @param {Date}        day          selected calendar day
 * @param {number} lat @param {number} lng  project location
 * @returns {{ day:Date, steps:number, byRoof:Object, summary:Object }}
 */
function computeShadowGrid(scene, roofSections, obstacles, centre, day, lat, lng) {
  // 1. Collect raycast targets (tagged meshes only — skips ground/arc/overlay).
  const meshes = [];
  scene.traverse((o) => {
    if (o.isMesh && o.userData && o.userData.shadowCaster) meshes.push(o);
  });

  // 2. Precompute the day's above-horizon sun directions (shared by all cells).
  const { sunriseMin, sunsetMin } = getDayTimes(day, lat, lng);
  const dirs = [];
  if (sunriseMin != null && sunsetMin != null) {
    for (let m = sunriseMin; m <= sunsetMin; m += SHADOW_STEP_MIN) {
      const sun = getSun(day, m, lat, lng);
      if (!sun.belowHorizon) {
        dirs.push(new THREE.Vector3(sun.dir.x, sun.dir.y, sun.dir.z).normalize());
      }
    }
  }
  const steps = dirs.length;

  // 3. Per-cell raycast (reuse a single raycaster + origin vector).
  const raycaster = new THREE.Raycaster();
  const origin    = new THREE.Vector3();
  const byRoof    = {};
  const allCells  = [];

  for (const sec of roofSections) {
    const deck = roofDeckPolygon(sec.id, roofSections, centre);
    if (!deck) continue;
    const baseY   = Math.max(sec.height ?? 3, 0.15) + 0.02;
    const isInside = (x, z) => pointInPolygon(x, z, deck);
    const { size, cells } = chooseCellSize(
      deck, SHADOW_CELL_SIZE, MAX_CELLS_PER_ROOF, isInside,
    );

    for (const cell of cells) {
      // Short-circuit: cells inside an obstacle footprint are always fully
      // shaded AND non-usable (a solar panel can never go there). Skipping the
      // raycast here avoids the front-face-culling false-sunny bug.
      if (cellUnderObstacle(cell.x, cell.z, obstacles, sec.id)) {
        cell.shadePct      = 1.0;
        cell.underObstacle = true;
        allCells.push(cell);
        continue;
      }

      // +0.05 m so the ray starts just above its own deck (no self-hit).
      origin.set(cell.x, baseY + 0.05, cell.z);
      let shaded = 0;
      for (let s = 0; s < steps; s++) {
        raycaster.set(origin, dirs[s]);
        if (raycaster.intersectObjects(meshes, false).length > 0) shaded++;
      }
      cell.shadePct = steps ? shaded / steps : 0;
      allCells.push(cell);
    }
    byRoof[sec.id] = { cellSize: size, baseY, cells };
  }

  return { day, steps, byRoof, summary: summarizeShade(allCells) };
}

// ── Scene bounds (shared by sun light / arc / shadow camera) ─────────────────
/**
 * Bounding radius (max distance of any roof vertex from the scene origin) and
 * tallest roof height — used to scale the sun light distance, arc radius, and
 * shadow-camera extents in the simulation.
 */
function computeSceneBounds(roofSections, centre) {
  if (!roofSections.length) return { radius: 10, height: 3 };
  const cosLat = Math.cos((centre.lat * Math.PI) / 180);
  let maxR = 5;
  let maxH = 3;
  roofSections.forEach((sec) => {
    sec.coordinates.forEach(([lat, lng]) => {
      const x = (lng - centre.lng) * 111_320 * cosLat;
      const z = (lat - centre.lat) * 111_320;
      maxR = Math.max(maxR, Math.hypot(x, z));
    });
    maxH = Math.max(maxH, sec.height ?? 3);
  });
  return { radius: maxR, height: maxH };
}

// ── THREE helpers ─────────────────────────────────────────────────────────────
function makeShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

function makePath(pts) {
  const p = new THREE.Path();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
}

// ── Key shadow light (useRef + imperative setup for clean shadow config) ──────
function ShadowLight() {
  const ref = useRef();
  useEffect(() => {
    const l = ref.current;
    if (!l) return;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.camera.near   = 0.5;
    l.shadow.camera.far    = 600;
    l.shadow.camera.left   = -120;
    l.shadow.camera.right  =  120;
    l.shadow.camera.top    =  120;
    l.shadow.camera.bottom = -120;
    l.shadow.camera.updateProjectionMatrix();
  }, []);

  return (
    <directionalLight
      ref={ref}
      position={[40, 65, 30]}
      intensity={1.55}
      color="#ffffff"
      castShadow
    />
  );
}

// ── Ground plane ──────────────────────────────────────────────────────────────
function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial color={C.ground} roughness={1} metalness={0} />
    </mesh>
  );
}

// ── Per-section roof model ────────────────────────────────────────────────────
function RoofSection({ section, isSelected, centre, placing, onPlace }) {
  const { coordinates, height = 3, pitch = 0, azimuth = 180 } = section;
  const h = Math.max(height ?? 3, 0.15);

  const geos = useMemo(() => {
    const { pts, cx, cy } = sectionToLocal(coordinates, centre);
    if (pts.length < 3) return null;

    // Centre the shape around its own footprint centroid so the pitch tilt
    // pivots correctly (around the section centre, not the scene origin).
    const cPts = pts.map(([x, y]) => [x - cx, y - cy]);

    // Inset points for the parapet inner face and roof deck
    const innerPts = insetPolygon(cPts, PARAPET_T);
    const hasParapet = innerPts && innerPts.length >= 3;

    // ── Building walls ────────────────────────────────────────────────────
    const wallGeo = new THREE.ExtrudeGeometry(
      makeShape(cPts),
      { depth: h, bevelEnabled: false },
    );

    // ── Parapet ring (outer footprint minus inset hole) ───────────────────
    let parapetGeo = null;
    if (hasParapet) {
      const ringShape = makeShape(cPts);
      // Hole must wind opposite to outer shape for ExtrudeGeometry triangulation.
      // Reverse the inner points to flip winding.
      ringShape.holes.push(makePath([...innerPts].reverse()));
      parapetGeo = new THREE.ExtrudeGeometry(
        ringShape,
        { depth: PARAPET_H, bevelEnabled: false },
      );
    }

    // ── Roof deck (inset surface, pitched) ───────────────────────────────
    const deckPts = hasParapet ? innerPts : cPts;
    const deckGeo = new THREE.ShapeGeometry(makeShape(deckPts));

    return {
      wallGeo,
      parapetGeo,
      deckGeo,
      roofEuler: computeRoofEuler(pitch, azimuth),
      cx,
      cy,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(coordinates), h, pitch, azimuth, centre.lat, centre.lng]);

  if (!geos) return null;
  const { wallGeo, parapetGeo, deckGeo, roofEuler, cx, cy } = geos;

  const deckColor = isSelected ? C.deckSelected : C.deckNormal;

  return (
    <group>

      {/*
        Building walls — extruded from ground (Y=0) to building top (Y=h).
        The group's rotation=[-π/2,0,0] lays the XY shape flat in XZ;
        the extrusion depth maps to the world +Y direction.
        position=[cx, 0, -cy] offsets to real-world XZ.
      */}
      <group rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, -cy]}>
        <mesh geometry={wallGeo} castShadow receiveShadow userData={{ shadowCaster: true }}>
          <meshStandardMaterial
            color={C.wall}
            roughness={0.86}
            metalness={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/*
        Parapet ring — hollow ring sitting on top of the building walls.
        position=[cx, h, -cy] means the extrusion starts at Y=h (world)
        and rises to Y=h+PARAPET_H.
      */}
      {parapetGeo && (
        <group rotation={[-Math.PI / 2, 0, 0]} position={[cx, h, -cy]}>
          <mesh geometry={parapetGeo} castShadow receiveShadow userData={{ shadowCaster: true }}>
            <meshStandardMaterial
              color={C.parapet}
              roughness={0.82}
              metalness={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/*
        Roof deck — sits just above the building top (Y=h+0.02), inside the parapet.
        Rotation applies the flat-horizontal base + azimuth/pitch tilt.
        Colour: accent for selected, neutral grey otherwise.
      */}
      <mesh
        geometry={deckGeo}
        rotation={roofEuler}
        position={[cx, h + 0.02, -cy]}
        castShadow
        receiveShadow
        userData={{ shadowCaster: true }}
        onClick={
          placing
            ? (e) => {
                // Guard: only the nearest intersected object should trigger placement.
                // If another mesh is closer (obstacle, parapet, etc.) this hit is
                // deeper and should be ignored.
                if (e.intersections[0]?.object !== e.object) return;
                e.stopPropagation();
                onPlace(section.id, e.point);
              }
            : undefined
        }
      >
        <meshStandardMaterial
          color={deckColor}
          roughness={0.76}
          metalness={0}
          side={THREE.FrontSide}
        />
      </mesh>

    </group>
  );
}

// ── Obstacle primitive ────────────────────────────────────────────────────────
function ObstacleMesh({ obstacle, baseY, isSelected, placing, interactive, onSelect }) {
  const def = getObstacleDef(obstacle.type);
  if (!def) return null;

  const s = obstacle.scale ?? 1;
  const w = obstacle.width  * s;
  const l = obstacle.length * s;
  // Height is INDEPENDENT of scale (spec requirement; formerly a bug: height * s).
  const h = obstacle.height;

  // Base sits on the deck; centre the primitive at half its height.
  const cy = baseY + h / 2;
  const color = isSelected ? C.obstacleSel : C.obstacle;

  return (
    <mesh
      position={[obstacle.position.x, cy, obstacle.position.z]}
      rotation={[0, obstacle.rotation ?? 0, 0]}
      castShadow
      receiveShadow
      userData={{ shadowCaster: true }}
      // Selectable only when interactive (Step 3) and not placing. On Step 4 the
      // obstacle still renders (so it casts shadows) but ignores clicks.
      onClick={
        interactive && !placing
          ? (e) => {
              e.stopPropagation();
              onSelect(obstacle.id);
            }
          : undefined
      }
    >
      {def.shape === "cylinder" ? (
        <cylinderGeometry args={[w / 2, w / 2, h, 24]} />
      ) : (
        <boxGeometry args={[w, h, l]} />
      )}
      <meshStandardMaterial
        color={color}
        emissive={isSelected ? C.obstacleSel : "#000000"}
        emissiveIntensity={isSelected ? 0.35 : 0}
        roughness={0.7}
        metalness={0.05}
      />
    </mesh>
  );
}

// ── All obstacles ─────────────────────────────────────────────────────────────
function Obstacles({
  obstacles, roofSections, selectedObstacleId, gizmoActive, placing, interactive, onSelect,
}) {
  return obstacles.map((o) => {
    // When the transform gizmo is active, it renders the selected obstacle's
    // proxy mesh, so we hide the regular mesh to avoid overlap.
    if (gizmoActive && o.id === selectedObstacleId) return null;
    const sec = roofSections.find((s) => s.id === o.roofId);
    if (!sec) return null; // roof deleted — cleanup handles state removal
    const baseY = Math.max(sec.height ?? 3, 0.15) + 0.02;
    return (
      <ObstacleMesh
        key={o.id}
        obstacle={o}
        baseY={baseY}
        isSelected={interactive && o.id === selectedObstacleId}
        placing={placing}
        interactive={interactive}
        onSelect={onSelect}
      />
    );
  });
}

// ── Transform gizmo (selected obstacle) ──────────────────────────────────────
/**
 * Wraps the selected obstacle's proxy mesh in Drei's <TransformControls>.
 *
 * Commit-on-release strategy: the model (obstacles[]) is only updated on
 * onMouseUp, never during drag.  This prevents React from re-applying JSX
 * position props to a mesh currently owned by TransformControls (which would
 * cause jitter).
 *
 * Scale semantics: obstacle.scale multiplies Width and Length only.  Height is
 * independent.  During a scale drag we reset mesh.scale.y = 1 so height never
 * changes visually; on release we commit the XZ-average delta × dragStartScale.
 */
function TransformGizmo({
  obstacle, mode, orbitRef, onUpdate, roofSections, centre,
  onMeasureActivityChange = () => {},
  onLiveScaleChange = () => {},
}) {
  const tcRef        = useRef(null);
  const meshRef      = useRef(null);
  const dragStartRef = useRef(null);
  // Last footprint-valid centre during a translate drag (for axis-sep sliding).
  const lastValidRef = useRef(null);

  const def  = getObstacleDef(obstacle.type);
  const sec  = roofSections.find((s) => s.id === obstacle.roofId);
  const baseY = sec ? Math.max(sec.height ?? 3, 0.15) + 0.02 : 0;

  const s  = obstacle.scale ?? 1;
  const w  = obstacle.width  * s;
  const l  = obstacle.length * s;
  const h  = obstacle.height; // height is NOT scaled
  const cy = baseY + h / 2;

  // Roof deck polygon (world XZ) the footprint is confined to. Recomputed only
  // when the roof boundary / design centre changes.
  const deckPoly = useMemo(
    () => roofDeckPolygon(obstacle.roofId, roofSections, centre),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [obstacle.roofId, roofSections, centre.lat, centre.lng],
  );

  // Axis visibility per mode ─────────────────────────────────────────────────
  useEffect(() => {
    const tc = tcRef.current;
    if (!tc) return;
    if (mode === "translate") {
      tc.showX = true; tc.showY = false; tc.showZ = true;
    } else if (mode === "rotate") {
      tc.showX = false; tc.showY = true; tc.showZ = false;
    } else { // scale
      tc.showX = true; tc.showY = true; tc.showZ = true;
    }
  }, [mode]);

  // ── Drag lifecycle ────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(() => {
    if (orbitRef.current) orbitRef.current.enabled = false;
    dragStartRef.current = { scale: obstacle.scale ?? 1 };
    // Seed the slide reference with the obstacle's current (valid) position.
    lastValidRef.current = { x: obstacle.position.x, z: obstacle.position.z };
    onMeasureActivityChange(true);
  }, [orbitRef, obstacle.scale, obstacle.position.x, obstacle.position.z, onMeasureActivityChange]);

  // ── Why we read mesh.parent, not mesh ─────────────────────────────────────
  // Drei's <TransformControls> renders its children inside a sibling <group>
  // and calls tc.attach(group).  TC therefore modifies GROUP.position /
  // .rotation / .scale — never the child mesh's own transform.
  // Our mesh.position stays fixed at its JSX-prop value throughout the drag.
  // World position of the mesh = parent.position + mesh.position
  //   (parent starts at origin; mesh local pos is the pre-drag obstacle coords)
  // To read the dragged world position: worldX = parent.pos.x + mesh.pos.x
  // To write a clamped world position:  parent.pos.x = clamped.x − mesh.pos.x
  // On mouseUp we reset parent to identity so the next render (which sets
  // mesh.pos to the committed obstacle coords) lands at the correct world pos.

  const handleMouseUp = useCallback(() => {
    if (orbitRef.current) orbitRef.current.enabled = true;
    const mesh = meshRef.current;
    if (!mesh || !mesh.parent || !dragStartRef.current) return;
    const parent = mesh.parent; // Drei's internal group — what TC attaches to

    if (mode === "translate") {
      const worldX = parent.position.x + mesh.position.x;
      const worldZ = parent.position.z + mesh.position.z;
      const rot = obstacle.rotation ?? 0;
      let next = { x: worldX, z: worldZ };
      if (deckPoly) {
        next = constrainFootprint(
          lastValidRef.current ?? next, next, w, l, rot, deckPoly,
        );
      }
      // Reset parent to identity first: after onUpdate re-renders mesh to the
      // new obstacle.position, world pos will be 0 + new_pos = new_pos ✓
      parent.position.set(0, 0, 0);
      onUpdate(obstacle.id, { position: { x: next.x, z: next.z } });

    } else if (mode === "rotate") {
      // TC rotated the group; total world Y rotation = group delta + original.
      const newRotation = parent.rotation.y + (obstacle.rotation ?? 0);
      parent.rotation.set(0, 0, 0);
      onUpdate(obstacle.id, { rotation: newRotation });

    } else { // scale
      // TC scaled the group; use average XZ delta × pre-drag scale.
      const delta    = (parent.scale.x + parent.scale.z) / 2;
      const newScale = Math.max(0.25, Math.min(4, dragStartRef.current.scale * delta));
      parent.scale.set(1, 1, 1);
      onUpdate(obstacle.id, { scale: newScale });
    }
    dragStartRef.current = null;
    onMeasureActivityChange(false);
    onLiveScaleChange(null);
  }, [mode, obstacle, orbitRef, onUpdate, deckPoly, w, l, onMeasureActivityChange, onLiveScaleChange]);

  // ── onChange: live clamp during drag ─────────────────────────────────────
  // translate: lock Y to deck level; clamp footprint to roof polygon every
  //   pointer-move so the obstacle slides along the boundary and can't escape.
  // scale: lock group's Y scale so height never changes visually.
  const handleChange = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh || !mesh.parent) return;
    const parent = mesh.parent;

    if (mode === "translate") {
      // Reconstruct world XZ from the group delta + fixed mesh local position.
      const worldX = parent.position.x + mesh.position.x;
      const worldZ = parent.position.z + mesh.position.z;
      const rot = obstacle.rotation ?? 0;

      // Footprint-aware containment for ANY polygon (convex/concave) with
      // axis-separated sliding. Falls back to the last valid centre if stuck.
      let next = { x: worldX, z: worldZ };
      if (deckPoly) {
        next = constrainFootprint(
          lastValidRef.current ?? next, next, w, l, rot, deckPoly,
        );
        lastValidRef.current = next;
      }

      // Write the constrained position back via the parent (group) delta.
      parent.position.x = next.x - mesh.position.x;
      parent.position.z = next.z - mesh.position.z;
      parent.position.y = 0; // world Y = mesh.pos.y (= cy); lock it
    } else if (mode === "scale") {
      // TC is scaling the group; prevent height scaling by locking Y scale.
      parent.scale.y = 1;
      if (dragStartRef.current) {
        const delta = (parent.scale.x + parent.scale.z) / 2;
        const liveScale = Math.max(0.25, Math.min(4, dragStartRef.current.scale * delta));
        onLiveScaleChange(liveScale);
      }
    }
  }, [mode, w, l, obstacle.rotation, deckPoly, onLiveScaleChange]);

  if (!def) return null;

  return (
    <TransformControls
      ref={tcRef}
      mode={mode === "rotate" ? "rotate" : mode === "scale" ? "scale" : "translate"}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onChange={handleChange}
    >
      <mesh
        ref={meshRef}
        position={[obstacle.position.x, cy, obstacle.position.z]}
        rotation={[0, obstacle.rotation ?? 0, 0]}
        castShadow
        receiveShadow
      >
        {def.shape === "cylinder" ? (
          <cylinderGeometry args={[w / 2, w / 2, h, 24]} />
        ) : (
          <boxGeometry args={[w, h, l]} />
        )}
        <meshStandardMaterial
          color={C.obstacleSel}
          emissive={C.obstacleSel}
          emissiveIntensity={0.4}
          roughness={0.65}
          metalness={0.05}
        />
      </mesh>
    </TransformControls>
  );
}

// ── Camera controls + preset management ───────────────────────────────────────
// Replaces the old AutoCamera + standalone OrbitControls pair.
// On first mount  → auto-fits the perspective (3/4) view.
// On preset change → snaps the camera to the requested position; the user
//                    can then orbit / pan / zoom freely from that starting angle.
// orbitRef is now owned at Scene level and passed in, so TransformGizmo can
// disable/re-enable OrbitControls during gizmo drags.
function SceneControls({ cameraPreset, roofSections, centre, orbitRef, panelDragActive = false }) {
  const { camera } = useThree();

  useEffect(() => {
    if (orbitRef.current) {
      orbitRef.current.enabled = !panelDragActive;
    }
  }, [panelDragActive, orbitRef]);

  // Scene bounds are stored in a ref so the snap effect always reads fresh data
  // without re-triggering just because sections were edited.
  const boundsRef = useRef({ maxR: 10, maxH: 3 });
  if (roofSections.length) {
    const cosLat = Math.cos((centre.lat * Math.PI) / 180);
    const allX = [];
    const allZ = [];
    roofSections.forEach((sec) => {
      sec.coordinates.forEach(([lat, lng]) => {
        allX.push((lng - centre.lng) * 111_320 * cosLat);
        allZ.push((lat - centre.lat) * 111_320);
      });
    });
    if (allX.length) {
      boundsRef.current = {
        maxR: Math.max(...allX.map(Math.abs), ...allZ.map(Math.abs), 5),
        maxH: Math.max(...roofSections.map((s) => s.height ?? 3), 3),
      };
    }
  }

  useEffect(() => {
    // rAF ensures the OrbitControls ref is populated from R3F's first render.
    const id = requestAnimationFrame(() => {
      const controls = orbitRef.current;
      if (!controls) return;
      const { maxR, maxH } = boundsRef.current;

      if (cameraPreset === "top") {
        // Bird's-eye: camera directly overhead, tiny Z offset avoids gimbal lock.
        const d = Math.max(maxR * 3, 20);
        camera.position.set(0, d, 0.01);
        controls.target.set(0, 0, 0);
      } else {
        // Default premium 3/4 engineering perspective (south-east elevated).
        const d = Math.max(maxR * 2.6, maxH * 3, 18);
        camera.position.set(d * 0.8, d * 0.65, d);
        controls.target.set(0, maxH * 0.4, 0);
      }
      controls.update();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPreset, camera]);

  return (
    <OrbitControls
      ref={orbitRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={3}
      maxDistance={5_000}
      maxPolarAngle={Math.PI / 2 - 0.02}
    />
  );
}

// ── Shadow analysis runner (no visual; computes on demand) ───────────────────
/**
 * Watches `runToken`; when it increments, runs the measured shadow analysis on
 * the next macrotask (so the panel spinner paints first), then reports the
 * result via onResult.  Re-running is driven entirely by the token from above.
 */
function ShadowAnalysisRunner({ runToken, roofSections, obstacles, centre, day, lat, lng, onResult }) {
  const { scene } = useThree();
  const processedRef = useRef(0);

  useEffect(() => {
    if (runToken <= processedRef.current) return;
    if (lat == null || lng == null || !roofSections.length) return;
    processedRef.current = runToken;
    // setTimeout(0) yields to the browser so the loading state is painted
    // before the synchronous raycast pass blocks the thread.
    const id = setTimeout(() => {
      onResult(computeShadowGrid(scene, roofSections, obstacles, centre, day, lat, lng));
    }, 0);
    return () => clearTimeout(id);
  }, [runToken, day, lat, lng, roofSections, obstacles, centre, scene, onResult]);

  return null;
}

// ── Per-cell heatmap overlay (instanced quads) ───────────────────────────────
//
// mode="shade"      → color by shadePct         (4B: green=sunny, red=shaded)
// mode="score"      → color by exposureScore    (4C: green=excellent, red=poor)
// mode="zone-cells" → color by zoneClass        (5A: fixed per-class palette)
// mode="zone"       → NOT rendered here (5B merged polygons used instead)
//
// Geometry (positions / sizes) never changes between modes — only colors update.
function ShadowHeatmap({ result, mode = "shade", exposureResult = null, zoneResult = null }) {
  const meshRef = useRef(null);

  // Flatten per-roof cells.  Geometry always comes from result.byRoof (4B).
  // Richer cell objects (score / zoneClass) used when the matching result exists.
  const instances = useMemo(() => {
    const out = [];
    for (const roofId in result.byRoof) {
      const { baseY, cellSize, cells: shadeCells } = result.byRoof[roofId];
      const scoreCells = exposureResult?.byRoof[roofId]?.cells;
      const zoneCells  = zoneResult?.byRoof[roofId]?.cells;
      let activeCells = shadeCells;
      if (mode === "score"      && scoreCells) activeCells = scoreCells;
      if (mode === "zone-cells" && zoneCells)  activeCells = zoneCells;
      for (const c of activeCells) {
        out.push({
          x: c.x, y: baseY + 0.03, z: c.z,
          size: cellSize,
          shadePct:      c.shadePct,
          exposureScore: c.exposureScore ?? 0,
          zoneClass:     c.zoneClass ?? "blocked",
        });
      }
    }
    return out;
  }, [result, mode, exposureResult, zoneResult]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !instances.length) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const flat  = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    instances.forEach((c, i) => {
      dummy.position.set(c.x, c.y, c.z);
      dummy.quaternion.copy(flat);
      dummy.scale.set(c.size * 0.96, c.size * 0.96, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (mode === "score") {
        mesh.setColorAt(i, scoreColor(color, c.exposureScore));
      } else if (mode === "zone-cells") {
        mesh.setColorAt(i, zoneColor(color, c.zoneClass));
      } else {
        mesh.setColorAt(i, shadeColor(color, c.shadePct));
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [instances, mode]);

  if (!instances.length) return null;

  return (
    <instancedMesh
      ref={meshRef}
      key={`${instances.length}-${mode}`}
      args={[undefined, undefined, instances.length]}
      renderOrder={3}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        transparent
        opacity={0.82}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

// ── Scene (runs inside <Canvas>) ─────────────────────────────────────────────
function Scene({
  roofSections,
  selectedRoofId,
  centre,
  cameraPreset,
  obstacles,
  obstaclesEnabled,
  showObstacles,
  placing,
  selectedObstacleId,
  gizmoMode,
  simulationActive,
  // Zone editor (Step 5C)
  zoneDisplayList,
  selectedZoneId,
  onSelectZone,
  sun,
  arcPoints,
  arcHours,
  heatmapMode,
  exposureResult,
  zoneResult,
  zoneMergeResult,
  shadowRunToken,
  shadowResult,
  shadowDay,
  shadowLat,
  shadowLng,
  onShadowResult,
  onPlaceObstacle,
  onSelectObstacle,
  onUpdateObstacle,
  // Business zones (Step 5D)
  businessZones,
  showBizZones,
  isDrawingBizZone,
  onAddBizZone,
  onCancelBizDraw,
  selectedBizZoneId,
  onSelectBizZone,
  // Placement Areas (independent design workspace)
  placementAreas           = [],
  showPlacementAreas       = false,
  isDrawingPlacementArea   = false,
  onAddPlacementArea       = () => {},
  onCancelPlacementAreaDraw = () => {},
  selectedPlacementAreaId  = null,
  onSelectPlacementArea    = () => {},
  placementAreaEditMode    = PLACEMENT_AREA_EDIT_MODES.VERTICES,
  onCommitPlacementAreaPolygon = () => {},
  // Placed panels (Step 6A-3 / 6B-1)
  showPlacedPanels = false,
  placedPanels     = [],
  panelVisualContext = null,
  ghostPanelSlots  = [],
  zonesDimmed      = false,
  panelsInteractive = false,
  panelEditMode       = "select",
  selectedPanelSlotId = null,
  onSelectPanelSlot   = () => {},
  selectedArrayId     = null,
  onAddPanelSlot      = () => {},
  panelMoveEnabled    = false,
  panelSnapSlots      = [],
  onMovePanel         = () => {},
  onPanelDragActiveChange = () => {},
  panelDragActive     = false,
  nearestSnapSlotFn   = null,
  onRotatePanel       = () => {},
  presentationMode    = false,
  presentationLayers = null,
  // Engineering zone editor (Step 5 Phase 1)
  zoneEditingEnabled  = false,
  zoneEditMode        = ZONE_EDIT_MODES.VERTICES,
  onCommitZonePolygon = () => {},
  showDimensions      = false,
  measureEditRoof     = false,
}) {
  const orbitRef = useRef(null);

  const [obstacleMeasureEditing, setObstacleMeasureEditing] = useState(false);
  const [obstacleLiveScale, setObstacleLiveScale] = useState(null);
  const [zoneMeasure, setZoneMeasure] = useState({ editing: false, outerRing: null });

  // Gizmo is active when: Step 3, an obstacle is selected, and not in placement mode.
  const gizmoActive = obstaclesEnabled && !!selectedObstacleId && !placing;
  const selectedObs = gizmoActive
    ? obstacles.find((o) => o.id === selectedObstacleId)
    : null;

  const pl = presentationLayers;
  const panelsVisible = showPlacedPanels && (!presentationMode || pl?.panels !== false);
  const obstaclesVisible = showObstacles && (!presentationMode || pl?.obstacles !== false);
  const sunPathVisible = !presentationMode || pl?.sunPath !== false;
  const shadowsVisible = !presentationMode || pl?.shadows !== false;
  const heatmapVisible = simulationActive && shadowResult && heatmapMode
    && heatmapMode !== "zone" && heatmapMode !== "off"
    && (!presentationMode || pl?.heatmap === true);
  const zoneRegionsVisible = simulationActive && zoneMergeResult && (
    presentationMode
      ? (pl?.solarSuitability === true || pl?.zoneBoundaries === true)
      : (heatmapMode === "zone" || zonesDimmed)
  );
  const zoneRegionsDimmed = presentationMode
    ? (pl?.zoneBoundaries === true && pl?.solarSuitability !== true)
    : zonesDimmed;
  const bizZonesVisible = businessZones?.length > 0 && (
    presentationMode
      ? pl?.businessZones === true
      : showBizZones
  );

  const placementAreasVisible = showPlacementAreas && (
    placementAreas.some((a) => !a.deleted) || isDrawingPlacementArea
  );

  const selectedPlacementArea = useMemo(
    () => placementAreas.find((a) => a.id === selectedPlacementAreaId && !a.deleted) ?? null,
    [placementAreas, selectedPlacementAreaId],
  );

  const selectedPlacementAreaBaseY = useMemo(() => {
    if (!selectedPlacementArea) return 0;
    const sec = roofSections.find((s) => s.id === selectedPlacementArea.roofId);
    return sec?.height ?? 3;
  }, [selectedPlacementArea, roofSections]);

  const selectedEngineeringZone = useMemo(
    () => zoneDisplayList.find((z) => z.id === selectedZoneId) ?? null,
    [zoneDisplayList, selectedZoneId],
  );

  const selectedZoneBaseY = useMemo(() => {
    if (!selectedEngineeringZone || !zoneMergeResult) return 0;
    return zoneMergeResult.byRoof?.[selectedEngineeringZone.roofId]?.baseY ?? 0;
  }, [selectedEngineeringZone, zoneMergeResult]);

  const zoneEditorActive = zoneEditingEnabled
    && selectedEngineeringZone
    && !selectedEngineeringZone.deleted
    && !selectedEngineeringZone.locked
    && !presentationMode
    && !isDrawingBizZone
    && !isDrawingPlacementArea;

  const placementAreaEditorActive = selectedPlacementArea
    && !presentationMode
    && !isDrawingBizZone
    && !isDrawingPlacementArea;

  useEffect(() => {
    if (!zoneEditorActive) {
      setZoneMeasure({ editing: false, outerRing: null });
    }
  }, [zoneEditorActive]);

  const handlePlacementAreaDragActiveChange = useCallback(() => {
    // Sidebar-only selection — no scene pick suppression needed.
  }, []);

  const handleZoneDragActiveChange = useCallback(() => {
    // Engineering zone editor dormant — kept for API compatibility.
  }, []);

  // Scene bounds drive the sun light/arc/shadow-camera scale in simulation.
  // Cheap (O(vertices)); computed inline so we pass primitives (radius/height)
  // to SunSystem without an object-identity dependency.
  const bounds = computeSceneBounds(roofSections, centre);

  return (
    <>
      {/* ── Lighting ─────────────────────────────────────────────────── */}
      {/* Studio lighting for Steps 2–3; replaced by the SunSystem in Step 4
          so the simulation owns a single shadow-casting light. */}
      {!simulationActive && (
        <>
          <ambientLight intensity={0.7} color="#dce8f5" />
          <ShadowLight />
          <directionalLight position={[-28, 38, -22]} intensity={0.28} color="#b8d0f0" />
        </>
      )}

      {/* ── Solar simulation (Step 4): moving sun, real-time shadows, arc ── */}
      {simulationActive && sun && (
        <SunSystem
          sunDir={sun.dir}
          altitude={sun.altitude}
          belowHorizon={sun.belowHorizon}
          arcPoints={arcPoints}
          arcHours={arcHours}
          radius={bounds.radius}
          showSunPath={sunPathVisible}
          castShadows={shadowsVisible}
        />
      )}

      {/* ── Ground ───────────────────────────────────────────────────── */}
      <GroundPlane />

      {/* ── Roof sections ────────────────────────────────────────────── */}
      {roofSections.map((sec) => (
        <RoofSection
          key={sec.id}
          section={sec}
          isSelected={sec.id === selectedRoofId}
          centre={centre}
          placing={obstaclesEnabled && placing}
          onPlace={onPlaceObstacle}
        />
      ))}

      {/* ── Obstacles — rendered on Steps 3 & 4 (so they cast shadows);
           interactive (selectable/gizmo) on Step 3 only ──────────────── */}
      {obstaclesVisible && (
        <Obstacles
          obstacles={obstacles}
          roofSections={roofSections}
          selectedObstacleId={selectedObstacleId}
          gizmoActive={gizmoActive}
          placing={placing}
          interactive={obstaclesEnabled}
          onSelect={onSelectObstacle}
        />
      )}

      {/* ── Transform gizmo (selected obstacle, Step 3, not placing) ─── */}
      {selectedObs && (
        <TransformGizmo
          key={selectedObs.id}
          obstacle={selectedObs}
          mode={gizmoMode}
          orbitRef={orbitRef}
          onUpdate={onUpdateObstacle}
          roofSections={roofSections}
          centre={centre}
          onMeasureActivityChange={setObstacleMeasureEditing}
          onLiveScaleChange={setObstacleLiveScale}
        />
      )}

      {/* ── Shadow analysis (Step 4): on-demand measured pass + overlay ── */}
      {simulationActive && (
        <ShadowAnalysisRunner
          runToken={shadowRunToken}
          roofSections={roofSections}
          obstacles={obstacles}
          centre={centre}
          day={shadowDay}
          lat={shadowLat}
          lng={shadowLng}
          onResult={onShadowResult}
        />
      )}
      {/* Per-cell heatmap — shade, score, or zone-cells (per-cell zone colors).
          NOT rendered when mode="zone" (merged polygons render instead). */}
      {heatmapVisible && (
        <ShadowHeatmap result={shadowResult} mode={heatmapMode} exposureResult={exposureResult} zoneResult={zoneResult} />
      )}
      {/* Merged zone region polygons (Step 5B/5C) — visible in "zone" mode,
          or always (dimmed) on Step 6 when panels are shown. */}
      {zoneRegionsVisible && (
        <ZoneMergedPolygons
          mergeResult={zoneMergeResult}
          zoneDisplayList={zoneDisplayList}
          selectedZoneId={presentationMode ? null : selectedZoneId}
          dimmed={zoneRegionsDimmed}
        />
      )}

      {/* Engineering zone polygon editor (Step 5 Phase 1) */}
      {zoneEditorActive && (
        <ZonePolygonEditor
          zone={selectedEngineeringZone}
          baseY={selectedZoneBaseY}
          editMode={zoneEditMode}
          orbitRef={orbitRef}
          onCommit={onCommitZonePolygon}
          onMeasureUpdate={setZoneMeasure}
          onDragActiveChange={handleZoneDragActiveChange}
        />
      )}

      {/* ── Placement Areas (design workspace) ─────────────────────────── */}
      {placementAreasVisible && (
        <PlacementAreasLayer
          placementAreas={placementAreas}
          roofSections={roofSections}
          selectedPlacementAreaId={presentationMode ? null : selectedPlacementAreaId}
        />
      )}

      {placementAreaEditorActive && (
        <PlacementAreaPolygonEditor
          area={selectedPlacementArea}
          baseY={selectedPlacementAreaBaseY}
          editMode={placementAreaEditMode}
          orbitRef={orbitRef}
          onCommit={onCommitPlacementAreaPolygon}
          onDragActiveChange={handlePlacementAreaDragActiveChange}
        />
      )}

      {isDrawingPlacementArea && (
        <DrawPlacementAreaLayer
          roofSections={roofSections}
          centre={centre}
          orbitRef={orbitRef}
          onComplete={onAddPlacementArea}
          onCancelDraw={onCancelPlacementAreaDraw}
        />
      )}

      {/* ── Placed solar panels (Step 6A-3 / 6B-1) ───────────────────── */}
      {panelsVisible && ghostPanelSlots.length > 0 && (
        <PanelGhostSlots
          ghostSlots={ghostPanelSlots}
          roofSections={roofSections}
          onAddSlot={onAddPanelSlot}
        />
      )}
      {panelsVisible && placedPanels.length > 0 && (
        <PlacedPanels
          placedPanels={placedPanels}
          roofSections={roofSections}
          panelVisualContext={panelVisualContext}
          interactive={panelsInteractive && (presentationMode || panelEditMode === "select")}
          selectedSlotId={presentationMode ? null : selectedPanelSlotId}
          arrayHighlightRegionId={selectedArrayId}
          dimInactiveArrays={presentationMode}
          onSelectPanel={onSelectPanelSlot}
          enableMoveDrag={panelMoveEnabled && !presentationMode && panelEditMode === "select"}
          snapSlots={panelSnapSlots}
          onMovePanel={onMovePanel}
          onDragActiveChange={onPanelDragActiveChange}
          nearestSnapSlotFn={nearestSnapSlotFn}
        />
      )}

      {/* ── Business zones (Step 5D) — hatched fills + outlines + labels ── */}
      {bizZonesVisible && (
        <BusinessZonesLayer
          businessZones={businessZones}
          roofSections={roofSections}
          selectedBizZoneId={presentationMode ? null : selectedBizZoneId}
          onSelectBizZone={presentationMode ? () => {} : onSelectBizZone}
        />
      )}

      {/* ── Business zone draw mode (Step 5D) ────────────────────────── */}
      {isDrawingBizZone && (
        <DrawBizZoneLayer
          roofSections={roofSections}
          centre={centre}
          orbitRef={orbitRef}
          onAddBizZone={onAddBizZone}
          onCancelDraw={onCancelBizDraw}
        />
      )}

      {/* ── Dynamic measurement overlay (Phase 1 — visual only) ──────── */}
      <MeasurementOverlay3D
        showDimensions={showDimensions}
        measureEdit={{
          obstacle: obstacleMeasureEditing,
          zone:     zoneMeasure.editing,
          roof:     measureEditRoof,
        }}
        roofSections={roofSections}
        selectedRoofId={selectedRoofId}
        centre={centre}
        obstacles={obstacles}
        selectedObstacleId={selectedObstacleId}
        obstacleLiveScale={obstacleLiveScale}
        zoneOuterRing={zoneMeasure.outerRing}
        zoneEditorActive={zoneEditorActive}
        zoneBaseY={selectedZoneBaseY}
        placedPanels={placedPanels}
        selectedPanelSlotId={selectedPanelSlotId}
        roofSectionsForPanels={roofSections}
      />

      {/* ── Camera preset + orbit controls ───────────────────────────── */}
      <SceneControls
        orbitRef={orbitRef}
        cameraPreset={cameraPreset}
        roofSections={roofSections}
        centre={centre}
        panelDragActive={panelDragActive}
      />
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
export default function RoofView3D({
  roofSections,
  selectedRoofId,
  // Camera preset: "perspective" (default 3/4) | "top" (bird's-eye).
  cameraPreset = "perspective",
  // Obstacle props — optional so Step-2 usage is unaffected.
  obstacles = [],
  obstaclesEnabled = false,   // Step 3 — obstacles are interactive
  showObstacles = false,      // Steps 3 & 4 — obstacles render (cast shadows)
  placingObstacleType = null,
  selectedObstacleId = null,
  // Transform gizmo
  gizmoMode = "translate",
  // Simulation (Step 4)
  simulationActive = false,
  sun = null,                 // { dir:{x,y,z}, altitude, belowHorizon }
  arcPoints = [],             // [{x,y,z}] sun path unit dirs
  arcHours  = [],             // [{hour, label, dir}] hourly tick markers on the arc
  // Heatmap display mode: "shade" (4B) | "score" (4C) | "zone" (5B merged) | "zone-cells" (5A per-cell)
  heatmapMode  = "shade",
  exposureResult  = null,
  zoneResult      = null,
  zoneMergeResult = null,
  // Zone editor (Step 5C) — enriched display list + selection
  zoneDisplayList  = [],
  selectedZoneId   = null,
  onSelectZone     = () => {},
  // Shadow heatmap (Step 4B-1)
  shadowRunToken = 0,         // bump to trigger an on-demand analysis
  shadowResult = null,        // { byRoof, summary, steps, day } | null
  shadowDay = null,           // selected calendar day (Date)
  shadowLat = null,
  shadowLng = null,
  onShadowResult = () => {},
  onPlaceObstacle    = () => {},
  onSelectObstacle   = () => {},
  onDeselectObstacle = () => {},
  onUpdateObstacle   = () => {},
  onDeleteObstacle   = () => {},
  onSetGizmoMode     = () => {},
  // Business zones (Step 5D)
  businessZones      = [],
  showBizZones       = false,
  isDrawingBizZone   = false,
  onAddBizZone       = () => {},
  onCancelBizDraw    = () => {},
  selectedBizZoneId  = null,
  onSelectBizZone    = () => {},
  // Placement Areas
  placementAreas           = [],
  showPlacementAreas       = false,
  isDrawingPlacementArea   = false,
  onAddPlacementArea       = () => {},
  onCancelPlacementAreaDraw = () => {},
  selectedPlacementAreaId  = null,
  onSelectPlacementArea    = () => {},
  placementAreaEditMode    = PLACEMENT_AREA_EDIT_MODES.VERTICES,
  onSetPlacementAreaEditMode = () => {},
  onCommitPlacementAreaPolygon = () => {},
  // Placed panels (Step 6A-3 / 6B-1)
  showPlacedPanels   = false,
  placedPanels       = [],
  panelVisualContext = null,
  ghostPanelSlots    = [],
  zonesDimmed        = false,
  panelsInteractive  = false,
  panelEditMode      = "select",
  onSetPanelEditMode = () => {},
  selectedPanelSlotId = null,
  onSelectPanelSlot   = () => {},
  onDeselectPanelSlot = () => {},
  selectedArrayId     = null,
  onDeselectArray     = () => {},
  onDeletePanelSlot   = () => {},
  onAddPanelSlot      = () => {},
  onUndoPanelEdit     = () => {},
  onRedoPanelEdit     = () => {},
  panelCanUndo        = false,
  panelCanRedo        = false,
  panelMoveEnabled    = false,
  panelSnapSlots      = [],
  onMovePanel         = () => {},
  onPanelDragActiveChange = () => {},
  panelDragActive     = false,
  nearestSnapSlotFn   = null,
  onRotatePanel       = () => {},
  presentationMode    = false,
  presentationLayers = null,
  zoneEditingEnabled  = false,
  zoneEditMode        = ZONE_EDIT_MODES.VERTICES,
  onSetZoneEditMode   = () => {},
  onCommitZonePolygon = () => {},
  showDimensions      = false,
  measureEditRoof     = false,
}) {
  // Design centre: shared origin for all section coordinate conversions.
  // Only recomputes when coordinates change, not on every metadata edit.
  const centre = useMemo(
    () => computeDesignCenter(roofSections),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(roofSections.map((s) => s.coordinates))],
  );

  const placing = obstaclesEnabled && placingObstacleType != null;

  return (
    /*
      The wrapper div carries the graded background.
      Canvas uses alpha=true so the WebGL clear is transparent and the CSS
      gradient shows through as the backdrop.
    */
    <div
      className="h-full w-full rounded-[20px] overflow-hidden border border-[#23324A] relative"
      style={{
        background:
          "radial-gradient(ellipse at 50% 22%, #1e3050 0%, #0e1d32 40%, #070f1b 100%)",
        cursor: (placing || isDrawingBizZone || isDrawingPlacementArea) ? "crosshair" : "default",
      }}
    >

      {roofSections.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-[#94A3B8]">No roof sections to render.</p>
          <p className="text-xs text-[#4a5c75]">Draw at least one section in 2D first.</p>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-[#4a5c75]">Initialising 3D scene…</span>
            </div>
          }
        >
          <Canvas
            shadows
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [30, 24, 30], fov: 45, near: 0.1, far: 10_000 }}
            // Click on empty space deselects (obstacles / panels when interactive).
            onPointerMissed={() => {
              if (!placing) onDeselectObstacle();
              if (panelsInteractive) {
                onDeselectPanelSlot();
                onDeselectArray();
              }
            }}
          >
            <Scene
              roofSections={roofSections}
              selectedRoofId={selectedRoofId}
              centre={centre}
              cameraPreset={cameraPreset}
              obstacles={obstacles}
              obstaclesEnabled={obstaclesEnabled}
              showObstacles={showObstacles}
              placing={placing}
              selectedObstacleId={selectedObstacleId}
              gizmoMode={gizmoMode}
              simulationActive={simulationActive}
              sun={sun}
              arcPoints={arcPoints}
              arcHours={arcHours}
              heatmapMode={heatmapMode}
              exposureResult={exposureResult}
              zoneResult={zoneResult}
              zoneMergeResult={zoneMergeResult}
              zoneDisplayList={zoneDisplayList}
              selectedZoneId={selectedZoneId}
              onSelectZone={onSelectZone}
              shadowRunToken={shadowRunToken}
              shadowResult={shadowResult}
              shadowDay={shadowDay}
              shadowLat={shadowLat}
              shadowLng={shadowLng}
              onShadowResult={onShadowResult}
              onPlaceObstacle={onPlaceObstacle}
              onSelectObstacle={onSelectObstacle}
              onUpdateObstacle={onUpdateObstacle}
              businessZones={businessZones}
              showBizZones={showBizZones}
              isDrawingBizZone={isDrawingBizZone}
              onAddBizZone={onAddBizZone}
              onCancelBizDraw={onCancelBizDraw}
              selectedBizZoneId={selectedBizZoneId}
              onSelectBizZone={onSelectBizZone}
              placementAreas={placementAreas}
              showPlacementAreas={showPlacementAreas}
              isDrawingPlacementArea={isDrawingPlacementArea}
              onAddPlacementArea={onAddPlacementArea}
              onCancelPlacementAreaDraw={onCancelPlacementAreaDraw}
              selectedPlacementAreaId={selectedPlacementAreaId}
              onSelectPlacementArea={onSelectPlacementArea}
              placementAreaEditMode={placementAreaEditMode}
              onCommitPlacementAreaPolygon={onCommitPlacementAreaPolygon}
              showPlacedPanels={showPlacedPanels}
              placedPanels={placedPanels}
              panelVisualContext={panelVisualContext}
              ghostPanelSlots={ghostPanelSlots}
              zonesDimmed={zonesDimmed}
              panelsInteractive={panelsInteractive}
              panelEditMode={panelEditMode}
              selectedPanelSlotId={selectedPanelSlotId}
              onSelectPanelSlot={onSelectPanelSlot}
              selectedArrayId={selectedArrayId}
              onAddPanelSlot={onAddPanelSlot}
              panelMoveEnabled={panelMoveEnabled}
              panelSnapSlots={panelSnapSlots}
              onMovePanel={onMovePanel}
              onPanelDragActiveChange={onPanelDragActiveChange}
              panelDragActive={panelDragActive}
              nearestSnapSlotFn={nearestSnapSlotFn}
              presentationMode={presentationMode}
              presentationLayers={presentationLayers}
              zoneEditingEnabled={zoneEditingEnabled}
              zoneEditMode={zoneEditMode}
              onCommitZonePolygon={onCommitZonePolygon}
              showDimensions={showDimensions}
              measureEditRoof={measureEditRoof}
            />
          </Canvas>
        </Suspense>
      )}

      {/* ── Placement Area edit toolbar ─────────────────────────────────── */}
      {selectedPlacementAreaId && !isDrawingBizZone && !isDrawingPlacementArea && showPlacementAreas && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1 bg-[rgba(16,27,45,0.88)] backdrop-blur-xl border border-[#23324A] rounded-full shadow-lg">
          <button
            onClick={() => onSetPlacementAreaEditMode(PLACEMENT_AREA_EDIT_MODES.VERTICES)}
            title="Edit vertices"
            className={[
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
              placementAreaEditMode === PLACEMENT_AREA_EDIT_MODES.VERTICES
                ? "bg-[#06B6D4] text-white shadow-sm"
                : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5",
            ].join(" ")}
          >
            <FiEdit2 size={14} />
            <span>Vertices</span>
          </button>
          <button
            onClick={() => onSetPlacementAreaEditMode(PLACEMENT_AREA_EDIT_MODES.MOVE)}
            title="Move polygon"
            className={[
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
              placementAreaEditMode === PLACEMENT_AREA_EDIT_MODES.MOVE
                ? "bg-[#06B6D4] text-white shadow-sm"
                : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5",
            ].join(" ")}
          >
            <FiMove size={14} />
            <span>Move</span>
          </button>
        </div>
      )}

      {/* ── Engineering zone edit toolbar (Step 5 Phase 1) ─────────────── */}
      {zoneEditingEnabled && selectedZoneId && !isDrawingBizZone && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1 bg-[rgba(16,27,45,0.88)] backdrop-blur-xl border border-[#23324A] rounded-full shadow-lg">
          <button
            onClick={() => onSetZoneEditMode(ZONE_EDIT_MODES.VERTICES)}
            title="Edit vertices"
            className={[
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
              zoneEditMode === ZONE_EDIT_MODES.VERTICES
                ? "bg-[#4F8CFF] text-white shadow-sm"
                : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5",
            ].join(" ")}
          >
            <FiEdit2 size={14} />
            <span>Vertices</span>
          </button>
          <button
            onClick={() => onSetZoneEditMode(ZONE_EDIT_MODES.MOVE)}
            title="Move polygon"
            className={[
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
              zoneEditMode === ZONE_EDIT_MODES.MOVE
                ? "bg-[#4F8CFF] text-white shadow-sm"
                : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5",
            ].join(" ")}
          >
            <FiMove size={14} />
            <span>Move</span>
          </button>
        </div>
      )}

      {/* ── Panel edit toolbar (Step 6B-1) ─────────────────────────────── */}
      {panelsInteractive && !presentationMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1 bg-[rgba(16,27,45,0.88)] backdrop-blur-xl border border-[#23324A] rounded-full shadow-lg">
          <button
            onClick={() => onSetPanelEditMode("select")}
            title="Select panels"
            className={[
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
              panelEditMode === "select"
                ? "bg-[#4F8CFF] text-white shadow-sm"
                : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5",
            ].join(" ")}
          >
            <FiMousePointer size={14} />
            <span>Select</span>
          </button>
          <button
            onClick={() => onSetPanelEditMode("add")}
            title="Add panels from ghost slots"
            className={[
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
              panelEditMode === "add"
                ? "bg-[#4F8CFF] text-white shadow-sm"
                : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5",
            ].join(" ")}
          >
            <FiPlus size={14} />
            <span>Add</span>
          </button>
          <div className="w-px h-5 bg-[#23324A] mx-1" />
          {panelMoveEnabled && (
            <button
              onClick={onRotatePanel}
              disabled={!selectedPanelSlotId || panelEditMode !== "select"}
              title="Rotate selected panel (portrait ⇄ landscape)"
              className={[
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
                selectedPanelSlotId && panelEditMode === "select"
                  ? "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5"
                  : "text-[#94A3B8]/30 cursor-not-allowed",
              ].join(" ")}
            >
              <FiRotateCcw size={14} />
              <span>Rotate</span>
            </button>
          )}
          <div className="w-px h-5 bg-[#23324A] mx-1" />
          <button
            onClick={onDeletePanelSlot}
            disabled={!selectedPanelSlotId || panelEditMode !== "select"}
            title="Delete selected panel"
            className={[
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
              selectedPanelSlotId && panelEditMode === "select"
                ? "text-[#94A3B8] hover:text-red-400 hover:bg-red-400/10"
                : "text-[#94A3B8]/30 cursor-not-allowed",
            ].join(" ")}
          >
            <FiTrash2 size={14} />
            <span>Delete</span>
          </button>
          <div className="w-px h-5 bg-[#23324A] mx-1" />
          <button
            onClick={onUndoPanelEdit}
            disabled={!panelCanUndo}
            title="Undo (Ctrl+Z)"
            className={[
              "flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
              panelCanUndo
                ? "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5"
                : "text-[#94A3B8]/30 cursor-not-allowed",
            ].join(" ")}
          >
            <FiCornerUpLeft size={14} />
          </button>
          <button
            onClick={onRedoPanelEdit}
            disabled={!panelCanRedo}
            title="Redo (Ctrl+Y)"
            className={[
              "flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
              panelCanRedo
                ? "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5"
                : "text-[#94A3B8]/30 cursor-not-allowed",
            ].join(" ")}
          >
            <FiCornerUpRight size={14} />
          </button>
        </div>
      )}

      {/* ── Transform toolbar — contextual, shown only when an obstacle is
           selected in Step 3 and not in placement mode ── */}
      {obstaclesEnabled && selectedObstacleId && !placing && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1 bg-[rgba(16,27,45,0.88)] backdrop-blur-xl border border-[#23324A] rounded-full shadow-lg">
          {GIZMO_MODES.map(({ mode, Icon, label }) => (
            <button
              key={mode}
              onClick={() => onSetGizmoMode(mode)}
              title={label}
              className={[
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
                gizmoMode === mode
                  ? "bg-[#4F8CFF] text-white shadow-sm"
                  : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5",
              ].join(" ")}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
          <div className="w-px h-5 bg-[#23324A] mx-1" />
          <button
            onClick={() => onDeleteObstacle(selectedObstacleId)}
            title="Delete obstacle"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium text-[#94A3B8] hover:text-red-400 hover:bg-red-400/10 transition-all duration-150 select-none"
          >
            <FiTrash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Overlay — view label (bottom-right, clear of the top-left toggle) */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-xl bg-[rgba(10,18,32,0.72)] backdrop-blur-md border border-[#23324A]">
        <span className="text-[10px] text-[#94A3B8]">
          {cameraPreset === "top" ? "Top View" : "3D View"} ·&nbsp;
          {roofSections.length}&nbsp;section{roofSections.length !== 1 ? "s" : ""}
          {obstaclesEnabled && obstacles.length > 0 && (
            <>&nbsp;· {obstacles.length}&nbsp;obstacle{obstacles.length !== 1 ? "s" : ""}</>
          )}
          &nbsp;· Orbit · Pan · Zoom
        </span>
      </div>

      {/* Panel edit hints (Step 6B-1) */}
      {!presentationMode && panelsInteractive && panelEditMode === "add" && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl bg-[rgba(79,140,255,0.16)] backdrop-blur-md border border-[#4F8CFF]/40">
          <span className="text-[11px] text-[#cfe0ff]">
            Click a <b>ghost slot</b> to add a panel · Esc to return to Select
          </span>
        </div>
      )}
      {!presentationMode && panelsInteractive && panelEditMode === "select" && selectedPanelSlotId && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl bg-[rgba(16,27,45,0.88)] backdrop-blur-md border border-[#23324A]">
          <span className="text-[11px] text-[#94A3B8]">
            Panel selected · drag to snap · <b>Rotate</b> · <b>Delete</b> / Del · Esc to deselect
          </span>
        </div>
      )}
      {presentationMode && selectedArrayId && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl bg-[rgba(255,181,71,0.12)] backdrop-blur-md border border-[#FFB547]/35">
          <span className="text-[11px] text-[#ffe8c4]">
            Array highlighted · click empty space to reset
          </span>
        </div>
      )}

      {/* Placement hint — bottom centre while a type is selected */}
      {placing && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl bg-[rgba(79,140,255,0.16)] backdrop-blur-md border border-[#4F8CFF]/40">
          <span className="text-[11px] text-[#cfe0ff]">
            Click the roof to place <b>{placingObstacleType}</b> · Esc to stop
          </span>
        </div>
      )}

    </div>
  );
}
