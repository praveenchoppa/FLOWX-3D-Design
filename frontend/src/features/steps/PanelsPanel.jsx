/**
 * PanelsPanel — Step 6 right-hand panel.
 *
 * Placement Area workflow: configure modules per area → Generate Layout → panels appear.
 * Engineering fallback: legacy auto-layout from Excellent/Good zones.
 */
import { useMemo, useState } from "react";
import {
  FiLayers, FiZap, FiTarget, FiGrid, FiAlertCircle, FiRefreshCw, FiSettings,
  FiCheckCircle, FiRotateCcw,
} from "react-icons/fi";

import {
  PanelShell, DataRow, KpiCard,
  InstructionList, DIVIDER, SEC_LABEL,
} from "./panelUtils";
import ArrayCard from "./ArrayCard";

import { computePanelCapacity } from "../panels/panelPlacement";
import {
  computeEffectiveLayoutSummary,
  buildEngineeringAreaSummaries,
  computeProjectEngineeringSummary,
  computeAreaGenerationStatus,
  AREA_GENERATION_STATUS,
  AREA_GENERATION_STATUS_LABEL,
} from "../panels/panelLayoutSummary";
import { buildSelectedPanelDisplayInfo } from "../panels/panelInspectorUtils";
import LayoutSummarySection from "./LayoutSummarySection.jsx";
import { PanelConfigFields, ConfigField, inputClass } from "./panelConfigFields.jsx";
import ProjectDefaultsDialog from "./ProjectDefaultsDialog.jsx";
import {
  resolvePlacementAreaConfig,
  panelForPlacement,
} from "../panels/panelConfig";
import { computeCapacityPreview } from "../panels/panelDesignGoal";
import {
  PLACEMENT_MODES,
  CAPACITY_INPUT_MODES,
} from "../panels/panelCapacityPlanning";
import { SHADING_ENGINEERING_STATUS } from "../panels/panelShadingRefinement";

function formatDim(m) {
  if (m == null || isNaN(m)) return "—";
  return `${m.toFixed(3)} m`;
}

const SHADING_STATUS_META = {
  [SHADING_ENGINEERING_STATUS.CLEARANCE]: {
    icon: "🟢",
    label: "Clearance Achieved",
    border: "border-[#00E38C]/30",
    bg: "bg-[#00E38C]/8",
    title: "text-[#00E38C]",
  },
  [SHADING_ENGINEERING_STATUS.POSSIBLE]: {
    icon: "🟡",
    label: "Possible Shading",
    border: "border-[#FFB547]/30",
    bg: "bg-[#FFB547]/8",
    title: "text-[#FFB547]",
  },
  [SHADING_ENGINEERING_STATUS.SIGNIFICANT]: {
    icon: "🔴",
    label: "Significant Shading",
    border: "border-red-500/30",
    bg: "bg-red-500/8",
    title: "text-red-400",
  },
};

