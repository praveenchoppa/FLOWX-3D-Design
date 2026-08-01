/**
 * useElectricalPanelSelection.js — Panel selection API for Electrical Design (P2b).
 */

import { useCallback } from "react";

import { useElectricalStore } from "./useElectricalStore.js";

export function useElectricalPanelSelection() {
  const {
    arrays,
    activeArrayId,
    activeArray,
    selectedElectricalPanelIds,
    canPickPanels,
    selectPanel,
    selectAllPanelsInActiveArray,
    clearPanelSelection,
  } = useElectricalStore();

  const selectedPanelCount = selectedElectricalPanelIds.length;

  const selectAll = useCallback(() => {
    selectAllPanelsInActiveArray();
  }, [selectAllPanelsInActiveArray]);

  const clearSelection = useCallback(() => {
    clearPanelSelection();
  }, [clearPanelSelection]);

  return {
    arrays,
    activeArrayId,
    activeArray,
    selectedElectricalPanelIds,
    selectedPanelCount,
    canPickPanels,
    selectPanel,
    selectAll,
    clearSelection,
  };
}
