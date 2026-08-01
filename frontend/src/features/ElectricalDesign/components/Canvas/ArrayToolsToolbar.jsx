/**
 * ArrayToolsToolbar.jsx — Step 7 array rotate + freeze controls (canvas overlay).
 */
import { useCallback, useEffect, useState } from "react";
import { FiLock, FiRotateCcw, FiUnlock } from "react-icons/fi";

export default function ArrayToolsToolbar({
  array = null,
  onRotateArray = () => {},
  onSetArrayFrozen = () => {},
}) {
  const [rotationDeg, setRotationDeg] = useState(0);
  const [showRotate, setShowRotate] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRotationDeg(array?.rotationDeg ?? 0);
    setError(null);
    setShowRotate(false);
  }, [array?.id, array?.rotationDeg]);

  const runWithConfirm = useCallback(async (action) => {
    setError(null);
    let result = action(false);
    if (result?.needsConfirm) {
      const confirmed = window.confirm(result.message);
      if (!confirmed) return;
      result = action(true);
    }
    if (result?.ok === false && result.reason) {
      setError(result.reason);
    }
  }, []);

  const handleApplyRotation = useCallback(() => {
    if (!array) return;
    runWithConfirm((confirmed) => onRotateArray(array.id, rotationDeg, { confirmed }));
  }, [array, rotationDeg, onRotateArray, runWithConfirm]);

  const handleToggleFreeze = useCallback(() => {
    if (!array) return;
    const nextFrozen = !array.frozen;
    if (nextFrozen) {
      const result = onSetArrayFrozen(array.id, true);
      if (result?.ok === false && result.reason) setError(result.reason);
      return;
    }
    runWithConfirm((confirmed) => onSetArrayFrozen(array.id, false, { confirmed }));
  }, [array, onSetArrayFrozen, runWithConfirm]);

  if (!array) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1 p-1 bg-[rgba(16,27,45,0.88)] backdrop-blur-xl border border-[#23324A] rounded-full shadow-lg">
        <button
          type="button"
          onClick={() => setShowRotate((v) => !v)}
          title="Rotate array"
          className={[
            "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
            showRotate
              ? "bg-[#06B6D4] text-white shadow-sm"
              : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5",
          ].join(" ")}
        >
          <FiRotateCcw size={14} />
          <span>Rotate</span>
        </button>
        <div className="w-px h-5 bg-[#23324A] mx-1" />
        <button
          type="button"
          onClick={handleToggleFreeze}
          title={array.frozen ? "Unfreeze array" : "Freeze array"}
          className={[
            "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
            array.frozen
              ? "bg-[#F59E0B]/20 text-[#FBBF24] border border-[#F59E0B]/30"
              : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5",
          ].join(" ")}
        >
          {array.frozen ? <FiLock size={14} /> : <FiUnlock size={14} />}
          <span>{array.frozen ? "Unfreeze" : "Freeze"}</span>
        </button>
      </div>

      {showRotate && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[rgba(16,27,45,0.92)] backdrop-blur-xl border border-[#23324A] rounded-xl shadow-lg">
          <label className="flex items-center gap-2 text-[12px] text-[#94A3B8]">
            <span className="whitespace-nowrap">Rotation</span>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={Math.round(rotationDeg) % 360}
              onChange={(e) => setRotationDeg(Number(e.target.value))}
              className="w-32 accent-[#06B6D4]"
            />
            <input
              type="number"
              min={0}
              max={359}
              step={1}
              value={Math.round(rotationDeg) % 360}
              onChange={(e) => setRotationDeg(Number(e.target.value))}
              className="w-14 px-1.5 py-0.5 rounded bg-[#0B1220] border border-[#23324A] text-[#F8FAFC] text-[12px] tabular-nums"
            />
            <span className="text-[#64748B]">°</span>
          </label>
          <button
            type="button"
            onClick={handleApplyRotation}
            disabled={array.frozen}
            className={[
              "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
              array.frozen
                ? "text-[#64748B] cursor-not-allowed"
                : "bg-[#06B6D4] text-white hover:bg-[#0891B2]",
            ].join(" ")}
          >
            Apply
          </button>
        </div>
      )}

      {error && (
        <div className="max-w-md px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 text-center">
          {error}
        </div>
      )}
    </div>
  );
}
