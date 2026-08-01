/**
 * panelLayoutSummary.js — UI summaries from the generated layout snapshot (pure).
 *
 * Reads placedPanels on generatedPanelLayout only — never allValidSlots or
 * maximum-fit preview values.
 */

import { getPanelById, PANEL_TYPES } from "./panelTypes.js";
import { resolvePlacementAreaConfig } from "./panelConfig.js";
import { computeCapacityPreview } from "./panelDesignGoal.js";

/** Config sync status for placement area cards and layout summary. */
export const AREA_GENERATION_STATUS = /** @type {const} */ ({
  NOT_GENERATED:           "not_generated",
  UP_TO_DATE:              "up_to_date",
  REGENERATION_REQUIRED:   "regeneration_required",
});

export const AREA_GENERATION_STATUS_LABEL = {
  [AREA_GENERATION_STATUS.NOT_GENERATED]:         "Not Generated",
  [AREA_GENERATION_STATUS.UP_TO_DATE]:            "Up to Date",
  [AREA_GENERATION_STATUS.REGENERATION_REQUIRED]: "Regeneration Required",
};

/** Per-area capacity outcome (only meaningful when config is synchronized). */
export const AREA_LAYOUT_STATUS = /** @type {const} */ ({
  ACHIEVED:       "achieved",
  LIMITED:        "limited",
  NOT_GENERATED:  "not_generated",
});

export const AREA_LAYOUT_STATUS_LABEL = {
  [AREA_LAYOUT_STATUS.ACHIEVED]:      "Capacity Achieved",
  [AREA_LAYOUT_STATUS.LIMITED]:       "Limited by Available Space",
  [AREA_LAYOUT_STATUS.NOT_GENERATED]: "Not Generated",
};

function panelsForArea(areaId, placedPanels) {
  return placedPanels.filter(
    (p) => p.regionId === areaId || p.regionId?.startsWith(`${areaId}::`),
  );
}

function sumPanelFootprintAndCapacity(areaPanels, fallbackModuleId) {
  let capacityKw = 0;
  let panelAreaM2 = 0;

  for (const panel of areaPanels) {
    const mod = getPanelById(panel.panelTypeId) ?? getPanelById(fallbackModuleId);
    const powerW = mod?.powerW ?? mod?.power ?? 0;
    const w = panel.width ?? mod?.widthM ?? mod?.width ?? 0;
    const h = panel.length ?? mod?.heightM ?? mod?.height ?? 0;
    capacityKw += powerW / 1000;
    panelAreaM2 += w * h;
  }

  return {
    capacityKw:   +capacityKw.toFixed(2),
    panelAreaM2,
  };
}

/** Human-readable mount type for summary display. */
export function formatMountTypeLabel(mountType) {
  if (!mountType) return "—";
  const labels = {
    flush:     "Flush mount",
    tilted:    "Tilted mount",
    ballasted: "Ballasted",
  };
  return labels[mountType] ?? mountType;
}

function formatOrientationLabel(orientation) {
  if (!orientation) return "—";
  return orientation.charAt(0).toUpperCase() + orientation.slice(1);
}

/** Whether owned config matches the last generation snapshot on this area. */
export function areaConfigMatchesGeneratedSnapshot(area) {
  const gl = area?.generatedLayout;
  if (!gl) return false;

  const cfg = resolvePlacementAreaConfig(area.panelProperties);
  const snapshotTarget = gl.requestedCapacityKW ?? gl.designGoal?.targetCapacityKW ?? 0;
  const liveTarget = cfg.designGoal?.targetCapacityKW ?? 0;

  return cfg.moduleId === (gl.moduleId ?? cfg.moduleId)
    && cfg.orientation === (gl.orientation ?? cfg.orientation)
    && liveTarget === snapshotTarget;
}

/**
 * Derive per-area generation sync status from owned config vs generatedLayout.
 *
 * @param {object} area
 */
export function computeAreaGenerationStatus(area) {
  if (!area?.generatedLayout) return AREA_GENERATION_STATUS.NOT_GENERATED;
  if (areaConfigMatchesGeneratedSnapshot(area)) return AREA_GENERATION_STATUS.UP_TO_DATE;
  return AREA_GENERATION_STATUS.REGENERATION_REQUIRED;
}

/**
 * Detailed per–placement-area engineering rows for Layout Summary UI.
 *
 * @param {object[]} placementAreas
 * @param {object|null} effectiveLayout
 * @param {object|null} [placementReady]
 */
