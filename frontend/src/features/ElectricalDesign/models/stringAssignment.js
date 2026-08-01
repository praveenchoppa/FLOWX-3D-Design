/**
 * stringAssignment.js — P4b String ↔ MPPT assignment (pure).
 *
 * Dual-reference contract:
 *   string.mpptId ⟺ mppt.stringIds contains string.id
 *
 * P5B MVP workflow: at most one String per MPPT (validation + normalization).
 * mppt.stringIds[] remains an array for future multi-string support.
 */

export const MPPT_OCCUPIED_REASON = "This MPPT already has a String assigned. Remove the existing assignment or choose an empty MPPT.";

export const ALL_MPPTS_OCCUPIED_MESSAGE = "All MPPTs are occupied. Remove an existing assignment or choose an inverter with additional MPPT capacity.";

/**
 * Remove orphaned string ids from all MPPTs.
 *
 * @param {object[]} mppts
 * @param {Set<string>|string[]} validStringIds
 */
export function pruneMpptStringReferences(mppts, validStringIds) {
  const valid = validStringIds instanceof Set
    ? validStringIds
    : new Set(validStringIds ?? []);

  return (mppts ?? []).map((m) => ({
    ...m,
    stringIds: (m.stringIds ?? []).filter((id) => valid.has(id)),
  }));
}

/**
 * @param {object[]} mppts
 * @param {string} stringId
 */
function removeStringIdFromAllMppts(mppts, stringId) {
  return (mppts ?? []).map((m) => ({
    ...m,
    stringIds: (m.stringIds ?? []).filter((id) => id !== stringId),
  }));
}

/**
 * @param {object[]} mppts
 * @param {string} mpptId
 * @param {string} stringId
 */
function addStringIdToMppt(mppts, mpptId, stringId) {
  return (mppts ?? []).map((m) => {
    if (m.id !== mpptId) return m;
    const ids = m.stringIds ?? [];
    if (ids.includes(stringId)) return m;
    return { ...m, stringIds: [...ids, stringId] };
  });
}

/**
 * Assign a string to an MPPT (reassign removes from prior MPPT automatically).
 *
 * @param {object[]} strings
 * @param {object[]} mppts
 * @param {string} stringId
 * @param {string} mpptId
 * @param {string|null} [projectInverterId]
 */
export function assignStringToMppt(strings, mppts, stringId, mpptId, projectInverterId = null) {
  const str = (strings ?? []).find((s) => s.id === stringId);
  if (!str) {
    return { ok: false, reason: "String could not be found." };
  }

  const mppt = (mppts ?? []).find((m) => m.id === mpptId);
  if (!mppt) {
    return { ok: false, reason: "MPPT could not be found." };
  }

  if (projectInverterId && mppt.inverterId !== projectInverterId) {
    return { ok: false, reason: "MPPT does not belong to the project inverter." };
  }

  if (str.mpptId === mpptId) {
    return { ok: true, strings, mppts, stringId, mpptId };
  }

  const occupiedByOther = (mppt.stringIds ?? []).some((id) => id !== stringId);
  if (occupiedByOther) {
    return { ok: false, reason: MPPT_OCCUPIED_REASON };
  }

  let nextMppts = removeStringIdFromAllMppts(mppts, stringId);
  nextMppts = addStringIdToMppt(nextMppts, mpptId, stringId);

  const nextStrings = (strings ?? []).map((s) => (
    s.id === stringId ? { ...s, mpptId } : s
  ));

  return { ok: true, strings: nextStrings, mppts: nextMppts, stringId, mpptId };
}

/**
 * Remove a string from its assigned MPPT.
 *
 * @param {object[]} strings
 * @param {object[]} mppts
 * @param {string} stringId
 */
export function removeStringFromMppt(strings, mppts, stringId) {
  const str = (strings ?? []).find((s) => s.id === stringId);
  if (!str) {
    return { ok: false, reason: "String could not be found." };
  }

  if (!str.mpptId) {
    return { ok: false, reason: "String is not assigned to an MPPT." };
  }

  const nextMppts = removeStringIdFromAllMppts(mppts, stringId);
  const nextStrings = (strings ?? []).map((s) => (
    s.id === stringId ? { ...s, mpptId: null } : s
  ));

  return { ok: true, strings: nextStrings, mppts: nextMppts, stringId };
}

/**
 * Prune MPPT references after strings are removed from the store.
 *
 * @param {object[]} strings
 * @param {object[]} mppts
 */
export function syncMpptsAfterStringRemoval(strings, mppts) {
  const validIds = new Set((strings ?? []).map((s) => s.id));
  return pruneMpptStringReferences(mppts, validIds);
}

/**
 * Resolve MPPT for a string via string.mpptId.
 *
 * @param {object[]} mppts
 * @param {object|null} string
 */
export function mpptForString(mppts, string) {
  if (!string?.mpptId) return null;
  return (mppts ?? []).find((m) => m.id === string.mpptId) ?? null;
}

/**
 * Resolve string entities referenced by an MPPT (order follows mppt.stringIds).
 *
 * @param {object[]} strings
 * @param {object|null} mppt
 */
export function stringsForMppt(strings, mppt) {
  if (!mppt?.stringIds?.length) return [];
  const byId = new Map((strings ?? []).map((s) => [s.id, s]));
  return (mppt.stringIds ?? [])
    .map((id) => byId.get(id))
    .filter(Boolean);
}

/**
 * Whether any MPPT has more than one assigned string (pre-P5B legacy state).
 *
 * @param {object[]} mppts
 */
