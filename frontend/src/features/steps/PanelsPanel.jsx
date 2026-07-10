/**
 * PanelsPanel — Step 6 right-hand panel.
 *
 * Placement Area workflow: configure modules per area → Generate Layout → panels appear.
 * Engineering fallback: legacy auto-layout from Excellent/Good zones.
 */
import { useMemo, useState } from "react";
import {
  FiLayers, FiZap, FiTarget, FiGrid, FiAlertCircle, FiRefreshCw, FiSettings,
  FiCheckCircle,
} from "react-icons/fi";

import {
  PanelShell, PanelHeader, DataRow, KpiCard,
  InstructionList, DIVIDER, SEC_LABEL,
} from "./panelUtils";
import ArrayCard from "./ArrayCard";

import { computePanelCapacity } from "../panels/panelPlacement";
import { PANEL_TYPES } from "../panels/panelTypes";
import {
  computeEffectiveLayoutSummary,
  buildPlacementAreaLayoutSummaries,
} from "../panels/panelLayoutSummary";
import {
  ORIENTATIONS,
  MOUNT_TYPES,
  resolveEffectivePanelConfig,
  panelForPlacement,
} from "../panels/panelConfig";
import { computeCapacityPreview } from "../panels/panelDesignGoal";
import { inferPanelOrientation } from "../panels/panelEditorUtils";
import {
  PLACEMENT_MODES,
  CAPACITY_INPUT_MODES,
} from "../panels/panelCapacityPlanning";

function formatDim(m) {
  if (m == null || isNaN(m)) return "—";
  return `${m.toFixed(3)} m`;
}

