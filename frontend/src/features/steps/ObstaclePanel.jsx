/**
 * ObstaclePanel — Step 3 right-hand panel.
 *
 * Lets the user pick an obstacle type, place primitives on the 3D roof (handled
 * in RoofView3D), then select and delete them.  When an obstacle is selected,
 * shows a transform section with sliders + number inputs for W/L/H/Scale/Rotation,
 * all wired to the shared obstacles[] model (single source of truth).
 *
 * Built entirely from the shared panel primitives (panelUtils) so it matches the
 * existing step panels (PROJECT_CONTEXT decision 9).
 */
import {
  FiDroplet, FiServer, FiWind, FiSquare,
  FiThermometer, FiBox, FiRadio, FiHexagon, FiTrash2,
} from "react-icons/fi";

import {
  PanelShell,
  PanelHeader,
  KpiCard,
  InstructionList,
  DIVIDER,
  SEC_LABEL,
} from "./panelUtils";

import { OBSTACLE_LIBRARY, obstacleFootprint } from "../obstacles/obstacleTypes";

// Icon map — a panel (presentation) concern, kept separate from the
// renderer-agnostic obstacle data model.
const TYPE_ICON = {
  "Water Tank":         FiDroplet,
  "AC Unit":            FiServer,
  "Vent":               FiWind,
  "Skylight":           FiSquare,
  "Solar Water Heater": FiThermometer,
  "Lift Room":          FiBox,
  "Dish Antenna":       FiRadio,
  "Custom Object":      FiHexagon,
};

function fmtArea(v) {
  return v > 0 ? `${v.toFixed(1)} m²` : "0.0 m²";
}

/**
 * A labelled range slider paired with a number input — both read from and
 * write to the same external value.  Neither keeps its own copy; all changes
 * flow immediately to the parent via onChange(newValue).
 */
