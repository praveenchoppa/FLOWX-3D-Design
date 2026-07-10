/**
 * computeCostResult.js — Step 8A pure cost engine (no savings / ROI).
 *
 * grossCost = systemKw × 1000 × costPerWatt
 * subsidy   = PM Surya Ghar slabs (toggleable) or manual override
 * netCost   = grossCost − subsidyAmount
 */

import {
  PM_SURYA_GHAR_RESIDENTIAL,
  SUBSIDY_SCHEMES,
} from "./costConfig";

function roundInr(v) {
  return Math.round(v);
}

/**
 * PM Surya Ghar residential subsidy — first 2 kW @ rateFirst2Kw, 3rd kW @ rateThirdKw, capped.
 *
 * @param {number} systemKw
 * @param {object} scheme
 * @returns {number}
 */
export function computePmSuryaGharSubsidy(systemKw, scheme = PM_SURYA_GHAR_RESIDENTIAL) {
  if (systemKw <= 0) return 0;

  const tier1Kw = Math.min(systemKw, 2);
  const tier2Kw = systemKw > 2 ? Math.min(systemKw - 2, 1) : 0;

  const raw =
    tier1Kw * scheme.rateFirst2Kw +
    tier2Kw * scheme.rateThirdKw;

  return Math.min(raw, scheme.capTotal);
}

/**
 * @param {object} financialInputs
 * @param {number} systemKw  installed kWp (from energyResult / arrays)
 * @returns {object|null}
 */
export function computeCostResult(financialInputs, systemKw) {
  if (!financialInputs || systemKw == null || systemKw <= 0) {
    return systemKw > 0
      ? {
          systemKw:      +systemKw.toFixed(2),
          grossCost:     0,
          subsidyAmount: 0,
          netCost:       0,
        }
      : null;
  }

  const costPerWatt = Number(financialInputs.costPerWatt);
  if (!Number.isFinite(costPerWatt) || costPerWatt < 0) return null;

  const grossCost = roundInr(systemKw * 1000 * costPerWatt);

  let subsidyAmount = 0;

  const override = financialInputs.manualSubsidyOverride;
  if (override != null && override !== "" && Number.isFinite(Number(override))) {
    subsidyAmount = roundInr(Math.max(0, Number(override)));
  } else if (financialInputs.subsidyEnabled) {
    const scheme =
      SUBSIDY_SCHEMES[financialInputs.subsidyScheme] ?? PM_SURYA_GHAR_RESIDENTIAL;
    subsidyAmount = roundInr(computePmSuryaGharSubsidy(systemKw, scheme));
  }

  subsidyAmount = Math.min(subsidyAmount, grossCost);
  const netCost = roundInr(grossCost - subsidyAmount);

  return {
    systemKw:      +systemKw.toFixed(2),
    grossCost,
    subsidyAmount,
    netCost,
  };
}
