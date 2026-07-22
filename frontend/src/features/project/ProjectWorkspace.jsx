/**
 * ProjectWorkspace.jsx — Step 10 Project Summary (read-only engineering overview).
 *
 * Aggregates completed design results for review. No CRM, proposal, or business workflows.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { FiCheck, FiClock, FiMapPin } from "react-icons/fi";

import { DataRow, SEC_LABEL, StaleDesignBanner } from "../steps/panelUtils";
import {
  buildCrmDashboardSummary,
  fmtInr, fmtKwh, fmtPct, fmtYears, fmtKw,
} from "./crmDashboardSummary";
import {
  ENGINEERING_MILESTONES,
  DEFAULT_PROJECT_META,
} from "./projectWorkspaceConfig";
import {
  loadConsultantNotes,
  saveConsultantNotes,
  formatDisplayDate,
} from "./projectWorkspaceStorage";
import { moduleLabelForId } from "../panels/panelLayoutSummary";
import { DEFAULT_PROJECT_NAME } from "../../config/headerConfig";

function DashboardCard({ title, subtitle, children, className = "" }) {
  return (
    <section
      className={`flex flex-col gap-4 p-6 rounded-2xl border border-[#23324A]/80 bg-[rgba(16,27,45,0.92)] shadow-[0_8px_32px_rgba(0,0,0,0.35)] ${className}`}
    >
      {(title || subtitle) && (
        <div>
          {title && (
            <h3 className="text-[11px] font-bold tracking-[0.18em] text-[#94A3B8] uppercase">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-1 text-[12px] text-[#4a5c75]">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function HeroKpi({ label, value, accent = "text-[#F8FAFC]" }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-5 rounded-2xl border border-[#23324A]/70 bg-[rgba(7,17,32,0.55)] shadow-[0_4px_24px_rgba(0,0,0,0.25)] min-w-0">
      <span className="text-[10px] font-bold tracking-[0.16em] text-[#94A3B8] uppercase truncate">
        {label}
      </span>
      <span className={`text-[22px] sm:text-[26px] font-bold leading-tight tabular-nums truncate ${accent}`}>
        {value}
      </span>
    </div>
  );
}

function fmtAreaM2(v) {
  if (v == null || Number.isNaN(v) || v <= 0) return null;
  return `${v.toFixed(1)} m²`;
}

function buildDesignSummaryRows(roofSections = [], panelLayout = null) {
  const rows = [];

  const roofCount = roofSections.length;
  if (roofCount > 0) {
    rows.push({ label: "Roof Count", value: String(roofCount) });
  }

  const roofAreaM2 = roofSections.reduce((sum, s) => sum + (s.areaM2 ?? 0), 0);
  const roofArea = fmtAreaM2(roofAreaM2);
  if (roofArea) rows.push({ label: "Roof Area", value: roofArea });

  const usableAreaM2 = roofSections.reduce(
    (sum, s) => sum + (s.usableAreaM2 ?? 0),
    0,
  );
  const usableArea = fmtAreaM2(usableAreaM2);
  if (usableArea) rows.push({ label: "Usable Area", value: usableArea });

  const placedPanels = panelLayout?.placedPanels ?? [];
  if (placedPanels.length > 0) {
    const moduleId = placedPanels[0]?.panelTypeId;
    if (moduleId) {
      rows.push({ label: "Panel Model", value: moduleLabelForId(moduleId) });
    }
  }

  return rows;
}

export default function ProjectWorkspace({
  location = {},
  roofSections = [],
  panelLayout = null,
  energyResult = null,
  costResult = null,
  savingsResult = null,
  roiResult = null,
  coverageResult = null,
  installedSystemKw = 0,
  projectMeta = DEFAULT_PROJECT_META,
  onPatchMeta = () => {},
  isStaleDesign = false,
  onUpdateDesign = null,
  isUpdatingDesign = false,
}) {
  const [notes, setNotes] = useState("");

  const projectId = projectMeta.projectId;

  useEffect(() => {
    setNotes(loadConsultantNotes(projectId));
  }, [projectId]);

  const patchMeta = onPatchMeta;

  const handleNotesChange = useCallback((text) => {
    setNotes(text);
    saveConsultantNotes(projectId, text);
    patchMeta({});
  }, [projectId, patchMeta]);

  const summary = useMemo(
    () => buildCrmDashboardSummary({
      panelLayout,
      energyResult,
      costResult,
      savingsResult,
      roiResult,
      coverageResult,
      installedSystemKw,
    }),
    [
      panelLayout,
      energyResult,
      costResult,
      savingsResult,
      roiResult,
      coverageResult,
      installedSystemKw,
    ],
  );

  const designSummaryRows = useMemo(
    () => buildDesignSummaryRows(roofSections, panelLayout),
    [roofSections, panelLayout],
  );

  const { hero, financial } = summary;

  const projectName = projectMeta.projectName || DEFAULT_PROJECT_NAME;
  const projectAddress = location?.address || "—";
  const designStatus = hero.projectStatus;

  return (
    <div className="h-full overflow-y-auto panel-scroll">
      <div className="w-full max-w-[1400px] mx-auto px-6 lg:px-8 py-6 flex flex-col gap-8">

        <StaleDesignBanner
          show={isStaleDesign}
          onUpdateDesign={onUpdateDesign}
          isUpdatingDesign={isUpdatingDesign}
          compact
        />

        {/* ── Project header ── */}
        <header className="flex flex-col gap-5">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] text-[#94A3B8] uppercase mb-2">
              Project Summary
            </p>
            <h1 className="text-[28px] sm:text-[32px] font-bold text-[#F8FAFC] leading-tight">
              {projectName}
            </h1>
            <p className="mt-2 flex items-start gap-2 text-[13px] text-[#94A3B8] max-w-xl">
              <FiMapPin size={14} className="shrink-0 mt-0.5" />
              {projectAddress}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
            {[
              { label: "Created", value: formatDisplayDate(projectMeta.createdDate) },
              { label: "Last Updated", value: formatDisplayDate(projectMeta.lastUpdated) },
              { label: "Design Status", value: designStatus },
            ].map(({ label, value }) => (
              <div key={label} className="px-3 py-2.5 rounded-lg bg-[rgba(7,17,32,0.4)] border border-[#23324A]/50">
                <span className="text-[#94A3B8] block text-[9px] uppercase tracking-wider">{label}</span>
                <span className="text-[#F8FAFC] font-medium mt-0.5 block truncate">{value}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ── Project metrics ── */}
        <section className="flex flex-col gap-4">
          <h2 className={SEC_LABEL}>Project Metrics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
            <HeroKpi label="Installed Capacity" value={fmtKw(hero.installedCapacityKw)} accent="text-[#4F8CFF]" />
            <HeroKpi label="Panel Count" value={String(hero.panelCount)} />
            <HeroKpi label="Annual Production" value={fmtKwh(hero.annualProductionKwh)} accent="text-[#00E38C]" />
            <HeroKpi label="Annual Savings" value={fmtInr(hero.annualSavingsInr)} accent="text-[#00E38C]" />
            <HeroKpi label="Coverage" value={fmtPct(hero.coverage)} accent="text-[#4F8CFF]" />
            <HeroKpi label="ROI" value={hero.roiPercent != null ? `${hero.roiPercent.toFixed(1)}%` : "—"} accent="text-[#FFB547]" />
            <HeroKpi label="Payback" value={fmtYears(hero.paybackYears)} accent="text-[#FFB547]" />
          </div>
        </section>

        {/* ── Design + Financial summaries ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardCard title="Design Summary" subtitle="Engineering configuration">
            {designSummaryRows.length > 0 ? (
              <div className="rounded-xl border border-[#23324A]/60 overflow-hidden">
                {designSummaryRows.map((row, i) => (
                  <DataRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    isLast={i === designSummaryRows.length - 1}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-[#4a5c75]">No design data available yet.</p>
            )}
          </DashboardCard>

          <DashboardCard title="Financial Summary" subtitle="From Step 8 analysis">
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-[#23324A]/60 overflow-hidden">
                <DataRow label="Gross Cost" value={fmtInr(financial.grossCost)} />
                <DataRow label="Net Cost" value={fmtInr(financial.netCost)} />
                <DataRow label="Annual Savings" value={fmtInr(financial.annualSavings)} />
                <DataRow label="Lifetime Savings" value={fmtInr(financial.lifetimeSavings)} isLast />
              </div>
              <div className="rounded-xl border border-[#23324A]/60 overflow-hidden">
                <DataRow label="ROI" value={financial.roiPercent != null ? `${financial.roiPercent.toFixed(1)}%` : "—"} />
                <DataRow label="Payback" value={fmtYears(financial.paybackYears)} />
                <DataRow
                  label="Break-even"
                  value={financial.breakEvenYear != null ? `Year ${financial.breakEvenYear}` : "—"}
                />
                <DataRow
                  label="Net Lifetime Profit"
                  value={fmtInr(financial.netLifetimeProfit)}
                  isLast
                />
              </div>
            </div>
          </DashboardCard>
        </div>

        {/* ── Engineering progress ── */}
        <DashboardCard title="Engineering Progress" subtitle="Completed workflow">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ENGINEERING_MILESTONES.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#00E38C]/20 bg-[#00E38C]/5"
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-[#00E38C]/20 text-[#00E38C]">
                  <FiCheck size={11} />
                </div>
                <span className="text-[12px] text-[#F8FAFC]">{m.label}</span>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* ── Engineering notes ── */}
        <DashboardCard title="Engineering Notes" subtitle="Saved locally in your browser">
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Design observations, site constraints, installation notes…"
            rows={8}
            className="w-full px-4 py-3 rounded-xl bg-[rgba(7,17,32,0.6)] border border-[#23324A] text-[13px] text-[#F8FAFC] placeholder:text-[#4a5c75] outline-none focus:border-[#4F8CFF] resize-y min-h-[180px] leading-relaxed"
          />
          <p className="text-[10px] text-[#4a5c75] flex items-center gap-1.5">
            <FiClock size={11} />
            Persists after refresh · no backend sync
          </p>
        </DashboardCard>

      </div>
    </div>
  );
}
