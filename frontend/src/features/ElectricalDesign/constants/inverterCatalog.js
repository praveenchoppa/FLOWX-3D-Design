/**
 * inverterCatalog.js — Default development inverter catalog (P4).
 *
 * Catalog metadata such as maxStringsPerMppt is for future phases only.
 */

/** @typedef {object} InverterCatalogEntry
 * @property {string} catalogId
 * @property {string} manufacturer
 * @property {string} model
 * @property {number} totalLoad
 * @property {number} lineVoltage
 * @property {number} dcVoltage
 * @property {number} dcCurrent
 * @property {number} chargeControllerCount
 * @property {"single-phase"|"3-phase"} phase
 * @property {number|null} [maxStringsPerMppt]
 * @property {number|null} [mpptCapacityKw]
 */

/** @type {InverterCatalogEntry[]} */
export const INVERTER_CATALOG = [
  {
    catalogId:             "huawei-sun2000-100ktl",
    manufacturer:          "Huawei",
    model:                 "SUN2000-100KTL",
    totalLoad:             100,
    lineVoltage:           400,
    dcVoltage:             1100,
    dcCurrent:             98,
    chargeControllerCount: 6,
    phase:                 "3-phase",
    maxStringsPerMppt:     2,
    mpptCapacityKw:        17,
  },
  {
    catalogId:             "fronius-symo-20-0-3-m",
    manufacturer:          "Fronius",
    model:                 "Symo 20.0-3-M",
    totalLoad:             20,
    lineVoltage:           400,
    dcVoltage:             1000,
    dcCurrent:             33,
    chargeControllerCount: 2,
    phase:                 "3-phase",
    maxStringsPerMppt:     2,
    mpptCapacityKw:        10,
  },
  {
    catalogId:             "sma-stp-25000tl-30",
    manufacturer:          "SMA",
    model:                 "STP 25000TL-30",
    totalLoad:             25,
    lineVoltage:           400,
    dcVoltage:             1000,
    dcCurrent:             40,
    chargeControllerCount: 3,
    phase:                 "3-phase",
    maxStringsPerMppt:     2,
    mpptCapacityKw:        8.3,
  },
  {
    catalogId:             "huawei-sun2000-50ktl-m0",
    manufacturer:          "Huawei",
    model:                 "SUN2000-50KTL-M0",
    totalLoad:             50,
    lineVoltage:           400,
    dcVoltage:             1100,
    dcCurrent:             55,
    chargeControllerCount: 4,
    phase:                 "3-phase",
    maxStringsPerMppt:     2,
    mpptCapacityKw:        12.5,
  },
];

/**
 * @param {string} catalogId
 * @returns {InverterCatalogEntry|undefined}
 */
export function getCatalogEntry(catalogId) {
  return INVERTER_CATALOG.find((e) => e.catalogId === catalogId);
}
