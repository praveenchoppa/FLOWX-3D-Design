/**
 * verifyElectricalCalculations.mjs — P5A electrical calculation tests.
 * Run: npx vite-node scripts/verifyElectricalCalculations.mjs
 */

import { createElectricalArray } from "../src/features/ElectricalDesign/models/array.js";
import { createInverterFromCatalog } from "../src/features/ElectricalDesign/models/inverter.js";
import { createStringFromSelection } from "../src/features/ElectricalDesign/models/string.js";
import { assignStringToMppt } from "../src/features/ElectricalDesign/models/stringAssignment.js";
import {
  computeElectricalMetrics,
  computeStringMetrics,
  resolvePanelSpec,
  buildPlacedPanelBySlotId,
} from "../src/features/ElectricalDesign/services/electricalCalculations.js";
import {
  dcAcRatio,
  operatingPowerW,
  parallelMpptVoltage,
  seriesCurrent,
  sumInstalledDcCapacityW,
  sumSeriesVoltage,
} from "../src/features/ElectricalDesign/utils/seriesMath.js";
import { getCatalogEntry } from "../src/features/ElectricalDesign/constants/inverterCatalog.js";
import { getPanelById } from "../src/features/panels/panelTypes.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const longi = getPanelById("longi-himo6-550");
assert(longi?.powerW === 550, "rated power available");
assert(longi?.vmpV == null, "catalog must not contain assumed vmpV");
assert(longi?.impA == null, "catalog must not contain assumed impA");

console.log("✓ panel catalog unchanged (powerW only; no assumed STC specs)");

// ── seriesMath (raw values — independent of catalog) ─────────────────────────
assert(sumSeriesVoltage([41.65, 41.65]) === 83.3, "series voltage sums");
assert(seriesCurrent([13.21, 13.0]) === 13.0, "series current = min Imp");
assert(operatingPowerW(416.5, 13.21) === 416.5 * 13.21, "operating power = V×I");
assert(sumInstalledDcCapacityW([550, 550]) === 1100, "DC capacity sums wattage");
assert(parallelMpptVoltage([400, 410]) === 400, "parallel MPPT V = min string V");
assert(dcAcRatio(110, 100) === 1.1, "DC/AC ratio");

console.log("✓ seriesMath");

// ── Catalog-backed DC capacity (no operating spec required) ──────────────────
const panelLayout = {
  placedPanels: [
    { slotId: "r1::0::0", panelTypeId: "longi-himo6-550", row: 0, col: 0 },
    { slotId: "r1::0::1", panelTypeId: "longi-himo6-550", row: 0, col: 1 },
    { slotId: "r1::0::2", panelTypeId: "ja-solar-deepblue-540", row: 0, col: 2 },
  ],
};

const array = createElectricalArray({
  id: "arr-1",
  panelIds: ["r1::0::0", "r1::0::1", "r1::0::2"],
});

const str1Result = createStringFromSelection(
  [array],
  [],
  "arr-1",
  ["r1::0::0", "r1::0::1"],
  panelLayout,
);
assert(str1Result.ok, "string 1 created");

const placedBySlot = buildPlacedPanelBySlotId(panelLayout);
const str1Metrics = computeStringMetrics(str1Result.string, placedBySlot);

assert(str1Metrics.dcCapacityW === 1100, "string DC capacity = sum powerW");
assert(str1Metrics.voltageV == null, "string voltage pending until vmpV in catalog");
assert(str1Metrics.currentA == null, "string current pending until impA in catalog");
assert(str1Metrics.operatingPowerW == null, "operating power pending until STC specs");
assert(str1Metrics.missingOperatingSpec === true, "missingOperatingSpec flagged");

console.log("✓ computeStringMetrics (DC capacity only without STC catalog data)");

const spec = resolvePanelSpec("r1::0::0", placedBySlot);
assert(spec.powerW === 550, "powerW resolved");
assert(!spec.hasOperatingSpec, "no operating spec without vmpV/impA");

console.log("✓ resolvePanelSpec");

// ── MPPT aggregation + inverter (DC capacity path) ───────────────────────────
const huawei = getCatalogEntry("huawei-sun2000-100ktl");
const { inverter, mppts: createdMppts } = createInverterFromCatalog(huawei);
const mppt1 = createdMppts[0];
const mppt2 = createdMppts[1];

let strings = str1Result.strings;
let mppts = createdMppts;

let assign = assignStringToMppt(strings, mppts, str1Result.string.id, mppt1.id, inverter.id);
assert(assign.ok, "string 1 assigned");
strings = assign.strings;
mppts = assign.mppts;
const assign1 = assign;

const str2Unassigned = createStringFromSelection(
  str1Result.arrays,
  assign1.strings,
  "arr-1",
  ["r1::0::2"],
  panelLayout,
);
assert(str2Unassigned.ok, "unassigned string fixture");
const unassignedMetrics = computeElectricalMetrics({
  arrays: str2Unassigned.arrays,
  strings: str2Unassigned.strings,
  mppts: assign1.mppts,
  inverters: [inverter],
  inverter,
  panelLayout,
});
assert(unassignedMetrics.inverter.totalDcCapacityW === 1100, "only assigned string DC counts");
assert(unassignedMetrics.inverter.assignedStringCount === 1, "one assigned string");

console.log("✓ unassigned strings excluded from inverter DC");

const str2Result = createStringFromSelection(
  str1Result.arrays,
  strings,
  "arr-1",
  ["r1::0::2"],
  panelLayout,
);
strings = str2Result.strings;
assign = assignStringToMppt(strings, mppts, str2Result.string.id, mppt2.id, inverter.id);
assert(assign.ok, "second string on separate MPPT");
strings = assign.strings;
mppts = assign.mppts;

const metrics = computeElectricalMetrics({
  arrays: str2Result.arrays,
  strings,
  mppts,
  inverters: [inverter],
  inverter,
  panelLayout,
});

const mppt1Metrics = metrics.byMpptId[mppt1.id];
const mppt2Metrics = metrics.byMpptId[mppt2.id];
assert(mppt1Metrics.stringCount === 1, "MPPT 1 has one string");
assert(mppt2Metrics.stringCount === 1, "MPPT 2 has one string");
assert(mppt1Metrics.dcCapacityW === 1100, "MPPT 1 DC capacity");
assert(mppt2Metrics.dcCapacityW === 540, "MPPT 2 DC capacity");
assert(mppt1Metrics.voltageV == null, "MPPT voltage pending without STC specs");

assert(metrics.inverter != null, "inverter metrics present");
assert(metrics.inverter.totalDcCapacityW === 550 + 550 + 540, "inverter DC = assigned strings only (all assigned in fixture)");
assert(metrics.inverter.totalDcCapacityKw === 1.64, "DC kW rounded");
assert(metrics.inverter.dcAcRatio === 0.02, "DC/AC = 1.64/100");
assert(metrics.inverter.assignedStringCount === 2, "assigned string count");

console.log("✓ MPPT + inverter DC capacity (per-inverter assigned-string scope)");

assert(Array.isArray(metrics.warnings) && metrics.warnings.length === 0,
  "warnings array reserved empty");

console.log("✓ warnings placeholder");

console.log("\nAll P5A electrical calculation checks passed.");
