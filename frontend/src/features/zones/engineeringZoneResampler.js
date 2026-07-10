/**
 * engineeringZoneResampler.js — Update Design Step 0 (pure, read-only).
 *
 * Re-samples immutable simulation cells to refresh engineering-zone statistics
 * after polygon edits. Never mutates exposureResult, zoneResult, or cells.
 *
 * Delegates core sampling to polygonSampler.js (shared engine).
 */

import { samplePolygonStatistics } from "./polygonSampler.js";

/** Resolve placement polygon from a display-list zone entry. */
function resolvePlacementPolygon(zone) {
  if (zone?.activePlacementPolygon) return zone.activePlacementPolygon;
  if (zone?.engineeringPolygon) return zone.engineeringPolygon;
  if (zone?.autoPolygon) return zone.autoPolygon;
  return { outerRing: zone?.outerRing ?? [], holes: zone?.holes ?? [] };
}

/**
 * @typedef {{ avgScore: number, areaM2: number, cellCount: number }} ZoneStatistics
 */

/**
 * Sample cells inside a zone's current placement polygon.
 *
 * @param {object} zone              display-list entry
 * @param {object|null} exposureResult  Step 4C (immutable cells)
 * @param {object|null} zoneResult      Step 5A (zoneClass per cell)
 * @returns {ZoneStatistics}
 */
export function sampleEngineeringZoneStatistics(zone, exposureResult, zoneResult) {
  const polygon = resolvePlacementPolygon(zone);
  const stats = samplePolygonStatistics(zone.roofId, polygon, exposureResult, zoneResult);
  return {
    avgScore:  stats.avgScore,
    areaM2:    stats.areaM2,
    cellCount: stats.cellCount,
  };
}

/**
 * Build statistics overrides for every engineering-edited zone in the display list.
 *
 * @param {object[]} zoneDisplayList
 * @param {object|null} exposureResult
 * @param {object|null} zoneResult
 * @returns {Map<string, ZoneStatistics>}  sigKey → statistics
 */
export function computeEditedZoneStatisticsOverrides(
  zoneDisplayList,
  exposureResult,
  zoneResult,
) {
  const overrides = new Map();

  for (const zone of zoneDisplayList) {
    if (zone.deleted || !zone.isEngineeringEdited) continue;
    if (!exposureResult || !zoneResult) continue;

    const stats = sampleEngineeringZoneStatistics(zone, exposureResult, zoneResult);
    overrides.set(zone.sigKey, stats);
  }

  return overrides;
}

/**
 * Apply Step 0 statistics overrides onto a zone display list (non-mutating).
 *
 * @param {object[]} displayList
 * @param {Map<string, ZoneStatistics>} overrides
 * @returns {object[]}
 */
export function applyZoneStatisticsOverrides(displayList, overrides) {
  if (!overrides?.size) return displayList;

  return displayList.map((zone) => {
    const stats = overrides.get(zone.sigKey);
    if (!stats) return zone;
    return {
      ...zone,
      avgScore: stats.avgScore,
      areaM2:   stats.areaM2,
    };
  });
}
