/**
 * cadDimensionRenderer.js — CAD dimension line geometry (renderer-only, visual).
 *
 * Builds extension lines, dimension lines, arrowheads, and text anchor points
 * in world XZ for oriented rectangular footprints. Does NOT modify measurements.
 */

import { formatMeasurement } from "./measurementUtils";

export const CAD_DIM_OFFSET       = 0.45;
/** Roof-only — farther from boundary for presentation readability. */
export const CAD_DIM_OFFSET_ROOF  = 0.58;
export const CAD_DIM_EXTENSION    = 0.12;
export const CAD_ARROW_LENGTH     = 0.14;
export const CAD_ARROW_ANGLE      = Math.PI / 7;

/** ~25% larger than original 0.24 — presentation-readable on laptop. */
export const CAD_TEXT_SIZE_3D     = 0.30;
/** ~27% larger than original 11px. */
export const CAD_TEXT_SIZE_2D_PX  = 14;

/** Subtle engineering color hierarchy (lines + label text). */
export const CAD_CATEGORY = {
  ROOF:     "roof",
  OBSTACLE: "obstacle",
  ARRAY:    "array",
  ZONE:     "zone",
};

/** @typedef {{ line: string, text: string, border: string }} CadCategoryStyle */

/** @type {Record<string, CadCategoryStyle>} */
export const CAD_CATEGORY_STYLES = {
  roof: {
    line:   "#F8FAFC",
    text:   "#F8FAFC",
    border: "rgba(248, 250, 252, 0.38)",
  },
  obstacle: {
    line:   "#B8D9E8",
    text:   "#C8E6F2",
    border: "rgba(184, 217, 232, 0.45)",
  },
  array: {
    line:   "#C5D4C8",
    text:   "#D4E2D8",
    border: "rgba(197, 212, 200, 0.42)",
  },
  zone: {
    line:   "#B8D9E8",
    text:   "#C8E6F2",
    border: "rgba(184, 217, 232, 0.45)",
  },
};

/** Shared engineering label chrome (3D Html + 2D SVG). */
export const CAD_LABEL_BG      = "rgba(16, 27, 45, 0.88)";
export const CAD_LABEL_RADIUS  = 5;

/**
 * @param {string} [category]
 * @returns {CadCategoryStyle}
 */
export function getCadCategoryStyle(category = CAD_CATEGORY.ROOF) {
  return CAD_CATEGORY_STYLES[category] ?? CAD_CATEGORY_STYLES.roof;
}

/** Estimate SVG label pill size from formatted measurement string. */
export function estimateLabelBox(label) {
  const charW = 7.4;
  const padX  = 14;
  return {
    width:  Math.max(44, label.length * charW + padX),
    height: 22,
  };
}

// Legacy aliases — unused by new renderer paths; kept for imports stability.
export const CAD_LINE_COLOR   = CAD_CATEGORY_STYLES.roof.line;
export const CAD_ACCENT_COLOR = CAD_CATEGORY_STYLES.obstacle.line;

/**
 * Map local footprint (u = width axis, v = length axis) to world XZ.
 * rotationY matches Three.js Y-axis rotation (panels / obstacles / azimuth).
 */
export function localFootprintToWorld(u, v, centerX, centerZ, rotationY) {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    x: centerX + u * cos - v * sin,
    z: centerZ + u * sin + v * cos,
  };
}

/**
 * Build CAD dimension geometry for one oriented rectangular footprint.
 *
 * @param {{
 *   centerX: number,
 *   centerZ: number,
 *   rotationY: number,
 *   widthX: number,
 *   lengthY: number,
 *   offset?: number,
 * }} params
 */
