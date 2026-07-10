/**
 * panelCapacitySelection.js — Step 6 target-capacity slot selection (pure).
 *
 * Filters already-generated valid slots. Does NOT modify slot finding.
 */

import { ZONE_ORDER } from "../zones/zoneClassification.js";

const ZONE_PRIORITY = Object.fromEntries(ZONE_ORDER.map((z, i) => [z, i]));

/**
 * Pick panel count closest to target kWp; tie-break toward fewer panels (less oversizing).
 *
 * @param {number} maxSlots
 * @param {number} targetCapacityKw
 * @param {number} panelKw
 * @returns {number}
 */
export function pickOptimalPanelCount(maxSlots, targetCapacityKw, panelKw) {
  if (!maxSlots || !panelKw || panelKw <= 0 || targetCapacityKw <= 0) return 0;

  let bestN = 0;
  let bestDiff = Infinity;

  for (let n = 0; n <= maxSlots; n++) {
    const kw = n * panelKw;
    const diff = Math.abs(kw - targetCapacityKw);
    if (diff < bestDiff - 1e-9) {
      bestDiff = diff;
      bestN = n;
    } else if (Math.abs(diff - bestDiff) < 1e-9 && n < bestN) {
      bestN = n;
    }
  }

  return bestN;
}

/**
 * Sort valid slots: Excellent → Good → …, then region order, then professional
 * preference (active before defaultRemoved), then row, col.
 *
 * @param {object[]} allValidSlots
 * @param {object|null} placementReady
 * @param {string[]} [defaultRemoved]
 * @returns {object[]}
 */
export function sortSlotsByZonePriority(allValidSlots, placementReady, defaultRemoved = []) {
  const regionClass = new Map();
  const regionOrder = new Map();
  const removedSet = new Set(defaultRemoved);

  for (const [i, region] of (placementReady?.installableRegions ?? []).entries()) {
    regionClass.set(region.id, region.zoneClass ?? "good");
    regionOrder.set(region.id, i);
  }

  const priority = (cls) => ZONE_PRIORITY[cls] ?? ZONE_PRIORITY.average;

  return [...allValidSlots].sort((a, b) => {
    const pa = priority(regionClass.get(a.regionId));
    const pb = priority(regionClass.get(b.regionId));
    if (pa !== pb) return pa - pb;

    const ra = regionOrder.get(a.regionId) ?? 0;
    const rb = regionOrder.get(b.regionId) ?? 0;
    if (ra !== rb) return ra - rb;

    const aRemoved = removedSet.has(a.slotId) ? 1 : 0;
    const bRemoved = removedSet.has(b.slotId) ? 1 : 0;
    if (aRemoved !== bRemoved) return aRemoved - bRemoved;

    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
}

/**
 * Build panelOverrides for target-capacity placement.
 *
 * @param {object[]} allValidSlots
 * @param {object|null} placementReady
 * @param {object} selectedPanel
 * @param {number} targetCapacityKw
 * @returns {{ overrides: { removed: string[], added: string[] }, meta: object }}
 */
export function buildTargetCapacityOverrides(
  allValidSlots,
  placementReady,
  selectedPanel,
  targetCapacityKw,
  defaultRemoved = [],
) {
  const panelKw = (selectedPanel?.power ?? 0) / 1000;
  const sorted = sortSlotsByZonePriority(allValidSlots, placementReady, defaultRemoved);
  const panelCount = pickOptimalPanelCount(sorted.length, targetCapacityKw, panelKw);
  const selectedIds = new Set(sorted.slice(0, panelCount).map((s) => s.slotId));
  const defaultRemovedSet = new Set(defaultRemoved);

  const removed = allValidSlots
    .filter((s) => !selectedIds.has(s.slotId))
    .map((s) => s.slotId);

  const added = allValidSlots
    .filter((s) => selectedIds.has(s.slotId) && defaultRemovedSet.has(s.slotId))
    .map((s) => s.slotId);

  const placedCapacityKw = +(panelCount * panelKw).toFixed(2);
  const maxRoofCapacityKw = +(sorted.length * panelKw).toFixed(2);

  return {
    overrides: { removed, added },
    meta: {
      targetCapacityKw,
      placedCapacityKw,
      panelCount,
      maxPanelCount: sorted.length,
      maxRoofCapacityKw,
      shortfallKw: Math.max(0, +(targetCapacityKw - maxRoofCapacityKw).toFixed(2)),
      roofLimited: targetCapacityKw > maxRoofCapacityKw + 1e-6,
    },
  };
}

/**
 * Fill-roof overrides — activate every valid slot (including professional defaultRemoved).
 *
 * @param {object[]} [allValidSlots]
 * @param {string[]} [defaultRemoved]
 */
export function buildFillRoofOverrides(allValidSlots = [], defaultRemoved = []) {
  const removedSet = new Set(defaultRemoved);
  return {
    removed: [],
    added:   allValidSlots.filter((s) => removedSet.has(s.slotId)).map((s) => s.slotId),
  };
}
