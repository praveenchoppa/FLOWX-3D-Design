/**
 * string.js — Electrical String entity factory + P3.1 manual creation (pure).
 */

import { canPickPanelsInActiveArray } from "../utils/panelSelectionUtils.js";

/**
 * @typedef {object} ElectricalString
 * @property {string} id
 * @property {string} displayName
 * @property {string} arrayId
 * @property {string[]} orderedPanelSequence
 * @property {string|null} startPanelId
 * @property {string|null} endPanelId
 * @property {string|null} mpptId
 * @property {boolean} sameAngleEnforced
 * @property {"valid"|"warning"} status
 * @property {number|null} calculatedVoltage
 * @property {number|null} calculatedCurrent
 * @property {number|null} calculatedPower
 */

/** Derive series endpoints from ordered sequence (keep in sync on reorder in P3.2). */
export function deriveStringEndpoints(orderedPanelSequence = []) {
  if (!orderedPanelSequence.length) {
    return { startPanelId: null, endPanelId: null };
  }
  return {
    startPanelId: orderedPanelSequence[0],
    endPanelId:   orderedPanelSequence[orderedPanelSequence.length - 1],
  };
}

/**
 * @param {object} params
 * @returns {ElectricalString}
 */
export function createElectricalString({
  id,
  displayName,
  arrayId,
  orderedPanelSequence = [],
  mpptId = null,
  sameAngleEnforced = false,
  status = "valid",
  calculatedVoltage = null,
  calculatedCurrent = null,
  calculatedPower = null,
}) {
  const sequence = [...orderedPanelSequence];
  const { startPanelId, endPanelId } = deriveStringEndpoints(sequence);

  return {
    id,
    displayName,
    arrayId,
    orderedPanelSequence: sequence,
    startPanelId,
    endPanelId,
    mpptId,
    sameAngleEnforced,
    status,
    calculatedVoltage,
    calculatedCurrent,
    calculatedPower,
  };
}

/**
 * Default display name scoped to one array: String 1, String 2, …
 *
 * @param {ElectricalString[]} strings
 * @param {string} arrayId
 */
export function defaultStringDisplayName(strings, arrayId) {
  const inArray = (strings ?? []).filter((s) => s.arrayId === arrayId);
  const usedNames = new Set(inArray.map((s) => s.displayName));
  let n = inArray.length + 1;
  let name = `String ${n}`;
  while (usedNames.has(name)) {
    n += 1;
    name = `String ${n}`;
  }
  return name;
}

/**
 * Strings belonging to the given array ids.
 *
 * @param {ElectricalString[]} strings
 * @param {string} arrayId
 */
export function stringsForArray(strings, arrayId) {
  return (strings ?? []).filter((s) => s.arrayId === arrayId);
}

/**
 * All slotIds assigned to a string in one array.
 *
 * @param {ElectricalString[]} strings
 * @param {string} arrayId
 */
export function assignedPanelIdsForArray(strings, arrayId) {
  const ids = new Set();
  for (const str of stringsForArray(strings, arrayId)) {
    for (const pid of str.orderedPanelSequence ?? []) ids.add(pid);
  }
  return ids;
}

/**
 * Panel slotIds in the array not yet assigned to any string.
 *
 * @param {object} array
 * @param {ElectricalString[]} strings
 */
export function getUnassignedPanelIds(array, strings) {
  const assigned = assignedPanelIdsForArray(strings, array?.id);
  return (array?.panelIds ?? []).filter((id) => !assigned.has(id));
}

/**
 * Remove strings owned by any of the given array ids.
 *
 * @param {ElectricalString[]} strings
 * @param {string[]} arrayIds
 */
export function purgeStringsForArrays(strings, arrayIds) {
  const remove = new Set(arrayIds ?? []);
  return (strings ?? []).filter((s) => !remove.has(s.arrayId));
}

/**
 * Sort selected slotIds by physical row/col on the roof (default creation order only).
 *
 * @param {object|null} panelLayout
 * @param {string[]} slotIds
 */
