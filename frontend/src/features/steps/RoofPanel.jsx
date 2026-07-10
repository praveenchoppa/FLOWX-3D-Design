/**
 * RoofPanel — Step 2 right-hand panel.
 *
 * Content: section list (add/rename/delete/select), selected-section metadata
 * form, full KPI outputs with usable area, design-level summary, and step
 * instructions.
 *
 * All functionality is identical to the Step-2a block in the old PropertiesPanel
 * — this file just relocates it into the step controller architecture.
 */
import { useState, useEffect } from "react";
import { FiTrash2, FiPlus } from "react-icons/fi";
import {
  PanelShell,
  PanelHeader,
  DataRow,
  KpiCard,
  InstructionList,
  DIVIDER,
  SEC_LABEL,
} from "./panelUtils";

// ── Constants ──────────────────────────────────────────────────────────────

const COMPASS_DIRS = [
  { label: "N",  deg: 0   },
  { label: "NE", deg: 45  },
  { label: "E",  deg: 90  },
  { label: "SE", deg: 135 },
  { label: "S",  deg: 180 },
  { label: "SW", deg: 225 },
  { label: "W",  deg: 270 },
  { label: "NW", deg: 315 },
];
const AZIMUTH_PRESETS = new Set([0, 45, 90, 135, 180, 225, 270, 315]);
const PITCH_PRESETS   = new Set([0, 10, 20, 30, 45]);
const ROOF_TYPES      = ["Flat RCC", "Metal Sheet", "Tile Roof", "Industrial Shed", "Custom"];

function degreesToCompass(deg) {
  const d    = ((deg % 360) + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(d / 45) % 8];
}

const INPUT_CLS =
  "w-full bg-[rgba(7,17,32,0.7)] border border-[#23324A] rounded-lg px-2.5 py-1.5 " +
  "text-xs text-[#F8FAFC] outline-none focus:border-[#4F8CFF] transition-colors";

const SELECT_CLS = INPUT_CLS + " cursor-pointer";

// ── Sub-components ─────────────────────────────────────────────────────────

/**
 * One row in the section list.
 * Single-click → select. Double-click name → inline rename.
 */
