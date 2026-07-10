/**
 * placementReady.js — Step 5H placement-readiness export (renderer-agnostic, pure).
 *
 * Assembles the SINGLE contract Step 6 (panel placement) consumes, derived live
 * from the current zoning state.  No React, no Three.js, no button snapshots.
 *
 * Data flow (all inputs are already computed upstream):
 *   placementAreas   — engineer-drawn installable polygons (preferred when present)
 *   zoneDisplayList  — 5B merged sim regions + 5C edits (fallback installable source)
 *   businessZones    — 5D user-drawn rectangles
 *   obstacles        — Step 3 placed obstacles (scene XZ footprints)
 *   roofSections     — Step 2 roof metadata (pitch, azimuth, boundary, …)
 *
 * Installable geometry pipeline:
 *   1. Merge touching engineering polygons (same roof + effectiveClass).
 *   2. Simplify merged engineering boundaries (staircase reduction).
 *   3. turf.difference() each business zone + obstacle on the same roof.
 *   → Unified installable shapes Step 6 fills as continuous arrays.
 *
 * Coordinate convention (shared with zoneMerge / bizZoneConfig):
 *   outerRing / holes: [[x, z], …] scene metres (X = East, Z = South)
 *   Rings are NOT closed (first ≠ last vertex).
 */

import {
  polygon   as turfPolygon,
  difference as turfDifference,
} from "@turf/turf";

import { getObstacleDef } from "../obstacles/obstacleTypes";
import { prepareEngineeringPlacementRegions } from "./engineeringPlacementPrep";

/** Map Placement Area stats.quality → zoneClass for UI / array metadata. */
function qualityToZoneClass(quality) {
  switch (quality) {
    case "Excellent": return "excellent";
    case "Good":      return "good";
    case "Average":   return "average";
    case "Avoid":     return "avoid";
    default:          return "good";
  }
}

/** Region id for a post-subtraction piece (single piece keeps bare area id). */
function regionIdForPiece(areaId, idx, pieceCount) {
  if (pieceCount === 1) return areaId;
  return `${areaId}::${idx}`;
}

// ── Area / ring helpers ───────────────────────────────────────────────────────

export function shoelaceAreaM2(ring) {
  if (!ring || ring.length < 3) return 0;
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return Math.abs(a) / 2;
}

function ringAreaWithHoles(outerRing, holes = []) {
  const outerA = shoelaceAreaM2(outerRing);
  const holesA = holes.reduce((s, h) => s + shoelaceAreaM2(h), 0);
  return Math.max(0, outerA - holesA);
}

function openRing(closed) {
  if (!closed?.length) return [];
  const pts = closed.map(([x, z]) => [x, z]);
  const first = pts[0];
  const last  = pts[pts.length - 1];
  if (pts.length > 1 && first[0] === last[0] && first[1] === last[1]) {
    return pts.slice(0, -1);
  }
  return pts;
}

function xzToClosedRing(ring) {
  const pts = ring.map(([x, z]) => [x, z]);
  const first = pts[0];
  const last  = pts[pts.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) pts.push([first[0], first[1]]);
  return pts;
}

// ── Turf conversions ──────────────────────────────────────────────────────────

function regionToTurfPoly(polygon) {
  const { outerRing, holes = [] } = polygon;
  const outer = xzToClosedRing(outerRing);
  const holeRings = holes.map(xzToClosedRing);
  return turfPolygon([outer, ...holeRings]);
}

function ringToTurfPoly(ring) {
  return turfPolygon([xzToClosedRing(ring)]);
}

/** Decompose a turf Polygon / MultiPolygon feature into { outerRing, holes, areaM2 }[]. */
function turfFeatureToPolygons(feature) {
  if (!feature?.geometry) return [];
  const { type, coordinates } = feature.geometry;

  const fromPolyCoords = (coords) => {
    const outerRing = openRing(coords[0]);
    if (outerRing.length < 3) return null;
    const holes = coords.slice(1).map(openRing).filter((h) => h.length >= 3);
    return {
      outerRing,
      holes,
      areaM2: ringAreaWithHoles(outerRing, holes),
    };
  };

  if (type === "Polygon") {
    const p = fromPolyCoords(coordinates);
    return p ? [p] : [];
  }
  if (type === "MultiPolygon") {
    return coordinates.map(fromPolyCoords).filter(Boolean);
  }
  return [];
}

