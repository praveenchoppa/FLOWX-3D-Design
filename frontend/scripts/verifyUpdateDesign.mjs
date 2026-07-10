/**
 * Update Design Step 0 verification (run: node scripts/verifyUpdateDesign.mjs)
 *
 * Validates engineering zone re-sampling determinism and correctness.
 */
import {
  sampleEngineeringZoneStatistics,
  computeEditedZoneStatisticsOverrides,
} from "../src/features/zones/engineeringZoneResampler.js";
import { classifyCell } from "../src/features/zones/zoneClassification.js";

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function makeCell(x, z, exposureScore, underObstacle = false) {
  const cell = { x, z, shadePct: 0, underObstacle, exposureScore };
  return { ...cell, zoneClass: classifyCell(cell) };
}

function buildFixture({ excellentScores, goodScores, averageScores, cellSize = 1 }) {
  const cells = [];
  let x = 0;
  for (const score of excellentScores) {
    cells.push(makeCell(x++, 0, score));
  }
  x = 0;
  for (const score of goodScores) {
    cells.push(makeCell(x++, 2, score));
  }
  x = 0;
  for (const score of averageScores) {
    cells.push(makeCell(x++, 4, score));
  }

  const exposureResult = {
    byRoof: {
      roof1: { cells, cellSize, baseY: 0 },
    },
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

  return { exposureResult, zoneResult, cells };
}

function meanScore(cells) {
  if (!cells.length) return 0;
  return Math.round(cells.reduce((s, c) => s + c.exposureScore, 0) / cells.length);
}

function makeRegion(id, outerRing, cells, zoneClass = "excellent") {
  const avgScore = meanScore(cells);
  return {
    id,
    roofId: "roof1",
    roofName: "Main",
    zoneClass,
    outerRing,
    holes: [],
    cellCount: cells.length,
    areaM2: cells.length,
    avgScore,
  };
}

console.log("── Update Design Step 0 verification ──\n");

// ── 1. Unedited zone: resample should match stored 5B avgScore ───────────────
{
  const excellentCells = [
    makeCell(0.5, 0.5, 92),
    makeCell(1.5, 0.5, 88),
    makeCell(2.5, 0.5, 90),
    makeCell(0.5, 1.5, 91),
    makeCell(1.5, 1.5, 89),
    makeCell(2.5, 1.5, 93),
  ];
  const { exposureResult, zoneResult } = buildFixture({
    excellentScores: excellentCells.map((c) => c.exposureScore),
    goodScores: [],
    averageScores: [],
  });

  const outerRing = [
    [0, 0], [3, 0], [3, 2], [0, 2],
  ];
  const autoPolygon = { outerRing, holes: [] };
  const region = makeRegion("r1", outerRing, excellentCells);

  const zone = {
    sigKey: "roof1::excellent::1.5,1.0",
    roofId: "roof1",
    id: region.id,
    zoneClass: "excellent",
    effectiveClass: "excellent",
    deleted: false,
    isEngineeringEdited: false,
    avgScore: region.avgScore,
    areaM2: region.areaM2,
    autoPolygon,
    activePlacementPolygon: autoPolygon,
  };

  const stored = region.avgScore;
  const sampled = sampleEngineeringZoneStatistics(
    { ...zone, isEngineeringEdited: true, activePlacementPolygon: autoPolygon },
    exposureResult,
    zoneResult,
  );

  assert(
    Math.abs(sampled.avgScore - stored) <= 1,
    `unedited resample should match 5B avgScore (stored=${stored}, sampled=${sampled.avgScore})`,
  );
  console.log(`✓ unedited zone resample matches 5B avgScore (${stored} → ${sampled.avgScore})`);
}

// ── 2. Expanded zone: avgScore should drop when covering lower-score cells ───
{
  const excellentCells = [
    makeCell(0.5, 0.5, 92),
    makeCell(1.5, 0.5, 90),
    makeCell(2.5, 0.5, 91),
  ];
  const goodCells = [
    makeCell(0.5, 2.5, 75),
    makeCell(1.5, 2.5, 72),
    makeCell(2.5, 2.5, 78),
  ];
  const averageCells = [
    makeCell(0.5, 4.5, 55),
    makeCell(1.5, 4.5, 58),
    makeCell(2.5, 4.5, 52),
  ];

  const allCells = [...excellentCells, ...goodCells, ...averageCells];
  const exposureResult = {
    byRoof: { roof1: { cells: allCells, cellSize: 1, baseY: 0 } },
  };
  const zoneResult = {
    byRoof: {
      roof1: {
        cells: allCells.map((c) => ({ ...c })),
        cellSize: 1,
        baseY: 0,
      },
    },
  };

  const narrowRing = [[0, 0], [3, 0], [3, 1], [0, 1]];
  const wideRing   = [[0, 0], [3, 0], [3, 5], [0, 5]];

  const baseScore = meanScore(excellentCells);
  const zoneNarrow = {
    sigKey: "k1",
    roofId: "roof1",
    isEngineeringEdited: true,
    activePlacementPolygon: { outerRing: narrowRing, holes: [] },
  };
  const zoneWide = {
    ...zoneNarrow,
    activePlacementPolygon: { outerRing: wideRing, holes: [] },
  };

  const narrowStats = sampleEngineeringZoneStatistics(zoneNarrow, exposureResult, zoneResult);
  const wideStats   = sampleEngineeringZoneStatistics(zoneWide, exposureResult, zoneResult);

  assert(narrowStats.avgScore >= 88, `narrow excellent score expected high, got ${narrowStats.avgScore}`);
  assert(wideStats.avgScore < narrowStats.avgScore, `expanded score should drop (${wideStats.avgScore} vs ${narrowStats.avgScore})`);
  assert(wideStats.avgScore < baseScore, "expanded score must not reuse original excellent-only average");
  console.log(`✓ expanded zone lowers avgScore (${narrowStats.avgScore} → ${wideStats.avgScore})`);
}

// ── 3. Determinism: same inputs → identical outputs ─────────────────────────
{
  const { exposureResult, zoneResult } = buildFixture({
    excellentScores: [90, 88, 92, 87],
    goodScores: [75, 73],
    averageScores: [],
  });

  const zone = {
    sigKey: "k2",
    roofId: "roof1",
    isEngineeringEdited: true,
    activePlacementPolygon: { outerRing: [[0, 0], [4, 0], [4, 3], [0, 3]], holes: [] },
  };

  const a = sampleEngineeringZoneStatistics(zone, exposureResult, zoneResult);
  const b = sampleEngineeringZoneStatistics(zone, exposureResult, zoneResult);
  assert(a.avgScore === b.avgScore && a.areaM2 === b.areaM2, "resampler must be deterministic");
  console.log("✓ deterministic resampling (identical avgScore + areaM2)");
}

// ── 4. Idempotent overrides map ──────────────────────────────────────────────
{
  const { exposureResult, zoneResult } = buildFixture({
    excellentScores: [90, 88],
    goodScores: [],
    averageScores: [],
  });

  const displayList = [{
    sigKey: "k3",
    roofId: "roof1",
    deleted: false,
    isEngineeringEdited: true,
    activePlacementPolygon: { outerRing: [[0, 0], [2, 0], [2, 1], [0, 1]], holes: [] },
  }];

  const map1 = computeEditedZoneStatisticsOverrides(displayList, exposureResult, zoneResult);
  const map2 = computeEditedZoneStatisticsOverrides(displayList, exposureResult, zoneResult);
  const s1 = map1.get("k3");
  const s2 = map2.get("k3");
  assert(s1.avgScore === s2.avgScore && s1.areaM2 === s2.areaM2, "override map must be idempotent");
  console.log("✓ idempotent override computation");
}

// ── 5. Unedited zones skipped in override map ────────────────────────────────
{
  const displayList = [
    { sigKey: "clean", isEngineeringEdited: false, deleted: false },
    { sigKey: "dirty", isEngineeringEdited: true, deleted: false, roofId: "roof1",
      activePlacementPolygon: { outerRing: [[0,0],[1,0],[1,1],[0,1]], holes: [] } },
  ];
  const { exposureResult, zoneResult } = buildFixture({ excellentScores: [90], goodScores: [], averageScores: [] });
  const map = computeEditedZoneStatisticsOverrides(displayList, exposureResult, zoneResult);
  assert(!map.has("clean"), "unedited zones must not appear in override map");
  assert(map.has("dirty"), "edited zones must appear in override map");
  console.log("✓ only isEngineeringEdited zones are re-sampled");
}

// ── 6. Blocked / underObstacle cells excluded ────────────────────────────────
{
  const usable = makeCell(0.5, 0.5, 90);
  const blocked = makeCell(1.5, 0.5, 0, true);
  const cells = [usable, blocked];
  const exposureResult = { byRoof: { roof1: { cells, cellSize: 1, baseY: 0 } } };
  const zoneResult = {
    byRoof: { roof1: { cells: cells.map((c) => ({ ...c, zoneClass: classifyCell(c) })), cellSize: 1, baseY: 0 } },
  };
  const zone = {
    roofId: "roof1",
    isEngineeringEdited: true,
    activePlacementPolygon: { outerRing: [[0, 0], [2, 0], [2, 1], [0, 1]], holes: [] },
  };
  const stats = sampleEngineeringZoneStatistics(zone, exposureResult, zoneResult);
  assert(stats.avgScore === 90 && stats.cellCount === 1, "blocked cells must be excluded");
  console.log("✓ underObstacle cells excluded from average");
}

console.log("\nAll Update Design Step 0 checks passed.");
