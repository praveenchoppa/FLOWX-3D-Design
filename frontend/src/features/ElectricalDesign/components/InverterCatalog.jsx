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

export default function InverterCatalog() {
  const {
    inverters,
    setInverterFromCatalog,
    addInverterFromCatalog,
    changeInverterSpecification,
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
            ? "Add inverters or change the selected inverter specification"
            : "Choose the first project inverter from catalog"}
        </span>
      </div>

      {hasInverters && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-[#64748B] font-medium">Project Inverters</span>
          {inverters.map((inv, index) => (
            <p key={inv.id} className="text-[10px] text-[#94A3B8] leading-relaxed">
              {index + 1}.{" "}
              <span className="text-[#F8FAFC] font-medium">
                {inv.manufacturer} {inv.model}
              </span>
              {" · "}
              <span className="tabular-nums">{inv.chargeControllerCount}</span>
              {" MPPTs"}
            </p>
          ))}
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
