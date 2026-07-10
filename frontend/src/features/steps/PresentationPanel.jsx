/**
 * PresentationPanel — Step 9: read-only client presentation summary.
 *
 * Consumes verified result objects only. No calculations beyond display formatting.
 */
import { useMemo } from "react";
import {
  FiCheck, FiEye, FiFileText, FiUsers, FiZap, FiSun, FiTrendingUp,
} from "react-icons/fi";

import {
  PanelShell, PanelHeader, KpiCard, DataRow,
  DIVIDER, SEC_LABEL, StaleDesignBanner,
} from "./panelUtils";

function fmtKwh(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Math.round(v).toLocaleString()} kWh`;
}

function fmtPct(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

function fmtInr(amount) {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function fmtYears(v) {
  if (v == null || Number.isNaN(v)) return "> 25 yrs";
  return `${v.toFixed(1)} yrs`;
}

function fmtKw(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(2)} kW`;
}

function nasaResourceLabel(solarResource) {
  if (!solarResource) return "—";
  if (solarResource.source === "nasa") return "NASA POWER";
  if (solarResource.source === "fallback") {
    return solarResource.fallbackProfileId
      ? `Estimated (${solarResource.fallbackProfileId})`
      : "Estimated";
  }
  return "Estimated";
}

function weightedAvgSolarAccess(energyResult) {
  if (!energyResult?.arrays?.length || !energyResult.systemKw) return null;
  const sum = energyResult.arrays.reduce(
    (s, a) => s + (a.solarAccess ?? 0) * (a.systemKw ?? 0),
    0,
  );
  return sum / energyResult.systemKw;
}

