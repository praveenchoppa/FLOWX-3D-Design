/**
 * homerunWiring.js — P5E straight-line homerun wiring (pure, derived-only).
 *
 * One homerun per wiring-complete string. Length is horizontal XZ center-to-center
 * (same convention as P5D). No homerun without a user-placed termination point.
 */

import { roundMetric } from "../utils/seriesMath.js";
import {
  buildDeckYByRoofId,
  buildPlacedPanelBySlotId,
  horizontalCenterDistanceM,
  panelWiringAnchor,
} from "../utils/geometry.js";
import { terminationWiringAnchor } from "../utils/terminationPlacement.js";

/** Documented MVP homerun convention identifier. */
export const HOMERUN_WIRING_CONVENTION = "string-endpoint-to-termination-straight-xz";

/**
 * @typedef {object} HomerunSegment
 * @property {string} stringId
 * @property {string} fromPanelId
 * @property {{ x: number, y: number, z: number }} from
 * @property {{ x: number, y: number, z: number }} to
 * @property {number} lengthM
 * @property {{ x: number, y: number, z: number }[]} path
 */

/**
 * @typedef {object} StringHomerunWiring
 * @property {string} stringId
 * @property {HomerunSegment|null} segment
 * @property {number|null} homerunLengthM
 * @property {boolean} complete
 * @property {string|null} reason
 */

/**
 * @param {object} params
 * @returns {{ byStringId: Record<string, StringHomerunWiring>, segments: HomerunSegment[] }}
 */
export function computeHomerunWiring({
  strings = [],
  intraByStringId = {},
  terminationPoint = null,
  panelLayout = null,
  roofSections = [],
  designCentre = null,
}) {
  const byStringId = {};
  const segments = [];

  if (!terminationPoint) {
    for (const str of strings ?? []) {
      byStringId[str.id] = {
        stringId:       str.id,
        segment:        null,
        homerunLengthM: null,
        complete:       false,
        reason:         "pending_termination",
      };
    }
    return { byStringId, segments };
  }

  const panelBySlotId = buildPlacedPanelBySlotId(panelLayout);
  const deckYMap = buildDeckYByRoofId(roofSections);
  const centre = designCentre ?? { lat: 0, lng: 0 };

  for (const str of strings ?? []) {
    const intra = intraByStringId[str.id];
    if (!intra?.complete) {
      byStringId[str.id] = {
        stringId:       str.id,
        segment:        null,
        homerunLengthM: null,
        complete:       false,
        reason:         intra ? "intra_incomplete" : "missing_intra",
      };
      continue;
    }

    const panelId = str.endPanelId
      ?? (str.orderedPanelSequence?.length
        ? str.orderedPanelSequence[str.orderedPanelSequence.length - 1]
        : null);

    const endPanel = panelId ? panelBySlotId.get(panelId) : null;
    if (!endPanel) {
      byStringId[str.id] = {
        stringId:       str.id,
        segment:        null,
        homerunLengthM: null,
        complete:       false,
        reason:         "missing_end_panel",
      };
      continue;
    }

    const from = panelWiringAnchor(endPanel, deckYMap);
    const to = terminationWiringAnchor(terminationPoint, roofSections, centre);
    const lengthM = roundMetric(
      horizontalCenterDistanceM(
        { center: { x: from.x, z: from.z } },
        { center: { x: to.x, z: to.z } },
      ),
      1,
    );

    const segment = {
      stringId:    str.id,
      fromPanelId: panelId,
      from,
      to,
      lengthM,
      path:        [from, to],
    };

    byStringId[str.id] = {
      stringId:       str.id,
      segment,
      homerunLengthM: lengthM,
      complete:       true,
      reason:         null,
    };
    segments.push(segment);
  }

  return { byStringId, segments };
}
