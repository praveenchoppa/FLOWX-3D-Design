/**
 * obstacleTypes.js
 *
 * Renderer-agnostic obstacle library + factory — the single source of truth for
 * obstacle type definitions.  No React, no Three.js: Steps 4-6 (simulation /
 * zoning / panels) can import this without pulling in any renderer.
 *
 * Units: all dimensions are in METRES.
 *   width  → X extent (and diameter for cylinders)
 *   length → Z extent
 *   height → Y extent (upward from the roof deck)
 *
 * `shape` ("box" | "cylinder") describes the primitive the 3D view draws.  It is
 * stored only on the library DEFINITION, not on placed obstacles — placed
 * obstacles derive their shape from `type` so the stored data model stays exactly
 * { id, type, roofId, position, width, length, height, scale, rotation }.
 */

export const OBSTACLE_LIBRARY = [
  { type: "Water Tank",         shape: "cylinder", width: 1.0, length: 1.0, height: 1.5 },
  { type: "AC Unit",            shape: "box",      width: 0.8, length: 0.6, height: 0.7 },
  { type: "Vent",               shape: "box",      width: 0.3, length: 0.3, height: 0.4 },
  { type: "Skylight",           shape: "box",      width: 1.0, length: 1.0, height: 0.2 },
  { type: "Solar Water Heater", shape: "box",      width: 2.0, length: 1.0, height: 0.5 },
  { type: "Lift Room",          shape: "box",      width: 2.0, length: 2.0, height: 3.0 },
  { type: "Dish Antenna",       shape: "cylinder", width: 0.6, length: 0.6, height: 0.5 },
  { type: "Custom Object",      shape: "box",      width: 1.0, length: 1.0, height: 1.0 },
];

/** Look up a library definition by its type label. */
export function getObstacleDef(type) {
  return OBSTACLE_LIBRARY.find((d) => d.type === type) || null;
}

// Monotonic counter to disambiguate ids created within the same millisecond.
let _seq = 0;

/**
 * Build a placed-obstacle data object from a library definition.
 *
 * @param {object} def       A OBSTACLE_LIBRARY entry
 * @param {string} roofId    The roof section this obstacle is attached to
 * @param {{x:number,z:number}} position  World-scene metres (relative to design centre)
 * @returns {object} obstacle conforming exactly to the locked data model
 */
export function createObstacle(def, roofId, position) {
  return {
    id:       `obs_${Date.now()}_${_seq++}`,
    type:     def.type,
    roofId,
    position: { x: position.x, z: position.z },
    width:    def.width,
    length:   def.length,
    height:   def.height,
    scale:    1,
    rotation: 0,
  };
}

/** Footprint area of a single obstacle: width × length × scale². */
export function obstacleFootprint(o) {
  return (o.width ?? 0) * (o.length ?? 0) * (o.scale ?? 1) ** 2;
}
