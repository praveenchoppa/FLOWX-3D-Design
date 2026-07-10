/**
 * computeConsumptionResult.js — Step 8E pure consumption derivation.
 *
 * Uses financialInputs.tariffPerUnit as the only tariff source (never duplicated).
 */

function roundKwh(v) {
  return +v.toFixed(1);
}

/**
 * @param {object|null} consumptionInputs
 * @param {number}      tariffPerUnit  from financialInputs
 * @returns {object|null}
 */
export function computeConsumptionResult(consumptionInputs, tariffPerUnit) {
  if (!consumptionInputs) return null;
  if (!Number.isFinite(tariffPerUnit) || tariffPerUnit <= 0) return null;

  let averageMonthlyConsumption;

  if (consumptionInputs.inputMode === "units") {
    const units = Number(consumptionInputs.averageMonthlyUnits);
    if (!Number.isFinite(units) || units <= 0) return null;
    averageMonthlyConsumption = units;
  } else {
    const bill = Number(consumptionInputs.monthlyBill);
    if (!Number.isFinite(bill) || bill <= 0) return null;
    averageMonthlyConsumption = bill / tariffPerUnit;
  }

  const profile = consumptionInputs.monthlyProfile;
  const monthlyConsumption =
    Array.isArray(profile) && profile.length === 12
      ? profile.map((v) => roundKwh(Number(v) || 0))
      : Array.from({ length: 12 }, () => roundKwh(averageMonthlyConsumption));

  const annualConsumption = roundKwh(
    monthlyConsumption.reduce((sum, v) => sum + v, 0),
  );

  return {
    averageMonthlyConsumption: roundKwh(averageMonthlyConsumption),
    annualConsumption,
    monthlyConsumption,
    source: consumptionInputs.source ?? "manual",
  };
}
