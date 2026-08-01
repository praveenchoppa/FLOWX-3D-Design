/**
 * mpptUtilization.js — P5C MPPT utilization + soft warnings (pure, UI-independent).
 *
 * Uses existing P5A metrics (dcCapacityW) and catalog MPPT rated capacity only.
 * Does not compute voltage, current, or operating power.
 *
 * Developer note — catalog trustworthiness:
 * 100% utilization represents inverter rated capacity (mppt.capacity), snapshotted
 * from the development inverter catalog (mpptCapacityKw). Allowed Overload is
 * configurable tolerance above that rated baseline. Both rated capacity and
 * overload policy should be replaced by verified manufacturer or item-master
 * specifications before utilization is considered engineering guidance.
 */

import { roundMetric } from "../utils/seriesMath.js";
import {
  computeWarningLimitPercent,
  normalizeMpptAllowedOverload,
} from "../constants/mpptUtilizationConfig.js";

/**
 * @typedef {'healthy'|'warning'|'unknown'} MpptUtilizationStatus
 */

/**
 * @typedef {object} MpptUtilizationMetrics
 * @property {number|null} utilizationPercent
 * @property {MpptUtilizationStatus} status
 * @property {number} allowedOverloadPercent
 * @property {number} warningLimitPercent
 * @property {number|null} dcCapacityKw
 * @property {number|null} ratedCapacityKw
 */

/**
 * @typedef {object} MpptUtilizationWarning
 * @property {'soft'} level
 * @property {'MPPT_UTILIZATION_ABOVE_THRESHOLD'} code
 * @property {string} mpptId
 * @property {string} mpptDisplayName
 * @property {number} utilizationPercent
 * @property {number} allowedOverloadPercent
 * @property {number} warningLimitPercent
 * @property {number} dcCapacityKw
 * @property {number} ratedCapacityKw
 * @property {string} message
 */

/**
 * Utilization % = (MPPT DC Capacity kW ÷ MPPT Rated Capacity kW) × 100
 *
 * @param {number} dcCapacityW
 * @param {number|null} ratedCapacityKw
 * @returns {number|null}
 */
export function computeMpptUtilizationPercent(dcCapacityW, ratedCapacityKw) {
  if (ratedCapacityKw == null || ratedCapacityKw <= 0) return null;
  const dcCapacityKw = (dcCapacityW ?? 0) / 1000;
  return roundMetric((dcCapacityKw / ratedCapacityKw) * 100, 1);
}

/**
 * @param {number|null} utilizationPercent
 * @param {number} warningLimitPercent
 * @returns {MpptUtilizationStatus}
 */
export function mpptUtilizationStatus(utilizationPercent, warningLimitPercent) {
  if (utilizationPercent == null || Number.isNaN(utilizationPercent)) return "unknown";
  return utilizationPercent > warningLimitPercent ? "warning" : "healthy";
}

/**
 * Evaluate utilization and soft warnings for all MPPTs.
 *
 * @param {object} params
 * @param {import('./electricalCalculations.js').ElectricalMetricsResult} params.metrics
 * @param {object[]} params.mppts
 * @param {number} [params.allowedOverloadPercent]
 * @returns {{
 *   byMpptId: Record<string, MpptUtilizationMetrics>,
 *   warnings: MpptUtilizationWarning[],
 *   allowedOverloadPercent: number,
 *   warningLimitPercent: number,
 * }}
 */
export function evaluateMpptUtilization({ metrics, mppts, allowedOverloadPercent }) {
  const allowedOverload = normalizeMpptAllowedOverload(allowedOverloadPercent);
  const warningLimit = computeWarningLimitPercent(allowedOverload);
  const byMpptId = {};
  const warnings = [];

  for (const mppt of mppts ?? []) {
    const dcCapacityW = metrics?.byMpptId?.[mppt.id]?.dcCapacityW ?? 0;
    const ratedCapacityKw = mppt.capacity ?? null;
    const utilizationPercent = computeMpptUtilizationPercent(dcCapacityW, ratedCapacityKw);
    const status = mpptUtilizationStatus(utilizationPercent, warningLimit);
    const dcCapacityKw = roundMetric(dcCapacityW / 1000, 2);

    byMpptId[mppt.id] = {
      utilizationPercent,
      status,
      allowedOverloadPercent: allowedOverload,
      warningLimitPercent:    warningLimit,
      dcCapacityKw:           ratedCapacityKw != null ? dcCapacityKw : null,
      ratedCapacityKw,
    };

    if (status === "warning") {
      warnings.push({
        level:                  "soft",
        code:                   "MPPT_UTILIZATION_ABOVE_THRESHOLD",
        mpptId:                 mppt.id,
        mpptDisplayName:        mppt.displayName,
        utilizationPercent,
        allowedOverloadPercent: allowedOverload,
        warningLimitPercent:    warningLimit,
        dcCapacityKw,
        ratedCapacityKw,
        message:                `${mppt.displayName} utilization (${utilizationPercent}%) exceeds warning limit (${warningLimit}%).`,
      });
    }
  }

  return {
    byMpptId,
    warnings,
    allowedOverloadPercent: allowedOverload,
    warningLimitPercent:    warningLimit,
  };
}
