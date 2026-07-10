/**
 * panelLayoutSummary.js — UI summaries from the generated layout snapshot (pure).
 *
 * Reads placedPanels on generatedPanelLayout only — never allValidSlots or
 * maximum-fit preview values.
 */

import { getPanelById, PANEL_TYPES } from "./panelTypes.js";

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

      const areaPanels = placedPanels.filter(
        (p) => p.regionId === area.id || p.regionId?.startsWith(`${area.id}::`),
      );

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
  return `${mod.manufacturer} ${mod.model} — ${mod.powerW}W`;
}
