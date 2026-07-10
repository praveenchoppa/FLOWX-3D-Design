/**
 * zoneMerge.js — Step 5B: merge classified cells into zone region polygons.
 *
 * Pure algorithm — no React, no Three.js.  Reads the per-cell zoneClass grid
 * produced by 5A and returns connected region polygons with holes.
 *
 * Algorithm
 * ─────────
 * 1. Build a mutable grid from the 5A cells (copy only x, z, zoneClass).
 * 2. Absorb tiny regions (< MIN_REGION_CELLS) into the dominant neighbour class
 *    (multi-pass, max 5 iterations).  ABSORB not DELETE — no gaps left behind.
 * 3. Flood-fill (4-connectivity BFS) within each roof to find connected regions.
 * 4. For each region, collect directed boundary edges where the region is on the
 *    LEFT of the edge.  Convention in XZ plane (X=East, Z=South):
 *      top absent:    NW→NE (east)   • right absent: NE→SE (south)
 *      bottom absent: SE→SW (west)   • left absent:  SW→NW (north)
 *    This gives CCW outer rings (positive shoelace area) and CW holes (negative).
 * 5. Trace edges into closed rings.  Classify by signedArea:
 *      positive → outer ring  (matches THREE.Shape convention)
 *      negative → hole ring   (matches THREE.Path / shape.holes convention)
 * 6. Emit { id, roofId, zoneClass, outerRing, holes[], areaM2, cellCount, avgScore }.
 *
 * Coordinates: scene XZ space (X=East, Y=Up, Z=South).
 * outerRing / holes: [[x,z], …] — ready to feed directly into THREE.Shape.
 */

// ── Tunable constants ─────────────────────────────────────────────────────────
/** Regions with fewer cells than this are absorbed into their dominant neighbour. */
export const MIN_REGION_CELLS = 4;

// ── Grid-key helpers ──────────────────────────────────────────────────────────
// We round to 4 decimal places (0.1 mm) to absorb floating-point drift while
// keeping distinct cell centres distinct (cells are ≥ 1 m apart in practice).
const PREC = 4;
const cellKey = (x, z) => `${x.toFixed(PREC)},${z.toFixed(PREC)}`;

// ── Flood-fill ────────────────────────────────────────────────────────────────

/**
 * 4-connectivity BFS flood-fill over a mutable classMap.
 *
 * @param {Map<string,{x:number,z:number,zoneClass:string}>} classMap
 * @param {string[]}  allKeys   ordered key list (stable iteration order)
 * @param {number}    cellSize
 * @returns {Array<{zoneClass:string, cells:Array<{x,z,zoneClass}>}>}
 */
function floodFill(classMap, allKeys, cellSize) {
  const visited = new Set();
  const regions = [];

  for (const key of allKeys) {
    if (visited.has(key)) continue;
    const cell = classMap.get(key);
    if (!cell) continue;

    const cls         = cell.zoneClass;
    const regionCells = [];
    const queue       = [cell];
    visited.add(key);

    while (queue.length) {
      const c = queue.shift();
      regionCells.push(c);
      for (const [dx, dz] of [[cellSize,0],[-cellSize,0],[0,cellSize],[0,-cellSize]]) {
        const nk = cellKey(c.x + dx, c.z + dz);
        if (visited.has(nk)) continue;
        const nc = classMap.get(nk);
        if (nc && nc.zoneClass === cls) {
          visited.add(nk);
          queue.push(nc);
        }
      }
    }

    regions.push({ zoneClass: cls, cells: regionCells });
  }

  return regions;
}

// ── Tiny-region absorption ────────────────────────────────────────────────────

/**
 * Relabel cells of tiny regions (<MIN_REGION_CELLS) to the dominant adjacent
 * class.  Mutates classMap in place.  Runs until stable or after 5 passes.
 */
