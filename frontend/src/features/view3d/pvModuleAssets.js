/**
 * pvModuleAssets.js — Shared PV module geometry, materials, and transform helpers.
 * Visualization only — reads module dimensions + mount props, never writes engineering state.
 */

import * as THREE from "three";
import {
  computeModuleStack,
  rowSupportHeights,
  MODULE_RAIL_GAP,
} from "./panelMountVisual.js";

export const MODULE_THICKNESS = 0.038;
export const FRAME_LIP        = 0.024;
export const FRAME_DEPTH      = 0.037;
export const GLASS_THICKNESS  = 0.004;
export const RAIL_W           = 0.042;
export const RAIL_H           = 0.034;
export const SUPPORT_W        = 0.048;
export const SUPPORT_D        = 0.028;
export const CLAMP_W          = 0.032;
export const ROOF_CONTACT_EPS = 0.004;

const DEG2RAD = Math.PI / 180;

let cellTexture = null;
let sharedMaterials = null;

/** Bump when regenerating shared PV surface assets (dev hot-reload safety). */
const SURFACE_ASSETS_REV = 2;

function cellHash(c, r) {
  return ((c * 73856093) ^ (r * 19349663)) >>> 0;
}

function monoCellColor(hash) {
  const hue = 215 + (hash % 7) - 3;
  const sat = 42 + (hash % 5);
  const lit = 14 + (hash % 4);
  return `hsl(${hue}, ${sat}%, ${lit}%)`;
}

/**
 * Procedural monocrystalline module face — 6×24 half-cut grid on a 1:2 canvas.
 * Single lightweight CanvasTexture; no per-cell meshes.
 */
