/**
 * computeSavingsResult.js — Step 8B pure savings engine.
 *
 * Reads energyResult (energy only) + financialInputs (tariff params).
 * Never modifies energyResult. costResult is not used in savings math (8C+ may combine).
 */

import { SAVINGS_PROJECTION_YEARS } from "./costConfig";

function roundInr(v) {
  return Math.round(v);
}

/**
 * @param {object|null} energyResult
 * @param {object|null} financialInputs
 * @returns {object|null}
 */
export function computeSavingsResult(energyResult, financialInputs) {
  if (!energyResult || !financialInputs) return null;

  const { annualEnergy, monthlyEnergy, dailyEnergy } = energyResult;
  if (annualEnergy == null || !monthlyEnergy?.length) return null;

  const tariffPerUnit = Number(financialInputs.tariffPerUnit);
  const tariffEscalation = Number(financialInputs.tariffEscalation);
  const panelDegradation = Number(financialInputs.panelDegradation);

  if (!Number.isFinite(tariffPerUnit) || tariffPerUnit < 0) return null;
  if (!Number.isFinite(tariffEscalation) || tariffEscalation < 0) return null;
  if (!Number.isFinite(panelDegradation) || panelDegradation < 0) return null;

  const dailySavings = roundInr(dailyEnergy * tariffPerUnit);

  const monthlySavings = monthlyEnergy.map((kwh) =>
    roundInr(kwh * tariffPerUnit),
  );

  const annualSavings = roundInr(annualEnergy * tariffPerUnit);

  const yearlySavings = [];
  for (let year = 1; year <= SAVINGS_PROJECTION_YEARS; year++) {
    const yearEnergy = annualEnergy * Math.pow(1 - panelDegradation, year - 1);
    const yearTariff = tariffPerUnit * Math.pow(1 + tariffEscalation, year - 1);
    yearlySavings.push(roundInr(yearEnergy * yearTariff));
  }

  const lifetimeSavings = yearlySavings.reduce((sum, v) => sum + v, 0);

  return {
    dailySavings,
    monthlySavings,
    annualSavings,
    lifetimeSavings,
    yearlySavings,
    tariffPerUnit,
    tariffEscalation,
    panelDegradation,
  };
}
