/**
 * panelSelectionUtils.js — Pure helpers for electrical panel selection (P2b).
 */

/**
 * Resolve stable panel key (slotId preferred).
 *
 * @param {object} panel
 */
export function panelSlotKey(panel) {
  return panel?.slotId ?? panel?.id ?? null;
}

/**
 * Whether a panel slot belongs to an array's panelIds list.
 *
 * @param {string} slotId
 * @param {object|null} array
 */
export function isPanelInArray(slotId, array) {
  if (!slotId || !array?.panelIds?.length) return false;
  return array.panelIds.includes(slotId);
}

/**
 * Keep only IDs that still exist on the active array.
 *
 * @param {string[]} selectedElectricalPanelIds
 * @param {object|null} activeArray
 */
export function filterValidPanelIds(selectedElectricalPanelIds, activeArray) {
  if (!activeArray?.panelIds?.length) return [];
  const allowed = new Set(activeArray.panelIds);
  return (selectedElectricalPanelIds ?? []).filter((id) => allowed.has(id));
}

/**
 * Resolve placed panel records from slot IDs (read-only layout).
 *
 * @param {object|null} panelLayout
 * @param {string[]} slotIds
 */
export function resolvePanelsBySlotIds(panelLayout, slotIds = []) {
  const placed = panelLayout?.placedPanels ?? [];
  const idSet = new Set(slotIds);
  return placed.filter((p) => idSet.has(panelSlotKey(p)));
}

/**
 * Whether panel picking is allowed (single active array context).
 *
 * @param {string|null} activeArrayId
 * @param {string[]} selectedArrayIds
 */
export function canPickPanelsInActiveArray(activeArrayId, selectedArrayIds) {
  return !!activeArrayId
    && selectedArrayIds.length === 1
    && selectedArrayIds[0] === activeArrayId;
}