export function orderPanelsSpatially(panelLayout, slotIds) {
  const placed = panelLayout?.placedPanels ?? [];
  const bySlot = new Map(
    placed.map((p) => [p.slotId ?? p.id, p]),
  );

  return [...slotIds].sort((a, b) => {
    const pa = bySlot.get(a);
    const pb = bySlot.get(b);
    const rowA = pa?.row ?? 0;
    const rowB = pb?.row ?? 0;
    if (rowA !== rowB) return rowA - rowB;
    const colA = pa?.col ?? 0;
    const colB = pb?.col ?? 0;
    if (colA !== colB) return colA - colB;
    return a.localeCompare(b);
  });
}

/**
 * Validate manual string creation input.
 *
 * @param {object[]} arrays
 * @param {ElectricalString[]} strings
 * @param {string} arrayId
 * @param {string[]} selectedPanelIds
 */
export function validateStringCreation(arrays, strings, arrayId, selectedPanelIds) {
  if (!canPickPanelsInActiveArray(arrayId, [arrayId])) {
    return { ok: false, reason: "Select a single array before creating a string." };
  }

  const array = (arrays ?? []).find((a) => a.id === arrayId);
  if (!array) {
    return { ok: false, reason: "Active array could not be found." };
  }

  if (!selectedPanelIds?.length) {
    return { ok: false, reason: "Select at least one panel to create a string." };
  }

  const arraySet = new Set(array.panelIds);
  const normalizedSelection = [];
  const seen = new Set();

  for (const id of selectedPanelIds) {
    if (!arraySet.has(id)) {
      return { ok: false, reason: "Selection includes panels outside the active array." };
    }
    if (!seen.has(id)) {
      seen.add(id);
      normalizedSelection.push(id);
    }
  }

  if (normalizedSelection.length === 0) {
    return { ok: false, reason: "Select at least one panel to create a string." };
  }

  const assigned = assignedPanelIdsForArray(strings, arrayId);
  const alreadyAssigned = normalizedSelection.filter((id) => assigned.has(id));
  if (alreadyAssigned.length > 0) {
    return {
      ok:     false,
      reason: "One or more selected panels are already assigned to a string.",
    };
  }

  return { ok: true, array, normalizedSelection };
}

/**
 * Whether every selected panel is unassigned in the active array.
 *
 * @param {ElectricalString[]} strings
 * @param {string} arrayId
 * @param {string[]} selectedPanelIds
 */
export function selectedPanelsAreUnassigned(strings, arrayId, selectedPanelIds) {
  if (!selectedPanelIds?.length) return false;
  const assigned = assignedPanelIdsForArray(strings, arrayId);
  return selectedPanelIds.every((id) => !assigned.has(id));
}

/**
 * Create a string from panel selection and update array.stringIds (pure).
 *
 * @param {object[]} arrays
 * @param {ElectricalString[]} strings
 * @param {string} arrayId
 * @param {string[]} selectedPanelIds
 * @param {object|null} panelLayout
 * @param {string} [displayName]
 */
export function createStringFromSelection(
  arrays,
  strings,
  arrayId,
  selectedPanelIds,
  panelLayout,
  displayName,
) {
  const check = validateStringCreation(arrays, strings, arrayId, selectedPanelIds);
  if (!check.ok) return check;

  const { array, normalizedSelection } = check;
  const orderedPanelSequence = orderPanelsSpatially(panelLayout, normalizedSelection);

  const stringId = typeof crypto !== "undefined" && crypto.randomUUID
    ? `string-${crypto.randomUUID()}`
    : `string-${Date.now()}`;

  const created = createElectricalString({
    id:                   stringId,
    displayName:          displayName?.trim() || defaultStringDisplayName(strings, arrayId),
    arrayId,
    orderedPanelSequence,
  });

  const nextStrings = [...(strings ?? []), created];
  const nextArrays = (arrays ?? []).map((a) => (
    a.id === arrayId
      ? { ...a, stringIds: [...(a.stringIds ?? []), created.id] }
      : a
  ));

  return {
    ok: true,
    string:  created,
    arrays:  nextArrays,
    strings: nextStrings,
  };
}

