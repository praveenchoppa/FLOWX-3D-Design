/**
 * verifyRoofEdgeDimensions.mjs — CAD-aligned roof edge dimension checks.
 * Run: npx vite-node scripts/verifyRoofEdgeDimensions.mjs
 */

import {
  buildCadRoofEdgeDimensionSpecs,
  buildRoofCadAxesFromCoordinates,
  MIN_ROOF_DIM_LABEL_M,
  readableLabelAngleDeg,
} from "../src/features/measurements/cadDimensionRenderer.js";
import {
  computeRoofEdgeMeasurements,
  normalizeRoofRing,
  pointInRoofRing,
  projectRoofCoordinatesToSceneXZ,
  roofRingSignedArea,
} from "../src/features/measurements/measurementUtils.js";
import { buildCadDimensionSpec } from "../src/features/measurements/cadDimensionRenderer.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function almostEqual(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

const centre = { lat: 12.97, lng: 77.59 };

/** Axis-aligned 10m × 6m rectangle in scene XZ, expressed as lat/lng offsets. */
function rectLatLng(widthM, lengthM) {
  const cosLat = Math.cos((centre.lat * Math.PI) / 180);
  const dLng = (widthM / 2) / (111_320 * cosLat);
  const dLat = (lengthM / 2) / 111_320;
  // CCW in scene XZ (viewed from +Y): SW → NW → NE → SE
  // z = -(lat−centre)·111320 → lower lat = higher z (south)
  return [
    [centre.lat - dLat, centre.lng - dLng], // SW
    [centre.lat + dLat, centre.lng - dLng], // NW
    [centre.lat + dLat, centre.lng + dLng], // NE
    [centre.lat - dLat, centre.lng + dLng], // SE
    [centre.lat - dLat, centre.lng - dLng], // closing duplicate
  ];
}

// ── Normalize ring drops closing duplicate + zero edges ─────────────────────
const projected = projectRoofCoordinatesToSceneXZ(rectLatLng(10, 6), centre);
const normalized = normalizeRoofRing(projected);
assert(normalized.length === 4, "closing duplicate removed");
assert(roofRingSignedArea(normalized) > 0, "rectangle is CCW");

console.log("✓ ring normalization + shoelace winding");

// ── Edge measurements: true lengths, not AABB ────────────────────────────────
const measured = computeRoofEdgeMeasurements(rectLatLng(10, 6), centre);
assert(measured, "measurements produced");
assert(measured.edges.length === 4, "four edges");
const lengths = measured.edges.map((e) => e.lengthM).sort((a, b) => a - b);
assert(almostEqual(lengths[0], 6, 1e-3) && almostEqual(lengths[1], 6, 1e-3), "two 6m edges");
assert(almostEqual(lengths[2], 10, 1e-3) && almostEqual(lengths[3], 10, 1e-3), "two 10m edges");

console.log("✓ edge lengths equal true polygon edges");

// ── Outward normals (PIP verify) ─────────────────────────────────────────────
for (const edge of measured.edges) {
  const sampleIn = {
    x: edge.midpoint.x - edge.outwardNormal.x * 0.05,
    z: edge.midpoint.z - edge.outwardNormal.z * 0.05,
  };
  const sampleOut = {
    x: edge.midpoint.x + edge.outwardNormal.x * 0.05,
    z: edge.midpoint.z + edge.outwardNormal.z * 0.05,
  };
  assert(pointInRoofRing(sampleIn.x, sampleIn.z, measured.ring), "inward sample inside");
  assert(!pointInRoofRing(sampleOut.x, sampleOut.z, measured.ring), "outward sample outside");
}

console.log("✓ outward normals verified with point-in-polygon");

// ── CW polygon flips winding correctly ───────────────────────────────────────
const cwCoords = [...rectLatLng(8, 4)].reverse();
const cwMeasured = computeRoofEdgeMeasurements(cwCoords, centre);
assert(cwMeasured.winding === "cw", "CW winding detected");
for (const edge of cwMeasured.edges) {
  const sampleOut = {
    x: edge.midpoint.x + edge.outwardNormal.x * 0.05,
    z: edge.midpoint.z + edge.outwardNormal.z * 0.05,
  };
  assert(!pointInRoofRing(sampleOut.x, sampleOut.z, cwMeasured.ring), "CW outward still outside");
}

