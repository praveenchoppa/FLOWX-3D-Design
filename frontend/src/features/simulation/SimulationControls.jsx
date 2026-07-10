/**
 * SimulationControls — shared date/time/playback controls (Steps 4+).
 *
 * Pure UI over existing DesignStudio simulation state — no engine logic here.
 */
import { FiSun, FiPlay, FiPause, FiRefreshCw, FiAlertCircle } from "react-icons/fi";

import { KpiCard, SEC_LABEL, DIVIDER } from "../steps/panelUtils";
import {
  SIM_START, SIM_END,
  formatTime, formatDate,
  presetDates, isSameDay, parseDateInput, toDateInputValue,
  radToDeg, azimuthToCompass, cardinal,
} from "../simulation/solar";

const SPEEDS = [1, 2, 5];

function trackPct(minutes) {
  return Math.max(0, Math.min(100, ((minutes - SIM_START) / (SIM_END - SIM_START)) * 100));
}

export default function SimulationControls({
  location = {},
  sun = null,
  dayTimes = null,
  simDay,
  setSimDay,
  simMinutes,
  setSimMinutes,
  simPlaying,
  setSimPlaying,
  simSpeed,
  setSimSpeed,
  view3D,
  setView3D,
  roofSections = [],
  showView3DNotice = false,
}) {
  const hasLocation = location?.lat != null;
  const hasRoof = roofSections.length > 0;
  const belowHorizon = sun?.belowHorizon ?? false;

  const presets = presetDates();
  const PRESETS = [
    { key: "today",   label: "Today",           sub: formatDate(presets.today).split(",")[1]?.trim(), date: presets.today },
    { key: "summer",  label: "Summer Solstice", sub: "Jun 21", date: presets.summer },
    { key: "winter",  label: "Winter Solstice", sub: "Dec 21", date: presets.winter },
    { key: "equinox", label: "Equinox",         sub: "Mar 21", date: presets.equinox },
  ];

  const togglePlay = () => {
    if (!simPlaying && simMinutes >= SIM_END) setSimMinutes(SIM_START);
    setSimPlaying((p) => !p);
  };

  const reset = () => {
    setSimPlaying(false);
    setSimMinutes(SIM_START);
  };

  const onScrub = (e) => {
    setSimPlaying(false);
    setSimMinutes(parseFloat(e.target.value));
  };

  const altDeg  = sun ? radToDeg(sun.altitude) : null;
  const compass = sun ? azimuthToCompass(sun.azimuth) : null;
  const dateStr = sun ? formatDate(sun.date) : "—";
  const timeStr = formatTime(simMinutes);
  const sunriseMin = dayTimes?.sunriseMin ?? null;
  const sunsetMin  = dayTimes?.sunsetMin ?? null;

  return (
    <div className="flex flex-col gap-4">
      {showView3DNotice && !view3D && setView3D && (
        <button
          type="button"
          onClick={() => hasRoof && setView3D(true)}
          className="w-full text-left px-3 py-2.5 rounded-xl bg-[#FFB547]/10 border border-[#FFB547]/25 text-[11px] text-[#FFB547] hover:bg-[#FFB547]/15 transition-colors"
        >
          The simulation runs in 3D. Click to switch to the 3D view.
        </button>
      )}

      {!hasLocation && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[#94A3B8]/8 border border-[#94A3B8]/20">
          <FiAlertCircle size={13} className="text-[#94A3B8] mt-0.5 shrink-0" />
          <span className="text-[11px] text-[#94A3B8] leading-relaxed">
            Set a project location in Step 1 to compute the sun&apos;s position.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Date</span>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map(({ key, label, sub, date }) => {
            const active = isSameDay(simDay, date);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSimDay(date)}
                className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 ${
                  active
                    ? "bg-[#4F8CFF]/15 border-[#4F8CFF]/40"
                    : "bg-[rgba(7,17,32,0.4)] border-[#23324A] hover:bg-[#162338] hover:border-[#2a3850]"
                }`}
              >
                <span className={`text-[11px] leading-tight ${active ? "text-[#F8FAFC] font-medium" : "text-[#94A3B8]"}`}>
                  {label}
                </span>
                {sub && <span className="text-[9px] text-[#4a5c75]">{sub}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-[#94A3B8]">Custom date</span>
          <input
            type="date"
            value={toDateInputValue(simDay)}
            onChange={(e) => e.target.value && setSimDay(parseDateInput(e.target.value))}
            className="text-[11px] text-[#F8FAFC] bg-[rgba(7,17,32,0.6)] border border-[#23324A] rounded-lg px-2 py-[5px] outline-none focus:border-[#4F8CFF] transition-colors [color-scheme:dark]"
          />
        </div>
      </div>

      {DIVIDER}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Time of Day</span>
          <div className="flex items-center gap-1.5">
            <FiSun size={13} className={belowHorizon ? "text-[#94A3B8]" : "text-[#FFB547]"} />
            <span className="text-sm font-semibold text-[#F8FAFC] tabular-nums">{timeStr}</span>
          </div>
        </div>

        <div className="relative pt-1">
          {sunriseMin != null && sunriseMin >= SIM_START && sunriseMin <= SIM_END && (
            <div
              className="absolute top-0 bottom-3 w-px bg-[#FFB547]/50 pointer-events-none"
              style={{ left: `${trackPct(sunriseMin)}%` }}
            />
          )}
          {sunsetMin != null && sunsetMin >= SIM_START && sunsetMin <= SIM_END && (
            <div
              className="absolute top-0 bottom-3 w-px bg-[#4F8CFF]/50 pointer-events-none"
              style={{ left: `${trackPct(sunsetMin)}%` }}
            />
          )}
          <input
            type="range"
            min={SIM_START}
            max={SIM_END}
            step={1}
            value={Math.min(Math.max(simMinutes, SIM_START), SIM_END)}
            onChange={onScrub}
            className="w-full h-1.5 cursor-pointer rounded-full appearance-none bg-[#23324A]"
            style={{ accentColor: "#FFB547" }}
          />
        </div>

        <div className="flex items-center justify-between text-[9px] text-[#4a5c75]">
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-[#94A3B8]">
            Sunrise <span className="text-[#F8FAFC]">{sunriseMin != null ? formatTime(sunriseMin) : "—"}</span>
            <span className="mx-1.5 text-[#23324A]">·</span>
            Sunset <span className="text-[#F8FAFC]">{sunsetMin != null ? formatTime(sunsetMin) : "—"}</span>
          </span>
          {belowHorizon && hasLocation && (
            <span className="text-[10px] text-[#FFB547]">Below horizon</span>
          )}
        </div>
      </div>

      {DIVIDER}

      <div className="flex flex-col gap-3">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Playback</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasLocation}
            className={`flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 ${
              !hasLocation
                ? "bg-[#23324A]/40 text-[#94A3B8]/40 cursor-not-allowed"
                : simPlaying
                ? "bg-[#FFB547] text-[#071120] hover:brightness-95"
                : "bg-[#4F8CFF] text-white hover:brightness-110"
            }`}
          >
            {simPlaying ? <FiPause size={14} /> : <FiPlay size={14} />}
            <span>{simPlaying ? "Pause" : "Play"}</span>
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!hasLocation}
            title="Reset to sunrise window (6 AM)"
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-medium border transition-all duration-150 ${
              !hasLocation
                ? "border-[#23324A]/40 text-[#94A3B8]/40 cursor-not-allowed"
                : "border-[#23324A] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#162338]"
            }`}
          >
            <FiRefreshCw size={13} />
            <span>Reset</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#94A3B8]">Speed</span>
          <div className="flex items-center gap-1 p-1 rounded-full bg-[rgba(7,17,32,0.6)] border border-[#23324A]">
            {SPEEDS.map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setSimSpeed(sp)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all duration-150 ${
                  simSpeed === sp
                    ? "bg-[#4F8CFF] text-white"
                    : "text-[#94A3B8] hover:text-[#F8FAFC]"
                }`}
              >
                {sp}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {DIVIDER}

      <div className="flex flex-col gap-3">
        <span className={SEC_LABEL}>Sun — Current Moment</span>
        <div className="flex gap-2">
          <KpiCard label="Date" value={dateStr} />
          <KpiCard label="Time" value={timeStr} />
        </div>
        <div className="flex gap-2">
          <KpiCard
            label="Sun Altitude"
            value={altDeg != null ? `${altDeg.toFixed(1)}°` : "—"}
            accent={belowHorizon ? "text-[#FFB547]" : "text-[#F8FAFC]"}
          />
          <KpiCard
            label="Sun Azimuth"
            value={compass != null ? `${compass.toFixed(0)}° ${cardinal(compass)}` : "—"}
          />
        </div>
      </div>
    </div>
  );
}
