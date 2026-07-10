/**
 * Financial input advisory validation check.
 * Run: npx vite-node scripts/validateFinancialInputsVerify.mjs
 */
import { validateFinancialInputs } from "../src/features/financials/validateFinancialInputs.js";
import { DEFAULT_FINANCIAL_INPUTS } from "../src/features/financials/costConfig.js";

function check(inputs, field, expectedLevel) {
  const v = validateFinancialInputs(inputs)[field];
  const level = v?.level ?? null;
  if (level !== expectedLevel) {
    console.error(`FAIL ${field} @ ${JSON.stringify(inputs[field])}: got ${level}, expected ${expectedLevel}`);
    process.exit(1);
  }
}

check(DEFAULT_FINANCIAL_INPUTS, "costPerWatt", null);
check({ ...DEFAULT_FINANCIAL_INPUTS, costPerWatt: 65 }, "costPerWatt", "advisory");
check({ ...DEFAULT_FINANCIAL_INPUTS, costPerWatt: 2 }, "costPerWatt", "extreme");
check({ ...DEFAULT_FINANCIAL_INPUTS, tariffPerUnit: 30 }, "tariffPerUnit", "extreme");
check({ ...DEFAULT_FINANCIAL_INPUTS, tariffEscalation: 0.15 }, "tariffEscalation", "extreme");
check({ ...DEFAULT_FINANCIAL_INPUTS, panelDegradation: 0.05 }, "panelDegradation", "extreme");

console.log("Financial input advisory validation: all checks passed.");