function createCellTexture() {
  const cols = 6;
  const rows = 24;
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");

  // Gap colour shows through between cells (thin separation lines).
  ctx.fillStyle = "#020408";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;
  const gap = 1.25;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + gap;
      const y = r * cellH + gap;
      const w = cellW - gap * 2;
      const h = cellH - gap * 2;
      const hash = cellHash(c, r);

      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, monoCellColor(hash));
      grad.addColorStop(0.38, `hsl(${216 + (hash % 3)}, 38%, ${16 + (hash % 3)}%)`);
      grad.addColorStop(0.72, `hsl(${212 + (hash % 4)}, 44%, ${12 + (hash % 2)}%)`);
      grad.addColorStop(1, `hsl(${208 + (hash % 5)}, 36%, 10%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);

      // Crystalline facet highlight (subtle, not mirror-like).
      const facet = ctx.createLinearGradient(x, y, x + w * 0.55, y + h * 0.45);
      facet.addColorStop(0, "rgba(140, 175, 210, 0.07)");
      facet.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = facet;
      ctx.fillRect(x, y, w, h);

      // Thin vertical busbars — subtle silver, visible at engineering zoom.
      const busPositions = [0.28, 0.5, 0.72];
      for (const t of busPositions) {
        ctx.strokeStyle = "rgba(175, 185, 198, 0.22)";
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.moveTo(x + w * t, y + 2);
        ctx.lineTo(x + w * t, y + h - 2);
        ctx.stroke();
      }

      // Faint horizontal collector trace.
      ctx.strokeStyle = "rgba(150, 165, 180, 0.1)";
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + h * 0.78);
      ctx.lineTo(x + w - 3, y + h * 0.78);
      ctx.stroke();
    }
  }

  // Reinforce inter-cell gaps (very thin — not deep grooves).
  ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
  ctx.lineWidth = 0.85;
  for (let c = 0; c <= cols; c++) {
    const px = c * cellW + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvas.height);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const py = r * cellH + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(canvas.width, py);
    ctx.stroke();
  }

  // Edge darkening — tempered glass falloff at module perimeter.
  const edgeGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  edgeGrad.addColorStop(0, "rgba(0, 0, 0, 0.38)");
  edgeGrad.addColorStop(0.06, "rgba(0, 0, 0, 0)");
  edgeGrad.addColorStop(0.94, "rgba(0, 0, 0, 0)");
  edgeGrad.addColorStop(1, "rgba(0, 0, 0, 0.38)");
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const edgeGradV = ctx.createLinearGradient(0, 0, 0, canvas.height);
  edgeGradV.addColorStop(0, "rgba(0, 0, 0, 0.28)");
  edgeGradV.addColorStop(0.05, "rgba(0, 0, 0, 0)");
  edgeGradV.addColorStop(0.95, "rgba(0, 0, 0, 0)");
  edgeGradV.addColorStop(1, "rgba(0, 0, 0, 0.32)");
  ctx.fillStyle = edgeGradV;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Tempered-glass sheen — low-opacity, avoids mirror finish.
  const sheen = ctx.createLinearGradient(0, 0, canvas.width * 0.65, canvas.height * 0.35);
  sheen.addColorStop(0, "rgba(200, 220, 240, 0.09)");
  sheen.addColorStop(0.45, "rgba(160, 190, 220, 0.03)");
  sheen.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function getSharedMaterials() {
  if (sharedMaterials && sharedMaterials._rev === SURFACE_ASSETS_REV) return sharedMaterials;

  if (cellTexture) {
    cellTexture.dispose();
    cellTexture = null;
  }
  if (sharedMaterials) {
    Object.values(sharedMaterials).forEach((m) => m?.dispose?.());
    sharedMaterials = null;
  }

  const tex = createCellTexture();
  cellTexture = tex;

  sharedMaterials = {
    _rev: SURFACE_ASSETS_REV,
    glass: new THREE.MeshStandardMaterial({
      map: tex,
      color: "#eef2f8",
      emissive: "#000000",
      emissiveIntensity: 0,
      roughness: 0.09,
      metalness: 0.11,
      envMapIntensity: 0.52,
    }),
    frame: new THREE.MeshStandardMaterial({
      color: "#c8d0d8",
      roughness: 0.32,
      metalness: 0.78,
    }),
    frameEdge: new THREE.MeshStandardMaterial({
      color: "#e4eaef",
      roughness: 0.22,
      metalness: 0.85,
    }),
    rail: new THREE.MeshStandardMaterial({
      color: "#d4dae0",
      roughness: 0.28,
      metalness: 0.82,
    }),
    support: new THREE.MeshStandardMaterial({
      color: "#707880",
      roughness: 0.68,
      metalness: 0.42,
    }),
    clamp: new THREE.MeshStandardMaterial({
      color: "#aeb6be",
      roughness: 0.38,
      metalness: 0.72,
    }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  };

  return sharedMaterials;
}

const geometryCache = new Map();

function cacheKey(width, length) {
  return `${width.toFixed(4)}::${length.toFixed(4)}`;
}

export function getModuleGeometries(width, length) {
  const key = cacheKey(width, length);
  if (geometryCache.has(key)) return geometryCache.get(key);

  const glassW = width - FRAME_LIP * 2;
  const glassL = length - FRAME_LIP * 2;

  const geos = {
    glass: new THREE.BoxGeometry(glassW, GLASS_THICKNESS, glassL),
    frameTop: new THREE.BoxGeometry(width, FRAME_DEPTH, FRAME_LIP),
    frameBottom: new THREE.BoxGeometry(width, FRAME_DEPTH, FRAME_LIP),
    frameLeft: new THREE.BoxGeometry(FRAME_LIP, FRAME_DEPTH, length - FRAME_LIP * 2),
    frameRight: new THREE.BoxGeometry(FRAME_LIP, FRAME_DEPTH, length - FRAME_LIP * 2),
    frameBevel: new THREE.BoxGeometry(width + 0.004, 0.006, length + 0.004),
    endClamp: new THREE.BoxGeometry(CLAMP_W, CLAMP_W * 0.55, CLAMP_W * 1.5),
    midClamp: new THREE.BoxGeometry(CLAMP_W * 0.85, CLAMP_W * 0.65, CLAMP_W * 1.2),
    hit: new THREE.BoxGeometry(width, MODULE_THICKNESS + MODULE_RAIL_GAP + RAIL_H + 0.06, length),
  };

  geometryCache.set(key, geos);
  return geos;
}

export function getRowGeometries(rowWidth, moduleLength) {
  const key = `row::${rowWidth.toFixed(4)}::${moduleLength.toFixed(4)}`;
  if (geometryCache.has(key)) return geometryCache.get(key);

  const geos = {
    rail: new THREE.BoxGeometry(RAIL_W, RAIL_H, moduleLength * 0.96),
    crossRail: new THREE.BoxGeometry(rowWidth * 0.92, RAIL_H * 0.65, RAIL_W * 0.85),
    support: new THREE.BoxGeometry(SUPPORT_W, 1, SUPPORT_D),
    bracket: new THREE.BoxGeometry(SUPPORT_W * 1.1, 0.018, SUPPORT_D * 1.35),
  };

  geometryCache.set(key, geos);
  return geos;
}

/** Pivot at roof contact — mountHeight lifts rails, NOT the whole group origin. */
export function applyPanelAssemblyTransform(obj, panel, deckY, mountVisual) {
  const tiltRad = (mountVisual.tilt ?? 0) * DEG2RAD;
  obj.position.set(panel.center.x, deckY + ROOF_CONTACT_EPS, panel.center.z);
  obj.rotation.set(-tiltRad, panel.rotation ?? 0, 0, "YXZ");
  obj.updateMatrix();
}

export function applyRowAssemblyTransform(obj, row, deckY, mountVisual) {
  const tiltRad = (mountVisual.tilt ?? 0) * DEG2RAD;
  obj.position.set(row.center.x, deckY + ROOF_CONTACT_EPS, row.center.z);
  obj.rotation.set(-tiltRad, row.rotation ?? 0, 0, "YXZ");
  obj.updateMatrix();
}

const tempObj = new THREE.Object3D();

function setPartMatrix(out, root, lx, ly, lz, sx = 1, sy = 1, sz = 1) {
  tempObj.position.set(lx, ly, lz);
  tempObj.scale.set(sx, sy, sz);
  tempObj.rotation.set(0, 0, 0);
  tempObj.updateMatrix();
  out.copy(root.matrix).multiply(tempObj.matrix);
}

/** Module-only parts (glass, frame, clamps) — no per-panel rails/legs. */
export function buildModulePartMatrices(panel, mountVisual, root) {
  const { width, length } = panel;
  const stack = computeModuleStack(mountVisual.mountHeight ?? 0);
  const hw = width / 2;
  const hl = length / 2;
  const out = {};

  const set = (name, lx, ly, lz, sx, sy, sz) => {
    out[name] = new THREE.Matrix4();
    setPartMatrix(out[name], root, lx, ly, lz, sx, sy, sz);
  };

  set("glass", 0, stack.moduleCenterY, 0);
  set("frameTop", 0, stack.frameCenterY, -hl + FRAME_LIP / 2);
  set("frameBottom", 0, stack.frameCenterY, hl - FRAME_LIP / 2);
  set("frameLeft", -hw + FRAME_LIP / 2, stack.frameCenterY, 0);
  set("frameRight", hw - FRAME_LIP / 2, stack.frameCenterY, 0);
  set("frameBevel", 0, stack.frameBottomY + FRAME_DEPTH + 0.003, 0);
  set("endClampL", -hw + RAIL_W * 0.55, stack.railCenterY + RAIL_H * 0.42, 0);
  set("endClampR", hw - RAIL_W * 0.55, stack.railCenterY + RAIL_H * 0.42, 0);

  return out;
}

/** Shared row rails + supports (visual only). */
export function buildRowPartMatrices(row, mountVisual, root) {
  const stack = computeModuleStack(mountVisual.mountHeight ?? 0);
  const supports = rowSupportHeights(
    mountVisual.mountType,
    mountVisual.mountHeight,
    mountVisual.tilt,
    row.moduleLength,
  );

  const hw = row.rowWidth / 2;
  const hl = row.moduleLength / 2;
  const railInset = RAIL_W * 0.55;
  const railY = stack.railCenterY;

  const out = {
    railL: new THREE.Matrix4(),
    railR: new THREE.Matrix4(),
    crossFront: new THREE.Matrix4(),
    crossRear: new THREE.Matrix4(),
    supports: [],
    brackets: [],
  };

  setPartMatrix(out.railL, root, -hw + railInset, railY, 0);
  setPartMatrix(out.railR, root, hw - railInset, railY, 0);
  setPartMatrix(out.crossFront, root, 0, railY - RAIL_H * 0.08, -hl + RAIL_W);
  setPartMatrix(out.crossRear, root, 0, railY - RAIL_H * 0.08, hl - RAIL_W);

  const supportXs = supportPositionsAlongRow(row.rowWidth);
  const colScale = supports.column ? 1.2 : 1;

  for (const sx of supportXs) {
    for (const [z, h] of [[-hl + 0.08, supports.front], [hl - 0.08, supports.rear]]) {
      const mat = new THREE.Matrix4();
      setPartMatrix(mat, root, sx, h / 2, z, colScale, h, colScale);
      out.supports.push(mat);

      const br = new THREE.Matrix4();
      setPartMatrix(br, root, sx, h + supports.bracket / 2, z, colScale, 1, colScale);
      out.brackets.push(br);
    }
  }

  return out;
}

function supportPositionsAlongRow(rowWidth) {
  const hw = rowWidth / 2;
  const inset = 0.12;
  const positions = [-hw + inset, hw - inset];
  const span = rowWidth - inset * 2;
  if (span > 2.2) {
    const count = Math.min(4, Math.floor(span / 1.8));
    for (let i = 1; i < count; i++) {
      positions.push(-hw + inset + (span * i) / count);
    }
  }
  return [...new Set(positions.map((p) => +p.toFixed(3)))];
}

export function buildMidClampMatrix(clampPos, mountVisual, deckY, rootTemp) {
  const stack = computeModuleStack(mountVisual.mountHeight ?? 0);
  const tiltRad = (mountVisual.tilt ?? 0) * DEG2RAD;

  rootTemp.position.set(clampPos.x, deckY + ROOF_CONTACT_EPS, clampPos.z);
  rootTemp.rotation.set(-tiltRad, clampPos.rotation ?? 0, 0, "YXZ");
  rootTemp.updateMatrix();

  const mat = new THREE.Matrix4();
  setPartMatrix(mat, rootTemp, 0, stack.railCenterY + RAIL_H * 0.45, 0);
  return mat;
}

export function tintGlassMaterial(baseMat, { selected, dragging, arrayHighlight, dimmed }) {
  if (!selected && !dragging && !arrayHighlight && !dimmed) return baseMat;

  const mat = baseMat.clone();
  if (dragging) {
    mat.emissive.set("#2563eb");
    mat.emissiveIntensity = 0.35;
    mat.transparent = true;
    mat.opacity = 0.92;
  } else if (selected) {
    mat.emissive.set("#4F8CFF");
    mat.emissiveIntensity = 0.28;
  } else if (arrayHighlight) {
    mat.emissive.set("#FFB547");
    mat.emissiveIntensity = 0.22;
  } else if (dimmed) {
    mat.transparent = true;
    mat.opacity = 0.38;
    mat.emissiveIntensity = 0.02;
  }
  return mat;
}

export { computeModuleStack, MODULE_RAIL_GAP };
