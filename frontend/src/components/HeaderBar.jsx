import { HiBell } from "react-icons/hi";
import SearchBar from "./SearchBar";
import {
  DEFAULT_PROJECT_NAME,
  getHeaderStepStatus,
  getHeaderWorkspaceLabel,
} from "../config/headerConfig";

export default function HeaderBar({
  setLocation,
  currentStep = 1,
  projectName = DEFAULT_PROJECT_NAME,
  onProjectNameChange = () => {},
}) {
  const statusLabel = getHeaderStepStatus(currentStep);
  const workspaceLabel = getHeaderWorkspaceLabel(currentStep);

  return (
    <header className="relative z-[100] min-h-[56px] shrink-0 flex items-center justify-between gap-4 px-5 py-2.5 border-b border-[#23324A] bg-[#101B2D] overflow-visible">

      {/* ── Left: Logo + project name ── */}
      <div className="flex items-center gap-5 min-w-0 shrink-0">
        <div className="flex items-center gap-2.5 cursor-default select-none shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[#4F8CFF] flex items-center justify-center shadow-[0_0_12px_rgba(79,140,255,0.4)]">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="2.5" fill="white" />
              <path
                d="M7.5 1v2.5M7.5 11.5V14M1 7.5h2.5M11.5 7.5H14M3.05 3.05l1.77 1.77M10.18 10.18l1.77 1.77M10.18 4.82l1.77-1.77M3.05 11.95l1.77-1.77"
                stroke="white"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="font-semibold text-[#F8FAFC] text-sm tracking-tight">
            Lumen DesignX
          </span>
        </div>

        <div className="w-px h-8 bg-[#23324A] shrink-0" />

        <div className="flex flex-col min-w-0 max-w-[220px]">
          <span className="text-[9px] text-[#94A3B8] uppercase tracking-widest leading-none">
            Project
          </span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            spellCheck={false}
            title="Project name"
            className="mt-0.5 w-full text-sm font-medium text-[#F8FAFC] bg-transparent border border-transparent rounded px-1 -mx-1 outline-none truncate hover:border-[#23324A] focus:border-[#4F8CFF]/40 focus:bg-[#162338]/40 transition-colors"
          />
          <span className="mt-0.5 text-[10px] text-[#4a5c75] truncate">
            {workspaceLabel}
          </span>
        </div>
      </div>

      {/* ── Center: Search ── */}
      <div className="flex-1 flex justify-center px-3 sm:px-6 min-w-0 overflow-visible">
        <SearchBar setLocation={setLocation} />
      </div>

      {/* ── Right: step status + notifications ── */}
      <div className="flex items-center gap-4 shrink-0 pl-1">
        <div className="flex items-center gap-1.5 select-none">
          <div className="w-2 h-2 rounded-full bg-[#00E38C] shadow-[0_0_6px_rgba(0,227,140,0.5)]" />
          <span className="text-xs text-[#94A3B8] whitespace-nowrap">{statusLabel}</span>
        </div>

        <button
          type="button"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#162338] transition-colors"
          title="Notifications"
        >
          <HiBell size={16} />
        </button>
      </div>
    </header>
  );
}
