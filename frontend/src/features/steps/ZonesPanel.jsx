/**
 * ZonesPanel — Step 5 right-hand panel.
 *
 * Features built here (Step 5C + 5E):
 *   • Zone Manager cards — auto-named (Excellent Zone A …), selectable
 *   • Card ↔ polygon selection sync (card click → polygon glow; polygon click → card highlight)
 *   • Inline rename (click pencil icon)
 *   • Soft-delete (zone.deleted = true; hidden zones restorable)
 *   • Convert type — REAL math change: effectiveClass drives area stats
 *   • Live Installable Area + per-class stats (from effectiveZoneStats)
 *   • Unmatched-edits warning banner after re-analysis
 *
 * Data flow:
 *   shadowResult → exposureResult → zoneResult (5A) → zoneMergeResult (5B)
 *   → zoneDisplayList (5C reconcile layer) → effectiveZoneStats
 *
 * Heatmap modes driven through this panel:
 *   "zone"       → 5B merged region polygons (default)
 *   "zone-cells" → 5A per-cell zone colours
 *   "shade"      → 4B shade %
 *   "score"      → 4C exposure score
 */
import { useEffect, useRef, useState } from "react";
import {
  FiEdit2, FiEyeOff, FiEye, FiGrid, FiLoader,
  FiZap, FiLayers, FiSquare, FiAlertTriangle,
  FiPlusSquare, FiX, FiCheckCircle, FiLock, FiUnlock, FiRotateCcw,
} from "react-icons/fi";

import { DESIGN_STATE } from "../zones/engineeringZoneConfig";

import {
  PanelShell, PanelHeader, KpiCard,
  InstructionList, DIVIDER, SEC_LABEL,
} from "./panelUtils";

import {
  ZONE_META, ZONE_ORDER, ZONE_THRESHOLDS,
} from "../zones/zoneClassification";

import { MIN_REGION_CELLS } from "../zones/zoneMerge";
import { BIZ_TYPE_CONFIG, BIZ_TYPES } from "../zones/bizZoneConfig";

const QUALITY_TO_ZONE_CLASS = {
  Excellent: "excellent",
  Good:      "good",
  Average:   "average",
  Avoid:     "avoid",
};

