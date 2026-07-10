/**
 * panelTypes.js — Module library (renderer-agnostic, pure).
 *
 * Single source of truth for PV module specs.  Dimensions in metres; power in watts.
 * Swap this array for an API / inventory fetch later — UI reads via getPanelById().
 *
 * Legacy aliases (`power`, `width`, `height`, `name`) keep computePanelLayout unchanged.
 */

export const DEFAULT_PANEL_ID = "longi-himo6-550";

/**
 * @typedef {object} PanelModule
 * @property {string} id
 * @property {string} manufacturer
 * @property {string} model
 * @property {number} powerW
 * @property {number} widthM
 * @property {number} heightM
 * @property {number} efficiency
 * @property {string} technology
 * @property {number} cells
 * @property {number} weightKg
 * @property {number} maxVoltage
 * @property {number} maxCurrent
 */

/** @type {PanelModule[]} */
export const PANEL_TYPES = [
  {
    id:           "longi-himo6-550",
    manufacturer: "LONGi",
    model:        "Hi-MO 6",
    powerW:       550,
    widthM:       1.134,
    heightM:      2.278,
    efficiency:   22.5,
    technology:   "Monocrystalline",
    cells:        144,
    weightKg:     28.5,
    maxVoltage:   41.5,
    maxCurrent:   13.7,
  },
  {
    id:           "ja-solar-deepblue-540",
    manufacturer: "JA Solar",
    model:        "DeepBlue 3.0",
    powerW:       540,
    widthM:       1.134,
    heightM:      2.278,
    efficiency:   21.8,
    technology:   "Monocrystalline",
    cells:        144,
    weightKg:     28.0,
    maxVoltage:   41.2,
    maxCurrent:   13.5,
  },
  {
    id:           "trina-vertex-545",
    manufacturer: "Trina",
    model:        "Vertex S+",
    powerW:       545,
    widthM:       1.134,
    heightM:      2.278,
    efficiency:   22.0,
    technology:   "Monocrystalline",
    cells:        144,
    weightKg:     28.2,
    maxVoltage:   41.3,
    maxCurrent:   13.6,
  },
  {
    id:           "canadian-hiku7-555",
    manufacturer: "Canadian Solar",
    model:        "HiKu7",
    powerW:       555,
    widthM:       1.134,
    heightM:      2.278,
    efficiency:   22.8,
    technology:   "Monocrystalline",
    cells:        144,
    weightKg:     29.0,
    maxVoltage:   41.8,
    maxCurrent:   13.8,
  },
  {
    id:           "jinko-tiger-neo-530",
    manufacturer: "Jinko",
    model:        "Tiger Neo",
    powerW:       530,
    widthM:       1.134,
    heightM:      2.278,
    efficiency:   21.5,
    technology:   "N-Type Monocrystalline",
    cells:        144,
    weightKg:     27.5,
    maxVoltage:   41.0,
    maxCurrent:   13.4,
  },
];

/** Normalise library entry with legacy field aliases for placement + UI. */
function withLegacyAliases(module) {
  if (!module) return undefined;
  const label = `${module.manufacturer} ${module.model} ${module.powerW}W`;
  return {
    ...module,
    power:  module.powerW,
    width:  module.widthM,
    height: module.heightM,
    name:   label,
  };
}

/** Look up a panel definition by id. */
export function getPanelById(id) {
  const mod = PANEL_TYPES.find((p) => p.id === id);
  return withLegacyAliases(mod);
}

/** @deprecated Use id "longi-himo6-550". Resolves legacy "longi-550" id. */
export function resolvePanelId(id) {
  if (id === "longi-550") return DEFAULT_PANEL_ID;
  return id;
}
