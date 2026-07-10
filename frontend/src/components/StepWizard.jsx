import { Fragment } from "react";
import { HiArrowLeft, HiArrowRight, HiLockClosed, HiCheck } from "react-icons/hi";

const STEPS = [
  "Location",
  "Roof",
  "Obstacles",
  "Simulation",
  "Zones",
  "Panels",
  "Energy",
  "Financials",
  "Visualization",
  "CRM",
];

/**
 * StepWizard — bottom navigation bar.
 *
 * @prop currentStep     1-indexed current step (1–10)
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
    <div className="px-3 pb-3 pt-2 flex flex-col gap-3">

      {/* ── Step bar ─────────────────────────────── */}
      <div className="px-5 py-4 rounded-[18px] border border-[#23324A] bg-[#101B2D] shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
        <div className="flex items-start w-full">
          {STEPS.map((step, index) => {
            const stepNum    = index + 1;           // 1-indexed
            const isActive   = stepNum === currentStep;
            const isUnlocked = stepNum <= maxUnlockedStep;
            const isDone     = stepNum < currentStep; // visually "completed"
            const isClickable = isUnlocked && !isActive;

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
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      transition-all duration-200
                      ${
                        isActive
                          ? "bg-[#4F8CFF] shadow-[0_0_10px_rgba(79,140,255,0.4)]"
                          : isUnlocked
                          ? "bg-[#4F8CFF]/20 border border-[#4F8CFF]/40 group-hover:bg-[#4F8CFF]/35 group-hover:border-[#4F8CFF]/60"
                          : "bg-[#101B2D] border border-[#23324A]"
                      }
                    `}
                  >
                    {isActive ? (
                      <span className="text-xs font-bold text-white">{stepNum}</span>
                    ) : isDone ? (
                      <HiCheck size={13} className="text-[#4F8CFF]" />
                    ) : isUnlocked ? (
                      <span className="text-xs font-bold text-[#4F8CFF]/70">{stepNum}</span>
                    ) : (
                      <HiLockClosed size={11} className="text-[#94A3B8]/35" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex flex-col items-center text-center">
                    <span
                      className={`text-[10px] whitespace-nowrap leading-none transition-colors ${
                        isActive
                          ? "text-[#F8FAFC] font-medium"
                          : isUnlocked
                          ? "text-[#4F8CFF]/80 group-hover:text-[#4F8CFF]"
                          : "text-[#94A3B8]/35"
                      }`}
                    >
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
                  <div
                    className={`flex-1 h-px mt-4 mx-1 transition-colors duration-300 ${
                      stepNum < currentStep ? "bg-[#4F8CFF]/30" : "bg-[#23324A]"
                    }`}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────── */}
      <div className="w-full h-0.5 bg-[#23324A] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#4F8CFF] to-[#7bb3ff] rounded-full transition-all duration-500"
          style={{
            width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
          }}
        />
      </div>

      {/* ── Nav row ──────────────────────────────── */}
      <div className="flex items-center justify-between">

        {/* Back */}
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl
            border border-[#23324A]
            text-sm font-medium
            transition-all duration-150
            ${
              canGoBack
                ? "text-[#F8FAFC] hover:bg-[#162338] hover:border-[#2a3850] cursor-pointer"
                : "text-[#94A3B8]/30 cursor-not-allowed"
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
                  className={`rounded-full transition-all duration-300 ${
                    sn === currentStep
                      ? "w-4 h-1.5 bg-[#4F8CFF]"
                      : sn < currentStep
                      ? "w-1.5 h-1.5 bg-[#4F8CFF]/40"
                      : "w-1.5 h-1.5 bg-[#23324A]"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Next */}
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className={`
            flex items-center gap-2 px-5 py-2.5 rounded-xl
            text-sm font-medium
            transition-all duration-150
            ${
              canGoNext
                ? "bg-[#4F8CFF] text-white hover:bg-[#3a7be0] shadow-[0_0_12px_rgba(79,140,255,0.35)] cursor-pointer"
                : "bg-[#162338] border border-[#23324A] text-[#94A3B8]/30 cursor-not-allowed"
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
