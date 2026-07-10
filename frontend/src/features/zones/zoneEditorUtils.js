/**
 * zoneEditorUtils.js — Step 5C: zone editor state utilities.
 *
 * Pure functions — no React, no Three.js.
 *
 * Responsibilities
 * ────────────────
 * • computeRegionSig    — stable signature for edit-persistence keying
 * • autoNameRegions     — "Excellent Zone A", "Good Zone B", …
 * • buildZoneDisplayList— merge zoneEdits onto allRegions from 5B
 * • computeEffectiveStats— live area totals (respects soft-delete + type-override)
 * • countOrphanedEdits  — detect unmatched edit records after a re-run
 *
 * Fuzzy-matching strategy
 * ───────────────────────
 * On every shadow re-analysis the cell grid may shift slightly (≤ 1 m per
 * boundary change), moving a region's centroid by << 0.5 m in typical cases.
 * The key encodes the centroid to 0.1 m precision, which stays stable across
 * small shifts.  For larger shifts we fall back to a euclidean centroid search
 * bounded by SIG_CENTROID_MAX_DIST_M with an optional area-relative-difference
 * guard.  When no confident match is found the region gets fresh defaults; old
 * edit records that weren't matched increment orphanedEditCount so the panel
 * can show a non-blocking warning.
 *
 * EditRecord shape (stored in DesignStudio's zoneEdits Map):
 *   {
 *     sigKey, customName, typeOverride, deleted, locked,
 *     originalAreaM2,
 *     engineeringPolygon: { outerRing, holes } | null,  // null → use autoPolygon
 *   }
 *
 * Engineering polygon model (Step 5 Phase 1):
 *   autoPolygon        — immutable snapshot from 5B merge (never stored in edits)
 *   engineeringPolygon — editable copy; initially equals autoPolygon
 */

import { ZONE_META } from "./zoneClassification";
import { shoelaceAreaM2 } from "./placementReady";

// ── Matching thresholds (named constants — change here only) ──────────────────

/** Max centroid shift (metres) between runs that still matches the same region. */
export const SIG_CENTROID_MAX_DIST_M = 2.5;

/** Max relative area difference (fraction, 0–1) allowed in a fuzzy match. */
export const SIG_AREA_MAX_REL_DIFF   = 0.20;

// ── djb2 hash (lightweight, for optional debug / polygon fingerprinting) ──────
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// ── Signature ─────────────────────────────────────────────────────────────────

/**
 * Build a stable signature object for a zone region.
 *
 * Key format:  "<roofId>::<zoneClass>::<cx.1d>,<cz.1d>"
 *   0.1 m centroid precision is stable for ≤ 0.05 m drifts (typical re-run).
 *   roofId + class are included so nearby same-centroid regions don't collide.
 *
 * @param  {object} region — Region from computeZoneMerge (has outerRing, roofId, zoneClass, areaM2)
 * @returns {{ key:string, roofId:string, cx:number, cz:number, areaM2:number }}
 */
export function computeRegionSig(region) {
  const outer = region.outerRing;
  const n     = outer.length;
  const cx    = outer.reduce((s, pt) => s + pt[0], 0) / n;
  const cz    = outer.reduce((s, pt) => s + pt[1], 0) / n;
  const key   = `${region.roofId}::${region.zoneClass}::${cx.toFixed(1)},${cz.toFixed(1)}`;
  return { key, roofId: region.roofId, cx, cz, areaM2: region.areaM2 };
}

// ── Auto-naming ───────────────────────────────────────────────────────────────

/**
 * Assign display names to all regions.
 * Within each class, regions are sorted by areaM2 DESC (largest = A).
 * Returns Map<regionId → autoName string>.
 */
export function autoNameRegions(allRegions) {
  const byClass = {};
  for (const r of allRegions) {
    (byClass[r.zoneClass] ??= []).push(r);
  }
  const names = new Map();
  for (const [cls, list] of Object.entries(byClass)) {
    list.sort((a, b) => b.areaM2 - a.areaM2);
    const label = ZONE_META[cls]?.label ?? (cls.charAt(0).toUpperCase() + cls.slice(1));
    list.forEach((r, i) => {
      const idx = i < 26 ? String.fromCharCode(65 + i) : String(i + 1);
      names.set(r.id, `${label} Zone ${idx}`);
    });
  }
  return names;
}

