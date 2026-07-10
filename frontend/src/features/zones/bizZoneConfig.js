/**
 * bizZoneConfig.js — Step 5D business zone configuration and geometry-subtraction utilities.
 *
 * Business zones are user-drawn rectangles that BLOCK space on the roof.
 * All five types block panel placement; "futureExpansion" is additionally tagged "reserved"
 * to convey that the space is intentionally reserved, not accidentally restricted.
 *
 * Geometry subtraction (5D-B):
 *   For each installable sim zone (Excellent / Good, non-deleted), we apply
 *   turf.difference() against every business zone to cut their outlines out of
 *   the installable geometry.  The result is the actual remaining polygon(s) that
 *   Step 6 will fill with panels.
 *
 *   Turf treats our scene-XZ values as [lon, lat].  That is fine because
 *   difference / intersect are topological polygon-clipping operations that do
 *   not invoke geodetic math.  Area is computed via the shoelace formula so it
 *   is correct in any flat 2-D coordinate system.
 *
 * Coordinate convention (shared with ZoneMergedPolygons):
 *   outerRing: [[x, z], ...]   X = East, Z = South (scene metres from design centre)
 *   NOT closed — first point is NOT repeated at the end.
 */

import {
  polygon  as turfPolygon,
  difference as turfDifference,
} from "@turf/turf";

// ── Business zone type config (ONE place — change colours/labels here only) ──

export const BIZ_TYPE_CONFIG = {
  maintenance: {
    label:    "Maintenance",
    color:    "#F59E0B",   // amber
    bg:       "rgba(245,158,11,0.18)",
    icon:     "🔧",
    blocks:   true,
    reserved: false,
    hint:     "Access area; panels blocked",
  },
  walkway: {
    label:    "Walkway",
    color:    "#6366F1",   // indigo
    bg:       "rgba(99,102,241,0.18)",
    icon:     "🚶",
    blocks:   true,
    reserved: false,
    hint:     "Walkway / access path; panels blocked",
  },
  restricted: {
    label:    "Restricted",
    color:    "#EF4444",   // red
    bg:       "rgba(239,68,68,0.18)",
    icon:     "🚫",
    blocks:   true,
    reserved: false,
    hint:     "Restricted area; panels blocked",
  },
  noInstall: {
    label:    "No-Install",
    color:    "#64748B",   // slate
    bg:       "rgba(100,116,139,0.18)",
    icon:     "✕",
    blocks:   true,
    reserved: false,
    hint:     "Panels explicitly excluded",
  },
  futureExpansion: {
    label:    "Future Expansion",
    color:    "#10B981",   // emerald
    bg:       "rgba(16,185,129,0.18)",
    icon:     "📐",
    blocks:   true,
    reserved: true,        // space is reserved for future use
    hint:     "Reserved for future panels; blocked now",
  },
};

export const BIZ_TYPES  = /** @type {(keyof typeof BIZ_TYPE_CONFIG)[]} */ (Object.keys(BIZ_TYPE_CONFIG));
export const DEFAULT_BIZ_TYPE = "restricted";

// ── Auto-naming ────────────────────────────────────────────────────────────────

/**
 * Generate a display name like "Maintenance 2" for a new business zone of the
 * given type, counting non-deleted zones of that type already in the array.
 */
export function autoNameBizZone(type, existingBusinessZones = []) {
  const cfg = BIZ_TYPE_CONFIG[type];
  if (!cfg) return type;
  const count = existingBusinessZones.filter(
    (z) => z.businessType === type && !z.deleted,
  ).length;
  return `${cfg.label} ${count + 1}`;
}

// ── Area helpers ───────────────────────────────────────────────────────────────

/**
 * Shoelace formula for a closed or unclosed ring [[x,z],...].
 * Works correctly in any flat 2-D coordinate system.
 */
function shoelaceAreaM2(ring) {
  if (!ring || ring.length < 3) return 0;
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return Math.abs(a) / 2;
}

/**
 * Sum the area of a turf Polygon or MultiPolygon feature using shoelace.
 * Outer ring area minus hole areas.
 */
