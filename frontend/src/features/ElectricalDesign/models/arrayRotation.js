/**
 * arrayRotation.js — Step 7 absolute array-level rigid rotation (pure).
 *
 * rotationDeg is always applied from baseline layout (generated + overrides),
 * never from previously rotated coordinates. Idempotent: 30° then 45° → 45°.
 *
 * Does not mutate baseline geometry or rerun the placement engine.
 */

import { panelCorners, panelsOverlap } from "../../panels/panelEditValidation.js";
import { rotate2D } from "../utils/geometry.js";

const PANEL_GAP_M = 0.02;
const ROTATION_DEG_TOLERANCE = 1e-6;

/**
 * @param {number} rotationDeg
 * @returns {number}
 */
export function normalizeRotationDeg(rotationDeg) {
  const numeric = Number(rotationDeg);
  if (!Number.isFinite(numeric)) return 0;
  let deg = numeric % 360;
  if (deg < 0) deg += 360;
  return deg;
}

/**
 * @param {number|null|undefined} a
 * @param {number|null|undefined} b
 */
export function rotationDegEqual(a, b) {
  return Math.abs(normalizeRotationDeg(a ?? 0) - normalizeRotationDeg(b ?? 0)) < ROTATION_DEG_TOLERANCE;
}

/**
 * @param {object[]} baselinePanels
 * @param {string[]} panelIds
 */
export function computeArrayCentroid(baselinePanels, panelIds) {
  const idSet = new Set(panelIds ?? []);
  let sumX = 0;
  let sumZ = 0;
  let count = 0;

  for (const panel of baselinePanels ?? []) {
    const slotId = panel.slotId ?? panel.id;
    if (!idSet.has(slotId)) continue;
    sumX += panel.center.x;
    sumZ += panel.center.z;
    count += 1;
  }

  if (count === 0) return { x: 0, z: 0 };
  return { x: sumX / count, z: sumZ / count };
}

/**
 * Absolute rotation from baseline panel record.
 *
 * @param {object} baselinePanel
 * @param {{ x: number, z: number }} centroid
 * @param {number} rotationDeg
 */
export function rotatePanelFromBaseline(baselinePanel, centroid, rotationDeg) {
  const angleRad = (normalizeRotationDeg(rotationDeg) * Math.PI) / 180;
  const rotatedCenter = rotate2D(
    baselinePanel.center.x,
    baselinePanel.center.z,
    angleRad,
    centroid.x,
    centroid.z,
  );

  return {
    ...baselinePanel,
    center: { x: rotatedCenter.x, z: rotatedCenter.z },
    rotation: (baselinePanel.rotation ?? 0) + angleRad,
  };
}

/**
 * @param {object[]} baselinePanels
 * @param {object} array
 * @returns {object[]}
 */
export function rotatedPanelsForArray(baselinePanels, array) {
  const rotationDeg = normalizeRotationDeg(array.rotationDeg ?? 0);
  if (rotationDeg === 0 || !array.panelIds?.length) return [];

  const idSet = new Set(array.panelIds);
  const members = (baselinePanels ?? []).filter((p) => idSet.has(p.slotId ?? p.id));
  if (members.length !== array.panelIds.length) return null;

  const centroid = computeArrayCentroid(baselinePanels, array.panelIds);
  return members.map((panel) => rotatePanelFromBaseline(panel, centroid, rotationDeg));
}

/**
 * Apply absolute array rotations to baseline placed panels (immutable baseline).
 *
 * @param {object[]} baselinePanels
 * @param {object[]} arrays
 * @returns {object[]}
 */
export function applyElectricalArrayRotations(baselinePanels, arrays) {
  if (!baselinePanels?.length) return [];

  const baselineById = new Map(
    baselinePanels.map((p) => [p.slotId ?? p.id, p]),
  );

  const rotatedById = new Map();
  for (const array of arrays ?? []) {
    const rotationDeg = normalizeRotationDeg(array.rotationDeg ?? 0);
    if (rotationDeg === 0 || !array.panelIds?.length) continue;

    const centroid = computeArrayCentroid(baselinePanels, array.panelIds);
    for (const panelId of array.panelIds) {
      const baseline = baselineById.get(panelId);
      if (!baseline) continue;
      rotatedById.set(
        panelId,
        rotatePanelFromBaseline(baseline, centroid, rotationDeg),
      );
    }
  }

  if (rotatedById.size === 0) return baselinePanels;

  return baselinePanels.map((panel) => {
    const slotId = panel.slotId ?? panel.id;
    return rotatedById.get(slotId) ?? panel;
  });
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

/**
 * Validate proposed absolute rotation for one array (all-or-nothing).
 *
 * @param {object} params
 * @returns {{ ok: true, panels: object[] } | { ok: false, reason: string }}
 */
export function validateArrayRotation({
  baselinePanels,
  array,
  rotationDeg,
  placementReady,
}) {
  if (!array) return { ok: false, reason: "Array could not be found." };
  if (array.frozen) return { ok: false, reason: "Array is frozen. Unfreeze before rotating." };

  const normalized = normalizeRotationDeg(rotationDeg);
  if (!Number.isFinite(Number(rotationDeg))) {
    return { ok: false, reason: "Rotation angle must be a valid number." };
  }

  const proposed = rotatedPanelsForArray(baselinePanels, {
    ...array,
    rotationDeg: normalized,
  });

  if (proposed === null) {
    return { ok: false, reason: "One or more array panels are missing from the baseline layout." };
  }

  if (normalized === 0) {
    return { ok: true, panels: proposed };
  }

  const arrayIdSet = new Set(array.panelIds);
  const foreignPanels = (baselinePanels ?? []).filter(
    (p) => !arrayIdSet.has(p.slotId ?? p.id),
  );

  for (const panel of proposed) {
    if (!panelFitsInstallable(panel, placementReady)) {
      return {
        ok:     false,
        reason: "Rotation would place one or more panels outside the installable region.",
      };
    }

    for (const other of foreignPanels) {
      const expanded = {
        ...other,
        width:  other.width + PANEL_GAP_M,
        length: other.length + PANEL_GAP_M,
      };
      if (panelsOverlap(panel, expanded)) {
        return {
          ok:     false,
          reason: "Rotation would overlap panels outside this array.",
        };
      }
    }
  }

  return { ok: true, panels: proposed };
}
