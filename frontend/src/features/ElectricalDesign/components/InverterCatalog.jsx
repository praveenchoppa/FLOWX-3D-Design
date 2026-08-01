/**
 * InverterCatalog.jsx — Manual inverter selection from default catalog (P4).
 */
import { useMemo, useState } from "react";

import { SEC_LABEL } from "../../steps/panelUtils";
import { INVERTER_CATALOG } from "../constants/inverterCatalog.js";
import { useElectricalStore } from "../hooks/useElectricalStore.js";

export default function InverterCatalog() {
  const { projectInverter, setInverterFromCatalog } = useElectricalStore();
  const [catalogId, setCatalogId] = useState(
    () => projectInverter?.catalogId ?? INVERTER_CATALOG[0]?.catalogId ?? "",
  );
  const [feedback, setFeedback] = useState(null);

  const selectedEntry = useMemo(
    () => INVERTER_CATALOG.find((e) => e.catalogId === catalogId),
    [catalogId],
  );

  const handleSelect = () => {
    if (!catalogId) return;
    const result = setInverterFromCatalog(catalogId);
    if (result.ok) {
      setFeedback({
        type:    "success",
        message: `Selected ${result.inverter.manufacturer} ${result.inverter.model} with ${result.inverter.chargeControllerCount} MPPTs.`,
      });
    } else {
      setFeedback({ type: "error", message: result.reason });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Inverter Selection</span>
        <span className="text-[9px] text-[#4a5c75]">Choose the project inverter from catalog</span>
      </div>

      {projectInverter && (
        <p className="text-[10px] text-[#94A3B8] leading-relaxed">
          Current:{" "}
          <span className="text-[#F8FAFC] font-medium">
            {projectInverter.manufacturer} {projectInverter.model}
          </span>
          {" · "}
          <span className="tabular-nums">{projectInverter.chargeControllerCount}</span>
          {" MPPTs"}
        </p>
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

      <button
        type="button"
        onClick={handleSelect}
        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border border-[#A78BFA]/40 bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/18 transition-colors"
      >
        {projectInverter ? "Change Inverter" : "Select Inverter"}
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
