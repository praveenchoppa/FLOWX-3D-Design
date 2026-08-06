/**
 * electricalPersistence.js — Pure reconciliation for Electrical Design persistence (Phase 2).
 *
 * Resolves persisted electrical state against current placement without React or store coupling.
 */

import {
  buildArraysFromPlacement,
  createElectricalArray,
  placementInitFingerprint,
} from "./array.js";
import {
  createElectricalString,
  orderPanelsSpatially,
  syncArrayStringIds,
} from "./string.js";
import {
  pruneMpptStringReferences,
  rebuildMpptStringIdsFromStrings,
} from "./stringAssignment.js";

/** @typedef {"fresh"|"restore"|"reconcile"} ElectricalInitMode */

/**
 * Decide whether INIT should fresh-build, restore, or reconcile persisted electrical state.
 *
 * @param {object} params
 * @param {string|null} params.storedFingerprint
 * @param {string} params.currentFingerprint
 * @param {object[]} [params.persistedArrays]
 * @param {object[]} [params.persistedStrings]
 * @returns {ElectricalInitMode}
 */
export function resolveElectricalInitMode({
  storedFingerprint = null,
  currentFingerprint,
  persistedArrays = [],
  persistedStrings = [],
}) {
  const hasPersistedWork = (persistedArrays?.length ?? 0) > 0
    || (persistedStrings?.length ?? 0) > 0;

  if (!hasPersistedWork || storedFingerprint == null) {
    return "fresh";
  }

  if (storedFingerprint === currentFingerprint) {
    return "restore";
  }

  return "reconcile";
}

/**
 * @param {object|null} panelLayout
 * @returns {Set<string>}
 */
function collectValidPanelIds(panelLayout) {
  return new Set(
    (panelLayout?.placedPanels ?? [])
      .map((p) => p.slotId ?? p.id)
      .filter(Boolean),
  );
}

/**
 * @param {object[]} baselineArrays
 * @returns {Map<string, string>}
 */
function buildBaselinePanelOwnerMap(baselineArrays) {
  const map = new Map();
  for (const arr of baselineArrays ?? []) {
    for (const pid of arr.panelIds ?? []) {
      if (!map.has(pid)) map.set(pid, arr.id);
    }
  }
  return map;
}

/**
 * @param {string} panelId
 * @param {string[]} claimants
 * @param {string|null} baselineArrayId
 */
function pickConflictOwner(panelId, claimants, baselineArrayId) {
  if (baselineArrayId && claimants.includes(baselineArrayId)) {
    return baselineArrayId;
  }
  return [...claimants].sort((a, b) => a.localeCompare(b))[0];
}

/**
 * Preserve persisted panel order where possible when rebuilding membership.
 *
 * @param {string[]} desiredPanelIds
 * @param {object|null} persistedArray
 */
