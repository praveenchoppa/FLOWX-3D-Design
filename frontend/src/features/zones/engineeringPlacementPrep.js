/**
 * engineeringPlacementPrep.js — Step 6 engineering placement prep orchestrator.
 *
 * Phase 1: merge touching same-class engineering polygons (per roof).
 * Phase 2: simplify merged polygons for installer-friendly boundaries.
 *
 * Output feeds placementReady → computePanelLayout unchanged.
 */

import { mergeEngineeringRegionsByClass } from "./engineeringRegionMerge";
import { simplifyMergedEngineeringRegions } from "./engineeringPolygonSimplify";

/**
 * Prepare installable engineering regions for Step 6 placement.
 *
 * @param {object[]} installableZones  excellent/good non-deleted display-list entries
 * @returns {{ regions: object[], prepStats: object }}
 */
export function prepareEngineeringPlacementRegions(installableZones) {
  const merged = mergeEngineeringRegionsByClass(installableZones);
  const { regions, stats } = simplifyMergedEngineeringRegions(merged);

  return {
    regions,
    prepStats: {
      inputZoneCount:    installableZones.length,
      mergedRegionCount: regions.length,
      mergeReduction:    installableZones.length - regions.length,
      ...stats,
    },
  };
}
