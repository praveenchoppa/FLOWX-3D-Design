/**
 * ShowDimensionsControl.jsx — Global "Show Dimensions" toggle (Phase 1).
 */

import { FiMaximize2 } from "react-icons/fi";

/**
 * @param {{
 *   checked?: boolean,
 *   onChange?: (checked: boolean) => void,
 *   className?: string,
 * }} props
 */
export default function ShowDimensionsControl({
  checked   = false,
  onChange  = () => {},
  className = "",
}) {
  return (
    <label
      className={[
        "flex items-center gap-2 px-3 py-2 rounded-full cursor-pointer select-none",
        "bg-[rgba(16,27,45,0.88)] backdrop-blur-xl border border-[#23324A]",
        "shadow-lg text-[12px] font-medium text-[#F8FAFC] transition-colors",
        "hover:border-[#4F8CFF]/35",
        className,
      ].join(" ")}
    >
      <FiMaximize2 size={13} className="text-[#94A3B8] shrink-0" />
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={[
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          checked
            ? "border-[#4F8CFF] bg-[#4F8CFF] text-white"
            : "border-[#475569] bg-transparent",
        ].join(" ")}
        aria-hidden
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </span>
      <span>Show Dimensions</span>
    </label>
  );
}