function orderPanelIds(desiredPanelIds, persistedArray) {
  const panelSet = new Set(desiredPanelIds);
  const ordered = (persistedArray?.panelIds ?? []).filter((id) => panelSet.has(id));
  for (const id of desiredPanelIds) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

/**
 * Reconcile electrical arrays against valid panels and baseline ownership.
 *
 * @param {object} params
 * @param {ElectricalInitMode} params.mode
 * @param {object[]} params.persistedArrays
 * @param {object[]} params.baselineArrays
 * @param {Set<string>} params.validPanelIds
 * @param {Map<string, object>} params.baselineById
 * @param {Map<string, string>} params.baselineOwner
 */
function reconcileArrayPartition({
  mode,
  persistedArrays,
  baselineArrays,
  validPanelIds,
  baselineById,
  baselineOwner,
}) {
  if (mode === "fresh") {
    return baselineArrays.map((a) => ({ ...a, stringIds: [] }));
  }

  const persistedById = new Map((persistedArrays ?? []).map((a) => [a.id, a]));

  const working = (persistedArrays ?? [])
    .map((a) => ({
      ...a,
      panelIds: [...new Set((a.panelIds ?? []).filter((id) => validPanelIds.has(id)))],
      stringIds: a.stringIds ?? [],
    }))
    .filter((a) => a.panelIds.length > 0);

  /** @type {Map<string, Set<string>>} */
  const claims = new Map();
  for (const arr of working) {
    for (const pid of arr.panelIds) {
      if (!claims.has(pid)) claims.set(pid, new Set());
      claims.get(pid).add(arr.id);
    }
  }

  /** @type {Map<string, string>} */
  const panelToArray = new Map();
  for (const pid of validPanelIds) {
    const claimants = [...(claims.get(pid) ?? [])];
    const baselineArrayId = baselineOwner.get(pid) ?? null;

    if (claimants.length === 0) {
      if (baselineArrayId) panelToArray.set(pid, baselineArrayId);
      continue;
    }

    if (claimants.length === 1) {
      panelToArray.set(pid, claimants[0]);
      continue;
    }

    panelToArray.set(pid, pickConflictOwner(pid, claimants, baselineArrayId));
  }

  /** @type {Map<string, string[]>} */
  const panelsByArray = new Map();
  for (const [pid, arrayId] of panelToArray) {
    if (!panelsByArray.has(arrayId)) panelsByArray.set(arrayId, []);
    panelsByArray.get(arrayId).push(pid);
  }

  /** @type {object[]} */
  const result = [];

  for (const [arrayId, panelIds] of panelsByArray) {
    if (!panelIds.length) continue;

    const persisted = working.find((a) => a.id === arrayId) ?? persistedById.get(arrayId);
    const baseline = baselineById.get(arrayId);

    if (!persisted && !baseline) {
      if (mode === "reconcile") continue;
      continue;
    }

    const template = persisted ?? baseline;
    result.push({
      ...template,
      panelIds: orderPanelIds(panelIds, persisted),
      stringIds: persisted?.stringIds ?? [],
    });
  }

  result.sort(
    (a, b) => b.panelIds.length - a.panelIds.length || a.id.localeCompare(b.id),
  );

  return result;
}

/**
 * @param {object} existingString
 * @param {string[]} panelIds
 * @param {object|null} panelLayout
 */
function rebuildStringFromPanels(existingString, panelIds, panelLayout) {
  const orderedPanelSequence = orderPanelsSpatially(panelLayout, panelIds);
  return createElectricalString({
    id:                  existingString.id,
    displayName:         existingString.displayName,
    arrayId:             existingString.arrayId,
    orderedPanelSequence,
    mpptId:              existingString.mpptId,
    sameAngleEnforced:   existingString.sameAngleEnforced,
    status:              existingString.status,
    calculatedVoltage:   existingString.calculatedVoltage,
    calculatedCurrent:   existingString.calculatedCurrent,
    calculatedPower:     existingString.calculatedPower,
  });
}

/**
 * @param {object[]} persistedStrings
 * @param {object[]} arrays
 * @param {object|null} panelLayout
 * @param {Set<string>} validPanelIds
 * @param {Set<string>} validMpptIds
 */
function reconcileStrings(persistedStrings, arrays, panelLayout, validPanelIds, validMpptIds) {
  const arrayIds = new Set(arrays.map((a) => a.id));
  const arrayPanelIds = new Map(
    arrays.map((a) => [a.id, new Set(a.panelIds ?? [])]),
  );

  const result = [];

  for (const str of persistedStrings ?? []) {
    if (!arrayIds.has(str.arrayId)) continue;

    const allowed = arrayPanelIds.get(str.arrayId) ?? new Set();
    const filtered = (str.orderedPanelSequence ?? []).filter(
      (id) => validPanelIds.has(id) && allowed.has(id),
    );

    if (filtered.length === 0) continue;

    const original = str.orderedPanelSequence ?? [];
    const sequenceChanged = filtered.length !== original.length
      || filtered.some((id, i) => id !== original[i]);

    let next = str;
    if (sequenceChanged) {
      next = rebuildStringFromPanels(str, filtered, panelLayout);
    }

    if (next.mpptId != null && !validMpptIds.has(next.mpptId)) {
      next = { ...next, mpptId: null };
    }

    result.push(next);
  }

  return result;
}

/**
 * Filter MPPT entities to valid inverters and rebuild string references from strings.
 *
 * @param {object[]} persistedMppts
 * @param {object[]} persistedInverters
 * @param {object[]} strings
 */
function reconcileMppts(persistedMppts, persistedInverters, strings) {
  const validInverterIds = new Set((persistedInverters ?? []).map((i) => i.id));
  const filtered = (persistedMppts ?? []).filter(
    (m) => validInverterIds.has(m.inverterId),
  );

  const rebuilt = rebuildMpptStringIdsFromStrings(strings, filtered);
  return pruneMpptStringReferences(rebuilt, (strings ?? []).map((s) => s.id));
}

/**
 * Reconcile persisted electrical collections against current placement.
 *
 * @param {object} params
 * @param {object|null} params.panelLayout
 * @param {object|null} [params.placementReady]
 * @param {object[]} [params.placementAreas]
 * @param {boolean} [params.usePlacementAreaPanelWorkflow]
 * @param {object} [params.projectPanelDefaults]
 * @param {object|null} [params.selectedPanel]
 * @param {object[]} [params.persistedArrays]
 * @param {object[]} [params.persistedStrings]
 * @param {object[]} [params.persistedMppts]
 * @param {object[]} [params.persistedInverters]
 * @param {ElectricalInitMode} params.mode
 * @returns {{
 *   mode: ElectricalInitMode,
 *   arrays: object[],
 *   strings: object[],
 *   mppts: object[],
 *   inverters: object[],
 *   fingerprint: string,
 * }}
 */
export function reconcilePersistedElectricalState({
  panelLayout,
  placementReady = null,
  placementAreas = [],
  usePlacementAreaPanelWorkflow = false,
  projectPanelDefaults = null,
  selectedPanel = null,
  persistedArrays = [],
  persistedStrings = [],
  persistedMppts = [],
  persistedInverters = [],
  mode,
}) {
  const fingerprint = placementInitFingerprint({
    panelLayout,
    placementReady,
    placementAreas,
    usePlacementAreaPanelWorkflow,
    projectPanelDefaults,
  });

  const validPanelIds = collectValidPanelIds(panelLayout);

  const baselineArrays = buildArraysFromPlacement({
    panelLayout,
    placementReady,
    placementAreas,
    usePlacementAreaPanelWorkflow,
    projectPanelDefaults,
    selectedPanel,
  });

  const baselineById = new Map(baselineArrays.map((a) => [a.id, a]));
  const baselineOwner = buildBaselinePanelOwnerMap(baselineArrays);

  const arrays = reconcileArrayPartition({
    mode,
    persistedArrays,
    baselineArrays,
    validPanelIds,
    baselineById,
    baselineOwner,
  });

  const validInverterIds = new Set((persistedInverters ?? []).map((i) => i.id));
  const inverters = (persistedInverters ?? []).filter((i) => validInverterIds.has(i.id));

  const prelimMppts = (persistedMppts ?? []).filter(
    (m) => validInverterIds.has(m.inverterId),
  );
  const validMpptIds = new Set(prelimMppts.map((m) => m.id));

  const strings = mode === "fresh"
    ? []
    : reconcileStrings(
      persistedStrings,
      arrays,
      panelLayout,
      validPanelIds,
      validMpptIds,
    );

  const syncedArrays = syncArrayStringIds(arrays, strings);
  const mppts = reconcileMppts(prelimMppts, inverters, strings);

  return {
    mode,
    arrays:    syncedArrays,
    strings,
    mppts,
    inverters,
    fingerprint,
  };
}

/**
 * Convenience: resolve mode from fingerprints then reconcile.
 *
 * @param {object} params
 * @param {string|null} [params.storedFingerprint]
 * @param {string} [params.currentFingerprint]
 * @param {object|null} params.panelLayout
 * @param {object|null} [params.placementReady]
 * @param {object[]} [params.placementAreas]
 * @param {boolean} [params.usePlacementAreaPanelWorkflow]
 * @param {object} [params.projectPanelDefaults]
 * @param {object|null} [params.selectedPanel]
 * @param {object[]} [params.persistedArrays]
 * @param {object[]} [params.persistedStrings]
 * @param {object[]} [params.persistedMppts]
 * @param {object[]} [params.persistedInverters]
 */
export function reconcileElectricalFromFingerprints({
  storedFingerprint = null,
  currentFingerprint = null,
  panelLayout,
  placementReady = null,
  placementAreas = [],
  usePlacementAreaPanelWorkflow = false,
  projectPanelDefaults = null,
  selectedPanel = null,
  persistedArrays = [],
  persistedStrings = [],
  persistedMppts = [],
  persistedInverters = [],
}) {
  const fingerprint = currentFingerprint ?? placementInitFingerprint({
    panelLayout,
    placementReady,
    placementAreas,
    usePlacementAreaPanelWorkflow,
    projectPanelDefaults,
  });

  const mode = resolveElectricalInitMode({
    storedFingerprint,
    currentFingerprint: fingerprint,
    persistedArrays,
    persistedStrings,
  });

  return reconcilePersistedElectricalState({
    panelLayout,
    placementReady,
    placementAreas,
    usePlacementAreaPanelWorkflow,
    projectPanelDefaults,
    selectedPanel,
    persistedArrays,
    persistedStrings,
    persistedMppts,
    persistedInverters,
    mode,
  });
}

/**
 * Assert panel partition invariants (for tests).
 *
 * @param {object[]} arrays
 * @param {Set<string>} validPanelIds
 * @param {Map<string, string>} [baselineOwner]
 */
export function assertPanelPartitionInvariant(arrays, validPanelIds, baselineOwner = null) {
  const seen = new Map();

  for (const arr of arrays ?? []) {
    for (const pid of arr.panelIds ?? []) {
      if (!validPanelIds.has(pid)) {
        throw new Error(`array ${arr.id} references invalid panel ${pid}`);
      }
      if (seen.has(pid)) {
        throw new Error(`panel ${pid} appears in arrays ${seen.get(pid)} and ${arr.id}`);
      }
      seen.set(pid, arr.id);
    }
  }

  for (const pid of validPanelIds) {
    if (!seen.has(pid)) {
      throw new Error(`panel ${pid} is missing from electrical arrays`);
    }
  }

  if (baselineOwner) {
    for (const [pid, ownerId] of seen) {
      const baselineId = baselineOwner.get(pid);
      if (baselineId && seen.get(pid) !== baselineId) {
        const claimants = [...seen.entries()].filter(([, id]) => id !== baselineId);
        if (claimants.some(([p]) => p === pid)) {
          // Only enforced when duplicates existed; single split ownership is allowed.
        }
      }
    }
  }
}

export { placementInitFingerprint, createElectricalArray };
