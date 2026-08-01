/**
 * Toolbar.jsx — Array merge/split + electrical panel selection controls.
 */
import { useMemo, useState } from "react";
import { FiCheckSquare, FiGitMerge, FiLink, FiMapPin, FiMinus, FiPlus, FiScissors, FiTrash2, FiXSquare } from "react-icons/fi";

import { SEC_LABEL } from "../../steps/panelUtils";
import { useElectricalStore } from "../hooks/useElectricalStore.js";
import { useElectricalPanelSelection } from "../hooks/useElectricalPanelSelection.js";
import { useStringCreation } from "../hooks/useStringCreation.js";
import { useStringManagement } from "../hooks/useStringManagement.js";
import { validateMergeCompatibility } from "../models/array.js";

export default function Toolbar() {
  const { arrays, selectedArrayIds, mergeArrays, splitArray, terminationPoint, terminationPlacementMode, setTerminationPlacementMode, clearTerminationPoint } = useElectricalStore();
  const {
    activeArrayId,
    activeArray,
    selectedElectricalPanelIds,
    selectedPanelCount,
    canPickPanels,
    selectAll,
    clearSelection,
  } = useElectricalPanelSelection();
  const {
    canCreateString,
    createString,
    selectedElectricalPanelIds: stringSelectionIds,
    selectedPanelCount: stringSelectionCount,
    activeArrayId: stringActiveArrayId,
  } = useStringCreation();
  const {
    selectedString,
    canAddPanelsToString,
    canRemovePanelsFromString,
    canDeleteString,
    hasMixedPanelSelection,
    selectedPanelCount: stringEditPanelCount,
    selectedElectricalPanelIds: stringEditPanelIds,
    addPanelsToString,
    removePanelsFromString,
    deleteString,
  } = useStringManagement();
  const [feedback, setFeedback] = useState(null);

  const mergeCheck = useMemo(
    () => validateMergeCompatibility(arrays, selectedArrayIds),
    [arrays, selectedArrayIds],
  );

  const canMerge = mergeCheck.ok;
  const mergeBlockedReason = !mergeCheck.ok ? mergeCheck.reason : null;
  const activePanelTotal = activeArray?.panelIds?.length ?? 0;

  const canSplit = canPickPanels
    && activePanelTotal >= 2
    && selectedPanelCount > 0
    && selectedPanelCount < activePanelTotal;

  const handleMerge = () => {
    if (!canMerge) return;
    const result = mergeArrays(selectedArrayIds, "Merged Array");
    if (result.ok) {
      setFeedback({
        type:    "success",
        message: `Merged ${selectedArrayIds.length} arrays into "${result.merged.displayName}".`,
      });
    } else {
      setFeedback({ type: "error", message: result.reason });
    }
  };

  const handleSplit = () => {
    if (!canSplit || !activeArrayId) return;
    const result = splitArray(activeArrayId, selectedElectricalPanelIds);
    if (result.ok) {
      setFeedback({
        type:    "success",
        message: `Split ${result.split.panelIds.length} panels into "${result.split.displayName}". "${result.source.displayName}" now has ${result.source.panelIds.length} panels.`,
      });
    } else {
      setFeedback({ type: "error", message: result.reason });
    }
  };

  const handleCreateString = () => {
    if (!canCreateString || !stringActiveArrayId) return;
    const result = createString(stringActiveArrayId, stringSelectionIds);
    if (result.ok) {
      setFeedback({
        type:    "success",
        message: `Created "${result.string.displayName}" with ${result.string.orderedPanelSequence.length} panel${result.string.orderedPanelSequence.length !== 1 ? "s" : ""}.`,
      });
    } else {
      setFeedback({ type: "error", message: result.reason });
    }
  };

  const handleAddToString = () => {
    if (!canAddPanelsToString || !selectedString) return;
    const result = addPanelsToString(selectedString.id, stringEditPanelIds);
    if (result.ok) {
      setFeedback({
        type:    "success",
        message: `Added ${stringEditPanelCount} panel${stringEditPanelCount !== 1 ? "s" : ""} to "${result.string.displayName}".`,
      });
    } else {
      setFeedback({ type: "error", message: result.reason });
    }
  };

  const handleRemoveFromString = () => {
    if (!canRemovePanelsFromString || !selectedString) return;
    const name = selectedString.displayName;
    const result = removePanelsFromString(selectedString.id, stringEditPanelIds);
    if (result.ok) {
      if (result.deleted) {
        setFeedback({
          type:    "success",
          message: `Removed the last panels from "${name}". String deleted.`,
        });
      } else {
        setFeedback({
          type:    "success",
          message: `Removed ${stringEditPanelCount} panel${stringEditPanelCount !== 1 ? "s" : ""} from "${result.string.displayName}".`,
        });
      }
    } else {
      setFeedback({ type: "error", message: result.reason });
    }
  };

  const handleDeleteString = () => {
    if (!canDeleteString || !selectedString) return;
    const name = selectedString.displayName;
    const result = deleteString(selectedString.id);
    if (result.ok) {
      setFeedback({
        type:    "success",
        message: `Deleted "${name}". Panels are now unassigned.`,
      });
    } else {
      setFeedback({ type: "error", message: result.reason });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-[#23324A]/60 bg-[rgba(7,17,32,0.45)] px-3 py-2.5 flex flex-col gap-3">
        <span className={SEC_LABEL}>Array Tools</span>

        <button
          type="button"
          disabled={!canSplit}
          onClick={handleSplit}
          className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border transition-colors ${
            canSplit
              ? "border-[#06B6D4]/40 bg-[#06B6D4]/10 text-[#06B6D4] hover:bg-[#06B6D4]/18"
              : "border-[#23324A]/60 bg-[rgba(7,17,32,0.3)] text-[#4a5c75] cursor-not-allowed"
          }`}
        >
          <FiScissors size={12} />
          Split Array
          {selectedPanelCount > 0 && canPickPanels && (
            <span className="tabular-nums opacity-80">({selectedPanelCount})</span>
          )}
        </button>

        {canPickPanels && activePanelTotal >= 2 && selectedPanelCount === 0 && (
          <p className="text-[10px] text-[#4a5c75] leading-relaxed">
            Select panels in the active array, then split them into a new array.
          </p>
        )}

        {canPickPanels && selectedPanelCount >= activePanelTotal && activePanelTotal >= 2 && (
          <p className="text-[10px] text-[#FFB547] leading-relaxed">
            Leave at least one panel in the source array to split.
          </p>
        )}

        <button
          type="button"
          disabled={!canMerge}
          onClick={handleMerge}
          className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border transition-colors ${
            canMerge
              ? "border-[#4F8CFF]/40 bg-[#4F8CFF]/10 text-[#4F8CFF] hover:bg-[#4F8CFF]/18"
              : "border-[#23324A]/60 bg-[rgba(7,17,32,0.3)] text-[#4a5c75] cursor-not-allowed"
          }`}
        >
          <FiGitMerge size={12} />
          Merge Selected
          {selectedArrayIds.length >= 2 && (
            <span className="tabular-nums opacity-80">({selectedArrayIds.length})</span>
          )}
        </button>

        {selectedArrayIds.length >= 2 && !canMerge && mergeBlockedReason && (
          <p className="text-[10px] text-[#FFB547] leading-relaxed">
            {mergeBlockedReason}
          </p>
        )}

        {selectedArrayIds.length === 1 && (
          <p className="text-[10px] text-[#4a5c75] leading-relaxed">
            Ctrl+click another array to select it for merging.
          </p>
        )}

        {feedback && (
          <p
            className={`text-[10px] leading-relaxed ${
              feedback.type === "success" ? "text-[#00E38C]" : "text-[#FFB547]"
            }`}
          >
            {feedback.message}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-[#23324A]/60 bg-[rgba(7,17,32,0.45)] px-3 py-2.5 flex flex-col gap-3">
        <span className={SEC_LABEL}>Panel Selection</span>

        {!canPickPanels && (
          <p className="text-[10px] text-[#4a5c75] leading-relaxed">
            Select a single array to pick panels on the canvas.
          </p>
        )}

        {canPickPanels && activeArray && (
          <p className="text-[10px] text-[#94A3B8] leading-relaxed">
            Active array:{" "}
            <span className="text-[#F8FAFC] font-medium">{activeArray.displayName}</span>
            {" · "}
            <span className="tabular-nums">{selectedPanelCount}</span>
            {" / "}
            <span className="tabular-nums">{activePanelTotal}</span>
            {" "}selected
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!canPickPanels || activePanelTotal === 0}
            onClick={selectAll}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold border border-[#06B6D4]/40 bg-[#06B6D4]/10 text-[#06B6D4] hover:bg-[#06B6D4]/18 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FiCheckSquare size={12} />
            Select All
          </button>
          <button
            type="button"
            disabled={!canPickPanels || selectedPanelCount === 0}
            onClick={clearSelection}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold border border-[#23324A]/60 bg-[rgba(7,17,32,0.3)] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#162338] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FiXSquare size={12} />
            Clear
          </button>
        </div>

        {canPickPanels && (
          <p className="text-[10px] text-[#4a5c75] leading-relaxed">
            Click panels in the 3D view. Ctrl/Cmd+click to multi-select. Esc or click empty space to clear.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-[#23324A]/60 bg-[rgba(7,17,32,0.45)] px-3 py-2.5 flex flex-col gap-3">
        <span className={SEC_LABEL}>String Tools</span>

        <button
          type="button"
          disabled={!canCreateString}
          onClick={handleCreateString}
          className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border transition-colors ${
            canCreateString
              ? "border-[#00E38C]/40 bg-[#00E38C]/10 text-[#00E38C] hover:bg-[#00E38C]/18"
              : "border-[#23324A]/60 bg-[rgba(7,17,32,0.3)] text-[#4a5c75] cursor-not-allowed"
          }`}
        >
          <FiLink size={12} />
          Create String
          {stringSelectionCount > 0 && canPickPanels && (
            <span className="tabular-nums opacity-80">({stringSelectionCount})</span>
          )}
        </button>

        {canPickPanels && stringSelectionCount === 0 && !selectedString && (
          <p className="text-[10px] text-[#4a5c75] leading-relaxed">
            Select unassigned panels in the active array, then create a string.
          </p>
        )}

        {canPickPanels && stringSelectionCount > 0 && !canCreateString && !selectedString && (
          <p className="text-[10px] text-[#FFB547] leading-relaxed">
            One or more selected panels are already assigned to a string.
          </p>
        )}

        {selectedString && (
          <p className="text-[10px] text-[#94A3B8] leading-relaxed">
            Editing{" "}
            <span className="text-[#00E38C] font-medium">{selectedString.displayName}</span>
          </p>
        )}

        <button
          type="button"
          disabled={!canAddPanelsToString}
          onClick={handleAddToString}
          className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border transition-colors ${
            canAddPanelsToString
              ? "border-[#00E38C]/40 bg-[#00E38C]/10 text-[#00E38C] hover:bg-[#00E38C]/18"
              : "border-[#23324A]/60 bg-[rgba(7,17,32,0.3)] text-[#4a5c75] cursor-not-allowed"
          }`}
        >
          <FiPlus size={12} />
          Add to String
          {canAddPanelsToString && (
            <span className="tabular-nums opacity-80">({stringEditPanelCount})</span>
          )}
        </button>

        <button
          type="button"
          disabled={!canRemovePanelsFromString}
          onClick={handleRemoveFromString}
          className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border transition-colors ${
            canRemovePanelsFromString
              ? "border-[#FFB547]/40 bg-[#FFB547]/10 text-[#FFB547] hover:bg-[#FFB547]/18"
              : "border-[#23324A]/60 bg-[rgba(7,17,32,0.3)] text-[#4a5c75] cursor-not-allowed"
          }`}
        >
          <FiMinus size={12} />
          Remove from String
          {canRemovePanelsFromString && (
            <span className="tabular-nums opacity-80">({stringEditPanelCount})</span>
          )}
        </button>

        {selectedString && stringEditPanelCount === 0 && (
          <p className="text-[10px] text-[#4a5c75] leading-relaxed">
            Select unassigned panels to add, or member panels to remove.
          </p>
        )}

        {hasMixedPanelSelection && (
          <p className="text-[10px] text-[#FFB547] leading-relaxed">
            Selection mixes assigned and unassigned panels. Select only unassigned panels to add, or only string members to remove.
          </p>
        )}

        <button
          type="button"
          disabled={!canDeleteString}
          onClick={handleDeleteString}
          className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border transition-colors ${
            canDeleteString
              ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/18"
              : "border-[#23324A]/60 bg-[rgba(7,17,32,0.3)] text-[#4a5c75] cursor-not-allowed"
          }`}
        >
          <FiTrash2 size={12} />
          Delete String
        </button>
      </div>

      <div className="rounded-xl border border-[#23324A]/60 bg-[rgba(7,17,32,0.45)] px-3 py-2.5 flex flex-col gap-3">
        <span className={SEC_LABEL}>Termination</span>

        {!terminationPoint && (
          <button
            type="button"
            onClick={() => setTerminationPlacementMode(true)}
            disabled={terminationPlacementMode}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border transition-colors ${
              terminationPlacementMode
                ? "border-[#00E38C]/50 bg-[#00E38C]/15 text-[#00E38C]"
                : "border-[#00E38C]/40 bg-[#00E38C]/10 text-[#00E38C] hover:bg-[#00E38C]/18"
            }`}
          >
            <FiMapPin size={12} />
            Place Termination Point
          </button>
        )}

        {terminationPlacementMode && (
          <p className="text-[10px] text-[#06B6D4] leading-relaxed">
            Click anywhere on the workspace to place the termination point.
          </p>
        )}

        {terminationPoint && (
          <button
            type="button"
            onClick={() => {
              clearTerminationPoint();
              setFeedback({
                type:    "success",
                message: "Termination point removed. Homerun lengths are pending.",
              });
            }}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/18 transition-colors"
          >
            <FiTrash2 size={12} />
            Remove Termination
          </button>
        )}
      </div>
    </div>
  );
}