function ObstacleEngineeringCard({ entry }) {
  const meta = SHADING_STATUS_META[entry.status] ?? SHADING_STATUS_META.possible;
  return (
    <div className={`flex flex-col gap-2 px-3 py-3 rounded-xl ${meta.bg} border ${meta.border}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm leading-none">{meta.icon}</span>
        <span className={`text-[11px] font-semibold ${meta.title}`}>{meta.label}</span>
      </div>
      <p className="text-[11px] font-medium text-[#F8FAFC]">{entry.name}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[#94A3B8]">
        <p>Obstacle height: <span className="text-[#F8FAFC] tabular-nums">{entry.height.toFixed(2)} m</span></p>
        <p>Mount height: <span className="text-[#F8FAFC] tabular-nums">{entry.mountHeight.toFixed(2)} m</span></p>
      </div>
      <p className="text-[10px] text-[#94A3B8] leading-relaxed">{entry.summary}</p>
      <p className="text-[10px] text-[#94A3B8]">
        Estimated shading impact:{" "}
        <span className="text-[#F8FAFC] font-medium">{entry.impactLabel}</span>
      </p>
    </div>
  );
}

function generationStatusStyle(syncStatus) {
  if (syncStatus === AREA_GENERATION_STATUS.REGENERATION_REQUIRED) {
    return { text: "text-[#FFB547]", border: "border-[#FFB547]/30", bg: "bg-[#FFB547]/8" };
  }
  if (syncStatus === AREA_GENERATION_STATUS.UP_TO_DATE) {
    return { text: "text-[#00E38C]", border: "border-[#00E38C]/30", bg: "bg-[#00E38C]/8" };
  }
  return { text: "text-[#94A3B8]", border: "border-[#23324A]", bg: "bg-[rgba(7,17,32,0.4)]" };
}

function PlacementAreaCard({
  area,
  isSelected,
  onSelect,
  syncStatus,
  panelCount,
  targetCapacityKw,
  onGenerateLayout,
  placementReady,
  capacityExceeds,
}) {
  const statusStyle = generationStatusStyle(syncStatus);
  const showGenerate = syncStatus === AREA_GENERATION_STATUS.NOT_GENERATED;
  const showRegenerate = syncStatus === AREA_GENERATION_STATUS.REGENERATION_REQUIRED;
  const actionLabel = showRegenerate ? "Regenerate" : "Generate";

  return (
    <div
      className={`rounded-xl border transition-all ${
        isSelected
          ? "border-[#06B6D4]/40 bg-[#06B6D4]/10"
          : `${statusStyle.border} ${statusStyle.bg}`
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[12px] font-medium text-[#F8FAFC] truncate">{area.name}</span>
          <span className="text-[10px] text-[#64748B] tabular-nums">
            Target {targetCapacityKw.toFixed(1)} kW
            {panelCount > 0 && ` · ${panelCount} panels`}
          </span>
        </div>
        <span className={`text-[9px] font-semibold uppercase tracking-wide shrink-0 ${statusStyle.text}`}>
          {AREA_GENERATION_STATUS_LABEL[syncStatus]}
        </span>
      </button>

      {(showGenerate || showRegenerate) && (
        <div className="px-3 pb-2.5 pt-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onGenerateLayout();
            }}
            disabled={!placementReady || capacityExceeds}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-[11px] font-semibold bg-[#4F8CFF] text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <FiRefreshCw size={12} />
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function MountHeightEngineeringSection({ panelShadingRefinement }) {
  const entries = panelShadingRefinement?.obstacles ?? [];
  if (!entries.length) return null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Mount Height Engineering</span>
        <p className="text-[10px] text-[#4a5c75] leading-relaxed px-1">
          Clearance filter applied to existing shadow analysis. Solar simulation is not rerun.
        </p>
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <ObstacleEngineeringCard key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
      {DIVIDER}
    </>
  );
}

function PlacementAreaConfigPanel({
  placementAreas,
  selectedPlacementArea,
  onSelectPlacementArea,
  onResetAreaToProjectTemplate,
  onPatchPlacementAreaConfig,
  hasGeneratedLayout,
  onGenerateLayout,
  onGenerateMaximumLayout,
  placementReady,
  engineeringAreaSummaries = [],
  projectEngineeringSummary = null,
}) {
  const activeAreas = placementAreas.filter((a) => !a.deleted);

  const areaPanelCountById = useMemo(
    () => new Map(engineeringAreaSummaries.map((row) => [row.id, row.panelCount])),
    [engineeringAreaSummaries],
  );

  const areaCapacityById = useMemo(
    () => new Map(
      activeAreas.map((area) => {
        const cfg = resolvePlacementAreaConfig(area.panelProperties);
        return [area.id, cfg.designGoal.targetCapacityKW];
      }),
    ),
    [activeAreas],
  );

  const effectiveConfig = useMemo(() => {
    if (!selectedPlacementArea) return null;
    return resolvePlacementAreaConfig(selectedPlacementArea.panelProperties);
  }, [selectedPlacementArea]);

  const footprintPanel = useMemo(
    () => (effectiveConfig
      ? panelForPlacement(effectiveConfig.moduleId, effectiveConfig.orientation)
      : null),
    [effectiveConfig],
  );

  const capacityPreview = useMemo(() => {
    if (!selectedPlacementArea || !placementReady) return null;
    return computeCapacityPreview(placementReady, selectedPlacementArea);
  }, [selectedPlacementArea, placementReady, effectiveConfig]);

  const handleAreaPatch = (patch) => {
    if (!selectedPlacementArea) return;
    onPatchPlacementAreaConfig(selectedPlacementArea.id, patch);
  };

  return (
    <>
      {/* Placement area picker */}
      <div className="flex flex-col gap-2">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Placement Areas</span>
        {activeAreas.length === 0 ? (
          <p className="text-[11px] text-[#94A3B8] px-1">
            Draw placement areas in Step 5 before configuring panels.
          </p>
        ) : (
          activeAreas.map((area) => {
            const syncStatus = computeAreaGenerationStatus(area);
            const areaPreview = placementReady
              ? computeCapacityPreview(placementReady, area)
              : null;

            return (
              <PlacementAreaCard
                key={area.id}
                area={area}
                isSelected={selectedPlacementArea?.id === area.id}
                onSelect={() => onSelectPlacementArea(area.id)}
                syncStatus={syncStatus}
                panelCount={areaPanelCountById.get(area.id) ?? 0}
                targetCapacityKw={areaCapacityById.get(area.id) ?? 0}
                onGenerateLayout={onGenerateLayout}
                placementReady={placementReady}
                capacityExceeds={areaPreview?.exceeds ?? false}
              />
            );
          })
        )}
      </div>

      {selectedPlacementArea && effectiveConfig && (
        <>
          {DIVIDER}

          <div className="flex flex-col gap-3 px-3 py-3 rounded-xl bg-[#06B6D4]/8 border border-[#06B6D4]/25">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[9px] font-bold tracking-[0.18em] text-[#06B6D4] uppercase">
                Area Configuration · {selectedPlacementArea.name}
              </span>
              <button
                type="button"
                onClick={() => onResetAreaToProjectTemplate(selectedPlacementArea.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#23324A]/60 transition-colors shrink-0"
                title="Replace this area's settings with the current project template"
              >
                <FiRotateCcw size={11} />
                Reset to Template
              </button>
            </div>
            <p className="text-[10px] text-[#4a5c75] leading-relaxed">
              This area keeps its own settings. Regenerate uses only these values.
            </p>

            <PanelConfigFields
              config={effectiveConfig}
              readOnly={false}
              onPatch={handleAreaPatch}
            />

            {footprintPanel && (
              <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                Footprint: {formatDim(footprintPanel.width)} × {formatDim(footprintPanel.height)}
                {" "}· {footprintPanel.powerW ?? footprintPanel.power} W
              </p>
            )}
          </div>

          {/* Capacity preview (before generation) */}
          {capacityPreview && (
            <div className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-[#4F8CFF]/8 border border-[#4F8CFF]/25">
              <span className="text-[9px] font-bold tracking-[0.15em] text-[#4F8CFF] uppercase">
                Capacity Preview
              </span>
              <div className="grid grid-cols-2 gap-2">
                <KpiCard
                  label="Requested Capacity"
                  value={`${capacityPreview.requestedCapacityKW.toFixed(1)} kW`}
                  accent="text-[#FFB547]"
                />
                <KpiCard
                  label="Required Panels"
                  value={String(capacityPreview.requiredPanels)}
                  accent="text-[#F8FAFC]"
                />
                <KpiCard
                  label="Maximum Panels"
                  value={String(capacityPreview.maxPanels)}
                  accent="text-[#F8FAFC]"
                />
                <KpiCard
                  label="Maximum Capacity"
                  value={`${capacityPreview.maxCapacityKW.toFixed(1)} kW`}
                  accent="text-[#94A3B8]"
                />
              </div>
              {capacityPreview.achievable ? (
                <p className="text-[11px] text-[#00E38C] leading-relaxed flex items-center gap-1.5">
                  <FiCheckCircle size={13} />
                  Capacity achievable
                </p>
              ) : capacityPreview.exceeds ? (
                <p className="text-[11px] text-[#FFB547] leading-relaxed flex items-start gap-1.5">
                  <FiAlertCircle size={13} className="shrink-0 mt-0.5" />
                  Requested capacity exceeds available placement area.
                </p>
              ) : null}
            </div>
          )}

          {/* Area statistics */}
          <div className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-[rgba(7,17,32,0.5)] border border-[#23324A]">
            <span className="text-[9px] font-bold tracking-[0.15em] text-[#94A3B8] uppercase">
              Area Statistics
            </span>
            <div className="grid grid-cols-2 gap-2">
              <KpiCard
                label="Solar Score"
                value={selectedPlacementArea.stats?.avgScore != null
                  ? selectedPlacementArea.stats.avgScore.toFixed(1)
                  : "—"}
                accent="text-[#F8FAFC]"
              />
              <KpiCard
                label="Quality"
                value={selectedPlacementArea.stats?.quality ?? "—"}
                accent="text-[#06B6D4]"
              />
              <KpiCard
                label="Usable Area"
                value={selectedPlacementArea.stats?.usableAreaM2 != null
                  ? `${selectedPlacementArea.stats.usableAreaM2.toFixed(1)} m²`
                  : "—"}
                accent="text-[#F8FAFC]"
              />
              <KpiCard
                label="Polygon Area"
                value={selectedPlacementArea.stats?.areaM2 != null
                  ? `${selectedPlacementArea.stats.areaM2.toFixed(1)} m²`
                  : "—"}
                accent="text-[#94A3B8]"
              />
            </div>
          </div>

          {capacityPreview?.exceeds && (
            <button
              type="button"
              onClick={onGenerateMaximumLayout}
              disabled={!placementReady || activeAreas.length === 0 || capacityPreview.maxPanels === 0}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[12px] font-medium border border-[#FFB547]/40 text-[#FFB547] hover:bg-[#FFB547]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <FiGrid size={14} />
              Generate Maximum Layout ({capacityPreview.maxPanels} panels · {capacityPreview.maxCapacityKW.toFixed(1)} kW)
            </button>
          )}

        </>
      )}

      {engineeringAreaSummaries.length > 0 && (
        <>
          {DIVIDER}
          <LayoutSummarySection
            areaSummaries={engineeringAreaSummaries}
            projectSummary={hasGeneratedLayout ? projectEngineeringSummary : null}
            selectedAreaId={selectedPlacementArea?.id ?? null}
          />
        </>
      )}
    </>
  );
}

export default function PanelsPanel({
  selectedPanel     = null,
  placementReady    = null,
  panelLayout       = null,
  panelArrays         = [],
  selectedArrayId     = null,
  onSelectArray       = () => {},
  onRenameArray       = () => {},
  placementPlanning   = {},
  onUpdatePlacementPlanning = () => {},
  placementLiveSummary = null,
  resolvedTargetCapacityKw = null,
  locationSpecificYield = null,
  maxRoofCapacityKw = 0,
  onAutoPlace         = () => {},
  // Placement Area panel configuration workflow
  usePlacementAreaPanelWorkflow = false,
  projectPanelDefaults = null,
  onUpdateProjectPanelDefaults = () => {},
  placementAreas = [],
  selectedPlacementArea = null,
  onSelectPlacementArea = () => {},
  onResetAreaToProjectTemplate = () => {},
  onPatchPlacementAreaConfig = () => {},
  layoutIsStale = false,
  hasGeneratedLayout = false,
  generatedPanelLayout = null,
  onGenerateLayout = () => {},
  onGenerateMaximumLayout = () => {},
  selectedPanelSlotId = null,
  isStaleDesign = false,
  onUpdateDesign = () => {},
  panelShadingRefinement = null,
}) {
  const engineeringAreaSummaries = useMemo(
    () => (usePlacementAreaPanelWorkflow
      ? buildEngineeringAreaSummaries(
        placementAreas,
        hasGeneratedLayout ? panelLayout : null,
        placementReady,
      )
      : []),
    [usePlacementAreaPanelWorkflow, hasGeneratedLayout, placementAreas, panelLayout, placementReady],
  );

  const projectEngineeringSummary = useMemo(
    () => (usePlacementAreaPanelWorkflow && hasGeneratedLayout
      ? computeProjectEngineeringSummary(placementAreas, panelLayout)
      : null),
    [usePlacementAreaPanelWorkflow, hasGeneratedLayout, placementAreas, panelLayout],
  );

  const selectedPlacedPanel = useMemo(() => {
    if (!selectedPanelSlotId || !panelLayout?.placedPanels) return null;
    return panelLayout.placedPanels.find(
      (p) => (p.slotId ?? p.id) === selectedPanelSlotId,
    ) ?? null;
  }, [selectedPanelSlotId, panelLayout]);

  const selectedPanelDisplay = useMemo(
    () => buildSelectedPanelDisplayInfo(
      selectedPlacedPanel,
      placementAreas,
      panelLayout,
      panelArrays,
    ),
    [selectedPlacedPanel, placementAreas, panelLayout, panelArrays],
  );

  const capacity = useMemo(() => {
    if (usePlacementAreaPanelWorkflow && hasGeneratedLayout) {
      return computeEffectiveLayoutSummary(panelLayout, placementAreas);
    }
    return computePanelCapacity(panelLayout, selectedPanel, placementReady);
  }, [
    usePlacementAreaPanelWorkflow,
    hasGeneratedLayout,
    panelLayout,
    placementAreas,
    selectedPanel,
    placementReady,
  ]);

  const [editingArrayId, setEditingArrayId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false);

  const arrayKwTotal = useMemo(
    () => panelArrays.reduce((s, a) => s + a.systemKw, 0),
    [panelArrays],
  );

  const pill = hasGeneratedLayout && capacity.panelCount > 0 ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4F8CFF]/10 border border-[#4F8CFF]/25">
      <FiZap size={10} className="text-[#4F8CFF]" />
      <span className="text-[10px] font-semibold text-[#4F8CFF]">
        {capacity.panelCount} panel{capacity.panelCount !== 1 ? "s" : ""}
      </span>
    </div>
  ) : null;

  const startRename = (array) => {
    setEditingArrayId(array.id);
    setEditValue(array.displayName);
  };

  const commitRename = (array) => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== array.displayName) {
      onRenameArray(array.regionId, trimmed);
    } else if (!trimmed) {
      onRenameArray(array.regionId, null);
    }
    setEditingArrayId(null);
    setEditValue("");
  };

  const cancelRename = () => {
    setEditingArrayId(null);
    setEditValue("");
  };

  const isTargetMode = placementPlanning.placementMode === PLACEMENT_MODES.TARGET_CAPACITY;
  const inputMode = placementPlanning.capacityInputMode ?? CAPACITY_INPUT_MODES.KW;

  const patchPlanning = (updates) => onUpdatePlacementPlanning(updates);

  return (
    <PanelShell>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[9px] font-bold tracking-[0.22em] text-[#94A3B8] uppercase">
            Panels
          </h2>
          <p className="mt-1 text-[#94A3B8] text-xs">
            {usePlacementAreaPanelWorkflow
              ? "Configure modules · generate layout"
              : "Auto layout · arrays · manual edits"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {usePlacementAreaPanelWorkflow && (
            <button
              type="button"
              onClick={() => setDefaultsDialogOpen(true)}
              className="p-2 rounded-lg border border-[#23324A] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#162338] transition-colors"
              title="Defaults for new areas"
              aria-label="Defaults for new areas"
            >
              <FiSettings size={14} />
            </button>
          )}
          {pill ?? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00E38C]/10 border border-[#00E38C]/25">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00E38C]" />
              <span className="text-[10px] font-semibold text-[#00E38C]">Ready</span>
            </div>
          )}
        </div>
      </div>

      {usePlacementAreaPanelWorkflow && (
        <ProjectDefaultsDialog
          open={defaultsDialogOpen}
          onClose={() => setDefaultsDialogOpen(false)}
          projectPanelDefaults={projectPanelDefaults}
          onUpdateProjectPanelDefaults={onUpdateProjectPanelDefaults}
        />
      )}

      {DIVIDER}

      {usePlacementAreaPanelWorkflow ? (
        <PlacementAreaConfigPanel
          placementAreas={placementAreas}
          selectedPlacementArea={selectedPlacementArea}
          onSelectPlacementArea={onSelectPlacementArea}
          onResetAreaToProjectTemplate={onResetAreaToProjectTemplate}
          onPatchPlacementAreaConfig={onPatchPlacementAreaConfig}
          hasGeneratedLayout={hasGeneratedLayout}
          onGenerateLayout={onGenerateLayout}
          onGenerateMaximumLayout={onGenerateMaximumLayout}
          placementReady={placementReady}
          engineeringAreaSummaries={engineeringAreaSummaries}
          projectEngineeringSummary={projectEngineeringSummary}
        />
      ) : (
        <>
          {/* ── Legacy placement mode (engineering fallback) ─────────────── */}
          <div className="flex flex-col gap-3">
            <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Placement Mode</span>
            <div className="flex items-center gap-1 p-1 rounded-full bg-[rgba(7,17,32,0.6)] border border-[#23324A]">
              {[
                { key: PLACEMENT_MODES.FILL_ROOF, label: "Fill Roof" },
                { key: PLACEMENT_MODES.TARGET_CAPACITY, label: "Target Capacity" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => patchPlanning({ placementMode: key })}
                  className={`flex-1 px-3 py-2 rounded-full text-[11px] font-medium transition-all duration-150 ${
                    placementPlanning.placementMode === key
                      ? "bg-[#4F8CFF] text-white"
                      : "text-[#94A3B8] hover:text-[#F8FAFC]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {isTargetMode && (
              <div className="flex flex-col gap-3 px-3 py-3 rounded-xl bg-[rgba(7,17,32,0.5)] border border-[#23324A]">
                <span className="text-[9px] font-bold tracking-[0.15em] text-[#94A3B8] uppercase">
                  Customer Requirement
                </span>
                <div className="flex flex-wrap gap-1 p-1 rounded-full bg-[rgba(7,17,32,0.6)] border border-[#23324A]">
                  {[
                    { key: CAPACITY_INPUT_MODES.KW, label: "Target kW" },
                    { key: CAPACITY_INPUT_MODES.BILL, label: "Monthly Bill" },
                    { key: CAPACITY_INPUT_MODES.ANNUAL_KWH, label: "Annual kWh" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => patchPlanning({ capacityInputMode: key })}
                      className={`flex-1 min-w-0 px-2 py-1.5 rounded-full text-[10px] font-medium transition-all duration-150 ${
                        inputMode === key
                          ? "bg-[#FFB547]/20 text-[#FFB547] border border-[#FFB547]/30"
                          : "text-[#94A3B8] hover:text-[#F8FAFC]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {inputMode === CAPACITY_INPUT_MODES.KW && (
                  <ConfigField label="Target capacity (kWp)">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={placementPlanning.targetCapacityKw ?? ""}
                      onChange={(e) => patchPlanning({ targetCapacityKw: e.target.value })}
                      className={inputClass}
                    />
                  </ConfigField>
                )}

                {inputMode === CAPACITY_INPUT_MODES.BILL && (
                  <ConfigField label="Monthly electricity bill (₹)">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={placementPlanning.monthlyBill ?? ""}
                      onChange={(e) => patchPlanning({ monthlyBill: e.target.value })}
                      className={inputClass}
                    />
                  </ConfigField>
                )}

                {inputMode === CAPACITY_INPUT_MODES.ANNUAL_KWH && (
                  <ConfigField label="Annual consumption (kWh)">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={placementPlanning.annualConsumptionKwh ?? ""}
                      onChange={(e) => patchPlanning({ annualConsumptionKwh: e.target.value })}
                      className={inputClass}
                    />
                  </ConfigField>
                )}

                {resolvedTargetCapacityKw != null && inputMode !== CAPACITY_INPUT_MODES.KW && (
                  <p className="text-[10px] text-[#4a5c75] leading-relaxed">
                    Resolved target:{" "}
                    <span className="text-[#FFB547] font-semibold tabular-nums">
                      {resolvedTargetCapacityKw.toFixed(2)} kWp
                    </span>
                    {" "}· yield {locationSpecificYield?.toLocaleString()} kWh/kWp/yr (location)
                  </p>
                )}

                <button
                  type="button"
                  onClick={onAutoPlace}
                  disabled={!placementReady || !selectedPanel}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[12px] font-medium bg-[#4F8CFF] text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <FiGrid size={14} />
                  Auto Place
                </button>
              </div>
            )}

            {!isTargetMode && (
              <button
                type="button"
                onClick={onAutoPlace}
                disabled={!placementReady || !selectedPanel}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[12px] font-medium border border-[#23324A] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#162338] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <FiGrid size={14} />
                Auto Place — Fill Roof
              </button>
            )}
          </div>
          {DIVIDER}
        </>
      )}

      {/* DIRTY banner after layout regeneration */}
      {usePlacementAreaPanelWorkflow && selectedPanelDisplay && (
        <>
          <div className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-[rgba(79,140,255,0.08)] border border-[#4F8CFF]/30">
            <span className="text-[9px] font-bold tracking-[0.18em] text-[#4F8CFF] uppercase">
              Selected Panel
            </span>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-[#94A3B8]">
              <p>
                Placement Area:{" "}
                <span className="text-[#F8FAFC]">{selectedPanelDisplay.placementAreaName}</span>
              </p>
              <p>
                Panel Number:{" "}
                <span className="text-[#F8FAFC] tabular-nums">
                  {selectedPanelDisplay.panelNumber ?? "—"}
                </span>
              </p>
              <p>
                Module:{" "}
                <span className="text-[#F8FAFC]">{selectedPanelDisplay.moduleLabel}</span>
              </p>
              <p className="capitalize">
                Orientation:{" "}
                <span className="text-[#F8FAFC]">{selectedPanelDisplay.orientation}</span>
              </p>
              <p>
                Dimensions:{" "}
                <span className="text-[#F8FAFC] tabular-nums">
                  {selectedPanelDisplay.dimensionsLabel}
                </span>
              </p>
              <p>
                Capacity:{" "}
                <span className="text-[#F8FAFC] tabular-nums">
                  {selectedPanelDisplay.capacityLabel}
                </span>
              </p>
              {selectedPanelDisplay.arrayLabel && (
                <p className="col-span-2">
                  Array:{" "}
                  <span className="text-[#F8FAFC]">{selectedPanelDisplay.arrayLabel}</span>
                </p>
              )}
            </div>
          </div>
          {DIVIDER}
        </>
      )}

      {usePlacementAreaPanelWorkflow && isStaleDesign && hasGeneratedLayout && (
        <>
          <div className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-[#FFB547]/10 border border-[#FFB547]/30">
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Energy and financials are out of date. Run Update Design to refresh downstream calculations.
            </p>
            <button
              type="button"
              onClick={onUpdateDesign}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl text-[12px] font-medium bg-[#FFB547] text-[#071120] hover:brightness-110 transition-all"
            >
              Update Design
            </button>
          </div>
          {DIVIDER}
        </>
      )}

      {usePlacementAreaPanelWorkflow && hasGeneratedLayout && (
        <MountHeightEngineeringSection panelShadingRefinement={panelShadingRefinement} />
      )}

      {hasGeneratedLayout && capacity.panelCount > 0 && !usePlacementAreaPanelWorkflow && (
        <>
          <div className="flex flex-col gap-2 px-3 py-4 rounded-xl bg-[#4F8CFF]/8 border border-[#4F8CFF]/30">
            <span className="text-[9px] font-bold tracking-[0.2em] text-[#4F8CFF] uppercase">
              System Capacity
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold text-[#4F8CFF] leading-none tabular-nums">
                {capacity.systemKw.toFixed(2)}
              </span>
              <span className="text-[14px] text-[#4F8CFF]/70 font-medium">kW</span>
            </div>
            <div className="flex gap-2">
              <KpiCard
                label="Total Panels"
                value={String(capacity.panelCount)}
                accent="text-[#F8FAFC]"
              />
              <KpiCard
                label="Coverage"
                value={`${capacity.coveragePct.toFixed(1)}%`}
                accent="text-[#00E38C]"
              />
            </div>
          </div>
          {DIVIDER}
        </>
      )}

      {!usePlacementAreaPanelWorkflow && panelArrays.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className={SEC_LABEL} style={{ marginBottom: 0 }}>
                <FiLayers size={10} className="inline mr-1" />
                Arrays
              </span>
              <span className="text-[10px] text-[#94A3B8] tabular-nums">
                {panelArrays.length} · {arrayKwTotal.toFixed(2)} kW
              </span>
            </div>
            {panelArrays.map((array) => (
              <ArrayCard
                key={array.id}
                array={array}
                isSelected={selectedArrayId === array.id}
                isEditing={editingArrayId === array.id}
                editValue={editValue}
                onSelect={() => onSelectArray(selectedArrayId === array.id ? null : array.id)}
                onStartRename={() => startRename(array)}
                onEditChange={setEditValue}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
              />
            ))}
          </div>
          {DIVIDER}
        </>
      )}

      <InstructionList items={
        usePlacementAreaPanelWorkflow
          ? [
              "Select a placement area, then set its target capacity and module",
              "Capacity preview shows required vs maximum panels before generation",
              "Generate Layout places panels for all areas using each area's own settings",
              "Use the gear icon to change defaults for future placement areas only",
              "Reset to Template on an area applies those defaults to that area",
              "Run Update Design after manual panel edits to refresh energy and financials",
            ]
          : [
              "Fill Roof places every valid slot — same as the original auto layout",
              "Target Capacity selects slots by zone priority until the requested kWp is met",
              "Run Auto Place after changing mode or requirement",
            ]
      } />
    </PanelShell>
  );
}
