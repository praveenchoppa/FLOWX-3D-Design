/**
 * GlobalSimulationTool — floating simulation controls (Steps 4+).
 *
 * Reuses existing DesignStudio simulation state and SimulationControls UI.
 * Collapsed: compact chip. Expanded: glass panel. Closing hides UI only — playback continues.
 */
import { FiSun, FiX } from "react-icons/fi";

import SimulationControls from "./SimulationControls";
import { formatTime } from "./solar";

export default function GlobalSimulationTool({
  expanded = false,
  onToggleExpanded,
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
}) {
  const belowHorizon = sun?.belowHorizon ?? false;
  const timeStr = formatTime(simMinutes);

  return (
    <div
      className="absolute z-[1001] left-3 bottom-[68px] flex flex-col items-start gap-2 pointer-events-none"
      style={{ maxWidth: expanded ? 320 : undefined }}
    >
      {expanded && (
        <div
          className="pointer-events-auto w-[300px] max-h-[min(70vh,520px)] overflow-y-auto panel-scroll rounded-[20px] border border-[#23324A]/80 bg-[rgba(16,27,45,0.88)] backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-[#23324A]/60 bg-[rgba(16,27,45,0.95)] backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <FiSun size={14} className="text-[#FFB547] shrink-0" />
              <span className="text-[11px] font-semibold text-[#F8FAFC] truncate">Simulation</span>
              {simPlaying && (
                <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-[#FFB547]/15 border border-[#FFB547]/30 text-[9px] font-semibold text-[#FFB547]">
                  Playing
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onToggleExpanded(false)}
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#162338] border border-transparent hover:border-[#23324A] transition-colors"
              title="Close panel (simulation keeps running)"
            >
              <FiX size={14} />
            </button>
          </div>

          <div className="p-4">
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
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onToggleExpanded(!expanded)}
        className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg backdrop-blur-xl transition-all duration-150 select-none ${
          expanded
            ? "bg-[#FFB547]/15 border-[#FFB547]/40 text-[#FFB547]"
            : simPlaying
            ? "bg-[rgba(16,27,45,0.92)] border-[#FFB547]/35 text-[#FFB547] shadow-[0_0_12px_rgba(255,181,71,0.15)]"
            : "bg-[rgba(16,27,45,0.88)] border-[#23324A] text-[#F8FAFC] hover:border-[#4F8CFF]/40 hover:text-[#4F8CFF]"
        }`}
        title={expanded ? "Collapse simulation panel" : "Open simulation controls"}
      >
        <FiSun size={14} className={simPlaying ? "animate-pulse" : ""} />
        <span className="text-[13px] font-medium">☀ Simulation</span>
        {!expanded && (
          <span className="text-[11px] tabular-nums text-[#94A3B8]">
            {timeStr}
            {belowHorizon ? " · down" : ""}
          </span>
        )}
      </button>
    </div>
  );
}
