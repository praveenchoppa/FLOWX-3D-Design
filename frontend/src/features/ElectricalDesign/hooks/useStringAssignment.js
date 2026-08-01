/**
 * useStringAssignment.js — P4b/P5b String → MPPT assignment (thin store wrapper).
 */

import { useMemo } from "react";

import { useElectricalStore } from "./useElectricalStore.js";
import {
  ALL_MPPTS_OCCUPIED_MESSAGE,
  assignableMpptsGroupedByInverter,
  mpptForString,
} from "../models/stringAssignment.js";

export function useStringAssignment() {
  const {
    selectedString,
    selectedStringId,
    inverters,
    assignStringToMppt,
    removeStringFromMppt,
    mppts,
  } = useElectricalStore();

  const assignedMppt = useMemo(
    () => (selectedString ? mpptForString(mppts, selectedString) : null),
    [mppts, selectedString],
  );

  const assignableGroups = useMemo(
    () => assignableMpptsGroupedByInverter(inverters, mppts, selectedStringId),
    [inverters, mppts, selectedStringId],
  );

  const assignableMppts = useMemo(
    () => assignableGroups.flatMap((group) => group.mppts),
    [assignableGroups],
  );

  const hasEmptyAssignableMppt = useMemo(
    () => assignableMppts.some((mppt) => (mppt.stringIds?.length ?? 0) === 0),
    [assignableMppts],
  );

  const hasAnyInverter = inverters.length > 0;

  const allMpptsOccupied = useMemo(
    () => hasAnyInverter
      && assignableMppts.length === 0
      && !selectedString?.mpptId,
    [hasAnyInverter, assignableMppts.length, selectedString?.mpptId],
  );

  const canAssignString = !!selectedString
    && hasAnyInverter
    && assignableMppts.length > 0
    && !allMpptsOccupied;

  const canRemoveAssignment = !!selectedString?.mpptId;

  const canChangeMpptAssignment = !!selectedString
    && hasEmptyAssignableMppt;

  return {
    selectedString,
    selectedStringId,
    assignableGroups,
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
