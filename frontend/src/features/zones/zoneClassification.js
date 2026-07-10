/**
 * zoneClassification.js — Step 5A zone classification (renderer-agnostic, pure).
 *
 * Reads the per-cell exposureScore grid produced by Step 4C and classifies each
 * cell into one of FIVE zone classes.  No raycasting, no React, no Three.js.
 *
 * Zone classes (kept as named constants — change them here only):
 *
 *   "excellent" — primary install area          (score ≥ EXCELLENT_MIN)
 *   "good"      — secondary install area        (score ≥ GOOD_MIN)
 *   "average"   — install only if capacity needed (score ≥ AVERAGE_MIN)
 *   "avoid"     — real roof, poor sun           (score ≥ 1, below AVERAGE_MIN)
 *   "blocked"   — panels physically cannot go here.
 *                 DISTINCT from score bands — driven by geometry/rules, not score.
 *                 Current sources: underObstacle (4B/4C).
 *                 Future sources: setback-excluded cells, 5D manual restricted zones.
 *                 All blocked sources fold in through the same "blocked" class.
 *
 * Installable area (5G headline): Excellent + Good.
 * Average is "only if needed" and excluded from the headline figure.
 * Avoid and Blocked never count toward installable area.
 */

// ── Zone thresholds (all in one place) ────────────────────────────────────────
export const ZONE_THRESHOLDS = {
  EXCELLENT_MIN: 85,   // score ≥ 85  → Excellent
  GOOD_MIN:      70,   // score 70–84 → Good
  AVERAGE_MIN:   50,   // score 50–69 → Average
  // score 1–49    → Avoid
  // underObstacle → Blocked (always, regardless of score)
};

// ── Zone class → display metadata (colors used by both panel and heatmap) ─────
export const ZONE_META = {
  excellent: { label: "Excellent",  color: "#22c55e", tailwind: "text-[#22c55e]", bg: "bg-[#22c55e]" },
  good:      { label: "Good",       color: "#86efac", tailwind: "text-[#86efac]", bg: "bg-[#86efac]" },
  average:   { label: "Average",    color: "#eab308", tailwind: "text-[#eab308]", bg: "bg-[#eab308]" },
  avoid:     { label: "Avoid",      color: "#f97316", tailwind: "text-[#f97316]", bg: "bg-[#f97316]" },
  blocked:   { label: "Blocked",    color: "#475569", tailwind: "text-[#475569]", bg: "bg-[#475569]" },
};

// Ordered for display (best → worst, then blocked last).
export const ZONE_ORDER = ["excellent", "good", "average", "avoid", "blocked"];

// ── Cell classification ───────────────────────────────────────────────────────

/**
 * Classify a single cell.
 *
 * @param {{ exposureScore:number, underObstacle?:boolean }} cell
 * @returns {"excellent"|"good"|"average"|"avoid"|"blocked"}
 */
export function classifyCell(cell) {
  // Blocked is a geometry/rule class — checked first, independent of score.
  if (cell.underObstacle) return "blocked";

  const s = cell.exposureScore ?? 0;
  const T = ZONE_THRESHOLDS;
  if (s >= T.EXCELLENT_MIN) return "excellent";
  if (s >= T.GOOD_MIN)      return "good";
  if (s >= T.AVERAGE_MIN)   return "average";
  return "avoid";
}

// ── Per-roof and design-wide zone result ──────────────────────────────────────

/**
 * Build the full zone classification result from the 4C exposure result.
 *
 * Does NOT mutate exposureResult.  Returns a new structure that adds `zoneClass`
 * to each cell and aggregates area-by-class statistics.
 *
 * Cell area = cellSize² m².  All area figures are in m².
 *
 * @param {{ byRoof: Object }} exposureResult   4C output
 * @param {Array}              roofSections     [ { id, name } ]
 *
 * @returns {{
 *   byRoof: {
 *     [roofId]: {
 *       cells: Array<{ x,z, shadePct, underObstacle, exposureScore, zoneClass }>,
 *       cellSize: number,
 *       baseY:    number,
 *       areaByClass: { excellent, good, average, avoid, blocked },  // m²
 *       installableAreaM2: number,  // excellent + good
 *     }
 *   },
 *   totals: { excellent, good, average, avoid, blocked },  // m² each
 *   installableAreaM2: number,  // design-wide headline (5G)
 * }}
 */
export function computeZoneResult(exposureResult, roofSections) {
  const byRoof = {};
  const totals = { excellent: 0, good: 0, average: 0, avoid: 0, blocked: 0 };

  for (const sec of roofSections) {
    const expRoof = exposureResult.byRoof[sec.id];
    if (!expRoof) continue;

    // Pull cell geometry from the shadow-grid side (cellSize / baseY live in
    // shadowResult.byRoof, but exposureResult cells carry the same x/z coords).
    // We need cellSize to compute area.  exposureResult stores it on the roof.
    // If not available, fall back to 1 m.
    const cellSize = expRoof.cellSize ?? 1;
    const baseY    = expRoof.baseY    ?? 0;
    const cellArea = cellSize * cellSize;

    const areaByClass = { excellent: 0, good: 0, average: 0, avoid: 0, blocked: 0 };

    const cells = expRoof.cells.map((c) => {
      const zoneClass = classifyCell(c);
      areaByClass[zoneClass] += cellArea;
      return { ...c, zoneClass };
    });

    const installableAreaM2 = areaByClass.excellent + areaByClass.good;

    byRoof[sec.id] = { cells, cellSize, baseY, areaByClass, installableAreaM2 };

    for (const cls of ZONE_ORDER) totals[cls] += areaByClass[cls];
  }

  const installableAreaM2 = totals.excellent + totals.good;

  return { byRoof, totals, installableAreaM2 };
}
