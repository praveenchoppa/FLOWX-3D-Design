/**
 * headerConfig.js — global header display labels (step-based, display only).
 */

export const DEFAULT_PROJECT_NAME = "Hyderabad Residence";

export const HEADER_STEP_STATUS = {
  1:  "Location Selected",
  2:  "Roof Design",
  3:  "Obstacle Modeling",
  4:  "Solar Simulation",
  5:  "Solar Zoning",
  6:  "Panel Layout",
  7:  "Energy Analysis",
  8:  "Financial Analysis",
  9:  "Presentation Ready",
  10: "Project Workspace",
};

export function getHeaderWorkspaceLabel(step) {
  return step === 10 ? "Project Workspace" : "Engineering Workspace";
}

export function getHeaderStepStatus(step) {
  return HEADER_STEP_STATUS[step] ?? "Engineering Workspace";
}
