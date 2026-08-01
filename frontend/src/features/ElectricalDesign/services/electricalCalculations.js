/**
 * electricalCalculations.js — P5A derived electrical metrics (pure, UI-independent).
 *
 * Consumes topology + read-only panelLayout. Does not mutate store state.
 * Returns empty warnings[] — reserved for future threshold alerts (P5B+).
 *
 * Operating electrical calculations (Voltage, Current, Operating Power) require
 * verified panel STC specifications (vmpV, impA) from the manufacturer datasheet
 * for the exact module SKU. These values must not be inferred from powerW or
 * estimated. Until verified specifications exist, only Installed DC Capacity and
 * DC/AC Ratio are computed, while operating metrics display "—".
 */

import { getPanelById } from "../../panels/panelTypes.js";
import { mpptsForInverter } from "../models/mppt.js";
import { panelSlotKey } from "../utils/panelSelectionUtils.js";
import {
  dcAcRatio,
  operatingPowerW,
  parallelMpptVoltage,
  roundMetric,
  seriesCurrent,
  sumInstalledDcCapacityW,
  sumParallelValues,
  sumSeriesVoltage,
} from "../utils/seriesMath.js";

/**
 * @typedef {object} PanelElectricalSpec
 * @property {number|null} powerW
 * @property {number|null} vmpV
 * @property {number|null} impA
 * @property {boolean} hasOperatingSpec
 */

/**
 * @typedef {object} StringMetrics
 * @property {number|null} voltageV
 * @property {number|null} currentA
 * @property {number|null} operatingPowerW
 * @property {number} dcCapacityW
 * @property {number} panelCount
 * @property {boolean} missingOperatingSpec
 */

/**
 * @typedef {object} MpptMetrics
 * @property {number|null} voltageV
 * @property {number|null} currentA
 * @property {number|null} operatingPowerW
 * @property {number} dcCapacityW
 * @property {number} stringCount
 */

/**
 * @typedef {object} InverterMetrics
 * @property {number} totalDcCapacityW
 * @property {number} totalDcCapacityKw
 * @property {number|null} dcAcRatio
 * @property {number|null} acRatingKw
 * @property {number} panelCount
 * @property {number} assignedStringCount
 */

/**
 * @typedef {object} ElectricalMetricsResult
 * @property {Record<string, StringMetrics>} byStringId
 * @property {Record<string, MpptMetrics>} byMpptId
 * @property {Record<string, InverterMetrics>} byInverterId
 * @property {InverterMetrics|null} inverter
 * @property {object[]} warnings
 */

/**
 * Build slotId → placed panel lookup from read-only layout.
 *
 * @param {object|null} panelLayout
 */
export function buildPlacedPanelBySlotId(panelLayout) {
  const map = new Map();
  for (const panel of panelLayout?.placedPanels ?? []) {
    const key = panelSlotKey(panel);
    if (key) map.set(key, panel);
  }
  return map;
}

/**
 * Resolve electrical spec for one placed panel slot.
 *
 * @param {string} slotId
 * @param {Map<string, object>} placedBySlotId
 */
export function resolvePanelSpec(slotId, placedBySlotId) {
  const placed = placedBySlotId.get(slotId);
  if (!placed) {
    return {
      powerW: null,
      vmpV: null,
      impA: null,
      hasOperatingSpec: false,
    };
  }

  const mod = getPanelById(placed.panelTypeId);
  if (!mod) {
    return {
      powerW: null,
      vmpV: null,
      impA: null,
      hasOperatingSpec: false,
    };
  }

  const vmpV = mod.vmpV ?? null;
  const impA = mod.impA ?? null;
  const powerW = mod.powerW ?? mod.power ?? null;

  return {
    powerW,
    vmpV,
    impA,
    hasOperatingSpec: vmpV != null && impA != null,
  };
}

/**
 * @param {object} string
 * @param {Map<string, object>} placedBySlotId
 * @returns {StringMetrics}
 */
export function computeStringMetrics(string, placedBySlotId) {
  const sequence = string?.orderedPanelSequence ?? [];
  const vmpValues = [];
  const impValues = [];
  const powerValues = [];
  let missingOperatingSpec = false;

  for (const slotId of sequence) {
    const spec = resolvePanelSpec(slotId, placedBySlotId);
    if (spec.powerW != null) powerValues.push(spec.powerW);
    if (!spec.hasOperatingSpec) {
      missingOperatingSpec = missingOperatingSpec || sequence.length > 0;
      continue;
    }
    vmpValues.push(spec.vmpV);
    impValues.push(spec.impA);
  }

  const voltageV = sumSeriesVoltage(vmpValues);
  const currentA = seriesCurrent(impValues);
  const opPowerW = operatingPowerW(voltageV, currentA);
  const dcCapacityW = sumInstalledDcCapacityW(powerValues);

  if (sequence.length > 0 && vmpValues.length !== sequence.length) {
    missingOperatingSpec = true;
  }

  return {
    voltageV:           roundMetric(voltageV, 1),
    currentA:           roundMetric(currentA, 2),
    operatingPowerW:    roundMetric(opPowerW, 1),
    dcCapacityW,
    panelCount:         sequence.length,
    missingOperatingSpec,
  };
}

/**
 * Aggregate assigned string metrics for one MPPT (parallel inputs).
 *
 * MPPT voltage assumption (MVP): parallel strings share a common bus voltage.
 * When assigned strings differ, use the minimum string operating voltage.
 *
 * @param {object} mppt
 * @param {Record<string, StringMetrics>} byStringId
 * @returns {MpptMetrics}
 */
