/**
 * panelEditorUtils.js — Step 6B-1 panel edit overrides (pure, renderer-agnostic).
 *
 * Overrides architecture (NOT mutation):
 *   • computePanelLayout returns allValidSlots[] — every legal grid cell with a
 *     stable slotId (regionId::row::col), plus defaultRemoved[] for Phase 1
 *     professional layout (inactive by default unless added via overrides).
 *   • By default professionally active slots are placed; defaultRemoved slots are ghosts.
 *   • User edits are stored as panelOverrides = { removed: string[], added: string[] }.
 *   • Effective layout = slots where active(slotId):
 *       active = added.has(slotId) || !removed.has(slotId)
 *     (Delete → add to removed, clear from added. Add ghost → remove from removed,
 *      add to added — so re-runs can restore manual adds via the added set.)
 *   • A placement re-run replaces allValidSlots but reconcilePanelOverrides()
 *     prunes override ids that no longer exist; surviving ids keep their edit state.
 *
 * Undo/redo stores snapshots of panelOverrides (not the slot geometry).
 */

import { getPanelById } from "./panelTypes.js";
import { panelForPlacement, ORIENTATIONS } from "./panelConfig.js";

/** @typedef {{ removed: string[], added: string[], rotated: Record<string, string> }} PanelOverrides */

export const EMPTY_PANEL_OVERRIDES = /** @type {PanelOverrides} */ ({
  removed: [],
  added:   [],
  rotated: {},
});

function normalizeOverrides(overrides = EMPTY_PANEL_OVERRIDES) {
  return {
    removed: overrides.removed ?? [],
    added:   overrides.added ?? [],
    rotated: { ...(overrides.rotated ?? {}) },
  };
}

/** Infer orientation from panel footprint vs module spec. */
export function inferPanelOrientation(panel) {
  const mod = getPanelById(panel?.panelTypeId);
  if (!mod) return ORIENTATIONS.PORTRAIT;
  const w = mod.widthM ?? mod.width ?? 0;
  const h = mod.heightM ?? mod.height ?? 0;
  if (Math.abs((panel.width ?? 0) - w) < 0.02 && Math.abs((panel.length ?? 0) - h) < 0.02) {
    return ORIENTATIONS.PORTRAIT;
  }
  return ORIENTATIONS.LANDSCAPE;
}

/** Effective orientation including user rotate override. */
export function effectivePanelOrientation(panel, overrides = EMPTY_PANEL_OVERRIDES) {
  const sid = panel?.slotId ?? panel?.id;
  return overrides.rotated?.[sid] ?? inferPanelOrientation(panel);
}

function applyOrientationToPanel(panel, orientation) {
  const fp = panelForPlacement(panel.panelTypeId, orientation);
  if (!fp) return panel;
  return { ...panel, width: fp.width, length: fp.height };
}

/** True when this slot is in the effective (rendered) layout. */
export function isSlotActive(slotId, overrides = EMPTY_PANEL_OVERRIDES) {
  const removed = new Set(overrides.removed ?? []);
  const added   = new Set(overrides.added ?? []);
  return added.has(slotId) || !removed.has(slotId);
}

/** Effective active state including professional-layout defaultRemoved. */
export function isSlotActiveWithDefault(slotId, overrides = EMPTY_PANEL_OVERRIDES, defaultRemoved = new Set()) {
  const removed = new Set(overrides.removed ?? []);
  const added   = new Set(overrides.added ?? []);
  if (added.has(slotId)) return true;
  if (removed.has(slotId)) return false;
  return !defaultRemoved.has(slotId);
}

/**
 * Apply overrides to a base layout from computePanelLayout.
 *
 * Default professional layout: slots listed in baseLayout.defaultRemoved are inactive
 * unless explicitly added via overrides.added.
 *
 * @param {object|null} baseLayout  { allValidSlots, defaultRemoved?, … }
 * @param {PanelOverrides} overrides
 * @returns {{ placedPanels, ghostSlots, allValidSlots, summary }}
 */
