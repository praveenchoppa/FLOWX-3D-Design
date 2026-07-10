/**
 * Phase 1 professional layout — synthetic verification (run: node scripts/verifyProfessionalLayout.mjs)
 *
 * Policy unit tests run in Node. Full computePanelLayout integration is verified via `npm run build`
 * and browser DevTools (`window.__FLOWX_PANEL_DIAG__`).
 */
import {
  selectProfessionalLayoutSlots,
  findConnectedComponents,
  computeLongestRowLength,
} from "../src/features/panels/panelLayoutPolicy.js";

function slot(regionId, row, col) {
  const slotId = `${regionId}::${row}::${col}`;
  return { slotId, regionId, row, col };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

console.log("── panelLayoutPolicy unit checks ──");

// 3×3 block — no islands removed
{
  const slots = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) slots.push(slot("r1", r, c));
  }
  const result = selectProfessionalLayoutSlots(slots);
  assert(result.defaultRemoved.length === 0, "3×3 block should keep all panels");
  assert(result.metrics.utilization === 1, "3×3 utilization should be 100%");
  assert(result.metrics.isolatedPanelCount === 0, "3×3 should have zero isolated panels");
  assert(computeLongestRowLength(slots) === 3, "longest row should be 3");
  console.log("✓ 3×3 rectangle block");
}

// Single isolated panel removed
{
  const slots = [
    ...Array.from({ length: 5 }, (_, c) => slot("r1", 0, c)),
    slot("r1", 2, 2),
  ];
  const result = selectProfessionalLayoutSlots(slots);
  assert(result.defaultRemoved.length === 1, "single island should be removed");
  assert(result.defaultRemoved[0] === "r1::2::2", "isolated slot id");
  assert(result.metrics.activeSlotCount === 5, "five panels remain");
  console.log("✓ isolated 1-panel island removed");
}

// 2-panel island removed
{
  const slots = [
    ...Array.from({ length: 4 }, (_, c) => slot("r1", 0, c)),
    slot("r1", 3, 0),
    slot("r1", 3, 1),
  ];
  const result = selectProfessionalLayoutSlots(slots);
  assert(result.defaultRemoved.length === 2, "2-panel island removed");
  assert(result.metrics.activeSlotCount === 4, "four panels remain");
  console.log("✓ isolated 2-panel island removed");
}

// L-shape — large connected component preserved
{
  const slots = [
    slot("r1", 0, 0), slot("r1", 0, 1), slot("r1", 0, 2),
    slot("r1", 1, 0),
    slot("r1", 2, 0),
  ];
  const { components } = findConnectedComponents(slots);
  assert(components.length === 1, "L-shape is one component");
  assert(components[0].length === 5, "L-shape has 5 panels");
  const result = selectProfessionalLayoutSlots(slots);
  assert(result.defaultRemoved.length === 0, "L-shape fully preserved");
  console.log("✓ L-shaped connected group preserved");
}

// Broken row geometry (gap in middle) — both segments same component if vertically connected
{
  const slots = [
    slot("r1", 0, 0), slot("r1", 0, 1),
    slot("r1", 0, 3), slot("r1", 0, 4),
    slot("r1", 1, 1), slot("r1", 1, 3),
  ];
  const result = selectProfessionalLayoutSlots(slots);
  assert(result.defaultRemoved.length === 0, "connected broken row kept");
  assert(computeLongestRowLength(slots.filter((s) => !result.defaultRemoved.includes(s.slotId))) === 2,
    "longest row segment is 2");
  console.log("✓ broken row with vertical bridge preserved");
}

console.log("\nAll panelLayoutPolicy checks passed.");
console.log("Full pipeline: run `npm run build` and inspect window.__FLOWX_PANEL_DIAG__ in the app.");
