import { Fragment } from "react";
import { HiArrowLeft, HiArrowRight, HiLockClosed, HiCheck } from "react-icons/hi";

const STEPS = [
  "Location",
  "Roof",
  "Obstacles",
  "Simulation",
  "Zones",
  "Panels",
  "Electrical Design",
  "Energy",
  "Financials",
  "Visualization",
  "Project Summary",
];

/**
 * StepWizard — bottom navigation bar.
 *
 * @prop currentStep     1-indexed current step (1–11)
 * @prop maxUnlockedStep furthest step the user has legitimately reached
 * @prop canGoNext       whether Next should be enabled (driven by step's isComplete)
 * @prop canGoBack       whether Back should be enabled
 * @prop onNext          called when Next is clicked (only when canGoNext)
 * @prop onBack          called when Back is clicked (only when canGoBack)
 * @prop onStepClick     called with the step number when a wizard chip is clicked;
 *                       DesignStudio guards against locked steps, but wizard also
 *                       only makes chips clickable when stepNum <= maxUnlockedStep
 */
export default function StepWizard({
  currentStep     = 1,
  maxUnlockedStep = 1,
  canGoNext       = false,
  canGoBack       = false,
  onNext,
  onBack,
  onStepClick,
}) {
  return (
    <div
      className="
        px-3 pb-3 pt-2 flex flex-col gap-3
        bg-[rgba(16,27,45,0.72)] backdrop-blur-md
        border-t border-[#23324A]/90
        shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_-10px_36px_rgba(0,0,0,0.38)]
      "
    >

      {/* ── Step bar ─────────────────────────────── */}
      <div
        className="
          px-5 py-4 rounded-[18px]
          border border-[#23324A]/80
          bg-[rgba(16,27,45,0.55)] backdrop-blur-md
          shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_20px_rgba(0,0,0,0.28)]
        "
      >
        <div className="flex items-start w-full">
          {STEPS.map((step, index) => {
            const stepNum     = index + 1;
            const isActive    = stepNum === currentStep;
            const isUnlocked  = stepNum <= maxUnlockedStep;
            const isDone      = stepNum < currentStep;
            const isFuture    = isUnlocked && !isActive && !isDone;
            const isClickable = isUnlocked && !isActive;

            let circleClass = "bg-[#101B2D] border border-[#334155]/50";
            if (isActive) {
              circleClass = `
                bg-gradient-to-b from-[#5a96ff] to-[#4F8CFF]
                border border-[#4F8CFF]/50
                shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_14px_rgba(79,140,255,0.45)]
              `;
            } else if (isDone) {
              circleClass = `
                bg-[#00E38C]/10 border border-[#00E38C]/45
                shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_10px_rgba(0,227,140,0.22)]
              `;
            } else if (isFuture) {
              circleClass = `
                bg-[#101B2D]/80 border border-[#334155]/60
                group-hover:border-[#475569] group-hover:bg-[#162338]/80
              `;
            }

            let labelClass = "text-[#64748B]/70";
            if (isActive) {
              labelClass = "text-[#F8FAFC] font-medium";
            } else if (isDone) {
              labelClass = "text-[#94A3B8]";
            } else if (isFuture) {
              labelClass = "text-[#64748B] group-hover:text-[#94A3B8]";
            }

            return (
              <Fragment key={step}>
                {/* Step chip */}
                <div
                  className={`flex flex-col items-center gap-1.5 shrink-0 ${
                    isClickable ? "cursor-pointer group" : isActive ? "cursor-default" : "cursor-not-allowed"
                  }`}
                  style={{ minWidth: 72 }}
                  onClick={() => isClickable && onStepClick?.(stepNum)}
                  title={
                    isActive   ? `Step ${stepNum} — current` :
                    isUnlocked ? `Go to Step ${stepNum}` :
                    `Step ${stepNum} — locked`
                  }
                >
                  {/* Circle */}
                  <div className="relative w-8 h-8">
                    {isActive && (
                      <div
                        className="absolute -inset-1 rounded-full border border-[#4F8CFF]/25 animate-pulse pointer-events-none"
                        aria-hidden
                      />
                    )}
                    <div
                      className={`
                        relative w-8 h-8 rounded-full flex items-center justify-center
                        transition-all duration-200
                        ${circleClass}
                      `}
                    >
                      {isActive ? (
                        <span className="text-xs font-bold text-white">{stepNum}</span>
                      ) : isDone ? (
                        <HiCheck size={13} className="text-[#00E38C]" />
                      ) : isUnlocked ? (
                        <span className="text-xs font-bold text-[#64748B] group-hover:text-[#94A3B8]">{stepNum}</span>
                      ) : (
                        <HiLockClosed size={11} className="text-[#64748B]/45" />
                      )}
                    </div>
                  </div>

                  {/* Label */}
                  <div className="flex flex-col items-center text-center">
                    <span className={`text-[10px] whitespace-nowrap leading-none transition-colors duration-200 ${labelClass}`}>
                      {step}
                    </span>
                    {isActive && (
                      <span className="text-[9px] text-[#4F8CFF] mt-1 leading-none">
                        In Progress
                      </span>
                    )}
                  </div>
                </div>

                {/* Connector */}
                {index < STEPS.length - 1 && (
                  <div className="flex-1 h-px mt-4 mx-1 relative">
                    <div className="absolute inset-0 bg-[#23324A] rounded-full" />
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                        stepNum < currentStep
                          ? "right-0 bg-gradient-to-r from-[#4F8CFF]/55 to-[#7bb3ff]/45 shadow-[0_0_6px_rgba(79,140,255,0.25)]"
                          : stepNum === currentStep
                          ? "w-1/2 bg-gradient-to-r from-[#4F8CFF]/40 to-transparent shadow-[0_0_4px_rgba(79,140,255,0.15)]"
                          : "w-0"
                      }`}
                    />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────── */}
      <div className="w-full h-0.5 bg-[#23324A] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#4F8CFF] to-[#7bb3ff] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(79,140,255,0.35)]"
          style={{
            width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
          }}
        />
      </div>

      {/* ── Nav row ──────────────────────────────── */}
      <div className="flex items-center justify-between">

        {/* Back */}
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl
            text-sm font-medium
            transition-all duration-200
            ${
              canGoBack
                ? `
                  text-[#F8FAFC] cursor-pointer
                  bg-[rgba(16,27,45,0.55)] backdrop-blur-md
                  border border-[#23324A]/80
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_16px_rgba(0,0,0,0.22)]
                  hover:border-[#4F8CFF]/40
                  hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_14px_rgba(79,140,255,0.14),0_4px_16px_rgba(0,0,0,0.22)]
                  active:scale-[0.98] active:bg-[rgba(12,22,38,0.75)]
                `
                : "text-[#64748B]/35 cursor-not-allowed border border-transparent"
            }
          `}
        >
          <HiArrowLeft size={14} />
          Back
        </button>

        {/* Step counter + progress dots */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs text-[#94A3B8]">
            Step {currentStep} of {STEPS.length}
          </span>
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => {
              const sn = i + 1;
              return (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-200 ${
                    sn === currentStep
                      ? "w-4 h-1.5 bg-[#4F8CFF] shadow-[0_0_6px_rgba(79,140,255,0.4)]"
                      : sn < currentStep
                      ? "w-1.5 h-1.5 bg-[#00E38C]/70 shadow-[0_0_4px_rgba(0,227,140,0.25)]"
                      : "w-1.5 h-1.5 bg-[#334155]"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Next */}
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className={`
            flex items-center gap-2 px-5 py-2.5 rounded-xl
            text-sm font-medium
            transition-all duration-200
            ${
              canGoNext
                ? `
                  text-white cursor-pointer
                  bg-gradient-to-b from-[#5a96ff] to-[#4F8CFF]
                  border border-[#4F8CFF]/35
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_16px_rgba(79,140,255,0.28)]
                  hover:from-[#6aa3ff] hover:to-[#5a96ff]
                  hover:border-[#4F8CFF]/50
                  hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_18px_rgba(79,140,255,0.32),0_4px_16px_rgba(79,140,255,0.28)]
                  active:scale-[0.98] active:from-[#4A7BE0] active:to-[#3a6fd4]
                `
                : `
                  bg-[rgba(12,22,38,0.65)] border border-[#23324A]/70
                  text-[#64748B]/35 cursor-not-allowed
                `
            }
          `}
        >
          Next
          <HiArrowRight size={14} />
        </button>
      </div>

    </div>
  );
}