export function applyPanelOverrides(baseLayout, overrides = EMPTY_PANEL_OVERRIDES) {
  const empty = {
    placedPanels:  [],
    ghostSlots:    [],
    allValidSlots: [],
    summary:       { total: 0, byRegion: {}, totalValidSlots: 0 },
  };

  if (!baseLayout?.allValidSlots?.length) return empty;

  const slots = baseLayout.allValidSlots;
  const defaultRemoved = new Set(baseLayout.defaultRemoved ?? []);
  const placedPanels = [];
  const ghostSlots   = [];
  const byRegion     = {};

  for (const slot of slots) {
    if (isSlotActiveWithDefault(slot.slotId, overrides, defaultRemoved)) {
      placedPanels.push({
        id:          slot.slotId,
        slotId:      slot.slotId,
        regionId:    slot.regionId,
        roofId:      slot.roofId,
        center:      slot.center,
        width:       slot.width,
        length:      slot.length,
        rotation:    slot.rotation,
        panelTypeId: slot.panelTypeId,
        row:         slot.row,
        col:         slot.col,
      });
      byRegion[slot.regionId] = (byRegion[slot.regionId] ?? 0) + 1;
    } else {
      ghostSlots.push(slot);
    }
  }

  return {
    placedPanels,
    ghostSlots,
    allValidSlots: slots,
    summary: {
      total:           placedPanels.length,
      byRegion,
      totalValidSlots: slots.length,
    },
  };
}

/**
 * Resolve placed panels for 3D render from a generated layout snapshot.
 *
 * Unlike applyPanelOverrides(), this does NOT walk allValidSlots (which still
 * contains maximum-fit slots after capacity trimming).  It starts from
 * generatedLayout.placedPanels and applies user removed/added edits only.
 *
 * @param {object|null} generatedLayout  committed generatedPanelLayout snapshot
 * @param {PanelOverrides} overrides
 * @returns {object[]}
 */
export function resolveRenderedPlacedPanels(
  generatedLayout,
  overrides = EMPTY_PANEL_OVERRIDES,
) {
  if (!generatedLayout?.placedPanels?.length) return [];

  const removed = new Set(overrides.removed ?? []);
  const added   = new Set(overrides.added ?? []);

  const placed = generatedLayout.placedPanels.filter(
    (p) => !removed.has(p.slotId ?? p.id),
  );

  const rotated = overrides.rotated ?? {};
  const applyRotations = (list) => list.map((panel) => {
    const sid = panel.slotId ?? panel.id;
    const orient = rotated[sid];
    return orient ? applyOrientationToPanel(panel, orient) : panel;
  });

  if (!added.size || !generatedLayout.allValidSlots?.length) {
    return applyRotations(placed);
  }

  const placedIds = new Set(placed.map((p) => p.slotId ?? p.id));
  for (const slot of generatedLayout.allValidSlots) {
    if (!added.has(slot.slotId) || placedIds.has(slot.slotId)) continue;
    placed.push({
      id:          slot.slotId,
      slotId:      slot.slotId,
      regionId:    slot.regionId,
      roofId:      slot.roofId,
      center:      slot.center,
      width:       slot.width,
      length:      slot.length,
      rotation:    slot.rotation,
      panelTypeId: slot.panelTypeId,
      row:         slot.row,
      col:         slot.col,
    });
  }

  return applyRotations(placed);
}

/**
 * Ghost slots for add-mode — slots in the generated snapshot not currently placed.
 *
 * @param {object|null} generatedLayout
 * @param {object[]} renderedPlacedPanels
 * @returns {object[]}
 */
export function resolveRenderedGhostSlots(generatedLayout, renderedPlacedPanels = []) {
  if (!generatedLayout?.allValidSlots?.length) return [];
  const activeIds = new Set(renderedPlacedPanels.map((p) => p.slotId ?? p.id));
  return generatedLayout.allValidSlots.filter((s) => !activeIds.has(s.slotId));
}

/**
 * Authoritative read model for the Placement Area workflow.
 *
 * Starts from the committed generated snapshot and applies user add/delete
 * overrides only — never walks allValidSlots via applyPanelOverrides().
 *
 * @param {object|null} generatedLayout  generatedPanelLayout snapshot
 * @param {PanelOverrides} overrides
 * @returns {{ placedPanels, ghostSlots, allValidSlots, summary, … }}
 */
