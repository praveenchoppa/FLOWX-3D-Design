/**
 * panelPlacement.js — Step 6A-2 / 6B-1 / 6C-6 auto panel placement (pure).
 *
 * Generates allValidSlots[] — every grid cell that passes the 4-corner test.
 * Default auto layout = all valid slots active (6B-1 overrides toggle them).
 */

import { buffer as turfBuffer, polygon as turfPolygon, area as turfArea } from "@turf/turf";

import { shoelaceAreaM2 } from "../zones/placementReady";
import {
  selectProfessionalLayoutSlots,
  computeLongestRowLength,
  isBetterGridPhase,
} from "./panelLayoutPolicy";

// ── Spacing constants (metres) ────────────────────────────────────────────────

/** Tight rail gap between adjacent panels within the same row (panels nearly touching). */
export const PANEL_GAP_M = 0.02;

/** Minimum gap between any panel and the installable region outer boundary. */
export const EDGE_CLEARANCE_M = 0.3;

/** Minimum gap between any panel and obstacles / holes / blocked keep-outs. */
export const OBSTACLE_CLEARANCE_M = 0.3;

/** Extra gap between panel rows (access / airflow) — added on top of PANEL_GAP_M. */
export const INTER_ROW_GAP_M = 0.3;

// ── Geometry helpers ────────────────────────────────────────────────────────────

function rotate2D(x, z, angle, pivotX, pivotZ) {
  const dx = x - pivotX;
  const dz = z - pivotZ;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: pivotX + dx * cos - dz * sin,
    z: pivotZ + dx * sin + dz * cos,
  };
}

function pointInRing(x, z, ring) {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (
      (zi > z) !== (zj > z) &&
      x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function ringCentroid(ring) {
  const n = ring.length;
  if (!n) return { x: 0, z: 0 };
  return {
    x: ring.reduce((s, [x]) => s + x, 0) / n,
    z: ring.reduce((s, [, z]) => s + z, 0) / n,
  };
}

function alignedBBox(ring, pivotX, pivotZ, negAlignRad) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of ring) {
    const p = rotate2D(x, z, negAlignRad, pivotX, pivotZ);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ };
}

function panelCorners(cx, cz, width, length, rotRad) {
  const hw = width / 2;
  const hl = length / 2;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);
  // Same rotation convention as rotate2D() — local lx=width, lz=length.
  return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([lx, lz]) => [
    cx + lx * cos - lz * sin,
    cz + lx * sin + lz * cos,
  ]);
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

function panelFits(cx, cz, width, length, rotRad, outerRings, holes, blockedRings) {
  const corners = panelCorners(cx, cz, width, length, rotRad);
  return corners.every(([x, z]) =>
    pointIsInstallable(x, z, outerRings, holes, blockedRings),
  );
}

/** Transform a scene-XZ ring into roof-aligned (U,V) coordinates. */
function ringToAligned(ring, pivotX, pivotZ, negAlignRad) {
  return ring.map(([x, z]) => {
    const p = rotate2D(x, z, negAlignRad, pivotX, pivotZ);
    return [p.x, p.z];
  });
}

/** Axis-aligned bbox of an aligned ring with optional inset (metres). */
function alignedRingBBox(ring, insetM = 0) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  if (insetM > 0) {
    minX += insetM; maxX -= insetM;
    minZ += insetM; maxZ -= insetM;
  }
  return { minX, maxX, minZ, maxZ };
}

/** Expand axis-aligned bbox of a ring by clearance (for keep-out tests). */
function expandAlignedRingBBox(ring, expandM) {
  if (!ring?.length || expandM <= 0) return ring;
  const { minX, maxX, minZ, maxZ } = alignedRingBBox(ring, 0);
  return [
    [minX - expandM, minZ - expandM],
    [maxX + expandM, minZ - expandM],
    [maxX + expandM, maxZ + expandM],
    [minX - expandM, maxZ + expandM],
  ];
}

/**
 * Build aligned (U,V) containment geometry for one region.
 * Edge/obstacle clearances applied in flat scene metres (not turf geodesic buffer).
 */
function buildAlignedContainment(outerRing, holes, blockedRings, pcx, pcz, negAlignRad, options = {}) {
  const edgeM     = options.edgeClearanceM     ?? EDGE_CLEARANCE_M;
  const obstacleM = options.obstacleClearanceM ?? OBSTACLE_CLEARANCE_M;

  const alignedOuter = ringToAligned(outerRing, pcx, pcz, negAlignRad);
  const alignedHoles = (holes ?? []).map((h) => ringToAligned(h, pcx, pcz, negAlignRad));
  const alignedBlocked = (blockedRings ?? [])
    .map((b) => ringToAligned(b, pcx, pcz, negAlignRad))
    .map((r) => expandAlignedRingBBox(r, obstacleM));

  const bbox = alignedRingBBox(alignedOuter, edgeM);

  return {
    alignedOuterRings: [alignedOuter],
    alignedHoles:        alignedHoles.map((h) => expandAlignedRingBBox(h, obstacleM)),
    alignedBlocked,
    bbox,
  };
}

/**
 * 4-corner test in aligned (U,V) — same frame as grid placement.
 * Footprint: width along U, length along V.
 */
function panelFitsAligned(
  au, av, width, length,
  alignedOuterRings, alignedHoles, alignedBlocked,
) {
  const hw = width / 2;
  const hl = length / 2;
  const corners = [
    [au - hw, av - hl], [au + hw, av - hl],
    [au + hw, av + hl], [au - hw, av + hl],
  ];
  return corners.every(([u, v]) =>
    pointIsInstallable(u, v, alignedOuterRings, alignedHoles, alignedBlocked),
  );
}