/** Sequentially subtract turf polygon features; returns remaining polygon pieces. */
function subtractPolygons(baseFeature, subtractors) {
  let current = baseFeature;
  for (const sub of subtractors) {
    if (!current) return [];
    try {
      current = turfDifference(current, sub) ?? null;
    } catch {
      // Degenerate overlap — keep current unchanged.
    }
  }
  if (!current) return [];
  return turfFeatureToPolygons(current);
}

// ── Obstacle footprint rings (scene XZ) ───────────────────────────────────────

/**
 * Rotated box footprint corners → open ring [[x,z],…].
 * Matches RoofView3D footprintCorners convention.
 */
function boxFootprintRing(cx, cz, w, l, rot) {
  const hw = w / 2;
  const hl = l / 2;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([lx, lz]) => [
    cx + lx * cos + lz * sin,
    cz - lx * sin + lz * cos,
  ]);
}

/** Cylinder footprint as a regular N-gon approximation. */
function cylinderFootprintRing(cx, cz, diameter, segments = 24) {
  const r = diameter / 2;
  const ring = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return ring;
}

/** Scene-XZ outer ring for a placed obstacle. */
export function obstacleOuterRing(obstacle) {
  const def = getObstacleDef(obstacle.type);
  const s   = obstacle.scale ?? 1;
  const w   = (obstacle.width  ?? 0) * s;
  const l   = (obstacle.length ?? 0) * s;
  const rot = obstacle.rotation ?? 0;
  const cx  = obstacle.position?.x ?? 0;
  const cz  = obstacle.position?.z ?? 0;

  if (def?.shape === "cylinder") {
    return cylinderFootprintRing(cx, cz, w);
  }
  return boxFootprintRing(cx, cz, w, l, rot);
}

// ── Roof reference (Step 6 geometric frame) ───────────────────────────────────

function buildRoofRefs(roofSections) {
  return roofSections.map((s) => ({
    id:          s.id,
    name:        s.name,
    coordinates: s.coordinates,
    pitch:       s.pitch    ?? 0,
    azimuth:     s.azimuth  ?? 180,
    setback:     s.setback  ?? 0,
    height:      s.height   ?? 3,
  }));
}

