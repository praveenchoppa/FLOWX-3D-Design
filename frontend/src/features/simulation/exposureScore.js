/**
 * exposureScore.js — Step 4C per-cell solar exposure score (renderer-agnostic).
 *
 * Converts the 4B measured shadow grid into a 0–100 solar-quality score per cell
 * by blending two factors (decision 5):
 *
 *   exposureScore = sunAccess × orientationFactor × 100
 *
 *   sunAccess         = 1 − shadePct       (from the 4B raycast pass)
 *   orientationFactor = f(pitch, azimuth, lat)  (this module)
 *
 * Cells flagged `underObstacle` by 4B always score 0 and are non-usable for
 * panel placement (Step 5 zoning consumes this flag directly).
 *
 * All tunable constants are in ORIENTATION_PARAMS — change them there only.
 * No raycasting, no React, no Three.js.  Pure arithmetic on 4B output.
 */

// ── Tunable orientation constants (one place) ─────────────────────────────────
export const ORIENTATION_PARAMS = {
  /**
   * Optimal tilt rule of thumb for rooftop PV:
   *   optimalTilt = max(latDeg × LAT_TILT_FRACTION, MIN_OPTIMAL_TILT)
   * Standard India/tropical value: ≈87 % of latitude.
   */
  LAT_TILT_FRACTION: 0.87,
  MIN_OPTIMAL_TILT:  10,     // °, so equatorial sites still prefer some tilt

  /**
   * Factor for a perfectly flat roof (pitch ≤ 1 °).
   * Flat roofs in India see nearly full daily insolation with only a small
   * diffuse-component penalty vs. the ideal tilted plane → 0.90.
   */
  FLAT_FACTOR: 0.90,

  /**
   * Azimuth component for a roof facing due north (0 ° / 360 °).
   * North-facing surfaces still receive diffuse sky radiation → 0.42.
   * Due south = 1.0; east/west ≈ midpoint between these two.
   */
  NORTH_FACTOR: 0.42,

  /**
   * Floor for the pitch deviation penalty.
   * Even a very badly tilted pitched roof shouldn't lose more than this
   * factor from its orientation alone (combined with azFactor it can still
   * score low, but no single component bottoms out at 0).
   */
  MIN_PITCH_FACTOR: 0.50,
};

// ── Orientation factor ────────────────────────────────────────────────────────

/**
 * Compute the orientation factor (0 – 1) for one roof surface.
 *
 * Model (simple, tunable via ORIENTATION_PARAMS):
 *   • Flat (pitch ≤ 1 °): azimuth irrelevant → FLAT_FACTOR.
 *   • Pitched: azFactor (cosine-interpolated compass) × pitchFactor (linear peak
 *     at optimal tilt, floored at MIN_PITCH_FACTOR).
 *
 * Compass examples (az = degrees from North clockwise):
 *   180 ° (South) → azFactor = 1.00
 *   90 ° / 270 ° (East / West) → azFactor ≈ 0.71
 *   0 ° (North)  → azFactor = NORTH_FACTOR (0.42)
 *
 * @param {number} pitchDeg    tilt from horizontal, 0 = flat, 90 = vertical
 * @param {number} azimuthDeg  compass bearing of roof normal (0=N, 180=S)
 * @param {number} latDeg      site latitude (positive = N hemisphere)
 */
export function orientationFactor(pitchDeg, azimuthDeg, latDeg) {
  const P = ORIENTATION_PARAMS;

  // ── Flat roof: accept sun from all directions ─────────────────────────────
  if (pitchDeg <= 1) return P.FLAT_FACTOR;

  // ── Azimuth component ─────────────────────────────────────────────────────
  // Angular deviation from south (0 = due south, 180 = due north).
  // cos maps:  0° (S) → 1,  ±90° (E/W) → 0,  180° (N) → -1.
  // Rescale to [NORTH_FACTOR, 1.0]:
  //   azFactor = NORTH_FACTOR + (1 − NORTH_FACTOR) × (cos(devRad) × 0.5 + 0.5)
  const devRad = ((azimuthDeg - 180 + 360) % 360) * (Math.PI / 180);
  const azFactor = P.NORTH_FACTOR + (1 - P.NORTH_FACTOR) * (Math.cos(devRad) * 0.5 + 0.5);

  // ── Pitch component ───────────────────────────────────────────────────────
  // 1.0 at optimal tilt; falls off linearly; floor at MIN_PITCH_FACTOR.
  const optTilt  = Math.max(P.LAT_TILT_FRACTION * Math.abs(latDeg), P.MIN_OPTIMAL_TILT);
  const pitchFactor = Math.max(P.MIN_PITCH_FACTOR, 1.0 - Math.abs(pitchDeg - optTilt) / 90.0);

  return azFactor * pitchFactor;
}

