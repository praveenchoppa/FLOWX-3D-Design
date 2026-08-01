/**
 * verifyArrayRotation.mjs — Step 7 array rotation + freeze pure-function tests.
 * Run: npx vite-node scripts/verifyArrayRotation.mjs
 */

import {
  applyElectricalArrayRotations,
  normalizeRotationDeg,
  rotationDegEqual,
  validateArrayRotation,
} from "../src/features/ElectricalDesign/models/arrayRotation.js";
import {
  createElectricalArray,
  mergeElectricalArrays,
  mergePersistedArrayTransforms,
  splitElectricalArray,
  validateMergeCompatibility,
} from "../src/features/ElectricalDesign/models/array.js";
import { applyPanelOverrides, resolveEffectivePanelLayout } from "../src/features/panels/panelEditorUtils.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const baselinePanels = [
  {
    slotId: "s0",
    id: "s0",
    regionId: "r1",
    roofId: "roof-1",
    center: { x: 0, z: 0 },
    width: 1.1,
    length: 2.2,
    rotation: 0,
  },
  {
    slotId: "s1",
    id: "s1",
    regionId: "r1",
    roofId: "roof-1",
    center: { x: 1.2, z: 0 },
    width: 1.1,
    length: 2.2,
    rotation: 0,
  },
  {
    slotId: "s2",
    id: "s2",
    regionId: "r2",
    roofId: "roof-1",
    center: { x: 5, z: 5 },
    width: 1.1,
    length: 2.2,
    rotation: 0,
  },
];

const arrayA = createElectricalArray({
  id: "arr-a",
  panelIds: ["s0", "s1"],
  rotationDeg: 0,
});

const at30 = applyElectricalArrayRotations(baselinePanels, [
  { ...arrayA, rotationDeg: 30 },
]);
const at45FromBaseline = applyElectricalArrayRotations(baselinePanels, [
  { ...arrayA, rotationDeg: 45 },
]);
const at45Repeated = applyElectricalArrayRotations(baselinePanels, [
  { ...arrayA, rotationDeg: 45 },
]);

const panel0At45 = at45FromBaseline.find((p) => p.slotId === "s0");
const panel0Repeated = at45Repeated.find((p) => p.slotId === "s0");
const panel0At30 = at30.find((p) => p.slotId === "s0");

assert(
  Math.abs(panel0At45.center.x - panel0Repeated.center.x) < 1e-9
  && Math.abs(panel0At45.center.z - panel0Repeated.center.z) < 1e-9,
  "repeated 45° applications from baseline are identical",
);

assert(
  Math.abs(panel0At45.center.x - panel0At30.center.x) > 1e-6
  || Math.abs(panel0At45.center.z - panel0At30.center.z) > 1e-6,
  "45° differs from 30° (absolute target, not cumulative 75°)",
);

const rotated = applyElectricalArrayRotations(baselinePanels, [
  { ...arrayA, rotationDeg: 25 },
]);
const arrayPanelIds = rotated.filter((p) => arrayA.panelIds.includes(p.slotId));
assert(arrayPanelIds.length === 2, "panel count unchanged");
assert(arrayPanelIds.every((p) => arrayA.panelIds.includes(p.slotId)), "slot IDs preserved");
assert(rotated.find((p) => p.slotId === "s2").center.x === 5, "foreign panels unchanged");

const generatedLayout = {
  placedPanels: baselinePanels,
  ghostSlots: [],
  summary: {},
};
const legacyBase = {
  placedPanels: baselinePanels,
  allValidSlots: baselinePanels,
  ghostSlots: [],
  summary: {},
};
const effectivePA = resolveEffectivePanelLayout(generatedLayout, { removed: [], added: [], rotated: [] });
const effectiveLegacy = applyPanelOverrides(legacyBase, { removed: [], added: [], rotated: [] });

const paRotated = applyElectricalArrayRotations(effectivePA.placedPanels, [
  { ...arrayA, rotationDeg: 15 },
]);
const legacyRotated = applyElectricalArrayRotations(effectiveLegacy.placedPanels, [
  { ...arrayA, rotationDeg: 15 },
]);

assert(
  Math.abs(paRotated[0].rotation - legacyRotated[0].rotation) < 1e-9,
  "rotation works in both PA and legacy layout paths",
);

const arr0 = createElectricalArray({ id: "m0", panelIds: ["s0"], rotationDeg: 0 });
const arr1 = createElectricalArray({ id: "m1", panelIds: ["s2"], rotationDeg: 10 });
const mergeCheck = validateMergeCompatibility([arr0, arr1], ["m0", "m1"]);
assert(!mergeCheck.ok, "merge blocked when rotationDeg differs");
assert(mergeCheck.reason.includes("rotation"), "merge reason mentions rotation");

const source = createElectricalArray({
  id: "src",
  panelIds: ["s0", "s1"],
  rotationDeg: 33,
  frozen: true,
});
const splitResult = splitElectricalArray([source], "src", ["s0"]);
assert(splitResult.ok, "split ok");
assert(splitResult.split.rotationDeg === 33, "child inherits rotationDeg");
assert(splitResult.split.frozen === false, "child starts unfrozen");

const merged = mergeElectricalArrays(
  [arr0, createElectricalArray({ id: "m3", panelIds: ["s1"], rotationDeg: 0 })],
  ["m0", "m3"],
);
assert(merged.ok, "merge with matching rotation");
assert(merged.merged.rotationDeg === 0, "merged array keeps rotationDeg");

const fresh = [createElectricalArray({ id: "arr-a", panelIds: ["s0", "s1"] })];
const persisted = [createElectricalArray({
  id: "arr-a",
  panelIds: ["s0", "s1"],
  rotationDeg: 42,
  frozen: true,
})];
const restored = mergePersistedArrayTransforms(fresh, persisted);
assert(restored[0].rotationDeg === 42, "restores rotationDeg on remount");
assert(restored[0].frozen === true, "restores frozen on remount");

const frozenCheck = validateArrayRotation({
  baselinePanels,
  array: { ...arrayA, frozen: true },
  rotationDeg: 10,
  placementReady: null,
});
assert(!frozenCheck.ok && frozenCheck.reason.includes("frozen"), "frozen array cannot rotate");

assert(normalizeRotationDeg(390) === 30, "normalize wraps degrees");
assert(rotationDegEqual(360, 0), "rotation tolerance");
assert(rotationDegEqual(0.0000005, 0), "rotation tolerance near zero");

console.log("verifyArrayRotation.mjs — all checks passed");
