/**
 * verifyStringAssignment.mjs — P4b String → MPPT assignment tests.
 * Run: npx vite-node scripts/verifyStringAssignment.mjs
 */

import { createElectricalArray } from "../src/features/ElectricalDesign/models/array.js";
import {
  clearStringMpptAssignments,
  selectInverterFromCatalog,
  syncMpptsAfterPlacementRefresh,
} from "../src/features/ElectricalDesign/models/inverter.js";
import { mpptsForInverter } from "../src/features/ElectricalDesign/models/mppt.js";
import {
  createStringFromSelection,
  deleteElectricalString,
  purgeStringsAndSyncArrays,
} from "../src/features/ElectricalDesign/models/string.js";
import {
  assertAssignmentSync,
  assignStringToMppt,
  removeStringFromMppt,
  syncMpptsAfterStringRemoval,
} from "../src/features/ElectricalDesign/models/stringAssignment.js";
import { getCatalogEntry } from "../src/features/ElectricalDesign/constants/inverterCatalog.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const panelLayout = {
  placedPanels: [
    { slotId: "r1::0::0", row: 0, col: 0 },
    { slotId: "r1::0::1", row: 0, col: 1 },
    { slotId: "r1::1::0", row: 1, col: 0 },
  ],
};

const array = createElectricalArray({
  id: "arr-1",
  panelIds: ["r1::0::0", "r1::0::1", "r1::1::0"],
});

let strings = [];
let arrays = [array];

const s1 = createStringFromSelection(
  arrays,
  strings,
  "arr-1",
  ["r1::0::0"],
  panelLayout,
);
assert(s1.ok, "string 1 created");
strings = s1.strings;
arrays = s1.arrays;

const s2 = createStringFromSelection(
  arrays,
  strings,
  "arr-1",
  ["r1::0::1"],
  panelLayout,
);
assert(s2.ok, "string 2 created");
strings = s2.strings;

const huawei = getCatalogEntry("huawei-sun2000-100ktl");
const inv = selectInverterFromCatalog(huawei.catalogId, [], [], strings);
assert(inv.ok, "inverter selected");
strings = inv.strings;

const mppts = mpptsForInverter(inv.mppts, inv.inverter);
assert(mppts.length >= 2, "at least 2 MPPTs");

const mppt1 = mppts[0];
const mppt2 = mppts[1];
const str1 = strings[0];
const str2 = strings[1];

// ── Assign string to MPPT ────────────────────────────────────────────────────
let assign = assignStringToMppt(strings, inv.mppts, str1.id, mppt1.id, inv.inverter.id);
assert(assign.ok, "assign succeeds");
strings = assign.strings;
let mpptState = assign.mppts;
assert(strings.find((s) => s.id === str1.id)?.mpptId === mppt1.id, "string.mpptId set");
assert(
  mpptState.find((m) => m.id === mppt1.id)?.stringIds.includes(str1.id),
  "mppt.stringIds contains string",
);
assertAssignmentSync(strings, mpptState);

console.log("✓ assignStringToMppt");

// ── Reassign to another MPPT ─────────────────────────────────────────────────
assign = assignStringToMppt(strings, mpptState, str1.id, mppt2.id, inv.inverter.id);
assert(assign.ok, "reassign succeeds");
strings = assign.strings;
mpptState = assign.mppts;
assert(strings.find((s) => s.id === str1.id)?.mpptId === mppt2.id, "string.mpptId updated");
assert(
  !mpptState.find((m) => m.id === mppt1.id)?.stringIds.includes(str1.id),
  "removed from previous MPPT",
);
assert(
  mpptState.find((m) => m.id === mppt2.id)?.stringIds.includes(str1.id),
  "added to new MPPT",
);
assertAssignmentSync(strings, mpptState);

console.log("✓ reassign removes from prior MPPT");

// ── Remove assignment ────────────────────────────────────────────────────────
let remove = removeStringFromMppt(strings, mpptState, str1.id);
assert(remove.ok, "remove succeeds");
strings = remove.strings;
mpptState = remove.mppts;
assert(strings.find((s) => s.id === str1.id)?.mpptId == null, "string.mpptId cleared");
assert(
  !mpptState.find((m) => m.id === mppt2.id)?.stringIds.includes(str1.id),
  "mppt.stringIds cleared",
);
assertAssignmentSync(strings, mpptState);

