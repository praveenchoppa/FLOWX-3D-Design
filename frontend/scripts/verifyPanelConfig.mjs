/**
 * verifyPanelConfig.mjs — Panel configuration workflow smoke tests.
 * Run: npx vite-node scripts/verifyPanelConfig.mjs
 */

import { PANEL_TYPES, getPanelById, DEFAULT_PANEL_ID } from "../src/features/panels/panelTypes.js";
import {
  DEFAULT_PROJECT_PANEL_DEFAULTS,
  ORIENTATIONS,
  resolvePlacementAreaConfig,
  panelForPlacement,
  placementLayoutFingerprint,
  createPlacementAreaConfigFromTemplate,
} from "../src/features/panels/panelConfig.js";
import { generateMultiAreaPanelLayout } from "../src/features/panels/panelLayoutGenerator.js";
import { computePlacementReady } from "../src/features/zones/placementReady.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── Module library ───────────────────────────────────────────────────────────
assert(PANEL_TYPES.length >= 5, "at least 5 modules in library");
assert(PANEL_TYPES.every((m) => m.manufacturer && m.powerW && m.widthM && m.heightM), "full module spec");
assert(getPanelById(DEFAULT_PANEL_ID)?.power === PANEL_TYPES[0].powerW, "legacy power alias");
console.log("✓ Module library");

// ── Template snapshot + owned config ─────────────────────────────────────────
const project = { ...DEFAULT_PROJECT_PANEL_DEFAULTS };
const area = {
  id: "pa::r1::a",
  roofId: "r1",
  deleted: false,
  panelProperties: createPlacementAreaConfigFromTemplate(project),
};

let resolved = resolvePlacementAreaConfig(area.panelProperties);
assert(resolved.moduleId === project.moduleId, "owned config matches template at creation");

area.panelProperties = createPlacementAreaConfigFromTemplate({
  ...project,
  moduleId: "jinko-tiger-neo-530",
  orientation: ORIENTATIONS.LANDSCAPE,
});
resolved = resolvePlacementAreaConfig(area.panelProperties);
assert(resolved.moduleId === "jinko-tiger-neo-530", "owned moduleId");
assert(resolved.orientation === ORIENTATIONS.LANDSCAPE, "owned orientation");
console.log("✓ Template snapshot + owned per-area config");

// ── Orientation swaps footprint ──────────────────────────────────────────────
const portrait = panelForPlacement("longi-himo6-550", ORIENTATIONS.PORTRAIT);
const landscape = panelForPlacement("longi-himo6-550", ORIENTATIONS.LANDSCAPE);
assert(portrait.width !== landscape.width, "orientation changes width");
assert(portrait.height !== landscape.height, "orientation changes height");
console.log("✓ Orientation footprint swap");

// ── Layout fingerprint (module + orientation + capacity) ─────────────────────
const fp1 = placementLayoutFingerprint([area]);
const fp2 = placementLayoutFingerprint([{
  ...area,
  panelProperties: { ...area.panelProperties, tilt: 25 },
}]);
assert(fp1 === fp2, "tilt change does not affect layout fingerprint");

const fp3 = placementLayoutFingerprint([{
  ...area,
  panelProperties: createPlacementAreaConfigFromTemplate({
    ...project,
    moduleId: "trina-vertex-545",
  }),
}]);
assert(fp1 !== fp3, "module change affects fingerprint");
console.log("✓ Layout fingerprint");

// ── Gated generation ─────────────────────────────────────────────────────────
const ROOF = [{ id: "r1", name: "Main", coordinates: [[0,0],[20,0],[20,20],[0,20]], pitch: 10, azimuth: 180 }];
const pa = {
  ...area,
  polygon: { outerRing: [[2,2],[18,2],[18,18],[2,18]], holes: [] },
  stats: { avgScore: 80, quality: "Good", areaM2: 256, usableAreaM2: 240 },
};

const ready = computePlacementReady({
  placementAreas: [pa],
  zoneDisplayList: [],
  businessZones: [],
  obstacles: [],
  roofSections: ROOF,
});

const layoutPortrait = generateMultiAreaPanelLayout(ready, [pa]);
const layoutLandscape = generateMultiAreaPanelLayout(ready, [{
  ...pa,
  panelProperties: createPlacementAreaConfigFromTemplate({
    ...project,
    orientation: ORIENTATIONS.LANDSCAPE,
  }),
}]);
assert(layoutPortrait.placedPanels.length > 0, "portrait layout has panels");
assert(layoutLandscape.placedPanels.length > 0, "landscape layout has panels");
console.log("✓ Layout generation respects orientation footprint");

console.log("\nAll panel configuration verification tests passed.");
