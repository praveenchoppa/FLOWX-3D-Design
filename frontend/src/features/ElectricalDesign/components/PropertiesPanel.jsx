/**
 * PropertiesPanel.jsx — Read-only properties for arrays, strings, and panel selection.
 */
import { useEffect, useMemo, useState } from "react";

import { DataRow, SEC_LABEL } from "../../steps/panelUtils";
import { useArraySelection } from "../hooks/useArraySelection.js";
import { useElectricalPanelSelection } from "../hooks/useElectricalPanelSelection.js";
import { useStringSelection } from "../hooks/useStringSelection.js";
import { useStringManagement } from "../hooks/useStringManagement.js";
import { useStringAssignment } from "../hooks/useStringAssignment.js";
import { useElectricalCalculations } from "../hooks/useElectricalCalculations.js";
import { useInverterSelection } from "../hooks/useInverterSelection.js";
import { useMpptSelection } from "../hooks/useMpptSelection.js";
import { validateMergeCompatibility } from "../models/array.js";
import { stringsForMppt } from "../models/stringAssignment.js";
import { inverterForMppt } from "../models/mppt.js";
import { homerunLengthDisplay, totalCableLengthDisplay, wiringSummaryForDisplay } from "../models/cable.js";
import { useElectricalStore } from "../hooks/useElectricalStore.js";
import {
  assignedPanelCount,
  getUnassignedCount,
  stringsInArray,
} from "../utils/stringDisplayUtils.js";
import { getPanelById } from "../../panels/panelTypes.js";
import {
  DEFAULT_MPPT_ALLOWED_OVERLOAD_PERCENT,
  MPPT_ALLOWED_OVERLOAD_MAX_PERCENT,
  MPPT_ALLOWED_OVERLOAD_MIN_PERCENT,
  MPPT_ALLOWED_OVERLOAD_STEP_PERCENT,
} from "../constants/mpptUtilizationConfig.js";
import {
  formatCurrent,
  formatDcAcRatio,
  formatDcCapacity,
  formatDcCapacityKw,
  formatOperatingPower,
  formatUtilizationPercent,
  formatEstimatedLengthM,
  formatVoltage,
} from "../utils/electricalFormatUtils.js";

