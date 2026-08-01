/**
 * effectiveWiring.js — P5E single SSOT wiring pipeline (intra + homerun).
 *
 * Derived only — never persist output geometry.
 */

import { computeAllIntraStringWiring, INTRA_STRING_WIRING_CONVENTION } from "./intraStringWiring.js";
import { computeHomerunWiring, HOMERUN_WIRING_CONVENTION } from "./homerunWiring.js";
import { roundMetric } from "../utils/seriesMath.js";

/**
 * @typedef {object} StringWiringResult
 * @property {string} stringId
 * @property {import('./intraStringWiring.js').IntraStringWiring} intra
 * @property {import('./homerunWiring.js').StringHomerunWiring} homerun
 * @property {number|null} totalCableLengthM
 */

/**
 * @typedef {object} EffectiveWiringLayout
 * @property {Record<string, StringWiringResult>} byStringId
 * @property {import('./intraStringWiring.js').IntraStringSegment[]} intraSegments
 * @property {import('./homerunWiring.js').HomerunSegment[]} homerunSegments
 * @property {import('../models/terminationPoint.js').TerminationPoint|null} terminationPoint
 * @property {string} convention
 */

/**
 * @param {object} params
 * @returns {EffectiveWiringLayout}
 */
export function composeEffectiveWiring({
  strings = [],
  panelLayout = null,
  roofSections = [],
  terminationPoint = null,
  designCentre = null,
}) {
  const intra = computeAllIntraStringWiring(strings, panelLayout, roofSections);
  const homerun = computeHomerunWiring({
    strings,
    intraByStringId: intra.byStringId,
    terminationPoint,
    panelLayout,
    roofSections,
    designCentre,
  });

  const byStringId = {};

  for (const str of strings ?? []) {
    const intraResult = intra.byStringId[str.id];
    const homerunResult = homerun.byStringId[str.id] ?? {
      stringId:       str.id,
      segment:        null,
      homerunLengthM: null,
      complete:       false,
      reason:         "pending_termination",
    };

    let totalCableLengthM = null;
    if (intraResult?.complete && intraResult.intraStringLengthM != null) {
      if (homerunResult.complete && homerunResult.homerunLengthM != null) {
        totalCableLengthM = roundMetric(
          intraResult.intraStringLengthM + homerunResult.homerunLengthM,
          1,
        );
      } else if (!terminationPoint) {
        totalCableLengthM = null;
      }
    }

    byStringId[str.id] = {
      stringId: str.id,
      intra:    intraResult,
      homerun:  homerunResult,
      totalCableLengthM,
    };
  }

  return {
    byStringId,
    intraSegments:    intra.segments,
    homerunSegments:  homerun.segments,
    terminationPoint,
    convention:       `${INTRA_STRING_WIRING_CONVENTION}+${HOMERUN_WIRING_CONVENTION}`,
  };
}