function absorbTiny(classMap, allKeys, cellSize) {
  for (let pass = 0; pass < 5; pass++) {
    const regions = floodFill(classMap, allKeys, cellSize);
    const tiny    = regions.filter(r => r.cells.length < MIN_REGION_CELLS);
    if (!tiny.length) break;

    for (const region of tiny) {
      const regionKeys    = new Set(region.cells.map(c => cellKey(c.x, c.z)));
      const neighbourCount = {};

      for (const c of region.cells) {
        for (const [dx, dz] of [[cellSize,0],[-cellSize,0],[0,cellSize],[0,-cellSize]]) {
          const nk = cellKey(c.x + dx, c.z + dz);
          const nc = classMap.get(nk);
          if (nc && !regionKeys.has(nk)) {
            neighbourCount[nc.zoneClass] = (neighbourCount[nc.zoneClass] ?? 0) + 1;
          }
        }
      }

      // Pick the most frequent adjacent class; keep original if no neighbours.
      let dominant = region.zoneClass, best = 0;
      for (const [cls, cnt] of Object.entries(neighbourCount)) {
        if (cnt > best) { best = cnt; dominant = cls; }
      }

      // Relabel all cells in the tiny region.
      for (const c of region.cells) {
        classMap.get(cellKey(c.x, c.z)).zoneClass = dominant;
      }
    }
  }
}

// ── Directed boundary-edge extraction ────────────────────────────────────────

/**
 * Emit directed boundary edges for a region so that the region is on the LEFT
 * of each edge.  Edges are in scene XZ.
 *
 * Top absent    → NW→NE : from (cx-h, cz-h) to (cx+h, cz-h)
 * Right absent  → NE→SE : from (cx+h, cz-h) to (cx+h, cz+h)
 * Bottom absent → SE→SW : from (cx+h, cz+h) to (cx-h, cz+h)
 * Left absent   → SW→NW : from (cx-h, cz+h) to (cx-h, cz-h)
 *
 * This convention produces CCW outer rings (positive shoelace area in XZ) and
 * CW hole rings (negative area), matching THREE.Shape / THREE.Path expectations.
 */
function extractEdges(regionCells, cellSize) {
  const regionSet = new Set(regionCells.map(c => cellKey(c.x, c.z)));
  const h         = cellSize / 2;
  const edges     = [];

  for (const { x: cx, z: cz } of regionCells) {
    if (!regionSet.has(cellKey(cx,        cz - cellSize))) // top
      edges.push({ x0: cx-h, z0: cz-h, x1: cx+h, z1: cz-h });
    if (!regionSet.has(cellKey(cx + cellSize, cz)))        // right
      edges.push({ x0: cx+h, z0: cz-h, x1: cx+h, z1: cz+h });
    if (!regionSet.has(cellKey(cx,        cz + cellSize))) // bottom
      edges.push({ x0: cx+h, z0: cz+h, x1: cx-h, z1: cz+h });
    if (!regionSet.has(cellKey(cx - cellSize, cz)))        // left
      edges.push({ x0: cx-h, z0: cz+h, x1: cx-h, z1: cz-h });
  }

  return edges;
}

// ── Ring tracing ──────────────────────────────────────────────────────────────

/**
 * Stitch directed edges into closed polygon rings by following start→end chains.
 * @param {Array<{x0,z0,x1,z1}>} edges
 * @returns {Array<Array<[number,number]>>}  each ring = [[x,z],…] (closed implied)
 */
function traceRings(edges) {
  if (!edges.length) return [];

  // Build start-point → end-point lookup.
  const nextPt = new Map();
  for (const e of edges) {
    nextPt.set(cellKey(e.x0, e.z0), { x: e.x1, z: e.z1 });
  }

  const rings   = [];
  const visited = new Set();
  const limit   = edges.length + 2; // safety cap against infinite loops

  for (const e of edges) {
    const startK = cellKey(e.x0, e.z0);
    if (visited.has(startK)) continue;

    const ring = [];
    let cx = e.x0, cz = e.z0;

    for (let i = 0; i < limit; i++) {
      const k = cellKey(cx, cz);
      if (visited.has(k)) break;
      visited.add(k);
      ring.push([cx, cz]);
      const next = nextPt.get(k);
      if (!next) break;
      if (cellKey(next.x, next.z) === startK) break; // ring closed
      cx = next.x;
      cz = next.z;
    }

    if (ring.length >= 3) rings.push(ring);
  }

  return rings;
}

