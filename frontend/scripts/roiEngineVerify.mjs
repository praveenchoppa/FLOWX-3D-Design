/**
 * Step 8C ROI engine verification.
 * Run: npx vite-node scripts/roiEngineVerify.mjs
 */
import { computeCostResult } from "../src/features/financials/computeCostResult.js";
import { computeSavingsResult } from "../src/features/financials/computeSavingsResult.js";
import { computeRoiResult } from "../src/features/financials/computeRoiResult.js";
import { DEFAULT_FINANCIAL_INPUTS } from "../src/features/financials/costConfig.js";

const energyResult = {
  annualEnergy: 23_593,
  dailyEnergy: 64.6,
  monthlyEnergy: [1800, 1900, 2100, 2200, 2300, 2100, 1900, 1850, 2000, 2050, 1950, 1843],
};

const costResult = computeCostResult(DEFAULT_FINANCIAL_INPUTS, 14.3);
const savingsResult = computeSavingsResult(energyResult, DEFAULT_FINANCIAL_INPUTS);
const roi = computeRoiResult(costResult, savingsResult);

if (!roi) {
  console.error("FAIL: roiResult is null");
  process.exit(1);
}

const expectedRoi = ((savingsResult.lifetimeSavings - costResult.netCost) / costResult.netCost) * 100;
if (Math.abs(roi.roiPercent - expectedRoi) > 0.05) {
  console.error(`FAIL roiPercent: ${roi.roiPercent} vs ${expectedRoi}`);
  process.exit(1);
}

if (roi.netLifetimeProfit !== savingsResult.lifetimeSavings - costResult.netCost) {
  console.error("FAIL netLifetimeProfit");
  process.exit(1);
}

const lastCum = roi.cumulativeSavings[roi.cumulativeSavings.length - 1].value;
if (lastCum !== savingsResult.lifetimeSavings) {
  console.error(`FAIL cumulative last: ${lastCum} vs ${savingsResult.lifetimeSavings}`);
  process.exit(1);
}

for (let i = 1; i < roi.cumulativeSavings.length; i++) {
  if (roi.cumulativeSavings[i].value < roi.cumulativeSavings[i - 1].value) {
    console.error("FAIL: cumulative not monotonic");
    process.exit(1);
  }
}

if (roi.breakEvenYear != null && roi.paybackYears != null) {
  if (roi.breakEvenYear !== Math.ceil(roi.paybackYears)) {
    console.error(`FAIL breakEven vs payback: ${roi.breakEvenYear} vs ceil(${roi.paybackYears})`);
    process.exit(1);
  }
}

if (roi.paybackYears == null || roi.paybackYears < 3 || roi.paybackYears > 5) {
  console.error(`FAIL payback range: ${roi.paybackYears} (expected ~3–5 years)`);
  process.exit(1);
}

console.log("Step 8C ROI engine: all checks passed.");
console.log(`Net cost:           ₹${costResult.netCost.toLocaleString("en-IN")}`);
console.log(`Payback:            ${roi.paybackYears} years`);
console.log(`Break-even year:    ${roi.breakEvenYear}`);
console.log(`ROI (25 yr):        ${roi.roiPercent}%`);
console.log(`Net lifetime profit: ₹${roi.netLifetimeProfit.toLocaleString("en-IN")}`);
