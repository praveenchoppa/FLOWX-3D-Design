/**
 * Placement Area statistics verification (run: node scripts/verifyPlacementAreaStats.mjs)
 */
import { samplePolygonStatistics } from "../src/features/zones/polygonSampler.js";
import { sampleEngineeringZoneStatistics } from "../src/features/zones/engineeringZoneResampler.js";
import {
  computePlacementAreaStats,
  qualityFromAvgScore,
} from "../src/features/placementAreas/placementAreaStatistics.js";
import { classifyCell } from "../src/features/zones/zoneClassification.js";

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function makeCell(x, z, exposureScore, underObstacle = false) {
  const cell = { x, z, shadePct: 0, underObstacle, exposureScore };
  return { ...cell, zoneClass: classifyCell(cell) };
}

function buildFixture(cells, cellSize = 1) {
  const exposureResult = {
    byRoof: { roof1: { cells, cellSize, baseY: 0 } },
  };
  const zoneResult = {
    byRoof: {
      roof1: {
        cells: cells.map((c) => ({ ...c })),
        cellSize,
        baseY: 0,
      },
    },
  };
  return { exposureResult, zoneResult };
}

console.log("── Placement Area statistics verification ──\n");

// ── 1. Single Excellent region ─────────────────────────────────────────────
{
  const cells = [
    makeCell(0.5, 0.5, 92),
    makeCell(1.5, 0.5, 94),
    makeCell(0.5, 1.5, 91),
    makeCell(1.5, 1.5, 93),
  ];
  const { exposureResult, zoneResult } = buildFixture(cells);
  const polygon = {
    outerRing: [[0, 0], [2, 0], [2, 2], [0, 2]],
    holes: [],
  };

  const stats = samplePolygonStatistics("roof1", polygon, exposureResult, zoneResult);
  assert(stats.avgScore === 93, `excellent-only avgScore expected 93, got ${stats.avgScore}`);
  assert(stats.cellCount === 4, `expected 4 cells, got ${stats.cellCount}`);
  assert(stats.usableAreaM2 === 4, `usableAreaM2 expected 4, got ${stats.usableAreaM2}`);
  console.log("✓ Single Excellent region — avgScore", stats.avgScore);
}

// ── 2. Blended Excellent + Good (primary correctness test) ───────────────────
{
  const cells = [
    makeCell(0.5, 0.5, 90),
    makeCell(1.5, 0.5, 88),
    makeCell(0.5, 1.5, 72),
    makeCell(1.5, 1.5, 74),
  ];
  const { exposureResult, zoneResult } = buildFixture(cells);
  const polygon = {
    outerRing: [[0, 0], [2, 0], [2, 2], [0, 2]],
    holes: [],
  };

  const stats = samplePolygonStatistics("roof1", polygon, exposureResult, zoneResult);
  assert(stats.avgScore === 81, `blended avgScore expected 81, got ${stats.avgScore}`);
  const quality = qualityFromAvgScore(stats.avgScore);
  assert(quality === "Good", `quality expected Good, got ${quality}`);
  console.log("✓ Excellent + Good blend — avgScore", stats.avgScore, "quality", quality);
}

// ── 3. Obstacle cells reduce usable area ─────────────────────────────────────
{
  const cells = [
    makeCell(0.5, 0.5, 90),
    makeCell(1.5, 0.5, 90),
    makeCell(0.5, 1.5, 90, true),
    makeCell(1.5, 1.5, 90),
  ];
  const { exposureResult, zoneResult } = buildFixture(cells);
  const polygon = {
    outerRing: [[0, 0], [2, 0], [2, 2], [0, 2]],
    holes: [],
  };

  const stats = samplePolygonStatistics("roof1", polygon, exposureResult, zoneResult);
  assert(stats.cellCount === 3, `expected 3 installable cells, got ${stats.cellCount}`);
  assert(stats.usableAreaM2 === 3, `usableAreaM2 expected 3, got ${stats.usableAreaM2}`);
  assert(stats.areaM2 === 4, `polygon areaM2 expected 4, got ${stats.areaM2}`);
  assert(stats.usableAreaM2 < stats.areaM2, "usable must be less than total when obstacle inside");
  console.log("✓ Obstacle inside polygon — usable", stats.usableAreaM2, "< area", stats.areaM2);
}

// ── 4. Engineering zone sampler still works via shared engine ────────────────
{
  const cells = [makeCell(0.5, 0.5, 88), makeCell(1.5, 0.5, 86)];
  const { exposureResult, zoneResult } = buildFixture(cells);
  const zone = {
    roofId: "roof1",
    autoPolygon: {
      outerRing: [[0, 0], [2, 0], [2, 1], [0, 1]],
      holes: [],
    },
  };
  const eng = sampleEngineeringZoneStatistics(zone, exposureResult, zoneResult);
  assert(eng.avgScore === 87, `engineering avgScore expected 87, got ${eng.avgScore}`);
  assert(eng.cellCount === 2, `engineering cellCount expected 2, got ${eng.cellCount}`);
  console.log("✓ Engineering zone sampler unchanged — avgScore", eng.avgScore);
}

// ── 5. Placement area stats object shape ────────────────────────────────────
{
  const cells = [makeCell(0.5, 0.5, 95)];
  const { exposureResult, zoneResult } = buildFixture(cells);
  const area = {
    roofId: "roof1",
    deleted: false,
    polygon: { outerRing: [[0, 0], [1, 0], [1, 1], [0, 1]], holes: [] },
  };
  const stats = computePlacementAreaStats(area, exposureResult, zoneResult);
  assert(stats.areaM2 === 1, "stats.areaM2");
  assert(stats.usableAreaM2 === 1, "stats.usableAreaM2");
  assert(stats.avgScore === 95, "stats.avgScore");
  assert(stats.quality === "Excellent", "stats.quality");
  console.log("✓ Placement area stats shape OK");
}

console.log("\nAll placement area statistics checks passed.");
