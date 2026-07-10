/**
 * ProjectWorkspace.jsx — Step 10 Project Workspace (Overview foundation).
 *
 * Read-only aggregation of engineering results + local CRM placeholders.
 * Not a full CRM, proposal engine, or backend integration.
 * Client presentation lives in Step 9 — not duplicated here.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FiCheck, FiFileText, FiShare2, FiArrowRight,
  FiClock, FiMapPin,
} from "react-icons/fi";

import { DataRow, SEC_LABEL, StaleDesignBanner } from "../steps/panelUtils";
import {
  buildCrmDashboardSummary,
  fmtInr, fmtKwh, fmtPct, fmtYears, fmtKw,
} from "./crmDashboardSummary";
import {
  WORKSPACE_TABS,
  LEAD_STATUS_OPTIONS,
  PROPOSAL_STATUS_OPTIONS,
  EPC_WORKFLOW_STAGES,
  ENGINEERING_MILESTONES,
  FUTURE_MILESTONES,
  PROPOSAL_CHECKLIST,
  QUICK_ACTIONS,
  DEFAULT_PROJECT_META,
} from "./projectWorkspaceConfig";
import {
  loadConsultantNotes,
  saveConsultantNotes,
  countNotes,
  formatDisplayDate,
} from "./projectWorkspaceStorage";
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

function ComingSoonButton({ label, icon: Icon }) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#23324A]/70 bg-[rgba(7,17,32,0.45)] text-[#94A3B8]/50 text-[12px] font-medium cursor-not-allowed select-none"
    >
      {Icon && <Icon size={14} />}
      <span>{label}</span>
      <span className="text-[9px] uppercase tracking-wider text-[#4a5c75]">Soon</span>
    </button>
  );
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
  const [activeTab] = useState("overview");
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

  const { hero, financial } = summary;

  const projectName = projectMeta.projectName || DEFAULT_PROJECT_NAME;

  const projectAddress = location?.address || "—";
  const notesCount = countNotes(notes);

  const leadStatusLabel = LEAD_STATUS_OPTIONS.find(
    (o) => o.value === projectMeta.leadStatus,
  )?.label ?? "Design Complete";

  const proposalStatusLabel = PROPOSAL_STATUS_OPTIONS.find(
    (o) => o.value === projectMeta.proposalStatus,
  )?.label ?? "Pending";

  return (
    <div className="h-full overflow-y-auto panel-scroll">
      <div className="w-full px-6 lg:px-8 py-6 flex flex-col gap-6">

        {/* ── Tab bar ── */}
        <nav className="flex items-center gap-1 p-1 rounded-2xl border border-[#23324A]/80 bg-[rgba(16,27,45,0.65)] w-fit">
          {WORKSPACE_TABS.map(({ id, label, enabled }) => (
            <button
              key={id}
              type="button"
              disabled={!enabled}
              title={enabled ? label : `${label} — Coming soon`}
              className={`px-5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                activeTab === id && enabled
                  ? "bg-[#4F8CFF] text-white shadow-sm"
                  : enabled
                  ? "text-[#94A3B8] hover:text-[#F8FAFC]"
                  : "text-[#94A3B8]/40 cursor-not-allowed"
              }`}
            >
              {label}
              {!enabled && (
                <span className="ml-1.5 text-[9px] uppercase tracking-wider opacity-60">
                  Soon
                </span>
              )}
            </button>
          ))}
        </nav>

        <StaleDesignBanner
          show={isStaleDesign}
          onUpdateDesign={onUpdateDesign}
          isUpdatingDesign={isUpdatingDesign}
          compact
        />

        {/* ── Project header ── */}
        <header className="flex flex-col gap-4 pb-2">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] text-[#94A3B8] uppercase mb-2">
                Project Workspace
              </p>
              <h1 className="text-[28px] sm:text-[32px] font-bold text-[#F8FAFC] leading-tight">
                {projectName}
              </h1>
              <p className="mt-2 flex items-start gap-2 text-[13px] text-[#94A3B8] max-w-xl">
                <FiMapPin size={14} className="shrink-0 mt-0.5" />
                {projectAddress}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="px-4 py-2 rounded-xl border border-[#23324A] bg-[rgba(7,17,32,0.5)]">
                <span className="text-[9px] text-[#94A3B8] uppercase tracking-wider block">Lead Status</span>
                <select
                  value={projectMeta.leadStatus}
                  onChange={(e) => patchMeta({ leadStatus: e.target.value })}
                  className="mt-1 bg-transparent text-[13px] font-semibold text-[#00E38C] outline-none cursor-pointer"
                >
                  {LEAD_STATUS_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value} className="bg-[#101B2D] text-[#F8FAFC]">
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="px-4 py-2 rounded-xl border border-[#23324A] bg-[rgba(7,17,32,0.5)]">
                <span className="text-[9px] text-[#94A3B8] uppercase tracking-wider block">Proposal Status</span>
                <select
                  value={projectMeta.proposalStatus}
                  onChange={(e) => patchMeta({ proposalStatus: e.target.value })}
                  className="mt-1 bg-transparent text-[13px] font-semibold text-[#FFB547] outline-none cursor-pointer"
                >
                  {PROPOSAL_STATUS_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value} className="bg-[#101B2D] text-[#F8FAFC]">
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-[11px]">
            {[
              { label: "Project ID", value: projectId ?? "—" },
              { label: "Customer", value: projectMeta.customerName || "—" },
              { label: "Consultant", value: projectMeta.consultantName || "—" },
              { label: "Created", value: formatDisplayDate(projectMeta.createdDate) },
              { label: "Last Updated", value: formatDisplayDate(projectMeta.lastUpdated) },
              { label: "Lead Stage", value: leadStatusLabel },
            ].map(({ label, value }) => (
              <div key={label} className="px-3 py-2 rounded-lg bg-[rgba(7,17,32,0.4)] border border-[#23324A]/50">
                <span className="text-[#94A3B8] block text-[9px] uppercase tracking-wider">{label}</span>
                <span className="text-[#F8FAFC] font-medium mt-0.5 block truncate">{value}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ── EPC workflow strip ── */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 rounded-2xl border border-[#23324A]/60 bg-[rgba(7,17,32,0.45)]">
          {EPC_WORKFLOW_STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium ${
                  stage.complete
                    ? "bg-[#00E38C]/12 border border-[#00E38C]/30 text-[#00E38C]"
                    : "bg-[#23324A]/30 border border-[#23324A]/50 text-[#94A3B8]/50"
                }`}
              >
                {stage.complete && <FiCheck size={12} />}
                {stage.label}
              </div>
              {i < EPC_WORKFLOW_STAGES.length - 1 && (
                <FiArrowRight size={12} className="text-[#4a5c75] hidden sm:block" />
              )}
            </div>
          ))}
        </div>

        {/* ── Hero KPI strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          <HeroKpi label="Installed Capacity" value={fmtKw(hero.installedCapacityKw)} accent="text-[#4F8CFF]" />
          <HeroKpi label="Panel Count" value={String(hero.panelCount)} />
          <HeroKpi label="Annual Production" value={fmtKwh(hero.annualProductionKwh)} accent="text-[#00E38C]" />
          <HeroKpi label="Annual Savings" value={fmtInr(hero.annualSavingsInr)} accent="text-[#00E38C]" />
          <HeroKpi label="Coverage" value={fmtPct(hero.coverage)} accent="text-[#4F8CFF]" />
          <HeroKpi label="ROI" value={hero.roiPercent != null ? `${hero.roiPercent.toFixed(1)}%` : "—"} accent="text-[#FFB547]" />
          <HeroKpi label="Payback" value={fmtYears(hero.paybackYears)} accent="text-[#FFB547]" />
          <HeroKpi label="Project Status" value={hero.projectStatus} accent="text-[#00E38C]" />
        </div>

        {/* ── Financial Snapshot — full width ── */}
        <DashboardCard title="Financial Snapshot" subtitle="From Step 8 analysis">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* ── Customer + Progress ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardCard title="Customer Information" subtitle="Read-only · CRM integration coming soon">
            <div className="rounded-xl border border-[#23324A]/60 overflow-hidden">
              <DataRow label="Customer Name" value={projectMeta.customerName || "—"} />
              <DataRow label="Phone" value={projectMeta.phone || "—"} />
              <DataRow label="Email" value={projectMeta.email || "—"} />
              <DataRow label="Address" value={projectAddress} />
              <DataRow label="Lead Status" value={leadStatusLabel} />
              <DataRow label="Proposal Status" value={proposalStatusLabel} />
              <DataRow label="Notes Count" value={String(notesCount)} isLast />
            </div>
          </DashboardCard>

          <DashboardCard title="Project Progress" subtitle="Engineering workflow complete">
            <div className="flex flex-col gap-2">
              {ENGINEERING_MILESTONES.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                    m.current
                      ? "border-[#4F8CFF]/40 bg-[#4F8CFF]/8"
                      : m.complete
                      ? "border-[#00E38C]/20 bg-[#00E38C]/5"
                      : "border-[#23324A]/40 bg-transparent"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      m.complete ? "bg-[#00E38C]/20 text-[#00E38C]" : "bg-[#23324A] text-[#94A3B8]"
                    }`}
                  >
                    {m.complete ? <FiCheck size={11} /> : <span className="text-[9px]">{m.id}</span>}
                  </div>
                  <span className={`text-[12px] ${m.current ? "text-[#4F8CFF] font-semibold" : "text-[#F8FAFC]"}`}>
                    {m.label}
                    {m.current && " (current)"}
                  </span>
                </div>
              ))}
              <div className="mt-2 pt-3 border-t border-[#23324A]/50">
                <span className={SEC_LABEL}>Upcoming</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {FUTURE_MILESTONES.map((label) => (
                    <span
                      key={label}
                      className="px-2.5 py-1 rounded-full text-[10px] text-[#94A3B8]/50 border border-[#23324A]/40"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </DashboardCard>
        </div>

        {/* ── Proposal + Notes ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardCard title="Proposal Status" subtitle="Checklist read-only · status editable in header">
            <div className="flex flex-col gap-2">
              {PROPOSAL_CHECKLIST.map(({ label, done }) => (
                <div key={label} className="flex items-center gap-3 py-1.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      done ? "bg-[#00E38C]/15 text-[#00E38C]" : "bg-[#23324A]/50 text-[#94A3B8]/40"
                    }`}
                  >
                    {done ? <FiCheck size={11} /> : null}
                  </div>
                  <span className={`text-[12px] ${done ? "text-[#F8FAFC]" : "text-[#94A3B8]/60"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard title="Consultant Notes" subtitle="Saved locally in your browser">
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Site visit notes, client preferences, follow-up actions…"
              rows={10}
              className="w-full px-4 py-3 rounded-xl bg-[rgba(7,17,32,0.6)] border border-[#23324A] text-[13px] text-[#F8FAFC] placeholder:text-[#4a5c75] outline-none focus:border-[#4F8CFF] resize-y min-h-[220px] leading-relaxed"
            />
            <p className="text-[10px] text-[#4a5c75] flex items-center gap-1.5">
              <FiClock size={11} />
              Persists after refresh · no backend sync
            </p>
          </DashboardCard>
        </div>

        {/* ── Quick actions ── */}
        <DashboardCard title="Quick Actions" subtitle="Future business modules">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map((label) => (
              <ComingSoonButton
                key={label}
                label={label}
                icon={label.includes("Share") ? FiShare2 : FiFileText}
              />
            ))}
          </div>
        </DashboardCard>

      </div>
    </div>
  );
}
