/**
 * useArraySelection.js — Array selection derived from electricalStore.
 */

import { useCallback } from "react";

import { useElectricalStore } from "./useElectricalStore.js";

export function useArraySelection() {
  const {
    arrays,
    selectedArrayIds,
    selectedArray,
    selectedArrays,
    selectArray,
  } = useElectricalStore();

  const selectArrayOnly = useCallback(
    (arrayId) => selectArray(arrayId, { additive: false }),
    [selectArray],
  );

  const toggleArrayInSelection = useCallback(
    (arrayId) => selectArray(arrayId, { additive: true }),
    [selectArray],
  );

  return {
    arrays,
    selectedArrayIds,
    selectedArray,
    selectedArrays,
    selectArray,
    selectArrayOnly,
    toggleArrayInSelection,
  };
}
