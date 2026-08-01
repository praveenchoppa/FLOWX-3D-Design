/**
 * verifyOneStringPerMppt.mjs — P5B one-string-per-MPPT workflow tests.
 * Run: npx vite-node scripts/verifyOneStringPerMppt.mjs
 */

import { createElectricalArray } from "../src/features/ElectricalDesign/models/array.js";
import { selectInverterFromCatalog, addInverterFromCatalog } from "../src/features/ElectricalDesign/models/inverter.js";
import { mpptsForInverter } from "../src/features/ElectricalDesign/models/mppt.js";
import { createStringFromSelection } from "../src/features/ElectricalDesign/models/string.js";
import {
  assertAssignmentSync,
  assignStringToMppt,
  assignableMpptsForString,
  hasMultiStringMpptAssignments,
  MPPT_OCCUPIED_REASON,
  normalizeOneStringPerMppt,
  removeStringFromMppt,
} from "../src/features/ElectricalDesign/models/stringAssignment.js";
import { computeElectricalMetrics } from "../src/features/ElectricalDesign/services/electricalCalculations.js";
import { getCatalogEntry } from "../src/features/ElectricalDesign/constants/inverterCatalog.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertOneStringPerMppt(mppts) {
  for (const mppt of mppts ?? []) {
    assert((mppt.stringIds?.length ?? 0) <= 1, `mppt ${mppt.id} has multiple strings`);
  }
}

const panelLayout = {
  placedPanels: [
    { slotId: "r1::0::0", panelTypeId: "longi-himo6-550", row: 0, col: 0 },
    { slotId: "r1::0::1", panelTypeId: "longi-himo6-550", row: 0, col: 1 },
    { slotId: "r1::1::0", panelTypeId: "longi-himo6-550", row: 1, col: 0 },
  ],
};

const array = createElectricalArray({
  id: "arr-1",
  panelIds: ["r1::0::0", "r1::0::1", "r1::1::0"],
});

const fronius = getCatalogEntry("fronius-symo-20-0-3-m");
const inv = selectInverterFromCatalog(fronius.catalogId, [], [], []);
assert(inv.ok, "inverter selected");
const mppts = mpptsForInverter(inv.mppts, inv.inverter);
assert(mppts.length === 2, "2 MPPTs for test inverter");

const mppt1 = mppts[0];
const mppt2 = mppts[1];

function makeString(panelIds, strings, arrays) {
  const result = createStringFromSelection(
    arrays,
    strings,
    "arr-1",
    panelIds,
    panelLayout,
  );
  assert(result.ok, "string created");
  return result;
}

// ── Normal case: 2 strings, 2 MPPTs ────────────────────────────────────────
let arrays = [array];
let strings = [];
let s1 = makeString(["r1::0::0"], strings, arrays);
strings = s1.strings;
arrays = s1.arrays;
let s2 = makeString(["r1::0::1"], strings, arrays);
strings = s2.strings;

let assign = assignStringToMppt(strings, mppts, s1.string.id, mppt1.id, inv.inverter.id);
assert(assign.ok, "string 1 assigned to MPPT 1");
strings = assign.strings;
let mpptState = assign.mppts;

assign = assignStringToMppt(strings, mpptState, s2.string.id, mppt2.id, inv.inverter.id);
assert(assign.ok, "string 2 assigned to MPPT 2");
strings = assign.strings;
mpptState = assign.mppts;
assertOneStringPerMppt(mpptState);
assertAssignmentSync(strings, mpptState);

console.log("✓ normal case — 2 strings on 2 MPPTs");

// ── Occupied MPPT rejection ──────────────────────────────────────────────────
assign = assignStringToMppt(strings, mpptState, s2.string.id, mppt1.id, inv.inverter.id);
assert(!assign.ok, "cannot assign second string to occupied MPPT");
assert(assign.reason === MPPT_OCCUPIED_REASON, "meaningful rejection reason");

console.log("✓ occupied MPPT rejects second string");

// ── Reassignment to empty MPPT ───────────────────────────────────────────────
let unassign = removeStringFromMppt(strings, mpptState, s2.string.id);
assert(unassign.ok, "clear MPPT 2 for reassignment test");
strings = unassign.strings;
mpptState = unassign.mppts;

assign = assignStringToMppt(strings, mpptState, s1.string.id, mppt2.id, inv.inverter.id);
assert(assign.ok, "reassign string 1 to empty MPPT 2");
strings = assign.strings;
mpptState = assign.mppts;
assert(strings.find((s) => s.id === s1.string.id)?.mpptId === mppt2.id, "string 1 on MPPT 2");
assert(mpptState.find((m) => m.id === mppt1.id)?.stringIds.length === 0, "MPPT 1 cleared");
assertAssignmentSync(strings, mpptState);

console.log("✓ reassignment to empty MPPT");

// ── More strings than MPPTs ──────────────────────────────────────────────────
strings = [];
arrays = [array];
s1 = makeString(["r1::0::0"], strings, arrays);
strings = s1.strings;
s2 = makeString(["r1::0::1"], strings, arrays);
strings = s2.strings;
const s3 = makeString(["r1::1::0"], strings, arrays);
strings = s3.strings;
mpptState = inv.mppts;

