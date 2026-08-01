/**
 * useIntraStringWiring.js — P5E effective wiring (thin store wrapper).
 */
import { useMemo } from "react";

import { useElectricalStore } from "./useElectricalStore.js";
import { composeEffectiveWiring } from "../services/effectiveWiring.js";

export function useIntraStringWiring(roofSections = [], designCentre = null) {
  const { strings, panelLayout, terminationPoint } = useElectricalStore();

  return useMemo(
    () => composeEffectiveWiring({
      strings,
      panelLayout,
      roofSections,
      terminationPoint,
      designCentre,
    }),
    [strings, panelLayout, roofSections, terminationPoint, designCentre],
  );
}
