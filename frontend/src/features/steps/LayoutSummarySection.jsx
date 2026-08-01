/**
 * LayoutSummarySection.jsx — Engineering layout summary (presentation only).
 */
import { useEffect, useState } from "react";
import { FiAlertCircle, FiChevronDown, FiChevronRight } from "react-icons/fi";

import { KpiCard, SEC_LABEL } from "./panelUtils";
import {
  AREA_GENERATION_STATUS,
  AREA_GENERATION_STATUS_LABEL,
  AREA_LAYOUT_STATUS,
  AREA_LAYOUT_STATUS_LABEL,
  formatMountTypeLabel,
} from "../panels/panelLayoutSummary";

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[10px]">
      <span className="text-[#94A3B8] shrink-0">{label}</span>
      <span className="text-[#F8FAFC] text-right tabular-nums">{value}</span>
    </div>
  );
}

function formatCapacityDiff(diffKw) {
  if (diffKw == null) return "—";
  if (diffKw === 0) return "0.0 kW";
  const sign = diffKw > 0 ? "+" : "";
  return `${sign}${diffKw.toFixed(2)} kW`;
}

function cardHeaderStyle(area) {
  if (area.syncStatus === AREA_GENERATION_STATUS.REGENERATION_REQUIRED) {
    return { text: "text-[#FFB547]", border: "border-[#FFB547]/30", bg: "bg-[#FFB547]/8" };
  }
  if (area.syncStatus === AREA_GENERATION_STATUS.UP_TO_DATE) {
    if (area.capacityStatus === AREA_LAYOUT_STATUS.ACHIEVED) {
      return { text: "text-[#00E38C]", border: "border-[#00E38C]/30", bg: "bg-[#00E38C]/8" };
    }
    if (area.capacityStatus === AREA_LAYOUT_STATUS.LIMITED) {
      return { text: "text-[#FFB547]", border: "border-[#FFB547]/30", bg: "bg-[#FFB547]/8" };
    }
  }
  return { text: "text-[#94A3B8]", border: "border-[#23324A]", bg: "bg-[rgba(7,17,32,0.4)]" };
}

function headerBadgeLabel(area) {
  if (area.syncStatus === AREA_GENERATION_STATUS.REGENERATION_REQUIRED) {
    return AREA_GENERATION_STATUS_LABEL[AREA_GENERATION_STATUS.REGENERATION_REQUIRED];
  }
  if (area.syncStatus === AREA_GENERATION_STATUS.NOT_GENERATED) {
    return AREA_GENERATION_STATUS_LABEL[AREA_GENERATION_STATUS.NOT_GENERATED];
  }
  if (area.syncStatus === AREA_GENERATION_STATUS.UP_TO_DATE) {
    return AREA_LAYOUT_STATUS_LABEL[area.capacityStatus]
      ?? AREA_GENERATION_STATUS_LABEL[AREA_GENERATION_STATUS.UP_TO_DATE];
  }
  return "—";
}

