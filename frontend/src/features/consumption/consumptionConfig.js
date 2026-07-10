/**
 * consumptionConfig.js — Step 8E customer electricity usage defaults.
 */

export const DEFAULT_CONSUMPTION_INPUTS = {
  inputMode:            "bill", // "bill" | "units"
  monthlyBill:          18_000,
  averageMonthlyUnits:  null,
  monthlyProfile:       null,   // reserved for OCR / DISCOM — 12 kWh values
  source:               "manual",
};
