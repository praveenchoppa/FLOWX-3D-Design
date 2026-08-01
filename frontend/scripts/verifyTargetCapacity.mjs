/**
 * verifyTargetCapacity.mjs — Target capacity placement smoke tests.
 * Run: npx vite-node scripts/verifyTargetCapacity.mjs
 */

import { computePlacementReady } from "../src/features/zones/placementReady.js";
import {
  DEFAULT_PROJECT_PANEL_DEFAULTS,
  createPlacementAreaConfigFromTemplate,
} from "../src/features/panels/panelConfig.js";
import {
  requiredPanelsForCapacity,
  computeCapacityPreview,
  GENERATE_MODES,
} from "../src/features/panels/panelDesignGoal.js";
import { generateMultiAreaPanelLayout } from "../src/features/panels/panelLayoutGenerator.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ROOF = [{
  id: "r1", name: "Main",
  coordinates: [[0, 0], [20, 0], [20, 20], [0, 20]],
  pitch: 10, azimuth: 180,
}];

const SQUARE = { outerRing: [[2, 2], [18, 2], [18, 18], [2, 18]], holes: [] };

const projectDefaults = {
  ...DEFAULT_PROJECT_PANEL_DEFAULTS,
  moduleId: "longi-himo6-550",
  designGoal: { type: "capacity", targetCapacityKW: 20 },
};

const pa = {
  id: "pa::r1::a",
  name: "Area A",
  roofId: "r1",
  deleted: false,
  polygon: SQUARE,
  panelProperties: createPlacementAreaConfigFromTemplate(projectDefaults),
  stats: { avgScore: 80, quality: "Good", areaM2: 256, usableAreaM2: 240 },
};

const ready = computePlacementReady({
  placementAreas: [pa],
  zoneDisplayList: [],
  businessZones: [],
  obstacles: [],
  roofSections: ROOF,
});

// ── Required panel math ──────────────────────────────────────────────────────
assert(requiredPanelsForCapacity(20, 550) === 37, "20 kW / 550W = 37 panels");
console.log("✓ Required panel calculation");

// ── Preview ──────────────────────────────────────────────────────────────────
const preview = computeCapacityPreview(ready, pa);
assert(preview.requiredPanels === 37, "preview required panels");
assert(preview.maxPanels > 37, "more than 37 fit in test area");
assert(preview.achievable, "20 kW achievable");
console.log("✓ Capacity preview");

// ── Target capacity placement (exact count, not full fill) ───────────────────
const layout = generateMultiAreaPanelLayout(ready, [pa], {
  generateMode: GENERATE_MODES.CAPACITY,
});
assert(layout.placedPanels.length === 37, `expected 37 panels, got ${layout.placedPanels.length}`);
assert(layout.placedPanels.length < preview.maxPanels, "remaining space left empty");
console.log("✓ Target capacity trims to required panels");

// ── Exceeding target does not silently fill ──────────────────────────────────
const exceedsTargetKW = Math.ceil((preview.maxPanels * 550) / 1000) + 5;
const exceedsArea = {
  ...pa,
  panelProperties: createPlacementAreaConfigFromTemplate({
    ...projectDefaults,
    designGoal: { type: "capacity", targetCapacityKW: exceedsTargetKW },
  }),
};
const exceedsPreview = computeCapacityPreview(ready, exceedsArea);
assert(exceedsPreview.exceeds, `${exceedsTargetKW} kW exceeds area (needs ${exceedsPreview.requiredPanels}, max ${exceedsPreview.maxPanels})`);
const exceedsLayout = generateMultiAreaPanelLayout(ready, [exceedsArea], {
  generateMode: GENERATE_MODES.CAPACITY,
});
assert(exceedsLayout.placedPanels.length === 0, "no silent partial fill when exceeding");
console.log("✓ Exceeding target produces zero panels in capacity mode");

// ── Generate maximum fills all ───────────────────────────────────────────────
const maxLayout = generateMultiAreaPanelLayout(ready, [exceedsArea], {
  generateMode: GENERATE_MODES.MAXIMUM,
});
assert(maxLayout.placedPanels.length === exceedsPreview.maxPanels, "maximum fills all slots");
console.log("✓ Generate maximum workflow");

// ── Actual capacity = panels × power ─────────────────────────────────────────
const actualKw = (layout.placedPanels.length * 550) / 1000;
assert(Math.abs(actualKw - 20.35) < 0.01, `actual kW ${actualKw} from 37×550W`);
console.log("✓ Actual capacity from panel count");

console.log("\nAll target capacity verification tests passed.");
