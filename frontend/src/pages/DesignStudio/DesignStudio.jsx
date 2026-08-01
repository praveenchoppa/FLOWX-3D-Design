import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { HiChevronRight, HiChevronLeft } from "react-icons/hi";
import { FiMap, FiBox, FiNavigation } from "react-icons/fi";

import {
  getSun, sampleSunArc, getDayTimes, sampleHourMarkers,
  SIM_END, SIM_NOON, presetDates,
} from "../../features/simulation/solar";
import { computeExposureResult } from "../../features/simulation/exposureScore";
import { computeZoneResult }    from "../../features/zones/zoneClassification";
import { computeZoneMerge }    from "../../features/zones/zoneMerge";
import {
  buildZoneDisplayList,
  computeEffectiveStats,
  countOrphanedEdits,
  cloneEngineeringPolygon,
} from "../../features/zones/zoneEditorUtils";
import {
  applyZoneStatisticsOverrides,
  runUpdateDesignStep0,
} from "../../features/zones/updateDesign";
import { DESIGN_STATE, ZONE_EDIT_MODES } from "../../features/zones/engineeringZoneConfig";
import { validateEngineeringPolygon } from "../../features/zones/zonePolygonValidation";
import { computeDesignCenter } from "../../features/view3d/roofGeometry3d";
import {
  autoNameBizZone,
  computeInstallableAfterBizZones,
} from "../../features/zones/bizZoneConfig";
import {
  autoNamePlacementArea,
  createPlacementAreaRecord,
  PLACEMENT_AREA_EDIT_MODES,
} from "../../features/placementAreas/placementAreaConfig";
import { validatePlacementAreaPolygon } from "../../features/placementAreas/placementAreaValidation";
import {
  enrichPlacementAreaWithStats,
  recomputePlacementAreaStats,
} from "../../features/placementAreas/placementAreaStatistics";
import { computePlacementReady } from "../../features/zones/placementReady";
import { DEFAULT_PANEL_ID, getPanelById } from "../../features/panels/panelTypes";
import {
  DEFAULT_PROJECT_PANEL_DEFAULTS,
  ORIENTATIONS,
  MOUNT_TYPES,
  resolvePlacementAreaConfig,
  createPlacementAreaConfigFromTemplate,
  migratePlacementAreas,
  isLegacyPanelProperties,
  panelForPlacement,
  placementLayoutFingerprint,
} from "../../features/panels/panelConfig";
import { buildRegionMountVisualMap } from "../../features/view3d/panelMountVisual.js";
import {
  GENERATE_MODES,
  computeAreaGeneratedLayoutRecord,
} from "../../features/panels/panelDesignGoal";
import {
  generateMultiAreaPanelLayout,
  EMPTY_PANEL_LAYOUT,
} from "../../features/panels/panelLayoutGenerator";
import { computePanelLayout } from "../../features/panels/panelPlacement";
import {
  computePanelArrays,
  reconcileArrayDisplayNames,
} from "../../features/panels/panelArrays";
import {
  panelShadingRefinement,
  buildRegionExposureOverrideFromRefinement,
} from "../../features/panels/panelShadingRefinement";
import { getWorkspaceVisibility, getMeasurementVisibility, resolvePlacementAreasVisible } from "../../features/studio/workspaceVisibility";
import {
  fetchSolarResource,
  roundLocationKey,
  solarResourceCache,
} from "../../features/energy/services/solarResourceService";
import { computeEnergyResult } from "../../features/energy/computeEnergyResult";
import { DEFAULT_FINANCIAL_INPUTS } from "../../features/financials/costConfig";
import { computeCostResult } from "../../features/financials/computeCostResult";
import { computeSavingsResult } from "../../features/financials/computeSavingsResult";
import { computeRoiResult } from "../../features/financials/computeRoiResult";
import { DEFAULT_CONSUMPTION_INPUTS } from "../../features/consumption/consumptionConfig";
import { computeConsumptionResult } from "../../features/consumption/computeConsumptionResult";
import { computeCoverageResult } from "../../features/consumption/computeCoverageResult";
import {
  applyPanelOverrides,
  reconcilePanelOverrides,
  resolveEffectivePanelLayout,
  overridesAfterRemove,
  overridesAfterAdd,
  overridesAfterMove,
  overridesAfterRotate,
  createPanelEditHistory,
  undoPanelEditHistory,
  redoPanelEditHistory,
  canUndoPanelEdit,
  canRedoPanelEdit,
  EMPTY_PANEL_OVERRIDES,
} from "../../features/panels/panelEditorUtils";
import { applyElectricalArrayRotations } from "../../features/ElectricalDesign/models/arrayRotation.js";
import ArrayToolsToolbar from "../../features/ElectricalDesign/components/Canvas/ArrayToolsToolbar.jsx";
import {
  validatePanelMove,
  validatePanelRotate,
  nearestSnapSlot,
  toggledOrientation,
} from "../../features/panels/panelEditValidation";
import {
  DEFAULT_PLACEMENT_PLANNING,
  PLACEMENT_MODES,
  CAPACITY_INPUT_MODES,
  computeLocationSpecificYield,
  resolveTargetCapacityKw,
  computePlacementLiveSummary,
} from "../../features/panels/panelCapacityPlanning";
import {
  buildTargetCapacityOverrides,
  buildFillRoofOverrides,
} from "../../features/panels/panelCapacitySelection";

// ── Panel resize constants ─────────────────────────────────────────────────────
const MIN_PANEL_W         = 360;  // minimum drag width
const MAX_PANEL_W         = 640;  // maximum drag width (panel chrome can exceed content)
const MAX_PANEL_CONTENT_W = 480;  // content stops stretching; extra width becomes side gutter
const COLLAPSED_PANEL_W   = 14;   // slim handle strip when collapsed

import HeaderBar    from "../../components/HeaderBar";
import MapView      from "../../features/map/MapView";
import RoofView3D   from "../../features/view3d/RoofView3D";
import ShowDimensionsControl from "../../features/measurements/ShowDimensionsControl";
import GlobalSimulationTool from "../../features/simulation/GlobalSimulationTool";
import PresentationLayersControl from "../../features/presentation/PresentationLayersControl";
import { DEFAULT_PRESENTATION_LAYERS } from "../../features/presentation/presentationLayersConfig";
import ProjectWorkspace from "../../features/project/ProjectWorkspace";
import { loadProjectMeta, saveProjectMeta } from "../../features/project/projectWorkspaceStorage";
import StepWizard   from "../../components/StepWizard";
import { UpdateDesignFloatingBar } from "../../features/steps/panelUtils";
import { STEP_CONFIG } from "../../config/stepConfig";
import { WIZARD_STEP } from "../../features/studio/workspaceVisibility";
import { computeUsableArea } from "../../utils/roofGeometry";
import { OBSTACLE_LIBRARY, createObstacle } from "../../features/obstacles/obstacleTypes";

