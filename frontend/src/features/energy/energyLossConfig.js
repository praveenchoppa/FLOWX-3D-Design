/**
 * energyLossConfig.js — Step 7B non-shading loss factors (configurable constants).
 *
 * Shading is NEVER included here — it is applied separately via Step 4 solar access.
 */

/** Fractional loss per category (0–1). Sum = 14 %. */
export const ENERGY_LOSS_FACTORS = {
  temperature:   0.04,
  soiling:       0.02,
  wiring:        0.02,
  mismatch:      0.02,
  connections:   0.01,
  inverter:      0.02,
  availability:  0.01,
};

/** Total non-shading loss fraction. */
export function totalNonShadingLoss(factors = ENERGY_LOSS_FACTORS) {
  return Object.values(factors).reduce((s, v) => s + v, 0);
}

/** Performance ratio = 1 − non-shading losses (shading applied separately). */
export function computePerformanceRatio(factors = ENERGY_LOSS_FACTORS) {
  return 1 - totalNonShadingLoss(factors);
}
