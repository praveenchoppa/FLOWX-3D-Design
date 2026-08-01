/**
 * panelConfigFields.jsx — Shared panel configuration form fields (Step 6).
 */
import { PANEL_TYPES } from "../panels/panelTypes";
import { ORIENTATIONS, MOUNT_TYPES } from "../panels/panelConfig";

function ConfigField({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-[#94A3B8]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-[rgba(7,17,32,0.6)] border border-[#23324A] text-[13px] text-[#F8FAFC] outline-none focus:border-[#4F8CFF] disabled:opacity-50 disabled:cursor-not-allowed";

const selectClass = `${inputClass} cursor-pointer`;

export function PanelConfigFields({
  config,
  readOnly,
  onPatch,
}) {
  return (
    <div className="flex flex-col gap-3">
      <ConfigField label="Target Capacity (kW)">
        <input
          type="number"
          min="0"
          step="0.1"
          value={config.designGoal?.targetCapacityKW ?? ""}
          disabled={readOnly}
          onChange={(e) => onPatch({
            designGoal: {
              type: "capacity",
              targetCapacityKW: Number(e.target.value),
            },
          })}
          className={inputClass}
        />
      </ConfigField>

      <ConfigField label="Module">
        <select
          value={config.moduleId}
          disabled={readOnly}
          onChange={(e) => onPatch({ moduleId: e.target.value })}
          className={selectClass}
        >
          {PANEL_TYPES.map((mod) => (
            <option key={mod.id} value={mod.id}>
              {mod.manufacturer} {mod.model} — {mod.powerW}W
            </option>
          ))}
        </select>
      </ConfigField>

      <ConfigField label="Orientation">
        <div className="flex gap-1 p-1 rounded-full bg-[rgba(7,17,32,0.6)] border border-[#23324A]">
          {[
            { key: ORIENTATIONS.PORTRAIT, label: "Portrait" },
            { key: ORIENTATIONS.LANDSCAPE, label: "Landscape" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              disabled={readOnly}
              onClick={() => onPatch({ orientation: key })}
              className={`flex-1 px-3 py-2 rounded-full text-[11px] font-medium transition-all duration-150 disabled:opacity-50 ${
                config.orientation === key
                  ? "bg-[#4F8CFF] text-white"
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </ConfigField>

      <div className="grid grid-cols-2 gap-2">
        <ConfigField label="Tilt (°)">
          <input
            type="number"
            min="0"
            max="90"
            step="1"
            value={config.tilt}
            disabled={readOnly}
            onChange={(e) => onPatch({ tilt: Number(e.target.value) })}
            className={inputClass}
          />
        </ConfigField>
        <ConfigField label="Azimuth (°)">
          <input
            type="number"
            min="0"
            max="360"
            step="1"
            value={config.azimuth}
            disabled={readOnly}
            onChange={(e) => onPatch({ azimuth: Number(e.target.value) })}
            className={inputClass}
          />
        </ConfigField>
      </div>

      <ConfigField label="Mount Type">
        <select
          value={config.mountType}
          disabled={readOnly}
          onChange={(e) => onPatch({ mountType: e.target.value })}
          className={selectClass}
        >
          <option value={MOUNT_TYPES.FLUSH}>Flush mount</option>
          <option value={MOUNT_TYPES.TILTED}>Tilted mount</option>
          <option value={MOUNT_TYPES.BALLASTED}>Ballasted</option>
        </select>
      </ConfigField>

      <ConfigField label="Mount Height (m)">
        <input
          type="number"
          min="0"
          max="3"
          step="0.05"
          value={config.mountHeight}
          disabled={readOnly}
          onChange={(e) => onPatch({ mountHeight: Number(e.target.value) })}
          className={inputClass}
        />
      </ConfigField>
    </div>
  );
}

export { inputClass, selectClass, ConfigField };