// ── Cell scoring ──────────────────────────────────────────────────────────────

/**
 * Score a single cell.
 *
 * @param {{ shadePct:number, underObstacle?:boolean }} cell
 * @param {number} of   precomputed orientationFactor for this roof (0–1)
 * @returns {number}    integer 0–100
 */
export function scoreCell(cell, of) {
  if (cell.underObstacle) return 0;
  return Math.round((1 - cell.shadePct) * of * 100);
}

// ── Per-roof and design-wide summary ─────────────────────────────────────────

/**
 * Build the full exposure-score result from the 4B shadow result.
 *
 * Does NOT mutate shadowResult.  Returns a new object that adds `exposureScore`
 * to each cell (alongside `shadePct` / `underObstacle` from 4B).
 *
 * @param {{ byRoof: Object }} shadowResult  4B output
 * @param {Array}              roofSections  [ { id, name, pitch, azimuth } ]
 * @param {number}             latDeg        site latitude
 *
 * @returns {{
 *   byRoof: {
 *     [roofId]: {
 *       cells: Array<{ x,z, shadePct, underObstacle, exposureScore }>,
 *       avgScore:    number,   // 0–100 mean over ALL cells (incl. under-obstacle = 0)
 *       maxScore:    number,   // best usable cell
 *       minScore:    number,   // worst usable cell
 *       usableCount: number,   // cells not under an obstacle
 *       orientFactor: number,  // the computed orientationFactor for this roof
 *     }
 *   },
 *   best:       { id:string, name:string, avgScore:number } | null,
 *   worst:      { id:string, name:string, avgScore:number } | null,
 *   overallAvg: number,
 * }}
 */
export function computeExposureResult(shadowResult, roofSections, latDeg) {
  const byRoof      = {};
  const summaries   = [];

  for (const sec of roofSections) {
    const shadow = shadowResult.byRoof[sec.id];
    if (!shadow) continue;

    const pitch      = sec.pitch   ?? 0;
    const azimuth    = sec.azimuth ?? 180;
    const of         = orientationFactor(pitch, azimuth, latDeg);

    let sum = 0, usable = 0, maxS = 0, minS = 100;

    const cells = shadow.cells.map((c) => {
      const score = scoreCell(c, of);
      sum += score;
      if (!c.underObstacle) {
        usable++;
        if (score > maxS) maxS = score;
        if (score < minS) minS = score;
      }
      return { ...c, exposureScore: score };
    });

    const count    = cells.length;
    const avgScore = count ? Math.round(sum / count) : 0;

    byRoof[sec.id] = {
      cells,
      avgScore,
      maxScore:    usable ? maxS : 0,
      minScore:    usable ? minS : 0,
      usableCount: usable,
      orientFactor: Math.round(of * 100),  // % — useful for the panel tooltip
      // Geometry metadata forwarded from 4B (needed by 5A zone area calculations).
      cellSize: shadow.cellSize ?? 1,
      baseY:    shadow.baseY   ?? 0,
    };
    summaries.push({ id: sec.id, name: sec.name ?? `Roof ${sec.id}`, avgScore });
  }

  // Best / worst among roofs that have data.
  let best = null, worst = null;
  for (const s of summaries) {
    if (!best  || s.avgScore > best.avgScore)  best  = s;
    if (!worst || s.avgScore < worst.avgScore) worst = s;
  }

  const overallAvg = summaries.length
    ? Math.round(summaries.reduce((a, b) => a + b.avgScore, 0) / summaries.length)
    : 0;

  return { byRoof, best, worst, overallAvg };
}

// ── Score → label / colour helpers (shared by panel + heatmap) ────────────────

/** Descriptive band label for a 0–100 score. */
export function scoreBand(score) {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Good";
  if (score >= 25) return "Average";
  return "Poor";
}

/** Tailwind text-colour class for a score band. */
export function scoreBandColor(score) {
  if (score >= 75) return "text-[#00E38C]";
  if (score >= 50) return "text-[#FFB547]";
  if (score >= 25) return "text-[#FB923C]";
  return "text-[#EF4444]";
}
