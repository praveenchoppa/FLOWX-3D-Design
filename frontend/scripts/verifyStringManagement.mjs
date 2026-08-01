/**
 * verifyStringManagement.mjs — P3.2 string management pure-function tests.
 * Run: npx vite-node scripts/verifyStringManagement.mjs
 */

import { createElectricalArray } from "../src/features/ElectricalDesign/models/array.js";
import {
  addPanelsToString,
  assignedPanelIdsForArray,
  createStringFromSelection,
  deleteElectricalString,
  getUnassignedPanelIds,
  removePanelsFromString,
  renameElectricalString,
  validateStringRename,
} from "../src/features/ElectricalDesign/models/string.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertPanelConservation(array, strings) {
  const allPanelIds = array.panelIds ?? [];
  const assignedCounts = new Map();

  for (const str of strings.filter((s) => s.arrayId === array.id)) {
    for (const pid of str.orderedPanelSequence ?? []) {
      assignedCounts.set(pid, (assignedCounts.get(pid) ?? 0) + 1);
    }
  }

  for (const pid of allPanelIds) {
    const count = assignedCounts.get(pid) ?? 0;
    assert(count <= 1, `panel ${pid} assigned to ${count} strings`);
    assignedCounts.delete(pid);
  }

  assert(assignedCounts.size === 0, "no orphan assignments outside array panels");

  const unassigned = getUnassignedPanelIds(array, strings);
  const assigned = assignedPanelIdsForArray(strings, array.id);
  assert(unassigned.length + assigned.size === allPanelIds.length, "partition covers all panels");
}

const panelLayout = {
  placedPanels: [
    { slotId: "r1::0::0", row: 0, col: 0 },
    { slotId: "r1::0::1", row: 0, col: 1 },
    { slotId: "r1::1::0", row: 1, col: 0 },
    { slotId: "r1::1::1", row: 1, col: 1 },
    { slotId: "r1::2::0", row: 2, col: 0 },
  ],
};

const array = createElectricalArray({
  id: "arr-1",
  displayName: "Area 1",
  panelIds: ["r1::0::0", "r1::0::1", "r1::1::0", "r1::1::1", "r1::2::0"],
});

let arrays = [array];
let strings = [];

const created = createStringFromSelection(
  arrays,
  strings,
  "arr-1",
  ["r1::1::1", "r1::0::0"],
  panelLayout,
);
assert(created.ok, "setup string");
arrays = created.arrays;
strings = created.strings;
const stringId = created.string.id;

console.log("✓ setup");

// ── Rename ───────────────────────────────────────────────────────────────────
assert(renameElectricalString(strings, stringId, "String A").ok, "rename succeeds");
assert(
  renameElectricalString(strings, stringId, "String A").strings.find((s) => s.id === stringId).displayName === "String A",
  "rename updates displayName",
);

const second = createStringFromSelection(
  arrays,
  renameElectricalString(strings, stringId, "String A").strings,
  "arr-1",
  ["r1::0::1"],
  panelLayout,
);
arrays = second.arrays;
strings = second.strings;

const dup = validateStringRename(strings, stringId, second.string.displayName);
assert(!dup.ok, "duplicate name rejected within array");

console.log("✓ rename");

// ── Add panels (spatial reorder) ─────────────────────────────────────────────
const added = addPanelsToString(
  arrays,
  strings,
  stringId,
  ["r1::2::0"],
  panelLayout,
);
assert(added.ok, "add panels succeeds");
assert(
  added.string.orderedPanelSequence.join("|") === "r1::0::0|r1::1::1|r1::2::0",
  "add recomputes full spatial order (not append)",
);
assert(added.string.startPanelId === "r1::0::0", "start panel updated after add");
assert(added.string.endPanelId === "r1::2::0", "end panel updated after add");
assertPanelConservation(array, added.strings);

const crossArray = addPanelsToString(
  arrays,
  added.strings,
  stringId,
  ["outside::0::0"],
  panelLayout,
);
assert(!crossArray.ok, "cross-array add rejected at model level");

const duplicateAdd = addPanelsToString(
  arrays,
  added.strings,
  second.string.id,
  ["r1::0::0"],
  panelLayout,
);
assert(!duplicateAdd.ok, "already-assigned panel rejected on add");

console.log("✓ add panels");

// ── Remove panels (spatial reorder + auto-delete) ────────────────────────────
const partialRemove = removePanelsFromString(
  arrays,
  added.strings,
  stringId,
  ["r1::1::1"],
  panelLayout,
);
assert(partialRemove.ok && !partialRemove.deleted, "partial remove keeps string");
assert(
  partialRemove.string.orderedPanelSequence.join("|") === "r1::0::0|r1::2::0",
  "remove recomputes spatial order",
);
assertPanelConservation(array, partialRemove.strings);

const unassignedAfterRemove = getUnassignedPanelIds(array, partialRemove.strings);
assert(unassignedAfterRemove.includes("r1::1::1"), "removed panel becomes unassigned");

const lastRemove = removePanelsFromString(
  arrays,
  partialRemove.strings,
  stringId,
  partialRemove.string.orderedPanelSequence,
  panelLayout,
);
assert(lastRemove.ok && lastRemove.deleted, "removing all panels auto-deletes string");
assert(!lastRemove.strings.some((s) => s.id === stringId), "empty string not persisted");
assert(
  lastRemove.arrays.find((a) => a.id === "arr-1").stringIds.includes(stringId) === false,
  "stringIds synced after auto-delete",
);
assertPanelConservation(array, lastRemove.strings);

console.log("✓ remove panels + auto-delete");

// ── Delete string ────────────────────────────────────────────────────────────
const setupDelete = createStringFromSelection(
  arrays,
  lastRemove.strings,
  "arr-1",
  ["r1::0::0", "r1::1::0"],
  panelLayout,
);
arrays = setupDelete.arrays;
strings = setupDelete.strings;
const deleteId = setupDelete.string.id;

const deleted = deleteElectricalString(arrays, strings, deleteId);
assert(deleted.ok, "delete succeeds");
assert(deleted.strings.length === strings.length - 1, "string entity removed");
assert(
  getUnassignedPanelIds(array, deleted.strings).length === array.panelIds.length - 1,
  "deleted string panels returned to unassigned pool",
);
assertPanelConservation(array, deleted.strings);

console.log("✓ delete string");

console.log("\nAll string management verification tests passed.");
