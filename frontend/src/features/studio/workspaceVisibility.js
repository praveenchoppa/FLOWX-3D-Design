/**
 * workspaceVisibility.js — Wizard-step gating for workspace overlays (render only).
 *
 * Engineering state is never cleared here — only visibility flags for 2D/3D UI.
 */

export const WIZARD_STEP = /** @type {const} */ ({
  LOCATION:      1,
  ROOF:          2,
  OBSTACLES:     3,
  SIMULATION:    4,
  ZONES:         5,
  PANELS:        6,
  ELECTRICAL:    7,
  ENERGY:        8,
  FINANCIALS:    9,
  VISUALIZATION: 10,
  PROJECT:       11,
});

/**
 * Resolve which workspace overlays may render on the active wizard step.
 *
 * @param {number} currentStep  1-indexed wizard step
 * @param {object} [data]
 * @param {boolean} [data.usePlacementAreaPanelWorkflow]
 * @param {boolean} [data.hasGeneratedPanelLayout]
 * @param {boolean} [data.hasPlacedPanels]
 * @param {boolean} [data.hasPlacementAreas]
 * @param {boolean} [data.isDrawingPlacementArea]
 * @returns {{
 *   placementAreas: boolean,
 *   businessZones: boolean,
 *   placedPanels: boolean,
 *   panelEditing: boolean,
 *   electricalPanelPicking: boolean,
 *   panelEditToolbar: boolean,
 *   ghostPanelSlots: boolean,
 *   zonesDimmed: boolean,
 *   showDimensionsToggle: boolean,
 *   isPresentation: boolean,
 * }}
 */
export function getWorkspaceVisibility(currentStep, data = {}) {
  const s = currentStep;
  const hasPanelLayout = data.usePlacementAreaPanelWorkflow
    ? !!data.hasGeneratedPanelLayout
    : !!data.hasPlacedPanels;

  const isEngineeringPlacementPhase = s >= WIZARD_STEP.ZONES && s <= WIZARD_STEP.FINANCIALS;

  return {
    placementAreas: isEngineeringPlacementPhase
      && (!!data.hasPlacementAreas || !!data.isDrawingPlacementArea),
    businessZones:         s === WIZARD_STEP.ZONES,
    placedPanels:          s >= WIZARD_STEP.PANELS && hasPanelLayout,
    panelEditing:          s === WIZARD_STEP.PANELS,
    electricalPanelPicking: s === WIZARD_STEP.ELECTRICAL,
    panelEditToolbar:      s === WIZARD_STEP.PANELS,
    ghostPanelSlots:       s === WIZARD_STEP.PANELS,
    zonesDimmed:           s === WIZARD_STEP.PANELS,
    showDimensionsToggle:  s >= WIZARD_STEP.ROOF && s <= WIZARD_STEP.VISUALIZATION,
    isPresentation:        s === WIZARD_STEP.VISUALIZATION,
  };
}

/**
 * CAD measurement overlay visibility — roof/obstacle are global engineering aids
 * (gated by Show Dimensions). Zone/panel dims remain step-specific.
 *
 * @param {number} currentStep
 * @param {object|null} [presentationLayers]
 * @returns {{ roof: boolean, obstacle: boolean, zone: boolean, panel: boolean }}
 */
export function getMeasurementVisibility(currentStep, presentationLayers = null) {
  const s = currentStep;
  const isPresentation = s === WIZARD_STEP.VISUALIZATION;
  const engineeringDims = !isPresentation || !!presentationLayers?.engineeringDimensions;

  return {
    roof:     s >= WIZARD_STEP.ROOF && engineeringDims,
    obstacle: s >= WIZARD_STEP.OBSTACLES && engineeringDims,
    zone:     s === WIZARD_STEP.ZONES
      && (!isPresentation || !!presentationLayers?.zoneBoundaries),
    panel:    (s === WIZARD_STEP.PANELS || isPresentation) && engineeringDims,
  };
}

/**
 * Whether placement area polygons may render (Visualization step defers to Presentation Layers).
 *
 * @param {boolean} workspaceAllows
 * @param {boolean} isPresentation
 * @param {object|null} presentationLayers
 */
export function resolvePlacementAreasVisible(
  workspaceAllows,
  isPresentation,
  presentationLayers,
) {
  if (!workspaceAllows) return false;
  if (!isPresentation) return true;
  return !!presentationLayers?.placementAreas;
}
