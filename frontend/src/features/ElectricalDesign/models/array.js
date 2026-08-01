/**
 * array.js — Electrical Array entity factory + F1 auto-create from placement (pure).
 *
 * Reads placement output only — never mutates upstream panel/placement state.
 */

import { arrayLetterLabel } from "../../panels/panelArrays.js";
import {
  regionIdsForPlacementArea,
  resolvePlacementAreaConfig,
} from "../../panels/panelConfig.js";
import { DEFAULT_ARRAY_SPACING } from "../constants/defaults.js";
import { rotationDegEqual } from "./arrayRotation.js";

/**
 * @typedef {object} ElectricalArray
 * @property {string} id
 * @property {string} displayName
 * @property {string|null} sourcePlacementAreaId
 * @property {string[]} panelIds
 * @property {string} orientation
 * @property {number} tilt
 * @property {object} spacing
 * @property {string[]} stringIds
 * @property {number} rotationDeg
 * @property {boolean} frozen
 */

/**
 * @property {string} displayName
 * @property {string|null} sourcePlacementAreaId
 * @property {string[]} panelIds
 * @property {string} orientation
 * @property {number} tilt
 * @property {object} spacing
 * @property {string[]} stringIds
 * @property {number} rotationDeg
 * @property {boolean} frozen
 */

/**
 * Create one electrical Array record (references only — no copied panel objects).
 *
 * @param {object} params
 * @returns {ElectricalArray}
 */
export function createElectricalArray({
  id,
  displayName,
  sourcePlacementAreaId = null,
  panelIds = [],
  orientation = "portrait",
  tilt = 0,
  spacing = DEFAULT_ARRAY_SPACING,
  stringIds = [],
  rotationDeg = 0,
  frozen = false,
}) {
  return {
    id,
    displayName,
    sourcePlacementAreaId,
    panelIds: [...panelIds],
    orientation,
    tilt,
    spacing: { ...spacing },
    stringIds: [...stringIds],
    rotationDeg,
    frozen,
  };
}

/**
 * Panel slot ids belonging to one installable region (legacy workflow).
 *
 * @param {string} regionId
 * @param {object[]} placedPanels
 */
function panelIdsForRegion(regionId, placedPanels) {
  return placedPanels
    .filter((p) => p.regionId === regionId)
    .map((p) => p.slotId ?? p.id);
}

/**
 * F1 — Auto-create one Array per Placement Area on entering Electrical Design.
 *
 * Placement Area workflow: one array per active placement area (panels aggregated
 * across split installable region pieces). Legacy workflow: one array per
 * installable region when no engineer-drawn placement areas exist.
 *
 * @param {object} params
 * @param {object|null} params.panelLayout          effective placed-panel layout (read-only)
 * @param {object|null} params.placementReady       Step 5H contract (read-only)
 * @param {object[]}    params.placementAreas       active placement areas (read-only)
 * @param {boolean}     params.usePlacementAreaPanelWorkflow
 * @param {object}      params.projectPanelDefaults
 * @param {object|null} params.selectedPanel        legacy module fallback for orientation
 * @returns {ElectricalArray[]}
 */
