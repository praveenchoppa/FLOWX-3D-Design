/**
 * useStringSelection.js — String selection API for Electrical Design (P3.1).
 */

import { useCallback } from "react";

import { useElectricalStore } from "./useElectricalStore.js";

export function useStringSelection() {
  const {
    strings,
    selectedStringId,
    selectedString,
    selectString,
    deselectString,
  } = useElectricalStore();

  const selectStringOnly = useCallback(
    (stringId) => selectString(stringId),
    [selectString],
  );

  return {
    strings,
    selectedStringId,
    selectedString,
    selectString,
    selectStringOnly,
    deselectString,
  };
}
