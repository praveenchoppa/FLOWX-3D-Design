/**
 * electricalFormatUtils.js — Display formatting for P5A calculated values.
 */

/** @param {number|null|undefined} value */
export function formatVoltage(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value} V`;
}

/** @param {number|null|undefined} value */
export function formatCurrent(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value} A`;
}

/** @param {number|null|undefined} watts */
export function formatOperatingPower(watts) {
  if (watts == null || Number.isNaN(watts)) return "—";
  if (watts >= 1000) return `${(watts / 1000).toFixed(2)} kW`;
  return `${Math.round(watts)} W`;
}

/** @param {number|null|undefined} watts */
export function formatDcCapacity(watts) {
  if (watts == null || Number.isNaN(watts) || watts === 0) return "0 W";
  if (watts >= 1000) return `${(watts / 1000).toFixed(2)} kW`;
  return `${Math.round(watts)} W`;
}

/** @param {number|null|undefined} kw */
export function formatDcCapacityKw(kw) {
  if (kw == null || Number.isNaN(kw)) return "—";
  return `${kw} kW`;
}

/** @param {number|null|undefined} ratio */
export function formatDcAcRatio(ratio) {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  return ratio.toFixed(2);
}

/** @param {number|null|undefined} percent */
export function formatUtilizationPercent(percent) {
  if (percent == null || Number.isNaN(percent)) return "—";
  return `${percent}%`;
}

/** @param {number|null|undefined} lengthM */
export function formatEstimatedLengthM(lengthM) {
  if (lengthM == null || Number.isNaN(lengthM)) return "—";
  return `${lengthM} m`;
}
