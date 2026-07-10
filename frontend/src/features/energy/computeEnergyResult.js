/**
 * computeEnergyResult.js — Step 7B NASA-based energy production engine (pure).
 *
 * Flow: solarResource (7A) + panelArrays (6C) + region exposure (4C) → energyResult.
 * No API calls, no PVWatts, no React.
 */

import {
  ENERGY_LOSS_FACTORS,
  computePerformanceRatio,
  totalNonShadingLoss,
} from "./energyLossConfig";

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function roundKwh(v) {
  return +v.toFixed(1);
}

function roundRatio(v, digits = 4) {
  return +v.toFixed(digits);
}

/**
 * Region-level solar access from Step 4 measured exposure (0–1).
 * Uses installable-region avgScore — never estimates shading.
 *
 * @param {string} regionId
 * @param {Map<string, number>} scoreByRegionId
 */
function solarAccessForRegion(regionId, scoreByRegionId) {
  const score = scoreByRegionId.get(regionId);
  if (score == null || Number.isNaN(score)) return null;
  return Math.max(0, Math.min(1, score / 100));
}

/**
 * Build regionId → avgScore map from placement-ready installable regions.
 *
 * @param {object|null} placementReady
 * @returns {Map<string, number>}
 */
export function buildRegionExposureMap(placementReady) {
  const map = new Map();
  for (const region of placementReady?.installableRegions ?? []) {
    if (region.id != null && region.avgScore != null) {
      map.set(region.id, region.avgScore);
    }
  }
  return map;
}

/**
 * Compute normalized energy production for the current design.
 *
 * @param {object|null} solarResource   Step 7A record (monthlyIrradiance, peakSunHours)
 * @param {object[]}    panelArrays     Step 6C effective arrays
 * @param {object|null} placementReady  Step 5H (region avgScore from 4C)
 * @param {object}      [options]
 * @param {object}      [options.lossFactors]
 * @returns {object|null}
 */
export function computeEnergyResult(
  solarResource,
  panelArrays = [],
  placementReady = null,
  options = {},
) {
  if (!solarResource || !panelArrays.length) return null;

  const { monthlyIrradiance, peakSunHours } = solarResource;
  if (!monthlyIrradiance || monthlyIrradiance.length !== 12 || peakSunHours == null) return null;

  const lossFactors = options.lossFactors ?? ENERGY_LOSS_FACTORS;
  const performanceRatio = computePerformanceRatio(lossFactors);
  const nonShadingTotal = totalNonShadingLoss(lossFactors);
  const scoreByRegion = buildRegionExposureMap(placementReady);

  const lossesTemplate = {
    ...lossFactors,
    totalNonShading: +nonShadingTotal.toFixed(4),
  };

  const arrays = [];
  const systemMonthly = new Array(12).fill(0);

  for (const array of panelArrays) {
    const arrayKWp = array.systemKw ?? 0;
    if (arrayKWp <= 0) continue;

    const solarAccess = solarAccessForRegion(array.id ?? array.regionId, scoreByRegion);
    if (solarAccess == null) continue;

    const monthlyEnergy = monthlyIrradiance.map((irr, i) =>
      roundKwh(irr * DAYS_IN_MONTH[i] * arrayKWp * performanceRatio * solarAccess),
    );

    const annualEnergy = roundKwh(
      arrayKWp * peakSunHours * 365 * performanceRatio * solarAccess,
    );
    const dailyEnergy = roundKwh(annualEnergy / 365);
    const specificYield = roundKwh(annualEnergy / arrayKWp);
    const capacityFactor = roundRatio(annualEnergy / (arrayKWp * 8760));

    monthlyEnergy.forEach((v, i) => {
      systemMonthly[i] += v;
    });

    arrays.push({
      id:               array.id ?? array.regionId,
      displayName:      array.displayName ?? array.id,
      panelCount:       array.panelCount ?? 0,
      systemKw:         arrayKWp,
      annualEnergy,
      dailyEnergy,
      monthlyEnergy,
      specificYield,
      capacityFactor,
      performanceRatio: roundRatio(performanceRatio),
      solarAccess:      roundRatio(solarAccess),
      losses:           { ...lossesTemplate },
    });
  }

  if (!arrays.length) return null;

  const annualEnergy = roundKwh(arrays.reduce((s, a) => s + a.annualEnergy, 0));
  const systemKw = roundRatio(arrays.reduce((s, a) => s + a.systemKw, 0), 2);
  const dailyEnergy = roundKwh(annualEnergy / 365);
  const monthlyEnergy = systemMonthly.map((v) => roundKwh(v));
  const specificYield = systemKw > 0 ? roundKwh(annualEnergy / systemKw) : 0;
  const capacityFactor = systemKw > 0 ? roundRatio(annualEnergy / (systemKw * 8760)) : 0;

  return {
    source:           "estimate",
    dailyEnergy,
    monthlyEnergy,
    annualEnergy,
    specificYield,
    capacityFactor,
    performanceRatio: roundRatio(performanceRatio),
    systemKw,
    arrays,
  };
}
