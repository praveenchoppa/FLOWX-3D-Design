/**
 * computeRoiResult.js — Step 8C pure ROI & payback engine.
 *
 * Reads costResult + savingsResult only. Never recomputes cost, energy, or savings.
 */

function round2(v) {
  return +v.toFixed(2);
}

function roundPct(v) {
  return +v.toFixed(1);
}

/**
 * @param {object|null} costResult
 * @param {object|null} savingsResult
 * @returns {object|null}
 */
export function computeRoiResult(costResult, savingsResult) {
  if (!costResult || !savingsResult) return null;

  const netCost = costResult.netCost;
  const { lifetimeSavings, yearlySavings } = savingsResult;

  if (netCost == null || !Number.isFinite(netCost) || netCost <= 0) return null;
  if (!yearlySavings?.length || lifetimeSavings == null) return null;

  const projectionYears = yearlySavings.length;

  let cumulative = 0;
  const cumulativeSavings = [];
  let paybackYears = null;
  let breakEvenYear = null;

  for (let i = 0; i < yearlySavings.length; i++) {
    const prev = cumulative;
    cumulative += yearlySavings[i];
    const year = i + 1;

    cumulativeSavings.push({ year, value: cumulative });

    if (cumulative >= netCost) {
      if (breakEvenYear == null) breakEvenYear = year;

      if (paybackYears == null) {
        const yearSaving = yearlySavings[i];
        const fraction = yearSaving > 0 ? (netCost - prev) / yearSaving : 0;
        paybackYears = round2(i + fraction);
      }
    }
  }

  const netLifetimeProfit = lifetimeSavings - netCost;
  const roiPercent = roundPct((netLifetimeProfit / netCost) * 100);
  const avgAnnualRoi = roundPct(roiPercent / projectionYears);

  return {
    paybackYears,
    breakEvenYear,
    roiPercent,
    netLifetimeProfit,
    avgAnnualRoi,
    cumulativeSavings,
  };
}
