/**
 * stringDisplayUtils.js — Presentation-only labels for strings (no model changes).
 */

/** Human-readable label for a panel position in a string sequence (1-based). */
export function panelSequenceLabel(index) {
  return `Panel ${index + 1}`;
}

/** Labels for every panel in a string sequence. */
export function panelSequenceLabels(orderedPanelSequence = []) {
  return orderedPanelSequence.map((_, i) => panelSequenceLabel(i));
}

/** Assigned panel count for an array given its strings. */
export function assignedPanelCount(array, strings) {
  const total = array?.panelIds?.length ?? 0;
  const unassigned = getUnassignedCount(array, strings);
  return total - unassigned;
}

/** Unassigned panel count (uses string model read-only). */
export function getUnassignedCount(array, strings) {
  if (!array) return 0;
  const assigned = new Set();
  for (const str of strings ?? []) {
    if (str.arrayId !== array.id) continue;
    for (const pid of str.orderedPanelSequence ?? []) assigned.add(pid);
  }
  return (array.panelIds ?? []).filter((id) => !assigned.has(id)).length;
}

/** Strings belonging to one array, ordered by array.stringIds when available. */
export function stringsInArray(strings, arrayOrId) {
  const arrayId = typeof arrayOrId === "string" ? arrayOrId : arrayOrId?.id;
  const inArray = (strings ?? []).filter((s) => s.arrayId === arrayId);
  const order = typeof arrayOrId === "object" ? arrayOrId?.stringIds : null;
  if (!order?.length) return inArray;

  const byId = new Map(inArray.map((s) => [s.id, s]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean);
  const remainder = inArray.filter((s) => !order.includes(s.id));
  return [...ordered, ...remainder];
}