/**
 * Clear stringIds on arrays after purge and return updated arrays.
 *
 * @param {object[]} arrays
 * @param {ElectricalString[]} strings
 */
export function syncArrayStringIds(arrays, strings) {
  const idsByArray = new Map();
  for (const str of strings ?? []) {
    if (!idsByArray.has(str.arrayId)) idsByArray.set(str.arrayId, []);
    idsByArray.get(str.arrayId).push(str.id);
  }

  return (arrays ?? []).map((a) => ({
    ...a,
    stringIds: idsByArray.get(a.id) ?? [],
  }));
}

/**
 * Purge strings for arrays and sync stringIds on surviving arrays.
 *
 * @param {object[]} arrays
 * @param {ElectricalString[]} strings
 * @param {string[]} arrayIds
 */
export function purgeStringsAndSyncArrays(arrays, strings, arrayIds) {
  const nextStrings = purgeStringsForArrays(strings, arrayIds);
  const clearedArrays = (arrays ?? []).map((a) => (
    arrayIds.includes(a.id) ? { ...a, stringIds: [] } : a
  ));
  return {
    strings: nextStrings,
    arrays:  syncArrayStringIds(clearedArrays, nextStrings),
  };
}

/**
 * Rebuild a string with a new panel set using spatial ordering + derived endpoints.
 *
 * @param {ElectricalString} existingString
 * @param {string[]} panelIds
 * @param {object|null} panelLayout
 */
