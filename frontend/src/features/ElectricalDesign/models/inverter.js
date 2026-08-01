/**
 * inverter.js — Inverter entity factory + catalog selection (P4).
 */

import { getCatalogEntry } from "../constants/inverterCatalog.js";
import {
  clearMpptStringReferences,
  createMpptsForInverter,
  removeMpptsForInverters,
} from "./mppt.js";

/**
 * @typedef {object} ElectricalInverter
 * @property {string} id
 * @property {string} manufacturer
 * @property {string} model
 * @property {number} totalLoad
 * @property {number} lineVoltage
 * @property {number} dcVoltage
 * @property {number} dcCurrent
 * @property {number} chargeControllerCount
 * @property {string[]} mpptIds
 * @property {"single-phase"|"3-phase"} phase
 * @property {string} catalogId
 */

/**
 * @param {object} params
 * @returns {ElectricalInverter}
 */
export function createInverter({
  id,
  manufacturer,
  model,
  totalLoad,
  lineVoltage,
  dcVoltage,
  dcCurrent,
  chargeControllerCount,
  mpptIds = [],
  phase,
  catalogId,
}) {
  return {
    id,
    manufacturer,
    model,
    totalLoad,
    lineVoltage,
    dcVoltage,
    dcCurrent,
    chargeControllerCount,
    mpptIds: [...mpptIds],
    phase,
    catalogId,
  };
}

/**
 * @param {import("../constants/inverterCatalog.js").InverterCatalogEntry} entry
 */
export function createInverterFromCatalog(entry) {
  const inverterId = typeof crypto !== "undefined" && crypto.randomUUID
    ? `inverter-${crypto.randomUUID()}`
    : `inverter-${Date.now()}`;

  const inverter = createInverter({
    id:                    inverterId,
    manufacturer:          entry.manufacturer,
    model:                 entry.model,
    totalLoad:             entry.totalLoad,
    lineVoltage:           entry.lineVoltage,
    dcVoltage:             entry.dcVoltage,
    dcCurrent:             entry.dcCurrent,
    chargeControllerCount: entry.chargeControllerCount,
    mpptIds:               [],
    phase:                 entry.phase,
    catalogId:             entry.catalogId,
  });

  const mppts = createMpptsForInverter(inverter, entry.mpptCapacityKw ?? null);

  return {
    inverter: {
      ...inverter,
      mpptIds: mppts.map((m) => m.id),
    },
    mppts,
  };
}

/**
 * Clear mpptId on all strings (inverter reselect / placement refresh).
 *
 * @param {object[]} strings
 */
export function clearStringMpptAssignments(strings) {
  return (strings ?? []).map((s) => ({ ...s, mpptId: null }));
}

/**
 * Select (or replace) the single project inverter from the catalog.
 *
 * @param {string} catalogId
 * @param {object[]} inverters
 * @param {object[]} mppts
 * @param {object[]} strings
 */
export function selectInverterFromCatalog(catalogId, inverters, mppts, strings) {
  const entry = getCatalogEntry(catalogId);
  if (!entry) {
    return { ok: false, reason: "Inverter catalog entry could not be found." };
  }

  const oldInverterIds = (inverters ?? []).map((i) => i.id);
  const nextMppts = removeMpptsForInverters(mppts, oldInverterIds);
  const { inverter, mppts: createdMppts } = createInverterFromCatalog(entry);
  const clearedStrings = clearStringMpptAssignments(strings);

  return {
    ok:        true,
    inverters: [inverter],
    mppts:     [...nextMppts, ...createdMppts],
    strings:   clearedStrings,
    inverter,
  };
}

/**
 * Prepare MPPTs after placement refresh: clear stale string references.
 *
 * @param {object[]} mppts
 */
export function syncMpptsAfterPlacementRefresh(mppts) {
  return clearMpptStringReferences(mppts);
}
