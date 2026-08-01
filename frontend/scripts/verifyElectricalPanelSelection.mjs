/**
 * verifyElectricalPanelSelection.mjs — P2b panel selection pure logic tests.
 * Run: npx vite-node scripts/verifyElectricalPanelSelection.mjs
 */

import {
  canPickPanelsInActiveArray,
  filterValidPanelIds,
  isPanelInArray,
  panelSlotKey,
} from "../src/features/ElectricalDesign/utils/panelSelectionUtils.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const arrayA = {
  id: "arr-a",
  panelIds: ["r1::0::0", "r1::0::1", "r1::1::0"],
};

assert(panelSlotKey({ slotId: "r1::0::0", id: "r1::0::0" }) === "r1::0::0", "panelSlotKey prefers slotId");
assert(isPanelInArray("r1::0::1", arrayA), "panel in array");
assert(!isPanelInArray("r1::9::9", arrayA), "panel not in array");

assert(
  canPickPanelsInActiveArray("arr-a", ["arr-a"]),
  "can pick when single array matches active",
);
assert(
  !canPickPanelsInActiveArray("arr-a", ["arr-a", "arr-b"]),
  "cannot pick during multi-array merge select",
);
assert(
  !canPickPanelsInActiveArray(null, ["arr-a"]),
  "cannot pick without active array",
);

const pruned = filterValidPanelIds(["r1::0::0", "stale::1::1", "r1::1::0"], arrayA);
assert(pruned.length === 2 && pruned.includes("r1::0::0"), "stale ids pruned");

console.log("✓ panelSelectionUtils");

// Reducer-style transition checks (inline mirror of electricalStore rules)
function selectPanelReducer(state, panelId, additive) {
  const activeArray = state.arrays.find((a) => a.id === state.activeArrayId);
  if (!canPickPanelsInActiveArray(state.activeArrayId, state.selectedArrayIds)) return state;
  if (!isPanelInArray(panelId, activeArray)) return state;

  if (additive) {
    const has = state.selectedElectricalPanelIds.includes(panelId);
    return {
      ...state,
      selectedElectricalPanelIds: has
        ? state.selectedElectricalPanelIds.filter((id) => id !== panelId)
        : [...state.selectedElectricalPanelIds, panelId],
    };
  }

  const isOnly = state.selectedElectricalPanelIds.length === 1
    && state.selectedElectricalPanelIds[0] === panelId;
  if (isOnly) return state;

  return { ...state, selectedElectricalPanelIds: [panelId] };
}

let state = {
  arrays: [arrayA],
  selectedArrayIds: ["arr-a"],
  activeArrayId: "arr-a",
  selectedElectricalPanelIds: [],
};

state = selectPanelReducer(state, "r1::0::0", false);
assert(state.selectedElectricalPanelIds.length === 1, "plain click selects one");

state = selectPanelReducer(state, "r1::0::1", true);
assert(state.selectedElectricalPanelIds.length === 2, "ctrl adds second");

state = selectPanelReducer(state, "r1::0::1", true);
assert(state.selectedElectricalPanelIds.length === 1, "ctrl toggles off");

state = selectPanelReducer(state, "outside::0::0", false);
assert(state.selectedElectricalPanelIds.length === 1, "outside array ignored");

state = {
  ...state,
  selectedArrayIds: ["arr-a", "arr-b"],
  activeArrayId: null,
  selectedElectricalPanelIds: ["r1::0::0"],
};
state = selectPanelReducer(state, "r1::0::1", false);
assert(state.selectedElectricalPanelIds.length === 1, "multi-array select blocks pick changes");

console.log("✓ selection reducer rules");

console.log("\nAll electrical panel selection verification tests passed.");