// ── Engineering polygon helpers ───────────────────────────────────────────────

/** Deep-clone an engineering polygon ({ outerRing, holes }). */
export function cloneEngineeringPolygon(polygon) {
  return {
    outerRing: polygon.outerRing.map(([x, z]) => [x, z]),
    holes:     (polygon.holes ?? []).map((h) => h.map(([x, z]) => [x, z])),
  };
}

/** Immutable auto polygon from a merged 5B region. */
export function getAutoPolygon(region) {
  return {
    outerRing: region.outerRing.map(([x, z]) => [x, z]),
    holes:     (region.holes ?? []).map((h) => h.map(([x, z]) => [x, z])),
  };
}

/** Resolve engineering polygon from edit record (falls back to auto). */
export function resolveEngineeringPolygon(edit, autoPolygon) {
  if (edit?.engineeringPolygon) {
    return cloneEngineeringPolygon(edit.engineeringPolygon);
  }
  return cloneEngineeringPolygon(autoPolygon);
}

/** True when stored engineering geometry differs from auto-generated. */
export function isEngineeringEdited(edit) {
  return edit?.engineeringPolygon != null;
}

/** Net area (outer − holes) for an engineering polygon. */
export function engineeringAreaM2(polygon) {
  const outerA = shoelaceAreaM2(polygon.outerRing);
  const holesA = (polygon.holes ?? []).reduce((s, h) => s + shoelaceAreaM2(h), 0);
  return Math.max(0, outerA - holesA);
}

/**
 * Step 6 placement geometry source — single resolver, no duplicated state.
 *
 * Rules:
 *   engineeringPolygon stored in edits → use it
 *   otherwise → autoPolygon (simulation merge)
 *
 * @param {object} zone  display-list entry from buildZoneDisplayList
 * @returns {{ outerRing: [number,number][], holes: [number,number][][] }}
 */
export function getActivePlacementPolygon(zone) {
  if (zone?.activePlacementPolygon) {
    return zone.activePlacementPolygon;
  }
  if (zone?.isEngineeringEdited && zone?.engineeringPolygon) {
    return cloneEngineeringPolygon(zone.engineeringPolygon);
  }
  if (zone?.autoPolygon) {
    return zone.autoPolygon;
  }
  return {
    outerRing: zone?.outerRing ?? [],
    holes:     zone?.holes ?? [],
  };
}

// ── Display list builder ──────────────────────────────────────────────────────

/**
 * Merge zoneEdits onto allRegions, producing an enriched display list.
 *
 * Each entry extends the original Region with:
 *   sigKey         — stable persistence key for edit lookups
 *   autoName       — "Excellent Zone A"
 *   displayName    — customName || autoName
 *   effectiveClass — typeOverride || zoneClass  (drives coloring + stats)
 *   deleted        — soft-delete flag
 *
 * Matching order per region:
 *   1. Exact sigKey lookup (fast path — same grid, centroid buckets unchanged)
 *   2. Fuzzy euclidean centroid search over unmatched edit records
 *
 * @param  {object[]} allRegions   from zoneMerge.computeZoneMerge().allRegions
 * @param  {Map}      zoneEdits    Map<sigKey → EditRecord>
 * @returns {{ displayList: object[], matchedSigKeys: Set<string> }}
 */