console.log("✓ removeStringFromMppt");

// ── P5B: second string on occupied MPPT rejected ─────────────────────────────
assign = assignStringToMppt(strings, mpptState, str1.id, mppt1.id, inv.inverter.id);
strings = assign.strings;
mpptState = assign.mppts;
assign = assignStringToMppt(strings, mpptState, str2.id, mppt1.id, inv.inverter.id);
assert(!assign.ok, "P5B rejects second string on occupied MPPT");
assign = assignStringToMppt(strings, mpptState, str2.id, mppt2.id, inv.inverter.id);
assert(assign.ok, "second string assigns to empty MPPT");
strings = assign.strings;
mpptState = assign.mppts;
assert(
  mpptState.find((m) => m.id === mppt1.id)?.stringIds.length === 1,
  "MPPT 1 has one string",
);
assertAssignmentSync(strings, mpptState);

console.log("✓ P5B rejects multiple strings per MPPT");

// ── Delete string cleans MPPT refs ───────────────────────────────────────────
const del = deleteElectricalString(arrays, strings, str1.id);
assert(del.ok, "delete string succeeds");
strings = del.strings;
arrays = del.arrays;
mpptState = syncMpptsAfterStringRemoval(strings, mpptState);
assert(!strings.some((s) => s.id === str1.id), "string removed");
assert(
  !mpptState.some((m) => (m.stringIds ?? []).includes(str1.id)),
  "deleted string pruned from all MPPTs",
);
assert(
  mpptState.find((m) => m.id === mppt2.id)?.stringIds.includes(str2.id),
  "surviving assignment intact",
);
assertAssignmentSync(strings, mpptState);

console.log("✓ delete string prunes MPPT refs");

// ── Purge strings (merge/split) cleans MPPT refs ─────────────────────────────
assign = assignStringToMppt(strings, mpptState, str2.id, mppt2.id, inv.inverter.id);
strings = assign.strings;
mpptState = assign.mppts;

const purged = purgeStringsAndSyncArrays(arrays, strings, ["arr-1"]);
strings = purged.strings;
arrays = purged.arrays;
mpptState = syncMpptsAfterStringRemoval(strings, mpptState);
assert(strings.length === 0, "strings purged");
assert(
  mpptState.every((m) => (m.stringIds ?? []).length === 0),
  "all MPPT stringIds cleared after purge",
);
assertAssignmentSync(strings, mpptState);

console.log("✓ purge strings prunes MPPT refs");

// ── Placement refresh clears MPPT refs ───────────────────────────────────────
assign = assignStringToMppt(
  s2.strings,
  inv.mppts,
  s2.strings[1]?.id ?? s2.strings[0].id,
  mppt1.id,
  inv.inverter.id,
);
mpptState = syncMpptsAfterPlacementRefresh(assign.mppts);
assert(
  mpptState.every((m) => (m.stringIds ?? []).length === 0),
  "placement refresh clears mppt.stringIds",
);

console.log("✓ placement refresh clears MPPT refs");

// ── Inverter reselect clears string.mpptId ───────────────────────────────────
const withAssign = assignStringToMppt(
  s2.strings,
  inv.mppts,
  s2.strings[0].id,
  mppt1.id,
  inv.inverter.id,
);
const fronius = getCatalogEntry("fronius-symo-20-0-3-m");
const reselect = selectInverterFromCatalog(
  fronius.catalogId,
  inv.inverters,
  withAssign.mppts,
  withAssign.strings,
);
assert(reselect.ok, "reselect succeeds");
assert(
  reselect.strings.every((s) => s.mpptId == null),
  "inverter reselect clears string.mpptId",
);
assert(
  reselect.mppts.every((m) => (m.stringIds ?? []).length === 0),
  "new MPPTs have empty stringIds",
);
assertAssignmentSync(reselect.strings, reselect.mppts);

console.log("✓ inverter reselect clears assignments");

// ── clearStringMpptAssignments utility ───────────────────────────────────────
const cleared = clearStringMpptAssignments(withAssign.strings);
assert(cleared.every((s) => s.mpptId == null), "clearStringMpptAssignments works");

console.log("✓ clearStringMpptAssignments");

console.log("\nAll P4b string assignment checks passed.");
