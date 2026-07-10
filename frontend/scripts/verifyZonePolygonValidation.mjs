/**
 * Engineering polygon validation checks (run: node scripts/verifyZonePolygonValidation.mjs)
 */
import {
  polygon as turfPolygon,
  booleanWithin,
} from "@turf/turf";

const ROOF_CONTAINMENT_TOLERANCE_M = 0.05;

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distPointToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-12) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function distPointToRing(px, pz, ring) {
  let min = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    min = Math.min(min, distPointToSegment(px, pz, ax, az, bx, bz));
  }
  return min;
}

function vertexWithinRoofBoundary(x, z, roofRing, toleranceM) {
  if (pointInRing(x, z, roofRing)) return true;
  return distPointToRing(x, z, roofRing) <= toleranceM + 1e-9;
}

function isWithinRoofBoundary(engRing, roofRing) {
  const close = (ring) => {
    const pts = ring.map(([x, z]) => [x, z]);
    pts.push([pts[0][0], pts[0][1]]);
    return pts;
  };
  const engPoly  = turfPolygon([close(engRing)]);
  const roofPoly = turfPolygon([close(roofRing)]);
  if (booleanWithin(engPoly, roofPoly)) return true;
  for (const [x, z] of engRing) {
    if (!vertexWithinRoofBoundary(x, z, roofRing, ROOF_CONTAINMENT_TOLERANCE_M)) return false;
  }
  return true;
}

const roofRing = [[-10, -10], [10, -10], [10, 10], [-10, 10]];

console.log("── zone polygon validation ──\n");
console.log(`  tolerance: ${ROOF_CONTAINMENT_TOLERANCE_M} m\n`);

{
  const eng = [[-8, -8], [8, -8], [8, 8], [-8, 8]];
  assert(isWithinRoofBoundary(eng, roofRing), "interior polygon should pass");
  console.log("✓ clearly inside roof → accepted");
}

{
  const overshoot = ROOF_CONTAINMENT_TOLERANCE_M * 0.6;
  const eng = [[-8, -8], [10 + overshoot, -8], [10 + overshoot, 8], [-8, 8]];
  assert(isWithinRoofBoundary(eng, roofRing), `overshoot ${overshoot} m should pass`);
  console.log(`✓ boundary overshoot ${(overshoot * 100).toFixed(0)} cm → accepted (tolerance)`);
}

{
  const eng = [[11, -8], [13, -8], [13, 8], [11, 8]];
  assert(!isWithinRoofBoundary(eng, roofRing), "polygon 1 m outside should fail");
  console.log("✓ clearly outside roof → rejected");
}

{
  const overshoot = ROOF_CONTAINMENT_TOLERANCE_M * 2.5;
  const eng = [[-8, -8], [10 + overshoot, -8], [10 + overshoot, 8], [-8, 8]];
  assert(!isWithinRoofBoundary(eng, roofRing), `overshoot ${overshoot} m should fail`);
  console.log(`✓ overshoot ${(overshoot * 100).toFixed(0)} cm (> tolerance) → rejected`);
}

console.log("\nAll zone polygon validation checks passed.");
