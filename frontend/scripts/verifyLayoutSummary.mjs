/**
 * verifyLayoutSummary.mjs — Generated layout summary UI data source tests.
 * Run: npx vite-node scripts/verifyLayoutSummary.mjs
 */

import { computePlacementReady } from "../src/features/zones/placementReady.js";
import {
  DEFAULT_PROJECT_PANEL_DEFAULTS,
  createPlacementAreaConfigFromTemplate,
} from "../src/features/panels/panelConfig.js";
import { GENERATE_MODES } from "../src/features/panels/panelDesignGoal.js";
import { generateMultiAreaPanelLayout } from "../src/features/panels/panelLayoutGenerator.js";
import { applyPanelOverrides } from "../src/features/panels/panelEditorUtils.js";
import { computePanelCapacity } from "../src/features/panels/panelPlacement.js";
import {
  computeGeneratedLayoutSummary,
  buildPlacementAreaLayoutSummaries,
  buildEngineeringAreaSummaries,
  computeProjectEngineeringSummary,
  AREA_LAYOUT_STATUS,
  AREA_GENERATION_STATUS,
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

const projectDefaults = {
  ...DEFAULT_PROJECT_PANEL_DEFAULTS,
  designGoal: { type: "capacity", targetCapacityKW: 5 },
};

const pa = {
  id: "pa::r1::a",
  name: "Area A",
  roofId: "r1",
  deleted: false,
  polygon: { outerRing: [[2, 2], [18, 2], [18, 18], [2, 18]], holes: [] },
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

const generatedLayout = generateMultiAreaPanelLayout(ready, [pa], {
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
    requestedCapacityKW: 5,
    actualPanelCount: 10,
    actualCapacityKW: 5.5,
    moduleId: "longi-himo6-550",
    orientation: "portrait",
  },
}];
const rows = buildPlacementAreaLayoutSummaries(areasWithGl, generatedLayout);
assert(rows.length === 1 && rows[0].panelCount === 10, "per-area layout summary");
console.log("✓ Layout Summary per placement area");

const engineering = buildEngineeringAreaSummaries(areasWithGl, generatedLayout, ready);
assert(engineering.length === 1, "engineering area rows");
assert(engineering[0].targetCapacityKw === 5, "target capacity from owned config");
assert(engineering[0].generatedCapacityKw === 5.5, "generated capacity from placed panels");
assert(engineering[0].syncStatus === AREA_GENERATION_STATUS.UP_TO_DATE, "sync up to date when config matches snapshot");
assert(engineering[0].capacityStatus === AREA_LAYOUT_STATUS.ACHIEVED, "capacity achieved when generated >= target");
assert(engineering[0].capacityDiffKw != null, "capacity diff shown when synchronized");
assert(engineering[0].tilt != null && engineering[0].mountType, "engineering config fields present");
console.log("✓ Engineering area summaries");

const staleArea = {
  ...areasWithGl[0],
  panelProperties: {
    ...areasWithGl[0].panelProperties,
    designGoal: { type: "capacity", targetCapacityKW: 8 },
  },
};
const staleEngineering = buildEngineeringAreaSummaries([staleArea], generatedLayout, ready);
assert(staleEngineering[0].syncStatus === AREA_GENERATION_STATUS.REGENERATION_REQUIRED, "stale when target changes");
assert(staleEngineering[0].isStale === true, "isStale flag set");
assert(staleEngineering[0].capacityDiffKw == null, "capacity diff hidden when stale");
assert(staleEngineering[0].pendingConfiguration != null, "pending configuration when stale");
console.log("✓ Stale area engineering summaries");

const project = computeProjectEngineeringSummary(areasWithGl, generatedLayout);
assert(project.totalAreas === 1 && project.totalPanels === 10, "project summary totals");
assert(project.averageSolarScore === 80, "average solar score");
assert(project.pendingAreaCount === 0, "no pending areas when synchronized");
console.log("✓ Project engineering summary");

const staleProject = computeProjectEngineeringSummary([staleArea], generatedLayout);
assert(staleProject.pendingAreaCount === 1, "pending area count when stale");
console.log("✓ Project pending area count");

console.log("\nAll layout summary verification tests passed.");
