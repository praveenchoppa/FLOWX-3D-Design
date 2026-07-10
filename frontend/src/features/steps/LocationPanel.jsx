/**
 * LocationPanel — Step 1 right-hand panel.
 *
 * Content: property information, roof detection method toggle, AI detect CTA,
 * basic roof output KPIs, and step instructions.
 *
 * All functionality is identical to the old PropertiesPanel Step-1 block —
 * this file just relocates it into the step controller architecture.
 */
import { HiLightningBolt } from "react-icons/hi";
import {
  PanelShell,
  PanelHeader,
  DataRow,
  KpiCard,
  InstructionList,
  DIVIDER,
  SEC_LABEL,
} from "./panelUtils";

export default function LocationPanel({
  location,
  selectedDetectionMethod,
  setSelectedDetectionMethod,
  roofSections,
  selectedRoofId,
  roofCount,
  totalAreaM2,
}) {
  const hasLocation = location.lat != null && location.lng != null;

  const totalVertices  = roofSections.reduce((s, sec) => s + (sec.vertexCount ?? 0), 0);
  const roofCreated    = roofSections.length > 0;
  const roofStatusValue  = roofCreated ? "Created"       : "Not Created";
  const roofStatusAccent = roofCreated ? "text-[#00E38C]" : "text-[#94A3B8]";

  const selectedSection = roofSections.find((s) => s.id === selectedRoofId);
  const selectedAreaM2  = selectedSection?.areaM2 ?? 0;

  return (
    <PanelShell>

      {/* ── Header ────────────────────────────────── */}
      <PanelHeader
        label="Location"
        subtitle="Roof Detection Module"
      />

      {DIVIDER}

      {/* ── Property Information ──────────────────── */}
      <div>
        <span className={SEC_LABEL}>Property Information</span>
        <div className="rounded-xl border border-[#23324A] overflow-hidden">
          <DataRow label="Address"   value={hasLocation ? location.address || "—" : "—"} />
          <DataRow label="Latitude"  value={hasLocation ? `${location.lat.toFixed(4)}° N` : "—"} />
          <DataRow label="Longitude" value={hasLocation ? `${location.lng.toFixed(4)}° E` : "—"} isLast />
        </div>
      </div>

      {DIVIDER}

      {/* ── Roof Detection ────────────────────────── */}
      <div className="flex flex-col gap-3">
        <span className={SEC_LABEL}>Roof Detection</span>

        {/* Auto / Manual segmented toggle */}
        <div className="flex p-1 bg-[rgba(7,17,32,0.6)] border border-[#23324A] rounded-full">
          {[
            { value: "auto",   label: "Auto Detect" },
            { value: "manual", label: "Manual Draw"  },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSelectedDetectionMethod(value)}
              className={`flex-1 py-2 rounded-full text-xs font-medium transition-all duration-150 ${
                selectedDetectionMethod === value
                  ? "bg-[#4F8CFF] text-white shadow-sm"
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Detect Roof CTA — placeholder until Google Solar API */}
        <div className="flex flex-col gap-2">
          <button
            disabled
            className="w-full py-3 rounded-xl bg-[#4F8CFF] text-sm font-semibold text-white flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
          >
            <HiLightningBolt size={14} />
            Detect Roof using AI
          </button>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] text-[#94A3B8]">Powered by</span>
            <span className="text-[10px] font-medium text-[#4F8CFF]">Google Solar API</span>
            <div className="w-px h-3 bg-[#23324A]" />
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#FFB547]/10 border border-[#FFB547]/30 text-[#FFB547]">
              Coming Soon
            </span>
          </div>
        </div>
      </div>

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
            label="Total Area"
            value={totalAreaM2 > 0 ? `${totalAreaM2.toFixed(1)} m²` : "0.0 m²"}
          />
        </div>
      </div>

      {DIVIDER}

      {/* ── Instructions ──────────────────────────── */}
      <InstructionList items={[
        "Search or drop a pin to set the project location",
        "Drag the marker onto the exact building",
        "Switch to Manual Draw and trace the roof outline",
        "Draw each roof section separately",
        "Click Next once at least one roof section is drawn",
      ]} />

    </PanelShell>
  );
}
