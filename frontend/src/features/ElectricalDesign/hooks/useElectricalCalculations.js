/**
 * useElectricalCalculations.js — P5A/P5C derived electrical metrics (thin store wrapper).
 */

import { useMemo } from "react";

import { computeElectricalMetrics } from "../services/electricalCalculations.js";
import { evaluateMpptUtilization } from "../services/mpptUtilization.js";
import { mpptsForInverter } from "../models/mppt.js";
import { useElectricalStore } from "./useElectricalStore.js";

export function useElectricalCalculations() {
  const {
    arrays,
    strings,
    mppts,
    inverters,
    projectInverter,
    selectedInverter,
    panelLayout,
    mpptAllowedOverloadPercent,
  } = useElectricalStore();

  const activeInverter = selectedInverter ?? projectInverter;

  const metrics = useMemo(
    () => computeElectricalMetrics({
      arrays,
      strings,
      mppts,
      inverters,
      inverter: activeInverter,
      panelLayout,
    }),
    [arrays, strings, mppts, inverters, activeInverter, panelLayout],
  );

  const scopedMppts = useMemo(
    () => (activeInverter ? mpptsForInverter(mppts, activeInverter) : mppts),
    [mppts, activeInverter],
  );

  const utilization = useMemo(
    () => evaluateMpptUtilization({
      metrics,
      mppts: scopedMppts,
      allowedOverloadPercent: mpptAllowedOverloadPercent,
    }),
    [metrics, scopedMppts, mpptAllowedOverloadPercent],
  );

  return {
    metrics,
    utilization,
    warnings: utilization.warnings,
  };
}
