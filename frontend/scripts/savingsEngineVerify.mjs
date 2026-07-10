/**
 * Step 8B savings engine verification.
 * Run: npx vite-node scripts/savingsEngineVerify.mjs
 */
import { computeSavingsResult } from "../src/features/financials/computeSavingsResult.js";
import { DEFAULT_FINANCIAL_INPUTS } from "../src/features/financials/costConfig.js";

const energyResult = {
  annualEnergy: 23_593,
  dailyEnergy: 64.6,
  monthlyEnergy: [1800, 1900, 2100, 2200, 2300, 2100, 1900, 1850, 2000, 2050, 1950, 1843],
};

const savings = computeSavingsResult(energyResult, DEFAULT_FINANCIAL_INPUTS);

if (!savings) {
  console.error("FAIL: savingsResult is null");
  process.exit(1);
}

const year1Expected = Math.round(23_593 * 7);
if (savings.annualSavings !== year1Expected) {
  console.error(`FAIL year1 annual: ${savings.annualSavings} vs ${year1Expected}`);
  process.exit(1);
}

if (savings.yearlySavings.length !== 25) {
  console.error(`FAIL: expected 25 years, got ${savings.yearlySavings.length}`);
  process.exit(1);
}

const sum = savings.yearlySavings.reduce((s, v) => s + v, 0);
if (sum !== savings.lifetimeSavings) {
  console.error(`FAIL lifetime sum: ${sum} vs ${savings.lifetimeSavings}`);
  process.exit(1);
}

const naive25 = savings.annualSavings * 25;
if (Math.abs(savings.lifetimeSavings - naive25) < 1000) {
  console.error("FAIL: lifetime too close to annual×25 — escalation/degradation not applied");
  process.exit(1);
}

console.log("Step 8B savings engine: all checks passed.");
console.log(`Year 1 annual savings: ₹${savings.annualSavings.toLocaleString("en-IN")}`);
console.log(`Lifetime (25 yr):      ₹${savings.lifetimeSavings.toLocaleString("en-IN")}`);
console.log(`Year 25 savings:     ₹${savings.yearlySavings[24].toLocaleString("en-IN")}`);
