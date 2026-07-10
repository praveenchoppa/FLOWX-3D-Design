/**
 * panelEditValidation.js — Move / rotate validation for manual panel edits (pure).
 *
 * Read-only checks against the generated snapshot + overrides.
 * Does NOT call computePanelLayout() or modify placement algorithms.
 */

import { getPanelById } from "./panelTypes.js";
import { panelForPlacement, ORIENTATIONS } from "./panelConfig.js";
import {
  resolveRenderedPlacedPanels,
  inferPanelOrientation,
  effectivePanelOrientation,
} from "./panelEditorUtils.js";

const PANEL_GAP_M = 0.02;

function panelCorners(cx, cz, width, length, rotRad) {
  const hw = width / 2;
  const hl = length / 2;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);
  return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([lx, lz]) => [
    cx + lx * cos - lz * sin,
    cz + lx * sin + lz * cos,
  ]);
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    const intersect = ((zi > z) !== (zj > z))
      && (x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointIsInstallable(x, z, outerRings, holes, blockedRings) {
  const inOuter = outerRings.some((ring) => pointInRing(x, z, ring));
  if (!inOuter) return false;
  for (const hole of holes) {
    if (hole?.length >= 3 && pointInRing(x, z, hole)) return false;
  }
  for (const blocked of blockedRings) {
    if (blocked?.length >= 3 && pointInRing(x, z, blocked)) return false;
  }
  return true;
}

function panelFitsInstallable(panel, placementReady) {
  const region = (placementReady?.installableRegions ?? []).find(
    (r) => r.id === panel.regionId || panel.regionId?.startsWith(`${r.id}::`),
  );
  if (!region?.outerRing?.length) return false;

  const blocked = (placementReady?.blockedRegions ?? [])
    .filter((b) => b.roofId === panel.roofId)
    .map((b) => b.outerRing)
    .filter(Boolean);

  const corners = panelCorners(
    panel.center.x,
    panel.center.z,
    panel.width,
    panel.length,
    panel.rotation ?? 0,
  );

  return corners.every(([x, z]) =>
    pointIsInstallable(x, z, [region.outerRing], region.holes ?? [], blocked),
  );
}

/** Separating-axis overlap test for two rotated rectangles (shared rotation). */
function panelsOverlap(a, b) {
  if (a.rotation != null && b.rotation != null && Math.abs(a.rotation - b.rotation) > 1e-6) {
    return panelsOverlapGeneral(a, b);
  }
  const rot = a.rotation ?? b.rotation ?? 0;
  const ca = panelCorners(a.center.x, a.center.z, a.width, a.length, rot);
  const cb = panelCorners(b.center.x, b.center.z, b.width, b.length, rot);
  return convexPolygonsOverlap(ca, cb);
}

function convexPolygonsOverlap(a, b) {
  const axes = [...polygonEdgeNormals(a), ...polygonEdgeNormals(b)];
  for (const [ax, az] of axes) {
    const [minA, maxA] = projectPolygon(a, ax, az);
    const [minB, maxB] = projectPolygon(b, ax, az);
    if (maxA < minB || maxB < minA) return false;
  }
  return true;
}

function polygonEdgeNormals(poly) {
  const normals = [];
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    const ex = x2 - x1;
    const ez = z2 - z1;
    const len = Math.hypot(ex, ez) || 1;
    normals.push([-ez / len, ex / len]);
  }
  return normals;
}

function projectPolygon(poly, ax, az) {
  let min = Infinity;
  let max = -Infinity;
  for (const [x, z] of poly) {
    const p = x * ax + z * az;
    min = Math.min(min, p);
    max = Math.max(max, p);
  }
  return [min, max];
}

function panelsOverlapGeneral(a, b) {
  const ca = panelCorners(a.center.x, a.center.z, a.width, a.length, a.rotation ?? 0);
  const cb = panelCorners(b.center.x, b.center.z, b.width, b.length, b.rotation ?? 0);
  return convexPolygonsOverlap(ca, cb);
}

