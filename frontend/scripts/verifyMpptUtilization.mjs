/**
 * verifyMpptUtilization.mjs — P5C MPPT utilization + allowed overload + soft warnings.
 * Run: npx vite-node scripts/verifyMpptUtilization.mjs
 */

import { createInverterFromCatalog } from "../src/features/ElectricalDesign/models/inverter.js";
import { computeElectricalMetrics } from "../src/features/ElectricalDesign/services/electricalCalculations.js";
import {
  computeMpptUtilizationPercent,
  evaluateMpptUtilization,
  mpptUtilizationStatus,
} from "../src/features/ElectricalDesign/services/mpptUtilization.js";
import {
  computeWarningLimitPercent,
  DEFAULT_MPPT_ALLOWED_OVERLOAD_PERCENT,
  normalizeMpptAllowedOverload,
} from "../src/features/ElectricalDesign/constants/mpptUtilizationConfig.js";
import { getCatalogEntry } from "../src/features/ElectricalDesign/constants/inverterCatalog.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── Allowed overload normalization ────────────────────────────────────────────
assert(
  normalizeMpptAllowedOverload(DEFAULT_MPPT_ALLOWED_OVERLOAD_PERCENT) === 20,
  "default allowed overload is 20%",
);
assert(normalizeMpptAllowedOverload(2) === 0, "snap 2% to 0%");
assert(normalizeMpptAllowedOverload(28) === 30, "snap 28% to 30%");
assert(normalizeMpptAllowedOverload(12) === 10, "snap 12% to 10%");

console.log("✓ allowed overload normalization (0–30%, step 5%)");

// ── Warning limit derivation (not stored) ───────────────────────────────────────
assert(computeWarningLimitPercent(0) === 100, "0% overload → warning at 100%");
assert(computeWarningLimitPercent(10) === 110, "10% overload → warning at 110%");
assert(computeWarningLimitPercent(20) === 120, "20% overload → warning at 120%");
assert(computeWarningLimitPercent(30) === 130, "30% overload → warning at 130%");

console.log("✓ warning limit = 100 + allowed overload");

// ── Utilization formula (P5A dcCapacityW + catalog mppt.capacity only) ────────
assert(computeMpptUtilizationPercent(1100, 17) === 6.5, "1100W / 17kW = 6.5%");
assert(computeMpptUtilizationPercent(1120, 1) === 112, "1120W / 1kW = 112%");
assert(computeMpptUtilizationPercent(1250, 1) === 125, "1250W / 1kW = 125%");
assert(computeMpptUtilizationPercent(0, 10) === 0, "empty MPPT = 0%");
assert(computeMpptUtilizationPercent(1100, null) === null, "missing rated capacity → null");
assert(computeMpptUtilizationPercent(1100, 0) === null, "zero rated capacity → null");

console.log("✓ utilization formula");

// ── Status + soft warnings ────────────────────────────────────────────────────
assert(mpptUtilizationStatus(112, 120) === "healthy", "112% below 120% warning limit");
assert(mpptUtilizationStatus(125, 120) === "warning", "125% above 120% warning limit");
assert(mpptUtilizationStatus(101, 100) === "warning", "101% above 100% warning limit (0% overload)");
assert(mpptUtilizationStatus(100, 100) === "healthy", "100% at rated capacity is healthy");
assert(mpptUtilizationStatus(null, 120) === "unknown", "missing utilization → unknown");

const testMetrics = {
  byMpptId: {
    "mppt-healthy": { dcCapacityW: 1120 },
    "mppt-warn":    { dcCapacityW: 1250 },
    "mppt-unknown": { dcCapacityW: 500 },
  },
};

const mppts = [
  { id: "mppt-healthy", displayName: "MPPT Healthy", capacity: 1 },
  { id: "mppt-warn", displayName: "MPPT Warn", capacity: 1 },
  { id: "mppt-unknown", displayName: "MPPT Unknown", capacity: null },
];

const at20 = evaluateMpptUtilization({
  metrics: testMetrics,
  mppts,
  allowedOverloadPercent: 20,
});

assert(at20.warningLimitPercent === 120, "20% overload → 120% warning limit");
assert(at20.byMpptId["mppt-healthy"].status === "healthy", "112% with 20% overload → healthy");
assert(at20.byMpptId["mppt-warn"].status === "warning", "125% with 20% overload → warning");
assert(at20.byMpptId["mppt-unknown"].status === "unknown", "missing capacity → unknown");
assert(at20.byMpptId["mppt-unknown"].utilizationPercent === null, "missing capacity → — display");
assert(at20.warnings.length === 1, "one soft warning");
assert(at20.warnings[0].allowedOverloadPercent === 20, "warning includes allowedOverloadPercent");
assert(at20.warnings[0].warningLimitPercent === 120, "warning includes warningLimitPercent");
assert(at20.warnings.every((w) => w.level === "soft"), "warnings are soft only");
assert(
  at20.warnings.every((w) => w.code === "MPPT_UTILIZATION_ABOVE_THRESHOLD"),
  "warning code unchanged",
);

const overloadCases = [
  [0, 100, 101, 99],
  [10, 110, 111, 110],
  [20, 120, 121, 120],
  [30, 130, 131, 130],
];

for (const [overload, limit, overUtilW, atUtilW] of overloadCases) {
  const result = evaluateMpptUtilization({
    metrics: { byMpptId: { m: { dcCapacityW: overUtilW * 10 } } },
    mppts: [{ id: "m", displayName: "M", capacity: 1 }],
    allowedOverloadPercent: overload,
  });
  assert(result.warningLimitPercent === limit, `${overload}% overload → ${limit}% limit`);
  assert(result.byMpptId.m.status === "warning", `${overUtilW}% > ${limit}% → warning`);

  const healthy = evaluateMpptUtilization({
    metrics: { byMpptId: { m: { dcCapacityW: atUtilW * 10 } } },
    mppts: [{ id: "m", displayName: "M", capacity: 1 }],
    allowedOverloadPercent: overload,
  });
  assert(healthy.byMpptId.m.status === "healthy", `${atUtilW}% ≤ ${limit}% → healthy`);
}

console.log("✓ soft warnings (non-blocking derived state)");

// ── Integration with P5A metrics (no new electrical calcs) ────────────────────
const huawei = getCatalogEntry("huawei-sun2000-100ktl");
const { inverter, mppts: catalogMppts } = createInverterFromCatalog(huawei);
const mppt1 = catalogMppts[0];

const metrics = computeElectricalMetrics({
  arrays: [],
  strings: [],
  mppts: catalogMppts,
  inverter,
  panelLayout: { placedPanels: [] },
});

const emptyUtil = evaluateMpptUtilization({
  metrics,
  mppts: catalogMppts,
  allowedOverloadPercent: 20,
});

assert(emptyUtil.byMpptId[mppt1.id].utilizationPercent === 0, "unassigned MPPT = 0%");
assert(emptyUtil.warnings.length === 0, "0% utilization → no warning");
assert(Array.isArray(metrics.warnings) && metrics.warnings.length === 0,
  "P5A warnings[] unchanged (empty)");

console.log("✓ P5A integration unchanged");

console.log("\nAll P5C MPPT utilization checks passed.");
