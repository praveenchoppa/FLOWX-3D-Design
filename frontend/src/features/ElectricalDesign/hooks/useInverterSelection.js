/**
 * useInverterSelection.js — Inverter selection API (P4).
 */

import { useCallback } from "react";

import { useElectricalStore } from "./useElectricalStore.js";

export function useInverterSelection() {
  const {
    inverters,
    projectInverter,
    selectedInverterId,
    selectedInverter,
    inverterMppts,
    selectInverter,
  } = useElectricalStore();

  const selectInverterOnly = useCallback(
    (inverterId) => selectInverter(inverterId),
    [selectInverter],
  );

  return {
    inverters,
    projectInverter,
    selectedInverterId,
    selectedInverter,
    inverterMppts,
    selectInverter,
    selectInverterOnly,
  };
}
