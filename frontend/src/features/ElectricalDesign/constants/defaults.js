/**
 * defaults.js — Electrical Design module defaults (P1 Task B).
 */

import {
  PANEL_GAP_M,
  INTER_ROW_GAP_M,
  EDGE_CLEARANCE_M,
  OBSTACLE_CLEARANCE_M,
} from "../../panels/panelPlacement.js";

/** Layout spacing snapshot stored on each Array (read from panel placement constants). */
export const DEFAULT_ARRAY_SPACING = {
  panelGapM:          PANEL_GAP_M,
  interRowGapM:       INTER_ROW_GAP_M,
  edgeClearanceM:     EDGE_CLEARANCE_M,
  obstacleClearanceM: OBSTACLE_CLEARANCE_M,
};

/** Empty electrical collections on store init. */
export const EMPTY_ELECTRICAL_COLLECTIONS = {
  arrays:    [],
  strings:   [],
  mppts:     [],
  inverters: [],
  cables:    [],
};
