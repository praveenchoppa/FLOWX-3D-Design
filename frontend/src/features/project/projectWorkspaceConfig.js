/**
 * projectWorkspaceConfig.js — Step 11 Project Summary constants (display only).
 */

import { DEFAULT_PROJECT_NAME } from "../../config/headerConfig";

export const ENGINEERING_MILESTONES = [
  { id: 1, label: "Location",     complete: true },
  { id: 2, label: "Roof",         complete: true },
  { id: 3, label: "Obstacles",    complete: true },
  { id: 4, label: "Simulation",   complete: true },
  { id: 5, label: "Zones",        complete: true },
  { id: 6, label: "Panels",            complete: true },
  { id: 7, label: "Electrical Design", complete: true },
  { id: 8, label: "Energy",            complete: true },
  { id: 9, label: "Financials",        complete: true },
  { id: 10, label: "Presentation",     complete: true },
];

export const STORAGE_KEY_META = "flowx-project-meta";
export const STORAGE_KEY_NOTES_PREFIX = "flowx-project-notes-";
export const FALLBACK_PROJECT_ID = "flowx-local-project";

/** @deprecated CRM fields retained for localStorage compatibility only — not displayed in Step 10. */
export const DEFAULT_LEAD_STATUS = "design_complete";
/** @deprecated */
export const DEFAULT_PROPOSAL_STATUS = "pending";

export const DEFAULT_PROJECT_META = {
  projectId:       null,
  projectName:     DEFAULT_PROJECT_NAME,
  customerName:    "",
  phone:           "",
  email:           "",
  leadStatus:      DEFAULT_LEAD_STATUS,
  proposalStatus:  DEFAULT_PROPOSAL_STATUS,
  consultantName:  "Consultant",
  createdDate:     null,
  lastUpdated:     null,
};
