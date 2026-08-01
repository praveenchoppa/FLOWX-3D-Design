/**
 * verifyStringCreation.mjs — P3.1 string creation pure-function tests.
 * Run: npx vite-node scripts/verifyStringCreation.mjs
 */

import { createElectricalArray } from "../src/features/ElectricalDesign/models/array.js";
import {
  assignedPanelIdsForArray,
  createElectricalString,
  createStringFromSelection,
  defaultStringDisplayName,
  deriveStringEndpoints,
  getUnassignedPanelIds,
  orderPanelsSpatially,
  purgeStringsAndSyncArrays,
  selectedPanelsAreUnassigned,
  validateStringCreation,
} from "../src/features/ElectricalDesign/models/string.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const panelLayout = {
  placedPanels: [
    { slotId: "r1::0::0", row: 0, col: 0 },
    { slotId: "r1::0::1", row: 0, col: 1 },
    { slotId: "r1::1::0", row: 1, col: 0 },
    { slotId: "r1::1::1", row: 1, col: 1 },
  ],
};

const array = createElectricalArray({
  id: "arr-1",
  displayName: "Array A",
  panelIds: ["r1::0::0", "r1::0::1", "r1::1::0", "r1::1::1"],
});

const arrays = [array];
let strings = [];

// ── deriveStringEndpoints ────────────────────────────────────────────────────
assert(
  deriveStringEndpoints([]).startPanelId === null,
  "empty sequence has null endpoints",
);
assert(
  deriveStringEndpoints(["a", "b", "c"]).startPanelId === "a"
  && deriveStringEndpoints(["a", "b", "c"]).endPanelId === "c",
  "endpoints from first/last in sequence",
);

const created = createElectricalString({
  id: "s1",
  displayName: "String 1",
  arrayId: "arr-1",
  orderedPanelSequence: ["r1::0::0", "r1::0::1"],
});
assert(created.startPanelId === "r1::0::0", "createElectricalString sets startPanelId");
assert(created.endPanelId === "r1::0::1", "createElectricalString sets endPanelId");

console.log("✓ deriveStringEndpoints / createElectricalString");

// ── spatial ordering (default creation order only) ───────────────────────────
const shuffled = ["r1::1::1", "r1::0::0", "r1::1::0", "r1::0::1"];
const ordered = orderPanelsSpatially(panelLayout, shuffled);
assert(
  ordered.join("|") === "r1::0::0|r1::0::1|r1::1::0|r1::1::1",
  "spatial order: row then col then slotId",
);

console.log("✓ orderPanelsSpatially");

// ── validation ───────────────────────────────────────────────────────────────
assert(!validateStringCreation(arrays, strings, "arr-1", []).ok, "empty selection rejected");
assert(
  !validateStringCreation(arrays, strings, "arr-1", ["outside"]).ok,
  "outside panel rejected",
);

const dupCheck = validateStringCreation(arrays, strings, "arr-1", ["r1::0::0", "r1::0::0"]);
assert(dupCheck.ok && dupCheck.normalizedSelection.length === 1, "duplicates deduped");

console.log("✓ validateStringCreation");

// ── createStringFromSelection ─────────────────────────────────────────────────
const first = createStringFromSelection(
  arrays,
  strings,
  "arr-1",
  ["r1::1::1", "r1::0::0"],
  panelLayout,
);
assert(first.ok, "first string creation succeeds");
assert(first.string.displayName === "String 1", "default name String 1");
assert(
  first.string.orderedPanelSequence.join("|") === "r1::0::0|r1::1::1",
  "creation applies spatial order",
);
assert(
  first.string.startPanelId === "r1::0::0" && first.string.endPanelId === "r1::1::1",
  "endpoints derived from ordered sequence",
);

strings = first.strings;
const updatedArray = first.arrays.find((a) => a.id === "arr-1");
assert(updatedArray.stringIds.includes(first.string.id), "array.stringIds synced");

const assigned = assignedPanelIdsForArray(strings, "arr-1");
assert(assigned.size === 2, "two panels assigned");
assert(getUnassignedPanelIds(updatedArray, strings).length === 2, "two unassigned remain");

console.log("✓ createStringFromSelection (first string)");

// ── duplicate assignment blocked ─────────────────────────────────────────────
const blocked = createStringFromSelection(
  first.arrays,
  strings,
  "arr-1",
  ["r1::0::0", "r1::0::1"],
  panelLayout,
);
assert(!blocked.ok, "already-assigned panel blocked");
assert(
  !selectedPanelsAreUnassigned(strings, "arr-1", ["r1::0::0", "r1::0::1"]),
  "selectedPanelsAreUnassigned false when overlap",
);
assert(
  selectedPanelsAreUnassigned(strings, "arr-1", ["r1::0::1"]),
  "unassigned-only selection passes",
);

console.log("✓ one string per panel enforced");

// ── second string + naming ───────────────────────────────────────────────────
const second = createStringFromSelection(
  first.arrays,
  strings,
  "arr-1",
  ["r1::0::1", "r1::1::0"],
  panelLayout,
);
assert(second.ok, "second string succeeds");
assert(second.string.displayName === "String 2", "default name String 2");
assert(
  defaultStringDisplayName(second.strings, "arr-1") === "String 3",
  "next default name String 3",
);

strings = second.strings;
const fullArray = second.arrays.find((a) => a.id === "arr-1");
assert(fullArray.stringIds.length === 2, "array has two stringIds");
assert(getUnassignedPanelIds(fullArray, strings).length === 0, "all panels assigned");

// Partition: every panel in exactly one string
const allAssigned = [...assignedPanelIdsForArray(strings, "arr-1")];
assert(allAssigned.length === array.panelIds.length, "partition covers all panels");
for (const pid of array.panelIds) {
  assert(allAssigned.includes(pid), `panel ${pid} assigned`);
}

console.log("✓ naming, stringIds sync, partition");

// ── purge on split/merge ─────────────────────────────────────────────────────
const purged = purgeStringsAndSyncArrays(second.arrays, strings, ["arr-1"]);
assert(purged.strings.length === 0, "strings purged for array");
const cleared = purged.arrays.find((a) => a.id === "arr-1");
assert(cleared.stringIds.length === 0, "stringIds cleared on purge");

console.log("✓ purgeStringsAndSyncArrays");

console.log("\nAll string creation verification tests passed.");
