/**
 * useStringAssignment.js — P4b/P5b String → MPPT assignment (thin store wrapper).
 */

import { useMemo } from "react";

import { useElectricalStore } from "./useElectricalStore.js";
import {
  ALL_MPPTS_OCCUPIED_MESSAGE,
  assignableMpptsForString,
  mpptForString,
} from "../models/stringAssignment.js";

export function useStringAssignment() {
  const {
    selectedString,
    selectedStringId,
    projectInverter,
    inverterMppts,
    assignStringToMppt,
    removeStringFromMppt,
    mppts,
  } = useElectricalStore();

  const assignedMppt = useMemo(
    () => (selectedString ? mpptForString(mppts, selectedString) : null),
    [mppts, selectedString],
  );

  const assignableMppts = useMemo(
    () => assignableMpptsForString(inverterMppts, selectedStringId),
    [inverterMppts, selectedStringId],
  );

  const hasEmptyAssignableMppt = useMemo(
    () => assignableMppts.some((mppt) => (mppt.stringIds?.length ?? 0) === 0),
    [assignableMppts],
  );

  const allMpptsOccupied = useMemo(
    () => !!projectInverter
      && inverterMppts.length > 0
      && !hasEmptyAssignableMppt
      && !selectedString?.mpptId,
    [projectInverter, inverterMppts.length, hasEmptyAssignableMppt, selectedString?.mpptId],
  );

  const canAssignString = !!selectedString
    && !!projectInverter
    && assignableMppts.length > 0
    && !allMpptsOccupied;

  const canRemoveAssignment = !!selectedString?.mpptId;

  const canChangeMpptAssignment = !!selectedString
    && hasEmptyAssignableMppt;

  return {
    selectedString,
    selectedStringId,
    projectInverter,
    inverterMppts,
    assignableMppts,
    assignedMppt,
    canAssignString,
    canRemoveAssignment,
    canChangeMpptAssignment,
    allMpptsOccupied,
    allMpptsOccupiedMessage: ALL_MPPTS_OCCUPIED_MESSAGE,
    assignStringToMppt,
    removeStringFromMppt,
  };
}
