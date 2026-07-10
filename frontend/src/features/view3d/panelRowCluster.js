/**
 * panelRowCluster.js — Pure visual clustering of placed panels into shared mount rows.
 * Read-only; does not affect placement or engineering state.
 */

const ROW_ALIGN_TOL = 0.14;
const ADJACENCY_TOL = 0.18;

function localCoords(panel) {
  const rot = panel.rotation ?? 0;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  return {
    lx: panel.center.x * cos - panel.center.z * sin,
    lz: panel.center.x * sin + panel.center.z * cos,
    rot,
  };
}

function rowKey(panel) {
  const { rot } = localCoords(panel);
  return [
    panel.roofId,
    panel.regionId ?? "",
    (rot * 1000 | 0),
    panel.width.toFixed(3),
    panel.length.toFixed(3),
  ].join("|");
}

function sameRowBand(a, b) {
  return Math.abs(a.lz - b.lz) <= ROW_ALIGN_TOL + a.panel.length * 0.05;
}

function adjacentAlongRow(a, b) {
  const edgeGap = Math.abs(a.lx - b.lx) - (a.panel.width + b.panel.width) / 2;
  return edgeGap <= ADJACENCY_TOL;
}

/**
 * @param {object[]} panels
 * @returns {object[]} row descriptors for mount visualization
 */
export function clusterPanelsIntoMountRows(panels) {
  const buckets = new Map();

  for (const panel of panels) {
    const key = rowKey(panel);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ panel, ...localCoords(panel) });
  }

  const rows = [];

  for (const items of buckets.values()) {
    const parent = items.map((_, i) => i);
    const find = (i) => {
      if (parent[i] !== i) parent[i] = find(parent[i]);
      return parent[i];
    };
    const union = (a, b) => {
      parent[find(a)] = find(b);
    };

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (sameRowBand(items[i], items[j]) && adjacentAlongRow(items[i], items[j])) {
          union(i, j);
        }
      }
    }

    const clusters = new Map();
    for (let i = 0; i < items.length; i++) {
      const root = find(i);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(items[i]);
    }

    for (const cluster of clusters.values()) {
      rows.push(buildRowDescriptor(cluster));
    }
  }

  return rows;
}

function buildRowDescriptor(cluster) {
  const rowPanels = cluster.map((c) => c.panel);
  const rot = cluster[0].rot;
  const w = rowPanels[0].width;
  const l = rowPanels[0].length;

  let minLx = Infinity;
  let maxLx = -Infinity;
  let sumLz = 0;

  for (const item of cluster) {
    minLx = Math.min(minLx, item.lx - w / 2);
    maxLx = Math.max(maxLx, item.lx + w / 2);
    sumLz += item.lz;
  }

  const avgLz = sumLz / cluster.length;
  const midLx = (minLx + maxLx) / 2;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const cx = midLx * cos + avgLz * sin;
  const cz = -midLx * sin + avgLz * cos;

  return {
    panels: rowPanels,
    panelIds: new Set(rowPanels.map((p) => p.slotId ?? p.id)),
    center: { x: cx, z: cz },
    rotation: rot,
    rowWidth: maxLx - minLx,
    moduleWidth: w,
    moduleLength: l,
    roofId: rowPanels[0].roofId,
    regionId: rowPanels[0].regionId,
  };
}

/**
 * Shared edges between adjacent panels in a row (for mid-clamps).
 *
 * @param {object} row
 * @returns {{ x: number, z: number, rotation: number }[]}
 */
export function midClampPositionsForRow(row) {
  const rot = row.rotation ?? 0;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const w = row.moduleWidth;
  const items = row.panels.map((p) => {
    const lx = p.center.x * cos - p.center.z * sin;
    const lz = p.center.x * sin + p.center.z * cos;
    return { lx, lz };
  }).sort((a, b) => a.lx - b.lx);

  const clamps = [];
  for (let i = 0; i < items.length - 1; i++) {
    const gap = items[i + 1].lx - items[i].lx - w;
    if (gap <= ADJACENCY_TOL + 0.05) {
      const midLx = (items[i].lx + items[i + 1].lx) / 2;
      const lz = items[i].lz;
      const x = midLx * Math.cos(rot) + lz * Math.sin(rot);
      const z = -midLx * Math.sin(rot) + lz * Math.cos(rot);
      clamps.push({ x, z, rotation: rot });
    }
  }
  return clamps;
}
