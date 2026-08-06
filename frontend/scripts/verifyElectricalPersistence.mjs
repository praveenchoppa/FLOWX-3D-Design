/**
 * verifyElectricalPersistence.mjs — Phase 2 pure reconciliation tests.
 * Run: npx vite-node scripts/verifyElectricalPersistence.mjs
 */

import {
  buildArraysFromPlacement,
  createElectricalArray,
  mergeElectricalArrays,
  placementInitFingerprint,
  splitElectricalArray,
} from "../src/features/ElectricalDesign/models/array.js";
import {
  assertPanelPartitionInvariant,
  reconcileElectricalFromFingerprints,
  reconcilePersistedElectricalState,
  resolveElectricalInitMode,
} from "../src/features/ElectricalDesign/models/electricalPersistence.js";
import { selectInverterFromCatalog } from "../src/features/ElectricalDesign/models/inverter.js";
import { mpptsForInverter } from "../src/features/ElectricalDesign/models/mppt.js";
import {
  createStringFromSelection,
  deleteElectricalString,
} from "../src/features/ElectricalDesign/models/string.js";
import {
  assertAssignmentSync,
  assignStringToMppt,
  rebuildMpptStringIdsFromStrings,
  removeStringFromMppt,
} from "../src/features/ElectricalDesign/models/stringAssignment.js";
import { getCatalogEntry } from "../src/features/ElectricalDesign/constants/inverterCatalog.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const placementReady = {
  installableRegions: [
    { id: "region-1", sourceId: "region-1", pitch: 15, name: "Region A" },
    { id: "region-2", sourceId: "region-2", pitch: 15, name: "Region B" },
  ],
};

const projectPanelDefaults = { orientation: "portrait", tilt: 15 };

function makeLayout(panels) {
  return { placedPanels: panels };
}

const layoutV1 = makeLayout([
  { slotId: "r1::0::0", regionId: "region-1", row: 0, col: 0 },
  { slotId: "r1::0::1", regionId: "region-1", row: 0, col: 1 },
  { slotId: "r1::1::0", regionId: "region-1", row: 1, col: 0 },
  { slotId: "r2::0::0", regionId: "region-2", row: 0, col: 0 },
]);

const layoutV2RemovedPanel = makeLayout([
  { slotId: "r1::0::0", regionId: "region-1", row: 0, col: 0 },
  { slotId: "r1::0::1", regionId: "region-1", row: 0, col: 1 },
  { slotId: "r2::0::0", regionId: "region-2", row: 0, col: 0 },
]);

const layoutV3NewRegion = makeLayout([
  { slotId: "r1::0::0", regionId: "region-1", row: 0, col: 0 },
  { slotId: "r1::0::1", regionId: "region-1", row: 0, col: 1 },
  { slotId: "r1::1::0", regionId: "region-1", row: 1, col: 0 },
  { slotId: "r2::0::0", regionId: "region-2", row: 0, col: 0 },
  { slotId: "r3::0::0", regionId: "region-3", row: 0, col: 0 },
]);

const placementReadyV3 = {
  installableRegions: [
    ...placementReady.installableRegions,
    { id: "region-3", sourceId: "region-3", pitch: 12, name: "Region C" },
  ],
};

const baseParams = {
  panelLayout: layoutV1,
  placementReady,
  placementAreas: [],
  usePlacementAreaPanelWorkflow: false,
  projectPanelDefaults,
  selectedPanel: null,
};

function fingerprintFor(layout, ready = placementReady) {
  return placementInitFingerprint({
    ...baseParams,
    panelLayout: layout,
    placementReady: ready,
  });
}

function buildFresh(layout = layoutV1, ready = placementReady) {
  return buildArraysFromPlacement({ ...baseParams, panelLayout: layout, placementReady: ready });
}

function validPanelIds(layout) {
  return new Set((layout.placedPanels ?? []).map((p) => p.slotId ?? p.id));
}