function rebuildStringSequence(existingString, panelIds, panelLayout) {
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
 * @param {ElectricalString[]} strings
 * @param {string} stringId
 * @param {string} displayName
 */
export function validateStringRename(strings, stringId, displayName) {
  const str = (strings ?? []).find((s) => s.id === stringId);
  if (!str) {
    return { ok: false, reason: "String could not be found." };
  }

  const trimmed = displayName?.trim();
  if (!trimmed) {
    return { ok: false, reason: "String name cannot be empty." };
  }

  const duplicate = (strings ?? []).some(
    (s) => s.arrayId === str.arrayId && s.id !== stringId && s.displayName === trimmed,
  );
  if (duplicate) {
    return {
      ok:     false,
      reason: "A string with this name already exists in the array.",
    };
  }

  return { ok: true, displayName: trimmed, string: str };
}

/**
 * @param {ElectricalString[]} strings
 * @param {string} stringId
 * @param {string} displayName
 */
export function renameElectricalString(strings, stringId, displayName) {
  const check = validateStringRename(strings, stringId, displayName);
  if (!check.ok) return check;

  return {
    ok: true,
    strings: (strings ?? []).map((s) => (
      s.id === stringId ? { ...s, displayName: check.displayName } : s
    )),
    stringId,
  };
}

/**
 * @param {object[]} arrays
 * @param {ElectricalString[]} strings
 * @param {string} stringId
 */
export function deleteElectricalString(arrays, strings, stringId) {
  const str = (strings ?? []).find((s) => s.id === stringId);
  if (!str) {
    return { ok: false, reason: "String could not be found." };
  }

  const nextStrings = (strings ?? []).filter((s) => s.id !== stringId);
  const nextArrays = syncArrayStringIds(arrays, nextStrings);

  return {
    ok:        true,
    strings:   nextStrings,
    arrays:    nextArrays,
    arrayId:   str.arrayId,
    stringId,
    deleted:   true,
  };
}

/**
 * @param {object[]} arrays
 * @param {ElectricalString[]} strings
 * @param {string} stringId
 * @param {string[]} panelIds
 */
export function validateAddPanelsToString(arrays, strings, stringId, panelIds) {
  const str = (strings ?? []).find((s) => s.id === stringId);
  if (!str) {
    return { ok: false, reason: "String could not be found." };
  }

  const array = (arrays ?? []).find((a) => a.id === str.arrayId);
  if (!array) {
    return { ok: false, reason: "Parent array could not be found." };
  }

  if (!panelIds?.length) {
    return { ok: false, reason: "Select at least one panel to add." };
  }

  const arraySet = new Set(array.panelIds);
  const normalizedSelection = [];
  const seen = new Set();

  for (const id of panelIds) {
    if (!arraySet.has(id)) {
      return {
        ok:     false,
        reason: "Selection includes panels outside the parent array.",
      };
    }
    if (!seen.has(id)) {
      seen.add(id);
      normalizedSelection.push(id);
    }
  }

  const assigned = assignedPanelIdsForArray(strings, str.arrayId);
  const alreadyAssigned = normalizedSelection.filter((id) => assigned.has(id));
  if (alreadyAssigned.length > 0) {
    return {
      ok:     false,
      reason: "One or more selected panels are already assigned to a string.",
    };
  }

  return { ok: true, string: str, array, normalizedSelection };
}

/**
 * @param {ElectricalString[]} strings
 * @param {ElectricalString|null} string
 * @param {string[]} panelIds
 */
export function selectedPanelsAreAddableToString(strings, string, panelIds) {
  if (!string || !panelIds?.length) return false;
  const assigned = assignedPanelIdsForArray(strings, string.arrayId);
  return panelIds.every((id) => !assigned.has(id));
}

/**
 * @param {object[]} arrays
 * @param {ElectricalString[]} strings
 * @param {string} stringId
 * @param {string[]} panelIds
 * @param {object|null} panelLayout
 */
export function addPanelsToString(arrays, strings, stringId, panelIds, panelLayout) {
  const check = validateAddPanelsToString(arrays, strings, stringId, panelIds);
  if (!check.ok) return check;

  const { string, normalizedSelection } = check;
  const combined = [...new Set([...(string.orderedPanelSequence ?? []), ...normalizedSelection])];
  const updated = rebuildStringSequence(string, combined, panelLayout);
  const nextStrings = (strings ?? []).map((s) => (s.id === stringId ? updated : s));

  return {
    ok:      true,
    strings: nextStrings,
    arrays,
    string:  updated,
    arrayId: string.arrayId,
    stringId,
    deleted: false,
  };
}

/**
 * @param {ElectricalString[]} strings
 * @param {string} stringId
 * @param {string[]} panelIds
 */
export function validateRemovePanelsFromString(strings, stringId, panelIds) {
  const str = (strings ?? []).find((s) => s.id === stringId);
  if (!str) {
    return { ok: false, reason: "String could not be found." };
  }

  if (!panelIds?.length) {
    return { ok: false, reason: "Select at least one panel to remove." };
  }

  const memberSet = new Set(str.orderedPanelSequence ?? []);
  const normalizedSelection = [];
  const seen = new Set();

  for (const id of panelIds) {
    if (!memberSet.has(id)) {
      return {
        ok:     false,
        reason: "Selection includes panels that are not in this string.",
      };
    }
    if (!seen.has(id)) {
      seen.add(id);
      normalizedSelection.push(id);
    }
  }

  return { ok: true, string: str, normalizedSelection };
}

/**
 * @param {ElectricalString|null} string
 * @param {string[]} panelIds
 */
export function selectedPanelsAreStringMembers(string, panelIds) {
  if (!string || !panelIds?.length) return false;
  const members = new Set(string.orderedPanelSequence ?? []);
  return panelIds.every((id) => members.has(id));
}

/**
 * @param {object[]} arrays
 * @param {ElectricalString[]} strings
 * @param {string} stringId
 * @param {string[]} panelIds
 * @param {object|null} panelLayout
 */
export function removePanelsFromString(arrays, strings, stringId, panelIds, panelLayout) {
  const check = validateRemovePanelsFromString(strings, stringId, panelIds);
  if (!check.ok) return check;

  const { string, normalizedSelection } = check;
  const removeSet = new Set(normalizedSelection);
  const remaining = (string.orderedPanelSequence ?? []).filter((id) => !removeSet.has(id));

  if (remaining.length === 0) {
    return deleteElectricalString(arrays, strings, stringId);
  }

  const updated = rebuildStringSequence(string, remaining, panelLayout);
  const nextStrings = (strings ?? []).map((s) => (s.id === stringId ? updated : s));

  return {
    ok:      true,
    strings: nextStrings,
    arrays,
    string:  updated,
    arrayId: string.arrayId,
    stringId,
    deleted: false,
  };
}
