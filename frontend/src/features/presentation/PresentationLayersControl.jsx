/**
 * PresentationLayersControl — Step 9 collapsible workspace layer togg (view only).
 */
import { FiLayers, FiX } from "react-icons/fi";

import {
  DEFAULT_PRESENTATION_LAYERS,
  PRESENTATION_LAYER_TOGGLES,
  ENGINEERING_LAYER_TOGGLES,
} from "./presentationLayersConfig";

function LayerToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2.5 py-1.5 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-[#23324A] bg-[rgba(7,17,32,0.6)] accent-[#4F8CFF] cursor-pointer"
      />
      <span className="text-[11px] text-[#94A3B8] group-hover:text-[#F8FAFC] transition-colors">
        {label}
      </span>
    </label>
  );
}

export default function PresentationLayersControl({
  expanded = false,
  onToggleExpanded,
  layers = DEFAULT_PRESENTATION_LAYERS,
  onPatchLayers = () => {},
}) {
  const patch = (key, value) => onPatchLayers({ [key]: value });

  return (
    <div
      className="absolute z-[1001] top-3 right-3 flex flex-col items-start gap-2 pointer-events-none"
      style={{ maxWidth: expanded ? 240 : undefined }}
    >
      {expanded && (
        <div
          className="pointer-events-auto w-[220px] max-h-[min(70vh,420px)] overflow-y-auto panel-scroll rounded-[20px] border border-[#23324A]/80 bg-[rgba(16,27,45,0.88)] backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[#23324A]/60 bg-[rgba(16,27,45,0.95)] backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <FiLayers size={13} className="text-[#4F8CFF] shrink-0" />
              <span className="text-[11px] font-semibold text-[#F8FAFC] truncate">
                Presentation Layers
              </span>
            </div>
            <button
              type="button"
              onClick={() => onToggleExpanded(false)}
              className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#162338] transition-colors"
              title="Close layers panel"
            >
              <FiX size={13} />
            </button>
          </div>

          <div className="p-3 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold tracking-[0.16em] text-[#94A3B8] uppercase px-0.5">
                Presentation
              </span>
              {PRESENTATION_LAYER_TOGGLES.map(({ key, label }) => (
                <LayerToggle
                  key={key}
                  label={label}
                  checked={!!layers[key]}
                  onChange={(v) => patch(key, v)}
                />
              ))}
            </div>

            <div className="h-px bg-[#23324A]/70" />

            <div className="flex flex flex-col gap-1">
              <span className="text-[9px] font-bold tracking-[0.16em] text-[#94A3B8] uppercase px-0.5">
                Engineering overlays
              </span>
              {ENGINEERING_LAYER_TOGGLES.map(({ key, label }) => (
                <LayerToggle
                  key={key}
                  label={label}
                  checked={!!layers[key]}
                  onChange={(v) => patch(key, v)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onToggleExpanded(!expanded)}
        className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-lg backdrop-blur-xl transition-all duration-150 select-none ${
          expanded
            ? "bg-[#4F8CFF]/15 border-[#4F8CFF]/40 text-[#4F8CFF]"
            : "bg-[rgba(16,27,45,0.88)] border-[#23324A] text-[#F8FAFC] hover:border-[#4F8CFF]/40 hover:text-[#4F8CFF]"
        }`}
        title={expanded ? "Collapse layers" : "Presentation layers"}
      >
        <FiLayers size={13} />
        <span className="text-[12px] font-medium">Layers</span>
      </button>
    </div>
  );
}
