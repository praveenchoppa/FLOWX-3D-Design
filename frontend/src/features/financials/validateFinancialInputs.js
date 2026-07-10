/**
 * validateFinancialInputs.js — Step 8 advisory-only input validation.
 *
 * Never blocks, clamps, or modifies values. UI display helper only.
 */

import { FINANCIAL_INPUT_SPECS } from "./costConfig";

/**
 * @typedef {'advisory' | 'extreme'} ValidationLevel
 * @typedef {{ level: ValidationLevel, message: string } | null} FieldValidation
 */

/**
 * @param {number} value
 * @param {{ typical: object, advisory: object, label: string }} spec
 * @returns {FieldValidation}
 */
function validateField(value, spec) {
  if (value == null || !Number.isFinite(value)) return null;

  const { typical, advisory, label } = spec;
  const inTypical = value >= typical.min && value <= typical.max;
  if (inTypical) return null;

  const inAdvisory = value >= advisory.min && value <= advisory.max;
  const rangeHint = typical.hint ?? `${typical.min}–${typical.max}`;
  const boundsHint = spec.displayAsPercent
    ? `${(advisory.min * 100).toFixed(0)}–${(advisory.max * 100).toFixed(0)}%`
    : `${advisory.min}–${advisory.max} ${spec.unit ?? ""}`.trim();

  if (!inAdvisory) {
    return {
      level: "extreme",
      message:
        `${label} is far outside realistic engineering assumptions (${rangeHint}; ` +
        `valid range ${boundsHint}). Verify this value before sharing a proposal.`,
    };
  }

  return {
    level: "advisory",
    message:
      `${label} is outside the typical engineering range (${rangeHint}). ` +
      `Financial projections may become unrealistic.`,
  };
}

/**
 * @param {object} financialInputs
 * @returns {{ costPerWatt: FieldValidation, tariffPerUnit: FieldValidation, tariffEscalation: FieldValidation, panelDegradation: FieldValidation }}
 */
export function validateFinancialInputs(financialInputs = {}) {
  return {
    costPerWatt: validateField(
      Number(financialInputs.costPerWatt),
      FINANCIAL_INPUT_SPECS.costPerWatt,
    ),
    tariffPerUnit: validateField(
      Number(financialInputs.tariffPerUnit),
      FINANCIAL_INPUT_SPECS.tariffPerUnit,
    ),
    tariffEscalation: validateField(
      Number(financialInputs.tariffEscalation),
      FINANCIAL_INPUT_SPECS.tariffEscalation,
    ),
    panelDegradation: validateField(
      Number(financialInputs.panelDegradation),
      FINANCIAL_INPUT_SPECS.panelDegradation,
    ),
  };
}
