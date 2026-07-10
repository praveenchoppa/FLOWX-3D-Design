/**
 * panelArrays.js — Step 6C-1 array auto-grouping (pure, renderer-agnostic).
 *
 * One array per installable region (grouped by panel.regionId).
 * MUST receive the EFFECTIVE layout after 6B-1 overrides — not basePanelLayout.
 */

import { getPanelById } from "./panelTypes.js";

/** A → Z → AA … for default array labels. */
export function arrayLetterLabel(index) {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/**
 * Drop display-name edits for regions that no longer exist.
 *
 * @param {Record<string, string>} edits  regionId → user displayName
 * @param {string[]} validRegionIds
 */
export function reconcileArrayDisplayNames(edits, validRegionIds = []) {
  const valid = new Set(validRegionIds);
  const next = {};
  for (const [regionId, name] of Object.entries(edits ?? {})) {
    if (valid.has(regionId) && typeof name === "string" && name.trim()) {
      next[regionId] = name.trim();
    }
  }
  return next;
}

/**
 * Derive panel arrays from the effective placed-panel layout.
 *
 * @param {object|null} panelLayout     effective layout (applyPanelOverrides output)
 * @param {object|null} placementReady  Step 5H contract (region metadata)
 * @param {object|null} selectedPanel   module spec (power for kW)
 * @param {Record<string, string>} displayNameEdits  user renames keyed by regionId
 * @returns {object[]}
 */
export function computePanelArrays(
  panelLayout,
  placementReady,
  selectedPanel,
  displayNameEdits = {},
) {
  const placedPanels = panelLayout?.placedPanels ?? [];
  if (!placedPanels.length || !selectedPanel) return [];

  const regionById = new Map(
    (placementReady?.installableRegions ?? []).map((r) => [r.id, r]),
  );

  /** @type {Map<string, string[]>} */
  const panelIdsByRegion = new Map();

  for (const panel of placedPanels) {
    const regionId = panel.regionId;
    if (!regionId) continue;
    const pid = panel.slotId ?? panel.id;
    if (!panelIdsByRegion.has(regionId)) panelIdsByRegion.set(regionId, []);
    panelIdsByRegion.get(regionId).push(pid);
  }

  const raw = [...panelIdsByRegion.entries()].map(([regionId, panelIds]) => {
    const region = regionById.get(regionId) ?? {};
    const panelCount = panelIds.length;
    const samplePanel = placedPanels.find((p) => p.regionId === regionId);
    const module = getPanelById(samplePanel?.panelTypeId) ?? selectedPanel;
    const powerW = module?.power ?? selectedPanel?.power ?? 0;
    return {
      id:         regionId,
      regionId,
      roofId:     region.roofId ?? placedPanels.find((p) => p.regionId === regionId)?.roofId ?? null,
      zoneClass:  region.zoneClass ?? "good",
      azimuth:    region.azimuth ?? null,
      pitch:      region.pitch ?? null,
      panelIds,
      panelCount,
      systemKw:   (panelCount * powerW) / 1000,
    };
  });

  raw.sort((a, b) => b.panelCount - a.panelCount || a.regionId.localeCompare(b.regionId));

  return raw.map((arr, rank) => ({
    ...arr,
    displayName: displayNameEdits[arr.regionId] ?? `Array ${arrayLetterLabel(rank)}`,
    systemKw:    +arr.systemKw.toFixed(2),
  }));
}
