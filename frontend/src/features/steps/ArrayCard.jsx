/**
 * ArrayCard — Step 6C-2 single array manager card.
 */
import { FiEdit2, FiZap } from "react-icons/fi";

import { ZONE_META } from "../zones/zoneClassification";

export default function ArrayCard({
  array,
  isSelected,
  isEditing,
  editValue,
  onSelect,
  onStartRename,
  onEditChange,
  onCommitRename,
  onCancelRename,
}) {
  const meta = ZONE_META[array.zoneClass] ?? ZONE_META.good;

  return (
    <div
      onClick={onSelect}
      className={`relative flex flex-col gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-150 ${
        isSelected
          ? "border-[#FFB547]/50 bg-[#FFB547]/8 shadow-[0_0_0_1px_rgba(255,181,71,0.15)]"
          : "border-[#23324A]/60 bg-[rgba(7,17,32,0.5)] hover:border-[#334466]/80"
      }`}
      style={{ borderLeftColor: meta.color, borderLeftWidth: 3 }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: meta.color }} />

        {isEditing ? (
          <input
            autoFocus
            className="flex-1 bg-transparent text-[12px] text-[#F8FAFC] font-semibold border-b border-[#FFB547] outline-none px-0 py-0 min-w-0"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={() => onCommitRename(array)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); onCommitRename(array); }
              if (e.key === "Escape") { e.stopPropagation(); onCancelRename(); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-[12px] text-[#F8FAFC] font-semibold truncate leading-tight">
            {array.displayName}
          </span>
        )}

        {!isEditing && (
          <button
            type="button"
            className="shrink-0 text-[#4a5c75] hover:text-[#94A3B8] p-0.5 transition-colors"
            onClick={(e) => { e.stopPropagation(); onStartRename(); }}
            title="Rename array"
          >
            <FiEdit2 size={10} />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between pl-[14px] gap-2">
        <span className="text-[10px] text-[#94A3B8]">
          {meta.label} · {array.panelCount} panel{array.panelCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#FFB547] tabular-nums shrink-0">
          <FiZap size={10} />
          {array.systemKw.toFixed(2)} kW
        </span>
      </div>

      {(array.azimuth != null || array.pitch != null) && (
        <div className="pl-[14px] text-[9px] text-[#4a5c75] tabular-nums">
          {array.azimuth != null && <span>Az {array.azimuth}°</span>}
          {array.azimuth != null && array.pitch != null && <span className="mx-1">·</span>}
          {array.pitch != null && <span>Pitch {array.pitch}°</span>}
        </div>
      )}
    </div>
  );
}
