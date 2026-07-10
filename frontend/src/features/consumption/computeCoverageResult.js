/**
 * computeCoverageResult.js — Step 8E informational coverage analysis (pure).
 *
 * Reads energyResult + consumptionResult only. Does NOT feed savings/ROI/cashflow.
 */

function roundKwh(v) {
  return +v.toFixed(1);
}

/**
 * @param {object|null} energyResult
 * @param {object|null} consumptionResult
 * @returns {object|null}
 */
export function computeCoverageResult(energyResult, consumptionResult) {
  if (!energyResult?.monthlyEnergy?.length || !consumptionResult) return null;

  const production = energyResult.monthlyEnergy;
  const consumption = consumptionResult.monthlyConsumption;
  if (!consumption?.length || production.length !== 12 || consumption.length !== 12) {
    return null;
  }

  const monthlyCoverage = [];
  const monthlySelfConsumption = [];
  const monthlyImport = [];
  const monthlyExport = [];

  for (let i = 0; i < 12; i++) {
    const prod = production[i] ?? 0;
    const cons = consumption[i] ?? 0;
    const self = Math.min(prod, cons);
    const exp = Math.max(0, prod - cons);
    const imp = Math.max(0, cons - prod);
    const cov = cons > 0 ? prod / cons : prod > 0 ? 1 : 0;

    monthlySelfConsumption.push(roundKwh(self));
    monthlyExport.push(roundKwh(exp));
    monthlyImport.push(roundKwh(imp));
    monthlyCoverage.push(+cov.toFixed(4));
  }

  const annualProduction = production.reduce((s, v) => s + v, 0);
  const annualConsumption = consumptionResult.annualConsumption;
  const annualCoverage =
    annualConsumption > 0 ? annualProduction / annualConsumption : 0;

  const annualSelfConsumption = roundKwh(
    monthlySelfConsumption.reduce((s, v) => s + v, 0),
  );
  const annualImport = roundKwh(monthlyImport.reduce((s, v) => s + v, 0));
  const annualExport = roundKwh(monthlyExport.reduce((s, v) => s + v, 0));

  return {
    coverageSource:        "estimated",
    monthlyCoverage,
    annualCoverage:        +annualCoverage.toFixed(4),
    monthlySelfConsumption,
    monthlyImport,
    monthlyExport,
    annualSelfConsumption,
    annualImport,
    annualExport,
  };
}
