/**
 * CashflowVisualization — Step 8D read-only cashflow chart & journey.
 *
 * Renders costResult, savingsResult, roiResult only. No financial calculations.
 */
import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from "recharts";

import { SEC_LABEL, DIVIDER } from "../steps/panelUtils";

const CHART = {
  primary:   "#4F8CFF",
  success:   "#00E38C",
  warning:   "#FFB547",
  grid:      "#23324A",
  axis:      "#4a5c75",
  tooltipBg: "#101B2D",
  tooltipBd: "#23324A",
};

function fmtInr(amount) {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function fmtInrCompact(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const n = Math.round(v);
  if (Math.abs(n) >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `₹${(n / 1_000).toFixed(0)}k`;
  return `₹${n}`;
}

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-3 px-3 py-4 rounded-xl bg-[rgba(7,17,32,0.45)] border border-[#23324A] min-w-0 ${className}`}>
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

function CashflowTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg border shadow-lg text-[11px]"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBd }}
    >
      <p className="text-[#94A3B8] mb-1">{label}</p>
      <p className="text-[#00E38C] font-semibold tabular-nums">
        {fmtInr(payload[0].value)}
      </p>
    </div>
  );
}

function SummaryCard({ label, value, accent = "text-[#F8FAFC]" }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl bg-[rgba(7,17,32,0.55)] border border-[#23324A] text-center min-w-0">
      <span className="text-[9px] font-bold tracking-[0.18em] text-[#94A3B8] uppercase">
        {label}
      </span>
      <span className={`text-xl sm:text-2xl font-bold tabular-nums ${accent}`}>
        {value}
      </span>
    </div>
  );
}

function JourneyStep({ title, value, sub, accent }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0 flex-1 px-2 text-center">
      <span className="text-[9px] font-bold tracking-[0.15em] text-[#4a5c75] uppercase">
        {title}
      </span>
      <span className={`text-sm sm:text-base font-semibold tabular-nums ${accent}`}>
        {value}
      </span>
      {sub && (
        <span className="text-[9px] text-[#94A3B8] leading-snug">{sub}</span>
      )}
    </div>
  );
}

export default function CashflowVisualization({
  costResult = null,
  savingsResult = null,
  roiResult = null,
}) {
  const chartData = useMemo(
    () =>
      (roiResult?.cumulativeSavings ?? []).map(({ year, value }) => ({
        year,
        cumulative: value,
        label: `Year ${year}`,
      })),
    [roiResult?.cumulativeSavings],
  );

  const breakEvenPoint = useMemo(() => {
    if (!roiResult?.breakEvenYear || !chartData.length) return null;
    return chartData.find((d) => d.year === roiResult.breakEvenYear) ?? null;
  }, [chartData, roiResult?.breakEvenYear]);

  if (!costResult || !savingsResult || !roiResult || !chartData.length) return null;

  const paybackLabel =
    roiResult.paybackYears != null
      ? `Break-even · ${roiResult.paybackYears.toFixed(1)} yrs`
      : "Break-even";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="text-[9px] font-bold tracking-[0.2em] text-[#4F8CFF] uppercase">
          Cashflow
        </span>
        <p className="text-[10px] text-[#4a5c75] mt-1">
          25-year cumulative savings from roiResult — read-only visualization
        </p>
      </div>

      {DIVIDER}

      {/* Section 1 + 2 — cumulative chart with break-even marker */}
      <ChartCard
        title="25-Year Cashflow"
        subtitle="Cumulative savings (₹) · Year 1 → Year 25"
      >
        <div className="w-full min-w-0" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 16, right: 12, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: CHART.axis, fontSize: 10 }}
                axisLine={{ stroke: CHART.grid }}
                tickLine={false}
                tickFormatter={(y) => (y % 5 === 0 || y === 1 ? `Y${y}` : "")}
              />
              <YAxis
                tick={{ fill: CHART.axis, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={fmtInrCompact}
              />
              <Tooltip content={<CashflowTooltip />} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} />
              {roiResult.breakEvenYear != null && (
                <ReferenceLine
                  x={roiResult.breakEvenYear}
                  stroke={CHART.warning}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{
                    value: paybackLabel,
                    position: "top",
                    fill: CHART.warning,
                    fontSize: 10,
                  }}
                />
              )}
              <ReferenceLine
                y={costResult.netCost}
                stroke={CHART.axis}
                strokeDasharray="3 3"
                strokeOpacity={0.6}
                label={{
                  value: "Net investment",
                  position: "insideTopRight",
                  fill: CHART.axis,
                  fontSize: 9,
                }}
              />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke={CHART.success}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: CHART.success, stroke: "#071120", strokeWidth: 2 }}
              />
              {breakEvenPoint && (
                <ReferenceDot
                  x={breakEvenPoint.year}
                  y={breakEvenPoint.cumulative}
                  r={6}
                  fill={CHART.warning}
                  stroke="#071120"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {roiResult.breakEvenYear != null && (
          <p className="text-[10px] text-[#94A3B8]">
            Payback at{" "}
            <span className="text-[#FFB547] font-medium">
              {roiResult.paybackYears?.toFixed(1)} years
            </span>
            {" "}(break-even year {roiResult.breakEvenYear}) · net cost{" "}
            {fmtInr(costResult.netCost)}
          </p>
        )}
      </ChartCard>

      {DIVIDER}

      {/* Section 3 — investment journey timeline */}
      <ChartCard title="Investment Journey" subtitle="Initial outlay → break-even → lifetime return">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2 py-2">
          <JourneyStep
            title="Initial Investment"
            value={fmtInr(costResult.netCost)}
            sub="Net cost after subsidy"
            accent="text-[#FFB547]"
          />
          <div className="hidden sm:flex flex-col items-center shrink-0 px-1 text-[#23324A]">
            <span className="text-lg">→</span>
          </div>
          <div className="flex sm:hidden items-center justify-center text-[#23324A] py-0.5">
            <span className="text-lg rotate-90 sm:rotate-0">→</span>
          </div>
          <JourneyStep
            title="Break-even"
            value={
              roiResult.paybackYears != null
                ? `${roiResult.paybackYears.toFixed(1)} yrs`
                : "> 25 yrs"
            }
            sub={
              roiResult.breakEvenYear != null
                ? `Year ${roiResult.breakEvenYear}`
                : "Not within projection"
            }
            accent="text-[#4F8CFF]"
          />
          <div className="hidden sm:flex flex-col items-center shrink-0 px-1 text-[#23324A]">
            <span className="text-lg">→</span>
          </div>
          <div className="flex sm:hidden items-center justify-center text-[#23324A] py-0.5">
            <span className="text-lg rotate-90 sm:rotate-0">→</span>
          </div>
          <JourneyStep
            title="25-Year Lifetime Profit"
            value={fmtInr(roiResult.netLifetimeProfit)}
            sub={`${fmtInr(savingsResult.lifetimeSavings)} total savings`}
            accent="text-[#00E38C]"
          />
        </div>
      </ChartCard>

      {DIVIDER}

      {/* Section 4 — financial summary cards */}
      <div className="flex flex-col gap-3">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Financial Summary</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard
            label="Net Investment"
            value={fmtInr(costResult.netCost)}
            accent="text-[#FFB547]"
          />
          <SummaryCard
            label="Lifetime Savings"
            value={fmtInr(savingsResult.lifetimeSavings)}
            accent="text-[#4F8CFF]"
          />
          <SummaryCard
            label="Net Lifetime Profit"
            value={fmtInr(roiResult.netLifetimeProfit)}
            accent="text-[#00E38C]"
          />
        </div>
      </div>
    </div>
  );
}
