/**
 * ElectricalWorkspace.jsx — Step 7 layout with Design + Electrical sections (P4).
 */
import { DIVIDER, PanelHeader, PanelShell } from "../../steps/panelUtils";
import Toolbar from "./Toolbar.jsx";
import ArrayTree from "./LeftSidebar/ArrayTree.jsx";
import ElectricalTree from "./LeftSidebar/ElectricalTree.jsx";
import InverterCatalog from "./InverterCatalog.jsx";
import PropertiesPanel from "./PropertiesPanel.jsx";
import ElectricalCanvasOverlay from "./Canvas/ElectricalCanvasOverlay.jsx";

function SectionLabel({ children }) {
  return (
    <span className="text-[9px] font-bold tracking-[0.18em] text-[#64748B] uppercase">
      {children}
    </span>
  );
}

export default function ElectricalWorkspace() {
  return (
    <PanelShell>
      <PanelHeader
        step={7}
        label="Electrical Design"
        subtitle="Arrays, strings, and inverter configuration"
        pill={(
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4F8CFF]/10 border border-[#4F8CFF]/25">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4F8CFF]" />
            <span className="text-[10px] font-semibold text-[#4F8CFF]">Active</span>
          </div>
        )}
      />

      <Toolbar />

      {DIVIDER}

      <InverterCatalog />

      {DIVIDER}

      <div className="flex flex-col gap-3">
        <SectionLabel>Design</SectionLabel>
        <ArrayTree />
      </div>

      {DIVIDER}

      <div className="flex flex-col gap-3">
        <SectionLabel>Electrical</SectionLabel>
        <ElectricalTree />
      </div>

      {DIVIDER}

      <ElectricalCanvasOverlay />

      {DIVIDER}

      <PropertiesPanel />
    </PanelShell>
  );
}
