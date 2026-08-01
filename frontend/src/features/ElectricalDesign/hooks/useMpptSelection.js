/**
 * useMpptSelection.js — MPPT selection API (P4).
 */

import { useCallback } from "react";

import { useElectricalStore } from "./useElectricalStore.js";

export function useMpptSelection() {
  const {
    mppts,
    selectedMpptId,
    selectedMppt,
    selectMppt,
  } = useElectricalStore();

  const selectMpptOnly = useCallback(
    (mpptId) => selectMppt(mpptId),
    [selectMppt],
  );

  return {
    mppts,
    selectedMpptId,
    selectedMppt,
    selectMppt,
    selectMpptOnly,
  };
}