function turfFeatureAreaM2(feature) {
  if (!feature) return 0;
  const geom = feature.geometry;
  if (!geom) return 0;

  const processCoords = (coords) => {
    const outer  = coords[0].map(([x, z]) => [x, z]);
    const outer2 = outer[outer.length - 1][0] === outer[0][0] &&
                   outer[outer.length - 1][1] === outer[0][1]
      ? outer.slice(0, -1)
      : outer;
    const outerA = shoelaceAreaM2(outer2);
    const holesA = coords.slice(1).reduce((sum, hole) => {
      const h = hole.map(([x, z]) => [x, z]);
      const h2 = h[h.length - 1][0] === h[0][0] && h[h.length - 1][1] === h[0][1]
        ? h.slice(0, -1)
        : h;
      return sum + shoelaceAreaM2(h2);
    }, 0);
    return Math.max(0, outerA - holesA);
  };

  if (geom.type === "Polygon") {
    return processCoords(geom.coordinates);
  } else if (geom.type === "MultiPolygon") {
    return geom.coordinates.reduce((s, c) => s + processCoords(c), 0);
  }
  return 0;
}

// ── Turf conversion helpers ───────────────────────────────────────────────────

/**
 * Convert a scene-XZ ring [[x,z],...] to a turf closed ring [[x,z],...,first].
 * Turf requires rings to be closed (first = last vertex).
 */
function xzToClosedRing(ring) {
  const pts = ring.map(([x, z]) => [x, z]);
  // Close if not already closed.
  const first = pts[0], last = pts[pts.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) pts.push([first[0], first[1]]);
  return pts;
}

/**
 * Convert a sim zone region to a turf polygon feature.
 * Handles outer ring + holes.
 */
function simZoneToTurfPoly(region) {
  const outer = xzToClosedRing(region.outerRing);
  const holes = (region.holes ?? []).map(xzToClosedRing);
  return turfPolygon([outer, ...holes]);
}

/**
 * Convert a business zone to a turf polygon feature.
 */
function bizZoneToTurfPoly(biz) {
  return turfPolygon([xzToClosedRing(biz.outerRing)]);
}

// ── Core geometry-subtraction computation ─────────────────────────────────────

/**
 * Compute the installable area (and remaining polygon shapes) after cutting all
 * business zones out of the installable simulation zones.
 *
 * Algorithm per sim zone:
 *   1. Start with the zone's turf polygon (outerRing + holes).
 *   2. For each business zone: apply turf.difference(current, bizPoly).
 *      • If the result is null → the sim zone is entirely covered; area = 0.
 *      • Otherwise update `current` to the remaining polygon.
 *   3. Sum the area of the final remaining polygon via shoelace.
 *
 * @param {Array}  zoneDisplayList   Enriched sim zone list (from buildZoneDisplayList)
 * @param {Array}  businessZones     Business zone objects (include deleted:true ones — filter here)
 * @returns {{ installableAreaM2: number, bizSubtractedM2: number, baseSummary: object }}
 */
export function computeInstallableAfterBizZones(zoneDisplayList, businessZones) {
  // Collect non-deleted installable sim zones (Excellent + Good).
  const installableSims = zoneDisplayList.filter(
    (z) => !z.deleted && (z.effectiveClass === "excellent" || z.effectiveClass === "good"),
  );

  // Original installable area (before any biz zone subtraction).
  const originalArea = installableSims.reduce((s, z) => s + (z.areaM2 ?? 0), 0);

  // Collect non-deleted business zones (all types block).
  const activeBiz = businessZones.filter((b) => !b.deleted);

  if (!activeBiz.length || !installableSims.length) {
    return {
      installableAreaM2: originalArea,
      bizSubtractedM2:   0,
    };
  }

  let totalRemaining = 0;

  for (const simZone of installableSims) {
    try {
      let current = simZoneToTurfPoly(simZone);

      for (const biz of activeBiz) {
        if (!current) break;
        try {
          const bizPoly = bizZoneToTurfPoly(biz);
          const result  = turfDifference(current, bizPoly);
          current = result ?? null;
        } catch {
          // Degenerate geometry (collinear / micro-overlap) — keep unchanged.
        }
      }

      totalRemaining += turfFeatureAreaM2(current);
    } catch {
      // Fallback: keep the original sim zone area unchanged.
      totalRemaining += simZone.areaM2 ?? 0;
    }
  }

  return {
    installableAreaM2: Math.max(0, totalRemaining),
    bizSubtractedM2:   Math.max(0, originalArea - totalRemaining),
  };
}
