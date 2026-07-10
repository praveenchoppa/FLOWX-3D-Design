/**
 * shadowGridRunner.js — Chunked shadow-grid execution (scheduling only).
 *
 * Splits the per-cell raycast loop into batches that yield to the browser
 * between frames.  The raycast math is identical to the synchronous path;
 * only WHEN work runs changes.
 */

import * as THREE from "three";
import { summarizeShade } from "./shadowGrid.js";

/** Cells processed per batch before yielding to the browser. */
export const SHADOW_GRID_BATCH_SIZE = 75;

/** Yield one animation frame so the UI can paint and handle input. */
export function yieldToMainThread() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

/**
 * Raycast one grid cell — identical logic to the original synchronous loop.
 *
 * @param {object} cell
 * @param {number} baseY
 * @param {object} ctx
 */
export function raycastShadowCell(cell, baseY, ctx) {
  const { raycaster, origin, dirs, steps, meshes } = ctx;
  origin.set(cell.x, baseY + 0.05, cell.z);
  let shaded = 0;
  for (let s = 0; s < steps; s++) {
    raycaster.set(origin, dirs[s]);
    if (raycaster.intersectObjects(meshes, false).length > 0) shaded++;
  }
  cell.shadePct = steps ? shaded / steps : 0;
}

/**
 * Process queued raycast cells in batches, reporting progress and honouring cancel.
 *
 * @param {object} plan — output of prepareShadowGridPlan()
 * @param {object} options
 * @param {number} [options.batchSize]
 * @param {(pct:number)=>void} [options.onProgress]
 * @param {()=>boolean} [options.shouldCancel]
 * @returns {Promise<object|null>} shadow result or null if cancelled
 */
export async function runShadowGridBatched(plan, {
  batchSize = SHADOW_GRID_BATCH_SIZE,
  onProgress,
  shouldCancel,
} = {}) {
  const { day, steps, byRoof, allCells, raycastQueue, ctx } = plan;
  const total = raycastQueue.length;
  let done = 0;

  if (total === 0) {
    onProgress?.(100);
    return { day, steps, byRoof, summary: summarizeShade(allCells) };
  }

  for (let i = 0; i < total; i += batchSize) {
    if (shouldCancel?.()) return null;

    const end = Math.min(i + batchSize, total);
    for (let j = i; j < end; j++) {
      const { cell, baseY } = raycastQueue[j];
      raycastShadowCell(cell, baseY, ctx);
      done++;
    }

    onProgress?.(Math.min(99, Math.round((done / total) * 100)));

    if (end < total) {
      await yieldToMainThread();
      if (shouldCancel?.()) return null;
    }
  }

  onProgress?.(100);
  return { day, steps, byRoof, summary: summarizeShade(allCells) };
}

/**
 * Synchronous path — processes the full queue without yielding (tests / parity).
 *
 * @param {object} plan
 * @returns {object} shadow result
 */
export function runShadowGridSync(plan) {
  const { day, steps, byRoof, allCells, raycastQueue, ctx } = plan;
  for (const { cell, baseY } of raycastQueue) {
    raycastShadowCell(cell, baseY, ctx);
  }
  return { day, steps, byRoof, summary: summarizeShade(allCells) };
}

/**
 * Build reusable raycast context (meshes, sun dirs, raycaster).
 * Called once per analysis run.
 */
export function createShadowRaycastContext(scene, day, lat, lng, getSun, getDayTimes, shadowStepMin) {
  const meshes = [];
  scene.traverse((o) => {
    if (o.isMesh && o.userData && o.userData.shadowCaster) meshes.push(o);
  });

  const { sunriseMin, sunsetMin } = getDayTimes(day, lat, lng);
  const dirs = [];
  if (sunriseMin != null && sunsetMin != null) {
    for (let m = sunriseMin; m <= sunsetMin; m += shadowStepMin) {
      const sun = getSun(day, m, lat, lng);
      if (!sun.belowHorizon) {
        dirs.push(new THREE.Vector3(sun.dir.x, sun.dir.y, sun.dir.z).normalize());
      }
    }
  }

  return {
    meshes,
    dirs,
    steps: dirs.length,
    raycaster: new THREE.Raycaster(),
    origin: new THREE.Vector3(),
  };
}
