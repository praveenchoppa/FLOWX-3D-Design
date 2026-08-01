/**
 * panelDesignGoal.js — Design goal model + target-capacity placement (pure).
 *
 * Calls computePanelLayout() unchanged, then trims to required panel count.
 * Does NOT modify the placement algorithm.
 */

import { computePanelLayout } from "./panelPlacement.js";
import {
  panelForPlacement,
  regionIdsForPlacementArea,
  resolvePlacementAreaConfig,
} from "./panelConfig.js";

/** @typedef {"capacity"} DesignGoalType */

/**
 * @typedef {object} CapacityDesignGoal
 * @property {"capacity"} type
 * @property {number} targetCapacityKW
 */

export const DESIGN_GOAL_TYPES = /** @type {const} */ ({
  CAPACITY: "capacity",
});

export const GENERATE_MODES = /** @type {const} */ ({
  CAPACITY: "capacity",
  MAXIMUM:  "maximum",
});

export const DEFAULT_TARGET_CAPACITY_KW = 20;

/** @type {CapacityDesignGoal} */
export const DEFAULT_DESIGN_GOAL = {
  type:             DESIGN_GOAL_TYPES.CAPACITY,
  targetCapacityKW: DEFAULT_TARGET_CAPACITY_KW,
};

/**
 * Required panel count for a capacity target (always rounds up).
 *
 * @param {number} targetCapacityKW
 * @param {number} powerW
 */
export function requiredPanelsForCapacity(targetCapacityKW, powerW) {
  if (!targetCapacityKW || !powerW || powerW <= 0) return 0;
  return Math.ceil((targetCapacityKW * 1000) / powerW);
}

/**
 * Full layout for one placement area (all valid professional positions).
 *
 * @param {object|null} placementReady
 * @param {object} area
 */
export function computeFullAreaLayout(placementReady, area) {
  const cfg = resolvePlacementAreaConfig(area.panelProperties);
  const panel = panelForPlacement(cfg.moduleId, cfg.orientation);
  if (!panel || !placementReady) return null;

  const regionIds = regionIdsForPlacementArea(area, placementReady.installableRegions ?? []);
  if (!regionIds.size) return null;

  const subReady = {
    ...placementReady,
    installableRegions: (placementReady.installableRegions ?? []).filter(
      (r) => regionIds.has(r.id),
    ),
  };

  return computePanelLayout(subReady, panel, { placementDiagnostics: false });
}

/**
 * Live preview before generation — uses the area's owned config only.
 *
 * @param {object|null} placementReady
 * @param {object} area
 */
export function computeCapacityPreview(placementReady, area) {
  const cfg = resolvePlacementAreaConfig(area.panelProperties);
  const designGoal = cfg.designGoal;
  const panel = panelForPlacement(cfg.moduleId, cfg.orientation);
  const powerW = panel?.powerW ?? panel?.power ?? 0;
  const targetCapacityKW = designGoal.targetCapacityKW ?? 0;

  const fullLayout = computeFullAreaLayout(placementReady, area);
  const maxPanels = fullLayout?.placedPanels?.length ?? 0;
  const maxCapacityKW = maxPanels > 0 && powerW > 0
    ? +((maxPanels * powerW) / 1000).toFixed(2)
    : 0;

  const requiredPanels = requiredPanelsForCapacity(targetCapacityKW, powerW);
  const achievable = requiredPanels > 0 && requiredPanels <= maxPanels;

  return {
    designGoal,
    requestedCapacityKW: +targetCapacityKW.toFixed(2),
    requiredPanels,
    maxPanels,
    maxCapacityKW,
    achievable,
    exceeds: requiredPanels > maxPanels,
    status: requiredPanels > maxPanels
      ? "exceeds"
      : requiredPanels > 0
        ? "achievable"
        : "invalid",
  };
}

/**
 * Trim a full layout to the target capacity (first N placed panels, deterministic order).
 *
 * @param {object} fullLayout
 * @param {number} requiredPanels
 * @param {string} generateMode
 */
export function applyCapacityLimit(fullLayout, requiredPanels, generateMode) {
  if (!fullLayout) return null;

  const allPlaced = fullLayout.placedPanels ?? [];

  if (generateMode === GENERATE_MODES.MAXIMUM) {
    return fullLayout;
  }

  if (requiredPanels > allPlaced.length) {
    return {
      ...fullLayout,
      placedPanels: [],
      summary: {
        ...fullLayout.summary,
        total: 0,
        byRegion: {},
      },
    };
  }

  const kept = allPlaced.slice(0, requiredPanels);
  const byRegion = {};
  for (const panel of kept) {
    byRegion[panel.regionId] = (byRegion[panel.regionId] ?? 0) + 1;
  }

  return {
    ...fullLayout,
    placedPanels: kept,
    summary: {
      ...fullLayout.summary,
      total: kept.length,
      byRegion,
    },
  };
}

/**
 * Authoritative stats stored on placement area after generation.
 *
 * @param {object} area
 * @param {object|null} panelLayout
 * @param {string} generateMode
 */
export function computeAreaGeneratedLayoutRecord(
  area,
  panelLayout,
  generateMode = GENERATE_MODES.CAPACITY,
) {
  const cfg = resolvePlacementAreaConfig(area.panelProperties);
  const designGoal = cfg.designGoal;
  const panel = panelForPlacement(cfg.moduleId, cfg.orientation);
  const powerW = panel?.powerW ?? panel?.power ?? 0;

  const regionPrefix = area.id;
  const areaPanels = (panelLayout?.placedPanels ?? []).filter(
    (p) => p.regionId === regionPrefix || p.regionId?.startsWith(`${regionPrefix}::`),
  );

  const actualPanelCount = areaPanels.length;
  const actualCapacityKW = actualPanelCount > 0 && powerW > 0
    ? +((actualPanelCount * powerW) / 1000).toFixed(2)
    : 0;

  return {
    designGoal,
    requestedCapacityKW: designGoal.targetCapacityKW,
    actualPanelCount,
    actualCapacityKW,
    panelCount:          actualPanelCount,
    capacityKw:          actualCapacityKW,
    moduleId:            cfg.moduleId,
    orientation:         cfg.orientation,
    generateMode,
    generatedAt:         Date.now(),
  };
}

/**
 * Whether any active area exceeds its target in capacity mode.
 *
 * @param {object|null} placementReady
 * @param {object[]} placementAreas
 */
export function anyAreaExceedsCapacity(placementReady, placementAreas) {
  const active = (placementAreas ?? []).filter((a) => !a.deleted);
  return active.some((area) => {
    const preview = computeCapacityPreview(placementReady, area);
    return preview.exceeds;
  });
}