export default function DesignStudio() {
  // ── Location ──────────────────────────────────────────────────────────────
  const [location, setLocation] = useState({ address: "", lat: null, lng: null });

  // ── Project meta (header name + Step 11 local persistence) — single source ─
  const [projectMeta, setProjectMeta] = useState(() => loadProjectMeta());
  const patchProjectMeta = useCallback((patch) => {
    setProjectMeta((prev) => saveProjectMeta({ ...prev, ...patch }));
  }, []);

  // ── Roof detection method ─────────────────────────────────────────────────
  const [selectedDetectionMethod, setSelectedDetectionMethod] = useState("auto");

  // ── Drawing tool — lifted so panel Add button can set it directly ─────────
  // 'draw' | 'edit' | 'delete' | 'pointer'
  // Contextual + mutually-exclusive (PROJECT_CONTEXT decision 8).
  const [activeTool, setActiveTool] = useState("pointer");

  // Default to Draw when entering Manual mode; Pointer on leaving.
  useEffect(() => {
    setActiveTool(selectedDetectionMethod === "manual" ? "draw" : "pointer");
  }, [selectedDetectionMethod]);

  // ── Roof sections (locked state shape — PROJECT_CONTEXT decision 3) ───────
  const [roofSections,   setRoofSections]   = useState([]);
  const [selectedRoofId, setSelectedRoofId] = useState(null);
  const [roofDetected,   setRoofDetected]   = useState(false); // placeholder for Google Solar API

  // ── Step controller ───────────────────────────────────────────────────────
  // currentStep:     1-indexed (1–11), mirrors STEP_CONFIG positions.
  // maxUnlockedStep: furthest step legitimately reached; controls wizard clicks.
  const [currentStep,      setCurrentStep]      = useState(1);
  const [maxUnlockedStep,  setMaxUnlockedStep]   = useState(1);

  // ── Panel collapse ────────────────────────────────────────────────────────
  // false = expanded (default); true = slid off-screen to the right.
  // MapView calls invalidateSize() after the CSS transition completes.
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // ── Panel drag-resize ─────────────────────────────────────────────────────
  // panelWidth persists across step changes (no reset).
  // mapResizeTick increments on drag-end to trigger Leaflet invalidateSize().
  const [panelWidth,    setPanelWidth]    = useState(MIN_PANEL_W);
  const [mapResizeTick, setMapResizeTick] = useState(0);
  // Ref to the outer panel wrapper so we can disable the CSS width-transition
  // imperatively during drag (prevents per-pixel transition lag).
  const panelOuterRef = useRef(null);

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;

    // Disable width transition for the duration of the drag
    if (panelOuterRef.current) panelOuterRef.current.style.transition = "none";
    document.body.style.cursor    = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(me) {
      // Dragging LEFT increases delta → panel widens; RIGHT decreases → narrows
      const newW = Math.min(
        Math.max(startW + (startX - me.clientX), MIN_PANEL_W),
        MAX_PANEL_W,
      );
      setPanelWidth(newW);
    }

    function onUp(me) {
      const newW = Math.min(
        Math.max(startW + (startX - me.clientX), MIN_PANEL_W),
        MAX_PANEL_W,
      );
      setPanelWidth(newW);
      // Re-enable transition after React has painted the final width so we
      // don't trigger a spurious animated transition at re-enable time.
      requestAnimationFrame(() => {
        if (panelOuterRef.current) panelOuterRef.current.style.transition = "";
      });
      // Trigger Leaflet invalidateSize (R3F auto-resizes via ResizeObserver)
      setMapResizeTick((t) => t + 1);
      document.body.style.cursor     = "";
      document.body.style.userSelect  = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }, [panelWidth]);

  const handlePanelTransitionEnd = useCallback((e) => {
    if (e.propertyName !== "width") return;
    setMapResizeTick((t) => t + 1);
  }, []);

  const handleCollapsePanel = useCallback(() => {
    setPanelCollapsed(true);
  }, []);

  const handleExpandPanel = useCallback(() => {
    setPanelCollapsed(false);
  }, []);

  // ── 2D / 3D view toggle ───────────────────────────────────────────────────
  // false = 2D Leaflet map (default); true = Three.js 3D workspace.
  // Gated: 3D is only enabled once at least one roof section exists.
  // The Leaflet map is kept mounted (display:none) in 3D mode so that geoman
  // layers are preserved and the user returns to the exact same 2D state.
  const [view3D, setView3D] = useState(false);
  // "perspective" = default 3/4 angle; "top" = bird's-eye overhead preset.
  // Only meaningful when view3D === true.
  const [cameraPreset, setCameraPreset] = useState("perspective");

  // ── Dynamic measurements (Phase 1 — visual overlay only) ─────────────────
  const [showDimensions, setShowDimensions] = useState(false);
  const [roofMeasureEditing, setRoofMeasureEditing] = useState(false);
  const [roofEditLive, setRoofEditLive] = useState(null);

  // ── Obstacles (Step 3 — renderer-agnostic source of truth) ────────────────
  // Each obstacle: { id, type, roofId, position:{x,z}, width, length, height,
  //                  scale, rotation }.  Lives only in the 3D view.
  const [obstacles,           setObstacles]           = useState([]);
  const [selectedObstacleId,  setSelectedObstacleId]  = useState(null);
  const [placingObstacleType, setPlacingObstacleType] = useState(null);
  // Active transform gizmo mode for Step 3. Shared by gizmo and panel toolbar.
  const [gizmoMode, setGizmoMode] = useState("translate");

  // ── Solar simulation (Step 4) ─────────────────────────────────────────────
  // Single source of truth: date + time-of-day drive both the panel stats and
  // the 3D sun/arc/shadows.  simMinutes is minutes-past-midnight in the daylight
  // window [SIM_START, SIM_END]; init at solar noon for a well-lit first view.
  const [simDay,     setSimDay]     = useState(() => presetDates().today);
  const [simMinutes, setSimMinutes] = useState(SIM_NOON);
  const [simPlaying, setSimPlaying] = useState(false);
  const [simSpeed,   setSimSpeed]   = useState(1); // 1× | 2× | 5×
  const [simToolExpanded, setSimToolExpanded] = useState(false);

  // ── Step 10 presentation layer visibility (display only) ─────────────────
  const [presentationLayers, setPresentationLayers] = useState(DEFAULT_PRESENTATION_LAYERS);
  const [layersPanelExpanded, setLayersPanelExpanded] = useState(false);

  const patchPresentationLayers = useCallback((patch) => {
    setPresentationLayers((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Shadow heatmap (Step 4B-1) ────────────────────────────────────────────
  // On-demand measured pass (separate from 4A's live shadows). The token bumps
  // to trigger a run inside the 3D scene; the result holds per-cell shade grids
  // (zoning's future input) + summary. Cleared when inputs change.
  const [shadowResult,   setShadowResult]   = useState(null);
  const [shadowRunning,  setShadowRunning]  = useState(false);
  const [shadowProgress, setShadowProgress] = useState(0);
  const [shadowRunToken, setShadowRunToken] = useState(0);
  const shadowRunTokenRef = useRef(0);
  const shadowRunningRef = useRef(false);
  const shadowResultRef = useRef(null);
  // Heatmap view: "shade" shows 4B shade %, "score" shows 4C exposure score.
  const [heatmapMode, setHeatmapMode] = useState("shade");

  // ── Business zones (Step 5D) ──────────────────────────────────────────────
  // User-drawn rectangle zones.  Persist across re-analyses (no regeneration).
  // Model: { id, kind:'business', businessType, outerRing, name, roofId, deleted }
  const [businessZones,     setBusinessZones]     = useState([]);
  const [isDrawingBizZone,  setIsDrawingBizZone]  = useState(false);
  const [pendingBizType,    setPendingBizType]     = useState("restricted");
  const [selectedBizZoneId, setSelectedBizZoneId] = useState(null);

  // ── Placement Areas (independent design workspace — not engineering zones) ──
  const [placementAreas, setPlacementAreas] = useState([]);
  const [selectedPlacementAreaId, setSelectedPlacementAreaId] = useState(null);
  const [isDrawingPlacementArea, setIsDrawingPlacementArea] = useState(false);
  const [placementAreaEditMode, setPlacementAreaEditMode] = useState(
    PLACEMENT_AREA_EDIT_MODES.VERTICES,
  );
  const [placementAreaToast, setPlacementAreaToast] = useState(null);
  /** Triggers inline rename in ZonesPanel after a new area is drawn. */
  const [autoRenamePlacementAreaId, setAutoRenamePlacementAreaId] = useState(null);

  // ── Panel configuration (Step 6 — Placement Area workflow) ───────────────
  const [projectPanelDefaults, setProjectPanelDefaults] = useState(
    () => ({ ...DEFAULT_PROJECT_PANEL_DEFAULTS }),
  );

  // Migrate legacy linked-defaults areas to owned configs (one-time per area).
  useEffect(() => {
    setPlacementAreas((prev) => {
      if (!prev.some((a) => isLegacyPanelProperties(a.panelProperties))) return prev;
      return migratePlacementAreas(prev, projectPanelDefaults);
    });
    // Intentionally omit projectPanelDefaults — template changes must not re-migrate areas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Generated layout snapshot — null until engineer clicks Generate Layout. */
  const [generatedPanelLayout, setGeneratedPanelLayout] = useState(null);
  const [layoutGenerationFingerprint, setLayoutGenerationFingerprint] = useState(null);

  // Legacy single-module id (engineering fallback path only).
  const [selectedPanelId, setSelectedPanelId] = useState(DEFAULT_PANEL_ID);

  // ── Panel editing (Step 6B-1) — overrides layer, not geometry mutation ───
  const [panelEditHistory, setPanelEditHistory] = useState(() => createPanelEditHistory());
  const [selectedPanelSlotId, setSelectedPanelSlotId] = useState(null);
  const [panelEditMode, setPanelEditMode] = useState("select"); // "select" | "add"
  const [panelDragActive, setPanelDragActive] = useState(false);
  const [selectedArrayId, setSelectedArrayId] = useState(null);
  const [arrayDisplayNames, setArrayDisplayNames] = useState({});
  const [electricalHighlightPanelIds, setElectricalHighlightPanelIds] = useState([]);
  const [electricalSelectedPanelIds, setElectricalSelectedPanelIds] = useState([]);
  const [activeArrayPanelIds, setActiveArrayPanelIds] = useState([]);
  const [electricalStringHighlightPanelIds, setElectricalStringHighlightPanelIds] = useState([]);
  const [electricalStringWiringSegments, setElectricalStringWiringSegments] = useState([]);
  const [electricalSelectedStringId, setElectricalSelectedStringId] = useState(null);
  const [electricalSelectedArrayId, setElectricalSelectedArrayId] = useState(null);
  const [electricalArrays, setElectricalArrays] = useState([]);
  const [electricalTerminationPoint, setElectricalTerminationPoint] = useState(null);
  const [electricalHomerunWiringSegments, setElectricalHomerunWiringSegments] = useState([]);
  const [electricalTerminationPlacementMode, setElectricalTerminationPlacementMode] = useState(false);
  const [electricalTerminationPointSelected, setElectricalTerminationPointSelected] = useState(false);
  const [electricalTerminationDragActive, setElectricalTerminationDragActive] = useState(false);
  const electricalPanelPickRef = useRef(null);
  const electricalArrayToolRef = useRef(null);
  const electricalTerminationRef = useRef(null);

  // ── Step 6 capacity planning (display + slot selection only) ─────────────
  const [placementPlanning, setPlacementPlanning] = useState(DEFAULT_PLACEMENT_PLANNING);

  const updatePlacementPlanning = useCallback((patch) => {
    setPlacementPlanning((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Solar resource (Step 7A) — cached by lat/lng (5 dp), fetched once per location
  const [solarResource, setSolarResource] = useState(null);
  const [solarResourceStatus, setSolarResourceStatus] = useState("idle");
  const [solarResourceError, setSolarResourceError] = useState(null);

  // ── Financial inputs (Step 8A) — editable; never reset on cost recompute
  const [financialInputs, setFinancialInputs] = useState(DEFAULT_FINANCIAL_INPUTS);

  const updateFinancialInputs = useCallback((patch) => {
    setFinancialInputs((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Customer consumption (Step 8E) — separate from financialInputs
  const [consumptionInputs, setConsumptionInputs] = useState(DEFAULT_CONSUMPTION_INPUTS);

  const updateConsumptionInputs = useCallback((patch) => {
    setConsumptionInputs((prev) => ({ ...prev, ...patch }));
  }, []);

  const solarLocationKey = useMemo(() => {
    if (location.lat == null || location.lng == null) return null;
    return roundLocationKey(location.lat, location.lng);
  }, [location.lat, location.lng]);

  // Ref mirror of placingObstacleType — lets placeObstacle read the current
  // value without capturing it in a closure, and without embedding setState
  // calls inside another setState updater (which StrictMode double-invokes).
  const placingTypeRef = useRef(null);

  // Reset activeTool to safe resting state on every step transition.
  // The selectedDetectionMethod effect may then override this (e.g. manual → draw).
  useEffect(() => {
    setActiveTool("pointer");
  }, [currentStep]);

  // Step transition — reset transient canvas modes only (NOT view3D / cameraPreset;
  // workspace view persists across Steps 4–10 and beyond).
  useEffect(() => {
    setPlacingObstacleType(null);
    setGizmoMode("translate");
    setSimPlaying(false);
    setIsDrawingBizZone(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Location (Step 1) is map-only — force 2D when entering this step.
  useEffect(() => {
    if (currentStep === 1) {
      setView3D(false);
    }
  }, [currentStep]);

  // One-time auto 3D when first entering Step 3 (obstacle placement). Preserves
  // manual 2D/3D/Top choice on return visits and on Steps 4+.
  const prevStepRef = useRef(currentStep);
  const didAuto3DForObstaclesRef = useRef(false);
  useEffect(() => {
    const prev = prevStepRef.current;
    if (
      currentStep === 3
      && prev !== 3
      && !didAuto3DForObstaclesRef.current
      && roofSections.length > 0
    ) {
      setView3D(true);
      setCameraPreset("perspective");
      didAuto3DForObstaclesRef.current = true;
    }
    prevStepRef.current = currentStep;
  }, [currentStep, roofSections.length]);

  // Reset Step 10 presentation layer defaults on each visit.
  useEffect(() => {
    if (currentStep === WIZARD_STEP.VISUALIZATION) {
      setPresentationLayers(DEFAULT_PRESENTATION_LAYERS);
      setLayersPanelExpanded(false);
    }
  }, [currentStep]);

  // ── Derived — computed, not stored ────────────────────────────────────────
  const roofCount         = roofSections.length;
  const totalAreaM2       = roofSections.reduce((s, r) => s + (r.areaM2      ?? 0), 0);
  const totalUsableAreaM2 = roofSections.reduce((s, r) => s + (r.usableAreaM2 ?? 0), 0);

  // ── Solar — computed from (day, time, location); shared by panel + 3D ─────
  // Recompute the instantaneous sun on every time/date/location change; the day
  // path arc + sunrise/sunset only depend on the day + location.
  const sun = useMemo(
    () => (location.lat != null
      ? getSun(simDay, simMinutes, location.lat, location.lng)
      : null),
    [simDay, simMinutes, location.lat, location.lng],
  );
  const arcPoints = useMemo(
    () => (location.lat != null
      ? sampleSunArc(simDay, location.lat, location.lng)
      : []),
    [simDay, location.lat, location.lng],
  );
  const arcHours = useMemo(
    () => (location.lat != null
      ? sampleHourMarkers(simDay, location.lat, location.lng)
      : []),
    [simDay, location.lat, location.lng],
  );
  const dayTimes = useMemo(
    () => (location.lat != null
      ? getDayTimes(simDay, location.lat, location.lng)
      : null),
    [simDay, location.lat, location.lng],
  );

  // ── Simulation playback loop ──────────────────────────────────────────────
  // Advances simMinutes in real time while playing. 1× sweeps the 6 AM–6 PM
  // window (720 min) in ~30 s (24 sim-min/sec); 2×/5× scale that. Auto-pauses
  // at 6 PM. Driven by rAF so it stays smooth and pauses when the tab is hidden.
  useEffect(() => {
    if (!simPlaying) return;
    const MIN_PER_SEC = 24;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setSimMinutes((m) => {
        const next = m + dt * MIN_PER_SEC * simSpeed;
        if (next >= SIM_END) {
          setSimPlaying(false);
          return SIM_END;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [simPlaying, simSpeed]);

  // ── Shadow analysis: trigger / receive / invalidate ───────────────────────
  // Trigger: bump the token (the 3D scene watches it and runs the raycast pass).
  const runShadowAnalysis = useCallback(() => {
    if (location.lat == null || roofSections.length === 0) return;
    setShadowProgress(0);
    setShadowRunning(true);
    setShadowRunToken((t) => t + 1);
  }, [location.lat, roofSections.length]);

  const handleShadowProgress = useCallback((pct) => {
    setShadowProgress(pct);
  }, []);

  const handleShadowResult = useCallback((result, completedToken) => {
    if (completedToken !== shadowRunTokenRef.current) return;
    setShadowResult(result);
    setShadowProgress(100);
    setShadowRunning(false);
  }, []);

  shadowRunTokenRef.current = shadowRunToken;
  shadowRunningRef.current = shadowRunning;
  shadowResultRef.current = shadowResult;

  // ── Exposure score (Step 4C) — derived from 4B result, no raycasting ──────
  // Pure arithmetic on shadePct + roof orientation + lat; synchronous and fast.
  const exposureResult = useMemo(() => {
    if (!shadowResult || location.lat == null) return null;
    return computeExposureResult(shadowResult, roofSections, location.lat);
  }, [shadowResult, roofSections, location.lat]);

  // ── Zone classification (Step 5A) — derived from 4C result ───────────────
  // Classifies each cell into excellent/good/average/avoid/blocked.
  // Cascades: shadow → exposure → zone. All synchronous, no raycasting.
  const zoneResult = useMemo(() => {
    if (!exposureResult) return null;
    return computeZoneResult(exposureResult, roofSections);
  }, [exposureResult, roofSections]);

  // ── Zone merge (Step 5B) — flood-fill + polygon extraction ───────────────
  // Merges classified cells into connected region polygons (outer ring + holes).
  // Cascades from 5A. Synchronous, pure, < 10 ms for typical roofs.
  const zoneMergeResult = useMemo(() => {
    if (!zoneResult) return null;
    return computeZoneMerge(zoneResult, roofSections);
  }, [zoneResult, roofSections]);

  // Refresh placement area stats when immutable simulation cells change.
  useEffect(() => {
    if (!exposureResult || !zoneResult) return;
    setPlacementAreas((prev) => {
      if (!prev.length) return prev;
      return recomputePlacementAreaStats(prev, exposureResult, zoneResult);
    });
  }, [exposureResult, zoneResult]);

  // ── Zone editor (Step 5C) — user edits layer ─────────────────────────────
  // zoneEdits persists across re-analyses.  It is a Map<sigKey → EditRecord>
  // where EditRecord = { sigKey, customName, typeOverride, deleted, originalAreaM2 }.
  // Reconciliation with the new merge result happens inside buildZoneDisplayList.
  const [zoneEdits,      setZoneEdits]      = useState(() => new Map());
  const [selectedZoneId, setSelectedZoneId] = useState(null);

  // User-drawn placement area geometry only — excludes stats refreshed after analysis.
  const placementAreaGeometryKey = useMemo(
    () => JSON.stringify(
      placementAreas.map((a) => ({
        id: a.id,
        deleted: !!a.deleted,
        roofId: a.roofId,
        outerRing: a.polygon?.outerRing ?? [],
        holes: a.polygon?.holes ?? [],
      })),
    ),
    [placementAreas],
  );

  // Invalidate stale shadow results when simulation inputs change.  If a run is
  // in progress OR a prior result exists, auto-restart with fresh data.
  useEffect(() => {
    const shouldRestart = shadowRunningRef.current || shadowResultRef.current != null;
    setShadowResult(null);
    setShadowProgress(0);
    if (shouldRestart) {
      setShadowRunning(true);
      setShadowRunToken((t) => t + 1);
    } else {
      setShadowRunning(false);
    }
    setHeatmapMode("shade");
  }, [simDay, roofSections, obstacles, businessZones, placementAreaGeometryKey, zoneEdits]);
  const [designState,    setDesignState]    = useState(DESIGN_STATE.CLEAN);
  const [zoneEditMode,   setZoneEditMode]   = useState(ZONE_EDIT_MODES.VERTICES);
  const [zoneToast,      setZoneToast]      = useState(null);
  /** Step 0 statistics overrides — populated by Update Design, cleared on new edits. */
  const [zoneStatisticsOverrides, setZoneStatisticsOverrides] = useState(() => new Map());
  const [isUpdatingDesign, setIsUpdatingDesign] = useState(false);

  // Reset design state when a fresh merge result arrives (new simulation run).
  useEffect(() => {
    setDesignState(DESIGN_STATE.CLEAN);
    setZoneStatisticsOverrides(new Map());
  }, [zoneMergeResult]);

  // Auto-dismiss validation toast.
  useEffect(() => {
    if (!zoneToast) return;
    const t = setTimeout(() => setZoneToast(null), 3500);
    return () => clearTimeout(t);
  }, [zoneToast]);

  useEffect(() => {
    if (!placementAreaToast) return;
    const t = setTimeout(() => setPlacementAreaToast(null), 3500);
    return () => clearTimeout(t);
  }, [placementAreaToast]);

  // Clear selection whenever a new analysis produces a new merge result (region
  // IDs change after every analysis run).
  useEffect(() => {
    setSelectedZoneId(null);
  }, [zoneMergeResult]);

  // Enriched zone list: allRegions + user edits reconciled by stable signature.
  const zoneDisplayList = useMemo(() => {
    if (!zoneMergeResult) return [];
    return buildZoneDisplayList(zoneMergeResult.allRegions, zoneEdits).displayList;
  }, [zoneMergeResult, zoneEdits]);

  // Step 0 output applied — refreshed avgScore/areaM2 for edited zones after Update Design.
  const effectiveZoneDisplayList = useMemo(
    () => applyZoneStatisticsOverrides(zoneDisplayList, zoneStatisticsOverrides),
    [zoneDisplayList, zoneStatisticsOverrides],
  );

  // Live area totals — respects soft-delete and type-overrides.
  // This is the real-time Installable Area shown in Step 5 and consumed by Step 6.
  const effectiveZoneStats = useMemo(
    () => computeEffectiveStats(effectiveZoneDisplayList),
    [effectiveZoneDisplayList],
  );

  // Count edit records that couldn't be matched to any region in the current run.
  const orphanedEditCount = useMemo(
    () => countOrphanedEdits(zoneDisplayList, zoneEdits),
    [zoneDisplayList, zoneEdits],
  );

  // ── Installable area after business-zone geometry subtraction (5D-B) ───────
  // This is the live headline figure that Step 6 will consume.
  // Falls back to effectiveZoneStats when there are no active business zones.
  const finalInstallableStats = useMemo(
    () => computeInstallableAfterBizZones(effectiveZoneDisplayList, businessZones),
    [effectiveZoneDisplayList, businessZones],
  );

  // ── Placement readiness (Step 5H) — live contract for Step 6 ─────────────
  // Recomputes whenever sim zones, business zones, obstacles, or roofs change.
  // NOT a button snapshot — always reflects current zoning state.
  const placementReady = useMemo(
    () => computePlacementReady({
      placementAreas,
      zoneDisplayList: effectiveZoneDisplayList,
      businessZones,
      obstacles,
      roofSections,
    }),
    [placementAreas, effectiveZoneDisplayList, businessZones, obstacles, roofSections],
  );

  const activePlacementAreas = useMemo(
    () => placementAreas.filter((a) => !a.deleted),
    [placementAreas],
  );

  const usePlacementAreaPanelWorkflow = activePlacementAreas.length > 0;

  const selectedAreaForPanelConfig = useMemo(
    () => placementAreas.find((a) => a.id === selectedPlacementAreaId && !a.deleted) ?? null,
    [placementAreas, selectedPlacementAreaId],
  );

  const placementGeometryFingerprint = useMemo(
    () => JSON.stringify({
      source: placementReady?.summary?.source,
      regions: (placementReady?.installableRegions ?? []).map((r) => ({
        id: r.id,
        areaM2: r.areaM2,
      })),
      blockedCount: placementReady?.blockedRegions?.length ?? 0,
    }),
    [placementReady],
  );

  // ── Selected panel module (Step 6A-1) ────────────────────────────────────
  const selectedPanel = useMemo(() => {
    if (usePlacementAreaPanelWorkflow) {
      const cfg = resolvePlacementAreaConfig(selectedAreaForPanelConfig?.panelProperties);
      return panelForPlacement(cfg.moduleId, cfg.orientation);
    }
    return getPanelById(selectedPanelId) ?? getPanelById(DEFAULT_PANEL_ID) ?? null;
  }, [
    usePlacementAreaPanelWorkflow,
    selectedAreaForPanelConfig,
    selectedPanelId,
  ]);

  const layoutIsStale = useMemo(() => {
    if (!usePlacementAreaPanelWorkflow || !generatedPanelLayout) return false;
    const current = placementLayoutFingerprint(placementAreas);
    return current !== layoutGenerationFingerprint;
  }, [
    usePlacementAreaPanelWorkflow,
    generatedPanelLayout,
    placementAreas,
    layoutGenerationFingerprint,
  ]);

  // ── Panel layout (Step 6A-2) — gated behind Generate Layout for PAs ─────
  const basePanelLayout = useMemo(() => {
    if (usePlacementAreaPanelWorkflow) {
      return generatedPanelLayout ?? EMPTY_PANEL_LAYOUT;
    }
    return computePanelLayout(placementReady, selectedPanel);
  }, [
    usePlacementAreaPanelWorkflow,
    generatedPanelLayout,
    placementReady,
    selectedPanel,
  ]);

  // Clear generated layout when installable geometry changes (obstacles, areas, etc.).
  useEffect(() => {
    if (!usePlacementAreaPanelWorkflow) return;
    setGeneratedPanelLayout(null);
    setLayoutGenerationFingerprint(null);
    setPlacementAreas((prev) => {
      const needsClear = prev.some((a) => !a.deleted && a.generatedLayout);
      if (!needsClear) return prev;
      return prev.map((a) => (a.deleted ? a : { ...a, generatedLayout: null }));
    });
  }, [placementGeometryFingerprint, usePlacementAreaPanelWorkflow]);

  // Auto-select first placement area when entering Step 6.
  useEffect(() => {
    if (currentStep !== 6 || !usePlacementAreaPanelWorkflow) return;
    if (selectedPlacementAreaId) return;
    setSelectedPlacementAreaId(activePlacementAreas[0]?.id ?? null);
  }, [
    currentStep,
    usePlacementAreaPanelWorkflow,
    activePlacementAreas,
    selectedPlacementAreaId,
  ]);

  const panelOverrides = panelEditHistory.present;

  // Reconcile override ids when placement re-runs (prune slots that no longer exist).
  useEffect(() => {
    setPanelEditHistory((h) => {
      const reconciled = reconcilePanelOverrides(h.present, basePanelLayout.allValidSlots);
      const prevR = [...(h.present.removed ?? [])].sort().join("\0");
      const prevA = [...(h.present.added ?? [])].sort().join("\0");
      const nextR = [...reconciled.removed].sort().join("\0");
      const nextA = [...reconciled.added].sort().join("\0");
      if (prevR === nextR && prevA === nextA) return h;
      return { ...h, present: reconciled };
    });
  }, [basePanelLayout.allValidSlots]);

  const panelLayout = useMemo(
    () => applyPanelOverrides(basePanelLayout, panelOverrides),
    [basePanelLayout, panelOverrides],
  );

  // PA workflow — single read model: generated snapshot ± user edits.
  const effectivePanelLayout = useMemo(() => {
    if (!usePlacementAreaPanelWorkflow) return null;
    return resolveEffectivePanelLayout(generatedPanelLayout, panelOverrides);
  }, [usePlacementAreaPanelWorkflow, generatedPanelLayout, panelOverrides]);

  // Active layout for downstream consumers (PA → effective; legacy → panelLayout).
  const baselinePanelLayout = useMemo(() => {
    if (usePlacementAreaPanelWorkflow) {
      return effectivePanelLayout ?? EMPTY_PANEL_LAYOUT;
    }
    return panelLayout;
  }, [usePlacementAreaPanelWorkflow, effectivePanelLayout, panelLayout]);

  const activePanelLayout = useMemo(() => {
    const baseline = baselinePanelLayout;
    const placedPanels = baseline?.placedPanels ?? [];
    if (!electricalArrays.length) return baseline;

    const rotatedPanels = applyElectricalArrayRotations(placedPanels, electricalArrays);
    return { ...baseline, placedPanels: rotatedPanels };
  }, [baselinePanelLayout, electricalArrays]);

  const renderedPlacedPanels = activePanelLayout.placedPanels ?? [];

  const panelVisualContext = useMemo(
    () => ({
      projectPanelDefaults,
      regionMap: buildRegionMountVisualMap(projectPanelDefaults, placementAreas),
    }),
    [projectPanelDefaults, placementAreas],
  );

  const renderedGhostSlots = useMemo(() => {
    if (usePlacementAreaPanelWorkflow) {
      return effectivePanelLayout?.ghostSlots ?? [];
    }
    return panelLayout.ghostSlots;
  }, [usePlacementAreaPanelWorkflow, effectivePanelLayout, panelLayout.ghostSlots]);

  const hasPlacedPanels = useMemo(
    () => (renderedPlacedPanels?.length ?? 0) > 0,
    [renderedPlacedPanels],
  );

  const workspaceVisibility = useMemo(
    () => getWorkspaceVisibility(currentStep, {
      usePlacementAreaPanelWorkflow,
      hasGeneratedPanelLayout: !!generatedPanelLayout,
      hasPlacedPanels,
      hasPlacementAreas: activePlacementAreas.length > 0,
      isDrawingPlacementArea: isDrawingPlacementArea && currentStep === 5,
    }),
    [
      currentStep,
      usePlacementAreaPanelWorkflow,
      generatedPanelLayout,
      hasPlacedPanels,
      activePlacementAreas.length,
      isDrawingPlacementArea,
    ],
  );

  const measurementStepVisibility = useMemo(
    () => getMeasurementVisibility(
      currentStep,
      currentStep === WIZARD_STEP.VISUALIZATION ? presentationLayers : null,
    ),
    [currentStep, presentationLayers],
  );

  const showPlacementAreasInWorkspace = useMemo(
    () => resolvePlacementAreasVisible(
      workspaceVisibility.placementAreas,
      workspaceVisibility.isPresentation,
      currentStep === WIZARD_STEP.VISUALIZATION ? presentationLayers : null,
    ),
    [
      workspaceVisibility.placementAreas,
      workspaceVisibility.isPresentation,
      currentStep,
      presentationLayers,
    ],
  );

  const locationSpecificYield = useMemo(
    () => computeLocationSpecificYield(solarResource),
    [solarResource],
  );

  const resolvedTargetCapacityKw = useMemo(
    () => resolveTargetCapacityKw(placementPlanning, {
      tariffPerUnit: financialInputs.tariffPerUnit,
      specificYieldKwhPerKwp: locationSpecificYield,
    }),
    [placementPlanning, financialInputs.tariffPerUnit, locationSpecificYield],
  );

  const maxRoofCapacityKw = useMemo(() => {
    const n = basePanelLayout.allValidSlots?.length ?? 0;
    const w = selectedPanel?.power ?? 0;
    return n > 0 && w > 0 ? +((n * w) / 1000).toFixed(2) : 0;
  }, [basePanelLayout.allValidSlots, selectedPanel]);

  const placementLiveSummary = useMemo(
    () => computePlacementLiveSummary({
      placementPlanning,
      resolvedTargetCapacityKw,
      panelLayout,
      selectedPanel,
      maxRoofCapacityKw,
      maxPanelCount: basePanelLayout.allValidSlots?.length ?? 0,
    }),
    [
      placementPlanning,
      resolvedTargetCapacityKw,
      panelLayout,
      selectedPanel,
      maxRoofCapacityKw,
      basePanelLayout.allValidSlots,
    ],
  );

  // ── Panel arrays (6C-1) — derived from active layout
  const panelArrays = useMemo(
    () => computePanelArrays(activePanelLayout, placementReady, selectedPanel, arrayDisplayNames),
    [activePanelLayout, placementReady, selectedPanel, arrayDisplayNames],
  );

  // Mount Height engineering refinement — after placement, before energy (pure filter).
  const panelShadingRefinementResult = useMemo(
    () => panelShadingRefinement({
      exposureResult,
      shadowResult,
      obstacles,
      roofSections,
      panelLayout: activePanelLayout,
      projectPanelDefaults,
      placementAreas,
      placementReady,
    }),
    [
      exposureResult,
      shadowResult,
      obstacles,
      roofSections,
      activePanelLayout,
      projectPanelDefaults,
      placementAreas,
      placementReady,
    ],
  );

  const regionExposureOverride = useMemo(
    () => buildRegionExposureOverrideFromRefinement(panelShadingRefinementResult),
    [panelShadingRefinementResult],
  );

  // Step 7B — pure derived energy production (NASA resource × arrays × exposure).
  const liveEnergyResult = useMemo(
    () => computeEnergyResult(solarResource, panelArrays, placementReady, {
      regionExposureOverride: regionExposureOverride ?? undefined,
    }),
    [solarResource, panelArrays, placementReady, regionExposureOverride],
  );

  const liveInstalledSystemKw = useMemo(() => {
    if (liveEnergyResult?.systemKw > 0) return liveEnergyResult.systemKw;
    const kw = panelArrays.reduce((s, a) => s + (a.systemKw ?? 0), 0);
    return kw > 0 ? +kw.toFixed(2) : 0;
  }, [liveEnergyResult?.systemKw, panelArrays]);

  const liveCostResult = useMemo(
    () => computeCostResult(financialInputs, liveInstalledSystemKw),
    [financialInputs, liveInstalledSystemKw],
  );

  const liveSavingsResult = useMemo(
    () => computeSavingsResult(liveEnergyResult, financialInputs),
    [liveEnergyResult, financialInputs],
  );

  const liveRoiResult = useMemo(
    () => computeRoiResult(liveCostResult, liveSavingsResult),
    [liveCostResult, liveSavingsResult],
  );

  const liveConsumptionResult = useMemo(
    () => computeConsumptionResult(consumptionInputs, financialInputs.tariffPerUnit),
    [consumptionInputs, financialInputs.tariffPerUnit],
  );

  const liveCoverageResult = useMemo(
    () => computeCoverageResult(liveEnergyResult, liveConsumptionResult),
    [liveEnergyResult, liveConsumptionResult],
  );

  // Snapshot downstream results while designState is CLEAN; freeze when DIRTY.
  const [committedResults, setCommittedResults] = useState(null);

  useEffect(() => {
    if (designState !== DESIGN_STATE.CLEAN) return;
    setCommittedResults({
      energyResult:       liveEnergyResult,
      installedSystemKw:  liveInstalledSystemKw,
      costResult:         liveCostResult,
      savingsResult:      liveSavingsResult,
      roiResult:          liveRoiResult,
      consumptionResult:  liveConsumptionResult,
      coverageResult:     liveCoverageResult,
      panelLayout:        activePanelLayout,
      panelArrays,
    });
  }, [
    designState,
    liveEnergyResult,
    liveInstalledSystemKw,
    liveCostResult,
    liveSavingsResult,
    liveRoiResult,
    liveConsumptionResult,
    liveCoverageResult,
    activePanelLayout,
    panelArrays,
  ]);

  const isStaleDesign = designState === DESIGN_STATE.DIRTY;

  const energyResult = isStaleDesign
    ? (committedResults?.energyResult ?? null)
    : liveEnergyResult;

  const installedSystemKw = isStaleDesign
    ? (committedResults?.installedSystemKw ?? 0)
    : liveInstalledSystemKw;

  const costResult = isStaleDesign
    ? (committedResults?.costResult ?? null)
    : liveCostResult;

  const savingsResult = isStaleDesign
    ? (committedResults?.savingsResult ?? null)
    : liveSavingsResult;

  const roiResult = isStaleDesign
    ? (committedResults?.roiResult ?? null)
    : liveRoiResult;

  const consumptionResult = isStaleDesign
    ? (committedResults?.consumptionResult ?? null)
    : liveConsumptionResult;

  const coverageResult = isStaleDesign
    ? (committedResults?.coverageResult ?? null)
    : liveCoverageResult;

  const workspacePanelLayout = isStaleDesign
    ? (committedResults?.panelLayout ?? activePanelLayout)
    : activePanelLayout;

  const handleRenameArray = useCallback((regionId, name) => {
    setArrayDisplayNames((prev) => {
      const next = { ...prev };
      if (name) next[regionId] = name;
      else delete next[regionId];
      return next;
    });
  }, []);

  const handleElectricalSelectionChange = useCallback((info) => {
    const hasStringHighlight = (info.stringHighlightPanelIds?.length ?? 0) > 0;
    setElectricalHighlightPanelIds(hasStringHighlight ? [] : (info.highlightPanelIds ?? []));
    setElectricalSelectedPanelIds(info.selectedElectricalPanelIds ?? []);
    setActiveArrayPanelIds(info.activeArrayPanelIds ?? []);
    setElectricalStringHighlightPanelIds(info.stringHighlightPanelIds ?? []);
    setElectricalStringWiringSegments(info.stringWiringSegments ?? []);
    setElectricalHomerunWiringSegments(info.homerunWiringSegments ?? []);
    setElectricalSelectedStringId(info.selectedStringId ?? null);
    setElectricalSelectedArrayId(info.selectedArrayId ?? null);
    setElectricalTerminationPoint(info.terminationPoint ?? null);
    setElectricalTerminationPlacementMode(!!info.terminationPlacementMode);
    setElectricalTerminationPointSelected(!!info.terminationPointSelected);
  }, []);

  const handleArraysChange = useCallback((arrays) => {
    setElectricalArrays(arrays ?? []);
  }, []);

  const handleTerminationPointChange = useCallback((point) => {
    setElectricalTerminationPoint(point ?? null);
  }, []);

  const handleRegisterTerminationHandlers = useCallback((handlers) => {
    electricalTerminationRef.current = handlers;
  }, []);

  const handleRegisterElectricalPanelPickHandlers = useCallback((handlers) => {
    electricalPanelPickRef.current = handlers;
  }, []);

  const handleRegisterArrayToolHandlers = useCallback((handlers) => {
    electricalArrayToolRef.current = handlers;
  }, []);

  const selectedElectricalArray = useMemo(() => {
    if (!electricalSelectedArrayId) return null;
    return electricalArrays.find((a) => a.id === electricalSelectedArrayId) ?? null;
  }, [electricalArrays, electricalSelectedArrayId]);

  const showArrayToolsToolbar = currentStep === WIZARD_STEP.ELECTRICAL
    && !!selectedElectricalArray;

  const handleArrayRotate = useCallback((arrayId, rotationDeg, options) => (
    electricalArrayToolRef.current?.rotateArray?.(arrayId, rotationDeg, options)
  ), []);

  const handleArraySetFrozen = useCallback((arrayId, frozen, options) => (
    electricalArrayToolRef.current?.setArrayFrozen?.(arrayId, frozen, options)
  ), []);

  const handlePlaceTerminationPoint = useCallback((x, z) => {
    electricalTerminationRef.current?.placeTerminationPoint?.(x, z);
  }, []);

  const handleMoveTerminationPoint = useCallback((x, z) => {
    electricalTerminationRef.current?.moveTerminationPoint?.(x, z);
  }, []);

  const handleSelectTerminationPoint = useCallback(() => {
    electricalTerminationRef.current?.selectTerminationPoint?.(true);
  }, []);

  const handleElectricalSelectPanel = useCallback((slotId, options) => {
    if (electricalTerminationPlacementMode) return;
    electricalPanelPickRef.current?.selectPanel?.(slotId, options);
  }, [electricalTerminationPlacementMode]);

  const handleClearElectricalPanelSelection = useCallback(() => {
    electricalPanelPickRef.current?.clearPanelSelection?.();
  }, []);

  // Prune array renames when installable regions disappear after a re-run.
  useEffect(() => {
    const validIds = (placementReady?.installableRegions ?? []).map((r) => r.id);
    setArrayDisplayNames((prev) => reconcileArrayDisplayNames(prev, validIds));
    if (selectedArrayId && !validIds.includes(selectedArrayId)) {
      setSelectedArrayId(null);
    }
  }, [placementReady, selectedArrayId]);

  // DevTools export for irregular-roof placement diagnostics (Step 6C-6).
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__FLOWX_PLACEMENT_READY__ = placementReady;
    window.__FLOWX_PANEL_DIAG__ = {
      clearance: basePanelLayout?.diagnostics ?? null,
      layoutPolicy: basePanelLayout?.layoutPolicy ?? null,
      validation: basePanelLayout?.validation ?? null,
    };
  }, [placementReady, basePanelLayout]);

  // Fetch NASA POWER climatology once per location key; cancel stale in-flight requests.
  useEffect(() => {
    if (!solarLocationKey) {
      setSolarResource(null);
      setSolarResourceStatus("idle");
      setSolarResourceError(null);
      return;
    }

    const cached = solarResourceCache.get(solarLocationKey);
    if (cached) {
      setSolarResource(cached);
      setSolarResourceStatus("ready");
      setSolarResourceError(null);
      return;
    }

    const controller = new AbortController();
    let stale = false;

    setSolarResourceStatus("loading");
    setSolarResourceError(null);

    fetchSolarResource(location.lat, location.lng, { signal: controller.signal })
      .then((data) => {
        if (stale) return;
        setSolarResource(data);
        setSolarResourceStatus("ready");
      })
      .catch((err) => {
        if (stale || err?.name === "AbortError") return;
        setSolarResourceStatus("error");
        setSolarResourceError(err.message ?? "Failed to load solar resource data");
      });

    return () => {
      stale = true;
      controller.abort();
    };
  }, [solarLocationKey, location.lat, location.lng]);

  const commitPanelOverrides = useCallback((next) => {
    setPanelEditHistory((h) => ({
      present: next,
      past:    [...(h.past ?? []).slice(-49), h.present ?? EMPTY_PANEL_OVERRIDES],
      future:  [],
    }));
    if (usePlacementAreaPanelWorkflow && generatedPanelLayout) {
      setDesignState(DESIGN_STATE.DIRTY);
    }
  }, [usePlacementAreaPanelWorkflow, generatedPanelLayout]);

  const handleDeleteSelectedPanel = useCallback(() => {
    if (!selectedPanelSlotId) return;
    commitPanelOverrides(overridesAfterRemove(panelOverrides, selectedPanelSlotId));
    setSelectedPanelSlotId(null);
  }, [selectedPanelSlotId, panelOverrides, commitPanelOverrides]);

  const handleAddPanelSlot = useCallback((slotId) => {
    commitPanelOverrides(overridesAfterAdd(panelOverrides, slotId));
  }, [panelOverrides, commitPanelOverrides]);

  const handleMovePanel = useCallback((fromSlotId, toSlotId) => {
    if (!usePlacementAreaPanelWorkflow || !generatedPanelLayout) return;
    const result = validatePanelMove(fromSlotId, toSlotId, generatedPanelLayout, panelOverrides);
    if (!result.valid) return;
    commitPanelOverrides(overridesAfterMove(panelOverrides, fromSlotId, toSlotId));
    setSelectedPanelSlotId(toSlotId);
  }, [
    usePlacementAreaPanelWorkflow,
    generatedPanelLayout,
    panelOverrides,
    commitPanelOverrides,
  ]);

  const handleRotateSelectedPanel = useCallback(() => {
    if (!selectedPanelSlotId || !usePlacementAreaPanelWorkflow || !generatedPanelLayout) return;
    const panel = activePanelLayout.placedPanels.find(
      (p) => (p.slotId ?? p.id) === selectedPanelSlotId,
    );
    if (!panel) return;
    const nextOrientation = toggledOrientation(panel, panelOverrides);
    const result = validatePanelRotate(
      selectedPanelSlotId,
      nextOrientation,
      generatedPanelLayout,
      panelOverrides,
      placementReady,
    );
    if (!result.valid) return;
    commitPanelOverrides(overridesAfterRotate(panelOverrides, selectedPanelSlotId, nextOrientation));
  }, [
    selectedPanelSlotId,
    usePlacementAreaPanelWorkflow,
    generatedPanelLayout,
    activePanelLayout.placedPanels,
    panelOverrides,
    placementReady,
    commitPanelOverrides,
  ]);

  const panelSnapSlots = useMemo(
    () => effectivePanelLayout?.ghostSlots ?? [],
    [effectivePanelLayout],
  );

  const nearestPanelSnapSlot = useCallback(
    (x, z, slots) => nearestSnapSlot(x, z, slots),
    [],
  );

  const handlePanelDragActiveChange = useCallback((active) => {
    setPanelDragActive(!!active);
  }, []);

  const handleUndoPanelEdit = useCallback(() => {
    setPanelEditHistory((h) => undoPanelEditHistory(h));
    setSelectedPanelSlotId(null);
    if (usePlacementAreaPanelWorkflow && generatedPanelLayout) {
      setDesignState(DESIGN_STATE.DIRTY);
    }
  }, [usePlacementAreaPanelWorkflow, generatedPanelLayout]);

  const handleRedoPanelEdit = useCallback(() => {
    setPanelEditHistory((h) => redoPanelEditHistory(h));
    setSelectedPanelSlotId(null);
    if (usePlacementAreaPanelWorkflow && generatedPanelLayout) {
      setDesignState(DESIGN_STATE.DIRTY);
    }
  }, [usePlacementAreaPanelWorkflow, generatedPanelLayout]);

  const handleSetPanelEditMode = useCallback((mode) => {
    setPanelEditMode(mode);
    if (mode === "add") setSelectedPanelSlotId(null);
  }, []);

  const handleAutoPlace = useCallback(() => {
    if (!placementReady || !selectedPanel) return;
    const slots = basePanelLayout.allValidSlots ?? [];
    const defaultRemoved = basePanelLayout.defaultRemoved ?? [];
    if (placementPlanning.placementMode === PLACEMENT_MODES.FILL_ROOF) {
      setPanelEditHistory(createPanelEditHistory(
        buildFillRoofOverrides(slots, defaultRemoved),
      ));
      setSelectedPanelSlotId(null);
      return;
    }
    const targetKw = resolvedTargetCapacityKw ?? 0;
    const { overrides } = buildTargetCapacityOverrides(
      slots,
      placementReady,
      selectedPanel,
      targetKw,
      defaultRemoved,
    );
    setPanelEditHistory(createPanelEditHistory(overrides));
    setSelectedPanelSlotId(null);
  }, [
    placementReady,
    selectedPanel,
    basePanelLayout.allValidSlots,
    basePanelLayout.defaultRemoved,
    placementPlanning.placementMode,
    resolvedTargetCapacityKw,
  ]);

  const handleSelectPanelSlot = useCallback((slotId) => {
    if (currentStep === WIZARD_STEP.ELECTRICAL) return;
    if (currentStep === WIZARD_STEP.VISUALIZATION) {
      const panel = renderedPlacedPanels.find(
        (p) => (p.slotId ?? p.id) === slotId,
      );
      if (panel?.regionId) {
        setSelectedArrayId((prev) =>
          (prev === panel.regionId ? null : panel.regionId),
        );
      }
      return;
    }
    setSelectedPanelSlotId(slotId);
  }, [currentStep, renderedPlacedPanels]);

  const panelCanUndo = canUndoPanelEdit(panelEditHistory);
  const panelCanRedo = canRedoPanelEdit(panelEditHistory);

  // Reset edit UI when leaving Step 6 (array selection persists for Visualization).
  useEffect(() => {
    if (currentStep !== 6) {
      setSelectedPanelSlotId(null);
      setPanelEditMode("select");
    }
    if (currentStep !== 6 && currentStep !== WIZARD_STEP.VISUALIZATION) {
      setSelectedArrayId(null);
    }
  }, [currentStep]);

  // Clear electrical canvas state when leaving Step 7.
  useEffect(() => {
    if (currentStep !== WIZARD_STEP.ELECTRICAL) {
      setElectricalHighlightPanelIds([]);
      setElectricalSelectedPanelIds([]);
      setActiveArrayPanelIds([]);
      setElectricalStringHighlightPanelIds([]);
      setElectricalStringWiringSegments([]);
      setElectricalHomerunWiringSegments([]);
      setElectricalSelectedStringId(null);
      setElectricalSelectedArrayId(null);
      setElectricalTerminationPlacementMode(false);
      setElectricalTerminationPointSelected(false);
      setElectricalTerminationDragActive(false);
    }
  }, [currentStep]);

  // Drop panel selection if the slot is no longer in the effective layout.
  useEffect(() => {
    if (!selectedPanelSlotId) return;
    const stillActive = renderedPlacedPanels.some((p) => p.slotId === selectedPanelSlotId);
    if (!stillActive) setSelectedPanelSlotId(null);
  }, [renderedPlacedPanels, selectedPanelSlotId]);

  // Drop array selection when the array has no panels left (e.g. after deletes).
  useEffect(() => {
    if (selectedArrayId && !panelArrays.some((a) => a.id === selectedArrayId)) {
      setSelectedArrayId(null);
    }
  }, [panelArrays, selectedArrayId]);

  // Keyboard shortcuts for electrical panel selection (Step 7).
  useEffect(() => {
    if (currentStep !== WIZARD_STEP.ELECTRICAL) return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        e.preventDefault();
        handleClearElectricalPanelSelection();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && electricalTerminationPointSelected) {
        e.preventDefault();
        electricalTerminationRef.current?.clearTerminationPoint?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentStep, handleClearElectricalPanelSelection, electricalTerminationPointSelected]);

  // Keyboard shortcuts for panel editing (Step 6).
  useEffect(() => {
    if (currentStep !== 6) return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedPanelSlotId && panelEditMode === "select") {
        e.preventDefault();
        handleDeleteSelectedPanel();
      }
      if (e.key === "Escape") {
        if (panelEditMode === "add") setPanelEditMode("select");
        else setSelectedPanelSlotId(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndoPanelEdit();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedoPanelEdit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    currentStep, selectedPanelSlotId, panelEditMode,
    handleDeleteSelectedPanel, handleUndoPanelEdit, handleRedoPanelEdit,
  ]);

  // Dev verification log — active layout counts (6A-2 / 6B-1).
  useEffect(() => {
    if (!placementReady || !selectedPanel) return;
    const { summary } = activePanelLayout;
    console.log(
      "[Step 6] Panel layout:",
      summary.total,
      "active",
      "/",
      summary.totalValidSlots,
      "valid slots",
      "| per region:",
      summary.byRegion,
    );
  }, [activePanelLayout, placementReady, selectedPanel]);

  // ── Business zone callbacks ───────────────────────────────────────────────

  // Called by DrawBizZoneLayer when the user completes a rectangle drag.
  const addBizZone = useCallback(({ roofId, outerRing }) => {
    const type = pendingBizType;
    setBusinessZones((prev) => {
      const newZone = {
        id:           `biz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind:         "business",
        businessType: type,
        outerRing,
        name:         autoNameBizZone(type, prev),
        roofId,
        deleted:      false,
      };
      return [...prev, newZone];
    });
    setIsDrawingBizZone(false);
  }, [pendingBizType]);

  // Merge-patch a business zone (name, businessType, deleted, …).
  const updateBizZone = useCallback((id, updates) => {
    setBusinessZones((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    );
  }, []);

  // Soft-delete a business zone (sets deleted:true; geometry is restored live).
  const deleteBizZone = useCallback((id) => {
    setBusinessZones((prev) =>
      prev.map((b) => (b.id === id ? { ...b, deleted: true } : b)),
    );
    setSelectedBizZoneId((sel) => (sel === id ? null : sel));
  }, []);

  // Start draw mode: switch to Top view + store the pending type.
  const startBizDrawing = useCallback((type) => {
    setPendingBizType(type);
    setIsDrawingBizZone(true);
    setIsDrawingPlacementArea(false);
    setView3D(true);
    setCameraPreset("top");
    // Clear obstacle selection so it doesn't fight pointer events.
    setSelectedObstacleId(null);
  }, []);

  const stopBizDrawing = useCallback(() => {
    setIsDrawingBizZone(false);
  }, []);

  // ── Placement Area callbacks (independent subsystem) ─────────────────────

  const addPlacementArea = useCallback(({ roofId, outerRing }) => {
    const roofSection = roofSections.find((s) => s.id === roofId) ?? null;
    const centre = computeDesignCenter(roofSections);
    const result = validatePlacementAreaPolygon(
      { outerRing, holes: [] },
      roofSection,
      centre,
    );
    if (!result.valid) {
      setPlacementAreaToast(result.message);
      return;
    }

    setPlacementAreas((prev) => {
      const record = enrichPlacementAreaWithStats(
        createPlacementAreaRecord({
          roofId,
          outerRing,
          name: autoNamePlacementArea(prev),
          projectPanelDefaults,
        }),
        exposureResult,
        zoneResult,
      );
      setSelectedPlacementAreaId(record.id);
      setAutoRenamePlacementAreaId(record.id);
      return [...prev, record];
    });
    setPlacementAreaToast(null);
    setIsDrawingPlacementArea(false);
    setSelectedZoneId(null);
  }, [roofSections, exposureResult, zoneResult, projectPanelDefaults]);

  const updatePlacementArea = useCallback((id, updates) => {
    setPlacementAreas((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const next = { ...a, ...updates };
        const skipStats = Object.keys(updates).every(
          (k) => k === "panelProperties" || k === "generatedLayout" || k === "name",
        );
        if (skipStats) return next;
        return enrichPlacementAreaWithStats(next, exposureResult, zoneResult);
      }),
    );
  }, [exposureResult, zoneResult]);

  const updateProjectPanelDefaults = useCallback((patch) => {
    setProjectPanelDefaults((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchPlacementAreaConfig = useCallback((areaId, configPatch) => {
    setPlacementAreas((prev) =>
      prev.map((a) => {
        if (a.id !== areaId) return a;
        const current = resolvePlacementAreaConfig(a.panelProperties);
        return {
          ...a,
          panelProperties: {
            ...current,
            ...configPatch,
            designGoal: configPatch.designGoal
              ? { ...current.designGoal, ...configPatch.designGoal }
              : current.designGoal,
          },
        };
      }),
    );
    if (
      usePlacementAreaPanelWorkflow
      && generatedPanelLayout
      && Object.prototype.hasOwnProperty.call(configPatch, "mountHeight")
    ) {
      setDesignState(DESIGN_STATE.DIRTY);
    }
  }, [usePlacementAreaPanelWorkflow, generatedPanelLayout]);

  const resetAreaToProjectTemplate = useCallback((areaId) => {
    setPlacementAreas((prev) =>
      prev.map((a) => {
        if (a.id !== areaId) return a;
        return {
          ...a,
          panelProperties: createPlacementAreaConfigFromTemplate(projectPanelDefaults),
        };
      }),
    );
  }, [projectPanelDefaults]);

  const handleGenerateLayout = useCallback((generateMode = GENERATE_MODES.CAPACITY) => {
    if (!placementReady || !usePlacementAreaPanelWorkflow) return;

    const areasForGeneration = migratePlacementAreas(placementAreas, projectPanelDefaults);

    const layout = generateMultiAreaPanelLayout(
      placementReady,
      areasForGeneration,
      { generateMode },
    );
    const fingerprint = placementLayoutFingerprint(areasForGeneration);

    const areasWithGenerated = areasForGeneration.map((a) => {
      if (a.deleted) return a;
      return {
        ...a,
        generatedLayout: computeAreaGeneratedLayoutRecord(
          a,
          layout,
          generateMode,
        ),
      };
    });

    setPlacementAreas(areasWithGenerated);
    setGeneratedPanelLayout(layout);
    setLayoutGenerationFingerprint(fingerprint);
    setPanelEditHistory(createPanelEditHistory());

    setDesignState(DESIGN_STATE.CLEAN);
  }, [
    placementReady,
    usePlacementAreaPanelWorkflow,
    placementAreas,
    projectPanelDefaults,
  ]);

  const handleGenerateMaximumLayout = useCallback(() => {
    handleGenerateLayout(GENERATE_MODES.MAXIMUM);
  }, [handleGenerateLayout]);

  const deletePlacementArea = useCallback((id) => {
    setPlacementAreas((prev) =>
      prev.map((a) => (a.id === id ? { ...a, deleted: true } : a)),
    );
    setSelectedPlacementAreaId((sel) => (sel === id ? null : sel));
  }, []);

  const startPlacementAreaDrawing = useCallback(() => {
    setIsDrawingPlacementArea(true);
    setIsDrawingBizZone(false);
    setView3D(true);
    setCameraPreset("top");
    setSelectedObstacleId(null);
    setSelectedZoneId(null);
  }, []);

  const stopPlacementAreaDrawing = useCallback(() => {
    setIsDrawingPlacementArea(false);
  }, []);

  const commitPlacementAreaPolygon = useCallback((area, polygon) => {
    const roofSection = roofSections.find((s) => s.id === area.roofId) ?? null;
    const centre = computeDesignCenter(roofSections);
    const result = validatePlacementAreaPolygon(polygon, roofSection, centre);
    if (!result.valid) {
      setPlacementAreaToast(result.message);
      return false;
    }
    setPlacementAreaToast(null);
    updatePlacementArea(area.id, { polygon });
    return true;
  }, [roofSections, updatePlacementArea]);

  const selectedPlacementArea = useMemo(
    () => placementAreas.find((a) => a.id === selectedPlacementAreaId && !a.deleted) ?? null,
    [placementAreas, selectedPlacementAreaId],
  );

  const handleCommitSelectedPlacementAreaPolygon = useCallback((polygon) => {
    if (!selectedPlacementArea) return false;
    return commitPlacementAreaPolygon(selectedPlacementArea, polygon);
  }, [selectedPlacementArea, commitPlacementAreaPolygon]);

  const handleSelectPlacementArea = useCallback((id) => {
    setSelectedPlacementAreaId(id);
    setSelectedZoneId(null);
    setSelectedBizZoneId(null);
  }, []);

  const handleSelectZoneForAnalysis = useCallback((id) => {
    setSelectedZoneId(id);
    setSelectedPlacementAreaId(null);
  }, []);

  // Update a single zone's edit record.  Zone must be from zoneDisplayList
  // (needs sigKey and areaM2 for first-time record initialisation).
  const updateZoneEdit = useCallback((zone, updates) => {
    setZoneEdits(prev => {
      const next     = new Map(prev);
      const existing = prev.get(zone.sigKey) ?? {
        sigKey:         zone.sigKey,
        customName:     null,
        typeOverride:   null,
        deleted:        false,
        locked:         false,
        originalAreaM2: zone.areaM2,
        engineeringPolygon: null,
      };
      next.set(zone.sigKey, { ...existing, ...updates });
      return next;
    });
    setZoneStatisticsOverrides(new Map());
    setDesignState(DESIGN_STATE.DIRTY);
  }, []);

  const handleUpdateDesign = useCallback(() => {
    if (isUpdatingDesign || designState !== DESIGN_STATE.DIRTY) return;

    setIsUpdatingDesign(true);

    // Step 0 — re-sample edited engineering zones from immutable simulation cells.
    const overrides = runUpdateDesignStep0({
      zoneDisplayList,
      exposureResult,
      zoneResult,
    });

    setZoneStatisticsOverrides(overrides);
    setDesignState(DESIGN_STATE.CLEAN);

    // Brief loading state so the action is visible even though the pipeline is synchronous.
    window.setTimeout(() => setIsUpdatingDesign(false), 250);
  }, [
    isUpdatingDesign,
    designState,
    zoneDisplayList,
    exposureResult,
    zoneResult,
  ]);

  const designCentre = useMemo(
    () => computeDesignCenter(roofSections),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(roofSections.map((s) => s.coordinates))],
  );

  const selectedEngineeringZone = useMemo(
    () => zoneDisplayList.find((z) => z.id === selectedZoneId) ?? null,
    [zoneDisplayList, selectedZoneId],
  );

  const commitEngineeringPolygon = useCallback((zone, polygon) => {
    const roofSection = roofSections.find((s) => s.id === zone.roofId) ?? null;
    const result = validateEngineeringPolygon(polygon, roofSection, designCentre);
    if (!result.valid) {
      setZoneToast(result.message);
      return false;
    }
    setZoneToast(null);
    updateZoneEdit(zone, {
      engineeringPolygon: cloneEngineeringPolygon(polygon),
    });
    return true;
  }, [roofSections, designCentre, updateZoneEdit]);

  const resetZoneToAuto = useCallback((zone) => {
    updateZoneEdit(zone, { engineeringPolygon: null });
  }, [updateZoneEdit]);

  const handleCommitSelectedZonePolygon = useCallback((polygon) => {
    if (!selectedEngineeringZone) return false;
    return commitEngineeringPolygon(selectedEngineeringZone, polygon);
  }, [selectedEngineeringZone, commitEngineeringPolygon]);

  // ── Selection management ──────────────────────────────────────────────────
  useEffect(() => {
    if (roofSections.length === 0) {
      setSelectedRoofId(null);
    } else if (roofSections.length === 1) {
      setSelectedRoofId(roofSections[0].id);
    } else if (
      selectedRoofId != null &&
      !roofSections.find((s) => s.id === selectedRoofId)
    ) {
      setSelectedRoofId(null);
    }
  }, [roofSections]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Section management callbacks ──────────────────────────────────────────

  const updateSection = useCallback((id, changes) => {
    setRoofSections((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...changes, metadataSource: "manual" };
        if ("setback" in changes || "coordinates" in changes) {
          updated.usableAreaM2 = computeUsableArea(updated.coordinates, updated.setback);
        }
        return updated;
      })
    );
  }, []);

  const renameSection = useCallback((id, name) => {
    setRoofSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s))
    );
  }, []);

  const onAddSection = useCallback(() => {
    setSelectedDetectionMethod("manual");
    setActiveTool("draw");
  }, []);

  const onDeleteSection = useCallback((id) => {
    setRoofSections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Keep placingTypeRef in sync so placeObstacle always reads the latest value.
  useEffect(() => { placingTypeRef.current = placingObstacleType; }, [placingObstacleType]);

  // ── Obstacle management (Step 3) ──────────────────────────────────────────

  // Pick a type to place (toggles off if re-picked). Ensure 3D so the user can
  // immediately click the roof. Esc / Stop clears it.
  const startPlacing = useCallback((type) => {
    setPlacingObstacleType((prev) => (prev === type ? null : type));
    if (roofSections.length > 0) setView3D(true);
  }, [roofSections.length]);

  // Drop an obstacle on a roof at a world-scene point (from a 3D raycast).
  // Reads placing type from a ref so this callback stays stable (no deps) and
  // is a plain function — no state updater nesting, so StrictMode can't
  // double-invoke side effects here.
  const placeObstacle = useCallback((roofId, point) => {
    const type = placingTypeRef.current;
    if (!type) return;
    const def = OBSTACLE_LIBRARY.find((d) => d.type === type);
    if (!def) return;
    const obs = createObstacle(def, roofId, { x: point.x, z: point.z });
    setObstacles((prev) => [...prev, obs]);
    setSelectedObstacleId(obs.id);
    // placingObstacleType intentionally unchanged — keeps multi-placement active.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteObstacle = useCallback((id) => {
    setObstacles((prev) => prev.filter((o) => o.id !== id));
    setSelectedObstacleId((sel) => (sel === id ? null : sel));
  }, []);

  // Merge-patch a placed obstacle from any source (gizmo, slider, field).
  // This is the single write-point: gizmo → model, panel → model, etc.
  const updateObstacle = useCallback((id, changes) => {
    setObstacles((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...changes } : o))
    );
  }, []);

  // Cleanup: drop obstacles whose roof section was deleted (mirrors the
  // selectedRoofId cleanup pattern), and clear a dangling obstacle selection.
  useEffect(() => {
    setObstacles((prev) => {
      const next = prev.filter((o) => roofSections.some((s) => s.id === o.roofId));
      if (next.length === prev.length) return prev;
      setSelectedObstacleId((sel) =>
        sel != null && !next.some((o) => o.id === sel) ? null : sel
      );
      return next;
    });
  }, [roofSections]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: Delete/Backspace removes the selected obstacle; Esc stops placing or drawing.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape" && isDrawingPlacementArea) {
        setIsDrawingPlacementArea(false);
      } else if (e.key === "Escape" && isDrawingBizZone) {
        setIsDrawingBizZone(false);
      } else if (e.key === "Escape" && placingObstacleType) {
        setPlacingObstacleType(null);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedObstacleId != null
      ) {
        e.preventDefault();
        deleteObstacle(selectedObstacleId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isDrawingPlacementArea,
    isDrawingBizZone,
    placingObstacleType,
    selectedObstacleId,
    deleteObstacle,
  ]);

  // ── Step navigation ───────────────────────────────────────────────────────

  // Application state bundle consumed by isComplete predicates.
  const appState = { location, roofSections, roofDetected };

  const stepConfig  = STEP_CONFIG[currentStep - 1]; // current step's config entry
  const canGoBack   = currentStep > 1;
  const canGoNext   = stepConfig.isComplete(appState);

  const handleNext = () => {
    if (!canGoNext) return;
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    setMaxUnlockedStep((m) => Math.max(m, nextStep));
  };

  const handleBack = () => {
    if (!canGoBack) return;
    setCurrentStep((s) => s - 1);
  };

  // Free navigation to any already-reached step via wizard chip click.
  const handleStepClick = (stepNum) => {
    if (stepNum <= maxUnlockedStep) setCurrentStep(stepNum);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const PanelComponent = stepConfig.Panel;

  // All panel props are passed through; each panel ignores what it doesn't need.
  const panelProps = {
    // Location
    location,
    // Detection
    selectedDetectionMethod,
    setSelectedDetectionMethod,
    // Roof sections
    roofSections,
    selectedRoofId,
    setSelectedRoofId,
    roofDetected,
    // Derived
    roofCount,
    totalAreaM2,
    totalUsableAreaM2,
    // Callbacks
    updateSection,
    renameSection,
    onAddSection,
    onDeleteSection,
    // Obstacles (Step 3)
    obstacles,
    selectedObstacleId,
    setSelectedObstacleId,
    placingObstacleType,
    startPlacing,
    deleteObstacle,
    updateObstacle,
    gizmoMode,
    setGizmoMode,
    view3D,
    setView3D,
    // Simulation (Step 4)
    simDay,
    setSimDay,
    simMinutes,
    setSimMinutes,
    simPlaying,
    setSimPlaying,
    simSpeed,
    setSimSpeed,
    sun,
    dayTimes,
    // Shadow heatmap (Step 4B-1)
    shadowResult,
    shadowRunning,
    shadowProgress,
    runShadowAnalysis,
    canRunShadow: location.lat != null && roofSections.length > 0,
    // Exposure score (Step 4C)
    exposureResult,
    heatmapMode,
    setHeatmapMode,
    // Zone classification (Step 5A) + merge (Step 5B)
    zoneResult,
    zoneMergeResult,
    // Zone editor (Step 5C) — user edits + live stats
    zoneDisplayList,
    effectiveZoneStats,
    orphanedEditCount,
    updateZoneEdit,
    resetZoneToAuto,
    designState,
    isStaleDesign,
    onUpdateDesign: handleUpdateDesign,
    isUpdatingDesign,
    selectedZoneId,
    setSelectedZoneId: handleSelectZoneForAnalysis,
    zoneEditMode,
    setZoneEditMode,
    zoneToast,
    // Business zones (Step 5D) — user-drawn rectangles + geometry subtraction
    businessZones,
    selectedBizZoneId,
    setSelectedBizZoneId,
    isDrawingBizZone,
    pendingBizType,
    setPendingBizType,
    finalInstallableStats,
    startBizDrawing,
    stopBizDrawing,
    addBizZone,
    updateBizZone,
    deleteBizZone,
    // Placement Areas (independent design workspace)
    placementAreas,
    selectedPlacementAreaId,
    setSelectedPlacementAreaId: handleSelectPlacementArea,
    isDrawingPlacementArea,
    placementAreaEditMode,
    setPlacementAreaEditMode,
    placementAreaToast,
    autoRenamePlacementAreaId,
    onAutoRenamePlacementAreaHandled: () => setAutoRenamePlacementAreaId(null),
    startPlacementAreaDrawing,
    stopPlacementAreaDrawing,
    updatePlacementArea,
    deletePlacementArea,
    // Placement readiness (Step 5H) — Step 6 input contract
    placementReady,
    // Panel configuration (Step 6 — Placement Area workflow)
    usePlacementAreaPanelWorkflow,
    projectPanelDefaults,
    onUpdateProjectPanelDefaults: updateProjectPanelDefaults,
    selectedPlacementArea: selectedAreaForPanelConfig,
    onSelectPlacementArea: handleSelectPlacementArea,
    onResetAreaToProjectTemplate: resetAreaToProjectTemplate,
    onPatchPlacementAreaConfig: patchPlacementAreaConfig,
    panelShadingRefinement: panelShadingRefinementResult,
    layoutIsStale,
    hasGeneratedLayout: !!generatedPanelLayout,
    generatedPanelLayout,
    onGenerateLayout: handleGenerateLayout,
    onGenerateMaximumLayout: handleGenerateMaximumLayout,
    // Panel module (Step 6A-1)
    selectedPanelId,
    setSelectedPanelId,
    selectedPanel,
    // Panel layout — active read model (PA: effective; legacy: overrides)
    panelLayout: activePanelLayout,
    baselinePanelLayout,
    persistedArrays: electricalArrays,
    persistedTerminationPoint: electricalTerminationPoint,
    onArraysChange: handleArraysChange,
    onTerminationPointChange: handleTerminationPointChange,
    onRegisterArrayToolHandlers: handleRegisterArrayToolHandlers,
    onRegisterTerminationHandlers: handleRegisterTerminationHandlers,
    designCentre,
    panelEditMode,
    setPanelEditMode: handleSetPanelEditMode,
    selectedPanelSlotId,
    // Panel arrays (6C-1 / 6C-2)
    panelArrays,
    selectedArrayId,
    onSelectArray: setSelectedArrayId,
    onRenameArray: handleRenameArray,
    onElectricalSelectionChange: handleElectricalSelectionChange,
    onRegisterElectricalPanelPickHandlers: handleRegisterElectricalPanelPickHandlers,
    // Step 6 capacity planning
    placementPlanning,
    onUpdatePlacementPlanning: updatePlacementPlanning,
    placementLiveSummary,
    resolvedTargetCapacityKw,
    locationSpecificYield,
    maxRoofCapacityKw,
    onAutoPlace: handleAutoPlace,
    // Solar resource (Step 7A) — cached climate data for 7B+
    solarResource,
    solarResourceStatus,
    solarResourceError,
    energyResult,
    // Financials (Step 8A)
    financialInputs,
    onUpdateFinancialInputs: updateFinancialInputs,
    costResult,
    savingsResult,
    roiResult,
    consumptionInputs,
    onUpdateConsumptionInputs: updateConsumptionInputs,
    consumptionResult,
    coverageResult,
    committedPanelLayout: committedResults?.panelLayout ?? null,
    committedPanelArrays: committedResults?.panelArrays ?? null,
    // For PlaceholderPanel (and future panels that need context)
    step:  currentStep,
    label: stepConfig.label,
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#071120] overflow-hidden text-white">

      {/* ── Top header bar ── */}
      <HeaderBar
        setLocation={setLocation}
        currentStep={currentStep}
        projectName={projectMeta.projectName}
        onProjectNameChange={(name) => patchProjectMeta({ projectName: name })}
      />

      {/* ── Main content row ── */}
      {currentStep === WIZARD_STEP.PROJECT ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <ProjectWorkspace
            location={location}
            roofSections={roofSections}
            panelLayout={workspacePanelLayout}
            energyResult={energyResult}
            costResult={costResult}
            savingsResult={savingsResult}
            roiResult={roiResult}
            coverageResult={coverageResult}
            installedSystemKw={installedSystemKw}
            projectMeta={projectMeta}
            onPatchMeta={patchProjectMeta}
            isStaleDesign={isStaleDesign}
            onUpdateDesign={handleUpdateDesign}
            isUpdatingDesign={isUpdatingDesign}
          />
        </div>
      ) : (
      <div className="relative z-0 flex-1 min-h-0 flex gap-3 p-3">

        {/* ── Left — map / 3D workspace ────────────────────────────────────── */}
        <div className="flex-1 min-h-0 relative">

          {/* View segmented control — workspace toolbar (Steps 2–10).
              Three segments: 2D (Leaflet map) · 3D (perspective) · Top (bird's-eye).
              3D and Top are gated on at least one roof section. View persists across steps. */}
          {currentStep >= WIZARD_STEP.ROOF && currentStep <= WIZARD_STEP.VISUALIZATION && (() => {
            const hasRoof = roofSections.length > 0;
            const SEGMENTS = [
              {
                id: "2d",
                Icon: FiMap,
                label: "2D",
                active: !view3D,
                enabled: true,
                title: "2D satellite map",
                onClick: () => setView3D(false),
              },
              {
                id: "3d",
                Icon: FiBox,
                label: "3D",
                active: view3D && cameraPreset === "perspective",
                enabled: hasRoof,
                title: hasRoof ? "3D perspective view" : "Draw a roof section first",
                onClick: () => { setView3D(true); setCameraPreset("perspective"); },
              },
              {
                id: "top",
                Icon: FiNavigation,
                label: "Top",
                active: view3D && cameraPreset === "top",
                enabled: hasRoof,
                title: hasRoof ? "Bird's-eye top-down view" : "Draw a roof section first",
                onClick: () => { setView3D(true); setCameraPreset("top"); },
              },
            ];
            return (
              <div className="absolute top-3 left-3 z-[1002] flex items-center gap-2 pointer-events-auto">
                <div className="flex items-center gap-1 p-1 min-h-[40px] bg-[rgba(16,27,45,0.88)] backdrop-blur-xl border border-[#23324A] rounded-full shadow-lg">
                {SEGMENTS.map(({ id, Icon, label, active, enabled, title, onClick }) => (
                  <button
                    key={id}
                    disabled={!enabled}
                    title={title}
                    onClick={enabled ? onClick : undefined}
                    className={[
                      "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-150 select-none",
                      active
                        ? "bg-[#4F8CFF] text-white shadow-sm"
                        : enabled
                        ? "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5"
                        : "text-[#94A3B8]/30 cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                  </button>
                ))}
                </div>
                {workspaceVisibility.showDimensionsToggle && (
                  <ShowDimensionsControl
                    checked={showDimensions}
                    onChange={setShowDimensions}
                  />
                )}
              </div>
            );
          })()}

          {/* 2D Leaflet map — always mounted so geoman layers are preserved.
              Hidden via display:none when 3D is active (NOT unmounted). */}
          <div style={{ display: view3D ? "none" : "block", height: "100%" }}>
            <MapView
              location={location}
              setLocation={setLocation}
              roofSections={roofSections}
              setRoofSections={setRoofSections}
              selectedRoofId={selectedRoofId}
              setSelectedRoofId={setSelectedRoofId}
              selectedDetectionMethod={selectedDetectionMethod}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              currentStep={currentStep}
              panelCollapsed={panelCollapsed}
              view3D={view3D}
              panelResizeTick={mapResizeTick}
              roofDetected={roofDetected}
              showDimensions={showDimensions}
              measurementStepVisibility={measurementStepVisibility}
              roofEditLive={roofEditLive}
              measureEditRoof={roofMeasureEditing}
              onRoofMeasureEditChange={setRoofMeasureEditing}
              onRoofEditLiveChange={setRoofEditLive}
            />
          </div>

          {/* 3D Three.js workspace — mounted only when view3D is active.
              Obstacle interaction is enabled on Step 3 only (contextual tools). */}
          {view3D && (
            <div className="absolute inset-0">
              <RoofView3D
                roofSections={roofSections}
                selectedRoofId={selectedRoofId}
                obstacles={obstacles}
                obstaclesEnabled={currentStep === 3}
                showObstacles={currentStep >= WIZARD_STEP.OBSTACLES && currentStep <= WIZARD_STEP.VISUALIZATION}
                placingObstacleType={placingObstacleType}
                selectedObstacleId={selectedObstacleId}
                gizmoMode={gizmoMode}
                simulationActive={currentStep >= 4}
                sun={sun}
                arcPoints={arcPoints}
                arcHours={arcHours}
                heatmapMode={heatmapMode}
                exposureResult={exposureResult}
                zoneResult={zoneResult}
                zoneMergeResult={zoneMergeResult}
                zoneDisplayList={zoneDisplayList}
                selectedZoneId={selectedZoneId}
                onSelectZone={handleSelectZoneForAnalysis}
                placementAreas={placementAreas}
                selectedPlacementAreaId={selectedPlacementAreaId}
                onSelectPlacementArea={handleSelectPlacementArea}
                isDrawingPlacementArea={isDrawingPlacementArea && currentStep === 5}
                onAddPlacementArea={addPlacementArea}
                onCancelPlacementAreaDraw={stopPlacementAreaDrawing}
                placementAreaEditMode={placementAreaEditMode}
                onSetPlacementAreaEditMode={setPlacementAreaEditMode}
                onCommitPlacementAreaPolygon={handleCommitSelectedPlacementAreaPolygon}
                showPlacementAreas={showPlacementAreasInWorkspace}
                shadowRunToken={shadowRunToken}
                shadowResult={shadowResult}
                shadowDay={simDay}
                shadowLat={location.lat}
                shadowLng={location.lng}
                onShadowResult={handleShadowResult}
                onShadowProgress={handleShadowProgress}
                onPlaceObstacle={placeObstacle}
                onSelectObstacle={setSelectedObstacleId}
                onDeselectObstacle={() => setSelectedObstacleId(null)}
                onUpdateObstacle={updateObstacle}
                onDeleteObstacle={deleteObstacle}
                onSetGizmoMode={setGizmoMode}
                cameraPreset={cameraPreset}
                businessZones={businessZones}
                isDrawingBizZone={isDrawingBizZone && currentStep === 5}
                onAddBizZone={addBizZone}
                onCancelBizDraw={stopBizDrawing}
                selectedBizZoneId={selectedBizZoneId}
                onSelectBizZone={setSelectedBizZoneId}
                showBizZones={workspaceVisibility.businessZones}
                showPlacedPanels={workspaceVisibility.placedPanels}
                placedPanels={renderedPlacedPanels}
                panelVisualContext={panelVisualContext}
                ghostPanelSlots={
                  workspaceVisibility.ghostPanelSlots && panelEditMode === "add"
                    ? renderedGhostSlots
                    : []
                }
                zonesDimmed={workspaceVisibility.zonesDimmed}
                panelsInteractive={workspaceVisibility.panelEditing || currentStep === WIZARD_STEP.VISUALIZATION}
                electricalPanelPicking={
                  workspaceVisibility.electricalPanelPicking
                  && !electricalTerminationPlacementMode
                }
                electricalTerminationActive={currentStep === WIZARD_STEP.ELECTRICAL}
                activeArrayPanelIds={activeArrayPanelIds}
                selectedElectricalPanelIds={electricalSelectedPanelIds}
                stringHighlightPanelIds={electricalStringHighlightPanelIds}
                stringWiringSegments={
                  currentStep === WIZARD_STEP.ELECTRICAL ? electricalStringWiringSegments : []
                }
                homerunWiringSegments={
                  currentStep === WIZARD_STEP.ELECTRICAL ? electricalHomerunWiringSegments : []
                }
                terminationPoint={
                  currentStep === WIZARD_STEP.ELECTRICAL ? electricalTerminationPoint : null
                }
                terminationPlacementMode={
                  currentStep === WIZARD_STEP.ELECTRICAL && electricalTerminationPlacementMode
                }
                terminationPointSelected={
                  currentStep === WIZARD_STEP.ELECTRICAL && electricalTerminationPointSelected
                }
                onPlaceTerminationPoint={handlePlaceTerminationPoint}
                onMoveTerminationPoint={handleMoveTerminationPoint}
                onSelectTerminationPoint={handleSelectTerminationPoint}
                onTerminationDragActiveChange={setElectricalTerminationDragActive}
                terminationDragActive={electricalTerminationDragActive}
                designCentre={designCentre}
                selectedElectricalStringId={
                  currentStep === WIZARD_STEP.ELECTRICAL ? electricalSelectedStringId : null
                }
                onElectricalSelectPanel={handleElectricalSelectPanel}
                onClearElectricalPanelSelection={handleClearElectricalPanelSelection}
                showPanelEditToolbar={workspaceVisibility.panelEditToolbar}
                showArrayToolsToolbar={showArrayToolsToolbar}
                selectedElectricalArray={selectedElectricalArray}
                onArrayRotate={handleArrayRotate}
                onArraySetFrozen={handleArraySetFrozen}
                hidePlacementAreaEditToolbar={currentStep === WIZARD_STEP.ELECTRICAL}
                presentationMode={currentStep === WIZARD_STEP.VISUALIZATION}
                presentationLayers={currentStep === WIZARD_STEP.VISUALIZATION ? presentationLayers : null}
                panelEditMode={panelEditMode}
                onSetPanelEditMode={handleSetPanelEditMode}
                selectedPanelSlotId={selectedPanelSlotId}
                onSelectPanelSlot={handleSelectPanelSlot}
                onDeselectPanelSlot={() => setSelectedPanelSlotId(null)}
                selectedArrayId={selectedArrayId}
                arrayHighlightPanelIds={
                  currentStep === WIZARD_STEP.ELECTRICAL ? electricalHighlightPanelIds : null
                }
                dimElectricalArrays={
                  currentStep === WIZARD_STEP.ELECTRICAL && electricalHighlightPanelIds.length > 0
                }
                onDeselectArray={() => setSelectedArrayId(null)}
                onDeletePanelSlot={handleDeleteSelectedPanel}
                onAddPanelSlot={handleAddPanelSlot}
                onUndoPanelEdit={handleUndoPanelEdit}
                onRedoPanelEdit={handleRedoPanelEdit}
                panelCanUndo={panelCanUndo}
                panelCanRedo={panelCanRedo}
                panelMoveEnabled={usePlacementAreaPanelWorkflow && !!generatedPanelLayout}
                panelSnapSlots={panelSnapSlots}
                onMovePanel={handleMovePanel}
                onPanelDragActiveChange={handlePanelDragActiveChange}
                panelDragActive={panelDragActive}
                nearestSnapSlotFn={nearestPanelSnapSlot}
                onRotatePanel={handleRotateSelectedPanel}
                zoneEditingEnabled={false}
                zoneEditMode={zoneEditMode}
                onSetZoneEditMode={setZoneEditMode}
                onCommitZonePolygon={handleCommitSelectedZonePolygon}
                showDimensions={showDimensions}
                measurementStepVisibility={measurementStepVisibility}
                measureEditRoof={roofMeasureEditing}
              />
            </div>
          )}

          {/* Global simulation tool — Steps 4+ (shared state, floating UI) */}
          {currentStep >= 4 && (
            <GlobalSimulationTool
              expanded={simToolExpanded}
              onToggleExpanded={setSimToolExpanded}
              location={location}
              sun={sun}
              dayTimes={dayTimes}
              simDay={simDay}
              setSimDay={setSimDay}
              simMinutes={simMinutes}
              setSimMinutes={setSimMinutes}
              simPlaying={simPlaying}
              setSimPlaying={setSimPlaying}
              simSpeed={simSpeed}
              setSimSpeed={setSimSpeed}
              view3D={view3D}
              setView3D={setView3D}
              roofSections={roofSections}
            />
          )}

          {currentStep === WIZARD_STEP.VISUALIZATION && (
            <PresentationLayersControl
              expanded={layersPanelExpanded}
              onToggleExpanded={setLayersPanelExpanded}
              layers={presentationLayers}
              onPatchLayers={patchPresentationLayers}
            />
          )}

          <UpdateDesignFloatingBar
            show={isStaleDesign}
            onUpdateDesign={handleUpdateDesign}
            isUpdatingDesign={isUpdatingDesign}
          />
        </div>

        {/* ── Right — collapsible + drag-resizable step panel ─────────────── */}
        {/*
          Outer wrapper: width transitions between panelWidth and a slim handle
          strip (COLLAPSED_PANEL_W). panelWidth is preserved while collapsed so
          expand restores the previous size. overflow-hidden clips content as
          the shell narrows. Content inside is capped at MAX_PANEL_CONTENT_W and
          centered when the panel chrome is wider than necessary.
        */}
        <div
          ref={panelOuterRef}
          className="relative shrink-0 h-full overflow-hidden transition-[width] ease-in-out duration-200"
          style={{ width: panelCollapsed ? COLLAPSED_PANEL_W : panelWidth }}
          onTransitionEnd={handlePanelTransitionEnd}
        >
          {panelCollapsed && (
            <button
              type="button"
              onClick={handleExpandPanel}
              className="absolute inset-0 z-[2002] flex items-center justify-center bg-[rgba(16,27,45,0.92)] border-l border-[#23324A] text-[#94A3B8] hover:text-[#4F8CFF] hover:bg-[#162338] transition-colors duration-150 cursor-pointer"
              title="Expand panel"
              aria-label="Expand panel"
            >
              <HiChevronLeft size={12} />
            </button>
          )}

          {!panelCollapsed && (
            <>
              <div
                className="absolute left-0 top-0 bottom-0 z-[2001] w-3 cursor-col-resize group"
                onMouseDown={handleDragStart}
                title="Drag to resize panel"
              >
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-transparent group-hover:bg-[#4F8CFF]/25 transition-colors duration-150 rounded-r-sm" />
              </div>

              <button
                type="button"
                onClick={handleCollapsePanel}
                className="absolute top-[22px] right-[22px] z-[2000] w-6 h-6 rounded-lg flex items-center justify-center bg-[rgba(7,17,32,0.65)] border border-[#23324A] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#162338] transition-all duration-150"
                title="Collapse panel"
                aria-label="Collapse panel"
              >
                <HiChevronRight size={11} />
              </button>
            </>
          )}

          <div
            className={`h-full flex justify-center overflow-hidden ${
              panelCollapsed ? "invisible pointer-events-none" : ""
            }`}
            style={{ width: panelWidth }}
            aria-hidden={panelCollapsed}
          >
            <div
              className="h-full w-full min-w-0"
              style={{ maxWidth: MAX_PANEL_CONTENT_W }}
            >
              <PanelComponent {...panelProps} />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── Bottom workflow bar ── */}
      <div className="shrink-0">
        <StepWizard
          currentStep={currentStep}
          maxUnlockedStep={maxUnlockedStep}
          canGoNext={canGoNext}
          canGoBack={canGoBack}
          onNext={handleNext}
          onBack={handleBack}
          onStepClick={handleStepClick}
        />
      </div>
    </div>
  );
}
