/**
 * SimulationPanel — Step 4A right-hand panel.
 *
 * Drives the solar simulation that lives in the 3D scene: date presets + custom
 * date, a daylight time slider, play/pause/reset with speed, and a live
 * "current moment" stats block (Date / Time / Sun Altitude / Sun Azimuth).
 *
 * All sun math is computed upstream in DesignStudio (single source of truth) and
 * passed in as `sun` + `dayTimes`; this panel only renders controls and reads
 * those values.  Built from shared panelUtils primitives (decision 9).
 *
 * Instantaneous only — accumulated shadow %/area is Step 4B, not here.
 */
import { FiGrid, FiLoader, FiZap, FiLayers } from "react-icons/fi";

import {
  PanelShell,
  PanelHeader,
  KpiCard,
  InstructionList,
  DIVIDER,
  SEC_LABEL,
} from "./panelUtils";

import { formatDate } from "../simulation/solar";
import SimulationControls from "../simulation/SimulationControls";
import { scoreBand, scoreBandColor } from "../simulation/exposureScore";

export default function SimulationPanel({
  roofSections = [],
  location = {},
  view3D,
  setView3D,
  // Simulation state (lifted to DesignStudio)
  simDay,
  setSimDay,
  simMinutes,
  setSimMinutes,
  simPlaying,
  setSimPlaying,
  simSpeed,
  setSimSpeed,
  // Computed sun state
  sun = null,
  dayTimes = null,
  // Shadow heatmap (Step 4B-1)
  shadowResult = null,
  shadowRunning = false,
  runShadowAnalysis = () => {},
  canRunShadow = false,
  // Exposure score (Step 4C)
  exposureResult = null,
  heatmapMode = "shade",
  setHeatmapMode = () => {},
}) {
  const hasLocation = location?.lat != null;
  const belowHorizon = sun?.belowHorizon ?? false;

  // ── Header status pill ──────────────────────────────────────────────────────
  const pill = !hasLocation ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#94A3B8]/10 border border-[#94A3B8]/25">
      <span className="text-[10px] font-semibold text-[#94A3B8]">No location</span>
    </div>
  ) : belowHorizon ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFB547]/10 border border-[#FFB547]/25">
      <div className="w-1.5 h-1.5 rounded-full bg-[#FFB547]" />
      <span className="text-[10px] font-semibold text-[#FFB547]">Sun Down</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00E38C]/10 border border-[#00E38C]/25">
      <div className="w-1.5 h-1.5 rounded-full bg-[#00E38C]" />
      <span className="text-[10px] font-semibold text-[#00E38C]">Sun Up</span>
    </div>
  );

  return (
    <PanelShell>

      {/* ── Header ────────────────────────────────── */}
      <PanelHeader
        label="Simulation"
        subtitle="Solar Position & Real-Time Shadows"
        pill={pill}
      />

      {DIVIDER}

      <SimulationControls
        location={location}
        sun={sun}
        dayTimes={dayTimes}
        simDay={simDay}
        setSimDay={setSimDay}
        simMinutes={simMinutes}
        setSimMinutes={setSimMinutes}
        simPlaying={simPlaying}
        setSimPlaying={setSimPlaying}
        simSpeed={simSpeed}
        setSimSpeed={setSimSpeed}
        view3D={view3D}
        setView3D={setView3D}
        roofSections={roofSections}
        showView3DNotice
      />

      <p className="text-[10px] text-[#4a5c75] leading-relaxed -mt-2">
        Instantaneous sun position for this moment. The measured per-cell shade
        across the whole day is below.
      </p>

      {DIVIDER}

      {/* ── Shadow analysis (4B) — measured per-cell shade ────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Shadow Analysis</span>
          <span className="text-[9px] text-[#4a5c75]">Measured · 30-min steps</span>
        </div>

        <button
          onClick={runShadowAnalysis}
          disabled={!canRunShadow || shadowRunning}
          className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 ${
            !canRunShadow
              ? "bg-[#23324A]/40 text-[#94A3B8]/40 cursor-not-allowed"
              : shadowRunning
              ? "bg-[#4F8CFF]/40 text-white/70 cursor-wait"
              : "bg-[#4F8CFF] text-white hover:brightness-110"
          }`}
        >
          {shadowRunning ? (
            <><FiLoader size={14} className="animate-spin" /><span>Analyzing…</span></>
          ) : (
            <><FiGrid size={14} /><span>{shadowResult ? "Re-run Shadow Analysis" : "Run Shadow Analysis"}</span></>
          )}
        </button>

        {shadowResult ? (
          <>
            {/* ── Heatmap view toggle (shade / score / zone) ── */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-[rgba(7,17,32,0.6)] border border-[#23324A]">
              {[
                { key: "shade", label: "Shade %",    icon: <FiGrid   size={11} /> },
                { key: "score", label: "Exp. Score", icon: <FiZap    size={11} /> },
                { key: "zone",  label: "Zones",      icon: <FiLayers size={11} /> },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setHeatmapMode(key)}
                  className={`flex items-center gap-1.5 flex-1 justify-center px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150 ${
                    heatmapMode === key
                      ? "bg-[#4F8CFF] text-white"
                      : "text-[#94A3B8] hover:text-[#F8FAFC]"
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {heatmapMode === "shade" ? (
              <>
                <div className="flex gap-2">
                  <KpiCard label="Avg Shade"   value={`${(shadowResult.summary.avg * 100).toFixed(0)}%`} />
                  <KpiCard label="Most Shade"  value={`${(shadowResult.summary.max * 100).toFixed(0)}%`} accent="text-[#ef4444]" />
                  <KpiCard label="Least Shade" value={`${(shadowResult.summary.min * 100).toFixed(0)}%`} accent="text-[#22c55e]" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-2 w-full rounded-full"
                    style={{ background: "linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)" }} />
                  <div className="flex items-center justify-between text-[9px] text-[#4a5c75]">
                    <span>Most sun (0 %)</span>
                    <span>Most shade (100 %)</span>
                  </div>
                </div>
                <p className="text-[10px] text-[#4a5c75] leading-relaxed">
                  {shadowResult.summary.count.toLocaleString()} cells · {shadowResult.steps} daylight steps
                  for {formatDate(shadowResult.day)}. Clearest in the Top view.
                </p>
              </>
            ) : exposureResult ? (
              <>
                <div className="flex gap-2">
                  <KpiCard label="Avg Score"  value={`${exposureResult.overallAvg}`} />
                  {exposureResult.best && (
                    <KpiCard label="Best Roof"  value={`${exposureResult.best.avgScore}`} accent="text-[#00E38C]" />
                  )}
                  {exposureResult.worst && (
                    <KpiCard label="Worst Roof" value={`${exposureResult.worst.avgScore}`} accent="text-[#EF4444]" />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-2 w-full rounded-full"
                    style={{ background: "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e)" }} />
                  <div className="flex items-center justify-between text-[9px] text-[#4a5c75]">
                    <span>Poor (0)</span>
                    <span>Excellent (100)</span>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <p className="text-[10px] text-[#4a5c75] leading-relaxed">
            Casts rays from each ~1 m roof cell toward the sun across the day to
            measure shade. Exposure score blends shade with roof orientation + tilt.
          </p>
        )}
      </div>

      {/* ── Exposure score (4C) — per-roof breakdown ───────────── */}
      {exposureResult && (
        <>
          {DIVIDER}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Exposure Score</span>
              <span className="text-[9px] text-[#4a5c75]">Shade × orientation</span>
            </div>

            {/* Best / worst call-outs */}
            {exposureResult.best && exposureResult.worst && exposureResult.best.id !== exposureResult.worst.id && (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-[#00E38C]/8 border border-[#00E38C]/25">
                  <span className="text-[9px] text-[#4a5c75] uppercase tracking-wider">Best</span>
                  <span className="text-[11px] font-semibold text-[#F8FAFC] truncate">{exposureResult.best.name}</span>
                  <span className="text-[18px] font-bold text-[#00E38C] leading-none">{exposureResult.best.avgScore}</span>
                  <span className="text-[9px] text-[#00E38C]">{scoreBand(exposureResult.best.avgScore)}</span>
                </div>
                <div className="flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-[#EF4444]/8 border border-[#EF4444]/25">
                  <span className="text-[9px] text-[#4a5c75] uppercase tracking-wider">Worst</span>
                  <span className="text-[11px] font-semibold text-[#F8FAFC] truncate">{exposureResult.worst.name}</span>
                  <span className="text-[18px] font-bold text-[#EF4444] leading-none">{exposureResult.worst.avgScore}</span>
                  <span className="text-[9px] text-[#EF4444]">{scoreBand(exposureResult.worst.avgScore)}</span>
                </div>
              </div>
            )}

            {/* Per-roof list */}
            <div className="flex flex-col gap-2">
              {Object.entries(exposureResult.byRoof).map(([roofId, data]) => {
                const sec = roofSections.find((s) => s.id === roofId);
                const name = sec?.name ?? roofId;
                return (
                  <div key={roofId}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[rgba(7,17,32,0.5)] border border-[#23324A]"
                  >
                    {/* Score bar */}
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#F8FAFC] font-medium truncate">{name}</span>
                        <span className={`text-[12px] font-bold tabular-nums ${scoreBandColor(data.avgScore)}`}>
                          {data.avgScore}
                        </span>
                      </div>
                      <div className="relative h-1.5 rounded-full bg-[#23324A] overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                          style={{
                            width: `${data.avgScore}%`,
                            background: `hsl(${(data.avgScore / 100) * 120}, 78%, 50%)`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-[#4a5c75]">
                        <span>{scoreBand(data.avgScore)}</span>
                        <span>Orient. {data.orientFactor}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-[#4a5c75] leading-relaxed">
              Score = sun access × orientation factor (0–100). South-facing at
              optimal tilt ≈ 100; flat ≈ 90 × sun access; north-facing
              pitched = lower. Switch to <strong className="text-[#94A3B8]">Exp. Score</strong> view above to see
              per-cell on the roof.
            </p>
          </div>
        </>
      )}

      {DIVIDER}

      {/* ── Instructions ──────────────────────────── */}
      <InstructionList items={[
        "Switch to the 3D view to see the sun and shadows",
        "Pick a date preset or choose a custom date",
        "Drag the time slider to move the sun from 6 AM to 6 PM",
        "Watch shadows from the roof and obstacles update live",
        "Press Play to sweep the day automatically; choose 1× / 2× / 5×",
        "Run Shadow Analysis, then toggle Shade % / Exp. Score / Zones to compare views",
        "Exposure score blends measured shade with roof orientation and tilt",
        "Zones view shows Step 5B merged region polygons — go to Step 5 for full details",
      ]} />

    </PanelShell>
  );
}