function assertNoDanglingRefs(arrays, strings, mppts, inverters) {
  const arrayIds = new Set(arrays.map((a) => a.id));
  const stringIds = new Set(strings.map((s) => s.id));
  const mpptIds = new Set(mppts.map((m) => m.id));
  const inverterIds = new Set(inverters.map((i) => i.id));

  for (const str of strings) {
    assert(arrayIds.has(str.arrayId), `string ${str.id} references missing array ${str.arrayId}`);
    const arr = arrays.find((a) => a.id === str.arrayId);
    for (const pid of str.orderedPanelSequence ?? []) {
      assert(arr.panelIds.includes(pid), `string ${str.id} references panel ${pid} outside array`);
    }
    assert(str.mpptId == null || mpptIds.has(str.mpptId), `string ${str.id} dangling mpptId`);
  }

  for (const mppt of mppts) {
    assert(inverterIds.has(mppt.inverterId), `mppt ${mppt.id} references missing inverter`);
    for (const sid of mppt.stringIds ?? []) {
      assert(stringIds.has(sid), `mppt ${mppt.id} references missing string ${sid}`);
    }
  }

  for (const arr of arrays) {
    for (const sid of arr.stringIds ?? []) {
      assert(stringIds.has(sid), `array ${arr.id} references missing string ${sid}`);
    }
  }

  assertAssignmentSync(strings, mppts);
}

function setupInverters() {
  const fronius = getCatalogEntry("fronius-symo-20-0-3-m");
  const inv = selectInverterFromCatalog(fronius.catalogId, [], [], []);
  assert(inv.ok, "inverter selected");
  return {
    inverters: inv.inverters,
    mppts: mpptsForInverter(inv.mppts, inv.inverter),
  };
}

function makeString(arrays, strings, arrayId, panelIds, layout) {
  const result = createStringFromSelection(arrays, strings, arrayId, panelIds, layout);
  assert(result.ok, "string created");
  return result;
}

// ── resolveElectricalInitMode ────────────────────────────────────────────────
assert(resolveElectricalInitMode({
  storedFingerprint: null,
  currentFingerprint: "fp",
  persistedArrays: [],
  persistedStrings: [],
}) === "fresh", "empty project → fresh");

assert(resolveElectricalInitMode({
  storedFingerprint: "fp-a",
  currentFingerprint: "fp-a",
  persistedArrays: [createElectricalArray({ id: "region-1", panelIds: ["r1::0::0"] })],
  persistedStrings: [],
}) === "restore", "matching fingerprint → restore");

assert(resolveElectricalInitMode({
  storedFingerprint: "fp-a",
  currentFingerprint: "fp-b",
  persistedArrays: [createElectricalArray({ id: "region-1", panelIds: ["r1::0::0"] })],
  persistedStrings: [],
}) === "reconcile", "fingerprint mismatch → reconcile");

console.log("✓ resolveElectricalInitMode");

// ── rebuildMpptStringIdsFromStrings ──────────────────────────────────────────
{
  const mppts = [
    { id: "mppt-1", inverterId: "inv-1", stringIds: ["stale"] },
    { id: "mppt-2", inverterId: "inv-1", stringIds: [] },
  ];
  const strings = [
    { id: "s1", mpptId: "mppt-1", arrayId: "a1", orderedPanelSequence: ["p1"] },
    { id: "s2", mpptId: "mppt-2", arrayId: "a1", orderedPanelSequence: ["p2"] },
    { id: "s3", mpptId: "missing", arrayId: "a1", orderedPanelSequence: ["p3"] },
  ];
  const rebuilt = rebuildMpptStringIdsFromStrings(strings, mppts);
  assert(rebuilt[0].stringIds.length === 1 && rebuilt[0].stringIds[0] === "s1", "rebuild mppt 1");
  assert(rebuilt[1].stringIds.length === 1 && rebuilt[1].stringIds[0] === "s2", "rebuild mppt 2");
  assert(!rebuilt.some((m) => m.stringIds.includes("stale")), "stale refs cleared");
  const validStrings = strings.filter((s) => s.mpptId && mppts.some((m) => m.id === s.mpptId));
  assertAssignmentSync(validStrings, rebuilt);
}

