/**
 * PlaceholderPanel — skeleton panel for steps 3–10.
 *
 * Rendered for every step that has not yet been built. The step controller
 * treats these as isComplete = true (always navigable during development).
 * Replace this panel with the real step panel when that step is specified.
 */
import { HiLockClosed } from "react-icons/hi";
import { PanelShell } from "./panelUtils";

export default function PlaceholderPanel({ step, label }) {
  return (
    <PanelShell>
      <div className="flex flex-col items-center justify-center flex-1 py-12 gap-5 text-center">

        <div className="w-14 h-14 rounded-2xl bg-[#23324A]/60 border border-[#23324A] flex items-center justify-center">
          <HiLockClosed size={22} className="text-[#94A3B8]/40" />
        </div>

        <div>
          <p className="text-[9px] font-bold tracking-[0.2em] text-[#94A3B8]/50 uppercase mb-1">
            Step {step}
          </p>
          <h3 className="text-base font-semibold text-[#F8FAFC]/70">{label}</h3>
          <p className="text-xs text-[#94A3B8]/60 mt-2 max-w-[220px] leading-relaxed">
            This step has not been built yet. Spec will be finalised before implementation begins.
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-full bg-[#FFB547]/8 border border-[#FFB547]/20">
          <span className="text-[10px] text-[#FFB547]/70">Coming in a future sprint</span>
        </div>

      </div>
    </PanelShell>
  );
}
