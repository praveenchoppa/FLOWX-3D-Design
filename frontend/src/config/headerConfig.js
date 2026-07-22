/**
 * headerConfig.js — global header display labels (step-based, display only).
 */

export const DEFAULT_PROJECT_NAME = "Client's Residence";

export const HEADER_STEP_STATUS = {
  1:  "Location ",
  2:  "Roof Design",
  3:  "Obstacle Modeling",
  4:  "Solar Simulation",
  5:  "Solar Zoning",
  6:  "Panel Layout",
  7:  "Electrical Design",
  8:  "Energy Analysis",
  9:  "Financial Analysis",
  10: "Presentation Ready",
  11: "Project Summary",
};

export function getHeaderWorkspaceLabel(step) {
  return step === 11 ? "Project Summary" : "Engineering Workspace";
}

export function getHeaderStepStatus(step) {
  return HEADER_STEP_STATUS[step] ?? "Engineering Workspace";
}