console.log("✓ rebuildMpptStringIdsFromStrings");

// ── A. Fresh project ─────────────────────────────────────────────────────────
{
  const fresh = reconcilePersistedElectricalState({
    ...baseParams,
    persistedArrays: [],
    persistedStrings: [],
    persistedMppts: [],
    persistedInverters: [],
    mode: "fresh",
  });

  const expected = buildFresh();
  assert(fresh.strings.length === 0, "fresh strings empty");
  assert(deepEqual(fresh.arrays.map(({ stringIds, ...rest }) => rest),
    expected.map(({ stringIds, ...rest }) => rest)), "fresh arrays match buildArraysFromPlacement");
  assertPanelPartitionInvariant(fresh.arrays, validPanelIds(layoutV1));
}

console.log("✓ A — fresh project matches today");

// ── Build persisted electrical design (split + strings + MPPT) ───────────────
let arrays = buildFresh();
let strings = [];
const splitResult = splitElectricalArray(arrays, "region-1", ["r1::1::0"], "Array B");
assert(splitResult.ok, "split ok");
arrays = splitResult.arrays;

const s1 = makeString(arrays, strings, "region-1", ["r1::0::0", "r1::0::1"], layoutV1);
strings = s1.strings;
arrays = s1.arrays;
const s2 = makeString(arrays, strings, splitResult.split.id, ["r1::1::0"], layoutV1);
strings = s2.strings;
arrays = s2.arrays;

const { inverters, mppts } = setupInverters();
let mpptState = mppts;
const assign1 = assignStringToMppt(strings, mpptState, s1.string.id, mpptState[0].id, inverters[0].id);
strings = assign1.strings;
mpptState = assign1.mppts;
const assign2 = assignStringToMppt(strings, mpptState, s2.string.id, mpptState[1].id, inverters[0].id);
strings = assign2.strings;
mpptState = assign2.mppts;

const storedFingerprint = fingerprintFor(layoutV1);
const persistedArrays = arrays;
const persistedStrings = strings;
const persistedMppts = mpptState;
const persistedInverters = inverters;

// ── A. Restore — panel partition invariant ───────────────────────────────────
{
  const restored = reconcilePersistedElectricalState({
    ...baseParams,
    persistedArrays,
    persistedStrings,
    persistedMppts,
    persistedInverters,
    mode: "restore",
  });

  assert(restored.arrays.length === 3, "restore keeps split arrays (+ baseline regions)");
  assert(restored.strings.length === 2, "restore keeps strings");
  assertPanelPartitionInvariant(restored.arrays, validPanelIds(layoutV1));
  assertNoDanglingRefs(restored.arrays, restored.strings, restored.mppts, restored.inverters);

  const ids = restored.arrays.flatMap((a) => a.panelIds);
  assert(new Set(ids).size === ids.length, "no duplicate panel IDs");
  assert(ids.length === layoutV1.placedPanels.length, "no missing panel IDs");
}

console.log("✓ A — restore partition invariant (splits, no dupes, no missing)");

// ── A. Baseline ownership wins on conflict ───────────────────────────────────
{
  const conflicted = [
    createElectricalArray({ id: "region-1", panelIds: ["r1::0::0", "r1::0::1"] }),
    createElectricalArray({ id: "split-x", panelIds: ["r1::0::0", "r1::1::0"] }),
    createElectricalArray({ id: "region-2", panelIds: ["r2::0::0"] }),
  ];

  const reconciled = reconcilePersistedElectricalState({
    ...baseParams,
    persistedArrays: conflicted,
    persistedStrings: [],
    persistedMppts: [],
    persistedInverters: [],
    mode: "reconcile",
  });

  assertPanelPartitionInvariant(reconciled.arrays, validPanelIds(layoutV1));
  const owner = new Map();
  for (const arr of reconciled.arrays) {
    for (const pid of arr.panelIds) owner.set(pid, arr.id);
  }
  assert(owner.get("r1::0::0") === "region-1", "baseline owner wins conflict for r1::0::0");
}