export function buildArraysFromPlacement({
  panelLayout,
  placementReady,
  placementAreas = [],
  usePlacementAreaPanelWorkflow = false,
  projectPanelDefaults,
  selectedPanel = null,
}) {
  const placedPanels = panelLayout?.placedPanels ?? [];
  const installableRegions = placementReady?.installableRegions ?? [];
  const activeAreas = (placementAreas ?? []).filter((a) => !a.deleted);

  if (usePlacementAreaPanelWorkflow && activeAreas.length > 0) {
    const arrays = activeAreas.map((area, rank) => {
      const regionIds = regionIdsForPlacementArea(area, installableRegions);
      const panelIds = placedPanels
        .filter((p) => regionIds.has(p.regionId))
        .map((p) => p.slotId ?? p.id);

      const cfg = resolvePlacementAreaConfig(area.panelProperties);

      return createElectricalArray({
        id:                    area.id,
        displayName:           area.name?.trim() || `Array ${arrayLetterLabel(rank)}`,
        sourcePlacementAreaId: area.id,
        panelIds,
        orientation:           cfg.orientation,
        tilt:                  cfg.tilt,
        spacing:               DEFAULT_ARRAY_SPACING,
        stringIds:             [],
      });
    });

    arrays.sort(
      (a, b) => b.panelIds.length - a.panelIds.length || a.id.localeCompare(b.id),
    );
    return arrays;
  }

  /** Legacy: one array per installable region (region acts as placement factory). */
  const regionIds = [...new Set(placedPanels.map((p) => p.regionId).filter(Boolean))];

  const arrays = regionIds.map((regionId, rank) => {
    const region = installableRegions.find((r) => r.id === regionId) ?? {};
    const panelIds = panelIdsForRegion(regionId, placedPanels);

    return createElectricalArray({
      id:                    regionId,
      displayName:           region.name?.trim() || `Array ${arrayLetterLabel(rank)}`,
      sourcePlacementAreaId: region.sourceId ?? regionId,
      panelIds,
      orientation:           projectPanelDefaults?.orientation ?? "portrait",
      tilt:                  region.pitch ?? projectPanelDefaults?.tilt ?? 0,
      spacing:               DEFAULT_ARRAY_SPACING,
      stringIds:             [],
    });
  });

  arrays.sort(
    (a, b) => b.panelIds.length - a.panelIds.length || a.id.localeCompare(b.id),
  );
  return arrays;
}

/** Deep equality for spacing objects stored on arrays. */
export function spacingEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.panelGapM === b.panelGapM
    && a.interRowGapM === b.interRowGapM
    && a.edgeClearanceM === b.edgeClearanceM
    && a.obstacleClearanceM === b.obstacleClearanceM
  );
}

/**
 * Validate whether the selected arrays can merge per TDD §12a.
 *
 * @param {ElectricalArray[]} arrays
 * @param {string[]} arrayIds
 * @returns {{ ok: true, arrays: ElectricalArray[] } | { ok: false, reason: string }}
 */
export function validateMergeCompatibility(arrays, arrayIds) {
  if (!arrayIds?.length || arrayIds.length < 2) {
    return { ok: false, reason: "Select at least two arrays to merge." };
  }

  const selected = arrayIds
    .map((id) => arrays.find((a) => a.id === id))
    .filter(Boolean);

  if (selected.length !== arrayIds.length) {
    return { ok: false, reason: "One or more selected arrays could not be found." };
  }

  const [first, ...rest] = selected;

  for (const arr of rest) {
    if (arr.orientation !== first.orientation) {
      return {
        ok:     false,
        reason: "Arrays cannot be merged because their orientations differ.",
      };
    }
    if (arr.tilt !== first.tilt) {
      return {
        ok:     false,
        reason: "Arrays cannot be merged because their tilts differ.",
      };
    }
    if (!spacingEqual(arr.spacing, first.spacing)) {
      return {
        ok:     false,
        reason: "Arrays cannot be merged because their spacing differs.",
      };
    }
    if (!rotationDegEqual(arr.rotationDeg, first.rotationDeg)) {
      return {
        ok:     false,
        reason: "Arrays cannot be merged because their rotation differs.",
      };
    }
  }

  return { ok: true, arrays: selected };
}

/**
 * Merge compatible arrays into one new array (pure). Clears stringIds per TDD §12a/§12b.
 *
 * @param {ElectricalArray[]} arrays
 * @param {string[]} arrayIds
 * @param {string} [displayName]
 * @returns {{ ok: true, merged: ElectricalArray, arrays: ElectricalArray[] } | { ok: false, reason: string }}
 */
