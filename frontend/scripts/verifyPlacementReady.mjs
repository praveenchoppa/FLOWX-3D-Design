/**
 * verifyPlacementReady.mjs — smoke tests for Placement Area retarget (Step 5H).
 *
 * Run: node scripts/verifyPlacementReady.mjs
 */

import { computePlacementReady } from "../src/features/zones/placementReady.js";

const ROOF = [{
  id: "roof-1",
  name: "Main",
  coordinates: [[0, 0], [20, 0], [20, 20], [0, 20]],
  pitch: 10,
  azimuth: 180,
}];

const SQUARE = {
  outerRing: [[2, 2], [18, 2], [18, 18], [2, 18]],
  holes: [],
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── Test 1: Placement Areas become installable source ───────────────────────
const pa = {
  id: "pa::roof-1::test-1",
  name: "Area A",
  roofId: "roof-1",
  deleted: false,
  polygon: SQUARE,
  stats: { avgScore: 82, quality: "Good", areaM2: 256, usableAreaM2: 240 },
};

const withPA = computePlacementReady({
  placementAreas: [pa],
  zoneDisplayList: [],
  businessZones: [],
  obstacles: [],
  roofSections: ROOF,
});

assert(withPA.summary.source === "placementAreas", "source should be placementAreas");
assert(withPA.installableRegions.length === 1, "expect one installable region");
assert(withPA.installableRegions[0].id === pa.id, "single piece keeps bare area id");
assert(withPA.installableRegions[0].avgScore === 82, "avgScore from placement area stats");
assert(withPA.installableRegions[0].zoneClass === "good", "zoneClass mapped from quality");
console.log("✓ Test 1 — Placement Areas drive installableRegions");

// ── Test 2: Physical obstacle blocking (unchanged pipeline) ─────────────────
const tank = {
  id: "obs-tank",
  type: "Water Tank",
  roofId: "roof-1",
  position: { x: 10, z: 10 },
  width: 2,
  length: 2,
  height: 1.5,
  scale: 1,
  rotation: 0,
};

const withTank = computePlacementReady({
  placementAreas: [pa],
  zoneDisplayList: [],
  businessZones: [],
  obstacles: [tank],
  roofSections: ROOF,
});

assert(withTank.blockedRegions.some((b) => b.source === "obstacle"), "obstacle in blockedRegions");
assert(withTank.blockedRegions.some((b) => b.label === "Water Tank"), "obstacle label preserved");
console.log("✓ Test 2 — Obstacle subtraction unchanged");

// ── Test 3: No quality-based blocking (Avoid zones ignored) ─────────────────
const avoidZone = {
  id: "sim-avoid-1",
  roofId: "roof-1",
  deleted: false,
  effectiveClass: "avoid",
  engineeringPolygon: {
    outerRing: [[5, 5], [15, 5], [15, 15], [5, 15]],
    holes: [],
  },
};

const withAvoid = computePlacementReady({
  placementAreas: [pa],
  zoneDisplayList: [avoidZone],
  businessZones: [],
  obstacles: [],
  roofSections: ROOF,
});

assert(
  !withAvoid.blockedRegions.some((b) => b.source === "avoid"),
  "Avoid sim zones must not appear in blockedRegions",
);
console.log("✓ Test 3 — Quality zones do not block placement");

// ── Test 4: Fallback when no placement areas ──────────────────────────────
const engZone = {
  id: "sim-good-1",
  roofId: "roof-1",
  deleted: false,
  effectiveClass: "good",
  zoneClass: "good",
  autoPolygon: SQUARE,
  avgScore: 75,
  displayName: "Good A",
};

const fallback = computePlacementReady({
  placementAreas: [],
  zoneDisplayList: [engZone],
  businessZones: [],
  obstacles: [],
  roofSections: ROOF,
});

assert(fallback.summary.source === "engineering", "fallback source is engineering");
assert(fallback.installableRegions.length >= 1, "engineering path produces regions");
assert(fallback.installableRegions[0].id.startsWith("eng::"), "engineering region id format");
console.log("✓ Test 4 — Engineering fallback when no placement areas");

// ── Test 5: Placement areas exclusive (ignore engineering when present) ─────
const mixed = computePlacementReady({
  placementAreas: [pa],
  zoneDisplayList: [engZone],
  businessZones: [],
  obstacles: [],
  roofSections: ROOF,
});

assert(
  mixed.installableRegions.every((r) => r.id === pa.id || r.id.startsWith(`${pa.id}::`)),
  "only placement area ids when placement areas exist",
);
console.log("✓ Test 5 — Placement Areas exclusive over engineering");

// ── Test 6: Split region ids ────────────────────────────────────────────────
const biz = {
  id: "biz-1",
  roofId: "roof-1",
  deleted: false,
  businessType: "Maintenance",
  name: "Maint",
  outerRing: [[8, 2], [12, 2], [12, 18], [8, 18]],
};

const split = computePlacementReady({
  placementAreas: [pa],
  zoneDisplayList: [],
  businessZones: [biz],
  obstacles: [],
  roofSections: ROOF,
});

assert(split.blockedRegions.some((b) => b.source === "business"), "business zone in blockedRegions");
if (split.installableRegions.length >= 2) {
  assert(
    split.installableRegions.every((r) => r.id.includes("::")),
    "multi-piece ids use :: suffix",
  );
} else {
  assert(split.installableRegions[0]?.id === pa.id, "single piece keeps bare area id");
}
console.log("✓ Test 6 — Business zone subtract + region id convention");

console.log("\nAll placementReady verification tests passed.");
