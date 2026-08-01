/**
 * seriesMath.js — P5A series-connection electrical math (pure).
 *
 * Series: voltage adds, current limited by weakest panel (min Imp).
 */

/**
 * Sum panel Vmp values in a series string.
 *
 * @param {number[]} vmpValues
 * @returns {number|null}
 */
export function sumSeriesVoltage(vmpValues) {
  const values = (vmpValues ?? []).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * Series string current — weakest-panel bottleneck (min Imp).
 *
 * @param {number[]} impValues
 * @returns {number|null}
 */
export function seriesCurrent(impValues) {
  const values = (impValues ?? []).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!values.length) return null;
  return Math.min(...values);
}

/**
 * Operating power from V × I (watts).
 *
 * @param {number|null} voltageV
 * @param {number|null} currentA
 * @returns {number|null}
 */
export function operatingPowerW(voltageV, currentA) {
  if (voltageV == null || currentA == null) return null;
  return voltageV * currentA;
}

/**
 * Installed DC capacity — sum of nameplate panel wattages.
 *
 * @param {number[]} powerWValues
 * @returns {number}
 */
export function sumInstalledDcCapacityW(powerWValues) {
  return (powerWValues ?? []).reduce(
    (sum, w) => sum + (typeof w === "number" && !Number.isNaN(w) ? w : 0),
    0,
  );
}

/**
 * Parallel MPPT operating voltage (MVP assumption).
 *
 * Parallel strings share a common bus voltage. When assigned strings differ,
 * use the minimum string operating voltage (conservative common voltage).
 *
 * @param {number[]} stringVoltagesV
 * @returns {number|null}
 */
export function parallelMpptVoltage(stringVoltagesV) {
  const values = (stringVoltagesV ?? []).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!values.length) return null;
  return Math.min(...values);
}

/**
 * Sum parallel branch currents or powers.
 *
 * @param {number[]} values
 * @returns {number|null}
 */
export function sumParallelValues(values) {
  const nums = (values ?? []).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((sum, v) => sum + v, 0);
}

/**
 * DC/AC ratio from kW values.
 *
 * @param {number} totalDcCapacityKw
 * @param {number|null} acRatingKw
 * @returns {number|null}
 */
export function dcAcRatio(totalDcCapacityKw, acRatingKw) {
  if (acRatingKw == null || acRatingKw <= 0) return null;
  if (totalDcCapacityKw == null || totalDcCapacityKw < 0) return null;
  return totalDcCapacityKw / acRatingKw;
}

/**
 * Round for display/storage in metrics (avoid float noise).
 *
 * @param {number|null} value
 * @param {number} [decimals=2]
 */
export function roundMetric(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
