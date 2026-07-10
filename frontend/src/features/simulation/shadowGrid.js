/**
 * shadowGrid.js — Step 4B-1 shadow-heatmap grid helpers (renderer-agnostic).
 *
 * Pure geometry/statistics helpers for the measured shadow analysis: sampling a
 * coarse grid of cells across a roof polygon and summarising the per-cell shade
 * results.  No React, no Three.js — the raycasting itself lives in the 3D layer
 * (RoofView3D), which feeds these cells through a THREE.Raycaster.
 *
 * This is the SEPARATE measured pass (4B); it is unrelated to 4A's GPU
 * shadow-mapping.  The per-cell output is what Step 5 zoning will consume.
 *
 * Coordinate space: world XZ metres (X=East, Z=South), matching the 3D scene.
 */

// Coarse-first defaults (perf guardrails).
export const SHADOW_CELL_SIZE     = 1.0;  // metres per cell (coarse)
export const MAX_CELLS_PER_ROOF   = 1200; // bound raycasts on large roofs
export const SHADOW_STEP_MIN      = 30;   // sun samples every 30 min

/**
 * Sample a grid of cell centres across a polygon's bounding box, keeping only
 * the centres that fall inside the polygon.
 *
 * @param {Array<{x:number,z:number}>} polygon  world-XZ polygon
 * @param {number} cellSize                      cell edge length (m)
 * @param {(x:number,z:number)=>boolean} isInside point-in-polygon predicate
 * @returns {Array<{x:number,z:number}>} cell centres
 */
export function sampleGridCells(polygon, cellSize, isInside) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const cells = [];
  for (let x = minX + cellSize / 2; x < maxX; x += cellSize) {
    for (let z = minZ + cellSize / 2; z < maxZ; z += cellSize) {
      if (isInside(x, z)) cells.push({ x, z });
    }
  }
  return cells;
}

/**
 * Choose a cell size that keeps the cell count under `cap`, sampling once at the
 * base size and (if needed) re-sampling once at a proportionally larger size.
 *
 * @returns {{ size:number, cells:Array<{x:number,z:number}> }}
 */
export function chooseCellSize(polygon, baseSize, cap, isInside) {
  let size = baseSize;
  let cells = sampleGridCells(polygon, size, isInside);
  if (cells.length > cap) {
    size = baseSize * Math.sqrt(cells.length / cap);
    cells = sampleGridCells(polygon, size, isInside);
  }
  return { size, cells };
}

/**
 * Roof-level summary from per-cell shade fractions (0..1).
 * @param {Array<{shadePct:number}>} cells
 * @returns {{ min:number, max:number, avg:number, count:number }}
 */
export function summarizeShade(cells) {
  if (!cells.length) return { min: 0, max: 0, avg: 0, count: 0 };
  let min = 1, max = 0, sum = 0;
  for (const c of cells) {
    const p = c.shadePct;
    if (p < min) min = p;
    if (p > max) max = p;
    sum += p;
  }
  return { min, max, avg: sum / cells.length, count: cells.length };
}