export function mergeElectricalArrays(arrays, arrayIds, displayName = "Merged Array") {
  const check = validateMergeCompatibility(arrays, arrayIds);
  if (!check.ok) return check;

  const selected = check.arrays;
  const panelIdSet = new Set();
  for (const arr of selected) {
    for (const pid of arr.panelIds) panelIdSet.add(pid);
  }

  const sourceIds = selected.map((a) => a.sourcePlacementAreaId);
  const uniqueSources = new Set(sourceIds.filter(Boolean));
  const sourcePlacementAreaId = uniqueSources.size === 1 ? [...uniqueSources][0] : null;

  const first = selected[0];
  const mergedId = typeof crypto !== "undefined" && crypto.randomUUID
    ? `merged-${crypto.randomUUID()}`
    : `merged-${Date.now()}`;

  const merged = createElectricalArray({
    id: mergedId,
    displayName: (displayName ?? "Merged Array").trim() || "Merged Array",
    sourcePlacementAreaId,
    panelIds:    [...panelIdSet],
    orientation: first.orientation,
    tilt:        first.tilt,
    spacing:     { ...first.spacing },
    stringIds:   [],
    rotationDeg: first.rotationDeg ?? 0,
    frozen:      false,
  });

  const removeIds = new Set(arrayIds);
  const nextArrays = [
    ...arrays.filter((a) => !removeIds.has(a.id)),
    merged,
  ];

  return { ok: true, merged, arrays: nextArrays };
}

/**
 * Default display name for a split array — same letter strategy as F1 auto-create.
 *
 * @param {ElectricalArray[]} arrays
 */
export function defaultSplitArrayDisplayName(arrays) {
  const usedNames = new Set((arrays ?? []).map((a) => a.displayName));
  let rank = arrays.length;
  let name = `Array ${arrayLetterLabel(rank)}`;
  while (usedNames.has(name)) {
    rank += 1;
    name = `Array ${arrayLetterLabel(rank)}`;
  }
  return name;
}

/**
 * Validate panel selection for splitting an array (pure).
 *
 * @param {ElectricalArray[]} arrays
 * @param {string} sourceArrayId
 * @param {string[]} selectedPanelIds
 * @returns {{ ok: true, source: ElectricalArray, normalizedSelection: string[] } | { ok: false, reason: string }}
 */
export function validateSplitSelection(arrays, sourceArrayId, selectedPanelIds) {
  const source = (arrays ?? []).find((a) => a.id === sourceArrayId);
  if (!source) {
    return { ok: false, reason: "Source array could not be found." };
  }

  if (!selectedPanelIds?.length) {
    return { ok: false, reason: "Select at least one panel to split." };
  }

  if (source.panelIds.length < 2) {
    return { ok: false, reason: "Array must contain at least two panels to split." };
  }

  const sourceSet = new Set(source.panelIds);
  const normalizedSelection = [];
  const seen = new Set();

  for (const id of selectedPanelIds) {
    if (!sourceSet.has(id)) {
      return { ok: false, reason: "Selection includes panels outside the active array." };
    }
    if (!seen.has(id)) {
      seen.add(id);
      normalizedSelection.push(id);
    }
  }

  if (normalizedSelection.length === 0) {
    return { ok: false, reason: "Select at least one panel to split." };
  }

  if (normalizedSelection.length >= source.panelIds.length) {
    return {
      ok:     false,
      reason: "Cannot split — at least one panel must remain in the source array.",
    };
  }

  return { ok: true, source, normalizedSelection };
}

/**
 * Split selected panels from one array into a new array (pure). Clears stringIds per TDD §12a/§12b.
 * Preserves original panelIds ordering within both resulting arrays.
 *
 * @param {ElectricalArray[]} arrays
 * @param {string} sourceArrayId
 * @param {string[]} selectedPanelIds
 * @param {string} [displayName]
 * @returns {{ ok: true, source: ElectricalArray, split: ElectricalArray, arrays: ElectricalArray[] } | { ok: false, reason: string }}
 */