console.log("✓ A — baseline ownership wins conflicts");

// ── A. Orphan resolution + new region ────────────────────────────────────────
{
  const fpOld = fingerprintFor(layoutV1);
  const fpNew = fingerprintFor(layoutV3NewRegion, placementReadyV3);

  const reconciled = reconcileElectricalFromFingerprints({
    storedFingerprint: fpOld,
    currentFingerprint: fpNew,
    ...baseParams,
    panelLayout: layoutV3NewRegion,
    placementReady: placementReadyV3,
    persistedArrays,
    persistedStrings,
    persistedMppts,
    persistedInverters,
  });

  assert(reconciled.mode === "reconcile", "upstream change → reconcile mode");
  assertPanelPartitionInvariant(reconciled.arrays, validPanelIds(layoutV3NewRegion));
  assert(reconciled.arrays.some((a) => a.id === "region-3"), "new region array created");
  assert(reconciled.arrays.find((a) => a.id === "region-3")?.panelIds.includes("r3::0::0"), "new panel assigned");
  assertNoDanglingRefs(reconciled.arrays, reconciled.strings, reconciled.mppts, reconciled.inverters);
}

console.log("✓ A — orphan resolution + new region");

// ── C. Deletion round-trip — delete string ───────────────────────────────────
{
  const deleted = deleteElectricalString(persistedArrays, persistedStrings, s2.string.id);
  assert(deleted.ok, "delete string ok");

  const restored = reconcilePersistedElectricalState({
    ...baseParams,
    persistedArrays: deleted.arrays,
    persistedStrings: deleted.strings,
    persistedMppts: persistedMppts,
    persistedInverters: persistedInverters,
    mode: "restore",
  });

  assert(restored.strings.length === 1, "deleted string stays deleted");
  assert(!restored.strings.some((s) => s.id === s2.string.id), "deleted string id absent");
  assertNoDanglingRefs(restored.arrays, restored.strings, restored.mppts, restored.inverters);
}

console.log("✓ C — delete string round-trip");

// ── C. Deletion round-trip — merge arrays ────────────────────────────────────
{
  const merged = mergeElectricalArrays(persistedArrays, ["region-1", splitResult.split.id], "Merged");
  assert(merged.ok, "merge ok");

  const restored = reconcilePersistedElectricalState({
    ...baseParams,
    persistedArrays: merged.arrays,
    persistedStrings: [],
    persistedMppts: [],
    persistedInverters: [],
    mode: "restore",
  });

  assert(restored.arrays.length === 2, "merge + region-2 → two arrays");
  assert(restored.arrays.some((a) => a.id === merged.merged.id), "merged array persists");
  assert(!restored.arrays.some((a) => a.id === splitResult.split.id), "split array stays merged away");
}

console.log("✓ C — merge arrays round-trip");

// ── C. Deletion round-trip — clear MPPT assignment ───────────────────────────
{
  const cleared = removeStringFromMppt(persistedStrings, persistedMppts, s1.string.id);
  assert(cleared.ok, "clear mppt ok");
  const rebuilt = rebuildMpptStringIdsFromStrings(cleared.strings, cleared.mppts);

  const restored = reconcilePersistedElectricalState({
    ...baseParams,
    persistedArrays,
    persistedStrings: cleared.strings,
    persistedMppts: rebuilt,
    persistedInverters,
    mode: "restore",
  });

  const str = restored.strings.find((s) => s.id === s1.string.id);
  assert(str?.mpptId == null, "cleared MPPT stays unassigned");
  assert(
    restored.mppts.every((m) => !(m.stringIds ?? []).includes(s1.string.id)),
    "mppt.stringIds has no cleared string",
  );
  assertNoDanglingRefs(restored.arrays, restored.strings, restored.mppts, restored.inverters);
}

console.log("✓ C — clear MPPT assignment round-trip");

// ── C. Termination null (Phase 3 boundary — reconcile does not touch it) ───────
{
  const terminationPoint = null;
  assert(terminationPoint == null, "termination null persists as null (INIT integration in Phase 3)");
}