// ── Shoelace signed area (XZ plane treated as 2-D XY) ────────────────────────
function signedArea(ring) {
  let area = 0;
  const n  = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return area / 2;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Merge the 5A per-cell zone grid into connected region polygons.
 *
 * @param {{ byRoof: Object }} zoneResult   5A output
 * @param {Array}              roofSections [{ id, name }]
 *
 * @returns {{
 *   byRoof: { [roofId]: { regions: Region[], cellSize:number, baseY:number } },
 *   allRegions: Region[],
 * }}
 *
 * Region = {
 *   id, roofId, roofName, zoneClass,
 *   outerRing: [[x,z],…],   // CCW (positive area)
 *   holes:    [[[x,z],…],…], // CW  (negative area) — one per enclosed pocket
 *   areaM2, cellCount, avgScore,
 * }
 */
export function computeZoneMerge(zoneResult, roofSections) {
  const byRoof     = {};
  const allRegions = [];
  let   regionSeq  = 0;

  for (const sec of roofSections) {
    const roof = zoneResult.byRoof[sec.id];
    if (!roof || !roof.cells.length) continue;

    const { cells, cellSize, baseY } = roof;

    // ── 1. Build mutable classMap + original-cell lookup ──────────────────
    const origMap  = new Map();  // key → original cell (immutable, for avgScore)
    const classMap = new Map();  // key → mutable { x, z, zoneClass }
    const allKeys  = [];

    for (const c of cells) {
      const k = cellKey(c.x, c.z);
      origMap.set(k, c);
      classMap.set(k, { x: c.x, z: c.z, zoneClass: c.zoneClass });
      allKeys.push(k);
    }

    // ── 2. Absorb tiny regions ─────────────────────────────────────────────
    absorbTiny(classMap, allKeys, cellSize);

    // ── 3. Flood-fill → connected regions ─────────────────────────────────
    const rawRegions = floodFill(classMap, allKeys, cellSize);

    // ── 4–5. Boundary extraction + ring classification ─────────────────────
    const regions = [];

    for (const raw of rawRegions) {
      const edges = extractEdges(raw.cells, cellSize);
      const rings = traceRings(edges);
      if (!rings.length) continue;

      // Positive area = outer, negative = hole.
      let outerRing = null;
      const holes   = [];

      for (const ring of rings) {
        const area = signedArea(ring);
        if (area > 0) {
          // Take the largest positive-area ring as outer (exactly 1 per connected region).
          if (!outerRing || area > signedArea(outerRing)) {
            if (outerRing) holes.push(outerRing); // demote old outer if superseded
            outerRing = ring;
          } else {
            holes.push(ring);
          }
        } else {
          holes.push(ring);
        }
      }

      if (!outerRing) {
        // All rings CW (negative area) — pick the one with the largest |area|
        // and reverse it to make it CCW.
        rings.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
        outerRing = rings[0].slice().reverse();
        for (let i = 1; i < rings.length; i++) holes.push(rings[i]);
      }

      // ── 6. Statistics ────────────────────────────────────────────────────
      let scoreSum = 0;
      for (const mc of raw.cells) {
        const orig = origMap.get(cellKey(mc.x, mc.z));
        scoreSum += orig?.exposureScore ?? 0;
      }

      const region = {
        id:        `r_${sec.id}_${++regionSeq}`,
        roofId:    sec.id,
        roofName:  sec.name ?? `Roof ${sec.id}`,
        zoneClass: raw.zoneClass,
        outerRing,
        holes,
        cellCount: raw.cells.length,
        areaM2:    raw.cells.length * cellSize * cellSize,
        avgScore:  raw.cells.length ? Math.round(scoreSum / raw.cells.length) : 0,
      };

      regions.push(region);
      allRegions.push(region);
    }

    byRoof[sec.id] = { regions, cellSize, baseY };
  }

  return { byRoof, allRegions };
}