export function buildCadDimensionSpec({
  centerX,
  centerZ,
  rotationY,
  widthX,
  lengthY,
  offset = CAD_DIM_OFFSET,
}) {
  if (!Number.isFinite(widthX) || !Number.isFinite(lengthY)) return null;
  if (widthX <= 0 && lengthY <= 0) return null;

  const hw = widthX / 2;
  const hl = lengthY / 2;
  const ext = CAD_DIM_EXTENSION;

  const toW = (u, v) => localFootprintToWorld(u, v, centerX, centerZ, rotationY);

  const vFace   = -hl;
  const vDim    = vFace - offset;
  const vExtEnd = vDim - ext;

  const wP0 = toW(-hw, vFace);
  const wP1 = toW( hw, vFace);
  const wD0 = toW(-hw, vDim);
  const wD1 = toW( hw, vDim);
  const wE0 = toW(-hw, vExtEnd);
  const wE1 = toW( hw, vExtEnd);

  const widthAxis = {
    extensionLines: [
      { start: wP0, end: wE0 },
      { start: wP1, end: wE1 },
    ],
    dimensionLine: { start: wD0, end: wD1 },
    arrowLeft:  arrowheadSegments(wD0, unitAlong(wD0, wD1, +1)),
    arrowRight: arrowheadSegments(wD1, unitAlong(wD1, wD0, +1)),
    textAnchor: { x: (wD0.x + wD1.x) / 2, z: (wD0.z + wD1.z) / 2 },
    label: formatMeasurement(widthX),
  };

  const uFace   = -hw;
  const uDim    = uFace - offset;
  const uExtEnd = uDim - ext;

  const lP0 = toW(uFace, -hl);
  const lP1 = toW(uFace,  hl);
  const lD0 = toW(uDim, -hl);
  const lD1 = toW(uDim,  hl);
  const lE0 = toW(uExtEnd, -hl);
  const lE1 = toW(uExtEnd,  hl);

  const lengthAxis = {
    extensionLines: [
      { start: lP0, end: lE0 },
      { start: lP1, end: lE1 },
    ],
    dimensionLine: { start: lD0, end: lD1 },
    arrowLeft:  arrowheadSegments(lD0, unitAlong(lD0, lD1, +1)),
    arrowRight: arrowheadSegments(lD1, unitAlong(lD1, lD0, +1)),
    textAnchor: { x: (lD0.x + lD1.x) / 2, z: (lD0.z + lD1.z) / 2 },
    label: formatMeasurement(lengthY),
  };

  return { width: widthAxis, length: lengthAxis };
}

function unitAlong(from, to, sign) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: (dx / len) * sign, z: (dz / len) * sign };
}

function arrowheadSegments(tip, inwardUnit) {
  const cos = Math.cos(CAD_ARROW_ANGLE);
  const sin = Math.sin(CAD_ARROW_ANGLE);

  const rotate = (ux, uz, dir) => ({
    x: ux * cos - uz * sin * dir,
    z: ux * sin * dir + uz * cos,
  });

  const wing1 = rotate(inwardUnit.x, inwardUnit.z, 1);
  const wing2 = rotate(inwardUnit.x, inwardUnit.z, -1);

  return [
    {
      start: tip,
      end: { x: tip.x + wing1.x * CAD_ARROW_LENGTH, z: tip.z + wing1.z * CAD_ARROW_LENGTH },
    },
    {
      start: tip,
      end: { x: tip.x + wing2.x * CAD_ARROW_LENGTH, z: tip.z + wing2.z * CAD_ARROW_LENGTH },
    },
  ];
}

/**
 * Panel-array overall footprint (renderer-only).
 *
 * @param {object[]} panels
 */
export function computePanelArrayFootprintVisual(panels) {
  if (!panels?.length) return null;

  const rotationY = panels[0].rotation ?? 0;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);

  let sumX = 0;
  let sumZ = 0;
  for (const p of panels) {
    sumX += p.center.x;
    sumZ += p.center.z;
  }
  const centerX = sumX / panels.length;
  const centerZ = sumZ / panels.length;

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

  for (const panel of panels) {
    const hw = panel.width / 2;
    const hl = panel.length / 2;
    const pr = panel.rotation ?? rotationY;
    const pc = Math.cos(pr);
    const ps = Math.sin(pr);

    for (const [sx, sz] of corners) {
      const lx = sx * hw;
      const lz = sz * hl;
      const wx = panel.center.x + lx * pc - lz * ps;
      const wz = panel.center.z + lx * ps + lz * pc;
      const du = wx - centerX;
      const dv = wz - centerZ;
      const u =  du * cos + dv * sin;
      const v = -du * sin + dv * cos;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
  }

  const widthX  = maxU - minU;
  const lengthY = maxV - minV;
  if (widthX <= 0 || lengthY <= 0) return null;

  const uMid = (minU + maxU) / 2;
  const vMid = (minV + maxV) / 2;
  const worldMid = localFootprintToWorld(uMid, vMid, centerX, centerZ, rotationY);

  return {
    centerX: worldMid.x,
    centerZ: worldMid.z,
    rotationY,
    widthX,
    lengthY,
  };
}

export function roofCentroidSceneXZ(coordinates, centre) {
  if (!coordinates?.length || !centre) return { x: 0, z: 0 };
  const cosLat = Math.cos((centre.lat * Math.PI) / 180);
  let sx = 0;
  let sz = 0;
  for (const [lat, lng] of coordinates) {
    sx += (lng - centre.lng) * 111_320 * cosLat;
    sz += -(lat - centre.lat) * 111_320;
  }
  return { x: sx / coordinates.length, z: sz / coordinates.length };
}

export function shouldShowCadObject(showDimensions, isEditingThis) {
  if (isEditingThis) return true;
  return showDimensions;
}

export function sceneXZToLatLng(x, z, centre) {
  const cosLat = Math.cos((centre.lat * Math.PI) / 180);
  return {
    lat: centre.lat - z / 111_320,
    lng: centre.lng + x / (111_320 * cosLat),
  };
}
