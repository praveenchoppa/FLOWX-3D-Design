/**
 * Step 8A subsidy slab verification.
 * Run: npx vite-node scripts/costEngineVerify.mjs
 */
import { computePmSuryaGharSubsidy, computeCostResult } from "../src/features/financials/computeCostResult.js";
import { DEFAULT_FINANCIAL_INPUTS } from "../src/features/financials/costConfig.js";

const cases = [
  { kw: 1,   expected: 30_000 },
  { kw: 2,   expected: 60_000 },
  { kw: 2.5, expected: 69_000 },
  { kw: 3,   expected: 78_000 },
  { kw: 5,   expected: 78_000 },
  { kw: 10,  expected: 78_000 },
];

let ok = true;
for (const { kw, expected } of cases) {
  const got = computePmSuryaGharSubsidy(kw);
  if (got !== expected) {
    console.error(`FAIL ${kw} kW: got ${got}, expected ${expected}`);
    ok = false;
  }
}

const cost = computeCostResult(DEFAULT_FINANCIAL_INPUTS, 14.3);
const gross = 14.3 * 1000 * 50;
const net = gross - 78_000;

if (cost.grossCost !== gross) {
  console.error(`FAIL gross: ${cost.grossCost} vs ${gross}`);
  ok = false;
}
if (cost.subsidyAmount !== 78_000) {
  console.error(`FAIL subsidy: ${cost.subsidyAmount}`);
  ok = false;
}
if (cost.netCost !== net) {
  console.error(`FAIL net: ${cost.netCost} vs ${net}`);
  ok = false;
}

if (ok) {
  console.log("Step 8A cost engine: all slab checks passed.");
  console.log(`14.3 kWp @ ₹50/W → gross ₹${cost.grossCost.toLocaleString("en-IN")}, net ₹${cost.netCost.toLocaleString("en-IN")}`);
} else {
  process.exit(1);
}
