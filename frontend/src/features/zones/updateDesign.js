/**
 * updateDesign.js — Update Design orchestration (pure Step 0 entry point).
 *
 * Update Design is NOT a new engineering feature. It is the missing orchestration
 * layer that refreshes downstream calculations after engineering edits.
 *
 * Execution order (DesignStudio wires the React cascade after Step 0 returns):
 *
 *   STEP 0  — computeEditedZoneStatisticsOverrides()  (this module)
 *           ↓ refreshed avgScore + areaM2 on edited zones
 *           ↓ applyZoneStatisticsOverrides → effectiveZoneDisplayList
 *           ↓ computePlacementReady()
 *           ↓ computePanelLayout() / panel overrides
 *           ↓ computePanelArrays()
 *           ↓ computeEnergyResult()
 *           ↓ computeCostResult / Savings / ROI / Coverage
 *           ↓ committedResults snapshot
 *           ↓ designState = CLEAN
 *
 * Does NOT modify: simulation, shadow, exposure cells, zone generation (5A/5B),
 * placement algorithms, energy formulas, or financial formulas.
 */

import {
  computeEditedZoneStatisticsOverrides,
  applyZoneStatisticsOverrides,
  sampleEngineeringZoneStatistics,
} from "./engineeringZoneResampler.js";

export {
  computeEditedZoneStatisticsOverrides,
  applyZoneStatisticsOverrides,
  sampleEngineeringZoneStatistics,
};

/**
 * Run Update Design Step 0 — refresh cached statistics for edited engineering zones.
 *
 * @param {object} params
 * @param {object[]} params.zoneDisplayList
 * @param {object|null} params.exposureResult  immutable 4C cells (read-only)
 * @param {object|null} params.zoneResult      immutable 5A cells (read-only)
 * @returns {Map<string, { avgScore: number, areaM2: number, cellCount: number }>}
 */
export function runUpdateDesignStep0({
  zoneDisplayList = [],
  exposureResult = null,
  zoneResult = null,
}) {
  return computeEditedZoneStatisticsOverrides(
    zoneDisplayList,
    exposureResult,
    zoneResult,
  );
}