console.log("✓ CW polygons get correct outward normals");

// ── L-shaped roof (concave) ──────────────────────────────────────────────────
const cosLat = Math.cos((centre.lat * Math.PI) / 180);
const toLatLng = (x, z) => [
  centre.lat - z / 111_320,
  centre.lng + x / (111_320 * cosLat),
];
const lShape = [
  toLatLng(0, 0),
  toLatLng(10, 0),
  toLatLng(10, 4),
  toLatLng(4, 4),
  toLatLng(4, 10),
  toLatLng(0, 10),
];
const lMeasured = computeRoofEdgeMeasurements(lShape, centre);
assert(lMeasured && lMeasured.edges.length === 6, "L-shape has 6 edges");
for (const edge of lMeasured.edges) {
  const sampleOut = {
    x: edge.midpoint.x + edge.outwardNormal.x * 0.05,
    z: edge.midpoint.z + edge.outwardNormal.z * 0.05,
  };
  assert(!pointInRoofRing(sampleOut.x, sampleOut.z, lMeasured.ring), `L-edge ${edge.index} outward`);
}

console.log("✓ L-shaped / concave roof outward normals");

// ── Geometry builder: parallel dim lines + offset outward ────────────────────
const axes = buildCadRoofEdgeDimensionSpecs(measured.edges);
assert(axes.length === 4, "four dimension axes");
for (let i = 0; i < axes.length; i++) {
  const edge = measured.edges[i];
  const axis = axes[i];
  const dx = axis.dimensionLine.end.x - axis.dimensionLine.start.x;
  const dz = axis.dimensionLine.end.z - axis.dimensionLine.start.z;
  const dimLen = Math.hypot(dx, dz);
  assert(almostEqual(dimLen, edge.lengthM, 1e-6), "dim line length = edge length");
  const cross = Math.abs(dx * edge.tangent.z - dz * edge.tangent.x);
  assert(cross < 1e-6, "dim line parallel to edge");
  const mid = {
    x: (axis.dimensionLine.start.x + axis.dimensionLine.end.x) / 2,
    z: (axis.dimensionLine.start.z + axis.dimensionLine.end.z) / 2,
  };
  const offsetVec = {
    x: mid.x - edge.midpoint.x,
    z: mid.z - edge.midpoint.z,
  };
  const dot = offsetVec.x * edge.outwardNormal.x + offsetVec.z * edge.outwardNormal.z;
  assert(dot > 0.5, "dim line offset outward");
  assert(typeof axis.labelAngleDeg === "number", "label angle present");
  assert(axis.suppressLabel === (edge.lengthM < MIN_ROOF_DIM_LABEL_M), "short-edge suppress");
}

console.log("✓ buildCadRoofEdgeDimensionSpecs parallel + outward");

// ── Label readability flip ───────────────────────────────────────────────────
assert(almostEqual(readableLabelAngleDeg({ x: 1, z: 0 }), 0, 1e-6), "east readable");
assert(Math.abs(readableLabelAngleDeg({ x: -1, z: 0 })) <= 90, "west flipped into ±90");
assert(Math.abs(readableLabelAngleDeg({ x: 0, z: 1 })) <= 90, "south readable");
assert(Math.abs(readableLabelAngleDeg({ x: 0, z: -1 })) <= 90, "north readable");

console.log("✓ label readability flip");

// ── Shared entry used by both overlays ───────────────────────────────────────
const shared = buildRoofCadAxesFromCoordinates(rectLatLng(10, 6), centre);
assert(shared.length === 4, "shared roof axes entry");

console.log("✓ shared buildRoofCadAxesFromCoordinates");

// ── Rectangle builder unchanged (non-roof regression smoke) ──────────────────
const rectSpec = buildCadDimensionSpec({
  centerX: 0,
  centerZ: 0,
  rotationY: 0,
  widthX: 5,
  lengthY: 3,
});
assert(rectSpec?.width && rectSpec?.length, "rectangle builder still returns width+length");
assert(rectSpec.width.label.includes("5.00"), "rectangle width label unchanged");
assert(rectSpec.length.label.includes("3.00"), "rectangle length label unchanged");

console.log("✓ buildCadDimensionSpec unchanged for non-roof");

console.log("\nAll roof edge dimension verification checks passed.");
