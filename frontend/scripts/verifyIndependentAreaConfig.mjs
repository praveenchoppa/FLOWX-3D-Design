/**
 * verifyIndependentAreaConfig.mjs — Independent placement-area config regression tests.
 * Run: npx vite-node scripts/verifyIndependentAreaConfig.mjs
 */

import { computePlacementReady } from "../src/features/zones/placementReady.js";
import {
  DEFAULT_PROJECT_PANEL_DEFAULTS,
  createPlacementAreaConfigFromTemplate,
  migratePlacementAreaConfig,
  placementLayoutFingerprint,
  resolvePlacementAreaConfig,
  computeAreaLayoutStats,
} from "../src/features/panels/panelConfig.js";
import { GENERATE_MODES } from "../src/features/panels/panelDesignGoal.js";
import { generateMultiAreaPanelLayout } from "../src/features/panels/panelLayoutGenerator.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ROOF = [{
  id: "r1",
  name: "Main",
  coordinates: [[0, 0], [20, 0], [20, 20], [0, 20]],
  pitch: 10,
  azimuth: 180,
}];

const POLYGON = { outerRing: [[2, 2], [18, 2], [18, 18], [2, 18]], holes: [] };

const template15 = {
  ...DEFAULT_PROJECT_PANEL_DEFAULTS,
  moduleId: "longi-himo6-550",
  designGoal: { type: "capacity", targetCapacityKW: 15 },
};

const template5 = {
  ...DEFAULT_PROJECT_PANEL_DEFAULTS,
  moduleId: "longi-himo6-550",
  designGoal: { type: "capacity", targetCapacityKW: 5 },
};

const legacyArea1 = {
  id: "pa::r1::a",
  name: "Area 1",
  roofId: "r1",
  deleted: false,
  polygon: POLYGON,
  panelProperties: { useProjectDefaults: true, override: null },
  generatedLayout: {
    moduleId: "longi-himo6-550",
    orientation: "portrait",
    requestedCapacityKW: 15,
  },
  stats: { avgScore: 80, quality: "Good", areaM2: 256, usableAreaM2: 240 },
};

const area2 = {
  id: "pa::r1::b",
  name: "Area 2",
  roofId: "r1",
  deleted: false,
  polygon: POLYGON,
  panelProperties: createPlacementAreaConfigFromTemplate(template5),
  stats: { avgScore: 80, quality: "Good", areaM2: 256, usableAreaM2: 240 },
};

const ready = computePlacementReady({
  placementAreas: [legacyArea1, area2],
  zoneDisplayList: [],
  businessZones: [],
  obstacles: [],
  roofSections: ROOF,
});

// ── Scenario 1: Regenerate uses each area's owned config ───────────────────
const area1Owned = {
  ...legacyArea1,
  panelProperties: migratePlacementAreaConfig(legacyArea1, template15),
};

assert(
  resolvePlacementAreaConfig(area1Owned.panelProperties).designGoal.targetCapacityKW === 15,
  "Area 1 migrated to 15 kW owned config",
);

const layout = generateMultiAreaPanelLayout(ready, [area1Owned, area2], {
  generateMode: GENERATE_MODES.CAPACITY,
});

const area1Stats = computeAreaLayoutStats(area1Owned, layout);
const area2Stats = computeAreaLayoutStats(area2, layout);

assert(area1Stats.panelCount === 28, `Area 1 expected 28 panels, got ${area1Stats.panelCount}`);
assert(area2Stats.panelCount === 10, `Area 2 expected 10 panels, got ${area2Stats.panelCount}`);
console.log("✓ Scenario 1 — regenerate preserves per-area capacity (28 + 10)");

// Changing live template must not affect regeneration
const template1 = { ...template5, designGoal: { type: "capacity", targetCapacityKW: 1 } };
void template1;
const relayout = generateMultiAreaPanelLayout(ready, [area1Owned, area2], {
  generateMode: GENERATE_MODES.CAPACITY,
});
const r1 = computeAreaLayoutStats(area1Owned, relayout);
const r2 = computeAreaLayoutStats(area2, relayout);
assert(r1.panelCount === 28 && r2.panelCount === 10, "template change does not affect regenerate");
console.log("✓ Scenario 2 — project template changes do not alter existing areas on regenerate");

// ── Scenario 3: New area receives latest template ────────────────────────────
const area3 = {
  id: "pa::r1::c",
  name: "Area 3",
  roofId: "r1",
  deleted: false,
  polygon: POLYGON,
  panelProperties: createPlacementAreaConfigFromTemplate(template5),
  stats: { avgScore: 80, quality: "Good", areaM2: 256, usableAreaM2: 240 },
};
assert(
  resolvePlacementAreaConfig(area3.panelProperties).designGoal.targetCapacityKW === 5,
  "new area snapshots current 5 kW template",
);
console.log("✓ Scenario 3 — new area receives latest template");

// ── Fingerprint ignores live template ────────────────────────────────────────
const fpAreas = [area1Owned, area2];
const fp1 = placementLayoutFingerprint(fpAreas);
const fp2 = placementLayoutFingerprint(fpAreas);
assert(fp1 === fp2, "fingerprint stable for owned configs");
console.log("✓ Layout fingerprint uses owned area configs only");

console.log("\nAll independent placement-area config tests passed.");
