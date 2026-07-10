/**
 * ConsumptionCoverageAnalysis — Step 8E customer usage & coverage (read-only charts).
 *
 * Parallel to financial engines — informational only.
 */
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { SEC_LABEL, DIVIDER, KpiCard } from "../steps/panelUtils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CHART = {
  primary:   "#4F8CFF",
  success:   "#00E38C",
  warning:   "#FFB547",
  muted:     "#94A3B8",
  grid:      "#23324A",
  axis:      "#4a5c75",
  tooltipBg: "#101B2D",
  tooltipBd: "#23324A",
};

function fmtKwh(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Math.round(v).toLocaleString()} kWh`;
}

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="flex flex-col gap-3 px-3 py-4 rounded-xl bg-[rgba(7,17,32,0.45)] border border-[#23324A] min-w-0">
      <div>
        <span className={SEC_LABEL} style={{ marginBottom: 2 }}>{title}</span>
        {subtitle && (
          <p className="text-[10px] text-[#4a5c75] leading-relaxed">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function EnergyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg border shadow-lg text-[11px]"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBd }}
    >
      <p className="text-[#94A3B8] mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="tabular-nums" style={{ color: p.color }}>
          {p.name}: {Math.round(p.value).toLocaleString()} kWh
        </p>
      ))}
    </div>
  );
}

function CoverageTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg border shadow-lg text-[11px]"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBd }}
    >
      <p className="text-[#94A3B8] mb-1">{label}</p>
      <p className="text-[#FFB547] font-semibold tabular-nums">
        {(payload[0].value * 100).toFixed(1)}% coverage
      </p>
    </div>
  );
}

export default function ConsumptionCoverageAnalysis({
  consumptionInputs = {},
  onUpdateConsumptionInputs = () => {},
  financialInputs = {},
  consumptionResult = null,
  coverageResult = null,
  energyResult = null,
}) {
  const tariff = financialInputs.tariffPerUnit ?? 0;
  const patch = (updates) => onUpdateConsumptionInputs(updates);
  const isBill = consumptionInputs.inputMode !== "units";

  const estimatedUnits =
    isBill && tariff > 0 && consumptionInputs.monthlyBill
      ? Number(consumptionInputs.monthlyBill) / tariff
      : null;

  const compareChartData = useMemo(() => {
    if (!energyResult?.monthlyEnergy || !consumptionResult?.monthlyConsumption) return [];
    return MONTHS.map((month, i) => ({
      month,
      production: energyResult.monthlyEnergy[i] ?? 0,
      consumption: consumptionResult.monthlyConsumption[i] ?? 0,
    }));
  }, [energyResult?.monthlyEnergy, consumptionResult?.monthlyConsumption]);

  const coverageChartData = useMemo(() => {
    if (!coverageResult?.monthlyCoverage) return [];
    return MONTHS.map((month, i) => ({
      month,
      coverage: coverageResult.monthlyCoverage[i] ?? 0,
    }));
  }, [coverageResult?.monthlyCoverage]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[9px] font-bold tracking-[0.2em] text-[#FFB547] uppercase">
            Customer Electricity Usage
          </span>
          <p className="text-[10px] text-[#4a5c75] mt-1">
            Demand vs solar production — informational only (does not affect savings or ROI)
          </p>
        </div>
        {coverageResult && (
          <span className="shrink-0 px-2 py-1 rounded-full bg-[#FFB547]/10 border border-[#FFB547]/30 text-[9px] font-semibold text-[#FFB547] uppercase tracking-wide">
            {coverageResult.coverageSource}
          </span>
        )}
      </div>

      {DIVIDER}

      <div className="flex flex-col gap-3">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Input Method</span>
        <div className="flex gap-2">
          {[
            { id: "bill", label: "Monthly Bill (₹)" },
            { id: "units", label: "Monthly Units (kWh)" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => patch({ inputMode: id })}
              className={`flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl border text-[11px] font-medium transition-all duration-150 ${
                (id === "bill") === isBill
                  ? "bg-[#4F8CFF]/15 border-[#4F8CFF]/40 text-[#F8FAFC]"
                  : "bg-[rgba(7,17,32,0.4)] border-[#23324A] text-[#94A3B8] hover:border-[#2a3850]"
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                  (id === "bill") === isBill
                    ? "border-[#4F8CFF] bg-[#4F8CFF]"
                    : "border-[#4a5c75]"
                }`}
              />
              {label}
            </button>
          ))}
        </div>

        {isBill ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#94A3B8]">Monthly Bill (₹)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={consumptionInputs.monthlyBill ?? ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                patch({ monthlyBill: Number.isFinite(v) ? v : 0 });
              }}
              className="w-full text-[13px] text-[#F8FAFC] bg-[rgba(7,17,32,0.6)] border border-[#23324A] rounded-xl px-3 py-2.5 outline-none focus:border-[#4F8CFF] transition-colors tabular-nums"
            />
            {estimatedUnits != null && tariff > 0 && (
              <p className="text-[10px] text-[#94A3B8]">
                ≈ {Math.round(estimatedUnits).toLocaleString()} kWh/month at ₹{tariff}/kWh
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#94A3B8]">Average Monthly Units (kWh)</label>
            <input
              type="number"
              min={0}
              step={10}
              value={consumptionInputs.averageMonthlyUnits ?? ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                patch({ averageMonthlyUnits: Number.isFinite(v) ? v : 0 });
              }}
              className="w-full text-[13px] text-[#F8FAFC] bg-[rgba(7,17,32,0.6)] border border-[#23324A] rounded-xl px-3 py-2.5 outline-none focus:border-[#4F8CFF] transition-colors tabular-nums"
            />
          </div>
        )}
      </div>

      {consumptionResult && coverageResult && energyResult && (
        <>
          {DIVIDER}

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            <KpiCard label="Annual Consumption" value={fmtKwh(consumptionResult.annualConsumption)} />
            <KpiCard
              label="Avg Monthly Consumption"
              value={fmtKwh(consumptionResult.averageMonthlyConsumption)}
            />
            <KpiCard
              label="Annual Coverage"
              value={fmtPct(coverageResult.annualCoverage)}
              accent="text-[#FFB547]"
            />
            <KpiCard
              label="Annual Self Consumption"
              value={fmtKwh(coverageResult.annualSelfConsumption)}
              accent="text-[#00E38C]"
            />
            <KpiCard
              label="Annual Export"
              value={fmtKwh(coverageResult.annualExport)}
              accent="text-[#4F8CFF]"
            />
            <KpiCard
              label="Annual Import"
              value={fmtKwh(coverageResult.annualImport)}
              accent="text-[#94A3B8]"
            />
          </div>

          <p className="text-[10px] text-[#4a5c75] leading-relaxed px-1">
            Import and export are estimated using a monthly net approximation — not utility-grade
            billing. Real import/export requires hourly consumption and net-metering rules.
          </p>

          {DIVIDER}

          <div className="flex flex-col gap-4">
            <ChartCard
              title="Production vs Consumption"
              subtitle="Monthly solar production vs customer demand (kWh)"
            >
              <div className="w-full min-w-0" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareChartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: CHART.axis, fontSize: 10 }}
                      axisLine={{ stroke: CHART.grid }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: CHART.axis, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={42}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                    />
                    <Tooltip content={<EnergyTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 10, color: CHART.muted }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar dataKey="production" name="Production" fill={CHART.success} radius={[3, 3, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="consumption" name="Consumption" fill={CHART.muted} radius={[3, 3, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Coverage %" subtitle="Production ÷ consumption · Jan → Dec">
              <div className="w-full min-w-0" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={coverageChartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: CHART.axis, fontSize: 10 }}
                      axisLine={{ stroke: CHART.grid }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: CHART.axis, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={42}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      domain={[0, "auto"]}
                    />
                    <Tooltip content={<CoverageTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="coverage"
                      stroke={CHART.warning}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: CHART.warning, stroke: "#071120", strokeWidth: 1 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </>
      )}

      {!energyResult && (
        <p className="text-[10px] text-[#94A3B8] px-1">
          Complete Step 7 energy production to compare against customer demand.
        </p>
      )}
    </div>
  );
}
