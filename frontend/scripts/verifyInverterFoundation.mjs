/**
 * verifyInverterFoundation.mjs — P4 inverter + MPPT foundation tests.
 * Run: npx vite-node scripts/verifyInverterFoundation.mjs
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
} from "../src/features/ElectricalDesign/models/string.js";
import { getCatalogEntry } from "../src/features/ElectricalDesign/constants/inverterCatalog.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const huawei = getCatalogEntry("huawei-sun2000-100ktl");
assert(huawei, "catalog entry exists");

// ── Select inverter + MPPT generation ────────────────────────────────────────
let result = selectInverterFromCatalog(huawei.catalogId, [], [], []);
assert(result.ok, "select succeeds");
assert(result.inverters.length === 1, "single inverter MVP storage");
assert(result.mppts.length === huawei.chargeControllerCount, "MPPT count matches catalog");
assert(
  result.inverters[0].mpptIds.length === huawei.chargeControllerCount,
  "inverter.mpptIds synced",
);

const mpptNames = mpptsForInverter(result.mppts, result.inverter).map((m) => m.displayName);
assert(mpptNames.join("|") === "MPPT 1|MPPT 2|MPPT 3|MPPT 4|MPPT 5|MPPT 6", "MPPT naming");

for (const mppt of result.mppts) {
  assert(mppt.inverterId === result.inverter.id, "mppt.inverterId set");
  assert(mppt.stringIds.length === 0, "mppt.stringIds empty");
}

assert(result.inverters[0].manufacturer === "Huawei", "manufacturer snapshotted");
assert(result.inverters[0].totalLoad === 100, "totalLoad snapshotted");

console.log("✓ selectInverterFromCatalog");

// ── Reselect replaces inverter + MPPTs ───────────────────────────────────────
const fronius = getCatalogEntry("fronius-symo-20-0-3-m");
const reselect = selectInverterFromCatalog(
  fronius.catalogId,
  result.inverters,
  result.mppts,
  result.strings,
);
assert(reselect.ok, "reselect succeeds");
assert(reselect.inverters.length === 1, "still single inverter");
assert(reselect.inverters[0].id !== result.inverter.id, "new inverter id");
assert(reselect.mppts.length === 2, "new MPPT count");
assert(!reselect.mppts.some((m) => m.inverterId === result.inverter.id), "old MPPTs removed");

console.log("✓ reselect replaces inverter");

// ── String mpptId cleared on reselect ────────────────────────────────────────
const array = createElectricalArray({
  id: "arr-1",
  panelIds: ["r1::0::0", "r1::0::1"],
});
const panelLayout = {
  placedPanels: [
    { slotId: "r1::0::0", row: 0, col: 0 },
    { slotId: "r1::0::1", row: 0, col: 1 },
  ],
};
const withString = createStringFromSelection(
  [array],
  [],
  "arr-1",
  ["r1::0::0"],
  panelLayout,
);
assert(withString.ok, "string setup");
const stringsWithMppt = withString.strings.map((s) => ({ ...s, mpptId: "stale-mppt" }));

const afterReselect = selectInverterFromCatalog(
  huawei.catalogId,
  reselect.inverters,
  reselect.mppts,
  stringsWithMppt,
);
assert(afterReselect.strings.every((s) => s.mpptId == null), "string.mpptId cleared on reselect");

console.log("✓ string mpptId cleared");

// ── Placement refresh preserves inverter, clears MPPT string refs ────────────
const mpptsWithRefs = afterReselect.mppts.map((m) => ({
  ...m,
  stringIds: ["stale-string"],
}));
const refreshedMppts = syncMpptsAfterPlacementRefresh(mpptsWithRefs);
assert(refreshedMppts.every((m) => m.stringIds.length === 0), "mppt.stringIds cleared on refresh");

const clearedStrings = clearStringMpptAssignments(
  afterReselect.strings.map((s) => ({ ...s, mpptId: "stale" })),
);
assert(clearedStrings.every((s) => s.mpptId == null), "clearStringMpptAssignments");

console.log("✓ placement refresh helpers");

console.log("\nAll inverter foundation verification tests passed.");