export function buildZoneDisplayList(allRegions, zoneEdits) {
  const autoNames       = autoNameRegions(allRegions);
  const matchedSigKeys  = new Set();
  const displayList     = [];

  for (const region of allRegions) {
    const sig = computeRegionSig(region);

    // ── 1. Exact key match ──────────────────────────────────────────────────
    let edit    = zoneEdits.get(sig.key);
    let editKey = sig.key;

    // ── 2. Fuzzy match (for grid shifts across re-runs) ─────────────────────
    if (!edit) {
      let bestKey  = null;
      let bestDist = Infinity;

      for (const [k, e] of zoneEdits) {
        if (matchedSigKeys.has(k)) continue;

        // Parse key: "<roofId>::<class>::<cx>,<cz>"
        const parts = k.split('::');
        if (parts.length !== 3 || parts[0] !== sig.roofId) continue;

        const comma = parts[2].indexOf(',');
        if (comma < 0) continue;
        const ecx = parseFloat(parts[2].slice(0, comma));
        const ecz = parseFloat(parts[2].slice(comma + 1));
        if (isNaN(ecx) || isNaN(ecz)) continue;

        const dist = Math.hypot(sig.cx - ecx, sig.cz - ecz);
        if (dist > SIG_CENTROID_MAX_DIST_M) continue;

        // Area guard (only when original area was stored in the edit record)
        if (e.originalAreaM2 > 0) {
          const relDiff = Math.abs(sig.areaM2 - e.originalAreaM2) / e.originalAreaM2;
          if (relDiff > SIG_AREA_MAX_REL_DIFF) continue;
        }

        if (dist < bestDist) { bestDist = dist; bestKey = k; edit = e; }
      }

      if (bestKey) editKey = bestKey;
    }

    if (edit) matchedSigKeys.add(editKey);

    const autoName       = autoNames.get(region.id) ?? region.id;
    const displayName    = edit?.customName || autoName;
    const effectiveClass = edit?.typeOverride ?? region.zoneClass;
    const deleted        = edit?.deleted ?? false;
    const locked         = edit?.locked ?? false;

    const autoPolygon         = getAutoPolygon(region);
    const engineeringPolygon  = resolveEngineeringPolygon(edit, autoPolygon);
    const engEdited           = isEngineeringEdited(edit);
    const activePlacementPolygon = engEdited
      ? cloneEngineeringPolygon(edit.engineeringPolygon)
      : autoPolygon;

    displayList.push({
      ...region,
      sigKey: sig.key,
      autoName,
      displayName,
      effectiveClass,
      deleted,
      hidden: deleted,
      locked,
      autoPolygon,
      engineeringPolygon,
      activePlacementPolygon,
      activeOuterRing: engineeringPolygon.outerRing,
      activeHoles:     engineeringPolygon.holes ?? [],
      engineeringAreaM2: engineeringAreaM2(engineeringPolygon),
      isEngineeringEdited: engEdited,
      editable: !deleted && !locked,
      // areaM2 / avgScore remain simulation (5B) values — never recomputed here.
    });
  }

  return { displayList, matchedSigKeys };
}

// ── Effective stats ───────────────────────────────────────────────────────────

/**
 * Compute live area totals from the display list, respecting:
 *   - soft-deletes (deleted zones contribute 0)
 *   - type overrides (effectiveClass drives which bucket the area goes into)
 *
 * This is the real-time source of truth for Installable Area (Step 6 input).
 *
 * @param  {object[]} displayList   from buildZoneDisplayList
 * @returns {{ totals: object, installableAreaM2: number }}
 */
export function computeEffectiveStats(displayList) {
  const totals = { excellent: 0, good: 0, average: 0, avoid: 0, blocked: 0 };
  for (const z of displayList) {
    if (z.deleted) continue;
    totals[z.effectiveClass] = (totals[z.effectiveClass] ?? 0) + z.areaM2;
  }
  return {
    totals,
    installableAreaM2: totals.excellent + totals.good,
  };
}

// ── Orphan detection ──────────────────────────────────────────────────────────

/**
 * Count edit records that could NOT be matched to any region in the current run.
 * Non-zero → panel shows the "some edits could not be restored" warning.
 */
export function countOrphanedEdits(displayList, zoneEdits) {
  if (!zoneEdits.size) return 0;
  const matchedKeys = new Set(displayList.map(z => z.sigKey));
  let count = 0;
  for (const [key, edit] of zoneEdits) {
    const hasEdits = edit.customName || edit.typeOverride || edit.deleted
      || edit.locked || edit.engineeringPolygon;
    if (hasEdits && !matchedKeys.has(key)) count++;
  }
  return count;
}
