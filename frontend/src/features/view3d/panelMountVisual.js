/**
 * panelMountVisual.js — Read-only mount visualization from stored engineering config.
 * Does NOT compute or store engineering state; only maps region → existing props.
 *
 * Mount Height = distance from roof surface to mounting rails (visual interpretation).
 */

import {
  resolveEffectivePanelConfig,
  DEFAULT_PROJECT_PANEL_DEFAULTS,
} from "../panels/panelConfig.js";

/**
 * @typedef {{ tilt: number, mountHeight: number, mountType: string, azimuth: number }} MountVisual
 */

export const MODULE_RAIL_GAP = 0.012;
export const MODULE_THICKNESS = 0.038;
export const FRAME_DEPTH = 0.037;
export const GLASS_THICKNESS = 0.004;
export const RAIL_H = 0.034;

export function buildRegionMountVisualMap(projectPanelDefaults, placementAreas = []) {
  const map = new Map();
  const defaults = projectPanelDefaults ?? DEFAULT_PROJECT_PANEL_DEFAULTS;

  for (const area of placementAreas.filter((a) => !a?.deleted)) {
    const cfg = resolveEffectivePanelConfig(defaults, area.panelProperties);
    map.set(area.id, {
      tilt:        Number(cfg.tilt) || 0,
      mountHeight: Math.max(0, Number(cfg.mountHeight) || 0),
      mountType:   cfg.mountType ?? "flush",
      azimuth:     Number(cfg.azimuth) || 180,
    });
  }
  return map;
}

export function resolvePanelMountVisual(panel, regionMap, projectPanelDefaults) {
  const defaults = projectPanelDefaults ?? DEFAULT_PROJECT_PANEL_DEFAULTS;
  const rid = panel?.regionId;

  if (rid && regionMap?.size) {
    if (regionMap.has(rid)) return regionMap.get(rid);
    for (const [areaId, visual] of regionMap) {
      if (rid === areaId || rid?.startsWith(`${areaId}::`)) return visual;
    }
  }

  return {
    tilt:        Number(defaults.tilt) || 0,
    mountHeight: Math.max(0, Number(defaults.mountHeight) || 0),
    mountType:   defaults.mountType ?? "flush",
    azimuth:     Number(defaults.azimuth) || 180,
  };
}

/** Vertical stack: roof → supports → rails → gap → module (visual only). */
export function computeModuleStack(mountHeight) {
  const railBottomY = Math.max(0, mountHeight);
  const railCenterY = railBottomY + RAIL_H / 2;
  const frameBottomY = railCenterY + RAIL_H / 2 + MODULE_RAIL_GAP;
  const moduleCenterY = frameBottomY + MODULE_THICKNESS / 2;
  const frameCenterY = frameBottomY + FRAME_DEPTH / 2 - GLASS_THICKNESS / 2;

  return {
    railBottomY,
    railCenterY,
    frameBottomY,
    moduleCenterY,
    frameCenterY,
  };
}

/**
 * Support heights reach from roof (y=0) to rail underside — NOT mountHeight as leg length
 * stacked on an elevated base. mountHeight defines rail elevation.
 */
export function rowSupportHeights(mountType, mountHeight, tiltDeg, moduleLength) {
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const railBottom = Math.max(0.02, mountHeight);

  if (mountType === "ballasted") {
    return {
      front: railBottom,
      rear:  railBottom,
      column: true,
      bracket: 0.04,
    };
  }

  if (mountType === "tilted") {
    return {
      front: Math.max(0.04, railBottom * 0.55),
      rear:  railBottom + moduleLength * Math.sin(tiltRad) * 0.18,
      column: false,
      bracket: 0.03,
    };
  }

  return {
    front: railBottom,
    rear:  railBottom,
    column: false,
    bracket: 0.025,
  };
}
