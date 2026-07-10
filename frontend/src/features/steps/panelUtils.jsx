/**
 * Shared panel primitives used by all step panels.
 * Import from here; do not duplicate in individual panel files.
 */

export const SEC_LABEL =
  "text-[9px] font-bold tracking-[0.2em] text-[#94A3B8] uppercase block mb-3";

export const DIVIDER = <div className="h-px bg-[#23324A]" />;

export function DataRow({ label, value, isLast = false }) {
  return (
    <div
      className={`flex items-start justify-between gap-4 px-4 py-3 ${
        !isLast ? "border-b border-[#23324A]/60" : ""
      }`}
    >
      <span className="text-xs text-[#94A3B8] shrink-0">{label}</span>
      <span className="text-xs text-[#F8FAFC] text-right break-words max-w-[58%]">
        {value || "—"}
      </span>
    </div>
  );
}

export function KpiCard({ label, value, accent }) {
  return (
    <div className="flex-1 px-3 py-3 rounded-xl bg-[rgba(7,17,32,0.6)] border border-[#23324A] text-center">
      <div className="text-[9px] text-[#94A3B8] mb-2 leading-snug">{label}</div>
      <div className={`text-sm font-semibold ${accent ?? "text-[#F8FAFC]"}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * Shared outer shell for every step panel.
 * Provides the rounded card, border, glass background, and scroll container.
 */
export function PanelShell({ children }) {
  return (
    <div className="h-full rounded-[20px] border border-[#23324A] bg-[rgba(16,27,45,0.92)] overflow-y-auto panel-scroll shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
      <div className="p-5 flex flex-col gap-5">
        {children}
      </div>
    </div>
  );
}

/** Standard pill header used at the top of each step panel. */
export function PanelHeader({ step, label, subtitle, pill }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-[9px] font-bold tracking-[0.22em] text-[#94A3B8] uppercase">
          {label}
        </h2>
        <p className="mt-1 text-[#94A3B8] text-xs">{subtitle}</p>
      </div>
      {pill ?? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00E38C]/10 border border-[#00E38C]/25">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00E38C]" />
          <span className="text-[10px] font-semibold text-[#00E38C]">Ready</span>
        </div>
      )}
    </div>
  );
}

/** Numbered instruction list used in each step panel's footer. */
export function InstructionList({ items }) {
  return (
    <div className="flex flex-col gap-3">
      <span className={SEC_LABEL}>Instructions</span>
      <ol className="flex flex-col gap-2.5">
        {items.map((text, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-[#23324A] flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[9px] font-bold text-[#94A3B8]">{i + 1}</span>
            </div>
            <span className="text-[11px] text-[#94A3B8] leading-relaxed">{text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Shown when engineering edits invalidated downstream results. */
export function StaleDesignBanner({
  show = false,
  onUpdateDesign = null,
  isUpdatingDesign = false,
  compact = false,
}) {
  if (!show) return null;

  const canUpdate = typeof onUpdateDesign === "function";
  const busy = isUpdatingDesign;

  return (
    <div
      className={`flex ${compact ? "items-center" : "items-start"} gap-3 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/35`}
    >
      <span className="text-[13px] leading-none shrink-0 mt-0.5" aria-hidden>⚠</span>
      <div className={`flex-1 min-w-0 ${compact ? "flex items-center justify-between gap-3" : ""}`}>
        <p className="text-[11px] text-amber-200/95 leading-relaxed">
          Based on previous design — run Update Design to refresh placement, energy, and financials.
        </p>
        {canUpdate && (
          <button
            type="button"
            onClick={onUpdateDesign}
            disabled={busy}
            className={`${compact ? "shrink-0" : "mt-2.5 w-full"} inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-[11px] font-semibold tracking-wide transition-all ${
              busy
                ? "bg-[#23324A] text-[#94A3B8] cursor-wait"
                : "bg-[#4F8CFF] hover:bg-[#5f98ff] text-white shadow-[0_4px_16px_rgba(79,140,255,0.35)]"
            }`}
          >
            {busy && (
              <span
                className="w-3 h-3 rounded-full border-2 border-[#94A3B8]/40 border-t-[#F8FAFC] animate-spin"
                aria-hidden
              />
            )}
            {busy ? "Updating…" : "Update Design"}
          </button>
        )}
      </div>
    </div>
  );
}

/** Floating workspace banner — visible across all steps when design is stale. */
export function UpdateDesignFloatingBar({
  show = false,
  onUpdateDesign = null,
  isUpdatingDesign = false,
}) {
  if (!show || typeof onUpdateDesign !== "function") return null;

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1003] pointer-events-auto w-[min(520px,calc(100%-2rem))]">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-500/40 bg-[rgba(16,27,45,0.96)] backdrop-blur-xl shadow-[0_12px_48px_rgba(0,0,0,0.55)]">
        <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shrink-0">
          <span className="text-amber-300 text-sm" aria-hidden>⚠</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#F8FAFC] leading-snug">
            Design changes pending
          </p>
          <p className="text-[10px] text-[#94A3B8] leading-relaxed mt-0.5">
            Energy and financials reflect the previous design until you update.
          </p>
        </div>
        <button
          type="button"
          onClick={onUpdateDesign}
          disabled={isUpdatingDesign}
          className={`shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-[12px] font-semibold transition-all ${
            isUpdatingDesign
              ? "bg-[#23324A] text-[#94A3B8] cursor-wait"
              : "bg-[#4F8CFF] hover:bg-[#5f98ff] text-white shadow-[0_4px_20px_rgba(79,140,255,0.4)]"
          }`}
        >
          {isUpdatingDesign && (
            <span
              className="w-3.5 h-3.5 rounded-full border-2 border-[#94A3B8]/40 border-t-white animate-spin"
              aria-hidden
            />
          )}
          {isUpdatingDesign ? "Updating…" : "Update Design"}
        </button>
      </div>
    </div>
  );
}
