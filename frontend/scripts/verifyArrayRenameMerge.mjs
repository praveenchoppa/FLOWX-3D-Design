/**
 * verifyArrayRenameMerge.mjs — Pure-function smoke tests for P2 rename + merge.
 */

const DEFAULT_ARRAY_SPACING = {
  panelGapM: 0.02,
  interRowGapM: 0.3,
  edgeClearanceM: 0.3,
  obstacleClearanceM: 0.3,
};

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const baseArray = (id, panelIds, overrides = {}) => ({
  id,
  displayName: `Array ${id}`,
  sourcePlacementAreaId: id,
  panelIds,
  orientation: "portrait",
  tilt: 10,
  spacing: { ...DEFAULT_ARRAY_SPACING },
  stringIds: [],
  ...overrides,
});

function spacingEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.panelGapM === b.panelGapM
    && a.interRowGapM === b.interRowGapM
    && a.edgeClearanceM === b.edgeClearanceM
    && a.obstacleClearanceM === b.obstacleClearanceM
  );
}

function validateMergeCompatibility(arrays, arrayIds) {
  if (!arrayIds?.length || arrayIds.length < 2) {
    return { ok: false, reason: "Select at least two arrays to merge." };
  }
  const selected = arrayIds.map((id) => arrays.find((a) => a.id === id)).filter(Boolean);
  if (selected.length !== arrayIds.length) {
    return { ok: false, reason: "One or more selected arrays could not be found." };
  }
  const [first, ...rest] = selected;
  for (const arr of rest) {
    if (arr.orientation !== first.orientation) {
      return { ok: false, reason: "Arrays cannot be merged because their orientations differ." };
    }
    if (arr.tilt !== first.tilt) {
      return { ok: false, reason: "Arrays cannot be merged because their tilts differ." };
    }
    if (!spacingEqual(arr.spacing, first.spacing)) {
      return { ok: false, reason: "Arrays cannot be merged because their spacing differs." };
    }
  }
  return { ok: true, arrays: selected };
}

function mergeElectricalArrays(arrays, arrayIds, displayName = "Merged Array") {
  const check = validateMergeCompatibility(arrays, arrayIds);
  if (!check.ok) return check;
  const selected = check.arrays;
  const panelIdSet = new Set();
  for (const arr of selected) {
    for (const pid of arr.panelIds) panelIdSet.add(pid);
  }
  const sourceIds = selected.map((a) => a.sourcePlacementAreaId);
  const uniqueSources = new Set(sourceIds.filter(Boolean));
  const sourcePlacementAreaId = uniqueSources.size === 1 ? [...uniqueSources][0] : null;
  const first = selected[0];
  const merged = {
    id: `merged-test`,
    displayName: (displayName ?? "Merged Array").trim() || "Merged Array",
    sourcePlacementAreaId,
    panelIds: [...panelIdSet],
    orientation: first.orientation,
    tilt: first.tilt,
    spacing: { ...first.spacing },
    stringIds: [],
  };
  const removeIds = new Set(arrayIds);
  const nextArrays = [...arrays.filter((a) => !removeIds.has(a.id)), merged];
  return { ok: true, merged, arrays: nextArrays };
}

function renameElectricalArray(arrays, arrayId, displayName) {
  const trimmed = displayName?.trim();
  if (!trimmed) return arrays;
  return arrays.map((a) => (a.id === arrayId ? { ...a, displayName: trimmed } : a));
}

// ── Rename ───────────────────────────────────────────────────────────────────
const arrays = [baseArray("a", ["p1", "p2"]), baseArray("b", ["p3"])];
const renamed = renameElectricalArray(arrays, "a", "South Roof");
assert(renamed[0].displayName === "South Roof", "displayName updated");
assert(renamed[0].id === "a", "id unchanged");
assert(renamed[0].panelIds.length === 2, "panelIds unchanged on rename");

// ── Merge compatible ─────────────────────────────────────────────────────────
const compatA = baseArray("x", ["p1", "p2"]);
const compatB = baseArray("y", ["p3"]);
const mergeOk = mergeElectricalArrays([compatA, compatB], ["x", "y"], "Merged");
assert(mergeOk.ok, "compatible merge succeeds");
assert(mergeOk.merged.panelIds.length === 3, "union panel count");
assert(new Set(mergeOk.merged.panelIds).size === 3, "no duplicate panelIds");
assert(mergeOk.merged.stringIds.length === 0, "stringIds cleared");
assert(mergeOk.arrays.length === 1, "old arrays removed");
assert(
  compatA.panelIds.length + compatB.panelIds.length === mergeOk.merged.panelIds.length,
  "panel count conserved",
);

const badA = baseArray("m1", ["p1"], { orientation: "portrait" });
const badB = baseArray("m2", ["p2"], { orientation: "landscape" });
const blocked = validateMergeCompatibility([badA, badB], ["m1", "m2"]);
assert(!blocked.ok && blocked.reason.includes("orientations differ"), "orientation blocked");

const s1 = baseArray("s1", ["p1"], { sourcePlacementAreaId: "pa-1" });
const s2 = baseArray("s2", ["p2"], { sourcePlacementAreaId: "pa-1" });
assert(mergeElectricalArrays([s1, s2], ["s1", "s2"]).merged.sourcePlacementAreaId === "pa-1", "shared source kept");

const d1 = baseArray("d1", ["p1"], { sourcePlacementAreaId: "pa-1" });
const d2 = baseArray("d2", ["p2"], { sourcePlacementAreaId: "pa-2" });
assert(mergeElectricalArrays([d1, d2], ["d1", "d2"]).merged.sourcePlacementAreaId === null, "mixed source null");

console.log("OK: rename + merge pure-function tests passed");
