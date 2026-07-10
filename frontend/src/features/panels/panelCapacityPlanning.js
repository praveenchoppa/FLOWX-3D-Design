/**
 * panelCapacityPlanning.js — Step 6 capacity planning layer (pure).
 *
 * Converts consultant inputs → targetCapacityKw. Never touches slot generation.
 */

import { computePerformanceRatio } from "../energy/energyLossConfig.js";

export const PLACEMENT_MODES = {
  FILL_ROOF:       "fillRoof",
  TARGET_CAPACITY: "targetCapacity",
};

export const CAPACITY_INPUT_MODES = {
  KW:         "kw",
  BILL:       "bill",
  ANNUAL_KWH: "annualKwh",
};

/** Fallback when solar resource is not yet loaded (kWh/kWp/year). */
export const FALLBACK_SPECIFIC_YIELD_KWP = 1400;

export const DEFAULT_PLACEMENT_PLANNING = {
  placementMode:      PLACEMENT_MODES.FILL_ROOF,
  capacityInputMode:  CAPACITY_INPUT_MODES.KW,
  targetCapacityKw:   10,
  monthlyBill:        18_000,
  annualConsumptionKwh: 25_000,
};

/**
 * Location-specific yield from NASA resource only — NOT from placement result.
 *
 * @param {object|null} solarResource  Step 7A record
 * @returns {number} kWh/kWp/year
 */
export function computeLocationSpecificYield(solarResource) {
  const peakSunHours = solarResource?.peakSunHours;
  if (peakSunHours == null || Number.isNaN(peakSunHours)) {
    return FALLBACK_SPECIFIC_YIELD_KWP;
  }
  const pr = computePerformanceRatio();
  return +(peakSunHours * 365 * pr).toFixed(1);
}

/**
 * Resolve canonical target capacity (kWp) from planning inputs.
 *
 * @param {object} planning
 * @param {object} context
 * @param {number} [context.tariffPerUnit]         ₹/kWh for bill conversion
 * @param {number} [context.specificYieldKwhPerKwp] kWh/kWp/year
 * @returns {number|null}
 */
export function resolveTargetCapacityKw(
  planning,
  { tariffPerUnit = 7, specificYieldKwhPerKwp = FALLBACK_SPECIFIC_YIELD_KWP } = {},
) {
  if (planning?.placementMode !== PLACEMENT_MODES.TARGET_CAPACITY) return null;
  if (!specificYieldKwhPerKwp || specificYieldKwhPerKwp <= 0) return null;

  let annualKwh = null;

  switch (planning.capacityInputMode) {
    case CAPACITY_INPUT_MODES.KW: {
      const kw = Number(planning.targetCapacityKw);
      return Number.isFinite(kw) && kw > 0 ? +kw.toFixed(2) : null;
    }
    case CAPACITY_INPUT_MODES.BILL: {
      const bill = Number(planning.monthlyBill);
      const tariff = Number(tariffPerUnit);
      if (!Number.isFinite(bill) || bill <= 0 || !Number.isFinite(tariff) || tariff <= 0) {
        return null;
      }
      annualKwh = (bill * 12) / tariff;
      break;
    }
    case CAPACITY_INPUT_MODES.ANNUAL_KWH: {
      const kwh = Number(planning.annualConsumptionKwh);
      if (!Number.isFinite(kwh) || kwh <= 0) return null;
      annualKwh = kwh;
      break;
    }
    default:
      return null;
  }

  if (annualKwh == null) return null;
  return +(annualKwh / specificYieldKwhPerKwp).toFixed(2);
}

/**
 * Live placement summary for Target Capacity mode (display only).
 */
export function computePlacementLiveSummary({
  placementPlanning,
  resolvedTargetCapacityKw,
  panelLayout,
  selectedPanel,
  maxRoofCapacityKw,
  maxPanelCount,
}) {
  const panelKw = (selectedPanel?.power ?? 0) / 1000;
  const placedCount = panelLayout?.placedPanels?.length ?? 0;
  const placedCapacityKw = +(placedCount * panelKw).toFixed(2);
  const requested = resolvedTargetCapacityKw ?? 0;
  const remaining = Math.max(0, +(requested - placedCapacityKw).toFixed(2));
  const shortfallKw = Math.max(0, +(requested - maxRoofCapacityKw).toFixed(2));
  const roofLimited = requested > maxRoofCapacityKw + 1e-6;

  return {
    requestedCapacityKw:    requested,
    placedCapacityKw,
    remainingCapacityKw:    remaining,
    panelsPlaced:           placedCount,
    maxRoofCapacityKw,
    maxPanelCount,
    roofLimited,
    shortfallKw,
  };
}