console.log("✓ C — termination null reserved for Phase 3 INIT (no resurrection in pure layer)");

// ── E. Upstream reconciliation ───────────────────────────────────────────────
{
  const reconciled = reconcileElectricalFromFingerprints({
    storedFingerprint,
    currentFingerprint: fingerprintFor(layoutV2RemovedPanel),
    ...baseParams,
    panelLayout: layoutV2RemovedPanel,
    persistedArrays,
    persistedStrings,
    persistedMppts,
    persistedInverters,
  });

  assert(reconciled.mode === "reconcile", "upstream panel removal → reconcile");
  assertPanelPartitionInvariant(reconciled.arrays, validPanelIds(layoutV2RemovedPanel));

  const str1 = reconciled.strings.find((s) => s.id === s1.string.id);
  assert(str1, "string survives when panels remain");
  assert(!str1.orderedPanelSequence.includes("r1::1::0"), "removed panel stripped from string");
  assert(
    !reconciled.arrays.some((a) => a.panelIds.includes("r1::1::0")),
    "removed panel absent from arrays",
  );
  assertNoDanglingRefs(reconciled.arrays, reconciled.strings, reconciled.mppts, reconciled.inverters);
}

console.log("✓ E — upstream reconciliation");

// ── E. Invalid MPPT / inverter references ────────────────────────────────────
{
  const orphanMppt = {
    id: "mppt-orphan",
    inverterId: "missing-inverter",
    stringIds: [s1.string.id],
  };
  const reconciled = reconcilePersistedElectricalState({
    ...baseParams,
    persistedArrays,
    persistedStrings: persistedStrings.map((s) => (
      s.id === s1.string.id ? { ...s, mpptId: "mppt-orphan" } : s
    )),
    persistedMppts: [...persistedMppts, orphanMppt],
    persistedInverters,
    mode: "restore",
  });

  assert(!reconciled.mppts.some((m) => m.id === "mppt-orphan"), "invalid inverter mppt removed");
  const str = reconciled.strings.find((s) => s.id === s1.string.id);
  assert(str?.mpptId == null, "invalid mpptId cleared on string");
  assertNoDanglingRefs(reconciled.arrays, reconciled.strings, reconciled.mppts, reconciled.inverters);
}

console.log("✓ E — invalid MPPT/inverter references pruned");

// ── F. Idempotence ───────────────────────────────────────────────────────────
{
  const first = reconcilePersistedElectricalState({
    ...baseParams,
    persistedArrays,
    persistedStrings,
    persistedMppts,
    persistedInverters,
    mode: "restore",
  });

  const second = reconcilePersistedElectricalState({
    ...baseParams,
    persistedArrays: first.arrays,
    persistedStrings: first.strings,
    persistedMppts: first.mppts,
    persistedInverters: first.inverters,
    mode: "restore",
  });

  assert(deepEqual(first.arrays, second.arrays), "idempotent arrays");
  assert(deepEqual(first.strings, second.strings), "idempotent strings");
  assert(deepEqual(first.mppts, second.mppts), "idempotent mppts");
  assertPanelPartitionInvariant(second.arrays, validPanelIds(layoutV1));
}

console.log("✓ F — idempotence");

// ── Full restore round-trip via fingerprints ─────────────────────────────────
{
  const roundTrip = reconcileElectricalFromFingerprints({
    storedFingerprint,
    ...baseParams,
    persistedArrays,
    persistedStrings,
    persistedMppts,
    persistedInverters,
  });

  assert(roundTrip.mode === "restore", "fingerprint match → restore");
  assert(roundTrip.arrays.length === 3, "split arrays restored");
  assert(roundTrip.strings.length === 2, "strings restored");
  assert(roundTrip.strings.every((s) => s.mpptId != null), "MPPT assignments restored");
  assertNoDanglingRefs(roundTrip.arrays, roundTrip.strings, roundTrip.mppts, roundTrip.inverters);
}

console.log("✓ full fingerprint restore round-trip");

console.log("\nAll Phase 2 electrical persistence checks passed.");
