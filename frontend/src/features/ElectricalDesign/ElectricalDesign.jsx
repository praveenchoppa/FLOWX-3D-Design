/**
 * ElectricalDesign.jsx — Step 7 entry: store provider + minimal electrical workspace.
 *
 * Consumes placement output read-only via panelProps. Does not mutate upstream state.
 */
import { useCallback } from "react";

import { ElectricalStoreProvider } from "./store/electricalStore.jsx";
import ElectricalWorkspace from "./components/ElectricalWorkspace.jsx";

export default function ElectricalDesign({
  panelLayout = null,
  baselinePanelLayout = null,
  placementReady = null,
  placementAreas = [],
  usePlacementAreaPanelWorkflow = false,
  projectPanelDefaults = null,
  selectedPanel = null,
  roofSections = [],
  persistedArrays = [],
  persistedTerminationPoint = null,
  onArraysChange = () => {},
  onTerminationPointChange = () => {},
  onElectricalSelectionChange = () => {},
  onRegisterElectricalPanelPickHandlers = () => {},
  onRegisterArrayToolHandlers = () => {},
  onRegisterTerminationHandlers = () => {},
  designCentre = null,
}) {
  const handleSelectionChange = useCallback(
    (info) => onElectricalSelectionChange(info),
    [onElectricalSelectionChange],
  );

  const handleRegisterHandlers = useCallback(
    (handlers) => onRegisterElectricalPanelPickHandlers(handlers),
    [onRegisterElectricalPanelPickHandlers],
  );

  const handleRegisterArrayTools = useCallback(
    (handlers) => onRegisterArrayToolHandlers(handlers),
    [onRegisterArrayToolHandlers],
  );

  const handleRegisterTerminationHandlers = useCallback(
    (handlers) => onRegisterTerminationHandlers(handlers),
    [onRegisterTerminationHandlers],
  );

  return (
    <ElectricalStoreProvider
      active
      panelLayout={panelLayout}
      baselinePanelLayout={baselinePanelLayout}
      placementReady={placementReady}
      placementAreas={placementAreas}
      usePlacementAreaPanelWorkflow={usePlacementAreaPanelWorkflow}
      projectPanelDefaults={projectPanelDefaults}
      selectedPanel={selectedPanel}
      roofSections={roofSections}
      designCentre={designCentre}
      persistedArrays={persistedArrays}
      persistedTerminationPoint={persistedTerminationPoint}
      onArraysChange={onArraysChange}
      onTerminationPointChange={onTerminationPointChange}
      onRegisterArrayToolHandlers={handleRegisterArrayTools}
      onRegisterTerminationHandlers={handleRegisterTerminationHandlers}
      onSelectionChange={handleSelectionChange}
      onRegisterPanelPickHandlers={handleRegisterHandlers}
    >
      <ElectricalWorkspace />
    </ElectricalStoreProvider>
  );
}
