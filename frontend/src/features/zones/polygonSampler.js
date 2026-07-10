/**
 * polygonSampler.js — Generic polygon cell sampling (pure, read-only).
 *
 * Shared sampling engine for Placement Areas, Engineering Zones (legacy),
 * and future geometry tools. Reads immutable 4C exposure cells + 5A zoneClass.
 *
 * Algorithm (unchanged from original engineeringZoneResampler):
 *   • Include cells whose centres fall inside polygon (outer − holes)
 *   • Exclude underObstacle cells
 *   • Exclude zoneClass "blocked"
 *   • avgScore = rounded mean exposureScore of included cells
 *
 * usableAreaM2 approximation:
 *   installableCellCount × cellSize² — cell-centre coverage, not exact
 *   polygon subtraction. Documented for Placement Area stats.
 */

import { pointInZonePolygon } from "./zoneGeometryUtils.js";

function shoelaceAreaM2(ring) {
  if (!ring || ring.length < 3) return 0;
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return Math.abs(a) / 2;
}

function polygonAreaM2(polygon) {
  const outerA = shoelaceAreaM2(polygon?.outerRing);
  const holesA = (polygon?.holes ?? []).reduce((s, h) => s + shoelaceAreaM2(h), 0);
  return Math.max(0, outerA - holesA);
}

/**
 * @typedef {{
 *   areaM2: number,
 *   usableAreaM2: number,
 *   avgScore: number,
 *   cellCount: number,
 * }} PolygonStatistics
 */

/**
 * Sample immutable simulation cells inside an arbitrary scene-XZ polygon.
 *
 * @param {string} roofId
 * @param {{ outerRing: [number,number][], holes?: [number,number][][] }} polygon
 * @param {object|null} exposureResult  Step 4C (immutable cells)
 * @param {object|null} zoneResult      Step 5A (zoneClass per cell)
 * @returns {PolygonStatistics}
 */
export function samplePolygonStatistics(roofId, polygon, exposureResult, zoneResult) {
  const areaM2 = polygonAreaM2(polygon);

  const expRoof = exposureResult?.byRoof?.[roofId];
  const zoneRoof = zoneResult?.byRoof?.[roofId];
  const cellSize = expRoof?.cellSize ?? zoneRoof?.cellSize ?? 1;
  const cellAreaM2 = cellSize * cellSize;

  if (!expRoof?.cells?.length || !zoneRoof?.cells?.length) {
    return { areaM2, usableAreaM2: 0, avgScore: 0, cellCount: 0 };
  }

  const classByKey = new Map();
  for (const c of zoneRoof.cells) {
    classByKey.set(`${c.x.toFixed(3)},${c.z.toFixed(3)}`, c.zoneClass);
  }

  let scoreSum = 0;
  let cellCount = 0;

  for (const cell of expRoof.cells) {
    if (cell.underObstacle) continue;

    const key = `${cell.x.toFixed(3)},${cell.z.toFixed(3)}`;
    const zoneClass = classByKey.get(key);
    if (zoneClass === "blocked") continue;

    if (!pointInZonePolygon(cell.x, cell.z, polygon)) continue;

    scoreSum += cell.exposureScore ?? 0;
    cellCount += 1;
  }

  const avgScore = cellCount ? Math.round(scoreSum / cellCount) : 0;
  const usableAreaM2 = cellCount * cellAreaM2;

  return { areaM2, usableAreaM2, avgScore, cellCount };
}
