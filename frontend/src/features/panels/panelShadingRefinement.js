/**
 * panelShadingRefinement.js — Mount Height engineering filter (pure).
 *
 * Runs AFTER panel placement, BEFORE energy. Reuses immutable 4B/4C shadow results;
 * does NOT raycast or rerun Solar Simulation.
 *
 * Mount height = roof deck → bottom of mounting rails.
 * Obstacle height < mount height → excluded from panel shading (clearance).
 * Obstacle height >= mount height → existing simulation still determines exposure.
 */

import { scoreCell } from "../simulation/exposureScore.js";
import { pointInRing } from "../zones/zoneGeometryUtils.js";
import { obstacleOuterRing } from "../zones/placementReady.js";
import { resolveEffectivePanelConfig } from "./panelConfig.js";

export const SHADING_ENGINEERING_STATUS = /** @type {const} */ ({
  CLEARANCE:   "clearance",
  POSSIBLE:    "possible",
  SIGNIFICANT: "significant",
});

/** @typedef {"clearance"|"possible"|"significant"} ShadingEngineeringStatus */

/**
 * @typedef {object} PanelShadingEntry
 * @property {string} slotId
 * @property {string} regionId
 * @property {string} roofId
 * @property {number} effectiveExposure  0–100
 * @property {number} simulationExposure 0–100 (before mount-height filter)
 * @property {number} mountHeight
 */

/**
 * @typedef {object} ObstacleShadingEntry
 * @property {string} id
 * @property {string} name
 * @property {number} height
 * @property {number} width
 * @property {number} length
 * @property {number} mountHeight
 * @property {ShadingEngineeringStatus} status
 * @property {string} impactLabel  Negligible | Low | Moderate | High
 * @property {string} summary
 */

function panelFootprintRing(panel) {
  const cx = panel.center?.x ?? 0;
  const cz = panel.center?.z ?? 0;
  const w = panel.width ?? 0;
  const l = panel.length ?? 0;
  const rot = panel.rotation ?? 0;
  const hw = w / 2;
  const hl = l / 2;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([lx, lz]) => [
    cx + lx * cos + lz * sin,
    cz - lx * sin + lz * cos,
  ]);
}

function pointInObstacleFootprint(x, z, obstacle) {
  const ring = obstacleOuterRing(obstacle);
  return pointInRing(x, z, ring);
}

function panelOverlapsObstacle(panel, obstacle) {
  if (panel.roofId !== obstacle.roofId) return false;
  const ring = panelFootprintRing(panel);
  if (ring.some(([x, z]) => pointInObstacleFootprint(x, z, obstacle))) return true;
  const cx = panel.center?.x ?? 0;
  const cz = panel.center?.z ?? 0;
  return pointInObstacleFootprint(cx, cz, obstacle);
}

function panelSamplePoints(panel) {
  const cx = panel.center?.x ?? 0;
  const cz = panel.center?.z ?? 0;
  return [[cx, cz], ...panelFootprintRing(panel)];
}

