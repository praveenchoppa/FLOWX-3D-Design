/**
 * presentationLayersConfig.js — Step 9 workspace layer defaults (display only).
 */

export const DEFAULT_PRESENTATION_LAYERS = {
  panels:            true,
  obstacles:          true,
  sunPath:            true,
  shadows:            true,
  solarSuitability:    false,
  heatmap:            false,
  zoneBoundaries:      false,
  businessZones:       false,
};

export const PRESENTATION_LAYER_TOGGLES = [
  { key: "panels",     label: "Panels" },
  { key: "obstacles",   label: "Obstacles" },
  { key: "sunPath",     label: "Sun Path" },
  { key: "shadows",     label: "Shadows" },
];

export const ENGINEERING_LAYER_TOGGLES = [
  { key: "solarSuitability", label: "Solar Suitability" },
  { key: "heatmap",          label: "Heatmap" },
  { key: "zoneBoundaries",    label: "Zone Boundaries" },
  { key: "businessZones",     label: "Business Zones" },
];
