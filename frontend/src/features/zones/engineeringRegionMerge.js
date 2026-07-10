/**
 * engineeringRegionMerge.js — Step 6 engineering placement prep (Phase 1).
 *
 * Merges touching engineering polygons that share the same effectiveClass
 * on the same roof into single placement regions.  Simulation fragments are
 * NOT merged across class boundaries or roof boundaries.
 *
 * Pure functions — no React, no Three.js.
 */

import {
  polygon as turfPolygon,
  booleanIntersects,
  union as turfUnion,
} from "@turf/turf";

import { getActivePlacementPolygon } from "./zoneEditorUtils";
import { shoelaceAreaM2 } from "./placementReady";

// ── Ring / turf helpers ───────────────────────────────────────────────────────

function xzToClosedRing(ring) {
  if (!ring?.length) return [];
  const pts = ring.map(([x, z]) => [x, z]);
  const first = pts[0];
  const last  = pts[pts.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) pts.push([first[0], first[1]]);
  return pts;
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

function ringAreaWithHoles(outerRing, holes = []) {
  const outerA = shoelaceAreaM2(outerRing);
  const holesA = holes.reduce((s, h) => s + shoelaceAreaM2(h), 0);
  return Math.max(0, outerA - holesA);
}

function polygonToTurf({ outerRing, holes = [] }) {
  const outer = xzToClosedRing(outerRing);
  const holeRings = (holes ?? []).map(xzToClosedRing).filter((h) => h.length >= 4);
  return turfPolygon([outer, ...holeRings]);
}

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

// ── Union-find for connected components ───────────────────────────────────────

function buildComponents(items) {
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  function unite(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      try {
        if (booleanIntersects(items[i].turf, items[j].turf)) {
          unite(i, j);
        }
      } catch {
        // skip degenerate pair
      }
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(items[i]);
  }
  return [...groups.values()];
}

function unionItemGroup(group) {
  const allSources = group.map((g) => g.zone);

  if (group.length === 1) {
    return [{ polygon: group[0].polygon, sources: allSources }];
  }

  let merged = group[0].turf;

  for (let i = 1; i < group.length; i++) {
    try {
      const next = turfUnion(merged, group[i].turf);
      if (next) merged = next;
    } catch {
      // keep best-effort merge
    }
  }

  const pieces = turfFeatureToPolygons(merged);
  if (!pieces.length) {
    return group.map((item) => ({ polygon: item.polygon, sources: allSources }));
  }

  return pieces.map((polygon) => ({ polygon, sources: allSources }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Merge adjacent installable engineering polygons per roof + effectiveClass.
 *
 * @param {object[]} zones  zoneDisplayList entries (excellent/good, non-deleted)
 * @returns {object[]} merged region descriptors
 *   { polygon, zoneClass, roofId, sourceZones, avgScore, name, sourceIds }
 */
export function mergeEngineeringRegionsByClass(zones) {
  const byKey = new Map();

  for (const zone of zones) {
    const poly = getActivePlacementPolygon(zone);
    if (!poly.outerRing || poly.outerRing.length < 3) continue;

    const key = `${zone.roofId}::${zone.effectiveClass}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({
      zone,
      polygon: poly,
      turf: polygonToTurf(poly),
    });
  }

  const merged = [];

  for (const [, items] of byKey) {
    const components = buildComponents(items);

    for (const component of components) {
      const unions = unionItemGroup(component);

      for (const { polygon, sources } of unions) {
        const sourceZones = sources ?? component.map((c) => c.zone);
        const totalArea   = sourceZones.reduce((s, z) => s + (z.areaM2 ?? 0), 0);
        let avgScore = null;
        if (totalArea > 0) {
          const weighted = sourceZones.reduce(
            (s, z) => s + (z.avgScore ?? 0) * (z.areaM2 ?? 0),
            0,
          );
          avgScore = Math.round(weighted / totalArea);
        }

        const names = sourceZones.map(
          (z) => z.displayName ?? z.autoName ?? z.id,
        );
        const uniqueNames = [...new Set(names)];

        merged.push({
          polygon,
          zoneClass: sourceZones[0].effectiveClass,
          roofId:    sourceZones[0].roofId,
          sourceZones,
          sourceIds: sourceZones.map((z) => z.id),
          avgScore,
          name: uniqueNames.length === 1
            ? uniqueNames[0]
            : `${uniqueNames[0]} (+${uniqueNames.length - 1} merged)`,
        });
      }
    }
  }

  return merged;
}

/** Count vertices across outer rings and holes (diagnostics). */
export function countPolygonVertices(polygon) {
  if (!polygon?.outerRing) return 0;
  const holes = polygon.holes ?? [];
  return polygon.outerRing.length + holes.reduce((s, h) => s + (h?.length ?? 0), 0);
}
