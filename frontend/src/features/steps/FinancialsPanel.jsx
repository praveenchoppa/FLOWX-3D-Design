/**
 * FinancialsPanel — Step 8: cost (8A) + savings (8B) + ROI (8C).
 *
 * Reads derived results only. Edits financialInputs only.
 * No cashflow chart (8D) or dashboard (8E).
 */
import { useMemo } from "react";
import { FiDollarSign, FiPercent, FiAlertCircle, FiTrendingUp, FiTarget, FiAlertTriangle } from "react-icons/fi";

import {
  PanelShell, PanelHeader, KpiCard, DataRow,
  InstructionList, DIVIDER, SEC_LABEL, StaleDesignBanner,
} from "./panelUtils";

import { PM_SURYA_GHAR_RESIDENTIAL } from "../financials/costConfig";
import { validateFinancialInputs } from "../financials/validateFinancialInputs";
import CashflowVisualization from "../financials/CashflowVisualization";
import ConsumptionCoverageAnalysis from "../consumption/ConsumptionCoverageAnalysis";

function fmtInr(amount) {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function fmtYears(v) {
  if (v == null || Number.isNaN(v)) return "> 25 yrs";
  return `${v.toFixed(1)} yrs`;
}

function InputAdvisory({ validation }) {
  if (!validation) return null;
  const isExtreme = validation.level === "extreme";
  return (
    <p
      className={`flex items-start gap-1.5 text-[10px] leading-relaxed ${
        isExtreme ? "text-[#FFB547]" : "text-[#FFB547]/85"
      }`}
    >
      <FiAlertTriangle size={11} className="shrink-0 mt-0.5" />
      <span>{validation.message}</span>
    </p>
  );
}

export default function FinancialsPanel({
  financialInputs = {},
  onUpdateFinancialInputs = () => {},
  costResult = null,
  savingsResult = null,
  roiResult = null,
  consumptionInputs = {},
  onUpdateConsumptionInputs = () => {},
  consumptionResult = null,
  coverageResult = null,
  energyResult = null,
  isStaleDesign = false,
  onUpdateDesign = null,
  isUpdatingDesign = false,
}) {
  const systemKw = costResult?.systemKw ?? energyResult?.systemKw ?? 0;
  const hasSystem = systemKw > 0;

  const pill = hasSystem ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4F8CFF]/10 border border-[#4F8CFF]/25">
      <FiDollarSign size={10} className="text-[#4F8CFF]" />
      <span className="text-[10px] font-semibold text-[#4F8CFF]">
        {systemKw.toFixed(2)} kWp
      </span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#94A3B8]/10 border border-[#94A3B8]/25">
      <span className="text-[10px] font-semibold text-[#94A3B8]">No system</span>
    </div>
  );

  const subsidyOn = financialInputs.subsidyEnabled ?? false;
  const usingOverride =
    financialInputs.manualSubsidyOverride != null &&
    financialInputs.manualSubsidyOverride !== "";

  const patch = (updates) => onUpdateFinancialInputs(updates);

  const inputValidation = useMemo(
    () => validateFinancialInputs(financialInputs),
    [financialInputs],
  );

  return (
    <PanelShell>
      <PanelHeader
        label="Financials"
        subtitle="System cost, subsidy & savings"
        pill={pill}
      />

      <StaleDesignBanner
        show={isStaleDesign}
        onUpdateDesign={onUpdateDesign}
        isUpdatingDesign={isUpdatingDesign}
      />

      {DIVIDER}

      {!hasSystem && (
        <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-[#FFB547]/8 border border-[#FFB547]/25">
          <FiAlertCircle size={14} className="text-[#FFB547] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            Place panels in Step 6 to size the system. Cost is computed from installed
            kWp × cost per watt.
          </p>
        </div>
      )}

      {hasSystem && costResult && (
        <>
          <div className="flex flex-col gap-2 px-3 py-4 rounded-xl bg-[#4F8CFF]/8 border border-[#4F8CFF]/30">
            <span className="text-[9px] font-bold tracking-[0.2em] text-[#4F8CFF] uppercase">
              Cost Summary
            </span>
            <div className="flex gap-2">
              <KpiCard
                label="Gross Cost"
                value={fmtInr(costResult.grossCost)}
                accent="text-[#F8FAFC]"
              />
              <KpiCard
                label="Subsidy"
                value={fmtInr(costResult.subsidyAmount)}
                accent="text-[#00E38C]"
              />
            </div>
            <KpiCard
              label="Net Cost"
              value={fmtInr(costResult.netCost)}
              accent="text-[#FFB547]"
            />
            <p className="text-[10px] text-[#94A3B8] leading-relaxed">
              {systemKw.toFixed(2)} kWp × ₹{Number(financialInputs.costPerWatt ?? 0).toLocaleString("en-IN")}/W
              {usingOverride
                ? " · manual subsidy override active"
                : subsidyOn
                ? ` · ${PM_SURYA_GHAR_RESIDENTIAL.label}`
                : " · no subsidy applied"}
            </p>
          </div>

          {DIVIDER}

          <div className="flex flex-col gap-3">
            <span className={SEC_LABEL} style={{ marginBottom: 0 }}>
              Cost Parameters
            </span>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#94A3B8]">Cost per watt (₹/W)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={financialInputs.costPerWatt ?? ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  patch({ costPerWatt: Number.isFinite(v) ? v : 0 });
                }}
                className="w-full text-[13px] text-[#F8FAFC] bg-[rgba(7,17,32,0.6)] border border-[#23324A] rounded-xl px-3 py-2.5 outline-none focus:border-[#4F8CFF] transition-colors tabular-nums"
              />
              <InputAdvisory validation={inputValidation.costPerWatt} />
              <p className="text-[9px] text-[#4a5c75]">
                Gross = {systemKw.toFixed(2)} kW × 1,000 × ₹/W
              </p>
            </div>

            <DataRow
              label="Currency"
              value={financialInputs.currency ?? "INR"}
            />
          </div>

          {DIVIDER}

          <div className="flex flex-col gap-3">
            <span className={SEC_LABEL} style={{ marginBottom: 0 }}>
              Subsidy
            </span>

            <button
              type="button"
              onClick={() => patch({ subsidyEnabled: !subsidyOn })}
              className={`flex items-center justify-between gap-3 w-full px-3 py-3 rounded-xl border text-left transition-all duration-150 ${
                subsidyOn && !usingOverride
                  ? "bg-[#00E38C]/10 border-[#00E38C]/35"
                  : "bg-[rgba(7,17,32,0.4)] border-[#23324A] hover:border-[#2a3850]"
              }`}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] font-medium text-[#F8FAFC]">
                  Apply PM Surya Ghar subsidy (residential)
                </span>
                <span className="text-[9px] text-[#4a5c75] leading-relaxed">
                  ₹30,000/kW (first 2 kW) · ₹18,000/kW (3rd kW) · cap ₹78,000
                </span>
              </div>
              <div
                className={`shrink-0 w-10 h-5 rounded-full relative transition-colors ${
                  subsidyOn && !usingOverride ? "bg-[#00E38C]" : "bg-[#23324A]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    subsidyOn && !usingOverride ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#94A3B8] flex items-center gap-1">
                <FiPercent size={10} />
                Manual subsidy override (₹)
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                placeholder="Auto from scheme"
                value={financialInputs.manualSubsidyOverride ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  patch({
                    manualSubsidyOverride: raw === "" ? null : parseFloat(raw) || 0,
                  });
                }}
                className="w-full text-[13px] text-[#F8FAFC] bg-[rgba(7,17,32,0.6)] border border-[#23324A] rounded-xl px-3 py-2.5 outline-none focus:border-[#4F8CFF] transition-colors tabular-nums placeholder:text-[#4a5c75]"
              />
              <p className="text-[9px] text-[#4a5c75]">
                Leave blank to use PM Surya Ghar slabs. Override replaces calculated subsidy.
              </p>
            </div>

            {subsidyOn && !usingOverride && (
              <div className="px-3 py-2.5 rounded-xl bg-[rgba(7,17,32,0.5)] border border-[#23324A]">
                <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                  At {systemKw.toFixed(2)} kWp: estimated subsidy{" "}
                  <span className="text-[#00E38C] font-semibold">
                    {fmtInr(costResult.subsidyAmount)}
                  </span>
                  {systemKw >= 3 && (
                    <span className="text-[#4a5c75]"> (cap ₹78,000 reached)</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {savingsResult && energyResult && (
            <>
              {DIVIDER}

              <div className="flex flex-col gap-2 px-3 py-4 rounded-xl bg-[#00E38C]/8 border border-[#00E38C]/30">
                <span className="text-[9px] font-bold tracking-[0.2em] text-[#00E38C] uppercase flex items-center gap-1">
                  <FiTrendingUp size={10} />
                  Savings Summary
                </span>
                <div className="flex gap-2">
                  <KpiCard
                    label="Monthly Savings"
                    value={fmtInr(
                      savingsResult.monthlySavings.reduce((s, v) => s + v, 0) / 12,
                    )}
                    accent="text-[#F8FAFC]"
                  />
                  <KpiCard
                    label="Annual Savings"
                    value={fmtInr(savingsResult.annualSavings)}
                    accent="text-[#00E38C]"
                  />
                </div>
                <KpiCard
                  label="Lifetime Savings"
                  value={fmtInr(savingsResult.lifetimeSavings)}
                  accent="text-[#FFB547]"
                />
                <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                  Year 1 at ₹{savingsResult.tariffPerUnit}/kWh · 25-year projection with{" "}
                  {(savingsResult.tariffEscalation * 100).toFixed(1)}% tariff escalation and{" "}
                  {(savingsResult.panelDegradation * 100).toFixed(1)}% panel degradation.
                </p>
              </div>

              {DIVIDER}

              <div className="flex flex-col gap-3">
                <span className={SEC_LABEL} style={{ marginBottom: 0 }}>
                  Tariff Parameters
                </span>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[#94A3B8]">Tariff (₹ / kWh)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={financialInputs.tariffPerUnit ?? ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      patch({ tariffPerUnit: Number.isFinite(v) ? v : 0 });
                    }}
                    className="w-full text-[13px] text-[#F8FAFC] bg-[rgba(7,17,32,0.6)] border border-[#23324A] rounded-xl px-3 py-2.5 outline-none focus:border-[#4F8CFF] transition-colors tabular-nums"
                  />
                  <InputAdvisory validation={inputValidation.tariffPerUnit} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[#94A3B8]">Tariff escalation (% / year)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={
                      financialInputs.tariffEscalation != null
                        ? (financialInputs.tariffEscalation * 100).toFixed(1)
                        : ""
                    }
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      patch({ tariffEscalation: Number.isFinite(v) ? v / 100 : 0 });
                    }}
                    className="w-full text-[13px] text-[#F8FAFC] bg-[rgba(7,17,32,0.6)] border border-[#23324A] rounded-xl px-3 py-2.5 outline-none focus:border-[#4F8CFF] transition-colors tabular-nums"
                  />
                  <InputAdvisory validation={inputValidation.tariffEscalation} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[#94A3B8]">Panel degradation (% / year)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={
                      financialInputs.panelDegradation != null
                        ? (financialInputs.panelDegradation * 100).toFixed(1)
                        : ""
                    }
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      patch({ panelDegradation: Number.isFinite(v) ? v / 100 : 0 });
                    }}
                    className="w-full text-[13px] text-[#F8FAFC] bg-[rgba(7,17,32,0.6)] border border-[#23324A] rounded-xl px-3 py-2.5 outline-none focus:border-[#4F8CFF] transition-colors tabular-nums"
                  />
                  <InputAdvisory validation={inputValidation.panelDegradation} />
                  <p className="text-[9px] text-[#4a5c75]">
                    Year N savings = energy × (1 − degradation)^(N−1) × tariff × (1 + escalation)^(N−1)
                  </p>
                </div>
              </div>

              {roiResult && costResult && (
                <>
                  {DIVIDER}

                  <div className="flex flex-col gap-2 px-3 py-4 rounded-xl bg-[#4F8CFF]/8 border border-[#4F8CFF]/30">
                    <span className="text-[9px] font-bold tracking-[0.2em] text-[#4F8CFF] uppercase flex items-center gap-1">
                      <FiTarget size={10} />
                      Return on Investment
                    </span>
                    <div className="flex gap-2">
                      <KpiCard
                        label="Payback Period"
                        value={fmtYears(roiResult.paybackYears)}
                        accent="text-[#FFB547]"
                      />
                      <KpiCard
                        label="ROI (25 yr)"
                        value={`${roiResult.roiPercent.toFixed(1)}%`}
                        accent="text-[#00E38C]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <KpiCard
                        label="Net Lifetime Profit"
                        value={fmtInr(roiResult.netLifetimeProfit)}
                        accent="text-[#F8FAFC]"
                      />
                      <KpiCard
                        label="Break-even Year"
                        value={
                          roiResult.breakEvenYear != null
                            ? `Year ${roiResult.breakEvenYear}`
                            : "> 25"
                        }
                        accent="text-[#94A3B8]"
                      />
                    </div>
                    <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                      Based on net cost {fmtInr(costResult.netCost)} vs lifetime savings{" "}
                      {fmtInr(savingsResult.lifetimeSavings)} · avg{" "}
                      {roiResult.avgAnnualRoi.toFixed(1)}% ROI / year.
                    </p>
                  </div>

                  {DIVIDER}
                  <CashflowVisualization
                    costResult={costResult}
                    savingsResult={savingsResult}
                    roiResult={roiResult}
                  />
                </>
              )}
            </>
          )}
        </>
      )}

      {hasSystem && !savingsResult && energyResult == null && (
        <>
          {DIVIDER}
          <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-[#94A3B8]/8 border border-[#94A3B8]/20">
            <FiAlertCircle size={14} className="text-[#94A3B8] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Complete Step 7 energy production (panels + shadow analysis) to compute savings.
            </p>
          </div>
        </>
      )}

      {DIVIDER}

      <ConsumptionCoverageAnalysis
        consumptionInputs={consumptionInputs}
        onUpdateConsumptionInputs={onUpdateConsumptionInputs}
        financialInputs={financialInputs}
        consumptionResult={consumptionResult}
        coverageResult={coverageResult}
        energyResult={energyResult}
      />

      {DIVIDER}

      <InstructionList items={[
        "Gross cost = installed kWp × 1,000 × cost per watt (₹/W)",
        "PM Surya Ghar residential subsidy uses 2026 slab rates with ₹78,000 cap",
        "Savings = energy × tariff; 25-year projection applies escalation and degradation",
        "Payback and ROI use cumulative savings vs net cost",
        "Cashflow chart reads roiResult.cumulativeSavings — no duplicate calculations",
        "Customer usage & coverage are informational — savings and ROI stay generation-based",
      ]} />
    </PanelShell>
  );
}
