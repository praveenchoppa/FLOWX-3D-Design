/**
 * ArrayTree.jsx — Arrays + strings hierarchy (Placement Areas–style tree).
 */
import { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiChevronRight, FiEdit2, FiLayers } from "react-icons/fi";

import { SEC_LABEL } from "../../../steps/panelUtils";
import { useArraySelection } from "../../hooks/useArraySelection.js";
import { useStringSelection } from "../../hooks/useStringSelection.js";
import { useElectricalStore } from "../../hooks/useElectricalStore.js";
import {
  assignedPanelCount,
  getUnassignedCount,
  stringsInArray,
} from "../../utils/stringDisplayUtils.js";

function StringTreeItem({
  string: str,
  isSelected,
  isLast,
  isEditing,
  editValue,
  onSelect,
  onStartRename,
  onEditChange,
  onCommitRename,
  onCancelRename,
}) {
  const panelCount = str.orderedPanelSequence?.length ?? 0;

  const handleDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isEditing) onStartRename();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if (isEditing) return;
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isEditing) onSelect();
      }}
      className={`w-full text-left flex gap-2 pl-1 pr-2 py-1.5 rounded-lg border transition-all duration-150 ${
        isSelected
          ? "border-[#00E38C]/60 bg-[#00E38C]/15 shadow-[0_0_0_1px_rgba(0,227,140,0.2)]"
          : "border-transparent hover:border-[#23324A]/60 hover:bg-[rgba(7,17,32,0.35)]"
      }`}
    >
      <span className="text-[10px] text-[#4a5c75] font-mono shrink-0 w-5 pt-0.5 leading-none">
        {isLast ? "└──" : "├──"}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-1 min-w-0">
          {isEditing ? (
            <input
              autoFocus
              className="flex-1 bg-transparent text-[11px] text-[#F8FAFC] font-medium border-b border-[#00E38C] outline-none px-0 py-0 min-w-0"
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={() => onCommitRename(str)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); onCommitRename(str); }
                if (e.key === "Escape") { e.stopPropagation(); onCancelRename(); }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className={`flex-1 text-[11px] truncate ${isSelected ? "text-[#00E38C] font-semibold" : "text-[#F8FAFC] font-medium"}`}>
                {str.displayName}
              </span>
              <button
                type="button"
                className="shrink-0 text-[#4a5c75] hover:text-[#94A3B8] p-0.5 transition-colors"
                onClick={(e) => { e.stopPropagation(); onStartRename(); }}
                title="Rename string"
              >
                <FiEdit2 size={10} />
              </button>
            </>
          )}
        </div>
        {!isEditing && (
          <span className="text-[10px] text-[#94A3B8] tabular-nums pl-3">
            {panelCount} Panel{panelCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function ArrayTreeItem({
  array,
  strings,
  assignedCount,
  unassignedCount,
  isSelected,
  isExpanded,
  selectedStringId,
  isEditing,
  editValue,
  onToggleExpand,
  onSelect,
  onSelectAdditive,
  onSelectString,
  onStartRename,
  onEditChange,
  onCommitRename,
  onCancelRename,
  editingStringId,
  stringEditValue,
  onStartStringRename,
  onStringEditChange,
  onCommitStringRename,
  onCancelStringRename,
}) {
  const panelCount = array.panelIds?.length ?? 0;
  const stringCount = strings.length;

  const handleClick = (e) => {
    if (isEditing) return;
    if (e.ctrlKey || e.metaKey) {
      onSelectAdditive();
    } else {
      onSelect();
    }
  };

  const handleDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isEditing) onStartRename();
  };

  return (
    <div
      className={`rounded-xl border transition-all duration-150 ${
        isSelected && !selectedStringId
          ? "border-[#4F8CFF]/50 bg-[#4F8CFF]/8 shadow-[0_0_0_1px_rgba(79,140,255,0.15)]"
          : "border-[#23324A]/60 bg-[rgba(7,17,32,0.5)] hover:border-[#334466]/80"
      }`}
      style={{ borderLeftColor: "#4F8CFF", borderLeftWidth: 3 }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isEditing) onSelect();
        }}
        className="w-full text-left flex flex-col gap-1.5 px-3 py-2.5 cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="shrink-0 text-[#94A3B8] p-0.5 hover:text-[#F8FAFC]"
            aria-label={isExpanded ? "Collapse strings" : "Expand strings"}
          >
            {isExpanded ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
          </button>
          <FiLayers size={11} className="text-[#4F8CFF] shrink-0" />
          {isEditing ? (
            <input
              autoFocus
              className="flex-1 bg-transparent text-[12px] text-[#F8FAFC] font-semibold border-b border-[#4F8CFF] outline-none px-0 py-0 min-w-0"
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
            <>
              <span className="flex-1 text-[12px] text-[#F8FAFC] font-semibold truncate leading-tight">
                {array.displayName}
              </span>
              <button
                type="button"
                className="shrink-0 text-[#4a5c75] hover:text-[#94A3B8] p-0.5 transition-colors"
                onClick={(e) => { e.stopPropagation(); onStartRename(); }}
                title="Rename array"
              >
                <FiEdit2 size={10} />
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col gap-0.5 pl-[26px]">
          <span className="text-[10px] text-[#94A3B8] tabular-nums">
            {panelCount} Panel{panelCount !== 1 ? "s" : ""}
          </span>
          {!isExpanded && (
            <span className="text-[10px] text-[#64748B] tabular-nums">
              {stringCount} String{stringCount !== 1 ? "s" : ""}
              {" · "}
              {assignedCount} Assigned
              {" · "}
              {unassignedCount} Unassigned
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-1 px-3 pb-2.5 ml-3 border-l border-[#23324A]/50">
          {strings.length === 0 ? (
            <div className="pl-4 py-2 flex flex-col gap-1">
              <p className="text-[11px] text-[#94A3B8] font-medium">No Strings Created</p>
              <p className="text-[10px] text-[#64748B] leading-relaxed">
                Select panels and click
                <br />
                Create String
              </p>
            </div>
          ) : (
            strings.map((str, index) => (
              <StringTreeItem
                key={str.id}
                string={str}
                isSelected={selectedStringId === str.id}
                isLast={index === strings.length - 1}
                isEditing={editingStringId === str.id}
                editValue={stringEditValue}
                onSelect={() => onSelectString(str.id)}
                onStartRename={() => onStartStringRename(str)}
                onEditChange={onStringEditChange}
                onCommitRename={onCommitStringRename}
                onCancelRename={onCancelStringRename}
              />
            ))
          )}

          <div className="flex flex-col gap-0.5 pl-4 pt-1">
            <span className="text-[10px] text-[#64748B] tabular-nums">
              Assigned: {assignedCount}
            </span>
            <span className="text-[10px] text-[#64748B] tabular-nums">
              Unassigned: {unassignedCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArrayTree() {
  const {
    arrays,
    selectedArrayIds,
    selectArrayOnly,
    toggleArrayInSelection,
  } = useArraySelection();
  const { strings, selectedStringId, activeArrayId, renameArray, renameString } = useElectricalStore();
  const { selectStringOnly } = useStringSelection();

  const [editingArrayId, setEditingArrayId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editingStringId, setEditingStringId] = useState(null);
  const [stringEditValue, setStringEditValue] = useState("");
  const [renameError, setRenameError] = useState(null);
  const [expandedArrayIds, setExpandedArrayIds] = useState(() => new Set());

  const stringsByArray = useMemo(() => {
    const map = new Map();
    for (const arr of arrays) {
      map.set(arr.id, stringsInArray(strings, arr));
    }
    return map;
  }, [arrays, strings]);

  useEffect(() => {
    if (selectedStringId) {
      const str = strings.find((s) => s.id === selectedStringId);
      if (str?.arrayId) {
        setExpandedArrayIds((prev) => new Set(prev).add(str.arrayId));
      }
    }
  }, [selectedStringId, strings]);

  useEffect(() => {
    if (activeArrayId && strings.some((s) => s.arrayId === activeArrayId)) {
      setExpandedArrayIds((prev) => new Set(prev).add(activeArrayId));
    }
  }, [strings, activeArrayId]);

  const toggleExpand = (arrayId) => {
    setExpandedArrayIds((prev) => {
      const next = new Set(prev);
      if (next.has(arrayId)) next.delete(arrayId);
      else next.add(arrayId);
      return next;
    });
  };

  const startRename = (array) => {
    setEditingArrayId(array.id);
    setEditValue(array.displayName);
  };

  const commitRename = (array) => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== array.displayName) {
      renameArray(array.id, trimmed);
    }
    setEditingArrayId(null);
    setEditValue("");
  };

  const cancelRename = () => {
    setEditingArrayId(null);
    setEditValue("");
  };

  const startStringRename = (str) => {
    setEditingStringId(str.id);
    setStringEditValue(str.displayName);
    setRenameError(null);
  };

  const commitStringRename = (str) => {
    const trimmed = stringEditValue.trim();
    if (!trimmed || trimmed === str.displayName) {
      setEditingStringId(null);
      setStringEditValue("");
      setRenameError(null);
      return;
    }
    const result = renameString(str.id, trimmed);
    if (!result.ok) {
      setRenameError(result.reason);
      return;
    }
    setEditingStringId(null);
    setStringEditValue("");
    setRenameError(null);
  };

  const cancelStringRename = () => {
    setEditingStringId(null);
    setStringEditValue("");
    setRenameError(null);
  };

  const handleSelectString = (stringId) => {
    selectStringOnly(stringId);
  };

  const handleSelectArray = (arrayId) => {
    selectArrayOnly(arrayId);
    setExpandedArrayIds((prev) => new Set(prev).add(arrayId));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Arrays & Strings</span>
        <span className="text-[9px] text-[#4a5c75]">Electrical panel groupings</span>
      </div>

      {renameError && (
        <p className="text-[10px] text-[#FFB547] leading-relaxed px-0.5">{renameError}</p>
      )}

      {arrays.length === 0 ? (
        <p className="text-[11px] text-[#4a5c75] leading-relaxed px-1">
          No arrays yet. Complete panel placement on Step 6, then return here.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {arrays.map((array) => {
            const arrayStrings = stringsByArray.get(array.id) ?? [];
            const unassigned = getUnassignedCount(array, strings);
            const assigned = assignedPanelCount(array, strings);
            const isArraySelected = selectedArrayIds.includes(array.id);
            const isExpanded = expandedArrayIds.has(array.id)
              || (selectedStringId != null && arrayStrings.some((s) => s.id === selectedStringId))
              || (isArraySelected && selectedArrayIds.length === 1);

            return (
              <ArrayTreeItem
                key={array.id}
                array={array}
                strings={arrayStrings}
                assignedCount={assigned}
                unassignedCount={unassigned}
                isSelected={isArraySelected}
                isExpanded={isExpanded}
                selectedStringId={selectedStringId}
                isEditing={editingArrayId === array.id}
                editValue={editValue}
                onToggleExpand={() => toggleExpand(array.id)}
                onSelect={() => handleSelectArray(array.id)}
                onSelectAdditive={() => toggleArrayInSelection(array.id)}
                onSelectString={handleSelectString}
                onStartRename={() => startRename(array)}
                onEditChange={setEditValue}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
                editingStringId={editingStringId}
                stringEditValue={stringEditValue}
                onStartStringRename={startStringRename}
                onStringEditChange={setStringEditValue}
                onCommitStringRename={commitStringRename}
                onCancelStringRename={cancelStringRename}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
