/**
 * ProjectDefaultsDialog — Secondary editor for projectPanelDefaults (new areas only).
 * Not part of the normal Panels workflow.
 */
import { FiX } from "react-icons/fi";

import { PanelConfigFields } from "./panelConfigFields.jsx";

export default function ProjectDefaultsDialog({
  open,
  onClose,
  projectPanelDefaults,
  onUpdateProjectPanelDefaults,
}) {
  if (!open || !projectPanelDefaults) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-[rgba(7,17,32,0.72)] backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md max-h-[min(90vh,640px)] overflow-y-auto rounded-[20px] border border-[#23324A] bg-[#101B2D] shadow-[0_8px_40px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-defaults-dialog-title"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 border-b border-[#23324A] bg-[#101B2D]">
          <div>
            <h2
              id="project-defaults-dialog-title"
              className="text-[13px] font-semibold text-[#F8FAFC]"
            >
              Defaults for New Areas
            </h2>
            <p className="mt-1 text-[11px] text-[#94A3B8] leading-relaxed">
              Starting values when you draw a new placement area. Does not change
              existing areas — use Reset to Template on an area to apply these values.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#162338] transition-colors shrink-0"
            aria-label="Close"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <PanelConfigFields
            config={projectPanelDefaults}
            readOnly={false}
            onPatch={onUpdateProjectPanelDefaults}
          />
        </div>

        <div className="sticky bottom-0 px-5 py-4 border-t border-[#23324A] bg-[#101B2D]">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-[#4F8CFF] text-white hover:brightness-110 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
