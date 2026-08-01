/**
 * mpptUtilizationConfig.js — P5C allowed overload defaults (user-configurable).
 *
 * 100% utilization represents inverter rated capacity (mppt.capacity).
 * Allowed Overload is the additional tolerance above rated capacity that the
 * user permits before a soft warning — stored separately from utilization so
 * future ML or policy engines can adjust tolerance without changing the formula.
 *
 * Rated capacity still originates from the development inverter catalog and
 * should later be replaced by verified item-master values.
 */

export const DEFAULT_MPPT_ALLOWED_OVERLOAD_PERCENT = 20;

export const MPPT_ALLOWED_OVERLOAD_MIN_PERCENT = 0;

export const MPPT_ALLOWED_OVERLOAD_MAX_PERCENT = 30;

export const MPPT_ALLOWED_OVERLOAD_STEP_PERCENT = 5;

/** Rated-capacity baseline for utilization (100% = rated). */
export const MPPT_RATED_UTILIZATION_BASELINE_PERCENT = 100;

/**
 * Derived warning limit — not stored.
 *
 * @param {number} allowedOverloadPercent
 */
export function computeWarningLimitPercent(allowedOverloadPercent) {
  return MPPT_RATED_UTILIZATION_BASELINE_PERCENT
    + normalizeMpptAllowedOverload(allowedOverloadPercent);
}

/**
 * Clamp and snap allowed overload to slider range.
 *
 * @param {number} value
 */
export function normalizeMpptAllowedOverload(value) {
  const min = MPPT_ALLOWED_OVERLOAD_MIN_PERCENT;
  const max = MPPT_ALLOWED_OVERLOAD_MAX_PERCENT;
  const step = MPPT_ALLOWED_OVERLOAD_STEP_PERCENT;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return DEFAULT_MPPT_ALLOWED_OVERLOAD_PERCENT;
  const clamped = Math.min(max, Math.max(min, numeric));
  const steps = Math.round((clamped - min) / step);
  return min + steps * step;
}