function panelWithOrientation(panel, orientation) {
  const fp = panelForPlacement(panel.panelTypeId, orientation);
  if (!fp) return panel;
  return { ...panel, width: fp.width, length: fp.height };
}

function occupiedSlotIds(generatedLayout, overrides, excludeSlotId = null) {
  const placed = resolveRenderedPlacedPanels(generatedLayout, overrides);
  const ids = new Set(placed.map((p) => p.slotId ?? p.id));
  if (excludeSlotId) ids.delete(excludeSlotId);
  return ids;
}

/**
 * @param {string} fromSlotId
 * @param {string} toSlotId
 * @param {object|null} generatedLayout
 * @param {import("./panelEditorUtils.js").PanelOverrides} overrides
 */
export function validatePanelMove(fromSlotId, toSlotId, generatedLayout, overrides) {
  if (!fromSlotId || !toSlotId || fromSlotId === toSlotId) {
    return { valid: false, reason: "same_slot" };
  }

  const slots = generatedLayout?.allValidSlots ?? [];
  const target = slots.find((s) => s.slotId === toSlotId);
  if (!target) return { valid: false, reason: "invalid_target" };

  const occupied = occupiedSlotIds(generatedLayout, overrides, fromSlotId);
  if (occupied.has(toSlotId)) return { valid: false, reason: "occupied" };

  const placed = resolveRenderedPlacedPanels(generatedLayout, overrides);
  if (!placed.some((p) => (p.slotId ?? p.id) === fromSlotId)) {
    return { valid: false, reason: "source_not_placed" };
  }

  return { valid: true, targetSlot: target };
}

/**
 * Find the nearest valid ghost slot for drag snapping.
 *
 * @param {number} x  scene X
 * @param {number} z  scene Z
 * @param {object[]} snapSlots
 * @param {number} [maxDistM]
 */
export function nearestSnapSlot(x, z, snapSlots, maxDistM = 1.8) {
  let best = null;
  let bestD = maxDistM;
  for (const slot of snapSlots) {
    const d = Math.hypot(slot.center.x - x, slot.center.z - z);
    if (d < bestD) {
      bestD = d;
      best = slot;
    }
  }
  return best;
}

/**
 * @param {string} slotId
 * @param {"portrait"|"landscape"} nextOrientation
 * @param {object|null} generatedLayout
 * @param {import("./panelEditorUtils.js").PanelOverrides} overrides
 * @param {object|null} placementReady
 */
export function validatePanelRotate(slotId, nextOrientation, generatedLayout, overrides, placementReady) {
  const placed = resolveRenderedPlacedPanels(generatedLayout, overrides);
  const panel = placed.find((p) => (p.slotId ?? p.id) === slotId);
  if (!panel) return { valid: false, reason: "not_placed" };

  const current = effectivePanelOrientation(panel, overrides);
  if (current === nextOrientation) return { valid: false, reason: "unchanged" };

  const testPanel = panelWithOrientation(panel, nextOrientation);

  if (!panelFitsInstallable(testPanel, placementReady)) {
    return { valid: false, reason: "containment" };
  }

  for (const other of placed) {
    if ((other.slotId ?? other.id) === slotId) continue;
    const gap = PANEL_GAP_M;
    const expanded = {
      ...other,
      width:  other.width + gap,
      length: other.length + gap,
    };
    if (panelsOverlap(testPanel, expanded)) {
      return { valid: false, reason: "overlap" };
    }
  }

  return { valid: true };
}

/** Toggle portrait ⇄ landscape for one placed panel. */
export function toggledOrientation(panel, overrides) {
  const current = effectivePanelOrientation(panel, overrides);
  return current === ORIENTATIONS.LANDSCAPE
    ? ORIENTATIONS.PORTRAIT
    : ORIENTATIONS.LANDSCAPE;
}

export { panelCorners, panelsOverlap };
