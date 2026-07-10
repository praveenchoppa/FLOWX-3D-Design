/**
 * crmDashboardSummary.js — Step 10 read-only dashboard aggregation (pure).
 *
 * Maps existing derived results to display fields. No calculations.
 */

export function fmtInr(amount) {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function fmtKwh(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Math.round(v).toLocaleString()} kWh`;
}

export function fmtPct(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtYears(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(1)} yrs`;
}

export function fmtKw(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(2)} kW`;
}

/**
 * Build read-only dashboard summary from existing engine outputs.
 *
 * @param {object} inputs
 * @returns {object}
 */
export function buildCrmDashboardSummary({
  panelLayout           = null,
  energyResult          = null,
  costResult            = null,
  savingsResult         = null,
  roiResult             = null,
  coverageResult        = null,
  installedSystemKw     = 0,
}) {
  const capacityKw = energyResult?.systemKw ?? installedSystemKw ?? 0;
  const panelCount = panelLayout?.placedPanels?.length ?? 0;

  return {
    hero: {
      installedCapacityKw: capacityKw,
      panelCount,
      annualProductionKwh: energyResult?.annualEnergy ?? null,
      annualSavingsInr:    savingsResult?.annualSavings ?? null,
      coverage:            coverageResult?.annualCoverage ?? null,
      roiPercent:          roiResult?.roiPercent ?? null,
      paybackYears:        roiResult?.paybackYears ?? null,
      projectStatus:       "Design Complete",
    },
    financial: {
      grossCost:        costResult?.grossCost ?? null,
      netCost:          costResult?.netCost ?? null,
      annualSavings:    savingsResult?.annualSavings ?? null,
      lifetimeSavings:  savingsResult?.lifetimeSavings ?? null,
      roiPercent:       roiResult?.roiPercent ?? null,
      paybackYears:     roiResult?.paybackYears ?? null,
      breakEvenYear:    roiResult?.breakEvenYear ?? null,
      netLifetimeProfit: roiResult?.netLifetimeProfit ?? null,
    },
    preview: {
      capacityKw,
      panelCount,
      status: panelCount > 0 ? "Panels Placed" : "No Panels",
    },
  };
}
