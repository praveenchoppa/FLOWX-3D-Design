/**
 * intraStringWiring.js — P5D geometry-backed intra-string wiring (pure, UI-independent).
 *
 * Uses orderedPanelSequence and real panelLayout positions only.
 *
 * Connection convention:
 * Consecutive panels connect at module center (scene XZ). Segment length is the
 * horizontal Euclidean distance between centers — a visualization estimate.
 * Exact engineering BOQ requires connector/lug geometry (future).
 *
 * Homerun length is intentionally null until a real termination point exists (P5E).
 */

import { roundMetric } from "../utils/seriesMath.js";
import {
  buildPlacedPanelBySlotId,
  horizontalCenterDistanceM,
  panelWiringAnchor,
  buildDeckYByRoofId,
} from "../utils/geometry.js";

/** Documented MVP wiring convention identifier. */
export const INTRA_STRING_WIRING_CONVENTION = "panel-center-horizontal-xz";

/**
 * @typedef {object} IntraStringSegment
 * @property {string} stringId
 * @property {string} fromPanelId
 * @property {string} toPanelId
 * @property {{ x: number, y: number, z: number }} from
 * @property {{ x: number, y: number, z: number }} to
 * @property {number} lengthM
 * @property {number} sequenceIndex
 */

/**
 * @typedef {object} IntraStringWiring
 * @property {string} stringId
 * @property {string} arrayId
 * @property {string|null} mpptId
 * @property {IntraStringSegment[]} segments
 * @property {number|null} intraStringLengthM
 * @property {null} homerunLengthM
 * @property {boolean} complete
 * @property {string[]} missingPanelIds
 * @property {string} convention
 */

/**
 * @param {object} stringRecord
 * @param {Map<string, object>} panelBySlotId
 * @param {Record<string, number>} deckYMap
 * @returns {IntraStringWiring}
 */
export function computeIntraStringWiring(stringRecord, panelBySlotId, deckYMap) {
  const sequence = stringRecord?.orderedPanelSequence ?? [];
  const missingPanelIds = sequence.filter((id) => !panelBySlotId.has(id));
  const segments = [];

  if (missingPanelIds.length === 0 && sequence.length >= 2) {
    for (let i = 0; i < sequence.length - 1; i += 1) {
      const fromPanel = panelBySlotId.get(sequence[i]);
      const toPanel = panelBySlotId.get(sequence[i + 1]);
      if (!fromPanel || !toPanel) continue;

      const lengthM = horizontalCenterDistanceM(fromPanel, toPanel);
      segments.push({
        stringId:       stringRecord.id,
        fromPanelId:    sequence[i],
        toPanelId:      sequence[i + 1],
        from:           panelWiringAnchor(fromPanel, deckYMap),
        to:             panelWiringAnchor(toPanel, deckYMap),
        lengthM:        roundMetric(lengthM, 2),
        sequenceIndex:  i,
      });
    }
  }

  const complete = missingPanelIds.length === 0
    && (sequence.length <= 1 || segments.length === sequence.length - 1);

  let intraStringLengthM = null;
  if (complete) {
    if (sequence.length <= 1) {
      intraStringLengthM = 0;
    } else {
      intraStringLengthM = roundMetric(
        segments.reduce((sum, seg) => sum + seg.lengthM, 0),
        1,
      );
    }
  }

  return {
    stringId:           stringRecord.id,
    arrayId:            stringRecord.arrayId,
    mpptId:             stringRecord.mpptId ?? null,
    segments,
    intraStringLengthM,
    homerunLengthM:     null,
    complete,
    missingPanelIds,
    convention:         INTRA_STRING_WIRING_CONVENTION,
  };
}

/**
 * @param {object[]} strings
 * @param {object|null} panelLayout
 * @param {object[]} [roofSections]
 * @returns {{
 *   byStringId: Record<string, IntraStringWiring>,
 *   segments: IntraStringSegment[],
 *   convention: string,
 * }}
 */
export function computeAllIntraStringWiring(strings, panelLayout, roofSections = []) {
  const panelBySlotId = buildPlacedPanelBySlotId(panelLayout);
  const deckYMap = buildDeckYByRoofId(roofSections);
  const byStringId = {};
  const segments = [];

  for (const str of strings ?? []) {
    const wiring = computeIntraStringWiring(str, panelBySlotId, deckYMap);
    byStringId[str.id] = wiring;
    segments.push(...wiring.segments);
  }

  return {
    byStringId,
    segments,
    convention: INTRA_STRING_WIRING_CONVENTION,
  };
}
