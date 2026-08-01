/**
 * useElectricalCalculations.js — P5A/P5C derived electrical metrics (thin store wrapper).
 */

import { useMemo } from "react";

import { computeElectricalMetrics } from "../services/electricalCalculations.js";
import { evaluateMpptUtilization } from "../services/mpptUtilization.js";
import { useElectricalStore } from "./useElectricalStore.js";

export function useElectricalCalculations() {
  const {
    arrays,
    strings,
    mppts,
    projectInverter,
    panelLayout,
    mpptAllowedOverloadPercent,
  } = useElectricalStore();

  const metrics = useMemo(
    () => computeElectricalMetrics({
      arrays,
      strings,
      mppts,
      inverter: projectInverter,
      panelLayout,
    }),
    [arrays, strings, mppts, projectInverter, panelLayout],
  );

  const utilization = useMemo(
    () => evaluateMpptUtilization({
      metrics,
      mppts,
      allowedOverloadPercent: mpptAllowedOverloadPercent,
    }),
    [metrics, mppts, mpptAllowedOverloadPercent],
  );

  return {
    metrics,
    utilization,
    warnings: utilization.warnings,
  };
}
