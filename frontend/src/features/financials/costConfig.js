/**
 * costConfig.js — Step 8A configurable cost & subsidy defaults (India).
 *
 * All tunable financial constants live here. Not hardcoded to one state.
 */

/**
 * costConfig.js — Step 8A configurable cost & subsidy defaults (India).
 *
 * All tunable financial constants live here. Not hardcoded to one state.
 */

/** Per-field defaults + engineering validation ranges (advisory only — never blocks input). */
export const FINANCIAL_INPUT_SPECS = {
  costPerWatt: {
    default: 50,
    label:   "Cost per watt",
    unit:    "₹/W",
    typical: {
      min: 35,
      max: 60,
      hint: "Residential ₹45–60/W · Commercial ₹35–50/W",
    },
    advisory: { min: 20, max: 100 },
  },
  tariffPerUnit: {
    default: 7,
    label:   "Tariff",
    unit:    "₹/kWh",
    typical: { min: 6, max: 10, hint: "Typical ₹6–10/kWh" },
    advisory: { min: 2, max: 15 },
  },
  tariffEscalation: {
    default: 0.03,
    label:   "Tariff escalation",
    unit:    "%/year",
    typical: { min: 0.02, max: 0.05, hint: "Typical 2–5%/year" },
    advisory: { min: 0, max: 0.10 },
    displayAsPercent: true,
  },
  panelDegradation: {
    default: 0.005,
    label:   "Panel degradation",
    unit:    "%/year",
    typical: { min: 0.003, max: 0.008, hint: "Typical 0.3–0.8%/year" },
    advisory: { min: 0, max: 0.03 },
    displayAsPercent: true,
  },
};

/** Default editable financial inputs (user overrides persist in DesignStudio state). */
export const DEFAULT_FINANCIAL_INPUTS = {
  currency:              "INR",
  costPerWatt:           FINANCIAL_INPUT_SPECS.costPerWatt.default,
  subsidyEnabled:        true,
  subsidyScheme:         "pm_surya_ghar_residential",
  manualSubsidyOverride: null,
  tariffPerUnit:         FINANCIAL_INPUT_SPECS.tariffPerUnit.default,
  tariffEscalation:      FINANCIAL_INPUT_SPECS.tariffEscalation.default,
  panelDegradation:      FINANCIAL_INPUT_SPECS.panelDegradation.default,
};

/** Savings projection horizon (years). */
export const SAVINGS_PROJECTION_YEARS = 25;

/** PM Surya Ghar — residential slab structure (2026 defaults). */
export const PM_SURYA_GHAR_RESIDENTIAL = {
  id:           "pm_surya_ghar_residential",
  label:        "PM Surya Ghar (Residential)",
  rateFirst2Kw: 30_000, // ₹/kW for first 2 kW
  rateThirdKw:  18_000, // ₹/kW for the 3rd kW only
  capTotal:     78_000, // ₹ max regardless of system size ≥ 3 kW
};

/** Optional component ₹/W breakdown (v1 uses single costPerWatt; reserved for future). */
export const COMPONENT_COST_DEFAULTS = {
  panels:       28,
  inverter:     8,
  structure:    6,
  bos:          4,
  installation: 3,
  gst:          1,
};

export const SUBSIDY_SCHEMES = {
  [PM_SURYA_GHAR_RESIDENTIAL.id]: PM_SURYA_GHAR_RESIDENTIAL,
};
