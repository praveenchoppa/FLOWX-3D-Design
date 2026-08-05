/**
 * InverterCatalog.jsx — Manual inverter selection from default catalog (P4 / multi-inverter MVP).
 */
import { useMemo, useState } from "react";

import { SEC_LABEL } from "../../steps/panelUtils";
import { INVERTER_CATALOG } from "../constants/inverterCatalog.js";
import { useElectricalStore } from "../hooks/useElectricalStore.js";
import { useInverterSelection } from "../hooks/useInverterSelection.js";

const CHANGE_SPEC_CONFIRM_MESSAGE =
  "Changing this inverter specification will regenerate its MPPTs and remove existing MPPT assignments for this inverter. Continue?";

const REMOVE_INVERTER_CONFIRM_WITH_ASSIGNMENTS =
  "Remove this inverter?\n\n"
  + "• The inverter will be removed\n"
  + "• Its MPPTs will be removed\n"
  + "• All strings will be preserved\n"
  + "• Strings assigned to this inverter will become Unassigned\n"
  + "• You can reassign those strings to another inverter later\n\n"
  + "Continue?";

const REMOVE_INVERTER_CONFIRM_SIMPLE =
  "Remove this inverter and its MPPTs? Strings are not affected.";

export default function InverterCatalog() {
  const {
    inverters,
    mppts,
    strings,
    setInverterFromCatalog,
    addInverterFromCatalog,
    changeInverterSpecification,
    removeInverter,
  } = useElectricalStore();
  const { selectedInverter } = useInverterSelection();

  const [catalogId, setCatalogId] = useState(
    () => selectedInverter?.catalogId
      ?? inverters[0]?.catalogId
      ?? INVERTER_CATALOG[0]?.catalogId
      ?? "",
  );
  const [feedback, setFeedback] = useState(null);

  const selectedEntry = useMemo(
    () => INVERTER_CATALOG.find((e) => e.catalogId === catalogId),
    [catalogId],
  );

  const hasInverters = inverters.length > 0;
  const isFirstSelection = !hasInverters;
  const isSpecChange = hasInverters
    && selectedInverter
    && catalogId !== selectedInverter.catalogId;

  const assignedStringCountForSelected = useMemo(() => {
    if (!selectedInverter) return 0;
    const ownedMpptIds = new Set(
      (mppts ?? []).filter((m) => m.inverterId === selectedInverter.id).map((m) => m.id),
    );
    return (strings ?? []).filter((s) => s.mpptId && ownedMpptIds.has(s.mpptId)).length;
  }, [selectedInverter, mppts, strings]);

  const handlePrimaryAction = () => {
    if (!catalogId) return;
    setFeedback(null);

    if (isFirstSelection) {
      const result = setInverterFromCatalog(catalogId);
      if (result.ok) {
        setFeedback({
          type:    "success",
          message: `Selected ${result.inverter.manufacturer} ${result.inverter.model} with ${result.inverter.chargeControllerCount} MPPTs.`,
        });
      } else {
        setFeedback({ type: "error", message: result.reason });
      }
      return;
    }

    if (isSpecChange && selectedInverter) {
      if (!window.confirm(CHANGE_SPEC_CONFIRM_MESSAGE)) return;
      const result = changeInverterSpecification(catalogId, selectedInverter.id);
      if (result.ok) {
        setFeedback({
          type:    "success",
          message: `Updated ${result.inverter.manufacturer} ${result.inverter.model} — MPPTs regenerated for this inverter only.`,
        });
      } else {
        setFeedback({ type: "error", message: result.reason });
      }
      return;
    }

    const result = addInverterFromCatalog(catalogId);
    if (result.ok) {
      setFeedback({
        type:    "success",
        message: `Added ${result.inverter.manufacturer} ${result.inverter.model} with ${result.inverter.chargeControllerCount} MPPTs.`,
      });
    } else {
      setFeedback({ type: "error", message: result.reason });
    }
  };

  const handleRemoveInverter = () => {
    if (!selectedInverter) return;
    setFeedback(null);

    const message = assignedStringCountForSelected > 0
      ? REMOVE_INVERTER_CONFIRM_WITH_ASSIGNMENTS
      : REMOVE_INVERTER_CONFIRM_SIMPLE;
    if (!window.confirm(message)) return;

    const result = removeInverter(selectedInverter.id);
    if (result.ok) {
      setFeedback({
        type:    "success",
        message: result.inverters.length === 0
          ? "Inverter removed. No inverters remain — select one from the catalog to continue."
          : `Removed ${selectedInverter.manufacturer} ${selectedInverter.model}.`
            + (result.assignedStringCount > 0
              ? ` ${result.assignedStringCount} string(s) are now Unassigned.`
              : ""),
      });
    } else {
      setFeedback({ type: "error", message: result.reason });
    }
  };

  const primaryLabel = isFirstSelection
    ? "Select Inverter"
    : isSpecChange
      ? "Change Inverter Specification"
      : "Add Inverter";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Inverter Selection</span>
        <span className="text-[9px] text-[#4a5c75]">
          {hasInverters
            ? "Add inverters, change the selected inverter specification, or remove the selected inverter"
            : "Choose the first project inverter from catalog"}
        </span>
      </div>

      {hasInverters && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-[#64748B] font-medium">Project Inverters</span>
          {inverters.map((inv, index) => {
            const isSelected = selectedInverter?.id === inv.id;
            return (
              <p
                key={inv.id}
                className={`text-[10px] leading-relaxed ${
                  isSelected ? "text-[#A78BFA]" : "text-[#94A3B8]"
                }`}
              >
                {index + 1}.{" "}
                <span className={`font-medium ${isSelected ? "text-[#A78BFA]" : "text-[#F8FAFC]"}`}>
                  {inv.manufacturer} {inv.model}
                </span>
                {" · "}
                <span className="tabular-nums">{inv.chargeControllerCount}</span>
                {" MPPTs"}
                {isSelected ? " · selected" : ""}
              </p>
            );
          })}
        </div>
      )}

      <select
        value={catalogId}
        onChange={(e) => {
          setCatalogId(e.target.value);
          setFeedback(null);
        }}
        className="w-full px-3 py-2 rounded-lg text-[11px] text-[#F8FAFC] bg-[rgba(7,17,32,0.5)] border border-[#23324A]/60 outline-none focus:border-[#A78BFA]/50"
      >
        {INVERTER_CATALOG.map((entry) => (
          <option key={entry.catalogId} value={entry.catalogId}>
            {entry.manufacturer} {entry.model} — {entry.totalLoad} kW, {entry.chargeControllerCount} MPPTs
          </option>
        ))}
      </select>

      {selectedEntry && (
        <p className="text-[10px] text-[#64748B] tabular-nums leading-relaxed">
          {selectedEntry.totalLoad} kW · {selectedEntry.phase} · DC {selectedEntry.dcVoltage} V
        </p>
      )}

      {isSpecChange && (
        <p className="text-[10px] text-[#FFB547] leading-relaxed">
          This will regenerate MPPTs and clear string assignments for the selected inverter only.
        </p>
      )}

      <button
        type="button"
        onClick={handlePrimaryAction}
        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border border-[#A78BFA]/40 bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/18 transition-colors"
      >
        {primaryLabel}
      </button>

      {selectedInverter && (
        <button
          type="button"
          onClick={handleRemoveInverter}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/18 transition-colors"
        >
          Remove Selected Inverter
        </button>
      )}

      {feedback && (
        <p
          className={`text-[10px] leading-relaxed ${
            feedback.type === "success" ? "text-[#00E38C]" : "text-[#FFB547]"
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