function SectionListItem({ sec, isSelected, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(sec.name);

  useEffect(() => { setNameVal(sec.name); }, [sec.name]);

  const commitRename = () => {
    const trimmed = nameVal.trim();
    onRename(trimmed || sec.name);
    setNameVal(trimmed || sec.name);
    setEditing(false);
  };

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-all duration-150 ${
        isSelected
          ? "bg-[#4F8CFF]/10 border-[#4F8CFF]/30"
          : "border-transparent bg-[rgba(7,17,32,0.35)] hover:bg-[#162338] hover:border-[#23324A]"
      }`}
    >
      {editing ? (
        <input
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter")  commitRename();
            if (e.key === "Escape") { setNameVal(sec.name); setEditing(false); }
          }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent text-xs text-[#F8FAFC] outline-none border-b border-[#4F8CFF] pb-0.5"
        />
      ) : (
        <span
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="flex-1 text-xs text-[#F8FAFC] truncate"
          title="Double-click to rename"
        >
          {sec.name}
        </span>
      )}

      <span className="text-[10px] text-[#94A3B8] shrink-0 tabular-nums">
        {(sec.areaM2 ?? 0).toFixed(1)} m²
      </span>

      {sec.metadataSource === "default" && (
        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#FFB547]/10 border border-[#FFB547]/20 text-[#FFB547] shrink-0">
          defaults
        </span>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-[#94A3B8] hover:text-red-400 transition-colors shrink-0 ml-0.5"
        title="Delete section"
      >
        <FiTrash2 size={11} />
      </button>
    </div>
  );
}

/** Label + control(s) row for the metadata form. */
function MetaRow({ label, children }) {
  return (
    <div className="flex items-start gap-2 mb-2.5">
      <span className="text-[10px] text-[#94A3B8] shrink-0 w-[72px] pt-1.5 leading-tight">
        {label}
      </span>
      <div className="flex-1 flex gap-2 items-center">{children}</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function RoofPanel({
  roofSections,
  selectedRoofId,
  setSelectedRoofId,
  roofCount,
  totalAreaM2,
  totalUsableAreaM2,
  updateSection,
  renameSection,
  onAddSection,
  onDeleteSection,
}) {
  const totalVertices  = roofSections.reduce((s, sec) => s + (sec.vertexCount ?? 0), 0);
  const roofCreated    = roofSections.length > 0;
  const roofStatusValue  = roofCreated ? "Created"       : "Not Created";
  const roofStatusAccent = roofCreated ? "text-[#00E38C]" : "text-[#94A3B8]";

  const selectedSection  = roofSections.find((s) => s.id === selectedRoofId);
  const selectedAreaM2   = selectedSection?.areaM2      ?? 0;
  const selectedUsableM2 = selectedSection?.usableAreaM2 ?? 0;

  return (
    <PanelShell>

      {/* ── Header ────────────────────────────────── */}
      <PanelHeader
        label="Roof"
        subtitle="Roof Configuration Module"
      />

      {DIVIDER}

      {/* ── Roof Sections ─────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={SEC_LABEL} style={{ marginBottom: 0 }}>Roof Sections</span>
          <button
            onClick={onAddSection}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium text-[#4F8CFF] border border-[#4F8CFF]/30 bg-[#4F8CFF]/8 hover:bg-[#4F8CFF]/15 transition-all duration-150"
          >
            <FiPlus size={10} />
            Add
          </button>
        </div>

        {roofSections.length === 0 ? (
          <p className="text-[11px] text-[#94A3B8] py-1">
            No sections yet. Click Add or use the Draw tool on the map.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {roofSections.map((sec) => (
              <SectionListItem
                key={sec.id}
                sec={sec}
                isSelected={sec.id === selectedRoofId}
                onSelect={() => setSelectedRoofId(sec.id)}
                onRename={(name) => renameSection(sec.id, name)}
                onDelete={() => onDeleteSection(sec.id)}
              />
            ))}
          </div>
        )}
      </div>

      {DIVIDER}

      {/* ── Selected Section — Metadata ───────────── */}
      {selectedSection ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className={SEC_LABEL} style={{ marginBottom: 0 }}>
              {selectedSection.name} — Config
            </span>
            {selectedSection.metadataSource === "default" && (
              <span className="text-[8px] px-2 py-0.5 rounded-full bg-[#FFB547]/10 border border-[#FFB547]/25 text-[#FFB547]">
                assumed defaults
              </span>
            )}
          </div>

          {/* Source toggle — Manual active; Auto disabled placeholder */}
          <div className="flex p-1 bg-[rgba(7,17,32,0.6)] border border-[#23324A] rounded-full">
            <button className="flex-1 py-1.5 rounded-full text-[10px] font-medium bg-[#4F8CFF] text-white">
              Manual
            </button>
            <button
              disabled
              title="Auto metadata from Google Solar API — coming soon"
              className="flex-1 py-1.5 rounded-full text-[10px] font-medium text-[#94A3B8] opacity-40 cursor-not-allowed"
            >
              Auto (Solar API)
            </button>
          </div>

          {/* Metadata form */}
          <div className="rounded-xl border border-[#23324A] px-3 py-3">

            {/* Roof Type */}
            <MetaRow label="Roof Type">
              <select
                value={selectedSection.roofType ?? "Flat RCC"}
                onChange={(e) =>
                  updateSection(selectedSection.id, { roofType: e.target.value })
                }
                className={SELECT_CLS}
              >
                {ROOF_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </MetaRow>

            {/* Pitch — preset dropdown + exact number input */}
            <MetaRow label="Pitch">
              <select
                value={PITCH_PRESETS.has(selectedSection.pitch) ? selectedSection.pitch : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom")
                    updateSection(selectedSection.id, { pitch: Number(e.target.value) });
                }}
                className={`${SELECT_CLS} flex-1`}
              >
                <option value={0}>Flat — 0°</option>
                <option value={10}>10°</option>
                <option value={20}>20°</option>
                <option value={30}>30°</option>
                <option value={45}>45°</option>
                <option value="custom">Custom…</option>
              </select>
              <input
                type="number"
                min={0}
                max={60}
                value={selectedSection.pitch ?? 0}
                onChange={(e) => {
                  const v = Math.min(60, Math.max(0, Number(e.target.value) || 0));
                  updateSection(selectedSection.id, { pitch: v });
                }}
                className={`${INPUT_CLS} w-16`}
              />
              <span className="text-[10px] text-[#94A3B8] shrink-0">°</span>
            </MetaRow>

            {/* Azimuth — compass preset + degree input */}
            <MetaRow label="Azimuth">
              <select
                value={AZIMUTH_PRESETS.has(selectedSection.azimuth) ? selectedSection.azimuth : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom")
                    updateSection(selectedSection.id, { azimuth: Number(e.target.value) });
                }}
                className={`${SELECT_CLS} flex-1`}
              >
                {COMPASS_DIRS.map(({ label, deg }) => (
                  <option key={deg} value={deg}>{label} — {deg}°</option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              <input
                type="number"
                min={0}
                max={360}
                value={selectedSection.azimuth ?? 180}
                onChange={(e) => {
                  const v = Math.min(360, Math.max(0, Number(e.target.value) || 0));
                  updateSection(selectedSection.id, { azimuth: v });
                }}
                className={`${INPUT_CLS} w-16`}
              />
              <span className="text-[10px] text-[#94A3B8] shrink-0">
                {degreesToCompass(selectedSection.azimuth ?? 180)}
              </span>
            </MetaRow>

            {/* Height */}
            <MetaRow label="Height (m)">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={selectedSection.height ?? 3}
                onChange={(e) => {
                  const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                  updateSection(selectedSection.id, { height: v });
                }}
                className={INPUT_CLS}
              />
            </MetaRow>

            {/* Setback */}
            <MetaRow label="Setback (m)">
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={selectedSection.setback ?? 0.5}
                onChange={(e) => {
                  const v = Math.min(5, Math.max(0, Number(e.target.value) || 0));
                  updateSection(selectedSection.id, { setback: v });
                }}
                className={INPUT_CLS}
              />
              <span className="text-[10px] text-[#94A3B8] shrink-0 whitespace-nowrap">
                → {(selectedSection.usableAreaM2 ?? 0).toFixed(1)} m²
              </span>
            </MetaRow>
          </div>
        </div>
      ) : (
        roofSections.length > 0 && (
          <p className="text-[11px] text-[#94A3B8]">
            Click a roof section in the list or on the map to configure it.
          </p>
        )
      )}

      {DIVIDER}

      {/* ── Roof Outputs ──────────────────────────── */}
      <div className="flex flex-col gap-3">
        <span className={SEC_LABEL}>Roof Outputs</span>

        <div className="flex gap-2">
          <KpiCard label="Roof Status"  value={roofStatusValue}  accent={roofStatusAccent} />
          <KpiCard label="No. of Roofs" value={String(roofCount)} />
          <KpiCard label="Vertices"     value={String(totalVertices)} />
        </div>

        <div className="flex gap-2">
          <KpiCard
            label="Selected Area"
            value={selectedAreaM2 > 0 ? `${selectedAreaM2.toFixed(1)} m²` : "0.0 m²"}
          />
          <KpiCard
            label="Usable (selected)"
            value={selectedUsableM2 > 0 ? `${selectedUsableM2.toFixed(1)} m²` : "0.0 m²"}
            accent="text-[#00E38C]"
          />
        </div>

        <div className="flex gap-2">
          <KpiCard
            label="Total Area"
            value={totalAreaM2 > 0 ? `${totalAreaM2.toFixed(1)} m²` : "0.0 m²"}
          />
          <KpiCard
            label="Total Usable"
            value={totalUsableAreaM2 > 0 ? `${totalUsableAreaM2.toFixed(1)} m²` : "0.0 m²"}
            accent="text-[#00E38C]"
          />
        </div>
      </div>

      {DIVIDER}

      {/* ── Design Summary ────────────────────────── */}
      <div>
        <span className={SEC_LABEL}>Design Summary</span>
        <div className="rounded-xl border border-[#23324A] overflow-hidden">
          <DataRow label="Total Roof Area"  value={totalAreaM2 > 0        ? `${totalAreaM2.toFixed(2)} m²`        : "—"} />
          <DataRow label="Usable Roof Area" value={totalUsableAreaM2 > 0  ? `${totalUsableAreaM2.toFixed(2)} m²`  : "—"} />
          <DataRow label="Roof Count"       value={roofCount > 0          ? String(roofCount)                     : "—"} />
          <DataRow label="Roof Faces"       value={roofCount > 0          ? String(roofCount)                     : "—"} isLast />
        </div>
      </div>

      {DIVIDER}

      {/* ── Instructions ──────────────────────────── */}
      <InstructionList items={[
        "Double-click a section name in the list to rename it",
        "Select a section to open its configuration",
        "Set the roof type, pitch, and azimuth for each section",
        "Adjust setback — usable area updates instantly",
        "Use the Draw tool to add more roof sections",
        "Click Next when all sections are configured",
      ]} />

    </PanelShell>
  );
}
