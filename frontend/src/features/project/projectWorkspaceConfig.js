/**
 * projectWorkspaceConfig.js — Step 10 workspace constants (display only).
 */

import { DEFAULT_PROJECT_NAME } from "../../config/headerConfig";

export const WORKSPACE_TABS = [
  { id: "overview",  label: "Overview",  enabled: true },
  { id: "customer",  label: "Customer",  enabled: false },
  { id: "proposal",  label: "Proposal",  enabled: false },
  { id: "documents", label: "Documents", enabled: false },
  { id: "activity",  label: "Activity",  enabled: false },
];

export const LEAD_STATUS_OPTIONS = [
  { value: "new",             label: "New" },
  { value: "contacted",       label: "Contacted" },
  { value: "site_visit",      label: "Site Visit" },
  { value: "designing",       label: "Designing" },
  { value: "design_complete", label: "Design Complete" },
  { value: "proposal_sent",   label: "Proposal Sent" },
  { value: "negotiation",     label: "Negotiation" },
  { value: "won",             label: "Won" },
  { value: "lost",            label: "Lost" },
];

export const DEFAULT_LEAD_STATUS = "design_complete";

export const PROPOSAL_STATUS_OPTIONS = [
  { value: "pending",   label: "Pending" },
  { value: "draft",     label: "Draft in Progress" },
  { value: "sent",      label: "Sent to Client" },
  { value: "approved",  label: "Approved" },
  { value: "declined",  label: "Declined" },
];

export const DEFAULT_PROPOSAL_STATUS = "pending";

export const EPC_WORKFLOW_STAGES = [
  { id: "design",        label: "Design",        complete: true },
  { id: "presentation",  label: "Presentation",  complete: true },
  { id: "proposal",      label: "Proposal",      complete: false },
  { id: "approval",      label: "Approval",      complete: false },
  { id: "project",       label: "Project",       complete: false },
  { id: "installation",  label: "Installation",  complete: false },
];

export const ENGINEERING_MILESTONES = [
  { id: 1,  label: "Location",      complete: true },
  { id: 2,  label: "Roof",          complete: true },
  { id: 3,  label: "Obstacles",     complete: true },
  { id: 4,  label: "Simulation",    complete: true },
  { id: 5,  label: "Zones",         complete: true },
  { id: 6,  label: "Panels",        complete: true },
  { id: 7,  label: "Energy",        complete: true },
  { id: 8,  label: "Financials",    complete: true },
  { id: 9,  label: "Presentation",  complete: true },
  { id: 10, label: "Project Workspace", complete: true, current: true },
];

export const FUTURE_MILESTONES = [
  "Proposal Sent",
  "Client Approval",
  "Installation",
  "Commissioning",
];

export const PROPOSAL_CHECKLIST = [
  { label: "Presentation Ready",   done: true },
  { label: "Proposal Pending",     done: false },
  { label: "PDF Pending",          done: false },
  { label: "Client Share Pending", done: false },
  { label: "Proposal Approved",    done: false },
];

export const QUICK_ACTIONS = [
  "Generate Proposal",
  "Export PDF",
  "Share Design",
  "Convert to Project",
];

export const STORAGE_KEY_META = "flowx-project-meta";
export const STORAGE_KEY_NOTES_PREFIX = "flowx-project-notes-";
export const FALLBACK_PROJECT_ID = "flowx-local-project";

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
