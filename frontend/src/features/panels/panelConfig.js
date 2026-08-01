/**
 * panelConfig.js — Project template defaults + per–Placement Area owned config (pure).
 *
 * Each placement area stores a full PlacementAreaPanelConfig snapshot.
 * Project defaults are a template for NEW areas only — never the live source
 * of truth for existing areas during regeneration.
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

/** Per-area owned config — same shape as project template defaults. */
/** @typedef {ProjectPanelDefaults} PlacementAreaPanelConfig */

/**
 * @typedef {object} LegacyPlacementAreaPanelProperties
 * @property {boolean} useProjectDefaults
 * @property {Partial<ProjectPanelDefaults>|null} override
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

/** Normalize any partial config into a complete owned area config. */
export function normalizePlacementAreaConfig(partial = {}) {
  const goal = partial.designGoal ?? {};
  return {
    moduleId:    resolvePanelId(partial.moduleId ?? DEFAULT_PANEL_ID),
    orientation: partial.orientation ?? ORIENTATIONS.PORTRAIT,
    tilt:        Number(partial.tilt ?? DEFAULT_PROJECT_PANEL_DEFAULTS.tilt),
    azimuth:     Number(partial.azimuth ?? DEFAULT_PROJECT_PANEL_DEFAULTS.azimuth),
    mountType:   partial.mountType ?? MOUNT_TYPES.FLUSH,
    mountHeight: Math.max(0, Number(partial.mountHeight ?? 0)),
    designGoal:  {
      type:             "capacity",
      targetCapacityKW: Math.max(
        0,
        Number(goal.targetCapacityKW ?? DEFAULT_DESIGN_GOAL.targetCapacityKW) || 0,
      ),
    },
  };
}

/** Snapshot project template defaults for a new placement area. */
export function createPlacementAreaConfigFromTemplate(projectDefaults) {
  return normalizePlacementAreaConfig(projectDefaults ?? DEFAULT_PROJECT_PANEL_DEFAULTS);
}

/**
 * @deprecated Use createPlacementAreaConfigFromTemplate — kept for import compatibility.
 */
export function createDefaultPanelProperties(projectDefaults) {
  return createPlacementAreaConfigFromTemplate(projectDefaults);
}

/** True when panelProperties uses the legacy linked-defaults shape. */
export function isLegacyPanelProperties(panelProperties) {
  if (!panelProperties || typeof panelProperties !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(panelProperties, "useProjectDefaults")) {
    return true;
  }
  if (panelProperties.override != null && panelProperties.moduleId == null) {
    return true;
  }
  return false;
}

/**
 * Migrate one placement area from legacy linked config to owned config.
 * Prefers generatedLayout snapshot when the area was previously generated.
 *
 * @param {object} area
 * @param {ProjectPanelDefaults} projectDefaults  template at migration time (new areas only)
 */
export function migratePlacementAreaConfig(area, projectDefaults = DEFAULT_PROJECT_PANEL_DEFAULTS) {
  const props = area.panelProperties;
  const template = createPlacementAreaConfigFromTemplate(projectDefaults);

  if (!isLegacyPanelProperties(props)) {
    return normalizePlacementAreaConfig(props);
  }

  const gl = area.generatedLayout;

  if (props.useProjectDefaults !== false) {
    if (gl) {
      return normalizePlacementAreaConfig({
        ...template,
        moduleId:    gl.moduleId ?? template.moduleId,
        orientation: gl.orientation ?? template.orientation,
        designGoal:  {
          type:             "capacity",
          targetCapacityKW: gl.requestedCapacityKW ?? template.designGoal.targetCapacityKW,
        },
      });
    }
    return { ...template };
  }

  return normalizePlacementAreaConfig({
    ...template,
    ...(props.override ?? {}),
  });
}

/** Migrate all placement areas that still use the legacy shape. */
export function migratePlacementAreas(placementAreas, projectDefaults) {
  return (placementAreas ?? []).map((area) => {
    if (!isLegacyPanelProperties(area.panelProperties)) return area;
    return {
      ...area,
      panelProperties: migratePlacementAreaConfig(area, projectDefaults),
    };
  });
}

/**
 * Read the owned configuration stored on a placement area.
 * Regeneration and previews must use ONLY this — never live project defaults.
 *
 * @param {PlacementAreaPanelConfig|LegacyPlacementAreaPanelProperties|null|undefined} panelProperties
 */
export function resolvePlacementAreaConfig(panelProperties) {
  if (!panelProperties || isLegacyPanelProperties(panelProperties)) {
    return normalizePlacementAreaConfig(DEFAULT_PROJECT_PANEL_DEFAULTS);
  }
  return normalizePlacementAreaConfig(panelProperties);
}

/**
 * @deprecated Regeneration uses resolvePlacementAreaConfig. Kept for transitional call sites.
 */
export function resolveEffectivePanelConfig(projectDefaults, panelProperties) {
  if (isLegacyPanelProperties(panelProperties)) {
    return migratePlacementAreaConfig({ panelProperties, generatedLayout: null }, projectDefaults);
  }
  return resolvePlacementAreaConfig(panelProperties);
}

/** Design goal from owned area config only. */
export function resolveEffectiveDesignGoal(_projectDefaults, panelProperties) {
  const cfg = resolvePlacementAreaConfig(panelProperties);
  return cfg.designGoal;
}

/** Owned-area design goal (preferred). */
export function resolveAreaDesignGoal(panelProperties) {
  return resolvePlacementAreaConfig(panelProperties).designGoal;
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
 * Fingerprint of module + orientation + capacity across all active placement areas.
 * Uses each area's stored config only.
 *
 * @param {object[]} placementAreas
 */
export function placementLayoutFingerprint(placementAreas) {
  const active = (placementAreas ?? []).filter((a) => !a.deleted);
  return JSON.stringify({
    areas: active.map((a) => {
      const cfg = resolvePlacementAreaConfig(a.panelProperties);
      return {
        id:          a.id,
        moduleId:    cfg.moduleId,
        orientation: cfg.orientation,
        designGoal:  cfg.designGoal,
      };
    }),
  });
}

/**
 * @deprecated Pass placementAreas only. Kept for call-site transition.
 */
export function placementLayoutFingerprintLegacy(projectDefaults, placementAreas) {
  void projectDefaults;
  return placementLayoutFingerprint(placementAreas);
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
 */
export function computeAreaLayoutStats(area, panelLayout) {
  const cfg = resolvePlacementAreaConfig(area.panelProperties);
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
