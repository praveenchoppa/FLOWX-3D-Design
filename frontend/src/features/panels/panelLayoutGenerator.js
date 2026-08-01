/**
 * panelLayoutGenerator.js — Multi–Placement Area layout orchestration (pure).
 *
 * Calls computePanelLayout() once per area using that area's OWNED config only.
 * Does NOT read live project defaults during regeneration.
 */

import { computePanelLayout } from "./panelPlacement.js";
import {
  panelForPlacement,
  regionIdsForPlacementArea,
  resolvePlacementAreaConfig,
} from "./panelConfig.js";
import {
  applyCapacityLimit,
  requiredPanelsForCapacity,
  GENERATE_MODES,
} from "./panelDesignGoal.js";

export const EMPTY_PANEL_LAYOUT = {
  allValidSlots:  [],
  placedPanels:   [],
  defaultRemoved: [],
  summary:        { total: 0, byRegion: {}, totalValidSlots: 0 },
  layoutPolicy:   null,
  validation:     { valid: true, failures: [] },
  ghostSlots:     [],
  diagnostics:    null,
};

/**
 * Generate panel layout across all active placement areas.
 *
 * @param {object|null} placementReady
 * @param {object[]} placementAreas
 * @param {object} [options]
 * @param {string} [options.generateMode]  "capacity" | "maximum"
 * @returns {object}
 */
export function generateMultiAreaPanelLayout(
  placementReady,
  placementAreas,
  options = {},
) {
  const generateMode = options.generateMode ?? GENERATE_MODES.CAPACITY;
  const activeAreas = (placementAreas ?? []).filter((a) => !a.deleted);
  if (!placementReady || !activeAreas.length) return { ...EMPTY_PANEL_LAYOUT };

  const installableRegions = placementReady.installableRegions ?? [];
  const merged = {
    ...EMPTY_PANEL_LAYOUT,
    allValidSlots:  [],
    placedPanels:   [],
    defaultRemoved: [],
    summary:        { total: 0, byRegion: {}, totalValidSlots: 0 },
    generateMode,
  };

  for (const area of activeAreas) {
    const cfg = resolvePlacementAreaConfig(area.panelProperties);
    const designGoal = cfg.designGoal;
    const panel = panelForPlacement(cfg.moduleId, cfg.orientation);
    if (!panel) continue;

    const regionIds = regionIdsForPlacementArea(area, installableRegions);
    if (!regionIds.size) continue;

    const subReady = {
      ...placementReady,
      installableRegions: installableRegions.filter((r) => regionIds.has(r.id)),
    };

    const fullLayout = computePanelLayout(subReady, panel, { placementDiagnostics: false });
    const powerW = panel.powerW ?? panel.power ?? 0;
    const requiredPanels = requiredPanelsForCapacity(
      designGoal.targetCapacityKW,
      powerW,
    );

    const limitedLayout = applyCapacityLimit(fullLayout, requiredPanels, generateMode);
    if (!limitedLayout) continue;

    merged.allValidSlots.push(...(limitedLayout.allValidSlots ?? []));
    merged.placedPanels.push(...(limitedLayout.placedPanels ?? []));
    merged.defaultRemoved.push(...(limitedLayout.defaultRemoved ?? []));

    for (const [regionId, count] of Object.entries(limitedLayout.summary?.byRegion ?? {})) {
      merged.summary.byRegion[regionId] = count;
    }
  }

  merged.summary.total = merged.placedPanels.length;
  merged.summary.totalValidSlots = merged.allValidSlots.length;

  return merged;
}
