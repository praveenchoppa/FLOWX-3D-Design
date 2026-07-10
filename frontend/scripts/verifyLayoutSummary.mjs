/**
 * verifyLayoutSummary.mjs — Generated layout summary UI data source tests.
 * Run: npx vite-node scripts/verifyLayoutSummary.mjs
 */

import { computePlacementReady } from "../src/features/zones/placementReady.js";
import { DEFAULT_PROJECT_PANEL_DEFAULTS } from "../src/features/panels/panelConfig.js";
import { GENERATE_MODES } from "../src/features/panels/panelDesignGoal.js";
import { generateMultiAreaPanelLayout } from "../src/features/panels/panelLayoutGenerator.js";
import { applyPanelOverrides } from "../src/features/panels/panelEditorUtils.js";
import { computePanelCapacity } from "../src/features/panels/panelPlacement.js";
import {
  computeGeneratedLayoutSummary,
  buildPlacementAreaLayoutSummaries,
} from "../src/features/panels/panelLayoutSummary.js";
import { getPanelById } from "../src/features/panels/panelTypes.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ROOF = [{
  id: "r1", name: "Main",
  coordinates: [[0, 0], [20, 0], [20, 20], [0, 20]],
  pitch: 10, azimuth: 180,
}];

const pa = {
  id: "pa::r1::a",
  name: "Area A",
  roofId: "r1",
  deleted: false,
  polygon: { outerRing: [[2, 2], [18, 2], [18, 18], [2, 18]], holes: [] },
  panelProperties: { useProjectDefaults: true, override: null },
  stats: { avgScore: 80, quality: "Good", areaM2: 256, usableAreaM2: 240 },
};

const ready = computePlacementReady({
  placementAreas: [pa],
  zoneDisplayList: [],
  businessZones: [],
  obstacles: [],
  roofSections: ROOF,
});

const projectDefaults = {
  ...DEFAULT_PROJECT_PANEL_DEFAULTS,
  designGoal: { type: "capacity", targetCapacityKW: 5 },
};

const generatedLayout = generateMultiAreaPanelLayout(ready, projectDefaults, [pa], {
  generateMode: GENERATE_MODES.CAPACITY,
});

const effectiveLayout = applyPanelOverrides(generatedLayout, { removed: [], added: [] });
const wrongCapacity = computePanelCapacity(effectiveLayout, getPanelById("longi-himo6-550"), ready);
const correctSummary = computeGeneratedLayoutSummary(generatedLayout, [pa]);

assert(generatedLayout.placedPanels.length === 10, "generated snapshot has 10 panels");
assert(
  wrongCapacity.panelCount > correctSummary.panelCount,
  "effective layout over-counts vs generated snapshot",
);
assert(correctSummary.panelCount === 10, "summary reads 10 panels");
assert(Math.abs(correctSummary.systemKw - 5.5) < 0.01, "summary kW from 10×550W");
console.log("✓ Summary reads generated layout not maximum-fit");

const areasWithGl = [{
  ...pa,
  generatedLayout: {
    actualPanelCount: 10,
    actualCapacityKW: 5.5,
    moduleId: "longi-himo6-550",
    orientation: "portrait",
  },
}];
const rows = buildPlacementAreaLayoutSummaries(areasWithGl);
assert(rows.length === 1 && rows[0].panelCount === 10, "per-area layout summary");
console.log("✓ Layout Summary per placement area");

console.log("\nAll layout summary verification tests passed.");