function roofOrientation(roofRefs, roofId) {
  const roof = roofRefs.find((r) => r.id === roofId);
  return {
    pitch:   roof?.pitch   ?? 0,
    azimuth: roof?.azimuth ?? 180,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Assemble the placement-readiness contract for Step 6.
 *
 * @param {object} params
 * @param {object[]} params.placementAreas   Engineer-drawn placement areas
 * @param {object[]} params.zoneDisplayList  Enriched sim zones (5B + 5C, fallback)
 * @param {object[]} params.businessZones      User-drawn business zones (5D)
 * @param {object[]} params.obstacles          Placed obstacles (Step 3)
 * @param {object[]} params.roofSections       Roof section metadata (Step 2)
 * @returns {object|null} placementReady contract, or null when no roofs exist
 */
export function computePlacementReady({
  placementAreas   = [],
  zoneDisplayList  = [],
  businessZones    = [],
  obstacles        = [],
  roofSections     = [],
}) {
  if (!roofSections.length) return null;

  const roofRefs = buildRoofRefs(roofSections);
  const activeBiz = businessZones.filter((b) => !b.deleted);
  const activePlacementAreas = placementAreas.filter((a) => !a.deleted);
  const usePlacementAreas = activePlacementAreas.length > 0;

  const installableRegions = [];
  let prepStats = null;

  if (usePlacementAreas) {
    // ── Installable regions from Placement Areas (exclusive when present) ───
    for (const area of activePlacementAreas) {
      const polygon = area.polygon;
      if (!polygon?.outerRing || polygon.outerRing.length < 3) continue;

      const { pitch, azimuth } = roofOrientation(roofRefs, area.roofId);

      const bizOnRoof = activeBiz
        .filter((b) => b.roofId === area.roofId)
        .map((b) => ringToTurfPoly(b.outerRing));

      const obsOnRoof = obstacles
        .filter((o) => o.roofId === area.roofId)
        .map((o) => ringToTurfPoly(obstacleOuterRing(o)));

      let pieces;
      try {
        pieces = subtractPolygons(
          regionToTurfPoly(polygon),
          [...bizOnRoof, ...obsOnRoof],
        );
      } catch {
        pieces = [{
          outerRing: polygon.outerRing,
          holes:     polygon.holes ?? [],
          areaM2:    ringAreaWithHoles(polygon.outerRing, polygon.holes),
        }];
      }

      const zoneClass = qualityToZoneClass(area.stats?.quality);

      pieces.forEach((piece, idx) => {
        if (piece.areaM2 < 0.01) return;
        installableRegions.push({
          id:        regionIdForPiece(area.id, idx, pieces.length),
          sourceId:  area.id,
          roofId:    area.roofId,
          zoneClass,
          outerRing: piece.outerRing,
          holes:     piece.holes,
          areaM2:    piece.areaM2,
          pitch,
          azimuth,
          avgScore:  area.stats?.avgScore ?? null,
          name:      area.name,
        });
      });
    }
  } else {
    // ── Fallback: Excellent + Good engineering regions (geometry-cut) ───────
    const installableSims = zoneDisplayList.filter(
      (z) => !z.deleted &&
        (z.effectiveClass === "excellent" || z.effectiveClass === "good"),
    );

    const engineeringPrep = prepareEngineeringPlacementRegions(installableSims);
    prepStats = engineeringPrep.prepStats;

    for (const engRegion of engineeringPrep.regions) {
      const { pitch, azimuth } = roofOrientation(roofRefs, engRegion.roofId);

      const bizOnRoof = activeBiz
        .filter((b) => b.roofId === engRegion.roofId)
        .map((b) => ringToTurfPoly(b.outerRing));

      const obsOnRoof = obstacles
        .filter((o) => o.roofId === engRegion.roofId)
        .map((o) => ringToTurfPoly(obstacleOuterRing(o)));

      let pieces;
      try {
        pieces = subtractPolygons(
          regionToTurfPoly(engRegion.polygon),
          [...bizOnRoof, ...obsOnRoof],
        );
      } catch {
        pieces = [{
          outerRing: engRegion.polygon.outerRing,
          holes:     engRegion.polygon.holes ?? [],
          areaM2:    ringAreaWithHoles(
            engRegion.polygon.outerRing,
            engRegion.polygon.holes,
          ),
        }];
      }

      const sourceKey = engRegion.sourceIds.join("+");

      pieces.forEach((piece, idx) => {
        if (piece.areaM2 < 0.01) return;
        installableRegions.push({
          id:        `eng::${engRegion.roofId}::${engRegion.zoneClass}::${sourceKey}::${idx}`,
          sourceId:  engRegion.sourceIds[0] ?? sourceKey,
          sourceIds: engRegion.sourceIds,
          roofId:    engRegion.roofId,
          zoneClass: engRegion.zoneClass,
          outerRing: piece.outerRing,
          holes:     piece.holes,
          areaM2:    piece.areaM2,
          pitch,
          azimuth,
          avgScore:  engRegion.avgScore ?? null,
          name:      engRegion.name,
          merged:    engRegion.sourceIds.length > 1,
        });
      });
    }
  }

  // ── Blocked keep-out regions ───────────────────────────────────────────────
  const blockedRegions = [];

  // Obstacles
  for (const obs of obstacles) {
    const outerRing = obstacleOuterRing(obs);
    if (outerRing.length < 3) continue;
    blockedRegions.push({
      id:        obs.id,
      roofId:    obs.roofId,
      source:    "obstacle",
      outerRing,
      label:     obs.type,
    });
  }

  // Business zones (all types block)
  for (const biz of activeBiz) {
    if (!biz.outerRing || biz.outerRing.length < 3) continue;
    blockedRegions.push({
      id:           biz.id,
      roofId:       biz.roofId,
      source:       "business",
      businessType: biz.businessType,
      outerRing:    biz.outerRing,
      label:        biz.name,
    });
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const excellentRegions = installableRegions.filter((r) => r.zoneClass === "excellent");
  const goodRegions      = installableRegions.filter((r) => r.zoneClass === "good");

  const summary = {
    source:                 usePlacementAreas ? "placementAreas" : "engineering",
    totalInstallableAreaM2: installableRegions.reduce((s, r) => s + r.areaM2, 0),
    regionCount:            installableRegions.length,
    placementAreaCount:     usePlacementAreas ? activePlacementAreas.length : 0,
    excellent: {
      count:  excellentRegions.length,
      areaM2: excellentRegions.reduce((s, r) => s + r.areaM2, 0),
    },
    good: {
      count:  goodRegions.length,
      areaM2: goodRegions.reduce((s, r) => s + r.areaM2, 0),
    },
    blockedCount: blockedRegions.length,
    engineeringPrep: prepStats,
  };

  return {
    roofSections:       roofRefs,
    installableRegions,
    blockedRegions,
    summary,
  };
}