function formatOrientation(value) {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function PropertiesPanel() {
  const { selectedArray, selectedArrays, selectedArrayIds } = useArraySelection();
  const {
    selectedElectricalPanelIds,
    selectedPanelCount,
    canPickPanels,
    activeArray,
  } = useElectricalPanelSelection();
  const { selectedString } = useStringSelection();
  const { selectedInverter } = useInverterSelection();
  const { selectedMppt } = useMpptSelection();
  const { deleteString, canDeleteString } = useStringManagement();
  const {
    assignedMppt,
    canAssignString,
    canRemoveAssignment,
    assignableGroups,
    assignableMppts,
    allMpptsOccupied,
    allMpptsOccupiedMessage,
    assignStringToMppt,
    removeStringFromMppt,
  } = useStringAssignment();
  const { metrics, utilization, warnings } = useElectricalCalculations();
  const {
    arrays,
    strings,
    inverters,
    panelLayout,
    mpptAllowedOverloadPercent,
    setMpptAllowedOverload,
    stringWiring,
    terminationPoint,
  } = useElectricalStore();

  const [pendingMpptId, setPendingMpptId] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState(null);

  useEffect(() => {
    setPendingMpptId(selectedString?.mpptId ?? "");
    setAssignmentMessage(null);
  }, [selectedString?.id, selectedString?.mpptId]);

  const mpptAssignedStrings = useMemo(
    () => (selectedMppt ? stringsForMppt(strings, selectedMppt) : []),
    [strings, selectedMppt],
  );

  const mpptAssignedNames = mpptAssignedStrings.length
    ? mpptAssignedStrings.map((s) => s.displayName).join(", ")
    : "None";

  const canSubmitAssignment = canAssignString
    && !!pendingMpptId
    && pendingMpptId !== (selectedString?.mpptId ?? "")
    && assignableMppts.some((mppt) => mppt.id === pendingMpptId);

  const handleAssignToMppt = () => {
    if (!selectedString || !canSubmitAssignment) return;
    const result = assignStringToMppt(selectedString.id, pendingMpptId);
    if (!result.ok) {
      setAssignmentMessage({ type: "error", text: result.reason });
      return;
    }
    setAssignmentMessage({ type: "success", text: "String assigned to MPPT." });
  };

  const handleRemoveAssignment = () => {
    if (!selectedString || !canRemoveAssignment) return;
    const result = removeStringFromMppt(selectedString.id);
    if (!result.ok) {
      setAssignmentMessage({ type: "error", text: result.reason });
      return;
    }
    setPendingMpptId("");
    setAssignmentMessage({ type: "success", text: "Assignment removed." });
  };

  const mergeCheck = validateMergeCompatibility(arrays, selectedArrayIds);
  const panelCount = selectedArray?.panelIds?.length ?? 0;
  const multiPanelCount = selectedArrays.reduce(
    (sum, a) => sum + (a.panelIds?.length ?? 0),
    0,
  );

  const selectedModuleSummary = useMemo(() => {
    if (!selectedElectricalPanelIds.length || !panelLayout?.placedPanels) return null;
    const idSet = new Set(selectedElectricalPanelIds);
    const modules = new Set();
    for (const panel of panelLayout.placedPanels) {
      const key = panel.slotId ?? panel.id;
      if (!idSet.has(key)) continue;
      const mod = getPanelById(panel.panelTypeId);
      if (mod) {
        modules.add(`${mod.manufacturer} ${mod.model} ${mod.powerW ?? mod.power}W`);
      }
    }
    if (modules.size === 0) return null;
    if (modules.size === 1) return [...modules][0];
    return `${modules.size} module types`;
  }, [selectedElectricalPanelIds, panelLayout]);

  const parentArray = selectedString
    ? arrays.find((a) => a.id === selectedString.arrayId)
    : null;

  const stringPanelCount = selectedString?.orderedPanelSequence?.length ?? 0;

  const arrayStringCount = selectedArray
    ? stringsInArray(strings, selectedArray).length
    : 0;
  const arrayAssigned = selectedArray
    ? assignedPanelCount(selectedArray, strings)
    : 0;
  const arrayUnassigned = selectedArray
    ? getUnassignedCount(selectedArray, strings)
    : 0;

  const handleDeleteString = () => {
    if (!selectedString || !canDeleteString) return;
    deleteString(selectedString.id);
  };

  const showDesign = !selectedInverter && !selectedMppt;

  const selectedStringMetrics = selectedString
    ? metrics.byStringId[selectedString.id]
    : null;

  const selectedMpptMetrics = selectedMppt
    ? metrics.byMpptId[selectedMppt.id]
    : null;

  const selectedMpptUtilization = selectedMppt
    ? utilization.byMpptId[selectedMppt.id]
    : null;

  const selectedMpptWarning = selectedMppt
    ? warnings.find((w) => w.mpptId === selectedMppt.id)
    : null;

  const utilizationStatusLabel = selectedMpptUtilization?.status === "warning"
    ? "Warning"
    : selectedMpptUtilization?.status === "healthy"
      ? "Healthy"
      : "—";

  const selectedStringWiring = selectedString
    ? stringWiring?.byStringId?.[selectedString.id]
    : null;

  const stringWiringSummary = wiringSummaryForDisplay(selectedStringWiring?.intra);
  const homerunSummary = homerunLengthDisplay(
    terminationPoint,
    selectedStringWiring?.homerun?.homerunLengthM ?? null,
  );
  const totalCableSummary = totalCableLengthDisplay(selectedStringWiring, terminationPoint);

  const parentInverterForMppt = selectedMppt
    ? inverterForMppt(inverters, selectedMppt)
    : null;

  const assignedParentInverter = assignedMppt
    ? inverterForMppt(inverters, assignedMppt)
    : null;

  const selectedInverterMetrics = selectedInverter
    ? metrics.byInverterId[selectedInverter.id]
    : null;

  const inverterMetrics = selectedInverterMetrics ?? metrics.inverter;

  return (
    <div className="flex flex-col gap-3">
      <span className={SEC_LABEL}>Properties</span>

      {selectedMppt && (
        <div className="rounded-xl border border-[#A78BFA]/30 overflow-hidden bg-[rgba(7,17,32,0.35)]">
          <div className="px-4 py-3 border-b border-[#23324A]/60 bg-[#A78BFA]/8">
            <p className="text-xs text-[#A78BFA] font-semibold">{selectedMppt.displayName}</p>
          </div>
          <DataRow
            label="Parent Inverter"
            value={parentInverterForMppt
              ? `${parentInverterForMppt.manufacturer} ${parentInverterForMppt.model}`
              : "—"}
          />
          <DataRow label="Assigned Strings" value={mpptAssignedNames} />
          <DataRow
            label="Assigned String Count"
            value={String(selectedMppt.stringIds?.length ?? 0)}
          />
          <DataRow
            label="Aggregated Voltage"
            value={formatVoltage(selectedMpptMetrics?.voltageV)}
          />
          <DataRow
            label="Aggregated Current"
            value={formatCurrent(selectedMpptMetrics?.currentA)}
          />
          <DataRow
            label="Operating Power"
            value={formatOperatingPower(selectedMpptMetrics?.operatingPowerW)}
          />
          <DataRow
            label="DC Capacity"
            value={formatDcCapacity(selectedMpptMetrics?.dcCapacityW)}
          />
          <DataRow
            label="Rated Capacity"
            value={selectedMppt.capacity != null ? `${selectedMppt.capacity} kW` : "—"}
          />
          <DataRow
            label="MPPT Utilization"
            value={formatUtilizationPercent(selectedMpptUtilization?.utilizationPercent)}
          />
          <DataRow
            label="Allowed Overload"
            value={formatUtilizationPercent(
              selectedMpptUtilization?.allowedOverloadPercent
                ?? mpptAllowedOverloadPercent
                ?? DEFAULT_MPPT_ALLOWED_OVERLOAD_PERCENT,
            )}
          />
          <DataRow
            label="Warning Starts At"
            value={formatUtilizationPercent(selectedMpptUtilization?.warningLimitPercent)}
          />
          <DataRow
            label="Status"
            value={utilizationStatusLabel}
            isLast={!selectedMpptWarning}
          />
          {selectedMpptWarning && (
            <div className="px-4 py-3 border-t border-[#23324A]/60">
              <p className="text-[10px] text-[#FFB547] leading-relaxed">
                {selectedMpptWarning.message}
              </p>
            </div>
          )}
          <div className="px-4 py-3 border-t border-[#23324A]/60 flex flex-col gap-2">
            <label className="text-[10px] text-[#94A3B8] font-medium">
              Allowed Overload
            </label>
            <input
              type="range"
              min={MPPT_ALLOWED_OVERLOAD_MIN_PERCENT}
              max={MPPT_ALLOWED_OVERLOAD_MAX_PERCENT}
              step={MPPT_ALLOWED_OVERLOAD_STEP_PERCENT}
              value={mpptAllowedOverloadPercent ?? DEFAULT_MPPT_ALLOWED_OVERLOAD_PERCENT}
              onChange={(e) => setMpptAllowedOverload(Number(e.target.value))}
              className="w-full accent-[#A78BFA]"
            />
            <p className="text-[10px] text-[#64748B] leading-relaxed">
              Tolerance above rated capacity (100%). Warning starts at {formatUtilizationPercent(
                selectedMpptUtilization?.warningLimitPercent
                  ?? utilization.warningLimitPercent,
              )}.
            </p>
          </div>
        </div>
      )}

      {selectedInverter && !selectedMppt && (
        <div className="rounded-xl border border-[#A78BFA]/30 overflow-hidden bg-[rgba(7,17,32,0.35)]">
          <div className="px-4 py-3 border-b border-[#23324A]/60 bg-[#A78BFA]/8">
            <p className="text-xs text-[#A78BFA] font-semibold">
              {selectedInverter.manufacturer} {selectedInverter.model}
            </p>
          </div>
          <DataRow label="Total Load (AC)" value={`${selectedInverter.totalLoad} kW`} />
          <DataRow
            label="DC Capacity"
            value={formatDcCapacityKw(inverterMetrics?.totalDcCapacityKw)}
          />
          <DataRow
            label="DC/AC Ratio"
            value={formatDcAcRatio(inverterMetrics?.dcAcRatio)}
          />
          <DataRow label="MPPT Count" value={String(selectedInverter.chargeControllerCount)} />
          <DataRow
            label="Assigned Strings"
            value={String(inverterMetrics?.assignedStringCount ?? 0)}
          />
          <DataRow label="Phase" value={selectedInverter.phase} />
          <DataRow label="Line Voltage" value={`${selectedInverter.lineVoltage} V`} />
          <DataRow label="DC Voltage" value={`${selectedInverter.dcVoltage} V`} />
          <DataRow label="DC Current" value={`${selectedInverter.dcCurrent} A`} isLast />
        </div>
      )}

      {showDesign && selectedString && (
        <div className="rounded-xl border border-[#00E38C]/30 overflow-hidden bg-[rgba(7,17,32,0.35)]">
          <div className="px-4 py-3 border-b border-[#23324A]/60 bg-[#00E38C]/8">
            <p className="text-xs text-[#00E38C] font-semibold">{selectedString.displayName}</p>
          </div>
          <DataRow label="Parent Array" value={parentArray?.displayName ?? "—"} />
          <DataRow label="Total Panels" value={String(stringPanelCount)} />
          <DataRow label="Status" value="Highlighted in Workspace" />
          <DataRow
            label="Voltage"
            value={formatVoltage(selectedStringMetrics?.voltageV)}
          />
          <DataRow
            label="Current"
            value={formatCurrent(selectedStringMetrics?.currentA)}
          />
          <DataRow
            label="Operating Power"
            value={formatOperatingPower(selectedStringMetrics?.operatingPowerW)}
          />
          <DataRow
            label="DC Capacity"
            value={formatDcCapacity(selectedStringMetrics?.dcCapacityW)}
          />
          <DataRow
            label="Assigned MPPT"
            value={assignedMppt?.displayName ?? "Not Assigned"}
          />
          <DataRow
            label="Parent Inverter"
            value={assignedParentInverter
              ? `${assignedParentInverter.manufacturer} ${assignedParentInverter.model}`
              : "Not Assigned"}
          />
          <DataRow
            label="Homerun Assignment"
            value={
              assignedParentInverter && assignedMppt
                ? `${assignedMppt.displayName} → ${assignedParentInverter.manufacturer} ${assignedParentInverter.model}`
                : assignedMppt
                  ? assignedMppt.displayName
                  : "Not Assigned"
            }
          />
          <DataRow
            label="Estimated String Wiring"
            value={formatEstimatedLengthM(selectedStringWiring?.intraStringLengthM)}
          />
          {stringWiringSummary.detail && (
            <div className="px-4 py-1 border-t border-[#23324A]/40">
              <p className="text-[10px] text-[#64748B] leading-relaxed">
                {stringWiringSummary.detail}
              </p>
            </div>
          )}
          <DataRow
            label="Homerun Length"
            value={homerunSummary.value}
          />
          {homerunSummary.detail && (
            <div className="px-4 py-1 border-t border-[#23324A]/40">
              <p className="text-[10px] text-[#64748B] leading-relaxed">
                {homerunSummary.detail}
              </p>
            </div>
          )}
          <DataRow
            label="Total Cable Length"
            value={totalCableSummary.value}
          />
          {totalCableSummary.detail && (
            <div className="px-4 py-1 border-t border-[#23324A]/40">
              <p className="text-[10px] text-[#64748B] leading-relaxed">
                {totalCableSummary.detail}
              </p>
            </div>
          )}
          {!inverters.length && (
            <div className="px-4 py-3 border-t border-[#23324A]/60">
              <p className="text-[10px] text-[#64748B] leading-relaxed">
                Add an inverter before assigning strings to MPPTs.
              </p>
            </div>
          )}
          {inverters.length > 0 && (
            <div className="px-4 py-3 border-t border-[#23324A]/60 flex flex-col gap-2">
              <label className="text-[10px] text-[#94A3B8] font-medium">
                Assign to MPPT
              </label>
              <select
                value={pendingMpptId}
                onChange={(e) => {
                  setPendingMpptId(e.target.value);
                  setAssignmentMessage(null);
                }}
                disabled={!canAssignString}
                className="w-full px-2.5 py-2 rounded-lg text-[11px] bg-[rgba(7,17,32,0.6)] border border-[#23324A]/60 text-[#F8FAFC] focus:outline-none focus:border-[#00E38C]/50 disabled:opacity-50"
              >
                <option value="">— Select MPPT —</option>
                {assignableGroups.map(({ inverter, mppts: groupMppts }) => (
                  groupMppts.length > 0 && (
                    <optgroup
                      key={inverter.id}
                      label={`${inverter.manufacturer} ${inverter.model}`}
                    >
                      {groupMppts.map((mppt) => (
                        <option key={mppt.id} value={mppt.id}>
                          {mppt.displayName}
                        </option>
                      ))}
                    </optgroup>
                  )
                ))}
              </select>
              {allMpptsOccupied && (
                <p className="text-[10px] text-[#64748B] leading-relaxed">
                  {allMpptsOccupiedMessage}
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleAssignToMppt}
                  disabled={!canSubmitAssignment}
                  className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-[11px] font-semibold border border-[#00E38C]/40 bg-[#00E38C]/10 text-[#00E38C] hover:bg-[#00E38C]/18 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {selectedString?.mpptId ? "Change MPPT" : "Assign to MPPT"}
                </button>
                {canRemoveAssignment && (
                  <button
                    type="button"
                    onClick={handleRemoveAssignment}
                    className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-[11px] font-semibold border border-[#23324A]/60 bg-[rgba(7,17,32,0.35)] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#334466]/80 transition-colors"
                  >
                    Remove Assignment
                  </button>
                )}
              </div>
              {assignmentMessage && (
                <p className={`text-[10px] leading-relaxed ${
                  assignmentMessage.type === "error" ? "text-[#FFB547]" : "text-[#00E38C]"
                }`}
                >
                  {assignmentMessage.text}
                </p>
              )}
            </div>
          )}
          {canDeleteString && (
            <div className="px-4 py-3 border-t border-[#23324A]/60">
              <button
                type="button"
                onClick={handleDeleteString}
                className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-[11px] font-semibold border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/18 transition-colors"
              >
                Delete String
              </button>
            </div>
          )}
        </div>
      )}

      {showDesign && !selectedString && selectedArrayIds.length === 0 && !selectedInverter && !selectedMppt && (
        <p className="text-[11px] text-[#4a5c75] leading-relaxed px-1">
          Select a design or electrical item to view its properties.
        </p>
      )}

      {showDesign && !selectedString && selectedArrayIds.length > 1 && (
        <div className="rounded-xl border border-[#23324A]/60 overflow-hidden bg-[rgba(7,17,32,0.35)] px-4 py-3 flex flex-col gap-2">
          <p className="text-xs text-[#F8FAFC] font-semibold">
            {selectedArrayIds.length} arrays selected
          </p>
          <p className="text-[10px] text-[#94A3B8] tabular-nums">
            {multiPanelCount} panels combined
          </p>
          <p className="text-[10px] text-[#FFB547] leading-relaxed">
            Panel picking disabled while multiple arrays are selected for merge.
          </p>
          {mergeCheck.ok ? (
            <p className="text-[10px] text-[#00E38C] leading-relaxed">
              Compatible for merge — same orientation, tilt, and spacing.
            </p>
          ) : (
            <p className="text-[10px] text-[#FFB547] leading-relaxed">
              {mergeCheck.reason}
            </p>
          )}
        </div>
      )}

      {showDesign && !selectedString && canPickPanels && selectedPanelCount > 0 && (
        <div className="rounded-xl border border-[#06B6D4]/30 overflow-hidden bg-[#06B6D4]/8 px-4 py-3 flex flex-col gap-2">
          <p className="text-xs text-[#06B6D4] font-semibold">
            {selectedPanelCount} panel{selectedPanelCount !== 1 ? "s" : ""} selected
          </p>
          {activeArray && (
            <p className="text-[10px] text-[#94A3B8]">
              In array:{" "}
              <span className="text-[#F8FAFC]">{activeArray.displayName}</span>
            </p>
          )}
          {selectedModuleSummary && (
            <p className="text-[10px] text-[#94A3B8]">
              Module:{" "}
              <span className="text-[#F8FAFC]">{selectedModuleSummary}</span>
            </p>
          )}
        </div>
      )}

      {showDesign && !selectedString && selectedArray && (
        <>
          <div className="rounded-xl border border-[#4F8CFF]/30 overflow-hidden bg-[rgba(7,17,32,0.35)]">
            <div className="px-4 py-3 border-b border-[#23324A]/60 bg-[#4F8CFF]/8">
              <p className="text-xs text-[#4F8CFF] font-semibold">{selectedArray.displayName}</p>
            </div>
            <DataRow label="Panels" value={String(panelCount)} />
            <DataRow label="Strings" value={String(arrayStringCount)} />
            <DataRow label="Assigned" value={String(arrayAssigned)} />
            <DataRow label="Unassigned" value={String(arrayUnassigned)} isLast />
          </div>

          <div className="rounded-xl border border-[#23324A]/60 overflow-hidden bg-[rgba(7,17,32,0.35)]">
            <DataRow label="Orientation" value={formatOrientation(selectedArray.orientation)} />
            <DataRow label="Tilt" value={`${selectedArray.tilt ?? 0}°`} isLast />
          </div>

          {arrayStringCount === 0 && (
            <div className="rounded-xl border border-[#23324A]/60 bg-[rgba(7,17,32,0.35)] px-4 py-3 flex flex-col gap-1">
              <p className="text-[11px] text-[#94A3B8] font-medium">No Strings Created</p>
              <p className="text-[10px] text-[#64748B] leading-relaxed">
                Select panels and click
                <br />
                Create String
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
