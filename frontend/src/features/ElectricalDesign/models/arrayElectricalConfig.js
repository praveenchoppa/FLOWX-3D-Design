/**
 * arrayElectricalConfig.js — helpers for array electrical configuration state.
 */

import { purgeStringsAndSyncArrays } from "./string.js";
import { syncMpptsAfterStringRemoval } from "./stringAssignment.js";

/**
 * @param {object} array
 * @param {object[]} strings
 * @param {object[]} [mppts]
 */
export function arrayHasElectricalConfig(array, strings, mppts = []) {
  if (!array) return false;

  if ((array.stringIds?.length ?? 0) > 0) return true;

  const arrayStrings = (strings ?? []).filter((s) => s.arrayId === array.id);
  if (arrayStrings.some((s) => s.mpptId)) return true;

  for (const mppt of mppts ?? []) {
    for (const stringId of mppt.stringIds ?? []) {
      const str = arrayStrings.find((s) => s.id === stringId);
      if (str) return true;
    }
  }

  return false;
}

export const ROTATE_CONFIGURED_CONFIRM_MESSAGE =
  "This array already contains electrical configuration. Rotating it will remove strings, MPPT assignments, wiring, and cable lengths. Continue?";

export const UNFREEZE_CONFIGURED_CONFIRM_MESSAGE =
  "Unfreezing will clear strings, MPPT assignments, wiring, and cable lengths for this array. Continue?";

/**
 * @param {object[]} arrays
 * @param {object[]} strings
 * @param {string} arrayId
 * @param {object[]} mppts
 */
export function purgeArrayElectricalConfig(arrays, strings, arrayId, mppts) {
  const purged = purgeStringsAndSyncArrays(arrays, strings, [arrayId]);
  const nextMppts = syncMpptsAfterStringRemoval(purged.strings, mppts);
  return { ...purged, mppts: nextMppts };
}