assign = assignStringToMppt(strings, mpptState, s1.string.id, mppt1.id, inv.inverter.id);
strings = assign.strings;
mpptState = assign.mppts;
assign = assignStringToMppt(strings, mpptState, s2.string.id, mppt2.id, inv.inverter.id);
strings = assign.strings;
mpptState = assign.mppts;
assign = assignStringToMppt(strings, mpptState, s3.string.id, mppt1.id, inv.inverter.id);
assert(!assign.ok, "third string cannot take occupied MPPT");
assign = assignStringToMppt(strings, mpptState, s3.string.id, mppt2.id, inv.inverter.id);
assert(!assign.ok, "third string cannot take other occupied MPPT");
assert(strings.find((s) => s.id === s3.string.id)?.mpptId == null, "third string unassigned");

const assignable = assignableMpptsForString(mpptState, s3.string.id);
assert(assignable.length === 0, "no assignable MPPTs for unassigned third string");

console.log("✓ more strings than MPPTs — excess remains unassigned");

// ── Legacy multi-string normalization ────────────────────────────────────────
mpptState = mppts.map((m) => ({ ...m, stringIds: [] }));
strings = s3.strings.map((s) => ({ ...s, mpptId: null }));
mpptState = mpptState.map((m, i) => {
  if (i === 0) return { ...m, stringIds: [s1.string.id, s2.string.id] };
  return m;
});
strings = strings.map((s) => {
  if (s.id === s1.string.id || s.id === s2.string.id) {
    return { ...s, mpptId: mppt1.id };
  }
  return s;
});
assert(hasMultiStringMpptAssignments(mpptState), "legacy invalid state seeded");

const normalized = normalizeOneStringPerMppt(strings, mpptState);
assert(normalized.changed, "normalization runs");
assert(normalized.migrated === 1, "overflow string migrated to empty MPPT");
assertOneStringPerMppt(normalized.mppts);
assertAssignmentSync(normalized.strings, normalized.mppts);
assert(
  normalized.mppts.find((m) => m.id === mppt1.id)?.stringIds.length === 1,
  "MPPT 1 keeps one string",
);
assert(
  normalized.mppts.find((m) => m.id === mppt2.id)?.stringIds.length === 1,
  "MPPT 2 receives migrated string",
);

console.log("✓ legacy multi-string auto-migrates to empty MPPT");

// ── Legacy normalization with no empty MPPT ───────────────────────────────────
mpptState = mppts.map((m) => ({
  ...m,
  stringIds: m.id === mppt1.id ? [s1.string.id, s2.string.id] : [s3.string.id],
}));
strings = [s1.string, s2.string, s3.string].map((s, i) => ({
  ...s,
  mpptId: i < 2 ? mppt1.id : mppt2.id,
}));

const normalizedFull = normalizeOneStringPerMppt(strings, mpptState);
assert(normalizedFull.unassigned === 1, "overflow unassigned when no empty MPPT");
assertOneStringPerMppt(normalizedFull.mppts);
assertAssignmentSync(normalizedFull.strings, normalizedFull.mppts);

console.log("✓ legacy overflow unassigned when all MPPTs full");

// ── P5A calculations unchanged ───────────────────────────────────────────────
const metrics = computeElectricalMetrics({
  arrays,
  strings: normalized.strings,
  mppts: normalized.mppts,
  inverters: [inv.inverter],
  inverter: inv.inverter,
  panelLayout,
});
assert(metrics.byMpptId[mppt1.id].dcCapacityW > 0, "MPPT DC capacity computed");
assert(metrics.inverter?.totalDcCapacityKw > 0, "inverter DC capacity computed");
assert(metrics.inverter?.dcAcRatio != null, "DC/AC ratio computed");

console.log("✓ P5A calculations unaffected");

// ── Cross-inverter normalization does not migrate across pools ───────────────
const invB = addInverterFromCatalog(fronius.catalogId, inv.inverters, inv.mppts);
assert(invB.ok, "second inverter for cross-pool test");
const combinedMppts = invB.mppts.map((m) => ({ ...m, stringIds: [...(m.stringIds ?? [])] }));
combinedMppts[0] = { ...combinedMppts[0], stringIds: [s1.string.id, s2.string.id] };
combinedMppts[1] = { ...combinedMppts[1], stringIds: [s3.string.id] };
const crossStrings = [s1.string, s2.string, s3.string].map((s, i) => ({
  ...s,
  mpptId: i < 2 ? combinedMppts[0].id : combinedMppts[1].id,
}));
assert(hasMultiStringMpptAssignments(combinedMppts), "cross-pool overflow seeded");

const crossNormalized = normalizeOneStringPerMppt(crossStrings, combinedMppts);
assert(crossNormalized.unassigned === 1, "overflow unassigned when no empty MPPT on same inverter");
assert(
  !crossNormalized.mppts.some(
    (m) => m.inverterId === invB.inverter.id && m.stringIds.length > 0,
  ),
  "never assigns overflow to another inverter's MPPT",
);

console.log("✓ cross-inverter overflow stays within inverter pool");

console.log("\nAll P5B one-string-per-MPPT checks passed.");
