/**
 * Step 8E consumption & coverage verification.
 * Run: npx vite-node scripts/consumptionCoverageVerify.mjs
 */
import { computeConsumptionResult } from "../src/features/consumption/computeConsumptionResult.js";
import { computeCoverageResult } from "../src/features/consumption/computeCoverageResult.js";
import { computeSavingsResult } from "../src/features/financials/computeSavingsResult.js";
import { DEFAULT_CONSUMPTION_INPUTS } from "../src/features/consumption/consumptionConfig.js";
import { DEFAULT_FINANCIAL_INPUTS } from "../src/features/financials/costConfig.js";

const tariff = 7;
const inputs = { ...DEFAULT_CONSUMPTION_INPUTS, monthlyBill: 18_000, inputMode: "bill" };

const consumption = computeConsumptionResult(inputs, tariff);
if (!consumption) {
  console.error("FAIL: consumptionResult null");
  process.exit(1);
}

const estUnits = 18_000 / 7;
if (Math.abs(consumption.averageMonthlyConsumption - estUnits) > 1) {
  console.error(`FAIL bill→units: ${consumption.averageMonthlyConsumption} vs ~${estUnits}`);
  process.exit(1);
}

if (consumption.monthlyConsumption.length !== 12) {
  console.error("FAIL: monthlyConsumption length");
  process.exit(1);
}

if (Math.abs(consumption.annualConsumption - consumption.averageMonthlyConsumption * 12) > 0.2) {
  console.error("FAIL: annual ≠ monthly × 12");
  process.exit(1);
}

const energyResult = {
  annualEnergy: 23_593,
  dailyEnergy: 64.6,
  monthlyEnergy: [1800, 1900, 2100, 2200, 2300, 2100, 1900, 1850, 2000, 2050, 1950, 1843],
};

const coverage = computeCoverageResult(energyResult, consumption);
if (!coverage) {
  console.error("FAIL: coverageResult null");
  process.exit(1);
}

for (let i = 0; i < 12; i++) {
  const prod = energyResult.monthlyEnergy[i];
  const cons = consumption.monthlyConsumption[i];
  const self = coverage.monthlySelfConsumption[i];
  const exp = coverage.monthlyExport[i];
  const imp = coverage.monthlyImport[i];

  if (Math.abs(self + exp - prod) > 0.2) {
    console.error(`FAIL month ${i}: self+export ≠ production`);
    process.exit(1);
  }
  if (Math.abs(self + imp - cons) > 0.2) {
    console.error(`FAIL month ${i}: self+import ≠ consumption`);
    process.exit(1);
  }
}

const annualProd = energyResult.monthlyEnergy.reduce((s, v) => s + v, 0);
const expectedCov = annualProd / consumption.annualConsumption;
if (Math.abs(coverage.annualCoverage - expectedCov) > 0.001) {
  console.error(`FAIL annualCoverage: ${coverage.annualCoverage} vs ${expectedCov}`);
  process.exit(1);
}

// Savings unchanged — spot-check 8B engine untouched
const savings = computeSavingsResult(energyResult, DEFAULT_FINANCIAL_INPUTS);
if (savings.annualSavings !== Math.round(23_593 * 7)) {
  console.error("FAIL: savings engine changed");
  process.exit(1);
}

console.log("Step 8E consumption & coverage: all checks passed.");
console.log(`₹18,000 @ ₹7/kWh → ${Math.round(consumption.averageMonthlyConsumption)} kWh/month`);
console.log(`Annual consumption: ${Math.round(consumption.annualConsumption).toLocaleString()} kWh`);
console.log(`Annual coverage: ${(coverage.annualCoverage * 100).toFixed(1)}%`);
console.log(`Savings annual (unchanged): ₹${savings.annualSavings.toLocaleString("en-IN")}`);
