/**
 * ElectricalTree.jsx — Multi-inverter → MPPT hierarchy (P4 / multi-inverter MVP).
 */
import { useMemo, useState } from "react";
import { FiChevronDown, FiChevronRight, FiCpu } from "react-icons/fi";

import { SEC_LABEL } from "../../../steps/panelUtils";
import { useInverterSelection } from "../../hooks/useInverterSelection.js";
import { useMpptSelection } from "../../hooks/useMpptSelection.js";
import { useElectricalStore } from "../../hooks/useElectricalStore.js";
import { mpptsForInverter } from "../../models/mppt.js";
import { stringsForMppt } from "../../models/stringAssignment.js";

function MpptTreeItem({ mppt, assignedStrings, isSelected, isLast, onSelect }) {
  const stringCount = mppt.stringIds?.length ?? 0;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`w-full text-left flex gap-2 pl-1 pr-2 py-1.5 rounded-lg border transition-all duration-150 ${
          isSelected
            ? "border-[#A78BFA]/60 bg-[#A78BFA]/15 shadow-[0_0_0_1px_rgba(167,139,250,0.2)]"
            : "border-transparent hover:border-[#23324A]/60 hover:bg-[rgba(7,17,32,0.35)]"
        }`}
      >
        <span className="text-[10px] text-[#4a5c75] font-mono shrink-0 w-5 pt-0.5 leading-none">
          {isLast && assignedStrings.length === 0 ? "└──" : "├──"}
        </span>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className={`text-[11px] truncate ${isSelected ? "text-[#A78BFA] font-semibold" : "text-[#F8FAFC] font-medium"}`}>
            {mppt.displayName}
          </span>
          <span className="text-[10px] text-[#94A3B8] tabular-nums pl-3">
            {stringCount} String{stringCount !== 1 ? "s" : ""}
          </span>
        </div>
      </button>
      {assignedStrings.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-8 pr-2 pb-0.5">
          {assignedStrings.map((str, index) => (
            <span
              key={str.id}
              className="text-[10px] text-[#64748B] truncate pl-1"
            >
              {index === assignedStrings.length - 1 && isLast ? "└──" : "├──"}
              {" "}
              •
              {" "}
              {str.displayName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function InverterTreeItem({
  inverter,
  inverterMppts,
  strings,
  isInverterSelected,
  selectedMpptId,
  isExpanded,
  onToggleExpand,
  onSelectInverter,
  onSelectMppt,
}) {
  const mpptCount = inverter.chargeControllerCount ?? 0;

  return (
    <div
      className={`rounded-xl border transition-all duration-150 ${
        isInverterSelected
          ? "border-[#A78BFA]/50 bg-[#A78BFA]/8 shadow-[0_0_0_1px_rgba(167,139,250,0.15)]"
          : "border-[#23324A]/60 bg-[rgba(7,17,32,0.5)] hover:border-[#334466]/80"
      }`}
      style={{ borderLeftColor: "#A78BFA", borderLeftWidth: 3 }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectInverter(inverter.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSelectInverter(inverter.id);
        }}
        className="w-full text-left flex flex-col gap-1.5 px-3 py-2.5 cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="shrink-0 text-[#94A3B8] p-0.5 hover:text-[#F8FAFC]"
            aria-label={isExpanded ? "Collapse MPPTs" : "Expand MPPTs"}
          >
            {isExpanded ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
          </button>
          <FiCpu size={11} className="text-[#A78BFA] shrink-0" />
          <span className="flex-1 text-[12px] text-[#F8FAFC] font-semibold truncate leading-tight">
            {inverter.manufacturer} {inverter.model}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 pl-[26px]">
          <span className="text-[10px] text-[#94A3B8] tabular-nums">
            {inverter.totalLoad} kW
          </span>
          <span className="text-[10px] text-[#64748B] tabular-nums">
            {mpptCount} MPPT{mpptCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-1 px-3 pb-2.5 ml-3 border-l border-[#23324A]/50">
          {inverterMppts.map((mppt, index) => (
            <MpptTreeItem
              key={mppt.id}
              mppt={mppt}
              assignedStrings={stringsForMppt(strings, mppt)}
              isSelected={selectedMpptId === mppt.id}
              isLast={index === inverterMppts.length - 1}
              onSelect={() => onSelectMppt(mppt.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ElectricalTree() {
  const {
    inverters,
    selectedInverterId,
    selectInverterOnly,
  } = useInverterSelection();
  const { selectedMpptId, selectMpptOnly } = useMpptSelection();
  const { strings, mppts } = useElectricalStore();
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const isExpanded = useMemo(() => {
    const next = new Set(expandedIds);
    if (selectedInverterId) next.add(selectedInverterId);
    if (selectedMpptId) {
      const mppt = mppts.find((m) => m.id === selectedMpptId);
      if (mppt?.inverterId) next.add(mppt.inverterId);
    }
    return next;
  }, [expandedIds, selectedInverterId, selectedMpptId, mppts]);

  const toggleExpand = (inverterId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(inverterId)) next.delete(inverterId);
      else next.add(inverterId);
      return next;
    });
  };

  if (!inverters.length) {
    return (
      <div className="flex flex-col gap-2">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Inverter & MPPTs</span>
        <p className="text-[11px] text-[#4a5c75] leading-relaxed px-1">
          No inverter selected. Choose one from the catalog above.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Inverter & MPPTs</span>

      <div className="flex flex-col gap-2">
        {inverters.map((inverter) => {
          const inverterMppts = mpptsForInverter(mppts, inverter);
          const expanded = isExpanded.has(inverter.id);
          const isInverterSelected = selectedInverterId === inverter.id && !selectedMpptId;

          return (
            <InverterTreeItem
              key={inverter.id}
              inverter={inverter}
              inverterMppts={inverterMppts}
              strings={strings}
              isInverterSelected={isInverterSelected}
              selectedMpptId={selectedMpptId}
              isExpanded={expanded}
              onToggleExpand={() => toggleExpand(inverter.id)}
              onSelectInverter={selectInverterOnly}
              onSelectMppt={selectMpptOnly}
            />
          );
        })}
      </div>
    </div>
  );
}