export function computeMpptMetrics(mppt, byStringId) {
  const stringIds = mppt?.stringIds ?? [];
  const assigned = stringIds
    .map((id) => byStringId[id])
    .filter(Boolean);

  if (!assigned.length) {
    return {
      voltageV:        null,
      currentA:        null,
      operatingPowerW: null,
      dcCapacityW:     0,
      stringCount:     0,
    };
  }

  const voltageV = parallelMpptVoltage(assigned.map((s) => s.voltageV));
  const currentA = sumParallelValues(assigned.map((s) => s.currentA));
  const operatingPower = sumParallelValues(assigned.map((s) => s.operatingPowerW));
  const dcCapacityW = assigned.reduce((sum, s) => sum + (s.dcCapacityW ?? 0), 0);

  return {
    voltageV:           roundMetric(voltageV, 1),
    currentA:           roundMetric(currentA, 2),
    operatingPowerW:    roundMetric(operatingPower, 1),
    dcCapacityW,
    stringCount:        assigned.length,
  };
}

/**
 * Sum DC capacity from strings assigned to one inverter's MPPTs only.
 * Unassigned strings never contribute.
 *
 * @param {object} inverter
 * @param {object[]} mppts
 * @param {Record<string, StringMetrics>} byStringId
 * @returns {{ totalDcCapacityW: number, panelCount: number, assignedStringCount: number }}
 */
export function computeInverterAssignedDcCapacity(inverter, mppts, byStringId) {
  const inverterMppts = mpptsForInverter(mppts, inverter);
  const assignedStringIds = new Set();

  for (const mppt of inverterMppts) {
    for (const stringId of mppt.stringIds ?? []) {
      assignedStringIds.add(stringId);
    }
  }

  let totalDcCapacityW = 0;
  let panelCount = 0;

  for (const stringId of assignedStringIds) {
    const metrics = byStringId[stringId];
    if (!metrics) continue;
    totalDcCapacityW += metrics.dcCapacityW ?? 0;
    panelCount += metrics.panelCount ?? 0;
  }

  return {
    totalDcCapacityW,
    panelCount,
    assignedStringCount: assignedStringIds.size,
  };
}

/**
 * Total DC capacity across all panels in electrical arrays.
 *
 * Legacy helper — retained for reference. Per-inverter DC uses
 * computeInverterAssignedDcCapacity().
 *
 * @param {object[]} arrays
 * @param {Map<string, object>} placedBySlotId
 * @returns {{ totalDcCapacityW: number, panelCount: number }}
 */
export function computeSystemDcCapacity(arrays, placedBySlotId) {
  const seen = new Set();
  const powerValues = [];

  for (const array of arrays ?? []) {
    for (const slotId of array.panelIds ?? []) {
      if (seen.has(slotId)) continue;
      seen.add(slotId);
      const spec = resolvePanelSpec(slotId, placedBySlotId);
      if (spec.powerW != null) powerValues.push(spec.powerW);
    }
  }

  return {
    totalDcCapacityW: sumInstalledDcCapacityW(powerValues),
    panelCount:       powerValues.length,
  };
}

/**
 * Inverter-level metrics from assigned-string DC capacity.
 *
 * @param {object|null} inverter
 * @param {number} totalDcCapacityW
 * @param {number} panelCount
 * @returns {InverterMetrics|null}
 */
export function computeInverterMetrics(inverter, totalDcCapacityW, panelCount, assignedStringCount = 0) {
  if (!inverter) return null;

  const totalDcCapacityKw = totalDcCapacityW / 1000;
  const acRatingKw = inverter.totalLoad ?? null;

  return {
    totalDcCapacityW,
    totalDcCapacityKw: roundMetric(totalDcCapacityKw, 2) ?? 0,
    dcAcRatio:         roundMetric(dcAcRatio(totalDcCapacityKw, acRatingKw), 2),
    acRatingKw,
    panelCount,
    assignedStringCount,
  };
}

/**
 * Compute all derived electrical metrics from current topology.
 *
 * @param {object} params
 * @param {object[]} params.arrays
 * @param {object[]} params.strings
 * @param {object[]} params.mppts
 * @param {object[]} [params.inverters]
 * @param {object|null} params.inverter — selected inverter (legacy `inverter` field)
 * @param {object|null} params.panelLayout
 * @returns {ElectricalMetricsResult}
 */
export function computeElectricalMetrics({
  arrays = [],
  strings = [],
  mppts = [],
  inverters = [],
  inverter = null,
  panelLayout = null,
}) {
  const placedBySlotId = buildPlacedPanelBySlotId(panelLayout);

  const byStringId = {};
  for (const str of strings ?? []) {
    byStringId[str.id] = computeStringMetrics(str, placedBySlotId);
  }

  const byMpptId = {};
  for (const mppt of mppts ?? []) {
    byMpptId[mppt.id] = computeMpptMetrics(mppt, byStringId);
  }

  const byInverterId = {};
  for (const inv of inverters ?? []) {
    const { totalDcCapacityW, panelCount, assignedStringCount } = computeInverterAssignedDcCapacity(
      inv,
      mppts,
      byStringId,
    );
    byInverterId[inv.id] = computeInverterMetrics(
      inv,
      totalDcCapacityW,
      panelCount,
      assignedStringCount,
    );
  }

  const selectedInverter = inverter ?? inverters[0] ?? null;
  const inverterMetrics = selectedInverter
    ? (byInverterId[selectedInverter.id] ?? computeInverterMetrics(selectedInverter, 0, 0))
    : null;

  return {
    byStringId,
    byMpptId,
    byInverterId,
    inverter: inverterMetrics,
    warnings:  [],
  };
}