function StaleAreaBody({ area }) {
  const current = area.currentLayout ?? {
    panelCount: area.panelCount,
    capacityKw: area.generatedCapacityKw,
    lastTargetKw: null,
    moduleLabel: area.moduleLabel,
    orientationLabel: area.orientationLabel,
  };
  const pending = area.pendingConfiguration;

  return (
    <div className="px-3 pb-3 pt-1 flex flex-col gap-3 border-t border-[#23324A]/40">
      <div className="flex items-start gap-2 px-2 py-2 rounded-lg bg-[#FFB547]/10 border border-[#FFB547]/25">
        <FiAlertCircle size={14} className="text-[#FFB547] shrink-0 mt-0.5" />
        <p className="text-[10px] text-[#94A3B8] leading-relaxed">
          Configuration changed. Regenerate to apply these changes.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-bold tracking-[0.14em] text-[#94A3B8] uppercase">
          Current Layout
        </span>
        <div className="grid grid-cols-2 gap-2">
          <KpiCard label="Current Panels" value={String(current.panelCount)} accent="text-[#F8FAFC]" />
          <KpiCard
            label="Current Capacity"
            value={`${current.capacityKw.toFixed(2)} kW`}
            accent="text-[#4F8CFF]"
          />
        </div>
        <div className="flex flex-col gap-1.5 px-1">
          {current.lastTargetKw != null && (
            <SummaryRow
              label="Target at Last Generation"
              value={`${current.lastTargetKw.toFixed(1)} kW`}
            />
          )}
          <SummaryRow label="Module" value={current.moduleLabel} />
          <SummaryRow label="Orientation" value={current.orientationLabel} />
        </div>
      </div>

      {pending && (
        <div className="flex flex-col gap-2">
          <span className="text-[9px] font-bold tracking-[0.14em] text-[#FFB547] uppercase">
            Pending Configuration
          </span>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard
              label="Target Capacity"
              value={`${pending.targetCapacityKw.toFixed(1)} kW`}
              accent="text-[#FFB547]"
            />
            {pending.requiredPanels != null && (
              <KpiCard
                label="Required Panels"
                value={String(pending.requiredPanels)}
                accent="text-[#F8FAFC]"
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5 px-1">
            <SummaryRow label="Module" value={pending.moduleLabel} />
            <SummaryRow label="Orientation" value={pending.orientationLabel} />
            <SummaryRow label="Tilt" value={`${pending.tilt ?? 0}°`} />
            <SummaryRow label="Mount Type" value={formatMountTypeLabel(pending.mountType)} />
          </div>
        </div>
      )}
    </div>
  );
}

function SyncedAreaBody({ area }) {
  return (
    <div className="px-3 pb-3 pt-1 flex flex-col gap-2 border-t border-[#23324A]/40">
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Current Panels" value={String(area.panelCount)} accent="text-[#F8FAFC]" />
        <KpiCard
          label="Generated Capacity"
          value={`${area.generatedCapacityKw.toFixed(2)} kW`}
          accent="text-[#4F8CFF]"
        />
        <KpiCard
          label="Target Capacity"
          value={`${area.targetCapacityKw.toFixed(1)} kW`}
          accent="text-[#FFB547]"
        />
        {area.capacityDiffKw != null && (
          <KpiCard
            label="Capacity Difference"
            value={formatCapacityDiff(area.capacityDiffKw)}
            accent={area.capacityDiffKw >= 0 ? "text-[#00E38C]" : "text-[#FFB547]"}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        <SummaryRow label="Module" value={area.moduleLabel} />
        <SummaryRow label="Orientation" value={area.orientationLabel} />
        <SummaryRow label="Tilt" value={`${area.tilt ?? 0}°`} />
        <SummaryRow label="Mount Type" value={formatMountTypeLabel(area.mountType)} />
        <SummaryRow label="Mount Height" value={`${(area.mountHeight ?? 0).toFixed(2)} m`} />
        {area.coveragePct != null && (
          <SummaryRow label="Coverage" value={`${area.coveragePct.toFixed(1)}%`} />
        )}
      </div>
    </div>
  );
}

function NotGeneratedAreaBody({ area }) {
  return (
    <div className="px-3 pb-3 pt-1 flex flex-col gap-2 border-t border-[#23324A]/40">
      <p className="text-[10px] text-[#94A3B8] leading-relaxed px-1">
        No layout generated for this area yet. Use Generate on the area card.
      </p>
      <div className="flex flex-col gap-1.5 px-1">
        <SummaryRow
          label="Configured Target"
          value={`${area.targetCapacityKw.toFixed(1)} kW`}
        />
        <SummaryRow label="Module" value={area.moduleLabel} />
      </div>
    </div>
  );
}

function AreaSummaryCard({ area, expanded, onToggle }) {
  const style = cardHeaderStyle(area);

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#162338]/40 transition-colors"
      >
        {expanded
          ? <FiChevronDown size={14} className="text-[#94A3B8] shrink-0" />
          : <FiChevronRight size={14} className="text-[#94A3B8] shrink-0" />}
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-semibold text-[#F8FAFC] truncate block">
            {area.name}
          </span>
          <span className="text-[10px] text-[#64748B] tabular-nums">
            {area.panelCount} panels · {area.generatedCapacityKw.toFixed(2)} kW
          </span>
        </div>
        <span className={`text-[9px] font-semibold uppercase tracking-wide shrink-0 ${style.text}`}>
          {headerBadgeLabel(area)}
        </span>
      </button>

      {expanded && (
        area.syncStatus === AREA_GENERATION_STATUS.REGENERATION_REQUIRED
          ? <StaleAreaBody area={area} />
          : area.syncStatus === AREA_GENERATION_STATUS.NOT_GENERATED
            ? <NotGeneratedAreaBody area={area} />
            : <SyncedAreaBody area={area} />
      )}
    </div>
  );
}

export default function LayoutSummarySection({
  areaSummaries = [],
  projectSummary = null,
  selectedAreaId = null,
}) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  useEffect(() => {
    if (!selectedAreaId) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(selectedAreaId);
      return next;
    });
  }, [selectedAreaId]);

  const toggleArea = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!areaSummaries.length) return null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Layout Summary</span>
        <p className="text-[10px] text-[#4a5c75] leading-relaxed mt-1">
          Engineering summary per placement area — current roof layout vs pending configuration.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {areaSummaries.map((area) => (
          <AreaSummaryCard
            key={area.id}
            area={area}
            expanded={expandedIds.has(area.id)}
            onToggle={() => toggleArea(area.id)}
          />
        ))}
      </div>

      {projectSummary && (
        <div className="flex flex-col gap-3 px-3 py-3 rounded-xl bg-[#4F8CFF]/8 border border-[#4F8CFF]/25">
          <span className="text-[9px] font-bold tracking-[0.15em] text-[#4F8CFF] uppercase">
            Project Summary
          </span>
          {projectSummary.pendingAreaCount > 0 && (
            <p className="text-[10px] text-[#FFB547] leading-relaxed -mt-1">
              {projectSummary.pendingAreaCount} area
              {projectSummary.pendingAreaCount !== 1 ? "s have" : " has"}
              {" "}pending configuration changes.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <KpiCard
              label="Placement Areas"
              value={String(projectSummary.totalAreas)}
              accent="text-[#F8FAFC]"
            />
            <KpiCard
              label="Total Panels"
              value={String(projectSummary.totalPanels)}
              accent="text-[#F8FAFC]"
            />
            <KpiCard
              label="System Capacity"
              value={`${projectSummary.totalSystemCapacityKw.toFixed(2)} kW`}
              accent="text-[#4F8CFF]"
            />
            <KpiCard
              label="Overall Coverage"
              value={`${projectSummary.overallCoveragePct.toFixed(1)}%`}
              accent="text-[#00E38C]"
            />
          </div>
          <div className="flex flex-col gap-1.5 px-1">
            <SummaryRow
              label="Total Roof Area"
              value={`${projectSummary.totalRoofAreaM2.toFixed(1)} m²`}
            />
            <SummaryRow
              label="Total Used Area"
              value={`${projectSummary.totalUsedAreaM2.toFixed(1)} m²`}
            />
            {projectSummary.averageSolarScore != null && (
              <SummaryRow
                label="Average Solar Score"
                value={projectSummary.averageSolarScore.toFixed(1)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