function ConfigField({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-[#94A3B8]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-[rgba(7,17,32,0.6)] border border-[#23324A] text-[13px] text-[#F8FAFC] outline-none focus:border-[#4F8CFF] disabled:opacity-50 disabled:cursor-not-allowed";

const selectClass = `${inputClass} cursor-pointer`;

function PanelConfigFields({
  config,
  readOnly,
  onPatch,
}) {
  return (
    <div className="flex flex-col gap-3">
      <ConfigField label="Target Capacity (kW)">
        <input
          type="number"
          min="0"
          step="0.1"
          value={config.designGoal?.targetCapacityKW ?? ""}
          disabled={readOnly}
          onChange={(e) => onPatch({
            designGoal: {
              type: "capacity",
              targetCapacityKW: Number(e.target.value),
            },
          })}
          className={inputClass}
        />
      </ConfigField>

      <ConfigField label="Module">
        <select
          value={config.moduleId}
          disabled={readOnly}
          onChange={(e) => onPatch({ moduleId: e.target.value })}
          className={selectClass}
        >
          {PANEL_TYPES.map((mod) => (
            <option key={mod.id} value={mod.id}>
              {mod.manufacturer} {mod.model} — {mod.powerW}W
            </option>
          ))}
        </select>
      </ConfigField>

      <ConfigField label="Orientation">
        <div className="flex gap-1 p-1 rounded-full bg-[rgba(7,17,32,0.6)] border border-[#23324A]">
          {[
            { key: ORIENTATIONS.PORTRAIT, label: "Portrait" },
            { key: ORIENTATIONS.LANDSCAPE, label: "Landscape" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              disabled={readOnly}
              onClick={() => onPatch({ orientation: key })}
              className={`flex-1 px-3 py-2 rounded-full text-[11px] font-medium transition-all duration-150 disabled:opacity-50 ${
                config.orientation === key
                  ? "bg-[#4F8CFF] text-white"
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </ConfigField>

      <div className="grid grid-cols-2 gap-2">
        <ConfigField label="Tilt (°)">
          <input
            type="number"
            min="0"
            max="90"
            step="1"
            value={config.tilt}
            disabled={readOnly}
            onChange={(e) => onPatch({ tilt: Number(e.target.value) })}
            className={inputClass}
          />
        </ConfigField>
        <ConfigField label="Azimuth (°)">
          <input
            type="number"
            min="0"
            max="360"
            step="1"
            value={config.azimuth}
            disabled={readOnly}
            onChange={(e) => onPatch({ azimuth: Number(e.target.value) })}
            className={inputClass}
          />
        </ConfigField>
      </div>

      <ConfigField label="Mount Type">
        <select
          value={config.mountType}
          disabled={readOnly}
          onChange={(e) => onPatch({ mountType: e.target.value })}
          className={selectClass}
        >
          <option value={MOUNT_TYPES.FLUSH}>Flush mount</option>
          <option value={MOUNT_TYPES.TILTED}>Tilted mount</option>
          <option value={MOUNT_TYPES.BALLASTED}>Ballasted</option>
        </select>
      </ConfigField>

      <ConfigField label="Mount Height (m)">
        <input
          type="number"
          min="0"
          max="3"
          step="0.05"
          value={config.mountHeight}
          disabled={readOnly}
          onChange={(e) => onPatch({ mountHeight: Number(e.target.value) })}
          className={inputClass}
        />
      </ConfigField>
    </div>
  );
}

function PlacementAreaConfigPanel({
  placementAreas,
  selectedPlacementArea,
  onSelectPlacementArea,
  projectPanelDefaults,
  onUpdateProjectPanelDefaults,
  onSetPlacementAreaUseProjectDefaults,
  onPatchPlacementAreaConfig,
  layoutIsStale,
  hasGeneratedLayout,
  onGenerateLayout,
  onGenerateMaximumLayout,
  placementReady,
  areaLayoutSummaries = [],
}) {
  const activeAreas = placementAreas.filter((a) => !a.deleted);

  const areaPanelCountById = useMemo(
    () => new Map(areaLayoutSummaries.map((row) => [row.id, row.panelCount])),
    [areaLayoutSummaries],
  );

  const effectiveConfig = useMemo(() => {
    if (!selectedPlacementArea) return projectPanelDefaults;
    return resolveEffectivePanelConfig(
      projectPanelDefaults,
      selectedPlacementArea.panelProperties,
    );
  }, [selectedPlacementArea, projectPanelDefaults]);

  const footprintPanel = useMemo(
    () => panelForPlacement(effectiveConfig.moduleId, effectiveConfig.orientation),
    [effectiveConfig],
  );

  const capacityPreview = useMemo(() => {
    if (!selectedPlacementArea || !placementReady) return null;
    return computeCapacityPreview(
      placementReady,
      projectPanelDefaults,
      selectedPlacementArea,
    );
  }, [selectedPlacementArea, placementReady, projectPanelDefaults, effectiveConfig]);

  const usesDefaults = selectedPlacementArea
    ? selectedPlacementArea.panelProperties?.useProjectDefaults !== false
    : true;

  const handleAreaPatch = (patch) => {
    if (!selectedPlacementArea) return;
    if (usesDefaults) return;
    onPatchPlacementAreaConfig(selectedPlacementArea.id, patch);
  };

  const handleProjectPatch = (patch) => {
    onUpdateProjectPanelDefaults(patch);
  };

  return (
    <>
      {/* Project Defaults */}
      <div className="flex flex-col gap-3 px-3 py-3 rounded-xl bg-[rgba(7,17,32,0.5)] border border-[#23324A]">
        <div className="flex items-center gap-2">
          <FiSettings size={12} className="text-[#94A3B8]" />
          <span className="text-[9px] font-bold tracking-[0.18em] text-[#94A3B8] uppercase">
            Project Defaults
          </span>
        </div>
        <p className="text-[10px] text-[#4a5c75] leading-relaxed">
          New placement areas inherit these settings. Override per area below.
        </p>
        <PanelConfigFields
          config={projectPanelDefaults}
          readOnly={false}
          onPatch={handleProjectPatch}
        />
      </div>

      {DIVIDER}

      {/* Placement area picker */}
      <div className="flex flex-col gap-2">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Placement Areas</span>
        {activeAreas.length === 0 ? (
          <p className="text-[11px] text-[#94A3B8] px-1">
            Draw placement areas in Step 5 before configuring panels.
          </p>
        ) : (
          activeAreas.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => onSelectPlacementArea(area.id)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all border ${
                selectedPlacementArea?.id === area.id
                  ? "bg-[#06B6D4]/15 border-[#06B6D4]/40 text-[#F8FAFC]"
                  : "bg-[rgba(7,17,32,0.4)] border-[#23324A] text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              <span className="text-[12px] font-medium">{area.name}</span>
              {(areaPanelCountById.get(area.id) ?? 0) > 0 && (
                <span className="text-[10px] tabular-nums text-[#06B6D4]">
                  {areaPanelCountById.get(area.id)} panels
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {selectedPlacementArea && (
        <>
          {DIVIDER}

          <div className="flex flex-col gap-3 px-3 py-3 rounded-xl bg-[#06B6D4]/8 border border-[#06B6D4]/25">
            <span className="text-[9px] font-bold tracking-[0.18em] text-[#06B6D4] uppercase">
              Panel Configuration · {selectedPlacementArea.name}
            </span>

            {/* Override toggles */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`pa-config-${selectedPlacementArea.id}`}
                  checked={usesDefaults}
                  onChange={() => onSetPlacementAreaUseProjectDefaults(selectedPlacementArea.id, true)}
                  className="accent-[#06B6D4]"
                />
                <span className="text-[11px] text-[#F8FAFC]">Use Project Defaults</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`pa-config-${selectedPlacementArea.id}`}
                  checked={!usesDefaults}
                  onChange={() => onSetPlacementAreaUseProjectDefaults(selectedPlacementArea.id, false)}
                  className="accent-[#06B6D4]"
                />
                <span className="text-[11px] text-[#F8FAFC]">Override For This Area</span>
              </label>
            </div>

            <PanelConfigFields
              config={effectiveConfig}
              readOnly={usesDefaults}
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

          {/* Generated layout stats — selected area only shows requested target;
              authoritative counts live in Layout Summary below */}
          {selectedPlacementArea.generatedLayout && (
            <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-[#23324A]/40 border border-[#23324A]">
              <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                Target:{" "}
                <span className="text-[#FFB547] font-semibold tabular-nums">
                  {(selectedPlacementArea.generatedLayout.requestedCapacityKW ?? 0).toFixed(1)} kW
                </span>
                {" · "}
                Mode:{" "}
                {selectedPlacementArea.generatedLayout.generateMode === "maximum"
                  ? "Maximum"
                  : "Target Capacity"}
              </p>
            </div>
          )}

          {/* Stale + Generate / Regenerate */}
          {layoutIsStale && hasGeneratedLayout && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[#FFB547]/10 border border-[#FFB547]/30">
              <FiAlertCircle size={14} className="text-[#FFB547] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Layout configuration changed. Regenerate to apply module, orientation, or capacity updates.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => onGenerateLayout()}
            disabled={
              !placementReady
              || activeAreas.length === 0
              || capacityPreview?.exceeds
            }
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-[13px] font-semibold bg-[#4F8CFF] text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <FiRefreshCw size={15} />
            {hasGeneratedLayout ? "Regenerate Layout" : "Generate Layout"}
          </button>

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
  onSetPlacementAreaUseProjectDefaults = () => {},
  onPatchPlacementAreaConfig = () => {},
  layoutIsStale = false,
  hasGeneratedLayout = false,
  generatedPanelLayout = null,
  onGenerateLayout = () => {},
  onGenerateMaximumLayout = () => {},
  selectedPanelSlotId = null,
  isStaleDesign = false,
  onUpdateDesign = () => {},
}) {
  const areaLayoutSummaries = useMemo(
    () => buildPlacementAreaLayoutSummaries(placementAreas, panelLayout),
    [placementAreas, panelLayout],
  );

  const selectedPlacedPanel = useMemo(() => {
    if (!selectedPanelSlotId || !panelLayout?.placedPanels) return null;
    return panelLayout.placedPanels.find(
      (p) => (p.slotId ?? p.id) === selectedPanelSlotId,
    ) ?? null;
  }, [selectedPanelSlotId, panelLayout]);

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
      <PanelHeader
        label="Panels"
        subtitle={usePlacementAreaPanelWorkflow
          ? "Configure modules · generate layout"
          : "Auto layout · arrays · manual edits"}
        pill={pill}
      />

      {DIVIDER}

      {usePlacementAreaPanelWorkflow ? (
        <PlacementAreaConfigPanel
          placementAreas={placementAreas}
          selectedPlacementArea={selectedPlacementArea}
          onSelectPlacementArea={onSelectPlacementArea}
          projectPanelDefaults={projectPanelDefaults}
          onUpdateProjectPanelDefaults={onUpdateProjectPanelDefaults}
          onSetPlacementAreaUseProjectDefaults={onSetPlacementAreaUseProjectDefaults}
          onPatchPlacementAreaConfig={onPatchPlacementAreaConfig}
          layoutIsStale={layoutIsStale}
          hasGeneratedLayout={hasGeneratedLayout}
          generatedPanelLayout={generatedPanelLayout}
          onGenerateLayout={onGenerateLayout}
          onGenerateMaximumLayout={onGenerateMaximumLayout}
          placementReady={placementReady}
          areaLayoutSummaries={areaLayoutSummaries}
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
      {usePlacementAreaPanelWorkflow && selectedPlacedPanel && (
        <>
          <div className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-[rgba(79,140,255,0.08)] border border-[#4F8CFF]/30">
            <span className="text-[9px] font-bold tracking-[0.18em] text-[#4F8CFF] uppercase">
              Selected Panel
            </span>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-[#94A3B8]">
              <p>Slot: <span className="text-[#F8FAFC] tabular-nums">{selectedPanelSlotId}</span></p>
              <p className="capitalize">
                Orientation:{" "}
                <span className="text-[#F8FAFC]">
                  {inferPanelOrientation(selectedPlacedPanel)}
                </span>
              </p>
              <p>
                Size:{" "}
                <span className="text-[#F8FAFC] tabular-nums">
                  {selectedPlacedPanel.width?.toFixed(2)} × {selectedPlacedPanel.length?.toFixed(2)} m
                </span>
              </p>
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

      {hasGeneratedLayout && capacity.panelCount > 0 && (
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

      {usePlacementAreaPanelWorkflow && hasGeneratedLayout && areaLayoutSummaries.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Current Layout</span>
            <p className="text-[10px] text-[#4a5c75] leading-relaxed -mt-1">
              Current placed panels on the roof — updates with manual edits.
            </p>
            {areaLayoutSummaries.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-[rgba(7,17,32,0.5)] border border-[#23324A]"
              >
                <span className="text-[12px] font-semibold text-[#F8FAFC]">{row.name}</span>
                <div className="grid grid-cols-2 gap-2">
                  <KpiCard
                    label="Current Panels"
                    value={String(row.panelCount)}
                    accent="text-[#F8FAFC]"
                  />
                  <KpiCard
                    label="Current Capacity"
                    value={`${row.capacityKw.toFixed(2)} kW`}
                    accent="text-[#4F8CFF]"
                  />
                </div>
                <div className="text-[10px] text-[#94A3B8] leading-relaxed space-y-0.5">
                  <p>Module: {row.moduleLabel}</p>
                  <p className="capitalize">Orientation: {row.orientation}</p>
                </div>
              </div>
            ))}
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
              "Set target capacity (kW) — only the required panels are placed",
              "Preview shows required vs maximum panels before generation",
              "Click Generate Layout — places exactly the required panel count",
              "If target exceeds available space, use Generate Maximum Layout",
              "Tilt, azimuth, and mount settings are stored for future phases",
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