function SliderField({ label, value, min, max, step, onChange, suffix = "" }) {
  const fmt = step < 1 ? 1 : 0;
  const handleNum = (e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[#94A3B8] shrink-0">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min} max={max} step={step}
            value={value.toFixed(fmt)}
            onChange={handleNum}
            className="w-[52px] text-right text-[11px] text-[#F8FAFC] bg-[rgba(7,17,32,0.6)] border border-[#23324A] rounded-lg px-2 py-[3px] tabular-nums outline-none focus:border-[#4F8CFF] transition-colors"
          />
          {suffix && (
            <span className="text-[10px] text-[#94A3B8]">{suffix}</span>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 cursor-pointer rounded-full appearance-none bg-[#23324A]"
        style={{ accentColor: "#4F8CFF" }}
      />
    </div>
  );
}

export default function ObstaclePanel({
  obstacles = [],
  roofSections = [],
  totalUsableAreaM2 = 0,
  selectedObstacleId,
  setSelectedObstacleId,
  placingObstacleType,
  startPlacing,
  deleteObstacle,
  updateObstacle,
  view3D,
  setView3D,
}) {
  const footprint   = obstacles.reduce((s, o) => s + obstacleFootprint(o), 0);
  const freeArea    = Math.max(totalUsableAreaM2 - footprint, 0);
  const selectedObs = obstacles.find((o) => o.id === selectedObstacleId) ?? null;

  const roofName = (roofId) =>
    roofSections.find((s) => s.id === roofId)?.name ?? "—";

  return (
    <PanelShell>

      {/* ── Header ────────────────────────────────── */}
      <PanelHeader
        label="Obstacles"
        subtitle="Obstacle Placement Module"
      />

      {DIVIDER}

      {/* ── 3D-required notice ────────────────────── */}
      {!view3D && (
        <button
          onClick={() => roofSections.length > 0 && setView3D(true)}
          className="w-full text-left px-3 py-2.5 rounded-xl bg-[#FFB547]/10 border border-[#FFB547]/25 text-[11px] text-[#FFB547] hover:bg-[#FFB547]/15 transition-colors"
        >
          Obstacles are placed in 3D. Click to switch to the 3D view.
        </button>
      )}

      {/* ── Obstacle Library ──────────────────────── */}
      <div className="flex flex-col gap-3">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Obstacle Library</span>

        <div className="grid grid-cols-2 gap-2">
          {OBSTACLE_LIBRARY.map((def) => {
            const Icon     = TYPE_ICON[def.type] ?? FiBox;
            const isActive = placingObstacleType === def.type;
            return (
              <button
                key={def.type}
                onClick={() => startPlacing(def.type)}
                title={`${def.width}×${def.length}×${def.height} m`}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 ${
                  isActive
                    ? "bg-[#4F8CFF]/15 border-[#4F8CFF]/40"
                    : "bg-[rgba(7,17,32,0.4)] border-[#23324A] hover:bg-[#162338] hover:border-[#2a3850]"
                }`}
              >
                <Icon
                  size={14}
                  className={isActive ? "text-[#4F8CFF]" : "text-[#94A3B8]"}
                />
                <span
                  className={`text-[11px] leading-tight ${
                    isActive ? "text-[#F8FAFC] font-medium" : "text-[#94A3B8]"
                  }`}
                >
                  {def.type}
                </span>
              </button>
            );
          })}
        </div>

        {placingObstacleType && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#4F8CFF]/10 border border-[#4F8CFF]/25">
            <span className="text-[10px] text-[#4F8CFF]">
              Click the roof to place <b>{placingObstacleType}</b> · Esc to stop
            </span>
            <button
              onClick={() => startPlacing(placingObstacleType)}
              className="text-[10px] font-medium text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {DIVIDER}

      {/* ── Placed Obstacles ──────────────────────── */}
      <div className="flex flex-col gap-2">
        <span className={SEC_LABEL} style={{ marginBottom: 0 }}>
          Placed Obstacles
        </span>

        {obstacles.length === 0 ? (
          <p className="text-[11px] text-[#94A3B8] py-1">
            None yet. Pick a type above, then click the 3D roof to place it.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {obstacles.map((o) => {
              const Icon       = TYPE_ICON[o.type] ?? FiBox;
              const isSelected = o.id === selectedObstacleId;
              return (
                <div
                  key={o.id}
                  onClick={() => setSelectedObstacleId(o.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-all duration-150 ${
                    isSelected
                      ? "bg-[#FFB547]/10 border-[#FFB547]/30"
                      : "border-transparent bg-[rgba(7,17,32,0.35)] hover:bg-[#162338] hover:border-[#23324A]"
                  }`}
                >
                  <Icon
                    size={12}
                    className={isSelected ? "text-[#FFB547]" : "text-[#94A3B8]"}
                  />
                  <span className="flex-1 text-xs text-[#F8FAFC] truncate">
                    {o.type}
                  </span>
                  <span className="text-[10px] text-[#94A3B8] shrink-0 truncate max-w-[80px]">
                    {roofName(o.roofId)}
                  </span>
                  <span className="text-[10px] text-[#94A3B8] shrink-0 tabular-nums">
                    {obstacleFootprint(o).toFixed(1)} m²
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteObstacle(o.id); }}
                    className="text-[#94A3B8] hover:text-red-400 transition-colors shrink-0 ml-0.5"
                    title="Delete obstacle"
                  >
                    <FiTrash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {DIVIDER}

      {/* ── Transform — shown only when an obstacle is selected ───────── */}
      {selectedObs && (() => {
        const s           = selectedObs.scale ?? 1;
        const effectiveW  = selectedObs.width  * s;
        const effectiveL  = selectedObs.length * s;
        const rotDeg      = ((selectedObs.rotation ?? 0) * 180) / Math.PI;
        const scalePct    = s * 100;

        const upd = (changes) => updateObstacle(selectedObs.id, changes);

        return (
          <div className="flex flex-col gap-4">
            <span className={SEC_LABEL} style={{ marginBottom: 0 }}>
              Transform — {selectedObs.type}
            </span>
            <p className="text-[10px] text-[#4a5c75] -mt-2">
              Use the gizmo in 3D, or edit here — all stay in sync.
            </p>

            <div className="flex flex-col gap-3">
              {/* Width — shows effective (base × scale) */}
              <SliderField
                label="Width"
                value={effectiveW}
                min={0.1} max={10} step={0.1}
                suffix="m"
                onChange={(v) => upd({ width: v / Math.max(s, 0.01) })}
              />
              {/* Length — shows effective (base × scale) */}
              <SliderField
                label="Length"
                value={effectiveL}
                min={0.1} max={10} step={0.1}
                suffix="m"
                onChange={(v) => upd({ length: v / Math.max(s, 0.01) })}
              />
              {/* Height — independent of scale */}
              <SliderField
                label="Height"
                value={selectedObs.height}
                min={0.1} max={10} step={0.1}
                suffix="m"
                onChange={(v) => upd({ height: v })}
              />
              {/* Scale — moves Width and Length together */}
              <SliderField
                label="Scale"
                value={scalePct}
                min={25} max={400} step={5}
                suffix="%"
                onChange={(v) => upd({ scale: v / 100 })}
              />
              {/* Rotation */}
              <SliderField
                label="Rotation"
                value={rotDeg}
                min={-180} max={180} step={1}
                suffix="°"
                onChange={(v) => upd({ rotation: (v * Math.PI) / 180 })}
              />
            </div>
          </div>
        );
      })()}

      {DIVIDER}

      {/* ── Obstacle Summary ──────────────────────── */}
      <div className="flex flex-col gap-3">
        <span className={SEC_LABEL}>Obstacle Summary</span>

        <div className="flex gap-2">
          <KpiCard label="Total Obstacles" value={String(obstacles.length)} />
          <KpiCard label="Footprint Area"  value={fmtArea(footprint)} />
        </div>

        <div className="flex gap-2">
          <KpiCard
            label="Usable (after setback)"
            value={fmtArea(totalUsableAreaM2)}
          />
          <KpiCard
            label="Remaining Free Area"
            value={fmtArea(freeArea)}
            accent="text-[#00E38C]"
          />
        </div>
      </div>

      {DIVIDER}

      {/* ── Instructions ──────────────────────────── */}
      <InstructionList items={[
        "Switch to the 3D view to place obstacles",
        "Pick an obstacle type from the library",
        "Click the roof deck to drop it — the type stays selected for more",
        "Press Esc or Stop to leave placement mode",
        "Click an obstacle to select it",
        "Use the toolbar (Move / Rotate / Scale) or sliders to transform it",
        "Delete removes the selected obstacle",
        "Remaining free area updates live as obstacles change",
      ]} />

    </PanelShell>
  );
}