export function splitElectricalArray(
  arrays,
  sourceArrayId,
  selectedPanelIds,
  displayName,
) {
  const check = validateSplitSelection(arrays, sourceArrayId, selectedPanelIds);
  if (!check.ok) return check;

  const { source, normalizedSelection } = check;
  const selectedSet = new Set(normalizedSelection);

  const remainingPanelIds = source.panelIds.filter((id) => !selectedSet.has(id));
  const splitPanelIds = source.panelIds.filter((id) => selectedSet.has(id));

  const splitId = typeof crypto !== "undefined" && crypto.randomUUID
    ? `split-${crypto.randomUUID()}`
    : `split-${Date.now()}`;

  const split = createElectricalArray({
    id:                    splitId,
    displayName:           displayName?.trim() || defaultSplitArrayDisplayName(arrays),
    sourcePlacementAreaId: source.sourcePlacementAreaId,
    panelIds:              splitPanelIds,
    orientation:           source.orientation,
    tilt:                  source.tilt,
    spacing:               { ...source.spacing },
    stringIds:             [],
    rotationDeg:           source.rotationDeg ?? 0,
    frozen:                false,
  });

  const updatedSource = {
    ...source,
    panelIds:  remainingPanelIds,
    stringIds: [],
    frozen:    false,
  };

  const nextArrays = [
    ...arrays.map((a) => (a.id === sourceArrayId ? updatedSource : a)),
    split,
  ];

  return { ok: true, source: updatedSource, split, arrays: nextArrays };
}

/**
 * Rename array displayName only (pure preview — store applies via reducer).
 *
 * @param {ElectricalArray[]} arrays
 * @param {string} arrayId
 * @param {string} displayName
 */
export function renameElectricalArray(arrays, arrayId, displayName) {
  const trimmed = displayName?.trim();
  if (!trimmed) return arrays;
  return arrays.map((a) => (a.id === arrayId ? { ...a, displayName: trimmed } : a));
}

/**
 * Stable fingerprint for re-initializing arrays when upstream placement changes.
 *
 * @param {object} params
 */
export function placementInitFingerprint({
  panelLayout,
  placementReady,
  placementAreas = [],
  usePlacementAreaPanelWorkflow = false,
  projectPanelDefaults,
}) {
  const placedPanels = panelLayout?.placedPanels ?? [];
  const panelSig = placedPanels
    .map((p) => `${p.regionId}:${p.slotId ?? p.id}`)
    .sort()
    .join("|");

  const areaSig = (placementAreas ?? [])
    .filter((a) => !a.deleted)
    .map((a) => {
      const cfg = resolvePlacementAreaConfig(a.panelProperties);
      return `${a.id}:${a.name}:${cfg.moduleId}:${cfg.orientation}:${cfg.tilt}`;
    })
    .sort()
    .join("|");

  const regionSig = (placementReady?.installableRegions ?? [])
    .map((r) => `${r.id}:${r.sourceId}`)
    .sort()
    .join("|");

  return JSON.stringify({
    source: usePlacementAreaPanelWorkflow ? "placementAreas" : "engineering",
    panelSig,
    areaSig,
    regionSig,
  });
}

function panelIdSetEqual(a, b) {
  const setA = new Set(a ?? []);
  const setB = new Set(b ?? []);
  if (setA.size !== setB.size) return false;
  for (const id of setA) {
    if (!setB.has(id)) return false;
  }
  return true;
}

/**
 * Restore rotationDeg / frozen when remounting Step 7 if panel membership is unchanged.
 *
 * @param {ElectricalArray[]} freshArrays
 * @param {ElectricalArray[]} persistedArrays
 */
export function mergePersistedArrayTransforms(freshArrays, persistedArrays) {
  if (!persistedArrays?.length) return freshArrays;

  const persistedById = new Map(persistedArrays.map((a) => [a.id, a]));

  return (freshArrays ?? []).map((fresh) => {
    const persisted = persistedById.get(fresh.id);
    if (!persisted || !panelIdSetEqual(fresh.panelIds, persisted.panelIds)) {
      return fresh;
    }
    return {
      ...fresh,
      rotationDeg: persisted.rotationDeg ?? 0,
      frozen:      persisted.frozen ?? false,
    };
  });
}
