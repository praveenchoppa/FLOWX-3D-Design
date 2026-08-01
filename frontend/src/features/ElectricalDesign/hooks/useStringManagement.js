/**
 * useStringManagement.js — P3.2 string edit helpers (rename, delete, add/remove panels).
 */

import { useMemo } from "react";

import { useElectricalStore } from "./useElectricalStore.js";
import { useElectricalPanelSelection } from "./useElectricalPanelSelection.js";
import {
  selectedPanelsAreAddableToString,
  selectedPanelsAreStringMembers,
} from "../models/string.js";

export function useStringManagement() {
  const {
    selectedString,
    selectedStringId,
    renameString,
    deleteString,
    addPanelsToString,
    removePanelsFromString,
    strings,
  } = useElectricalStore();

  const {
    selectedElectricalPanelIds,
    selectedPanelCount,
    canPickPanels,
  } = useElectricalPanelSelection();

  const canRenameString = !!selectedString;

  const canDeleteString = !!selectedString;

  const canAddPanelsToString = useMemo(
    () => !!selectedString
      && canPickPanels
      && selectedPanelCount > 0
      && selectedPanelsAreAddableToString(strings, selectedString, selectedElectricalPanelIds),
    [selectedString, canPickPanels, selectedPanelCount, strings, selectedElectricalPanelIds],
  );

  const canRemovePanelsFromString = useMemo(
    () => !!selectedString
      && canPickPanels
      && selectedPanelCount > 0
      && selectedPanelsAreStringMembers(selectedString, selectedElectricalPanelIds),
    [selectedString, canPickPanels, selectedPanelCount, selectedElectricalPanelIds],
  );

  const hasMixedPanelSelection = useMemo(
    () => !!selectedString
      && canPickPanels
      && selectedPanelCount > 0
      && !canAddPanelsToString
      && !canRemovePanelsFromString,
    [selectedString, canPickPanels, selectedPanelCount, canAddPanelsToString, canRemovePanelsFromString],
  );

  return {
    selectedString,
    selectedStringId,
    selectedElectricalPanelIds,
    selectedPanelCount,
    canRenameString,
    canDeleteString,
    canAddPanelsToString,
    canRemovePanelsFromString,
    hasMixedPanelSelection,
    renameString,
    deleteString,
    addPanelsToString,
    removePanelsFromString,
  };
}