export function hasMultiStringMpptAssignments(mppts) {
  return (mppts ?? []).some((m) => (m.stringIds?.length ?? 0) > 1);
}

/**
 * MPPTs available as assignment targets for a string (empty + current assignment).
 *
 * @param {object[]} inverterMppts
 * @param {string|null} selectedStringId
 */
export function assignableMpptsForString(inverterMppts, selectedStringId = null) {
  return (inverterMppts ?? []).filter((mppt) => {
    const ids = mppt.stringIds ?? [];
    if (ids.length === 0) return true;
    return !!selectedStringId && ids.length === 1 && ids[0] === selectedStringId;
  });
}

/**
 * Assignable MPPT targets grouped by owning inverter (multi-inverter picker).
 *
 * @param {object[]} inverters
 * @param {object[]} mppts
 * @param {string|null} selectedStringId
 */
export function assignableMpptsGroupedByInverter(inverters, mppts, selectedStringId = null) {
  return (inverters ?? []).map((inverter) => {
    const inverterMppts = (mppts ?? []).filter((m) => m.inverterId === inverter.id);
    return {
      inverter,
      mppts: assignableMpptsForString(inverterMppts, selectedStringId),
    };
  });
}

/**
 * True when every MPPT is occupied by a string other than the selected one.
 *
 * @param {object[]} inverterMppts
 * @param {string|null} selectedStringId
 */
export function areAllMpptsOccupied(inverterMppts, selectedStringId = null) {
  if (!inverterMppts?.length) return false;
  return assignableMpptsForString(inverterMppts, selectedStringId)
    .every((mppt) => (mppt.stringIds ?? []).length > 0);
}

/**
 * Normalize legacy multi-string MPPT assignments (P5B).
 *
 * Keeps the first string on each crowded MPPT, migrates overflow strings to
 * empty MPPTs where possible, and unassigns any remainder. Preserves user data
 * without leaving silently invalid multi-string MPPT state.
 *
 * @param {object[]} strings
 * @param {object[]} mppts
 */
export function normalizeOneStringPerMppt(strings, mppts) {
  let nextMppts = (mppts ?? []).map((m) => ({ ...m, stringIds: [...(m.stringIds ?? [])] }));
  let nextStrings = (strings ?? []).map((s) => ({ ...s }));

  if (!hasMultiStringMpptAssignments(nextMppts)) {
    return {
      strings:  nextStrings,
      mppts:    nextMppts,
      changed:  false,
      migrated: 0,
      unassigned: 0,
    };
  }

  /** @type {{ stringId: string, inverterId: string }[]} */
  const overflow = [];

  nextMppts = nextMppts.map((mppt) => {
    if ((mppt.stringIds?.length ?? 0) <= 1) return mppt;
    const [keep, ...extras] = mppt.stringIds;
    for (const stringId of extras) {
      overflow.push({ stringId, inverterId: mppt.inverterId });
    }
    return { ...mppt, stringIds: [keep] };
  });

  let migrated = 0;
  let unassigned = 0;

  const overflowByInverter = new Map();
  for (const item of overflow) {
    const list = overflowByInverter.get(item.inverterId) ?? [];
    list.push(item.stringId);
    overflowByInverter.set(item.inverterId, list);
  }

  for (const [inverterId, stringIds] of overflowByInverter.entries()) {
    const emptyMppts = nextMppts.filter(
      (m) => m.inverterId === inverterId && (m.stringIds?.length ?? 0) === 0,
    );

    for (let i = 0; i < stringIds.length; i += 1) {
      const stringId = stringIds[i];
      const target = emptyMppts[i];

      if (target) {
        nextMppts = nextMppts.map((m) => (
          m.id === target.id ? { ...m, stringIds: [stringId] } : m
        ));
        nextStrings = nextStrings.map((s) => (
          s.id === stringId ? { ...s, mpptId: target.id } : s
        ));
        migrated += 1;
      } else {
        nextMppts = removeStringIdFromAllMppts(nextMppts, stringId);
        nextStrings = nextStrings.map((s) => (
          s.id === stringId ? { ...s, mpptId: null } : s
        ));
        unassigned += 1;
      }
    }
  }

  return {
    strings: nextStrings,
    mppts: nextMppts,
    changed:  true,
    migrated,
    unassigned,
  };
}

/**
 * Verify dual-reference sync (for tests).
 *
 * @param {object[]} strings
 * @param {object[]} mppts
 */
export function assertAssignmentSync(strings, mppts) {
  const stringById = new Map((strings ?? []).map((s) => [s.id, s]));

  for (const str of strings ?? []) {
    if (str.mpptId == null) continue;
    const mppt = (mppts ?? []).find((m) => m.id === str.mpptId);
    if (!mppt) {
      throw new Error(`string ${str.id} points to missing mppt ${str.mpptId}`);
    }
    if (!(mppt.stringIds ?? []).includes(str.id)) {
      throw new Error(`string ${str.id} mpptId not reflected in mppt.stringIds`);
    }
  }

  for (const mppt of mppts ?? []) {
    for (const sid of mppt.stringIds ?? []) {
      const str = stringById.get(sid);
      if (!str) {
        throw new Error(`mppt ${mppt.id} references missing string ${sid}`);
      }
      if (str.mpptId !== mppt.id) {
        throw new Error(`mppt ${mppt.id} stringIds entry ${sid} has mismatched string.mpptId`);
      }
    }
  }
}
