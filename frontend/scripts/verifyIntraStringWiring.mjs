/**
 * verifyIntraStringWiring.mjs — P5D intra-string wiring geometry tests.
 * Run: npx vite-node scripts/verifyIntraStringWiring.mjs
 */

import { createStringFromSelection, createElectricalString } from "../src/features/ElectricalDesign/models/string.js";
import { createElectricalArray } from "../src/features/ElectricalDesign/models/array.js";
import {
  computeIntraStringWiring,
  computeAllIntraStringWiring,
  INTRA_STRING_WIRING_CONVENTION,
} from "../src/features/ElectricalDesign/services/intraStringWiring.js";
import {
  buildPlacedPanelBySlotId,
  horizontalCenterDistanceM,
} from "../src/features/ElectricalDesign/utils/geometry.js";
import { homerunLengthDisplay, wiringSummaryForDisplay } from "../src/features/ElectricalDesign/models/cable.js";
import { roundMetric } from "../src/features/ElectricalDesign/utils/seriesMath.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const PANEL_GAP_M = 0.02;
const PANEL_WIDTH_M = 1.134;

const panelLayout = {
  placedPanels: [
    {
      slotId: "r1::0::0",
      id: "r1::0::0",
      regionId: "r1",
      roofId: "roof-1",
      center: { x: 0, z: 0 },
      width: PANEL_WIDTH_M,
      length: 2.278,
      rotation: 0,
      row: 0,
      col: 0,
    },
    {
      slotId: "r1::0::1",
      id: "r1::0::1",
      regionId: "r1",
      roofId: "roof-1",
      center: { x: PANEL_WIDTH_M + PANEL_GAP_M, z: 0 },
      width: PANEL_WIDTH_M,
      length: 2.278,
      rotation: 0,
      row: 0,
      col: 1,
    },
    {
      slotId: "r1::0::2",
      id: "r1::0::2",
      regionId: "r1",
      roofId: "roof-1",
      center: { x: 2 * (PANEL_WIDTH_M + PANEL_GAP_M), z: 0 },
      width: PANEL_WIDTH_M,
      length: 2.278,
      rotation: 0,
      row: 0,
      col: 2,
    },
  ],
};

const array = createElectricalArray({
  id: "arr-1",
  panelIds: ["r1::0::0", "r1::0::1", "r1::0::2"],
});

const strResult = createStringFromSelection(
  [array],
  [],
  "arr-1",
  ["r1::0::0", "r1::0::1", "r1::0::2"],
  panelLayout,
);
assert(strResult.ok, "string created");

const panelBySlot = buildPlacedPanelBySlotId(panelLayout);
const deckYMap = { "roof-1": 3.14 };
const wiring = computeIntraStringWiring(strResult.string, panelBySlot, deckYMap);

assert(wiring.convention === INTRA_STRING_WIRING_CONVENTION, "convention documented");
assert(wiring.complete, "all panels resolved");
assert(wiring.segments.length === 2, "two panel-to-panel segments");
assert(wiring.homerunLengthM === null, "homerun not fabricated");

const seg0Expected = horizontalCenterDistanceM(
  panelLayout.placedPanels[0],
  panelLayout.placedPanels[1],
);
const seg1Expected = horizontalCenterDistanceM(
  panelLayout.placedPanels[1],
  panelLayout.placedPanels[2],
);

assert(wiring.segments[0].lengthM === roundMetric(seg0Expected, 2), "segment 0 length");
assert(wiring.segments[1].lengthM === roundMetric(seg1Expected, 2), "segment 1 length");
assert(
  wiring.intraStringLengthM === roundMetric(seg0Expected + seg1Expected, 1),
  "total ≈ sum of panel-to-panel gaps (center-to-center)",
);

console.log("✓ hand-check string length matches center-to-center sum");

const summary = wiringSummaryForDisplay(wiring);
assert(summary.value.includes("m"), "formatted length");
assert(summary.detail.includes("center-to-center"), "estimate label");

assert(homerunLengthDisplay(null, null).value === "Pending Termination Placement", "homerun display");

// Single panel → 0 m wiring
const singleString = createElectricalString({
  id: "string-single",
  displayName: "String Single",
  arrayId: "arr-1",
  orderedPanelSequence: ["r1::0::0"],
});
const singleWiring = computeIntraStringWiring(
  singleString,
  buildPlacedPanelBySlotId(panelLayout),
  deckYMap,
);
assert(singleWiring.intraStringLengthM === 0, "single panel string = 0 m");
assert(singleWiring.segments.length === 0, "no segments for one panel");

console.log("✓ single-panel string");

// Missing panel geometry → incomplete
const missingString = {
  ...strResult.string,
  orderedPanelSequence: ["r1::0::0", "missing-slot", "r1::0::2"],
};
const incomplete = computeIntraStringWiring(
  missingString,
  panelBySlot,
  deckYMap,
);
assert(!incomplete.complete, "missing panel → incomplete");
assert(incomplete.intraStringLengthM === null, "no fabricated total");

console.log("✓ missing panel geometry");

const all = computeAllIntraStringWiring(strResult.strings, panelLayout, [{ id: "roof-1", height: 3 }]);
assert(all.segments.length === 2, "all strings segments aggregated");

console.log("✓ computeAllIntraStringWiring");

console.log("\nAll P5D intra-string wiring checks passed.");
