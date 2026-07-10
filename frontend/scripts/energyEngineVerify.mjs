/**
 * Step 7B verification — physical sanity check for computeEnergyResult.
 * Run: node scripts/energyEngineVerify.mjs
 */
import { computeEnergyResult } from "../src/features/energy/computeEnergyResult.js";
import { CITY_PROFILES } from "../src/features/energy/services/fallbackSolarProfiles.js";

function derivePeakSunHours(avgIrradianceKwhM2Day) {
  return avgIrradianceKwhM2Day;
}

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

const hyderabad = CITY_PROFILES.find((p) => p.id === "hyderabad");
const avgIrr = avg(hyderabad.monthlyIrradiance);

const solarResource = {
  monthlyIrradiance: hyderabad.monthlyIrradiance,
  peakSunHours: derivePeakSunHours(avgIrr),
  avgIrradiance: avgIrr,
  source: "fallback",
};

const panelArrays = [
  {
    id: "region-a",
    regionId: "region-a",
    displayName: "Array A",
    panelCount: 26,
    systemKw: 14.3,
  },
];

const placementReady = {
  installableRegions: [{ id: "region-a", avgScore: 98 }],
};

const result = computeEnergyResult(solarResource, panelArrays, placementReady);

if (!result) {
  console.error("FAIL: energyResult is null");
  process.exit(1);
}

const arraySum = result.arrays.reduce((s, a) => s + a.annualEnergy, 0);
const sumMatch = Math.abs(arraySum - result.annualEnergy) < 0.05;

console.log("=== Step 7B Energy Engine Verification (Hyderabad proxy) ===");
console.log(`System kWp:          ${result.systemKw}`);
console.log(`Annual Energy:       ${result.annualEnergy.toLocaleString()} kWh`);
console.log(`Specific Yield:      ${result.specificYield} kWh/kWp/yr`);
console.log(`Capacity Factor:     ${(result.capacityFactor * 100).toFixed(2)}%`);
console.log(`Performance Ratio:   ${(result.performanceRatio * 100).toFixed(1)}%`);
console.log(`Solar Access:        ${(result.arrays[0].solarAccess * 100).toFixed(0)}%`);
console.log(`Array sum = total:   ${sumMatch ? "YES" : "NO"} (${arraySum} vs ${result.annualEnergy})`);

const yieldOk = result.specificYield >= 1400 && result.specificYield <= 1700;
const annualOk = result.annualEnergy >= 20000 && result.annualEnergy <= 25000;

console.log(`Specific yield 1400–1700: ${yieldOk ? "PASS" : "FAIL"}`);
console.log(`Annual ~20–25 MWh @ 14.3kWp: ${annualOk ? "PASS" : "FAIL"}`);

if (!sumMatch || !yieldOk || !annualOk) {
  process.exit(1);
}

console.log("\nAll checks passed.");
