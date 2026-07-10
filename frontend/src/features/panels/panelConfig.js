/**
 * panelConfig.js — Project panel defaults + per–Placement Area overrides (pure).
 *
 * Configuration is stored separately from layout generation.  Only moduleId and
 * orientation affect placement footprint; tilt / azimuth / mount are stored for
 * future phases.
 */

import { DEFAULT_PANEL_ID, getPanelById, resolvePanelId } from "./panelTypes.js";

export const DEFAULT_TARGET_CAPACITY_KW = 20;

/** @type {{ type: "capacity", targetCapacityKW: number }} */
export const DEFAULT_DESIGN_GOAL = {
  type:             "capacity",
  targetCapacityKW: DEFAULT_TARGET_CAPACITY_KW,
};

export const ORIENTATIONS = /** @type {const} */ ({
  PORTRAIT:  "portrait",
  LANDSCAPE: "landscape",
});

export const MOUNT_TYPES = /** @type {const} */ ({
  FLUSH:      "flush",
  TILTED:     "tilted",
  BALLASTED:  "ballasted",
});

/** @typedef {"portrait"|"landscape"} PanelOrientation */
/** @typedef {"flush"|"tilted"|"ballasted"} MountType */

/**
 * @typedef {import("./panelDesignGoal.js").CapacityDesignGoal} CapacityDesignGoal
 */

/**
 * @typedef {object} ProjectPanelDefaults
 * @property {string} moduleId
 * @property {PanelOrientation} orientation
 * @property {number} tilt
 * @property {number} azimuth
 * @property {MountType} mountType
 * @property {number} mountHeight
 * @property {CapacityDesignGoal} designGoal
 */

/**
 * @typedef {object} PlacementAreaPanelProperties
 * @property {boolean} useProjectDefaults
 * @property {ProjectPanelDefaults|null} override
 */

export const DEFAULT_PROJECT_PANEL_DEFAULTS = /** @type {ProjectPanelDefaults} */ ({
  moduleId:    DEFAULT_PANEL_ID,
  orientation: ORIENTATIONS.PORTRAIT,
  tilt:        10,
  azimuth:     180,
  mountType:   MOUNT_TYPES.FLUSH,
  mountHeight: 0,
  designGoal:  { ...DEFAULT_DESIGN_GOAL },
});

/** Fresh panelProperties for a new Placement Area — inherits project defaults. */
export function createDefaultPanelProperties() {
  return {
    useProjectDefaults: true,
    override:           null,
  };
}

/**
 * Resolve effective configuration for one placement area.
 *
 * @param {ProjectPanelDefaults} projectDefaults
 * @param {PlacementAreaPanelProperties|null|undefined} panelProperties
 * @returns {ProjectPanelDefaults}
 */
export function resolveEffectivePanelConfig(projectDefaults, panelProperties) {
  const base = { ...projectDefaults, moduleId: resolvePanelId(projectDefaults.moduleId) };
  if (!panelProperties || panelProperties.useProjectDefaults !== false) {
    return base;
  }
  const o = panelProperties.override ?? {};
  return {
    ...base,
    ...o,
    moduleId: resolvePanelId(o.moduleId ?? base.moduleId),
    designGoal: o.designGoal ?? base.designGoal,
  };
}

/**
 * Resolve effective design goal for one placement area.
 *
 * @param {ProjectPanelDefaults} projectDefaults
 * @param {PlacementAreaPanelProperties|null|undefined} panelProperties
 * @returns {CapacityDesignGoal}
 */
export function resolveEffectiveDesignGoal(projectDefaults, panelProperties) {
  const cfg = resolveEffectivePanelConfig(projectDefaults, panelProperties);
  const kw = cfg.designGoal?.targetCapacityKW ?? DEFAULT_DESIGN_GOAL.targetCapacityKW;
  return {
    type:             "capacity",
    targetCapacityKW: Math.max(0, Number(kw) || 0),
  };
}

/**
 * Build the panel object computePanelLayout consumes (orientation swaps footprint).
 *
 * @param {string} moduleId
 * @param {PanelOrientation} orientation
 */
export function panelForPlacement(moduleId, orientation) {
  const mod = getPanelById(resolvePanelId(moduleId));
  if (!mod) return null;

  if (orientation === ORIENTATIONS.LANDSCAPE) {
    return {
      ...mod,
      width:  mod.heightM ?? mod.height,
      height: mod.widthM ?? mod.width,
    };
  }
  return { ...mod };
}

/**
 * Fingerprint of module + orientation across all active placement areas.
 * Used to detect stale layouts without regenerating on tilt/mount changes.
 *
 * @param {ProjectPanelDefaults} projectDefaults
 * @param {object[]} placementAreas
 */
export function placementLayoutFingerprint(projectDefaults, placementAreas) {
  const active = (placementAreas ?? []).filter((a) => !a.deleted);
  return JSON.stringify({
    areas: active.map((a) => {
      const cfg = resolveEffectivePanelConfig(projectDefaults, a.panelProperties);
      const goal = resolveEffectiveDesignGoal(projectDefaults, a.panelProperties);
      return {
        id: a.id,
        moduleId: cfg.moduleId,
        orientation: cfg.orientation,
        designGoal: goal,
      };
    }),
  });
}

/**
 * Installable region ids belonging to one placement area (includes split pieces).
 *
 * @param {object} area
 * @param {object[]} installableRegions
 */
export function regionIdsForPlacementArea(area, installableRegions = []) {
  const ids = new Set();
  for (const region of installableRegions) {
    if (region.sourceId === area.id || region.id === area.id) {
      ids.add(region.id);
    }
  }
  return ids;
}

/**
 * Count placed panels and capacity for one placement area after layout generation.
 *
 * @param {object} area
 * @param {object|null} panelLayout
 * @param {ProjectPanelDefaults} projectDefaults
 */
export function computeAreaLayoutStats(area, panelLayout, projectDefaults) {
  const cfg = resolveEffectivePanelConfig(projectDefaults, area.panelProperties);
  const mod = getPanelById(cfg.moduleId);
  const powerW = mod?.powerW ?? mod?.power ?? 0;

  const regionPrefix = area.id;
  const panelCount = (panelLayout?.placedPanels ?? []).filter(
    (p) => p.regionId === regionPrefix || p.regionId?.startsWith(`${regionPrefix}::`),
  ).length;

  return {
    panelCount,
    capacityKw: panelCount > 0 ? +((panelCount * powerW) / 1000).toFixed(2) : 0,
    moduleId:   cfg.moduleId,
    orientation: cfg.orientation,
  };
}