function GlassSection({ title, icon: Icon, children, accent = "#4F8CFF" }) {
  return (
    <section className="flex flex-col gap-4 px-4 py-5 rounded-2xl bg-[rgba(7,17,32,0.55)] border border-[#23324A]/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        {Icon && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${accent}18`, border: `1px solid ${accent}33` }}
          >
            <Icon size={14} style={{ color: accent }} />
          </div>
        )}
        <h3 className="text-[11px] font-bold tracking-[0.18em] text-[#94A3B8] uppercase">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function StatusItem({ label, done = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
          done ? "bg-[#00E38C]/15 border border-[#00E38C]/35" : "bg-[#23324A]/50 border border-[#23324A]"
        }`}
      >
        {done && <FiCheck size={11} className="text-[#00E38C]" />}
      </div>
      <span className={`text-[12px] ${done ? "text-[#F8FAFC]" : "text-[#94A3B8]"}`}>
        {label}
      </span>
    </div>
  );
}

function PlaceholderAction({ icon: Icon, label }) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-[#23324A]/70 bg-[rgba(7,17,32,0.45)] text-[#94A3B8]/60 text-[11px] font-medium cursor-not-allowed select-none"
    >
      <Icon size={13} />
      <span>{label}</span>
    </button>
  );
}

export default function PresentationPanel({
  panelArrays         = [],
  selectedArrayId     = null,
  onSelectArray       = () => {},
  panelLayout         = null,
  energyResult        = null,
  solarResource       = null,
  costResult          = null,
  savingsResult       = null,
  roiResult           = null,
  consumptionResult   = null,
  coverageResult      = null,
  isStaleDesign       = false,
  onUpdateDesign      = null,
  isUpdatingDesign    = false,
  committedPanelLayout = null,
  committedPanelArrays = null,
}) {
  const displayLayout = isStaleDesign && committedPanelLayout
    ? committedPanelLayout
    : panelLayout;
  const displayArrays = isStaleDesign && committedPanelArrays
    ? committedPanelArrays
    : panelArrays;

  const totalPanels = useMemo(() => {
    if (displayLayout?.placedPanels?.length) return displayLayout.placedPanels.length;
    return displayArrays.reduce((s, a) => s + (a.panelCount ?? 0), 0);
  }, [displayLayout, displayArrays]);

  const selectedArrayMeta = useMemo(() => {
    if (!selectedArrayId) return null;
    const array = displayArrays.find((a) => a.id === selectedArrayId);
    const energy = energyResult?.arrays?.find((a) => a.id === selectedArrayId);
    if (!array) return null;

    const arrayCoverage =
      consumptionResult?.annualConsumption > 0 && energy?.annualEnergy != null
        ? energy.annualEnergy / consumptionResult.annualConsumption
        : null;

    return { array, energy, arrayCoverage };
  }, [selectedArrayId, displayArrays, energyResult, consumptionResult]);

  const avgSolarAccess = useMemo(
    () => weightedAvgSolarAccess(energyResult),
    [energyResult],
  );

  const hasSystem = (energyResult?.systemKw ?? 0) > 0;

  const pill = hasSystem ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00E38C]/10 border border-[#00E38C]/25">
      <FiEye size={10} className="text-[#00E38C]" />
      <span className="text-[10px] font-semibold text-[#00E38C]">Presentation</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#94A3B8]/10 border border-[#94A3B8]/25">
      <span className="text-[10px] font-semibold text-[#94A3B8]">Preview</span>
    </div>
  );

  return (
    <PanelShell>
      <div className="flex flex-col gap-6">
      <PanelHeader
        label="Presentation"
        subtitle="Client-ready design summary"
        pill={pill}
      />

      <StaleDesignBanner
        show={isStaleDesign}
        onUpdateDesign={onUpdateDesign}
        isUpdatingDesign={isUpdatingDesign}
      />

      {DIVIDER}

      {!hasSystem && (
        <div className="px-4 py-4 rounded-2xl bg-[#FFB547]/8 border border-[#FFB547]/25 text-[12px] text-[#94A3B8] leading-relaxed">
          Complete panel placement and analysis in earlier steps to populate this presentation.
        </div>
      )}

      {selectedArrayMeta && (
        <>
          <div className="flex flex-col gap-3 px-4 py-5 rounded-2xl bg-[#FFB547]/8 border border-[#FFB547]/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[9px] font-bold tracking-[0.2em] text-[#FFB547] uppercase">
                  Selected Array
                </span>
                <p className="mt-1 text-[20px] font-bold text-[#F8FAFC] leading-tight">
                  {selectedArrayMeta.array.displayName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectArray(null)}
                className="text-[10px] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors shrink-0"
              >
                Clear
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <KpiCard
                label="Panel Count"
                value={String(selectedArrayMeta.array.panelCount ?? "—")}
                accent="text-[#F8FAFC]"
              />
              <KpiCard
                label="Capacity"
                value={fmtKw(selectedArrayMeta.array.systemKw)}
                accent="text-[#FFB547]"
              />
              <KpiCard
                label="Annual Production"
                value={fmtKwh(selectedArrayMeta.energy?.annualEnergy)}
                accent="text-[#00E38C]"
              />
              <KpiCard
                label="Solar Access"
                value={fmtPct(selectedArrayMeta.energy?.solarAccess, 0)}
                accent="text-[#4F8CFF]"
              />
            </div>
            <div className="rounded-xl border border-[#23324A]/60 overflow-hidden">
              <DataRow
                label="Coverage"
                value={fmtPct(selectedArrayMeta.arrayCoverage)}
                isLast
              />
            </div>
            <p className="text-[10px] text-[#4a5c75] leading-relaxed">
              Click any panel in the view to highlight an array. Click empty space to reset.
            </p>
          </div>
          {DIVIDER}
        </>
      )}

      <GlassSection title="System Overview" icon={FiZap}>
        <div className="flex flex-col gap-1 px-1">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[36px] font-bold text-[#4F8CFF] leading-none tabular-nums">
              {energyResult?.systemKw != null ? energyResult.systemKw.toFixed(2) : "—"}
            </span>
            <span className="text-[15px] text-[#4F8CFF]/70 font-medium">kWp installed</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <KpiCard label="Total Panels" value={String(totalPanels)} accent="text-[#F8FAFC]" />
          <KpiCard
            label="Annual Production"
            value={fmtKwh(energyResult?.annualEnergy)}
            accent="text-[#00E38C]"
          />
          <KpiCard
            label="Annual Consumption"
            value={fmtKwh(consumptionResult?.annualConsumption)}
            accent="text-[#F8FAFC]"
          />
          <KpiCard
            label="Annual Coverage"
            value={fmtPct(coverageResult?.annualCoverage)}
            accent="text-[#4F8CFF]"
          />
        </div>
      </GlassSection>

      {DIVIDER}

      <GlassSection title="Financial Summary" icon={FiTrendingUp} accent="#00E38C">
        <div className="grid grid-cols-2 gap-2">
          <KpiCard
            label="Gross Cost"
            value={fmtInr(costResult?.grossCost)}
            accent="text-[#F8FAFC]"
          />
          <KpiCard
            label="Net Cost"
            value={fmtInr(costResult?.netCost)}
            accent="text-[#4F8CFF]"
          />
          <KpiCard
            label="Annual Savings"
            value={fmtInr(savingsResult?.annualSavings)}
            accent="text-[#00E38C]"
          />
          <KpiCard
            label="Lifetime Savings"
            value={fmtInr(savingsResult?.lifetimeSavings)}
            accent="text-[#00E38C]"
          />
          <KpiCard
            label="Payback"
            value={fmtYears(roiResult?.paybackYears)}
            accent="text-[#FFB547]"
          />
          <KpiCard
            label="ROI"
            value={roiResult?.roiPercent != null ? `${roiResult.roiPercent.toFixed(1)}%` : "—"}
            accent="text-[#FFB547]"
          />
        </div>
      </GlassSection>

      {DIVIDER}

      <GlassSection title="Customer Summary" icon={FiUsers} accent="#6366f1">
        <div className="rounded-xl border border-[#23324A]/60 overflow-hidden">
          <DataRow
            label="Self Consumption"
            value={fmtKwh(coverageResult?.annualSelfConsumption)}
          />
          <DataRow
            label="Grid Import"
            value={fmtKwh(coverageResult?.annualImport)}
          />
          <DataRow
            label="Grid Export"
            value={fmtKwh(coverageResult?.annualExport)}
            isLast
          />
        </div>
      </GlassSection>

      {DIVIDER}

      <GlassSection title="Engineering Quality" icon={FiSun} accent="#FFB547">
        <div className="rounded-xl border border-[#23324A]/60 overflow-hidden">
          <DataRow
            label="Average Solar Access"
            value={fmtPct(avgSolarAccess, 0)}
          />
          <DataRow
            label="Performance Ratio"
            value={fmtPct(energyResult?.performanceRatio)}
          />
          <DataRow
            label="Capacity Factor"
            value={fmtPct(energyResult?.capacityFactor)}
          />
          <DataRow
            label="NASA Resource"
            value={nasaResourceLabel(solarResource)}
            isLast
          />
        </div>
      </GlassSection>

      {DIVIDER}

      <section className="flex flex-col gap-4 px-4 py-5 rounded-2xl bg-[rgba(0,227,140,0.06)] border border-[#00E38C]/20">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Presentation Status</span>
        <div className="flex flex-col gap-2.5">
          <StatusItem label="Engineering Complete" />
          <StatusItem label="Energy Analysis Complete" />
          <StatusItem label="Financial Analysis Complete" />
          <StatusItem label="Customer Analysis Complete" />
        </div>
        <p className="text-[13px] font-semibold text-[#00E38C] pt-1">
          Ready for Client Presentation
        </p>
        <div className="flex gap-2 pt-1">
          <PlaceholderAction icon={FiEye} label="Preview Proposal" />
          <PlaceholderAction icon={FiFileText} label="Generate Proposal" />
          <PlaceholderAction icon={FiUsers} label="Continue to CRM" />
        </div>
      </section>
      </div>
    </PanelShell>
  );
}