// ── View-mode toggle options ───────────────────────────────────────────────────
const VIEW_MODES = [
  { key: "zone",       label: "Regions",  icon: <FiLayers size={11} />, alwaysEnabled: false },
  { key: "zone-cells", label: "Cells",    icon: <FiSquare size={11} />, alwaysEnabled: false },
  { key: "shade",      label: "Shade %",  icon: <FiGrid   size={11} />, alwaysEnabled: true  },
  { key: "score",      label: "Score",    icon: <FiZap    size={11} />, alwaysEnabled: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatArea(m2) {
  if (m2 == null || isNaN(m2)) return "—";
  return `${m2.toFixed(1)} m²`;
}

/** Shoelace area for a scene-XZ ring [[x,z],...] */
function ringAreaM2(ring) {
  if (!ring || ring.length < 3) return 0;
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return Math.abs(a) / 2;
}

// ── BizZoneCard ───────────────────────────────────────────────────────────────
/**
 * Card for a single user-drawn business zone.
 */
function BizZoneCard({
  biz,
  isSelected,
  isEditing,
  editValue,
  onSelect,
  onStartRename,
  onEditChange,
  onCommitRename,
  onCancelRename,
  onDelete,
  onChangeType,
  cardRef,
}) {
  const cfg = BIZ_TYPE_CONFIG[biz.businessType] ?? BIZ_TYPE_CONFIG.restricted;
  const area = ringAreaM2(biz.outerRing);

  return (
    <div
      ref={cardRef}
      onClick={onSelect}
      className={`relative flex flex-col gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-150 ${
        isSelected
          ? "border-[#4F8CFF]/50 bg-[#4F8CFF]/8 shadow-[0_0_0_1px_rgba(79,140,255,0.15)]"
          : "border-[#23324A]/60 bg-[rgba(7,17,32,0.5)] hover:border-[#334466]/80"
      }`}
      style={{ borderLeftColor: cfg.color, borderLeftWidth: 3 }}
    >
      {/* ── Row 1: icon + name + actions ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[12px] shrink-0 leading-none">{cfg.icon}</span>

        {isEditing ? (
          <input
            autoFocus
            className="flex-1 bg-transparent text-[12px] text-[#F8FAFC] font-semibold border-b border-[#4F8CFF] outline-none px-0 py-0 min-w-0"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={() => onCommitRename(biz)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  { e.preventDefault(); onCommitRename(biz); }
              if (e.key === "Escape") { e.stopPropagation(); onCancelRename(); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-[12px] text-[#F8FAFC] font-semibold truncate leading-tight">
            {biz.name}
          </span>
        )}

        {/* Rename */}
        {!isEditing && (
          <button
            className="shrink-0 text-[#4a5c75] hover:text-[#94A3B8] p-0.5 transition-colors"
            onClick={(e) => { e.stopPropagation(); onStartRename(); }}
            title="Rename"
          >
            <FiEdit2 size={10} />
          </button>
        )}
        {/* Delete */}
        <button
          className="shrink-0 text-[#4a5c75] hover:text-red-400 p-0.5 transition-colors"
          onClick={(e) => { e.stopPropagation(); onDelete(biz); }}
          title="Remove zone (restores installable area)"
        >
          <FiEyeOff size={10} />
        </button>
      </div>

      {/* ── Row 2: type badge + area ─────────────────────────────────────── */}
      <div className="flex items-center justify-between pl-[18px]">
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.label}{cfg.reserved ? " (reserved)" : ""}
        </span>
        <span className="text-[10px] text-[#94A3B8] tabular-nums">{formatArea(area)}</span>
      </div>

      {/* ── Row 3: type changer (when selected) ─────────────────────────── */}
      {isSelected && (
        <div className="flex flex-wrap items-center gap-1 pl-[18px]">
          <span className="text-[9px] text-[#4a5c75] shrink-0">Type:</span>
          {BIZ_TYPES.map((type) => {
            const c      = BIZ_TYPE_CONFIG[type];
            const active = biz.businessType === type;
            return (
              <button
                key={type}
                onClick={(e) => { e.stopPropagation(); onChangeType(biz, type); }}
                className={`px-2 py-0.5 text-[9px] rounded-full border font-medium transition-all duration-100 ${
                  active
                    ? "text-white border-transparent"
                    : "text-[#94A3B8] border-[#23324A]/60 hover:text-[#F8FAFC]"
                }`}
                style={active ? { background: c.color, borderColor: c.color } : {}}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ZoneCard ──────────────────────────────────────────────────────────────────
/**
 * Individual zone region card.
 * Props:
 *   zone           — enriched display-list entry
 *   isSelected     — card is currently selected
 *   isEditing      — this card's name is being inline-edited
 *   editValue      — current value in the rename input
 *   onSelect       — () => void
 *   onStartRename  — () => void
 *   onEditChange   — (val) => void
 *   onCommitRename — (zone) => void
 *   onCancelRename — () => void
 *   onDelete       — (zone) => void
 *   onConvert      — (zone, newClass) => void
 *   cardRef        — ref for scroll-to behaviour
 */
function ZoneCard({
  zone,
  isSelected,
  isEditing,
  editValue,
  onSelect,
  onStartRename,
  onEditChange,
  onCommitRename,
  onCancelRename,
  onDelete,
  onRestore,
  onConvert,
  onToggleLock,
  onResetToAuto,
  cardRef,
  readOnly = false,
}) {
  const meta = ZONE_META[zone.effectiveClass];
  const displayArea = zone.engineeringAreaM2 ?? zone.areaM2;

  return (
    <div
      ref={cardRef}
      onClick={onSelect}
      className={`relative flex flex-col gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-150 ${
        isSelected
          ? "border-[#4F8CFF]/50 bg-[#4F8CFF]/8 shadow-[0_0_0_1px_rgba(79,140,255,0.15)]"
          : "border-[#23324A]/60 bg-[rgba(7,17,32,0.5)] hover:border-[#334466]/80"
      }`}
      style={{ borderLeftColor: meta.color, borderLeftWidth: 3 }}
    >
      {/* ── Row 1: name + actions ──────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          className="w-2 h-2 rounded-sm shrink-0"
          style={{ background: meta.color }}
        />

        {isEditing ? (
          <input
            autoFocus
            className="flex-1 bg-transparent text-[12px] text-[#F8FAFC] font-semibold border-b border-[#4F8CFF] outline-none px-0 py-0 min-w-0"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={() => onCommitRename(zone)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  { e.preventDefault(); onCommitRename(zone); }
              if (e.key === "Escape") { e.stopPropagation(); onCancelRename(); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-[12px] text-[#F8FAFC] font-semibold truncate leading-tight">
            {zone.displayName}
          </span>
        )}

        {!isEditing && !readOnly && (
          <button
            className="shrink-0 text-[#4a5c75] hover:text-[#94A3B8] p-0.5 transition-colors"
            onClick={(e) => { e.stopPropagation(); onStartRename(); }}
            title="Rename"
          >
            <FiEdit2 size={10} />
          </button>
        )}

        {!readOnly && (
          <button
            className="shrink-0 text-[#4a5c75] hover:text-[#94A3B8] p-0.5 transition-colors"
            onClick={(e) => { e.stopPropagation(); onToggleLock(zone); }}
            title={zone.locked ? "Unlock zone" : "Lock zone"}
          >
            {zone.locked ? <FiLock size={10} /> : <FiUnlock size={10} />}
          </button>
        )}

        {!readOnly && (
          <button
            className="shrink-0 text-[#4a5c75] hover:text-red-400 p-0.5 transition-colors"
            onClick={(e) => { e.stopPropagation(); onDelete(zone); }}
            title="Hide zone"
          >
            <FiEyeOff size={10} />
          </button>
        )}
      </div>

      {/* ── Row 2: meta info ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pl-[14px]">
        <span className="text-[10px] text-[#4a5c75]">
          {zone.roofName} · {formatArea(displayArea)}
          {zone.isEngineeringEdited && (
            <span className="text-[#4F8CFF]/70 ml-1">(edited)</span>
          )}
        </span>
        <span className="text-[10px] text-[#94A3B8] tabular-nums">
          Score {zone.avgScore}
        </span>
      </div>

      {/* ── Row 3: engineering status ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 pl-[14px]">
        <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-[#64748B]/40 text-[#94A3B8]">
          {readOnly ? "Analysis · read-only" : (zone.hidden || zone.deleted ? "Hidden" : "Visible")}
        </span>
        {!readOnly && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
            zone.locked
              ? "border-amber-500/30 text-amber-400"
              : "border-[#4F8CFF]/30 text-[#4F8CFF]"
          }`}>
            {zone.locked ? "Locked" : "Editable"}
          </span>
        )}
      </div>

      {/* ── Row 4: type selector + reset (when selected, not read-only) ─────── */}
      {isSelected && !readOnly && (
        <div className="flex flex-col gap-1.5 pl-[14px]">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] text-[#4a5c75] shrink-0">Type:</span>
            {ZONE_ORDER.map((cls) => {
              const m       = ZONE_META[cls];
              const active  = zone.effectiveClass === cls;
              return (
                <button
                  key={cls}
                  onClick={(e) => { e.stopPropagation(); onConvert(zone, cls); }}
                  className={`px-2 py-0.5 text-[9px] rounded-full border font-medium transition-all duration-100 ${
                    active
                      ? "text-white border-transparent"
                      : "text-[#94A3B8] border-[#23324A]/60 hover:text-[#F8FAFC] hover:border-[#334466]"
                  }`}
                  style={active ? { background: m.color, borderColor: m.color } : {}}
                >
                  {m.label}
                </button>
              );
            })}
            {zone.effectiveClass !== zone.zoneClass && (
              <button
                onClick={(e) => { e.stopPropagation(); onConvert(zone, zone.zoneClass); }}
                className="px-2 py-0.5 text-[9px] rounded-full border border-[#23324A]/40 text-[#4a5c75] hover:text-[#94A3B8] transition-colors"
              >
                ↩ reset type
              </button>
            )}
          </div>

          {zone.isEngineeringEdited && (
            <button
              onClick={(e) => { e.stopPropagation(); onResetToAuto(zone); }}
              className="flex items-center gap-1 self-start px-2 py-1 text-[9px] rounded-lg border border-[#4F8CFF]/30 text-[#4F8CFF] hover:bg-[#4F8CFF]/10 transition-colors"
            >
              <FiRotateCcw size={10} />
              Reset to Auto
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── PlacementAreaCard ───────────────────────────────────────────────────────────

function PlacementAreaCard({
  area,
  isSelected,
  isEditing,
  editValue,
  onSelect,
  onStartRename,
  onEditChange,
  onCommitRename,
  onCancelRename,
  onDelete,
  cardRef,
}) {
  return (
    <div
      ref={cardRef}
      onClick={onSelect}
      className={`relative flex flex-col gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-150 ${
        isSelected
          ? "border-[#06B6D4]/50 bg-[#06B6D4]/8 shadow-[0_0_0_1px_rgba(6,182,212,0.15)]"
          : "border-[#23324A]/60 bg-[rgba(7,17,32,0.5)] hover:border-[#334466]/80"
      }`}
      style={{ borderLeftColor: "#06B6D4", borderLeftWidth: 3 }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <FiLayers size={11} className="text-[#06B6D4] shrink-0" />

        {isEditing ? (
          <input
            autoFocus
            className="flex-1 bg-transparent text-[12px] text-[#F8FAFC] font-semibold border-b border-[#06B6D4] outline-none px-0 py-0 min-w-0"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={() => onCommitRename(area)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  { e.preventDefault(); onCommitRename(area); }
              if (e.key === "Escape") { e.stopPropagation(); onCancelRename(); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-[12px] text-[#F8FAFC] font-semibold truncate leading-tight">
            {area.name}
          </span>
        )}

        {!isEditing && (
          <button
            className="shrink-0 text-[#4a5c75] hover:text-[#94A3B8] p-0.5 transition-colors"
            onClick={(e) => { e.stopPropagation(); onStartRename(); }}
            title="Rename"
          >
            <FiEdit2 size={10} />
          </button>
        )}

        <button
          className="shrink-0 text-[#4a5c75] hover:text-red-400 p-0.5 transition-colors"
          onClick={(e) => { e.stopPropagation(); onDelete(area); }}
          title="Remove placement area"
        >
          <FiEyeOff size={10} />
        </button>
      </div>

      {area.stats && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pl-[18px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-[#4a5c75] uppercase tracking-wide">Area</span>
            <span className="text-[11px] text-[#F8FAFC] tabular-nums font-medium">
              {formatArea(area.stats.areaM2)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-[#4a5c75] uppercase tracking-wide">Usable Area</span>
            <span className="text-[11px] text-[#F8FAFC] tabular-nums font-medium">
              {formatArea(area.stats.usableAreaM2)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-[#4a5c75] uppercase tracking-wide">Solar Score</span>
            <span className="text-[11px] text-[#F8FAFC] tabular-nums font-medium">
              {area.stats.avgScore}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-[#4a5c75] uppercase tracking-wide">Quality</span>
            {(() => {
              const cls = QUALITY_TO_ZONE_CLASS[area.stats.quality] ?? "average";
              const meta = ZONE_META[cls];
              return (
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: meta?.color ?? "#94A3B8" }}
                >
                  {area.stats.quality}
                </span>
              );
            })()}
          </div>
        </div>
      )}

      {!area.stats && (
        <div className="pl-[18px]">
          <span className="text-[9px] text-[#4a5c75]">Run shadow analysis for statistics</span>
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ZonesPanel({
  roofSections = [],
  location = {},
  view3D,
  setView3D,
  // Analysis results (cascade: shadow → exposure → zone → merge)
  shadowResult    = null,
  exposureResult  = null,
  zoneResult      = null,
  zoneMergeResult = null,
  // Zone editor (Step 5C)
  zoneDisplayList  = [],
  effectiveZoneStats = null,
  orphanedEditCount  = 0,
  updateZoneEdit     = () => {},
  resetZoneToAuto    = () => {},
  designState        = DESIGN_STATE.CLEAN,
  zoneToast          = null,
  selectedZoneId     = null,
  setSelectedZoneId  = () => {},
  // Heatmap view control
  heatmapMode    = "zone",
  setHeatmapMode = () => {},
  // Shadow analysis shortcut
  runShadowAnalysis = () => {},
  shadowRunning     = false,
  canRunShadow      = false,
  // Business zones (Step 5D)
  businessZones      = [],
  selectedBizZoneId  = null,
  setSelectedBizZoneId = () => {},
  isDrawingBizZone   = false,
  pendingBizType     = "restricted",
  setPendingBizType  = () => {},
  finalInstallableStats = null,
  startBizDrawing    = () => {},
  stopBizDrawing     = () => {},
  updateBizZone      = () => {},
  deleteBizZone      = () => {},
  // Placement Areas (independent design workspace)
  placementAreas           = [],
  selectedPlacementAreaId  = null,
  setSelectedPlacementAreaId = () => {},
  isDrawingPlacementArea   = false,
  placementAreaToast       = null,
  autoRenamePlacementAreaId = null,
  onAutoRenamePlacementAreaHandled = () => {},
  startPlacementAreaDrawing = () => {},
  stopPlacementAreaDrawing  = () => {},
  updatePlacementArea       = () => {},
  deletePlacementArea       = () => {},
  // Placement readiness (Step 5H)
  placementReady     = null,
}) {
  const hasRoof     = roofSections.length > 0;
  const hasLocation = location?.lat != null;
  const hasShadow   = !!shadowResult;
  const hasExposure = !!exposureResult;
  const hasZones    = !!zoneResult;
  const hasMerge    = !!zoneMergeResult;

  // ── Local UI state ────────────────────────────────────────────────────────
  // Which zone's name field is being inline-edited.
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [editValue,     setEditValue]     = useState("");
  // Show/hide the deleted zones section.
  const [showDeleted,   setShowDeleted]   = useState(false);
  // Biz zone editing
  const [editingBizId,  setEditingBizId]  = useState(null);
  const [editBizValue,  setEditBizValue]  = useState("");
  const [showDeletedBiz, setShowDeletedBiz] = useState(false);
  const [editingPaId,    setEditingPaId]    = useState(null);
  const [editPaValue,    setEditPaValue]    = useState("");
  const [showDeletedPa,  setShowDeletedPa]  = useState(false);

  // ── Card refs for scroll-to-selected ─────────────────────────────────────
  const cardRefs = useRef({});
  const paCardRefs = useRef({});

  // Scroll the selected card into view when selection changes (e.g. polygon click).
  useEffect(() => {
    if (selectedZoneId && cardRefs.current[selectedZoneId]) {
      cardRefs.current[selectedZoneId].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedZoneId]);

  useEffect(() => {
    if (selectedPlacementAreaId && paCardRefs.current[selectedPlacementAreaId]) {
      paCardRefs.current[selectedPlacementAreaId].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedPlacementAreaId]);

  // Auto-open rename after drawing a new placement area.
  useEffect(() => {
    if (!autoRenamePlacementAreaId) return;
    const area = placementAreas.find((a) => a.id === autoRenamePlacementAreaId);
    if (area && !area.deleted) {
      setEditingPaId(area.id);
      setEditPaValue(area.name);
    }
    onAutoRenamePlacementAreaHandled();
  }, [autoRenamePlacementAreaId, placementAreas, onAutoRenamePlacementAreaHandled]);

  // ── Auto-switch views on mount ───────────────────────────────────────────
  useEffect(() => {
    setHeatmapMode("zone");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasRoof && !view3D) setView3D(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rename handlers ───────────────────────────────────────────────────────
  function startRename(zone) {
    setEditingZoneId(zone.id);
    setEditValue(zone.displayName);
  }

  function commitRename(zone) {
    if (!editingZoneId) return;
    const trimmed = editValue.trim();
    // Clear override if user typed back the auto-name or left blank.
    updateZoneEdit(zone, {
      customName: trimmed && trimmed !== zone.autoName ? trimmed : null,
    });
    setEditingZoneId(null);
    setEditValue("");
  }

  function cancelRename() {
    setEditingZoneId(null);
    setEditValue("");
  }

  // ── Business zone handlers ────────────────────────────────────────────────
  function startBizRename(biz) {
    setEditingBizId(biz.id);
    setEditBizValue(biz.name);
  }

  function commitBizRename(biz) {
    if (!editingBizId) return;
    const trimmed = editBizValue.trim();
    if (trimmed) updateBizZone(biz.id, { name: trimmed });
    setEditingBizId(null);
    setEditBizValue("");
  }

  function cancelBizRename() {
    setEditingBizId(null);
    setEditBizValue("");
  }

  function handleBizDelete(biz) {
    deleteBizZone(biz.id);
    if (selectedBizZoneId === biz.id) setSelectedBizZoneId(null);
  }

  function handleBizChangeType(biz, newType) {
    updateBizZone(biz.id, { businessType: newType });
  }

  // ── Delete / restore handlers ─────────────────────────────────────────────
  function handleDelete(zone) {
    updateZoneEdit(zone, { deleted: true });
    if (selectedZoneId === zone.id) setSelectedZoneId(null);
  }

  function handleRestore(zone) {
    updateZoneEdit(zone, { deleted: false });
  }

  // ── Convert type handler ──────────────────────────────────────────────────
  function handleConvert(zone, newClass) {
    updateZoneEdit(zone, {
      typeOverride: newClass === zone.zoneClass ? null : newClass,
    });
  }

  function handleToggleLock(zone) {
    updateZoneEdit(zone, { locked: !zone.locked });
  }

  function handleResetToAuto(zone) {
    resetZoneToAuto(zone);
  }

  // ── Placement Area handlers ───────────────────────────────────────────────
  function startPaRename(area) {
    setEditingPaId(area.id);
    setEditPaValue(area.name);
  }

  function commitPaRename(area) {
    if (!editingPaId) return;
    const trimmed = editPaValue.trim();
    if (trimmed) updatePlacementArea(area.id, { name: trimmed });
    setEditingPaId(null);
    setEditPaValue("");
  }

  function cancelPaRename() {
    setEditingPaId(null);
    setEditPaValue("");
  }

  function handlePaDelete(area) {
    deletePlacementArea(area.id);
    if (selectedPlacementAreaId === area.id) setSelectedPlacementAreaId(null);
  }

  // ── Derived display lists ─────────────────────────────────────────────────
  const visibleZones  = zoneDisplayList.filter((z) => !z.deleted);
  const deletedZones  = zoneDisplayList.filter((z) =>  z.deleted);
  const deletedCount  = deletedZones.length;

  // ── Stats source ──────────────────────────────────────────────────────────
  // Use live effective stats (reflects edits). Fall back to raw zone stats
  // before any merging is available.
  const statsSource = effectiveZoneStats ?? (zoneResult
    ? { totals: zoneResult.totals, installableAreaM2: zoneResult.installableAreaM2 }
    : null);

  // Final installable: after turf-subtracting business zones from installable sim zones.
  // Falls back to statsSource if finalInstallableStats not yet available.
  const installableM2 = finalInstallableStats?.installableAreaM2
    ?? statsSource?.installableAreaM2
    ?? 0;
  const bizSubtractedM2 = finalInstallableStats?.bizSubtractedM2 ?? 0;

  // ── Business zone derived lists ───────────────────────────────────────────
  const activeBizZones  = businessZones.filter((b) => !b.deleted);
  const deletedBizZones = businessZones.filter((b) =>  b.deleted);
  const bizCardRefs     = useRef({});

  const activePlacementAreas  = placementAreas.filter((a) => !a.deleted);
  const deletedPlacementAreas = placementAreas.filter((a) =>  a.deleted);

  // ── Header pill ───────────────────────────────────────────────────────────
  const regionCount = zoneMergeResult?.allRegions.length ?? 0;
  const pill = hasMerge ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00E38C]/10 border border-[#00E38C]/25">
      <div className="w-1.5 h-1.5 rounded-full bg-[#00E38C]" />
      <span className="text-[10px] font-semibold text-[#00E38C]">
        {regionCount} region{regionCount !== 1 ? "s" : ""}
      </span>
    </div>
  ) : hasZones ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4F8CFF]/10 border border-[#4F8CFF]/25">
      <span className="text-[10px] font-semibold text-[#4F8CFF]">Classified</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#94A3B8]/10 border border-[#94A3B8]/25">
      <span className="text-[10px] font-semibold text-[#94A3B8]">Needs analysis</span>
    </div>
  );

  return (
    <PanelShell>

      {/* ── Header ─────────────────────────────────── */}
      <PanelHeader
        label="Zones"
        subtitle="Zone classification · manager · analysis"
        pill={pill}
      />

      {DIVIDER}

      {/* ── Prerequisite prompts ───────────────────── */}
      {!hasLocation && (
        <div className="px-3 py-2.5 rounded-xl bg-[#94A3B8]/8 border border-[#94A3B8]/20 text-[11px] text-[#94A3B8]">
          Set a project location in Step 1 first.
        </div>
      )}

      {hasLocation && !hasShadow && (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            Zones are derived from the solar simulation.
            Go to <strong className="text-[#F8FAFC]">Step 4 → Shadow Analysis</strong> and click{" "}
            <strong className="text-[#4F8CFF]">Run Shadow Analysis</strong> first.
          </p>
          <button
            onClick={runShadowAnalysis}
            disabled={!canRunShadow || shadowRunning}
            className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 ${
              !canRunShadow || shadowRunning
                ? "bg-[#23324A]/40 text-[#94A3B8]/40 cursor-not-allowed"
                : "bg-[#4F8CFF] text-white hover:brightness-110"
            }`}
          >
            {shadowRunning
              ? <><FiLoader size={14} className="animate-spin" /><span>Analyzing…</span></>
              : <><FiGrid size={14} /><span>Run Shadow Analysis</span></>
            }
          </button>
        </div>
      )}

      {/* ── Installable Area — 5G/5D headline (live, includes biz-zone subtraction) ── */}
      {statsSource && (
        <>
          <div className="flex flex-col gap-2 px-3 py-4 rounded-xl bg-[#00E38C]/8 border border-[#00E38C]/30">
            <span className="text-[9px] font-bold tracking-[0.2em] text-[#00E38C] uppercase">
              Installable Area · Step 6 Input
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold text-[#00E38C] leading-none tabular-nums">
                {installableM2.toFixed(1)}
              </span>
              <span className="text-[14px] text-[#00E38C]/70 font-medium">m²</span>
            </div>
            {bizSubtractedM2 > 0.05 && (
              <div className="flex items-center gap-1.5 text-[10px] text-amber-400/80">
                <span>−{bizSubtractedM2.toFixed(1)} m² blocked by business zones</span>
              </div>
            )}
            <div className="flex gap-2">
              <KpiCard
                label="Excellent"
                value={formatArea(statsSource.totals?.excellent)}
                accent="text-[#22c55e]"
              />
              <KpiCard
                label="Good"
                value={formatArea(statsSource.totals?.good)}
                accent="text-[#86efac]"
              />
            </div>
            <p className="text-[10px] text-[#00E38C]/60 leading-relaxed">
              Excellent + Good, minus business zone overrides. Updates live.
            </p>
          </div>
          {DIVIDER}
        </>
      )}

      {/* ── Placement Readiness (5H) — Step 6 handoff summary ──────────────── */}
      {placementReady && (
        <>
          <div className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-[#4F8CFF]/8 border border-[#4F8CFF]/25">
            <div className="flex items-center gap-2">
              <FiCheckCircle size={13} className="text-[#4F8CFF] shrink-0" />
              <span className="text-[9px] font-bold tracking-[0.18em] text-[#4F8CFF] uppercase">
                Placement Readiness
              </span>
            </div>
            <p className="text-[12px] text-[#F8FAFC] leading-snug">
              {placementReady.summary.source === "placementAreas" ? (
                <>
                  Ready for panel placement:{" "}
                  <span className="font-semibold tabular-nums">
                    {placementReady.summary.placementAreaCount}
                  </span>
                  {" "}placement area{placementReady.summary.placementAreaCount !== 1 ? "s" : ""},{" "}
                  <span className="font-semibold tabular-nums">
                    {placementReady.summary.totalInstallableAreaM2.toFixed(1)}
                  </span>
                  {" "}m² installable
                  {placementReady.summary.regionCount > placementReady.summary.placementAreaCount && (
                    <>
                      {" "}
                      (<span className="font-semibold tabular-nums">
                        {placementReady.summary.regionCount}
                      </span>
                      {" "}region{placementReady.summary.regionCount !== 1 ? "s" : ""} after obstacle cuts)
                    </>
                  )}
                </>
              ) : (
                <>
                  Ready for panel placement:{" "}
                  <span className="font-semibold tabular-nums">
                    {placementReady.summary.regionCount}
                  </span>
                  {" "}installable region{placementReady.summary.regionCount !== 1 ? "s" : ""},{" "}
                  <span className="font-semibold tabular-nums">
                    {placementReady.summary.totalInstallableAreaM2.toFixed(1)}
                  </span>
                  {" "}m²
                </>
              )}
            </p>
            {placementReady.summary.source === "engineering" && (
              <div className="flex gap-2">
                <KpiCard
                  label="Excellent regions"
                  value={`${placementReady.summary.excellent.count} · ${placementReady.summary.excellent.areaM2.toFixed(1)} m²`}
                  accent="text-[#22c55e]"
                />
                <KpiCard
                  label="Good regions"
                  value={`${placementReady.summary.good.count} · ${placementReady.summary.good.areaM2.toFixed(1)} m²`}
                  accent="text-[#86efac]"
                />
              </div>
            )}
            <p className="text-[10px] text-[#94A3B8] leading-relaxed">
              {placementReady.summary.blockedCount} keep-out area
              {placementReady.summary.blockedCount !== 1 ? "s" : ""} (obstacles, business zones).
              Derived live — updates as placement areas change.
            </p>
          </div>
          {DIVIDER}
        </>
      )}

      {/* ── Unmatched edits warning ─────────────────── */}
      {orphanedEditCount > 0 && (
        <>
          <div className="flex gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <FiAlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-300/90 leading-relaxed">
              {orphanedEditCount} manual zone edit{orphanedEditCount !== 1 ? "s" : ""} could
              not be restored — zone geometry changed after re-analysis.
            </p>
          </div>
          {DIVIDER}
        </>
      )}

      {/* ── 3D view mode toggle ─────────────────────── */}
      {hasShadow && (
        <>
          <div className="flex flex-col gap-2">
            <span className={SEC_LABEL} style={{ marginBottom: 0 }}>3D View</span>
            <div className="flex items-center gap-1 p-1 rounded-full bg-[rgba(7,17,32,0.6)] border border-[#23324A]">
              {VIEW_MODES.map(({ key, label, icon, alwaysEnabled }) => {
                const enabled =
                  alwaysEnabled ||
                  (key === "zone"       && hasMerge)  ||
                  (key === "zone-cells" && hasZones)  ||
                  (key === "score"      && hasExposure);
                return (
                  <button
                    key={key}
                    onClick={() => enabled && setHeatmapMode(key)}
                    disabled={!enabled}
                    className={`flex items-center gap-1.5 flex-1 justify-center px-1.5 py-1.5 rounded-full text-[10px] font-medium transition-all duration-150 ${
                      heatmapMode === key
                        ? "bg-[#4F8CFF] text-white"
                        : enabled
                        ? "text-[#94A3B8] hover:text-[#F8FAFC]"
                        : "text-[#94A3B8]/30 cursor-not-allowed"
                    }`}
                  >
                    {icon}<span>{label}</span>
                  </button>
                );
              })}
            </div>
            {heatmapMode === "zone" && hasMerge && (
              <p className="text-[9px] text-[#4a5c75] px-1">
                Select analysis regions from the sidebar. Switch to <em>Cells</em> for raw per-cell view.
              </p>
            )}
          </div>
          {DIVIDER}
        </>
      )}

      {/* ── Analysis (read-only auto-zones) ──────────────────────────────── */}
      {hasMerge && (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Analysis</span>
                <span className="text-[9px] text-[#4a5c75]">Read-only · Excellent / Good / Average / Avoid</span>
              </div>
              <span className="text-[9px] text-[#4a5c75]">
                {visibleZones.length} zone{visibleZones.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Group cards by effectiveClass, Excellent first */}
            {ZONE_ORDER.filter((cls) => cls !== "blocked").map((cls) => {
              const meta    = ZONE_META[cls];
              const inGroup = visibleZones.filter((z) => z.effectiveClass === cls);
              if (!inGroup.length) return null;
              return (
                <div key={cls} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: meta.color }} />
                    <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                      {meta.label} · {inGroup.length}
                    </span>
                  </div>
                  {inGroup.map((zone) => (
                    <ZoneCard
                      key={zone.id}
                      zone={zone}
                      readOnly
                      isSelected={zone.id === selectedZoneId}
                      isEditing={false}
                      editValue=""
                      onSelect={() => setSelectedZoneId(zone.id)}
                      onStartRename={() => {}}
                      onEditChange={() => {}}
                      onCommitRename={() => {}}
                      onCancelRename={() => {}}
                      onDelete={() => {}}
                      onRestore={() => {}}
                      onConvert={() => {}}
                      onToggleLock={() => {}}
                      onResetToAuto={() => {}}
                      cardRef={(el) => { if (el) cardRefs.current[zone.id] = el; }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {DIVIDER}
        </>
      )}

      {/* ── Placement Areas (engineer design workspace) ──────────────────── */}
      {hasMerge && (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Placement Areas</span>
                <span className="text-[9px] text-[#4a5c75]">Where panels will be installed</span>
              </div>
              <span className="text-[9px] text-[#4a5c75]">
                {activePlacementAreas.length} area{activePlacementAreas.length !== 1 ? "s" : ""}
              </span>
            </div>

            {placementAreaToast && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] text-red-300">
                {placementAreaToast}
              </div>
            )}

            {isDrawingPlacementArea ? (
              <button
                onClick={stopPlacementAreaDrawing}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[12px] font-medium bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors"
              >
                <FiX size={13} />
                <span>Cancel drawing (Esc)</span>
              </button>
            ) : (
              <button
                onClick={startPlacementAreaDrawing}
                disabled={!hasRoof}
                className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 ${
                  hasRoof
                    ? "bg-[#06B6D4] text-white hover:brightness-110"
                    : "bg-[#23324A]/40 text-[#94A3B8]/40 cursor-not-allowed"
                }`}
              >
                <FiPlusSquare size={13} />
                <span>Draw Placement Area</span>
              </button>
            )}

            {isDrawingPlacementArea && (
              <p className="text-[9px] text-[#4a5c75] px-1 leading-relaxed">
                Switches to Top view. Click roof vertices to outline the area. Click the green
                start point or press Enter to finish. Esc cancels.
              </p>
            )}

            {activePlacementAreas.length === 0 && !isDrawingPlacementArea && (
              <p className="text-[10px] text-[#4a5c75] px-1">
                No placement areas yet. Draw one to define where panels should go.
              </p>
            )}

            {activePlacementAreas.map((area) => (
              <PlacementAreaCard
                key={area.id}
                area={area}
                isSelected={area.id === selectedPlacementAreaId}
                isEditing={editingPaId === area.id}
                editValue={editPaValue}
                onSelect={() => setSelectedPlacementAreaId(area.id)}
                onStartRename={() => startPaRename(area)}
                onEditChange={setEditPaValue}
                onCommitRename={commitPaRename}
                onCancelRename={cancelPaRename}
                onDelete={handlePaDelete}
                cardRef={(el) => { if (el) paCardRefs.current[area.id] = el; }}
              />
            ))}

            {deletedPlacementAreas.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setShowDeletedPa((v) => !v)}
                  className="flex items-center gap-1.5 text-[10px] text-[#4a5c75] hover:text-[#94A3B8] transition-colors"
                >
                  {showDeletedPa
                    ? <><FiEye size={10} /><span>Hide {deletedPlacementAreas.length} removed</span></>
                    : <><FiEyeOff size={10} /><span>Show {deletedPlacementAreas.length} removed</span></>
                  }
                </button>
                {showDeletedPa && deletedPlacementAreas.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl border border-[#23324A]/30 bg-[rgba(7,17,32,0.3)] opacity-60"
                  >
                    <span className="text-[10px] text-[#4a5c75] truncate line-through">{area.name}</span>
                    <button
                      onClick={() => updatePlacementArea(area.id, { deleted: false })}
                      className="text-[9px] text-[#06B6D4] hover:underline shrink-0 ml-2"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {DIVIDER}
        </>
      )}

      {/* ── Draw business zone (Step 5D contextual tool) ─────────────────── */}
      {hasMerge && (
        <>
          <div className="flex flex-col gap-2">
            <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Draw Business Zone</span>

            {/* Type picker */}
            <div className="flex flex-wrap gap-1">
              {BIZ_TYPES.map((type) => {
                const cfg    = BIZ_TYPE_CONFIG[type];
                const active = pendingBizType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setPendingBizType(type)}
                    className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg border font-medium transition-all duration-100 ${
                      active
                        ? "text-white border-transparent"
                        : "border-[#23324A]/60 text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#334466]"
                    }`}
                    style={active ? { background: cfg.color } : {}}
                  >
                    <span>{cfg.icon}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Draw / Cancel */}
            {isDrawingBizZone ? (
              <button
                onClick={stopBizDrawing}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[12px] font-medium bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors"
              >
                <FiX size={13} />
                <span>Cancel (Esc)</span>
              </button>
            ) : (
              <button
                onClick={() => startBizDrawing(pendingBizType)}
                disabled={!hasRoof}
                className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 ${
                  hasRoof
                    ? "bg-[#4F8CFF] text-white hover:brightness-110"
                    : "bg-[#23324A]/40 text-[#94A3B8]/40 cursor-not-allowed"
                }`}
              >
                <FiPlusSquare size={13} />
                <span>Draw in Top View</span>
              </button>
            )}

            {isDrawingBizZone && (
              <p className="text-[10px] text-amber-400/80 text-center animate-pulse">
                Click-drag to draw a rectangle on the roof
              </p>
            )}
            {!isDrawingBizZone && (
              <p className="text-[9px] text-[#4a5c75]">
                Switches to Top view. Click-drag to draw. Business zones cut their overlap
                out of the installable geometry.
              </p>
            )}
          </div>
          {DIVIDER}
        </>
      )}

      {/* ── Business Zone Manager ─────────────────────────────────────────── */}
      {activeBizZones.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={SEC_LABEL} style={{ marginBottom: 0 }}>
                Business Zones
              </span>
              <span className="text-[9px] text-[#4a5c75]">
                {activeBizZones.length} zone{activeBizZones.length !== 1 ? "s" : ""}
              </span>
            </div>

            {activeBizZones.map((biz) => (
              <BizZoneCard
                key={biz.id}
                biz={biz}
                isSelected={biz.id === selectedBizZoneId}
                isEditing={editingBizId === biz.id}
                editValue={editBizValue}
                onSelect={() => setSelectedBizZoneId(biz.id)}
                onStartRename={() => startBizRename(biz)}
                onEditChange={(v) => setEditBizValue(v)}
                onCommitRename={commitBizRename}
                onCancelRename={cancelBizRename}
                onDelete={handleBizDelete}
                onChangeType={handleBizChangeType}
                cardRef={(el) => { if (el) bizCardRefs.current[biz.id] = el; }}
              />
            ))}

            {/* Hidden business zones */}
            {deletedBizZones.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setShowDeletedBiz((v) => !v)}
                  className="flex items-center gap-1.5 text-[10px] text-[#4a5c75] hover:text-[#94A3B8] transition-colors"
                >
                  {showDeletedBiz
                    ? <><FiEye size={10} /><span>Hide {deletedBizZones.length} removed</span></>
                    : <><FiEyeOff size={10} /><span>Show {deletedBizZones.length} removed</span></>
                  }
                </button>
                {showDeletedBiz && deletedBizZones.map((biz) => {
                  const cfg = BIZ_TYPE_CONFIG[biz.businessType] ?? BIZ_TYPE_CONFIG.restricted;
                  return (
                    <div
                      key={biz.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl border border-[#23324A]/30 bg-[rgba(7,17,32,0.3)] opacity-60"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px]">{cfg.icon}</span>
                        <span className="text-[10px] text-[#4a5c75] truncate line-through">
                          {biz.name}
                        </span>
                      </div>
                      <button
                        onClick={() => updateBizZone(biz.id, { deleted: false })}
                        className="text-[9px] text-[#4F8CFF] hover:underline shrink-0 ml-2"
                      >
                        Restore
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {DIVIDER}
        </>
      )}

      {/* ── Per-class area breakdown (live from effectiveZoneStats) ─────────── */}
      {statsSource && (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Area by Class</span>
              <span className="text-[9px] text-[#4a5c75]">m²</span>
            </div>
            {(() => {
              const allArea = Object.values(statsSource.totals).reduce((a, b) => a + b, 0);
              return ZONE_ORDER.map((cls) => {
                const meta = ZONE_META[cls];
                const area = statsSource.totals[cls] ?? 0;
                const pct  = allArea > 0 ? (area / allArea) * 100 : 0;
                const installable = cls === "excellent" || cls === "good";
                return (
                  <div key={cls} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: meta.color }} />
                        <span className="text-[11px] text-[#F8FAFC] font-medium">{meta.label}</span>
                        {installable && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#00E38C]/15 text-[#00E38C]">
                            installable
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#F8FAFC] tabular-nums font-semibold">
                        {formatArea(area)}
                      </span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-[#23324A] overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: meta.color, opacity: 0.85 }}
                      />
                    </div>
                    <div className="text-[9px] text-[#4a5c75]">{pct.toFixed(0)}% of active area</div>
                  </div>
                );
              });
            })()}
          </div>
          {DIVIDER}
        </>
      )}

      {/* ── Zone threshold reference ─────────────────── */}
      <div className="flex flex-col gap-2">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Thresholds</span>
        {[
          { cls: "excellent", rule: `Score ≥ ${ZONE_THRESHOLDS.EXCELLENT_MIN}` },
          { cls: "good",      rule: `Score ${ZONE_THRESHOLDS.GOOD_MIN}–${ZONE_THRESHOLDS.EXCELLENT_MIN - 1}` },
          { cls: "average",   rule: `Score ${ZONE_THRESHOLDS.AVERAGE_MIN}–${ZONE_THRESHOLDS.GOOD_MIN - 1}` },
          { cls: "avoid",     rule: `Score 1–${ZONE_THRESHOLDS.AVERAGE_MIN - 1}` },
          { cls: "blocked",   rule: "Under obstacle / restricted" },
        ].map(({ cls, rule }) => (
          <div key={cls} className="flex items-center gap-2 text-[10px]">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: ZONE_META[cls].color }} />
            <span className="text-[#94A3B8] w-16 shrink-0">{ZONE_META[cls].label}</span>
            <span className="text-[#4a5c75]">{rule}</span>
          </div>
        ))}
      </div>

      {DIVIDER}

      {/* ── Instructions ─────────────────────────────── */}
      <InstructionList items={[
        "Run Shadow Analysis in Step 4 first — auto-zones (Analysis) derive from the shadow grid and are read-only",
        "Switch to Top view for the clearest map; select analysis regions from the sidebar",
        "Draw Placement Areas to define where panels should be installed — areas may span any analysis zone class",
        "Click roof vertices to outline a placement area; click the green start point or press Enter to finish",
        "Select placement areas from the sidebar only; vertex handles appear on the selected area",
        "Draw Business Zones: select a type, click 'Draw in Top View', then click-drag a rectangle on the roof",
        "Business zones block panel placement — their overlap is cut from installable geometry in Step 6",
        `Tiny patches < ${MIN_REGION_CELLS} cells are absorbed into the dominant neighbour — no coverage gaps`,
      ]} />

    </PanelShell>
  );
}
