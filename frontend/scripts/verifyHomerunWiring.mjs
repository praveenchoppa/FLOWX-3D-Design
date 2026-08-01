/**
 * verifyHomerunWiring.mjs — P5E homerun + effective wiring tests.
 * Run: npx vite-node scripts/verifyHomerunWiring.mjs
 */

import { createStringFromSelection } from "../src/features/ElectricalDesign/models/string.js";
import { createElectricalArray } from "../src/features/ElectricalDesign/models/array.js";
import { createTerminationPoint } from "../src/features/ElectricalDesign/models/terminationPoint.js";
import { composeEffectiveWiring } from "../src/features/ElectricalDesign/services/effectiveWiring.js";
import { computeHomerunWiring } from "../src/features/ElectricalDesign/services/homerunWiring.js";
import {
  homerunLengthDisplay,
  totalCableLengthDisplay,
} from "../src/features/ElectricalDesign/models/cable.js";
import { computeAllIntraStringWiring } from "../src/features/ElectricalDesign/services/intraStringWiring.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const panelLayout = {
  placedPanels: [
    {
      slotId: "r1::0::0",
      id: "r1::0::0",
      regionId: "r1",
      roofId: "roof-1",
      center: { x: 0, z: 0 },
      width: 1.134,
      length: 2.278,
      rotation: 0,
    },
    {
      slotId: "r1::0::1",
      id: "r1::0::1",
      regionId: "r1",
      roofId: "roof-1",
      center: { x: 1.2, z: 0 },
      width: 1.134,
      length: 2.278,
      rotation: 0,
    },
  ],
};

const roofSections = [{ id: "roof-1", height: 3, coordinates: [[0, 0], [0, 0.001], [0.001, 0]] }];
const designCentre = { lat: 0, lng: 0 };

const array = createElectricalArray({
  id: "arr-1",
  panelIds: ["r1::0::0", "r1::0::1"],
});

const strResult = createStringFromSelection(
  [array],
  [],
  "arr-1",
  ["r1::0::0", "r1::0::1"],
  panelLayout,
);
assert(strResult.ok, "string created");

// No termination → no homerun segments, pending display
const withoutTermination = composeEffectiveWiring({
  strings: strResult.strings,
  panelLayout,
  roofSections,
  terminationPoint: null,
  designCentre,
});

assert(withoutTermination.homerunSegments.length === 0, "no homeruns without termination");
assert(
  homerunLengthDisplay(null, null).value === "Pending Termination Placement",
  "pending homerun display",
);
assert(
  totalCableLengthDisplay(withoutTermination.byStringId[strResult.string.id], null).value === "—",
  "no total without termination",
);

// With termination → homerun generated
const termination = createTerminationPoint({ x: 10, z: 5 });
const withTermination = composeEffectiveWiring({
  strings: strResult.strings,
  panelLayout,
  roofSections,
  terminationPoint: termination,
  designCentre,
});

assert(withTermination.homerunSegments.length === 1, "one homerun per completed string");
const wiring = withTermination.byStringId[strResult.string.id];
assert(wiring.homerun.complete, "homerun complete");
assert(wiring.homerun.homerunLengthM > 0, "homerun length numeric");
assert(wiring.totalCableLengthM != null, "total cable length computed");
assert(Math.abs(
  wiring.totalCableLengthM - (wiring.intra.intraStringLengthM + wiring.homerun.homerunLengthM),
) < 0.05, "total = intra + homerun");

// Delete termination → homeruns cleared
const afterDelete = composeEffectiveWiring({
  strings: strResult.strings,
  panelLayout,
  roofSections,
  terminationPoint: null,
  designCentre,
});
assert(afterDelete.homerunSegments.length === 0, "delete clears homeruns");

// Move termination → length changes
const termA = createTerminationPoint({ x: 5, z: 0 });
const termB = createTerminationPoint({ x: 20, z: 0 });
const intra = computeAllIntraStringWiring(strResult.strings, panelLayout, roofSections);
const homerunA = computeHomerunWiring({
  strings: strResult.strings,
  intraByStringId: intra.byStringId,
  terminationPoint: termA,
  panelLayout,
  roofSections,
  designCentre,
});
const homerunB = computeHomerunWiring({
  strings: strResult.strings,
  intraByStringId: intra.byStringId,
  terminationPoint: termB,
  panelLayout,
  roofSections,
  designCentre,
});
assert(
  homerunB.byStringId[strResult.string.id].homerunLengthM
    !== homerunA.byStringId[strResult.string.id].homerunLengthM,
  "move changes homerun length",
);

console.log("verifyHomerunWiring.mjs — all checks passed");