// ── Turf ring buffer (6C-6 clearances) ────────────────────────────────────────

/** Close an XZ ring [[x,z],…] for turf (repeat first vertex if needed). */
function closedRing(ring) {
  if (!ring?.length) return null;
  const first = ring[0];
  const last  = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function ringToTurfPolygon(ring) {
  const closed = closedRing(ring);
  if (!closed || closed.length < 4) return null;
  return turfPolygon([closed]);
}

/** Extract outer rings from a turf buffer result (Polygon or MultiPolygon). */
function turfFeatureToOuterRings(feature) {
  if (!feature?.geometry) return [];
  const { type, coordinates } = feature.geometry;
  if (type === "Polygon") {
    return [coordinates[0].slice(0, -1)];
  }
  if (type === "MultiPolygon") {
    return coordinates.map((poly) => poly[0].slice(0, -1));
  }
  return [];
}

/**
 * Buffer a scene-XZ ring by distanceM (negative = shrink / inset).
 * Returns zero or more outer rings; empty when the buffer erases the shape.
 */
function bufferRing(ring, distanceM) {
  const poly = ringToTurfPolygon(ring);
  if (!poly) return [];
  try {
    const result = turfBuffer(poly, distanceM, { units: "meters", steps: 8 });
    return turfFeatureToOuterRings(result);
  } catch {
    return [];
  }
}

/** Inset installable outer boundary; expand keep-out rings outward. */
function applyClearanceRings(outerRing, holes, blockedRings, options = {}) {
  const edgeM      = options.edgeClearanceM      ?? EDGE_CLEARANCE_M;
  const obstacleM  = options.obstacleClearanceM  ?? OBSTACLE_CLEARANCE_M;

  const effectiveOuterRings = edgeM > 0
    ? bufferRing(outerRing, -edgeM)
    : [outerRing];

  const expandedHoles = (holes ?? [])
    .filter((h) => h?.length >= 3)
    .flatMap((h) => (obstacleM > 0 ? bufferRing(h, obstacleM) : [h]));

  const expandedBlocked = (blockedRings ?? [])
    .filter((b) => b?.length >= 3)
    .flatMap((b) => (obstacleM > 0 ? bufferRing(b, obstacleM) : [b]));

  return {
    effectiveOuterRings,
    expandedHoles,
    expandedBlocked,
  };
}

function ringAreaWithHoles(outerRing, holes = []) {
  const outerA = shoelaceAreaM2(outerRing);
  const holesA = holes.reduce((s, h) => s + shoelaceAreaM2(h), 0);
  return Math.max(0, outerA - holesA);
}

function sumOuterRingsAreaM2(rings) {
  return (rings ?? []).reduce((s, r) => s + shoelaceAreaM2(r), 0);
}

function classifySlotRejectReasonAligned(au, av, width, length, alignedOuterRings, alignedHoles, alignedBlocked) {
  const hw = width / 2;
  const hl = length / 2;
  const corners = [
    [au - hw, av - hl], [au + hw, av - hl],
    [au + hw, av + hl], [au - hw, av + hl],
  ];
  for (const [u, v] of corners) {
    const inOuter = alignedOuterRings.some((ring) => pointInRing(u, v, ring));
    if (!inOuter) return "outsideRegion";
  }
  for (const [u, v] of corners) {
    for (const hole of alignedHoles) {
      if (hole?.length >= 3 && pointInRing(u, v, hole)) return "hole";
    }
  }
  for (const [u, v] of corners) {
    for (const blocked of alignedBlocked) {
      if (blocked?.length >= 3 && pointInRing(u, v, blocked)) return "blocked";
    }
  }
  return "containment";
}

function dominantRejectReason(rejectStats) {
  const entries = Object.entries(rejectStats ?? {}).filter(([, n]) => n > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { reason: entries[0][0], count: entries[0][1] };
}

/** Rough bbox grid capacity (diagnostics) — cols along U (width), rows along V (length). */
function gridIndexCapacity(spanU, spanV, panelW, panelL, stepCol, stepRow) {
  const colSlots = spanU >= panelW ? Math.floor((spanU - panelW) / stepCol + 1e-9) + 1 : 0;
  const rowSlots = spanV >= panelL ? Math.floor((spanV - panelL) / stepRow + 1e-9) + 1 : 0;
  return { rowSlots, colSlots, bboxCapacity: rowSlots * colSlots };
}

/**
 * Diagnostics only — how well the fixed-origin bbox grid covers irregular fill.
 * Samples valid panel-centre positions on a fine grid inside the placement bbox.
 */
function analyzeGridCoverage({
  alignedOuterRings,
  alignedHoles,
  alignedBlocked,
  bbox,
  polygonAreaM2,
  panelW,
  panelL,
  stepCol,
  stepRow,
  gridLines,
}) {
  const { minX, maxX, minZ, maxZ } = bbox;
  const spanU = maxX - minX;
  const spanV = maxZ - minZ;
  const bboxAreaM2 = spanU * spanV;
  const polygonToBBoxRatio = bboxAreaM2 > 0 ? polygonAreaM2 / bboxAreaM2 : null;

  if (spanU < panelW || spanV < panelL) {
    return {
      bboxAreaM2:              +bboxAreaM2.toFixed(2),
      polygonToBBoxRatio:      polygonToBBoxRatio != null ? +polygonToBBoxRatio.toFixed(3) : null,
      irregularShape:          polygonToBBoxRatio != null && polygonToBBoxRatio < 0.6,
      fillSampleCount:         0,
      gridCoversFill:          null,
      gridPhaseGapU_m:         null,
      gridPhaseGapV_m:         null,
      fillExtentSpanU_m:       0,
      fillExtentSpanV_m:       0,
      gridReachGapU_m:         null,
      gridReachGapV_m:         null,
      theoreticalFillSlots:    0,
      coverageVerdict:         "bbox too small for panel",
    };
  }

  const fillExtent = computeFillExtent(
    alignedOuterRings, alignedHoles, alignedBlocked, bbox, panelW, panelL,
  );

  const sampleStep = Math.min(0.2, stepCol / 5, stepRow / 5);
  let fillMinU = Infinity;
  let fillMaxU = -Infinity;
  let fillMinV = Infinity;
  let fillMaxV = -Infinity;
  let fillSampleCount = 0;

  const hw = panelW / 2;
  const hl = panelL / 2;
  const uMin = minX + hw;
  const uMax = maxX - hw;
  const vMin = minZ + hl;
  const vMax = maxZ - hl;

  for (let v = vMin; v <= vMax + 1e-9; v += sampleStep) {
    for (let u = uMin; u <= uMax + 1e-9; u += sampleStep) {
      if (panelFitsAligned(u, v, panelW, panelL, alignedOuterRings, alignedHoles, alignedBlocked)) {
        fillMinU = Math.min(fillMinU, u);
        fillMaxU = Math.max(fillMaxU, u);
        fillMinV = Math.min(fillMinV, v);
        fillMaxV = Math.max(fillMaxV, v);
        fillSampleCount += 1;
      }
    }
  }

  const uLines = gridLines?.uLines ?? [];
  const vLines = gridLines?.vLines ?? [];
  const gridFirstU = uLines[0] ?? null;
  const gridFirstV = vLines[0] ?? null;
  const gridLastU  = uLines.length ? uLines[uLines.length - 1] : null;
  const gridLastV  = vLines.length ? vLines[vLines.length - 1] : null;

  const modPos = (x, step) => ((x % step) + step) % step;

  let gridPhaseGapU_m = null;
  let gridPhaseGapV_m = null;
  let gridReachGapU_m = null;
  let gridReachGapV_m = null;
  let fillExtentSpanU_m = 0;
  let fillExtentSpanV_m = 0;
  let gridCoversFill = null;
  let coverageVerdict = "no fillable samples";

  if (fillSampleCount > 0 && fillExtent) {
    fillExtentSpanU_m = fillExtent.fillMaxU - fillExtent.fillMinU;
    fillExtentSpanV_m = fillExtent.fillMaxV - fillExtent.fillMinV;
    gridPhaseGapU_m = gridFirstU != null ? modPos(fillExtent.fillMinU - gridFirstU, stepCol) : null;
    gridPhaseGapV_m = gridFirstV != null ? modPos(fillExtent.fillMinV - gridFirstV, stepRow) : null;
    gridReachGapU_m = gridLastU != null
      ? Math.max(0, fillExtent.fillMaxU - gridLastU)
      : null;
    gridReachGapV_m = gridLastV != null
      ? Math.max(0, fillExtent.fillMaxV - gridLastV)
      : null;
    gridCoversFill = gridReachGapU_m < stepCol * 0.5 && gridReachGapV_m < stepRow * 0.5;

    if (!gridCoversFill) {
      coverageVerdict = "grid origin/step misses fill extent at one or both edges";
    } else if (gridPhaseGapU_m > stepCol * 0.35 || gridPhaseGapV_m > stepRow * 0.35) {
      coverageVerdict = "fixed grid phase leaves strip gaps inside fill (coarse step + offset)";
    } else if (polygonToBBoxRatio != null && polygonToBBoxRatio < 0.6) {
      coverageVerdict = "irregular polygon — bbox grid scans mostly empty space";
    } else {
      coverageVerdict = "grid span covers fill; low count is rejection-driven";
    }
  }

  const theoreticalFillSlots = fillSampleCount > 0
    ? Math.floor((fillExtentSpanU_m / stepCol + 1e-9) + 1)
      * Math.floor((fillExtentSpanV_m / stepRow + 1e-9) + 1)
    : 0;

  return {
    bboxAreaM2:           +bboxAreaM2.toFixed(2),
    polygonToBBoxRatio:   polygonToBBoxRatio != null ? +polygonToBBoxRatio.toFixed(3) : null,
    irregularShape:       polygonToBBoxRatio != null && polygonToBBoxRatio < 0.6,
    fillSampleCount,
    fillExtentSpanU_m:    +fillExtentSpanU_m.toFixed(2),
    fillExtentSpanV_m:    +fillExtentSpanV_m.toFixed(2),
    gridFirstU_m:         gridFirstU != null ? +gridFirstU.toFixed(3) : null,
    gridFirstV_m:         gridFirstV != null ? +gridFirstV.toFixed(3) : null,
    gridLastU_m:          gridLastU != null ? +gridLastU.toFixed(3) : null,
    gridLastV_m:          gridLastV != null ? +gridLastV.toFixed(3) : null,
    gridPhaseGapU_m:      gridPhaseGapU_m != null ? +gridPhaseGapU_m.toFixed(3) : null,
    gridPhaseGapV_m:      gridPhaseGapV_m != null ? +gridPhaseGapV_m.toFixed(3) : null,
    gridReachGapU_m:      gridReachGapU_m != null ? +gridReachGapU_m.toFixed(3) : null,
    gridReachGapV_m:      gridReachGapV_m != null ? +gridReachGapV_m.toFixed(3) : null,
    gridCoversFill,
    theoreticalFillSlots,
    coverageVerdict,
    gridPhaseU:           gridLines?.phaseU ?? 0,
    gridPhaseV:           gridLines?.phaseV ?? 0,
  };
}

/**
 * Grid steps in roof-aligned (U,V) frame:
 *   columns (within-row, side-by-side) step along U by panel width + rail gap
 *   rows (between-row pitch) step along V by panel length + inter-row gap
 */
function gridSteps(panelW, panelL, gapM, includeInterRowGap = true) {
  return {
    stepCol: panelW + gapM,
    stepRow: panelL + (includeInterRowGap ? INTER_ROW_GAP_M : 0),
  };
}

/** Phase samples per axis when picking the grid that maximises valid panel count. */
const GRID_PHASE_SAMPLES = 4;

/** Terminal-anchor threshold — add a far-edge line when the last step falls short. */
const GRID_TERMINAL_GAP_FRAC = 0.25;

/**
 * Sample valid panel-centre positions to find the reachable fill extent in aligned UV.
 * Used to anchor the grid to polygon fill, not the bbox corner.
 */
function computeFillExtent(alignedOuterRings, alignedHoles, alignedBlocked, bbox, panelW, panelL) {
  const { minX, maxX, minZ, maxZ } = bbox;
  const hw = panelW / 2;
  const hl = panelL / 2;
  const uMin = minX + hw;
  const uMax = maxX - hw;
  const vMin = minZ + hl;
  const vMax = maxZ - hl;

  if (uMax < uMin || vMax < vMin) return null;

  const sampleStep = Math.min(0.15, (panelW + PANEL_GAP_M) / 8, (panelL + INTER_ROW_GAP_M) / 8);
  let fillMinU = Infinity;
  let fillMaxU = -Infinity;
  let fillMinV = Infinity;
  let fillMaxV = -Infinity;

  for (let v = vMin; v <= vMax + 1e-9; v += sampleStep) {
    for (let u = uMin; u <= uMax + 1e-9; u += sampleStep) {
      if (panelFitsAligned(u, v, panelW, panelL, alignedOuterRings, alignedHoles, alignedBlocked)) {
        fillMinU = Math.min(fillMinU, u);
        fillMaxU = Math.max(fillMaxU, u);
        fillMinV = Math.min(fillMinV, v);
        fillMaxV = Math.max(fillMaxV, v);
      }
    }
  }

  if (fillMinU === Infinity) return null;

  return { fillMinU, fillMaxU, fillMinV, fillMaxV };
}

/**
 * Grid lines along one axis from fillMin to fillMax.
 * Includes a terminal anchor at fillMax when the last regular step falls short.
 */
function buildGridAxisLines(minCenter, maxCenter, step, phaseOffset = 0) {
  if (maxCenter < minCenter - 1e-9) return [];

  const lines = [];
  let x = minCenter + phaseOffset;
  if (x > maxCenter + 1e-9) x = minCenter;

  while (x <= maxCenter + 1e-9) {
    lines.push(x);
    x += step;
  }

  const last = lines[lines.length - 1];
  const terminalThreshold = step * GRID_TERMINAL_GAP_FRAC;
  if (last !== undefined && maxCenter - last > terminalThreshold + 1e-9) {
    const lastLine = lines[lines.length - 1];
    if (Math.abs(lastLine - maxCenter) > 1e-6) {
      lines.push(maxCenter);
    }
  }

  return lines;
}

/** Build U/V grid line arrays for one phase offset pair. */
function buildRegionGridLines(fillExtent, stepCol, stepRow, phaseU = 0, phaseV = 0) {
  if (!fillExtent) return { uLines: [], vLines: [] };
  const { fillMinU, fillMaxU, fillMinV, fillMaxV } = fillExtent;
  return {
    uLines: buildGridAxisLines(fillMinU, fillMaxU, stepCol, phaseU),
    vLines: buildGridAxisLines(fillMinV, fillMaxV, stepRow, phaseV),
  };
}

/**
 * Deterministic multi-pass phase pick: try a small phase grid and keep the layout
 * with the most valid panels (tie-break: smallest phase indices).
 */
function pickBestRegionGrid({
  fillExtent,
  stepCol,
  stepRow,
  panelW,
  panelL,
  alignedOuterRings,
  alignedHoles,
  alignedBlocked,
}) {
  if (!fillExtent) {
    return { uLines: [], vLines: [], phaseU: 0, phaseV: 0, accepted: 0 };
  }

  let best = null;

  for (let pu = 0; pu < GRID_PHASE_SAMPLES; pu++) {
    const phaseU = (pu / GRID_PHASE_SAMPLES) * stepCol;
    for (let pv = 0; pv < GRID_PHASE_SAMPLES; pv++) {
      const phaseV = (pv / GRID_PHASE_SAMPLES) * stepRow;
      const { uLines, vLines } = buildRegionGridLines(fillExtent, stepCol, stepRow, phaseU, phaseV);

      let accepted = 0;
      /** @type {{ row: number, col: number }[]} */
      const acceptedCells = [];
      for (let row = 0; row < vLines.length; row++) {
        const av = vLines[row];
        for (let col = 0; col < uLines.length; col++) {
          const au = uLines[col];
          if (panelFitsAligned(au, av, panelW, panelL, alignedOuterRings, alignedHoles, alignedBlocked)) {
            accepted += 1;
            acceptedCells.push({ row, col });
          }
        }
      }

      const longestRow = computeLongestRowLength(
        acceptedCells.map(({ row, col }) => ({
          slotId: `${row}::${col}`,
          regionId: "_",
          row,
          col,
        })),
      );

      if (
        !best
        || isBetterGridPhase(accepted, longestRow, best.accepted, best.longestRow)
        || (
          accepted === best.accepted
          && longestRow === best.longestRow
          && (pu < best.pu || (pu === best.pu && pv < best.pv))
        )
      ) {
        best = { uLines, vLines, phaseU, phaseV, pu, pv, accepted, longestRow };
      }
    }
  }

  return best ?? { uLines: [], vLines: [], phaseU: 0, phaseV: 0, accepted: 0 };
}

/** Iterate grid candidates; optionally tally reject reasons (diagnostics). */
function scanRegionGrid({
  uLines,
  vLines,
  panelW,
  panelL,
  alignedOuterRings,
  alignedHoles,
  alignedBlocked,
  rejectStats,
}) {
  let candidates = 0;
  let accepted = 0;

  for (const av of vLines) {
    for (const au of uLines) {
      candidates += 1;
      if (panelFitsAligned(au, av, panelW, panelL, alignedOuterRings, alignedHoles, alignedBlocked)) {
        accepted += 1;
      } else if (rejectStats) {
        const reason = classifySlotRejectReasonAligned(
          au, av, panelW, panelL,
          alignedOuterRings, alignedHoles, alignedBlocked,
        );
        rejectStats[reason] = (rejectStats[reason] ?? 0) + 1;
      }
    }
  }

  return {
    candidates,
    accepted,
    rowCount: vLines.length,
    colCount: uLines.length,
  };
}

/** Shared fill-aware grid for placement + diagnostics. */
function buildRegionPlacementGrid({
  alignedOuterRings,
  alignedHoles,
  alignedBlocked,
  bbox,
  panelW,
  panelL,
  stepCol,
  stepRow,
}) {
  const fillExtent = computeFillExtent(
    alignedOuterRings, alignedHoles, alignedBlocked, bbox, panelW, panelL,
  );
  if (!fillExtent) {
    return { fillExtent: null, uLines: [], vLines: [], phaseU: 0, phaseV: 0, accepted: 0 };
  }

  const best = pickBestRegionGrid({
    fillExtent,
    stepCol,
    stepRow,
    panelW,
    panelL,
    alignedOuterRings,
    alignedHoles,
    alignedBlocked,
  });

  return { fillExtent, ...best };
}

/** Count grid candidates + accepted slots for one region (diagnostics only). */
function countRegionGridSlots({
  outerRing,
  holes,
  blockedRings,
  alignRad,
  negAlignRad,
  pcx,
  pcz,
  panelW,
  panelL,
  stepCol,
  stepRow,
  options,
  rejectStats,
}) {
  const {
    alignedOuterRings,
    alignedHoles,
    alignedBlocked,
    bbox,
  } = buildAlignedContainment(outerRing, holes, blockedRings, pcx, pcz, negAlignRad, options);

  const { minX, maxX, minZ, maxZ } = bbox;
  if (maxX - minX < panelW || maxZ - minZ < panelL) {
    return {
      candidates: 0, accepted: 0, rowCount: 0, colCount: 0,
      alignedBBox: { minX, maxX, minZ, maxZ, spanU: 0, spanV: 0 },
      gridCapacity: { rowSlots: 0, colSlots: 0, bboxCapacity: 0 },
      gridLines: { uLines: [], vLines: [], phaseU: 0, phaseV: 0 },
    };
  }

  const grid = buildRegionPlacementGrid({
    alignedOuterRings,
    alignedHoles,
    alignedBlocked,
    bbox,
    panelW,
    panelL,
    stepCol,
    stepRow,
  });

  const scan = scanRegionGrid({
    uLines: grid.uLines,
    vLines: grid.vLines,
    panelW,
    panelL,
    alignedOuterRings,
    alignedHoles,
    alignedBlocked,
    rejectStats,
  });

  const spanU = maxX - minX;
  const spanV = maxZ - minZ;

  return {
    ...scan,
    alignedBBox:  { minX, maxX, minZ, maxZ, spanU, spanV },
    gridCapacity: gridIndexCapacity(spanU, spanV, panelW, panelL, stepCol, stepRow),
    gridLines:    { uLines: grid.uLines, vLines: grid.vLines, phaseU: grid.phaseU, phaseV: grid.phaseV },
  };
}

/** Turf buffer audit + sample coordinate probe (diagnostics only). */
function auditTurfBufferUsage(sampleRing) {
  const closed = closedRing(sampleRing);
  const sample = closed?.[0] ?? null;
  const poly   = sampleRing ? ringToTurfPolygon(sampleRing) : null;

  let turfAreaM2 = null;
  let turfAreaAfterInsetM2 = null;
  if (poly) {
    try {
      turfAreaM2 = turfArea(poly);
      const inset = turfBuffer(poly, -EDGE_CLEARANCE_M, { units: "meters", steps: 8 });
      turfAreaAfterInsetM2 = inset ? turfArea(inset) : 0;
    } catch {
      /* leave null */
    }
  }

  const shoelaceBefore = sampleRing ? shoelaceAreaM2(sampleRing) : null;
  const shoelaceAfter  = sampleRing
    ? sumOuterRingsAreaM2(bufferRing(sampleRing, -EDGE_CLEARANCE_M))
    : null;

  return {
    coordinateSpace:
      "Scene XZ metres (X=East, Z=South) passed to turf as [x,z] → interpreted as [longitude, latitude]",
    note:
      "turf.difference in 5H is topological; turf.buffer uses geodetic metres — potential mismatch",
    calls: [
      {
        site:        "bufferRing → edge inset",
        distance:    -EDGE_CLEARANCE_M,
        units:       "meters",
        steps:       8,
        coordinates: "scene XZ ring → turfPolygon([closedRing])",
      },
      {
        site:        "bufferRing → hole/block expand",
        distance:    OBSTACLE_CLEARANCE_M,
        units:       "meters",
        steps:       8,
        coordinates: "scene XZ ring → turfPolygon([closedRing])",
      },
    ],
    sampleVertex: sample,
    areaComparison: {
      shoelaceBeforeM2:     shoelaceBefore,
      shoelaceAfterInsetM2: shoelaceAfter,
      shoelacePctLost:      shoelaceBefore > 0
        ? ((shoelaceBefore - shoelaceAfter) / shoelaceBefore) * 100
        : null,
      turfAreaBeforeM2:     turfAreaM2,
      turfAreaAfterInsetM2: turfAreaAfterInsetM2,
      turfPctLost:          turfAreaM2 > 0
        ? ((turfAreaM2 - turfAreaAfterInsetM2) / turfAreaM2) * 100
        : null,
    },
  };
}

function logPanelClearanceDiagnostics({
  placementReady,
  selectedPanel,
  installableRegions,
  blockedRegions,
  allValidSlots,
  gapM,
  panelW,
  panelL,
  stepCol,
  stepRow,
  options,
}) {
  const { stepCol: stepColPre, stepRow: stepRowPre } = gridSteps(panelW, panelL, gapM, false);

  const global = {
    totalInstallableAreaBeforeClearancesM2: 0,
    totalInstallableAreaAfterEdgeInsetM2:   0,
    panelCountBefore6C6:                    0,
    panelCountAfter6C6:                     allValidSlots.length,
    regionCount:                            installableRegions.length,
  };

  const perRegion = [];
  const firstRing = installableRegions.find((r) => r.outerRing?.length >= 3)?.outerRing ?? null;
  const bufferAudit = auditTurfBufferUsage(firstRing);

  for (const region of installableRegions) {
    const { outerRing, holes = [], roofId, id: regionId, azimuth = 180, areaM2 } = region;
    if (!outerRing || outerRing.length < 3) continue;

    const { x: pcx, z: pcz } = ringCentroid(outerRing);
    const alignRad    = (azimuth * Math.PI) / 180;
    const negAlignRad = -alignRad;

    const blockedRings = blockedRegions
      .filter((b) => b.roofId === roofId)
      .map((b) => b.outerRing)
      .filter((r) => r?.length >= 3);

    const originalAreaM2 = areaM2 ?? ringAreaWithHoles(outerRing, holes);

    const alignedOuter = ringToAligned(outerRing, pcx, pcz, negAlignRad);
    const edgeM        = options.edgeClearanceM ?? EDGE_CLEARANCE_M;
    const fullBbox     = alignedRingBBox(alignedOuter, 0);
    const insetBbox    = alignedRingBBox(alignedOuter, edgeM);
    const afterEdgeInsetAreaM2 = Math.max(
      0,
      (insetBbox.maxX - insetBbox.minX) * (insetBbox.maxZ - insetBbox.minZ)
        - holes.reduce((s, h) => s + shoelaceAreaM2(h), 0),
    );
    const pctAreaLost = originalAreaM2 > 0
      ? ((originalAreaM2 - afterEdgeInsetAreaM2) / originalAreaM2) * 100
      : 0;

    global.totalInstallableAreaBeforeClearancesM2 += originalAreaM2;
    global.totalInstallableAreaAfterEdgeInsetM2   += afterEdgeInsetAreaM2;

    const rejectStats = {
      outsideRegion: 0,
      hole:          0,
      blocked:       0,
      containment:   0,
    };

    const {
      alignedOuterRings,
      alignedHoles,
      alignedBlocked,
      bbox: gridBbox,
    } = buildAlignedContainment(outerRing, holes, blockedRings, pcx, pcz, negAlignRad, options);

    const post6C6 = countRegionGridSlots({
      outerRing,
      holes,
      blockedRings,
      alignRad,
      negAlignRad,
      pcx,
      pcz,
      panelW,
      panelL,
      stepCol,
      stepRow,
      options,
      rejectStats,
    });

    const gridCoverage = analyzeGridCoverage({
      alignedOuterRings,
      alignedHoles,
      alignedBlocked,
      bbox:            gridBbox,
      polygonAreaM2:   originalAreaM2,
      panelW,
      panelL,
      stepCol,
      stepRow,
      gridLines:       post6C6.gridLines,
    });

    const fullBboxAreaM2 = (fullBbox.maxX - fullBbox.minX) * (fullBbox.maxZ - fullBbox.minZ);

    const pre6C6 = countRegionGridSlots({
      outerRing,
      holes,
      blockedRings,
      alignRad,
      negAlignRad,
      pcx,
      pcz,
      panelW,
      panelL,
      stepCol: stepColPre,
      stepRow: stepRowPre,
      options: { ...options, edgeClearanceM: 0, obstacleClearanceM: 0 },
    });

    global.panelCountBefore6C6 += pre6C6.accepted;

    const accepted = allValidSlots.filter((s) => s.regionId === regionId).length;
    const moduleAreaM2 = panelW * panelL;
    const theoreticalAt100Pct = Math.floor(originalAreaM2 / moduleAreaM2);
    const dominant = dominantRejectReason(rejectStats);

    perRegion.push({
      regionId,
      roofId,
      azimuthDeg:               azimuth,
      originalAreaM2:           +originalAreaM2.toFixed(2),
      moduleFootprintM2:        +moduleAreaM2.toFixed(3),
      theoreticalPanels100Pct:  theoreticalAt100Pct,
      afterEdgeInsetAreaM2:     +afterEdgeInsetAreaM2.toFixed(2),
      pctAreaLostFromEdgeInset: +pctAreaLost.toFixed(1),
      alignedBBoxSpanU_m:       +post6C6.alignedBBox.spanU.toFixed(2),
      alignedBBoxSpanV_m:       +post6C6.alignedBBox.spanV.toFixed(2),
      bboxAreaM2:               gridCoverage.bboxAreaM2,
      fullBboxAreaM2:           +fullBboxAreaM2.toFixed(2),
      polygonToBBoxRatio:       gridCoverage.polygonToBBoxRatio,
      irregularShape:           gridCoverage.irregularShape,
      gridCoverage,
      gridRowIndexCount:        post6C6.rowCount,
      gridColIndexCount:        post6C6.colCount,
      bboxGridCapacity:         post6C6.gridCapacity.bboxCapacity,
      candidateGridSlots:       post6C6.candidates,
      slotsAccepted:            accepted,
      slotsRejected:            post6C6.candidates - accepted,
      acceptRatePct:            post6C6.candidates > 0
        ? +((accepted / post6C6.candidates) * 100).toFixed(1)
        : 0,
      rejectedBecause:          { ...rejectStats },
      dominantRejectReason:     dominant?.reason ?? null,
      dominantRejectCount:      dominant?.count ?? 0,
      panelCountPre6C6Baseline: pre6C6.accepted,
      holeCount:                (holes ?? []).length,
      blockedRingsOnRoof:       blockedRings.length,
      gridSteps: {
        post6C6: { stepCol, stepRow, note: "cols along U (width+gap), rows along V (length+interRow)" },
        pre6C6:  { stepCol: stepColPre, stepRow: stepRowPre },
      },
    });
  }

  console.group("[Step 6C-6] Per-region placement diagnostics");
  console.log("Panel module:", {
    id: selectedPanel?.id,
    widthM: panelW,
    lengthM: panelL,
    footprintM2: +(panelW * panelL).toFixed(3),
  });
  console.log("Global:", {
    regionCount:                            global.regionCount,
    totalInstallableAreaBeforeClearancesM2: +global.totalInstallableAreaBeforeClearancesM2.toFixed(2),
    panelCountBefore6C6:                    global.panelCountBefore6C6,
    panelCountAfter6C6:                     global.panelCountAfter6C6,
    placementReadySummaryM2:                placementReady?.summary?.totalInstallableAreaM2 ?? null,
  });
  console.table(perRegion.map((r) => ({
    regionId:           r.regionId,
    polygonM2:          r.originalAreaM2,
    bboxUxV_m:          `${r.alignedBBoxSpanU_m}x${r.alignedBBoxSpanV_m}`,
    bboxAreaM2:         r.bboxAreaM2,
    polyDivBbox:        r.polygonToBBoxRatio,
    irregular:          r.irregularShape ? "YES" : "no",
    generated:          r.candidateGridSlots,
    accepted:           r.slotsAccepted,
    rejected:           r.slotsRejected,
    acceptPct:          r.acceptRatePct,
    dominantReject:     r.dominantRejectReason,
    outside:            r.rejectedBecause.outsideRegion,
    hole:               r.rejectedBecause.hole,
    blocked:            r.rejectedBecause.blocked,
    theoretical100Pct:  r.theoreticalPanels100Pct,
  })));
  console.log("Grid coverage vs irregular fill (per region):");
  console.table(perRegion.map((r) => ({
    regionId:        r.regionId,
    fillSpanUxV_m:   `${r.gridCoverage.fillExtentSpanU_m}x${r.gridCoverage.fillExtentSpanV_m}`,
    gridPhaseGapU:   r.gridCoverage.gridPhaseGapU_m,
    gridPhaseGapV:   r.gridCoverage.gridPhaseGapV_m,
    gridReachGapU:   r.gridCoverage.gridReachGapU_m,
    gridReachGapV:   r.gridCoverage.gridReachGapV_m,
    coversFill:      r.gridCoverage.gridCoversFill,
    coverageVerdict: r.gridCoverage.coverageVerdict,
  })));
  console.log("Turf buffer audit (6C-6 near-no-op):", bufferAudit.areaComparison);
  console.groupEnd();

  return { global, perRegion, bufferAudit };
}

function slotToPanel(slot) {
  return {
    id:          slot.slotId,
    slotId:      slot.slotId,
    regionId:    slot.regionId,
    roofId:      slot.roofId,
    center:      slot.center,
    width:       slot.width,
    length:      slot.length,
    rotation:    slot.rotation,
    panelTypeId: slot.panelTypeId,
    row:         slot.row,
    col:         slot.col,
  };
}

/**
 * Re-validate every placed panel against the same aligned containment used at slot generation.
 * Hard failure when any panel would not pass panelFitsAligned().
 *
 * @param {object[]} placedPanels
 * @param {Map<string, object>} regionValidationById
 * @returns {{ valid: boolean, failures: object[] }}
 */
function verifyPlacedPanels(placedPanels, regionValidationById) {
  /** @type {object[]} */
  const failures = [];

  for (const panel of placedPanels) {
    const ctx = regionValidationById.get(panel.regionId);
    if (!ctx) {
      failures.push({ slotId: panel.slotId, reason: "missing_region_context" });
      continue;
    }

    const { alignRad, pcx, pcz, alignedOuterRings, alignedHoles, alignedBlocked } = ctx;
    const negAlignRad = -alignRad;
    const worldX = panel.center.x;
    const worldZ = panel.center.z;
    const aligned = rotate2D(worldX, worldZ, negAlignRad, pcx, pcz);

    if (!panelFitsAligned(
      aligned.x, aligned.z,
      panel.width, panel.length,
      alignedOuterRings, alignedHoles, alignedBlocked,
    )) {
      failures.push({ slotId: panel.slotId, reason: "panelFitsAligned_failed" });
    }
  }

  return { valid: failures.length === 0, failures };
}

// ── Main placement ────────────────────────────────────────────────────────────

/**
 * Compute all legal grid slots per installable region.
 *
 * @returns {{
 *   allValidSlots: object[],
 *   placedPanels: object[],
 *   summary: { total, byRegion, totalValidSlots }
 * }}
 */
export function computePanelLayout(placementReady, selectedPanel, options = {}) {
  const empty = {
    allValidSlots:  [],
    placedPanels:   [],
    defaultRemoved: [],
    summary:        { total: 0, byRegion: {}, totalValidSlots: 0 },
    layoutPolicy:   null,
    validation:     { valid: true, failures: [] },
  };

  if (!placementReady || !selectedPanel) return empty;

  const { installableRegions = [], blockedRegions = [] } = placementReady;
  if (!installableRegions.length) return empty;

  const gapM   = options.gapM ?? PANEL_GAP_M;
  const panelW = selectedPanel.width;
  const panelL = selectedPanel.height;
  const { stepCol, stepRow } = gridSteps(panelW, panelL, gapM, true);

  const allValidSlots = [];
  const byRegion      = {};
  /** @type {Map<string, object>} */
  const regionValidationById = new Map();

  for (const region of installableRegions) {
    const { outerRing, holes = [], roofId, id: regionId, azimuth = 180 } = region;
    if (!outerRing || outerRing.length < 3) continue;

    const { x: pcx, z: pcz } = ringCentroid(outerRing);
    const alignRad    = (azimuth * Math.PI) / 180;
    const negAlignRad = -alignRad;

    const blockedRings = blockedRegions
      .filter((b) => b.roofId === roofId)
      .map((b) => b.outerRing)
      .filter((r) => r?.length >= 3);

    const {
      alignedOuterRings,
      alignedHoles,
      alignedBlocked,
      bbox,
    } = buildAlignedContainment(outerRing, holes, blockedRings, pcx, pcz, negAlignRad, options);

    regionValidationById.set(regionId, {
      alignRad,
      pcx,
      pcz,
      alignedOuterRings,
      alignedHoles,
      alignedBlocked,
    });

    const { minX, maxX, minZ, maxZ } = bbox;
    if (maxX - minX < panelW || maxZ - minZ < panelL) continue;

    const grid = buildRegionPlacementGrid({
      alignedOuterRings,
      alignedHoles,
      alignedBlocked,
      bbox,
      panelW,
      panelL,
      stepCol,
      stepRow,
    });

    let regionCount = 0;

    // Rows along V; columns within row along U — lines span polygon fill extent.
    for (let row = 0; row < grid.vLines.length; row++) {
      const av = grid.vLines[row];
      for (let col = 0; col < grid.uLines.length; col++) {
        const au = grid.uLines[col];
        if (!panelFitsAligned(
          au, av, panelW, panelL,
          alignedOuterRings, alignedHoles, alignedBlocked,
        )) continue;

        const world = rotate2D(au, av, alignRad, pcx, pcz);

        const slotId = `${regionId}::${row}::${col}`;
        allValidSlots.push({
          slotId,
          regionId,
          roofId,
          center:      { x: world.x, z: world.z },
          width:       panelW,
          length:      panelL,
          rotation:    alignRad,
          panelTypeId: selectedPanel.id,
          row,
          col,
        });
        regionCount += 1;
      }
    }

    byRegion[regionId] = regionCount;
  }

  const professionalLayout = selectProfessionalLayoutSlots(allValidSlots);
  const defaultRemovedSet  = new Set(professionalLayout.defaultRemoved);
  const placedPanels = allValidSlots
    .filter((s) => !defaultRemovedSet.has(s.slotId))
    .map(slotToPanel);

  const validation = verifyPlacedPanels(placedPanels, regionValidationById);
  if (!validation.valid) {
    const msg = `[panelPlacement] Engineering validation failed for ${validation.failures.length} panel(s)`;
    console.error(msg, validation.failures);
    throw new Error(msg);
  }

  const activeByRegion = {};
  for (const panel of placedPanels) {
    activeByRegion[panel.regionId] = (activeByRegion[panel.regionId] ?? 0) + 1;
  }

  const layoutPolicy = {
    strategy:     "professional_phase1",
    metrics:      professionalLayout.metrics,
    decisions:    professionalLayout.decisions,
    defaultRemoved: professionalLayout.defaultRemoved,
  };

  if (options.placementDiagnostics !== false) {
    console.group("[Step 6] Professional layout policy (Phase 1)");
    console.log("Metrics:", layoutPolicy.metrics);
    console.log("Decisions:", layoutPolicy.decisions);
    console.log("Validation:", validation);
    console.groupEnd();
  }

  const diagnostics = options.placementDiagnostics !== false
    ? logPanelClearanceDiagnostics({
        placementReady,
        selectedPanel,
        installableRegions,
        blockedRegions,
        allValidSlots,
        gapM,
        panelW,
        panelL,
        stepCol,
        stepRow,
        options,
      })
    : null;

  return {
    allValidSlots,
    placedPanels,
    defaultRemoved: professionalLayout.defaultRemoved,
    summary: {
      total:           placedPanels.length,
      byRegion:        activeByRegion,
      totalValidSlots: allValidSlots.length,
    },
    layoutPolicy,
    validation,
    diagnostics,
  };
}

/**
 * Derive capacity KPIs from an effective layout (6A-4 / 6B-1).
 */
export function computePanelCapacity(panelLayout, selectedPanel, placementReady) {
  const panelCount = panelLayout?.placedPanels?.length ?? 0;
  const powerW       = selectedPanel?.power ?? 0;
  const moduleArea   = (selectedPanel?.width ?? 0) * (selectedPanel?.height ?? 0);
  const totalPanelAreaM2   = panelCount * moduleArea;
  const installableAreaM2  = placementReady?.summary?.totalInstallableAreaM2 ?? 0;
  const coveragePct = installableAreaM2 > 0
    ? (totalPanelAreaM2 / installableAreaM2) * 100
    : 0;

  return {
    panelCount,
    systemKw:           (panelCount * powerW) / 1000,
    coveragePct,
    totalPanelAreaM2,
    installableAreaM2,
  };
}
