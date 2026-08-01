/**
 * cable.js — Cable / wiring record helpers (P5D intra-string, P5E homerun).
 *
 * Homerun coordinates and length remain null until a real termination point exists.
 */

/**
 * @typedef {import('../services/effectiveWiring.js').StringWiringResult} StringWiringResult
 */

/**
 * Placeholder for future routed homerun cable (P6+).
 * homerunLength and termination coordinates are never fabricated.
 *
 * @param {object} params
 * @returns {object}
 */
export function createHomerunCableRecord({
  stringId,
  mpptId = null,
  inverterId = null,
}) {
  return {
    stringId,
    mpptId,
    inverterId,
    startPoint:        null,
    endPoint:          null,
    path:              [],
    homerunLengthM:    null,
    mode:              "logical",
    terminationPending: true,
  };
}

/**
 * @param {StringWiringResult["intra"]|null} intra
 */
export function wiringSummaryForDisplay(intra) {
  if (!intra?.complete || intra.intraStringLengthM == null) {
    return { value: "—", detail: null };
  }
  return {
    value:  `${intra.intraStringLengthM} m`,
    detail: "(center-to-center estimate)",
  };
}

/**
 * @param {import('../models/terminationPoint.js').TerminationPoint|null} terminationPoint
 * @param {number|null} homerunLengthM
 */
export function homerunLengthDisplay(terminationPoint, homerunLengthM) {
  if (!terminationPoint || homerunLengthM == null) {
    return { value: "Pending Termination Placement", detail: null };
  }
  return {
    value:  `${homerunLengthM} m`,
    detail: "(center-to-center estimate)",
  };
}

/**
 * @param {StringWiringResult|null} wiringResult
 * @param {import('../models/terminationPoint.js').TerminationPoint|null} terminationPoint
 */
export function totalCableLengthDisplay(wiringResult, terminationPoint) {
  if (!wiringResult?.intra?.complete) {
    return { value: "—", detail: null };
  }
  if (!terminationPoint || wiringResult.totalCableLengthM == null) {
    return { value: "—", detail: "Homerun pending termination placement" };
  }
  return {
    value:  `${wiringResult.totalCableLengthM} m`,
    detail: "(intra-string + homerun, center-to-center estimate)",
  };
}