export function buildEngineeringAreaSummaries(
  placementAreas = [],
  effectiveLayout = null,
  placementReady = null,
) {
  const placedPanels = effectiveLayout?.placedPanels ?? [];
  const activeAreas = (placementAreas ?? []).filter((a) => !a.deleted);

  return activeAreas.map((area) => {
    const cfg = resolvePlacementAreaConfig(area.panelProperties);
    const gl = area.generatedLayout;
    const syncStatus = computeAreaGenerationStatus(area);
    const isStale = syncStatus === AREA_GENERATION_STATUS.REGENERATION_REQUIRED;

    const targetKw = cfg.designGoal?.targetCapacityKW ?? 0;
    const areaPanels = panelsForArea(area.id, placedPanels);
    const { capacityKw, panelAreaM2 } = sumPanelFootprintAndCapacity(areaPanels, cfg.moduleId);

    const usableM2 = area.stats?.usableAreaM2 ?? area.stats?.areaM2 ?? 0;
    const coveragePct = usableM2 > 0
      ? +((panelAreaM2 / usableM2) * 100).toFixed(1)
      : null;

    const mod = getPanelById(cfg.moduleId);
    const moduleLabel = mod
      ? `${mod.manufacturer} ${mod.model} ${mod.powerW ?? mod.power}W`
      : cfg.moduleId ?? "—";

    const glMod = gl ? getPanelById(gl.moduleId) : null;
    const generatedModuleLabel = glMod
      ? `${glMod.manufacturer} ${glMod.model} ${glMod.powerW ?? glMod.power}W`
      : (gl?.moduleId ? moduleLabelForId(gl.moduleId) : moduleLabel);

    const lastTargetKw = gl?.requestedCapacityKW ?? gl?.designGoal?.targetCapacityKW ?? null;

    let capacityStatus = AREA_LAYOUT_STATUS.NOT_GENERATED;
    if (syncStatus === AREA_GENERATION_STATUS.UP_TO_DATE) {
      capacityStatus = capacityKw >= targetKw - 0.01
        ? AREA_LAYOUT_STATUS.ACHIEVED
        : AREA_LAYOUT_STATUS.LIMITED;
    }

    const preview = (isStale && placementReady)
      ? computeCapacityPreview(placementReady, area)
      : null;

    const capacityDiffKw = isStale
      ? null
      : +(capacityKw - targetKw).toFixed(2);

    return {
      id:                  area.id,
      name:                area.name,
      syncStatus,
      isStale,
      panelCount:          areaPanels.length,
      generatedCapacityKw: capacityKw,
      targetCapacityKw:    targetKw,
      capacityDiffKw,
      moduleLabel,
      orientation:         cfg.orientation,
      orientationLabel:    formatOrientationLabel(cfg.orientation),
      tilt:                cfg.tilt,
      mountType:           cfg.mountType,
      mountHeight:         cfg.mountHeight,
      coveragePct,
      capacityStatus,
      currentLayout: gl ? {
        panelCount:          areaPanels.length,
        capacityKw,
        lastTargetKw,
        moduleLabel:         generatedModuleLabel,
        orientation:         gl.orientation ?? cfg.orientation,
        orientationLabel:    formatOrientationLabel(gl.orientation ?? cfg.orientation),
      } : null,
      pendingConfiguration: isStale ? {
        targetCapacityKw:  targetKw,
        requiredPanels:    preview?.requiredPanels ?? null,
        moduleLabel,
        orientation:       cfg.orientation,
        orientationLabel:  formatOrientationLabel(cfg.orientation),
        tilt:              cfg.tilt,
        mountType:         cfg.mountType,
      } : null,
    };
  });
}

/**
 * Project-level engineering totals for Layout Summary UI.
 *
 * @param {object[]} placementAreas
 * @param {object|null} effectiveLayout
 */
export function computeProjectEngineeringSummary(placementAreas = [], effectiveLayout = null) {
  const system = computeGeneratedLayoutSummary(effectiveLayout, placementAreas);
  const activeAreas = (placementAreas ?? []).filter((a) => !a.deleted);

  const totalRoofAreaM2 = activeAreas.reduce(
    (sum, a) => sum + (a.stats?.areaM2 ?? 0),
    0,
  );

  const scores = activeAreas
    .map((a) => a.stats?.avgScore)
    .filter((s) => s != null && !Number.isNaN(s));

  const averageSolarScore = scores.length
    ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : null;

  return {
    totalAreas:            activeAreas.length,
    totalPanels:           system.panelCount,
    totalSystemCapacityKw: system.systemKw,
    overallCoveragePct:    system.coveragePct,
    totalRoofAreaM2:       +totalRoofAreaM2.toFixed(1),
    totalUsedAreaM2:       +system.totalPanelAreaM2.toFixed(1),
    averageSolarScore,
    pendingAreaCount:      activeAreas.filter(
      (a) => computeAreaGenerationStatus(a) === AREA_GENERATION_STATUS.REGENERATION_REQUIRED,
    ).length,
  };
}