export function resolveEffectivePanelLayout(
  generatedLayout,
  overrides = EMPTY_PANEL_OVERRIDES,
) {
  const empty = {
    placedPanels:  [],
    ghostSlots:    [],
    allValidSlots: [],
    summary:       { total: 0, byRegion: {}, totalValidSlots: 0 },
  };

  if (!generatedLayout) return empty;

  const placedPanels = resolveRenderedPlacedPanels(generatedLayout, overrides);
  const ghostSlots   = resolveRenderedGhostSlots(generatedLayout, placedPanels);

  const byRegion = {};
  for (const panel of placedPanels) {
    byRegion[panel.regionId] = (byRegion[panel.regionId] ?? 0) + 1;
  }

  return {
    ...generatedLayout,
    placedPanels,
    ghostSlots,
    summary: {
      ...(generatedLayout.summary ?? empty.summary),
      total:           placedPanels.length,
      byRegion,
      totalValidSlots: generatedLayout.allValidSlots?.length ?? 0,
    },
  };
}

/**
 * After a placement re-run, drop override ids that no longer exist in the new slot set.
 */
export function reconcilePanelOverrides(overrides, allValidSlots = []) {
  const valid = new Set(allValidSlots.map((s) => s.slotId));
  const base = normalizeOverrides(overrides);
  const rotated = { ...base.rotated };
  for (const key of Object.keys(rotated)) {
    if (!valid.has(key)) delete rotated[key];
  }
  return {
    removed: base.removed.filter((id) => valid.has(id)),
    added:   base.added.filter((id) => valid.has(id)),
    rotated,
  };
}

/** Overrides after soft-deleting one active slot. */
export function overridesAfterRemove(overrides, slotId) {
  const base = normalizeOverrides(overrides);
  const removed = new Set(base.removed);
  const added   = new Set(base.added);
  removed.add(slotId);
  added.delete(slotId);
  const rotated = { ...base.rotated };
  delete rotated[slotId];
  return { removed: [...removed], added: [...added], rotated };
}

/** Overrides after adding one ghost (inactive) slot. */
export function overridesAfterAdd(overrides, slotId) {
  const base = normalizeOverrides(overrides);
  const removed = new Set(base.removed);
  const added   = new Set(base.added);
  removed.delete(slotId);
  added.add(slotId);
  return { removed: [...removed], added: [...added], rotated: base.rotated };
}

/**
 * Overrides after moving a panel between valid slots (remove source + add target).
 * Rotation override travels with the panel to the target slot.
 */
export function overridesAfterMove(overrides, fromSlotId, toSlotId) {
  const base = normalizeOverrides(overrides);
  const removed = new Set(base.removed);
  const added   = new Set(base.added);
  const rotated = { ...base.rotated };

  if (added.has(fromSlotId)) {
    added.delete(fromSlotId);
  } else {
    removed.add(fromSlotId);
  }
  added.add(toSlotId);
  removed.delete(toSlotId);

  if (rotated[fromSlotId]) {
    rotated[toSlotId] = rotated[fromSlotId];
    delete rotated[fromSlotId];
  }

  return { removed: [...removed], added: [...added], rotated };
}

/** Overrides after rotating one placed panel (portrait ⇄ landscape). */
export function overridesAfterRotate(overrides, slotId, orientation) {
  const base = normalizeOverrides(overrides);
  return {
    removed: base.removed,
    added:   base.added,
    rotated: { ...base.rotated, [slotId]: orientation },
  };
}

/** Push current overrides onto past stack; clear future (for undo/redo). */
export function historyBeforeEdit(history) {
  return {
    past:   [...(history.past ?? []), history.present ?? EMPTY_PANEL_OVERRIDES],
    future: [],
  };
}

export function canUndoPanelEdit(history) {
  return (history.past ?? []).length > 0;
}

export function canRedoPanelEdit(history) {
  return (history.future ?? []).length > 0;
}

/** Undo: pop past → present, push old present to future. */
export function undoPanelEditHistory(history) {
  const past = history.past ?? [];
  if (!past.length) return history;
  const previous = past[past.length - 1];
  return {
    present: previous,
    past:    past.slice(0, -1),
    future:  [history.present ?? EMPTY_PANEL_OVERRIDES, ...(history.future ?? [])],
  };
}

/** Redo: shift future → present, push old present to past. */
export function redoPanelEditHistory(history) {
  const future = history.future ?? [];
  if (!future.length) return history;
  const next = future[0];
  return {
    present: next,
    past:    [...(history.past ?? []), history.present ?? EMPTY_PANEL_OVERRIDES],
    future:  future.slice(1),
  };
}

export function createPanelEditHistory(overrides = EMPTY_PANEL_OVERRIDES) {
  return { present: normalizeOverrides(overrides), past: [], future: [] };
}
