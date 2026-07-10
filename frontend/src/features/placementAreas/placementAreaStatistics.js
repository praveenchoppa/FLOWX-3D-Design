/**
 * placementAreaStatistics.js — Placement Area stats from shared polygon sampler.
 *
 * usableAreaM2 uses cell-centre coverage (installableCellCount × cellSize²).
 * This approximates area after excluding blocked / underObstacle cells without
 * expensive geometry subtraction.
 */

import { samplePolygonStatistics } from "../zones/polygonSampler.js";
import { PLACEMENT_QUALITY_THRESHOLDS } from "./placementAreaConfig.js";

/**
 * Derive display quality label from blended average exposure score.
 *
 * @param {number} avgScore
 * @returns {"Excellent"|"Good"|"Average"|"Avoid"}
 */
export function qualityFromAvgScore(avgScore) {
  const T = PLACEMENT_QUALITY_THRESHOLDS;
  if (avgScore >= T.EXCELLENT_MIN) return "Excellent";
  if (avgScore >= T.GOOD_MIN)      return "Good";
  if (avgScore >= T.AVERAGE_MIN)   return "Average";
  return "Avoid";
}

/**
 * @typedef {{
 *   areaM2: number,
 *   usableAreaM2: number,
 *   avgScore: number,
 *   quality: "Excellent"|"Good"|"Average"|"Avoid",
 * }} PlacementAreaStats
 */

/**
 * Compute stats for one placement area from immutable simulation cells.
 *
 * @param {object} area  placement area record (needs roofId + polygon)
 * @param {object|null} exposureResult
 * @param {object|null} zoneResult
 * @returns {PlacementAreaStats|null}
 */
export function computePlacementAreaStats(area, exposureResult, zoneResult) {
  if (!area?.polygon?.outerRing?.length) return null;

  const raw = samplePolygonStatistics(
    area.roofId,
    area.polygon,
    exposureResult,
    zoneResult,
  );

  return {
    areaM2:       raw.areaM2,
    usableAreaM2: raw.usableAreaM2,
    avgScore:     raw.avgScore,
    quality:      qualityFromAvgScore(raw.avgScore),
  };
}

/**
 * Return a copy of the placement area with fresh stats attached.
 *
 * @param {object} area
 * @param {object|null} exposureResult
 * @param {object|null} zoneResult
 * @returns {object}
 */
export function enrichPlacementAreaWithStats(area, exposureResult, zoneResult) {
  if (area.deleted) {
    return { ...area, stats: null };
  }
  return {
    ...area,
    stats: computePlacementAreaStats(area, exposureResult, zoneResult),
  };
}

/**
 * Recompute stats for one or all non-deleted placement areas.
 *
 * @param {object[]} placementAreas
 * @param {object|null} exposureResult
 * @param {object|null} zoneResult
 * @param {string} [onlyId]  when set, only recompute this area
 * @returns {object[]}
 */
export function recomputePlacementAreaStats(
  placementAreas,
  exposureResult,
  zoneResult,
  onlyId = null,
) {
  return placementAreas.map((area) => {
    if (onlyId && area.id !== onlyId) return area;
    if (onlyId && area.deleted) return area;
    return enrichPlacementAreaWithStats(area, exposureResult, zoneResult);
  });
}
