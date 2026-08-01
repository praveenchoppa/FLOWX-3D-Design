/**
 * verifyArraySplit.mjs — Pure-function tests for P2c split array.
 * Run: npx vite-node scripts/verifyArraySplit.mjs
 */

import {
  createElectricalArray,
  defaultSplitArrayDisplayName,
  splitElectricalArray,
  validateSplitSelection,
} from "../src/features/ElectricalDesign/models/array.js";
import {
  createStringFromSelection,
  purgeStringsAndSyncArrays,
} from "../src/features/ElectricalDesign/models/string.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const DEFAULT_SPACING = {
  panelGapM: 0.02,
  interRowGapM: 0.3,
  edgeClearanceM: 0.3,
  obstacleClearanceM: 0.3,
};

const source = createElectricalArray({
  id: "pa-1",
  displayName: "Array A",
  sourcePlacementAreaId: "pa-1",
  panelIds: [
    "r1::0::0", "r1::0::1", "r1::0::2", "r1::1::0",
    "r1::1::1", "r1::1::2", "r1::2::0", "r1::2::1",
  ],
  orientation: "portrait",
  tilt: 10,
  spacing: DEFAULT_SPACING,
  stringIds: ["str-old"],
});

const arrays = [source];

// ── Validation ───────────────────────────────────────────────────────────────
assert(!validateSplitSelection(arrays, "pa-1", []).ok, "empty selection rejected");

const allSelected = source.panelIds;
assert(!validateSplitSelection(arrays, "pa-1", allSelected).ok, "all panels rejected");

const tiny = [createElectricalArray({
  id: "tiny",
  displayName: "Tiny",
  panelIds: ["only"],
})];
assert(!validateSplitSelection(tiny, "tiny", ["only"]).ok, "single-panel array rejected");

assert(
  !validateSplitSelection(arrays, "pa-1", ["outside::0::0"]).ok,
  "outside panel rejected",
);

const dupOk = validateSplitSelection(arrays, "pa-1", ["r1::0::0", "r1::0::0", "r1::1::0"]);
assert(dupOk.ok && dupOk.normalizedSelection.length === 2, "duplicates deduped");

console.log("✓ validateSplitSelection");

// ── Split success ────────────────────────────────────────────────────────────
const selection = ["r1::1::0", "r1::1::1", "r1::2::0", "r1::2::1"];
const result = splitElectricalArray(arrays, "pa-1", selection);

assert(result.ok, "split succeeds");
assert(result.source.id === "pa-1", "source id unchanged");
assert(result.split.id.startsWith("split-"), "new array split-* id");
assert(result.source.panelIds.length === 4, "source has 4 remaining");
assert(result.split.panelIds.length === 4, "split has 4 moved");
assert(result.arrays.length === 2, "two arrays total");

const totalBefore = source.panelIds.length;
const totalAfter = result.source.panelIds.length + result.split.panelIds.length;
assert(totalBefore === totalAfter, "total panel count preserved");

const union = [...result.source.panelIds, ...result.split.panelIds];
assert(new Set(union).size === union.length, "no duplicate slotIds across arrays");
assert(
  union.every((id) => source.panelIds.includes(id)),
  "no lost panels",
);
assert(
  union.length === source.panelIds.length,
  "partition covers all source panels",
);

// Ordering preserved relative to original source order
assert(
  result.source.panelIds.join("|") === "r1::0::0|r1::0::1|r1::0::2|r1::1::2",
  "source panel order preserved",
);
assert(
  result.split.panelIds.join("|") === "r1::1::0|r1::1::1|r1::2::0|r1::2::1",
  "split panel order preserved",
);

assert(result.source.stringIds.length === 0, "source stringIds cleared");
assert(result.split.stringIds.length === 0, "split stringIds cleared");

assert(result.split.orientation === source.orientation, "orientation inherited");
assert(result.split.tilt === source.tilt, "tilt inherited");
assert(result.split.sourcePlacementAreaId === source.sourcePlacementAreaId, "sourcePlacementAreaId inherited");

const name = defaultSplitArrayDisplayName(arrays);
assert(name.startsWith("Array "), "default name uses array letter strategy");

console.log("✓ splitElectricalArray");

// ── String purge on split (P3.1) ─────────────────────────────────────────────
const panelLayout = {
  placedPanels: source.panelIds.map((slotId, i) => ({
    slotId,
    row: Math.floor(i / 3),
    col: i % 3,
  })),
};

const withStrings = createStringFromSelection(
  arrays,
  [],
  "pa-1",
  ["r1::0::0", "r1::0::1"],
  panelLayout,
);
assert(withStrings.ok, "setup string for purge test");

const splitWithStrings = splitElectricalArray(
  withStrings.arrays,
  "pa-1",
  ["r1::1::0", "r1::1::1"],
);
assert(splitWithStrings.ok, "split with existing strings succeeds");

const purged = purgeStringsAndSyncArrays(
  splitWithStrings.arrays,
  withStrings.strings,
  ["pa-1"],
);
assert(purged.strings.length === 0, "strings purged from split source array");
assert(
  purged.arrays.find((a) => a.id === "pa-1")?.stringIds.length === 0,
  "source stringIds cleared after purge",
);

console.log("✓ string purge on split");

// Global partition across all arrays
const allIds = result.arrays.flatMap((a) => a.panelIds);
assert(allIds.length === totalBefore, "global count unchanged");
assert(new Set(allIds).size === allIds.length, "global no duplicates");

console.log("\nAll array split verification tests passed.");
