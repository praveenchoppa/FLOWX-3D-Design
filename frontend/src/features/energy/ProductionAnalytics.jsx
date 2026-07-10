/**
 * ProductionAnalytics — Step 7C read-only production dashboard.
 *
 * Visualizes energyResult from 7B only. No energy calculations here.
 */
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { SEC_LABEL, DIVIDER, KpiCard } from "../steps/panelUtils";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CHART = {
  primary:   "#4F8CFF",
  success:   "#00E38C",
  warning:   "#FFB547",
  grid:      "#23324A",
  axis:      "#4a5c75",
  tooltipBg: "#101B2D",
  tooltipBd: "#23324A",
};

const ARRAY_BAR_COLORS = ["#4F8CFF", "#00E38C", "#FFB547", "#94A3B8", "#6366f1", "#22d3ee"];

function fmtKwh(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Math.round(v).toLocaleString()} kWh`;
}

function fmtPct(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
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

function MonthlyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg border shadow-lg text-[11px]"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBd }}
    >
      <p className="text-[#94A3B8] mb-1">{label}</p>
      <p className="text-[#F8FAFC] font-semibold tabular-nums">
        {Math.round(payload[0].value).toLocaleString()} kWh
      </p>
    </div>
  );
}

function ArrayTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg border shadow-lg text-[11px]"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBd }}
    >
      <p className="text-[#F8FAFC] font-medium mb-1">{row.name}</p>
      <p className="text-[#00E38C] tabular-nums">{Math.round(row.annualEnergy).toLocaleString()} kWh/yr</p>
      <p className="text-[#94A3B8] mt-0.5">
        {row.systemKw.toFixed(2)} kW · {fmtPct(row.solarAccess, 0)} access
      </p>
    </div>
  );
}

function MetricBar({ label, value, color = CHART.primary, format = "pct" }) {
  const pctWidth = format === "pct"
    ? Math.max(0, Math.min(100, value * 100))
    : Math.max(0, Math.min(100, value * 100));

  const display = format === "pct" ? fmtPct(value) : `${(value * 100).toFixed(1)}%`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#94A3B8] truncate">{label}</span>
        <span className="text-[11px] font-semibold text-[#F8FAFC] tabular-nums shrink-0">{display}</span>
      </div>
      <div className="h-2 rounded-full bg-[#23324A] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pctWidth}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function ProductionAnalytics({ energyResult }) {
  const monthlyChartData = useMemo(
    () => MONTH_LABELS.map((month, i) => ({
      month,
      kwh: energyResult.monthlyEnergy[i] ?? 0,
    })),
    [energyResult.monthlyEnergy],
  );

  const sortedArrays = useMemo(
    () => [...energyResult.arrays].sort((a, b) => b.annualEnergy - a.annualEnergy),
    [energyResult.arrays],
  );

  const arrayChartData = useMemo(
    () => sortedArrays.map((arr) => ({
      name: arr.displayName ?? arr.id,
      annualEnergy: arr.annualEnergy,
      systemKw: arr.systemKw,
      solarAccess: arr.solarAccess,
    })),
    [sortedArrays],
  );

  const peakMonthIdx = useMemo(() => {
    let best = 0;
    monthlyChartData.forEach((d, i) => {
      if (d.kwh > monthlyChartData[best].kwh) best = i;
    });
    return best;
  }, [monthlyChartData]);

  const arrayBarHeight = Math.max(160, sortedArrays.length * 44);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-[9px] font-bold tracking-[0.2em] text-[#00E38C] uppercase">
            Production Analytics
          </span>
          <p className="text-[10px] text-[#4a5c75] mt-1">
            Source: Estimated (NASA) · {energyResult.systemKw?.toFixed(2)} kWp installed
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          label="Annual Production"
          value={fmtKwh(energyResult.annualEnergy)}
          accent="text-[#00E38C]"
        />
        <KpiCard
          label="Specific Yield"
          value={`${Math.round(energyResult.specificYield).toLocaleString()} kWh/kWp`}
          accent="text-[#FFB547]"
        />
        <KpiCard
          label="Capacity Factor"
          value={fmtPct(energyResult.capacityFactor)}
          accent="text-[#4F8CFF]"
        />
        <KpiCard
          label="Performance Ratio"
          value={fmtPct(energyResult.performanceRatio)}
          accent="text-[#F8FAFC]"
        />
      </div>

      {DIVIDER}

      {/* Monthly production — chart + table (two-column on large panels) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Monthly Production" subtitle="kWh per calendar month from energyResult">
          <div className="w-full min-w-0" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
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
                <Tooltip content={<MonthlyTooltip />} cursor={{ fill: "rgba(79,140,255,0.08)" }} />
                <Bar dataKey="kwh" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {monthlyChartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === peakMonthIdx ? CHART.success : CHART.primary}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Monthly Breakdown" subtitle="Jan – Dec production values">
          <div className="rounded-xl border border-[#23324A] overflow-hidden">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-px bg-[#23324A]/40">
              {MONTH_LABELS.map((month, i) => (
                <div
                  key={month}
                  className="flex flex-col items-center gap-1 px-2 py-2.5 bg-[rgba(7,17,32,0.6)]"
                >
                  <span className="text-[9px] font-semibold text-[#4a5c75] uppercase">{month}</span>
                  <span className="text-[11px] font-semibold text-[#F8FAFC] tabular-nums">
                    {Math.round(energyResult.monthlyEnergy[i]).toLocaleString()}
                  </span>
                  <span className="text-[8px] text-[#4a5c75]">kWh</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {DIVIDER}

      {/* Array comparison — horizontal bars, sorted desc */}
      {sortedArrays.length > 0 && (
        <ChartCard
          title="Array Comparison"
          subtitle="Annual energy by array — largest first"
        >
          <div className="w-full min-w-0" style={{ height: arrayBarHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={arrayChartData}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: CHART.axis, fontSize: 10 }}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#94A3B8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip content={<ArrayTooltip />} cursor={{ fill: "rgba(79,140,255,0.06)" }} />
                <Bar dataKey="annualEnergy" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {arrayChartData.map((_, i) => (
                    <Cell key={i} fill={ARRAY_BAR_COLORS[i % ARRAY_BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1.5 mt-1">
            {sortedArrays.map((arr, i) => (
              <div key={arr.id} className="flex items-center justify-between text-[10px] text-[#4a5c75]">
                <span className="truncate text-[#94A3B8]">{arr.displayName ?? arr.id}</span>
                <span className="tabular-nums shrink-0 ml-2">
                  {arr.systemKw.toFixed(2)} kW · {fmtPct(arr.solarAccess, 0)} access
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {DIVIDER}

      {/* Performance metrics — gauges / horizontal bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="System Performance" subtitle="Design-wide metrics from energyResult">
          <div className="flex flex-col gap-4">
            <MetricBar
              label="Performance Ratio"
              value={energyResult.performanceRatio}
              color={CHART.primary}
            />
            <MetricBar
              label="Capacity Factor"
              value={energyResult.capacityFactor}
              color={CHART.success}
            />
          </div>
        </ChartCard>

        <ChartCard title="Solar Access by Array" subtitle="Step 4 measured exposure — per array">
          <div className="flex flex-col gap-3">
            {sortedArrays.length === 0 ? (
              <p className="text-[11px] text-[#4a5c75]">No arrays to display.</p>
            ) : (
              sortedArrays.map((arr, i) => (
                <MetricBar
                  key={arr.id}
                  label={arr.displayName ?? arr.id}
                  value={arr.solarAccess}
                  color={ARRAY_BAR_COLORS[i % ARRAY_BAR_COLORS.length]}
                />
              ))
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
