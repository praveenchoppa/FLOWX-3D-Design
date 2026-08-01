/**
 * ElectricalCanvasOverlay.jsx — Canvas interaction hints for Step 7.
 */
import { SEC_LABEL } from "../../../steps/panelUtils";
import { useElectricalPanelSelection } from "../../hooks/useElectricalPanelSelection.js";

export default function ElectricalCanvasOverlay() {
  const { canPickPanels, selectedPanelCount, activeArray } = useElectricalPanelSelection();

  return (
    <div className="rounded-xl border border-dashed border-[#23324A]/80 bg-[rgba(7,17,32,0.25)] px-3 py-4 min-h-[72px] flex flex-col justify-center gap-1">
      <span className={SEC_LABEL}>Canvas</span>
      <p className="text-[10px] text-[#4a5c75] leading-relaxed">
        Panels render in the main 3D workspace. Selected arrays highlight in amber; picked panels show a cyan border.
      </p>
      {canPickPanels && activeArray && (
        <p className="text-[10px] text-[#06B6D4] leading-relaxed">
          Picking in {activeArray.displayName}
          {selectedPanelCount > 0 && (
            <> · {selectedPanelCount} panel{selectedPanelCount !== 1 ? "s" : ""} selected</>
          )}
        </p>
      )}
    </div>
  );
}