function findNearestCell(cells, x, z) {
  if (!cells?.length) return null;
  let best = cells[0];
  let bestD = Infinity;
  for (const c of cells) {
    const d = (c.x - x) ** 2 + (c.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function findPlacementAreaForRegion(regionId, placementReady, placementAreas) {
  const region = placementReady?.installableRegions?.find((r) => r.id === regionId);
  const sourceId = region?.sourceId ?? String(regionId).split("::")[0];
  return placementAreas.find((a) => a.id === sourceId) ?? null;
}

function mountHeightForPanel(panel, placementAreas, projectDefaults, placementReady) {
  const area = findPlacementAreaForRegion(panel.regionId, placementReady, placementAreas);
  const cfg = resolveEffectivePanelConfig(projectDefaults, area?.panelProperties);
  return Math.max(0, Number(cfg.mountHeight) || 0);
}

function mountHeightForRoof(roofId, placedPanels, placementAreas, projectDefaults, placementReady) {
  const onRoof = placedPanels.filter((p) => p.roofId === roofId);
  if (!onRoof.length) return Math.max(0, Number(projectDefaults?.mountHeight) || 0);
  return Math.max(
    ...onRoof.map((p) => mountHeightForPanel(p, placementAreas, projectDefaults, placementReady)),
  );
}

function overlappingObstacles(panel, obstacles) {
  return obstacles.filter((o) => panelOverlapsObstacle(panel, o));
}

/**
 * Refine exposure at one sample point (center or corner).
 *
 * @param {number} x
 * @param {number} z
 * @param {object|null} expRoof
 * @param {object[]} roofObstacles  obstacles on the same roof
 * @param {number} mountHeight
 * @returns {{ effectiveExposure: number, simulationExposure: number }}
 */
function refineSampleExposure(x, z, expRoof, roofObstacles, mountHeight) {
  const cell = findNearestCell(expRoof?.cells, x, z);
  const orientFactor = expRoof?.orientFactor ?? 1;
  const simulationExposure = cell?.exposureScore ?? 0;

  const atPoint = roofObstacles.filter((o) => pointInObstacleFootprint(x, z, o));
  const reachable = atPoint.filter((o) => (o.height ?? 0) >= mountHeight);

  if (cell?.underObstacle && reachable.length === 0) {
    const cleared = scoreCell({ shadePct: 0, underObstacle: false }, orientFactor);
    return { effectiveExposure: cleared, simulationExposure };
  }

  return { effectiveExposure: simulationExposure, simulationExposure };
}

/**
 * Compute per-panel effective exposure after mount-height clearance filtering.
 * Samples center + four footprint corners and averages (lightweight multi-point).
 *
 * @param {object} panel
 * @param {object|null} expRoof
 * @param {object[]} roofObstacles
 * @param {number} mountHeight
 * @returns {{ effectiveExposure: number, simulationExposure: number }}
 */
function refinePanelExposure(panel, expRoof, roofObstacles, mountHeight) {
  const samples = panelSamplePoints(panel);
  let effectiveSum = 0;
  let simulationSum = 0;

  for (const [x, z] of samples) {
    const sample = refineSampleExposure(x, z, expRoof, roofObstacles, mountHeight);
    effectiveSum += sample.effectiveExposure;
    simulationSum += sample.simulationExposure;
  }

  const n = samples.length || 1;
  return {
    effectiveExposure: Math.round(effectiveSum / n),
    simulationExposure: Math.round(simulationSum / n),
  };
}

function assessObstacleImpact(obstacle, mountHeight, panelEntries) {
  const h = obstacle.height ?? 0;
  const s = obstacle.scale ?? 1;
  const width = (obstacle.width ?? 0) * s;
  const length = (obstacle.length ?? 0) * s;

  if (h < mountHeight) {
    return {
      status:      SHADING_ENGINEERING_STATUS.CLEARANCE,
      impactLabel: "Negligible",
      summary:     "Obstacle remains below the mounted array.",
    };
  }

  const affected = panelEntries.filter((p) => {
    const panel = { roofId: p.roofId, center: p.center, width: p.width, length: p.length, rotation: p.rotation };
    return panelOverlapsObstacle(panel, obstacle);
  });

  if (!affected.length) {
    return {
      status:      SHADING_ENGINEERING_STATUS.POSSIBLE,
      impactLabel: "Low",
      summary:     "Obstacle approaches or exceeds mounting clearance. Some panels may experience shading.",
    };
  }

  const hasSignificant = affected.some((p) => p.effectiveExposure < 50);
  if (hasSignificant) {
    return {
      status:      SHADING_ENGINEERING_STATUS.SIGNIFICANT,
      impactLabel: "High",
      summary:     "Obstacle exceeds mounting clearance and simulation indicates meaningful shading.",
    };
  }

  const hasModerate = affected.some((p) => p.effectiveExposure < 70);
  return {
    status:      SHADING_ENGINEERING_STATUS.POSSIBLE,
    impactLabel: hasModerate ? "Moderate" : "Low",
    summary:     "Obstacle approaches or exceeds mounting clearance. Some panels may experience shading.",
  };
}

/**
 * Mount Height engineering refinement — filter only, not a simulator.
 *
 * @param {object} params
 * @param {object|null} params.exposureResult
 * @param {object|null} params.shadowResult       read-only (parity / future use)
 * @param {object[]}    params.obstacles
 * @param {object[]}    params.roofSections
 * @param {object|null} params.panelLayout        effective layout (placedPanels)
 * @param {object}      params.projectPanelDefaults
 * @param {object[]}    params.placementAreas
 * @param {object|null} params.placementReady
 * @returns {{
 *   panels: PanelShadingEntry[],
 *   obstacles: ObstacleShadingEntry[],
 *   regionExposure: Map<string, number>,
 * } | null}
 */
export function panelShadingRefinement({
  exposureResult = null,
  shadowResult = null,
  obstacles = [],
  roofSections = [],
  panelLayout = null,
  projectPanelDefaults = null,
  placementAreas = [],
  placementReady = null,
}) {
  void shadowResult;
  void roofSections;

  const placedPanels = panelLayout?.placedPanels ?? [];
  if (!exposureResult || !placedPanels.length || !projectPanelDefaults) return null;

  /** @type {PanelShadingEntry[]} */
  const panels = [];
  /** @type {Map<string, { sum: number, count: number }>} */
  const regionAgg = new Map();

  for (const panel of placedPanels) {
    const mountHeight = mountHeightForPanel(panel, placementAreas, projectPanelDefaults, placementReady);
    const expRoof = exposureResult.byRoof?.[panel.roofId];
    const roofObstacles = obstacles.filter((o) => o.roofId === panel.roofId);
    const { effectiveExposure, simulationExposure } = refinePanelExposure(
      panel,
      expRoof,
      roofObstacles,
      mountHeight,
    );

    const slotId = panel.slotId ?? panel.id;
    panels.push({
      slotId,
      regionId:           panel.regionId,
      roofId:             panel.roofId,
      center:             panel.center,
      width:              panel.width,
      length:             panel.length,
      rotation:           panel.rotation ?? 0,
      effectiveExposure,
      simulationExposure,
      mountHeight,
    });

    if (panel.regionId) {
      const agg = regionAgg.get(panel.regionId) ?? { sum: 0, count: 0 };
      agg.sum += effectiveExposure;
      agg.count += 1;
      regionAgg.set(panel.regionId, agg);
    }
  }

  const regionExposure = new Map();
  for (const [regionId, { sum, count }] of regionAgg) {
    regionExposure.set(regionId, count ? Math.round(sum / count) : 0);
  }

  const roofIds = new Set(placedPanels.map((p) => p.roofId).filter(Boolean));
  /** @type {ObstacleShadingEntry[]} */
  const obstacleEntries = obstacles
    .filter((o) => roofIds.has(o.roofId))
    .map((o) => {
      const mountHeight = mountHeightForRoof(
        o.roofId,
        placedPanels,
        placementAreas,
        projectPanelDefaults,
        placementReady,
      );
      const s = o.scale ?? 1;
      const assessment = assessObstacleImpact(o, mountHeight, panels);
      return {
        id:          o.id,
        name:        o.type ?? "Obstacle",
        height:      o.height ?? 0,
        width:       (o.width ?? 0) * s,
        length:      (o.length ?? 0) * s,
        mountHeight,
        ...assessment,
      };
    });

  return { panels, obstacles: obstacleEntries, regionExposure };
}

/**
 * Build regionId → avgScore map for computeEnergyResult consumption.
 *
 * @param {ReturnType<typeof panelShadingRefinement>} refinement
 * @returns {Map<string, number>|null}
 */
export function buildRegionExposureOverrideFromRefinement(refinement) {
  if (!refinement?.regionExposure?.size) return null;
  return new Map(refinement.regionExposure);
}
