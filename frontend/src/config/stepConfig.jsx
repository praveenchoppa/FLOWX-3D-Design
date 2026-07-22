/**
 * STEP_CONFIG — single source of truth for the 11-step wizard.
 *
 * Each entry declares:
 *   step       — 1-indexed step number
 *   label      — display name (matches workflow in PROJECT_CONTEXT)
 *   Panel      — React component rendered in the right-hand panel for this step
 *   isComplete — predicate(appState) → boolean; Next is enabled only when true
 *
 * Built steps enforce real predicates; unbuilt steps use () => true so
 * the skeleton is fully navigable during development. Update the predicate and
 * swap the Panel when a step is implemented.
 *
 * Adding a new step = adding one object here. Zero changes elsewhere.
 */
import LocationPanel       from "../features/steps/LocationPanel";
import RoofPanel           from "../features/steps/RoofPanel";
import ObstaclePanel       from "../features/steps/ObstaclePanel";
import SimulationPanel     from "../features/steps/SimulationPanel";
import ZonesPanel          from "../features/steps/ZonesPanel";
import PanelsPanel         from "../features/steps/PanelsPanel";
import ElectricalDesign    from "../features/ElectricalDesign/ElectricalDesign";
import EnergyPanel         from "../features/steps/EnergyPanel";
import FinancialsPanel     from "../features/steps/FinancialsPanel";
import PresentationPanel   from "../features/steps/PresentationPanel";
import PlaceholderPanel    from "../features/steps/PlaceholderPanel";

export const STEP_CONFIG = [
  {
    step:  1,
    label: "Location",
    Panel: LocationPanel,
    // Requires a pin AND at least one drawn roof section.
    isComplete: (s) => s.location.lat != null && s.roofSections.length > 0,
  },
  {
    step:  2,
    label: "Roof",
    Panel: RoofPanel,
    // Metadata has sensible defaults, so the step is complete once any roof exists.
    isComplete: (s) => s.roofSections.length > 0,
  },
  {
    step:  3,
    label: "Obstacles",
    Panel: ObstaclePanel,
    // Obstacles are optional — the step is always passable.
    isComplete: () => true,
  },
  {
    step:  4,
    label: "Simulation",
    Panel: SimulationPanel,
    // Simulation is exploratory — always passable.
    isComplete: () => true,
  },
  { step: 5,  label: "Zones",            Panel: ZonesPanel,        isComplete: () => true },
  { step: 6,  label: "Panels",           Panel: PanelsPanel,       isComplete: () => true },
  { step: 7,  label: "Electrical Design", Panel: ElectricalDesign, isComplete: () => true },
  { step: 8,  label: "Energy",           Panel: EnergyPanel,       isComplete: () => true },
  { step: 9,  label: "Financials",       Panel: FinancialsPanel,   isComplete: () => true },
  { step: 10, label: "Visualization",    Panel: PresentationPanel, isComplete: () => true },
  { step: 11, label: "Project Summary",  Panel: PlaceholderPanel,  isComplete: () => true },
];