/**
 * System-level LIVE KPIs from the effective layout (snapshot ± user edits).
 *
 * @param {object|null} effectiveLayout  resolveEffectivePanelLayout output
 * @param {object[]} placementAreas
 */
export function computeEffectiveLayoutSummary(effectiveLayout, placementAreas = []) {
  return computeGeneratedLayoutSummary(effectiveLayout, placementAreas);
}

/**
 * System-level KPIs from the generated layout snapshot.
 *
 * @param {object|null} generatedLayout  generatedPanelLayout state
 * @param {object[]} placementAreas
 */
export function computeGeneratedLayoutSummary(generatedLayout, placementAreas = []) {
  const placedPanels = generatedLayout?.placedPanels ?? [];
  const activeAreas = (placementAreas ?? []).filter((a) => !a.deleted);

  if (!placedPanels.length) {
    return {
      panelCount:       0,
      systemKw:         0,
      coveragePct:      0,
      totalPanelAreaM2: 0,
      usableAreaM2:     0,
    };
  }

  let systemKw = 0;
  let totalPanelAreaM2 = 0;

  for (const panel of placedPanels) {
    const mod = getPanelById(panel.panelTypeId);
    const powerW = mod?.powerW ?? mod?.power ?? 0;
    const w = panel.width ?? mod?.widthM ?? mod?.width ?? 0;
    const h = panel.length ?? mod?.heightM ?? mod?.height ?? 0;
    systemKw += powerW / 1000;
    totalPanelAreaM2 += w * h;
  }

  const usableAreaM2 = activeAreas.reduce(
    (sum, a) => sum + (a.stats?.usableAreaM2 ?? a.stats?.areaM2 ?? 0),
    0,
  );

  const coveragePct = usableAreaM2 > 0
    ? (totalPanelAreaM2 / usableAreaM2) * 100
    : 0;

  return {
    panelCount:       placedPanels.length,
    systemKw:         +systemKw.toFixed(2),
    coveragePct,
    totalPanelAreaM2,
    usableAreaM2,
  };
}

/**
 * Per–placement-area rows for the Layout Summary section.
 *
 * Panel count and capacity are read from effectiveLayout.placedPanels (same
 * source as computeEffectiveLayoutSummary).  Module/orientation metadata still
 * comes from the generate-time area.generatedLayout record.
 *
 * @param {object[]} placementAreas
 * @param {object|null} effectiveLayout  activePanelLayout / panelLayout prop
 */
export function buildPlacementAreaLayoutSummaries(placementAreas = [], effectiveLayout = null) {
  const placedPanels = effectiveLayout?.placedPanels ?? [];

  return (placementAreas ?? [])
    .filter((a) => !a.deleted && a.generatedLayout)
    .map((area) => {
      const gl = area.generatedLayout;
      const mod = getPanelById(gl.moduleId);
      const moduleLabel = mod
        ? `${mod.manufacturer} ${mod.model} ${mod.powerW ?? mod.power}W`
        : gl.moduleId ?? "—";

      const areaPanels = panelsForArea(area.id, placedPanels);

      let capacityKw = 0;
      for (const panel of areaPanels) {
        const panelMod = getPanelById(panel.panelTypeId) ?? mod;
        const powerW = panelMod?.powerW ?? panelMod?.power ?? 0;
        capacityKw += powerW / 1000;
      }

      return {
        id:           area.id,
        name:         area.name,
        panelCount:   areaPanels.length,
        capacityKw:   +capacityKw.toFixed(2),
        moduleLabel,
        orientation:  gl.orientation ?? "portrait",
      };
    });
}

/** Resolve module label for config display. */
export function moduleLabelForId(moduleId) {
  const mod = PANEL_TYPES.find((m) => m.id === moduleId) ?? getPanelById(moduleId);
  if (!mod) return moduleId ?? "—";
  return `${mod.manufacturer} ${mod.model} — ${mod.powerW ?? mod.power}W`;
}
