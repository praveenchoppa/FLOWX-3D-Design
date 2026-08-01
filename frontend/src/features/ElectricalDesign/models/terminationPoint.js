/**
 * terminationPoint.js — P5E user-placed homerun termination (minimal MVP model).
 *
 * Stores scene XZ only. Visual Y is resolved at render/wiring time from roof/ground.
 */

/**
 * @typedef {object} TerminationPoint
 * @property {string} id
 * @property {number} x  Scene X (meters)
 * @property {number} z  Scene Z (meters)
 */

/**
 * @returns {TerminationPoint}
 */
export function createTerminationPoint({ x, z, id = null }) {
  const pointId = id
    ?? (typeof crypto !== "undefined" && crypto.randomUUID
      ? `termination-${crypto.randomUUID()}`
      : `termination-${Date.now()}`);

  return {
    id: pointId,
    x:  Number(x),
    z:  Number(z),
  };
}

/**
 * Replace position while keeping stable id (move / re-place).
 *
 * @param {TerminationPoint|null} existing
 * @param {number} x
 * @param {number} z
 */
export function updateTerminationPointPosition(existing, x, z) {
  if (!existing) return createTerminationPoint({ x, z });
  return { ...existing, x: Number(x), z: Number(z) };
}
