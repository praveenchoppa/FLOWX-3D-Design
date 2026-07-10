/**
 * Step 6 target-capacity verification.
 * Run: node scripts/panelCapacityVerify.mjs
 */
import {
  pickOptimalPanelCount,
  sortSlotsByZonePriority,
  buildTargetCapacityOverrides,
  buildFillRoofOverrides,
} from "../src/features/panels/panelCapacitySelection.js";
import { resolveTargetCapacityKw, computeLocationSpecificYield } from "../src/features/panels/panelCapacityPlanning.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const panelKw = 0.55;
assert(pickOptimalPanelCount(30, 10, panelKw) === 18, "18 panels (9.9 kW) closer than 19 (10.45 kW)");

const slots = [
  { slotId: "g::0::0", regionId: "good-r", row: 0, col: 0 },
  { slotId: "e::0::0", regionId: "exc-r", row: 0, col: 0 },
];
const ready = {
  installableRegions: [
    { id: "exc-r", zoneClass: "excellent" },
    { id: "good-r", zoneClass: "good" },
  ],
};
const sorted = sortSlotsByZonePriority(slots, ready);
assert(sorted[0].regionId === "exc-r", "Excellent slots before Good");

const fill = buildFillRoofOverrides();
assert(fill.removed.length === 0 && fill.added.length === 0, "Fill roof overrides empty");

const manySlots = Array.from({ length: 20 }, (_, i) => ({
  slotId: `r::0::${i}`,
  regionId: "exc-r",
  row: 0,
  col: i,
}));
const { overrides, meta } = buildTargetCapacityOverrides(
  manySlots,
  ready,
  { power: 550 },
  10,
);
assert(overrides.removed.length === 2, "20 panels → 18 for 10 kW target");
assert(meta.placedCapacityKw === 9.9, "Placed 9.9 kW");

const kw = resolveTargetCapacityKw(
  { placementMode: "targetCapacity", capacityInputMode: "bill", monthlyBill: 18_000 },
  { tariffPerUnit: 7, specificYieldKwhPerKwp: 1400 },
);
assert(kw > 0, "Bill resolves to target kW");

const yieldKwp = computeLocationSpecificYield({ peakSunHours: 5.2 });
assert(yieldKwp > 1000, "Location yield reasonable");

console.log("panelCapacityVerify: all checks passed");
