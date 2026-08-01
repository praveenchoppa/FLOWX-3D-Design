/**
 * useStringCreation.js — Manual string creation helpers (P3.1).
 */

import { useMemo } from "react";

import { useElectricalStore } from "./useElectricalStore.js";
import { useElectricalPanelSelection } from "./useElectricalPanelSelection.js";
import { selectedPanelsAreUnassigned } from "../models/string.js";

export function useStringCreation() {
  const {
    strings,
    activeArrayId,
    selectedStringId,
    createString,
  } = useElectricalStore();

  const {
    selectedElectricalPanelIds,
    selectedPanelCount,
    canPickPanels,
  } = useElectricalPanelSelection();

  const canCreateString = useMemo(
    () => canPickPanels
      && !selectedStringId
      && selectedPanelCount > 0
      && !!activeArrayId
      && selectedPanelsAreUnassigned(strings, activeArrayId, selectedElectricalPanelIds),
    [canPickPanels, selectedStringId, selectedPanelCount, activeArrayId, strings, selectedElectricalPanelIds],
  );

  return {
    canCreateString,
    createString,
    selectedElectricalPanelIds,
    selectedPanelCount,
    activeArrayId,
  };
}
