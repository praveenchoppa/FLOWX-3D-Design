Current Status — LumenDesignX

Where we are

Steps 1–5 and 5H COMPLETE. Step 6 (Panels) LARGELY COMPLETE: 6A-1..6A-4 (definition, auto-placement, 3D render, capacity), 6B-1 (manual edit: select/delete/add/undo-redo), 6C-6 (clearances + grid/containment/irregular-fill), 6C-1/6C-2 (array grouping + manager) all DONE. Steps 7 (Energy: 7A/7B/7C) and 8 (Financials: 8A–8E) built and functional. Remaining in earlier steps: 5E full merge/split (deferred); panel drag-move/rotate (rotate button currently non-functional — fix later, NOT an electrical dependency); string-level work.

NEW: ELECTRICAL DESIGN module introduced as workflow step between Panels and Energy.

P0 DONE: empty "Electrical Design" wizard step (pipeline renumbered, pass-through, verified Panels→Electrical→Energy flow intact).
Architecture FROZEN in ElectricalDesign_TDD.md (v1.0) — the source of truth.
NEXT: P1 (Electrical Store + auto-create Arrays from placement areas + minimal functional workspace + array selection). Implementation begins task-by-task, starting with Task A (module folder scaffolding, no logic).

This file tracks workflow, features, and progress — not styling. UI/visual specs are per-task prompts. All UI follows design system (PROJECT_CONTEXT decision 9). Note: the frontend-design skill is NOT in the Cursor workspace — Cursor relies on existing 3D patterns + pinned three/R3F/drei versions.

Locked decisions in place

Stack: React + Vite + Tailwind + Leaflet + react-leaflet. 3D: R3F / Three.js (+ drei TransformControls). Map/geocoding free (Leaflet+OSM/Nominatim+Esri) — TEMPORARY stand-in for billed Google APIs (decision 1), behind geocoding.js. Drawing: leaflet-geoman. Roof state: roofSections: [{ id, name, coordinates, areaM2, vertexCount, roofType, pitch, azimuth, height, setback, usableAreaM2, metadataSource }]. Obstacle state: obstacles: [{ id, type, roofId, position:{x,z}, width, length, height, scale, rotation }]. Per-cell grid (4B→4C→5A): { x, z, shadePct, underObstacle, exposureScore, zoneClass }. 2D = Leaflet, 3D = separate Three.js scene; geometry is shared source of truth. Obstacles 3D-only. Roof geometry finalized at end of Step 2. Contextual tools (decision 8); design system (decision 9); exposure score blends shade AND orientation/tilt (decision 5). ZONING LOCKED: 5 classes — Excellent (≥85) / Good (70–84) / Average (50–69) / Avoid (0–49) from the exposure score, + Blocked (panels physically can't go: under obstacle, in setback, or manually restricted later) as a distinct geometry/rule class. Fixed thresholds now (adjustable later). Auto-generate first, manual override second. Installable Area = Excellent + Good. Panels (Step 6) may ONLY go in Excellent / Good / manually-allowed areas — never in Avoid or Blocked. Cascade is pure/synchronous: shadowResult → exposureResult → zoneResult (no re-raycast).

COMPLETED — by step

Step 1 (Location) — three-pane layout; Esri map + custom controls; search (Nominatim via geocoding.js); locate; draggable marker; manual polygon drawing (geoman contextual toolbar); per-roof selection; output cards.

Step 2 (Roof) — section management (add/rename/delete/select); boundary editing; per-roof metadata (roofType/pitch/azimuth/height/setback) with flagged defaults + Auto/Manual toggle (Auto = disabled placeholder); usable area (setback inset); design summary. 3D workspace (2b-1): gated 2D↔3D toggle; clean Three.js model (parapet decks, soft lighting, graded bg) from boundary+height+pitch; all sections one scene; orbit/pan/zoom; live update; selection highlight. (No satellite texture in 3D — deliberate.)

View toggle + Top preset — segmented 2D/3D/Top, top-left, gated Steps 2–5; Top = straight-down camera, still rotatable.

Step controller — STEP_CONFIG registry; currentStep + maxUnlockedStep; per-step panels (Location/Roof/Obstacle/Simulation/Zones/Placeholder); step-aware tools; Next gated by isComplete; free back-nav; future steps locked.

Panel UX — collapsible (slide off + floating reopen, invalidateSize) + drag-resizable (min~360/max~560, resizes 2D & 3D cleanly).

Step 3a (Obstacles place+count) — obstacleTypes.js; 8-type primitive library; click-to-place via raycast (single-placement fix); select (amber) + delete; attach via roofId (removed w/ roof); live summary (count, footprint, remaining free).

Step 3b (Obstacle transform) — single source of truth (updateObstacle); 3D gizmo (Move/Rotate/Scale) + toolbar + fields + sliders synced; Scale=uniform W&L, Height independent; OrbitControls off during drag; commit-on-release. Boundary containment to roof DECK polygon via ray-cast point-in-polygon over 4 rotated footprint corners + axis-separated sliding — works for convex AND concave/L-shaped/notched roofs. (Fixed: drei TC moves a sibling GROUP not the mesh → use mesh.parent; convex margin → footprint point-in-polygon.)

Step 4A (sun + shadows) — SunCalc moving sun + Three.js shadow-mapping (gated Step 4). solar.js wraps SunCalc 2.0 (2.x degrees + compass-from-north → normalized to internal radians/from-south); sun → scene XZ (X=E,Y=Up,Z=S). SunSystem.jsx: sun light ambient/hemisphere + arc + marker + hour labels (6AM–6PM). Date presets + custom; time slider w/ sunrise/sunset; Play/Pause/Reset + 1×/2×/5×; live current-moment stats. Verified vs real Hyderabad. Shadows VISUAL ONLY.

Step 4B (measured shadow heatmap) — on-demand "Run Shadow Analysis"; SEPARATE CPU raycaster pass. shadowGrid.js (pure): coarse ~1m grid over each roof's DECK polygon, per-roof cell cap ~1200 (auto-enlarges on big roofs); precompute day's above-horizon sun dirs (30-min steps); raycast each cell per step → shadePct. Per-cell {x,z,shadePct, underObstacle} + summary. ShadowHeatmap instancedMesh, green→red, Top-readable. Runs on setTimeout(0); persists until re-run/inputs change. Under-obstacle fix: cells in an obstacle footprint (box=rotated-corner poly; cylinder=radius) → shadePct=1.0, underObstacle=true, skip raycast.

Step 4C (exposure score) — per-cell 0–100 = sunAccess(1−shadePct) × orientationFactor, ×100. exposureScore.js (pure): constants in ORIENTATION_PARAMS (LAT_TILT_FRACTION 0.87, FLAT_FACTOR 0.90, NORTH_FACTOR 0.42, MIN_PITCH_FACTOR 0.50…). flat≈0.90, south-optimal≈1.0, E/W≈0.71, north≈0.42; pitch peaks at lat×0.87°; underObstacle→0. computeExposureResult → per-roof avg + best/worst, synchronous (reuses 4B grid). Mode toggle Shade%|Score; score view green=excellent→red=poor. Panel: per-roof bars + best/ worst. scoreBand/scoreBandColor shared.

Step 5A+5F+5G (classify + stats + installable) — zoneClassification.js (pure): ZONE_THRESHOLDS (all 5 in one place) + ZONE_META (color/label per class, single source for panel + heatmap). classifyCell runs the Blocked check FIRST (geometry rule), then score bands. computeZoneResult(exposureResult, roofSections) → { byRoof, totals, installableAreaM2 }, cascades synchronously from exposureResult (<1ms, no raycast). ZonesPanel.jsx (Step 5): Installable Area headline (Excellent+Good), per-class area bars w/ "installable" badges + % of roof, threshold reference. Heatmap view toggle now 3-way: Shade % / Exp. Score / Zones (cells colored by class: Excellent 
#22c55e, Good 
#86efac, Average 
#eab308, Avoid 
#f97316, Blocked 
#475569). Auto-switches to Zone view + 3D on mount; prompts to Run Shadow Analysis if not yet run. Verified: classes sum to 100% of roof; Installable responds to roof orientation.

Step 5B-display (zone polygon smoothing, display-only) — Chaikin corner-cutting in ZoneMergedPolygons.jsx: SMOOTH_ITERS=2, SMOOTH_RATIO=0.25. Fill geometry uses chaikinSmooth(outer/holes) → natural GIS-style curves, no stair-steps. Outline strokes use ORIGINAL outer ring (not smoothed) → adjacent zone outlines draw at identical shared vertices = zero visible crack between zones. Holes also Chaikin-smoothed for natural obstacle cutout appearance. source-of-truth invariant: region.outerRing / region.holes never touched; all stats/installable/area calculations use original geometry. Build: clean (919 modules, 0 errors).

Step 5C+5E-simple (Zone Manager + editing + persistence) — zoneEditorUtils.js (pure): computeRegionSig (stable sigKey: "roofId::class::cx.1d,cz.1d"), autoNameRegions ("Excellent Zone A"… sorted by area DESC within class), buildZoneDisplayList (reconciles zoneEdits onto allRegions via exact-key fast path + fuzzy centroid/area search, SIG_CENTROID_MAX_DIST_M=2.5m, SIG_AREA_MAX_REL_DIFF=20%), computeEffectiveStats (live totals respecting soft-delete+typeOverride), countOrphanedEdits (warning trigger). DesignStudio: zoneEdits Map (persistent) + selectedZoneId + zoneDisplayList useMemo + effectiveZoneStats + orphanedEditCount + updateZoneEdit callback. All wired to panelProps

RoofView3D→Scene→ZoneMergedPolygons. ZoneMergedPolygons: split geometry memo (keyed on mergeResult only, no rebuild on edit) from display map (effectiveClass→color, deleted→hide, selected→white outline+opacity0.85+lineWidth3.5); onClick fires onSelectZone. ZonesPanel: Zone Manager cards grouped by effectiveClass, selectable (card↔polygon sync via scrollIntoView
ZoneMergedPolygons onClick), inline rename (pencil icon → input → blur/Enter saves, Escape cancels), soft-delete (eye-off → hidden count toggle → restore), convert type (colored pill row on selected card, ↩ reset to original class), orphaned-edit warning banner, Installable Area from effectiveZoneStats (live on every edit). Build: clean (919 modules, 0 errors).

Step 5D-A+5D-B (manual rectangle business zones + geometry subtraction) — bizZoneConfig.js (pure): BIZ_TYPE_CONFIG (Maintenance/Walkway/Restricted/No-Install/Future Expansion — all BLOCK, Future Expansion tagged "reserved"), BIZ_TYPES, DEFAULT_BIZ_TYPE, autoNameBizZone, computeInstallableAfterBizZones (turf.difference loop over installable sim zones per biz zone — gives ACTUAL remaining polygon, not just a number; shoelace area for flat-earth coordinates — turf.area() excluded since it uses geodetic math). DrawBizZoneLayer.jsx: per-roof transparent hit planes at deckY+0.03; pointerDown starts drag + disables OrbitControls; DOM pointermove/ pointerup listeners + THREE.Plane(up, −deckY) manual raycast for drag tracking (works even when cursor leaves mesh); live preview rectangle via drei/Line (dashed); Esc cancels via keydown listener; produces outerRing [[x,z],...] in scene XZ. BusinessZonesLayer.jsx+: canvas-based diagonal-stripe hatch texture per type (cached); THREE.ShapeGeometry fill from outerRing; drei/Line outline; drei/Html floating label (icon + name, type-colored pill). DesignStudio: businessZones state array, isDrawingBizZone + pendingBizType state, selectedBizZoneId, finalInstallableStats useMemo (computeInstallableAfterBizZones), addBizZone / updateBizZone / deleteBizZone (soft-delete) / startBizDrawing / stopBizDrawing callbacks; Esc key extended; step-transition reset; all wired to panelProps + RoofView3D. RoofView3D: new props + Scene forwarding; DrawBizZoneLayer rendered when isDrawingBizZone&&step5; BusinessZonesLayer when showBizZones. ZonesPanel: BizZoneCard sub-component (icon+name+type-badge+area, inline rename, type-changer on selected, soft-delete/restore); Draw Zone toolbar (type picker, Draw/Cancel button, animated hint while drawing); Business Zone Manager section (cards + hidden list); Installable Area headline uses finalInstallableStats.installableAreaM2 (real subtracted shape) with "-X.X m² blocked" deduction line. Build: clean (922 modules, 0 errors).

Step 5H (placement-readiness export) — placementReady.js (pure): computePlacementReady({ zoneDisplayList, businessZones, obstacles, roofSections }) → live contract for Step 6. installableRegions[]: Excellent/Good sim zones (non-deleted) → turf.difference each business zone + obstacle footprint on same roof → real cut polygons { id, sourceId, roofId, zoneClass, outerRing, holes[], areaM2, pitch, azimuth, avgScore, name }. MultiPolygon splits become separate regions. blockedRegions[]: obstacles (source:'obstacle'), all active business zones (source:'business'), Avoid sim zones (source:'avoid') — each { id, roofId, source, outerRing, label }. roofSections[]: stripped refs { id, name, coordinates, pitch, azimuth, setback, height }. summary: { totalInstallableAreaM2, regionCount, excellent/good { count, areaM2 }, blockedCount }. obstacleOuterRing exported (box rotated corners / cylinder N-gon, matches RoofView3D). DesignStudio: placementReady useMemo (NOT snapshot — recomputes on any zone/biz/obstacle/roof change); wired to panelProps. ZonesPanel: "Placement Readiness" card (region count + m², Excellent/Good KPIs, keep-out count). Build: clean (923 modules).

Step 6A-1 (panel definition) — panelTypes.js (pure): PANEL_TYPES array with LONGi 550W { id:'longi-550', power:550, width:1.134m, height:2.278m, manufacturer:'LONGi' }; DEFAULT_PANEL_ID + getPanelById(). DesignStudio: selectedPanelId state (default DEFAULT_PANEL_ID), selectedPanel useMemo; wired to panelProps. PanelsPanel.jsx replaces PlaceholderPanel in STEP_CONFIG step 6 — shows selected module name/manufacturer/power/ dimensions (display only, no picker). Build: clean (925 modules, 0 errors).

Step 6A-2 (auto-placement geometry) — panelPlacement.js (pure): PANEL_GAP_M=0.02m; computePanelLayout(placementReady, selectedPanel). Roof-aligned grid per installableRegion (rotate −azimuth, lay grid, rotate back); 4-corner footprint test vs outerRing, holes, blockedRegions; spacing = panel dim + gap (non-overlapping). Returns placedPanels[] + summary { total, byRegion }. DesignStudio panelLayout useMemo + console.log verification. No rendering. Build: clean (926 modules, 0 errors).

Step 6A-3+6A-4 (3D panel render + capacity) — PlacedPanels.jsx: thin BoxGeometry (0.04m thick, width×length), dark MeshStandardMaterial, deckY+0.14 offset (above zones), Y-rotation from panel.rotation; InstancedMesh when count>25, dispose geometry on unmount. ZoneMergedPolygons dimmed prop (25% fill opacity on Step 6); zones render on Step 6 even if heatmapMode≠zone. DesignStudio wires showPlacedPanels/zonesDimmed/placedPanels on Step 6. computePanelCapacity in panelPlacement.js (count, systemKw, coveragePct). PanelsPanel: System Capacity headline (kW), Total Panels + Coverage KPIs, per-region breakdown. Build: clean (927 modules, 0 errors).

Step 6B-1 (manual panel editing — select/delete/add/undo-redo) — Overrides architecture: computePanelLayout now returns allValidSlots[] (stable slotId = regionId::row::col) + placedPanels (default = all active). panelEditorUtils.js (pure): panelOverrides { removed[], added[] }; applyPanelOverrides → effective placedPanels + ghostSlots; reconcilePanelOverrides on re-run; undo/redo history snapshots. DesignStudio: basePanelLayout useMemo + panelEditHistory state + effective panelLayout; commitPanelOverrides on add/delete; keyboard Del/Esc/Ctrl+Z/Y. PlacedPanels.jsx: interactive mode (per-mesh click + selection highlight). PanelGhostSlots.jsx: faint ghost boxes in Add mode (pre-validated empty slots). RoofView3D: Step 6 canvas toolbar (Select/Add/Delete/Undo/Redo) + hints; onPointerMissed deselects. PanelsPanel capacity reads effective layout (live kW/count/coverage). No drag-move, rotate, or arrays. Build: clean (929 modules, 0 errors).

Step 6C-6 (placement clearances) — panelPlacement.js: named constants EDGE_CLEARANCE_M / OBSTACLE_CLEARANCE_M / INTER_ROW_GAP_M (0.3m each); PANEL_GAP_M (0.02m) unchanged for within-row adjacency. Per region: turfBuffer inset outer ring (−edge), expand holes + blocked rings (+obstacle); 4-corner test uses clearance-adjusted rings. stepU = panelW + PANEL_GAP_M + INTER_ROW_GAP_M (between rows); stepV = panelL + PANEL_GAP_M (within row). allValidSlots + 6B-1 overrides unchanged. Build: clean.

Step 6C-6 fix (grid + containment) — panelPlacement.js: wrong-axis stepping fixed (cols along U = width+PANEL_GAP_M, rows along V = length+INTER_ROW_GAP_M); 4-corner test in aligned UV frame matching grid; flat-metre edge/obstacle inset on aligned bbox (replaces non-functional turf.buffer on scene XZ). Synthetic 3×58m²: 14→16 candidates, ~50%→100% acceptance, 19→48 panels. Build: clean.

Step 6C-6 irregular fill coverage — panelPlacement.js: grid anchored to polygon fill extent (sampled valid centres), terminal row/col anchors at fillMax, deterministic 4×4 phase pick (max valid panels). Irregular 4-region proxy (~173m²): 17→46 panels, ~25%→69% fill efficiency, coversFill=true all regions. Clean 3×58m² still 16/region. 4-corner test unchanged. Build: clean.

Step 6C-1+6C-2 (array grouping + manager) — panelArrays.js: computePanelArrays() groups effective placedPanels by regionId (stable id=regionId); auto displayName Array A/B/C by count desc; user renames keyed by regionId. DesignStudio: panelArrays useMemo from effective panelLayout; arrayDisplayNames state; selectedArrayId independent of selectedPanelSlotId. PanelsPanel: ArrayCard list (name, count, kW, zone class, azimuth/pitch); inline rename. PlacedPanels: amber array highlight distinct from blue 6B-1 panel selection. Build: clean.

Step 7A (solar resource — NASA POWER) — features/energy/services/: nasaService.js (NASA climatology parse only), solarResourceService.js (app boundary + cache + fallback), fallbackSolarProfiles.js (India + 5 cities), pvwattsService.js STUB. DesignStudio: solarResource state, fetch once per lat/lng (5 dp), AbortController on location change. EnergyPanel: GHI, derived PSH, avg temp, monthly tables; fallback indicator. Vite dev proxy /api/nasa-power. Build: clean.

Global Simulation Tool — SimulationControls.jsx (shared date/time/playback UI extracted from SimulationPanel; no engine logic). GlobalSimulationTool.jsx: floating ☀ chip + expandable glass panel (Steps 4+ only; hidden Steps 1–3). DesignStudio: existing simDay/simMinutes/simPlaying/simSpeed unchanged; single playback loop; simulationActive={currentStep >= 4}. Step 4 sidebar unchanged (SimulationPanel + shadow/exposure sections). Steps 5–7+: same shared state via floating tool; step sidebars remain step-specific. Step 6: placed panels remain castShadow/receiveShadow in lit 3D scene. Build: clean.

Step 7B (energy production engine) — energyLossConfig.js (named non-shading losses ≈14%, shading excluded). computeEnergyResult.js (pure NASA-based engine): arrayKWp × PSH × 365 × PR × solarAccess per array; monthly from monthlyIrradiance × daysInMonth; solarAccess = region avgScore/100 from Step 4 exposure via placementReady; source:"estimate". DesignStudio: energyResult useMemo (solarResource + panelArrays + placementReady). EnergyPanel: System Production KPIs + Array Energy table; 7A climate sections unchanged. pvwattsService.js stub untouched. Build: clean.

Step 7C (production analytics) — recharts added. ProductionAnalytics.jsx: read-only dashboard from energyResult (memoized chart datasets). KPI strip, monthly bar chart

12-month grid table, array comparison horizontal bars (sorted desc by annual energy), system PR/CF + per-array solar-access gauge bars. EnergyPanel embeds 7C below 7A climate data; no engine changes, no pie charts. Build: clean.

Step 8A (system cost + subsidy) — costConfig.js (DEFAULT_FINANCIAL_INPUTS, PM Surya Ghar 2026 slabs, COMPONENT_COST_DEFAULTS reserved). computeCostResult.js (pure): gross = kWp×1000×₹/W; subsidy slabs or manual override; net = gross − subsidy. DesignStudio: financialInputs state (persists across recompute); costResult useMemo from financialInputs + installedSystemKw. FinancialsPanel: KPI cards + ₹/W input, PM Surya Ghar toggle, manual override. Build: clean.

Step 8B (savings engine) — computeSavingsResult.js (pure): Year 1 savings from energyResult × tariffPerUnit; 25-year yearlySavings with tariffEscalation and panelDegradation; lifetimeSavings = sum(yearlySavings). financialInputs extended (tariff ₹7/kWh, 3% escalation, 0.5% degradation). DesignStudio: savingsResult useMemo (energyResult + financialInputs). FinancialsPanel: savings KPIs + tariff inputs. Cost engine untouched. Build: clean.

Step 8C (ROI & payback) — computeRoiResult.js (pure): cumulativeSavings from yearlySavings; fractional payback via linear interpolation; breakEvenYear; roiPercent = (lifetimeSavings − netCost) / netCost × 100; avgAnnualRoi. DesignStudio: roiResult useMemo (costResult + savingsResult). FinancialsPanel: Payback, ROI, Net Profit, Break-even KPIs. cumulativeSavings exposed for 8D. Build: clean.

Step 8 advisory validation — FINANCIAL_INPUT_SPECS in costConfig (defaults + typical/advisory ranges). validateFinancialInputs.js (UI-only, two levels: advisory vs extreme). FinancialsPanel inline amber warnings; engines unchanged. Build: clean.

Step 8D (cashflow visualization) — CashflowVisualization.jsx: Recharts line chart of roiResult.cumulativeSavings; break-even ReferenceLine/Dot from roiResult; investment journey timeline; financial summary cards (net cost, lifetime savings, net profit). Read-only; no engine changes. Build: clean.

View toggle (Steps 4–10) — DesignStudio: 2D/3D/Top segmented control visible Steps 2–10 (extends through Energy/Financials/Visualization/CRM); view3D + cameraPreset persist across step navigation (removed step-change reset). Same top-left toolbar. Build: clean.

Step 8E (customer electricity usage & coverage) — consumptionConfig.js + computeConsumptionResult.js + computeCoverageResult.js (parallel chain; reads financialInputs.tariffPerUnit only). consumptionInputs state separate from financialInputs. ConsumptionCoverageAnalysis.jsx: bill/units input, KPIs, Production vs Consumption + Coverage % charts. Informational only — savings/ROI/ cashflow engines untouched. Build: clean.

ELECTRICAL DESIGN — module status

Status: Design COMPLETE. Architecture FROZEN in ElectricalDesign_TDD.md (v1.0). Implementation through P5D + Step 7 array rotation/freeze complete.

Completed phases: P0 (wizard step) · P1 (store + arrays + workspace) · P2 (array edit + panel selection + split) · P3 (string create/manage) · P4 (inverter catalog + MPPT generation) · P4b (String→MPPT assignment) · P5A (derived DC capacity + DC/AC calculations) · P5B (one String per MPPT workflow enforcement) · P5C (MPPT utilization + allowed overload slider + soft warnings) · P5D (intra-string wiring visualization + center-to-center length estimate) · **Step 7 array rotation + freeze** · **P5E homerun wiring + user-placed Termination Point** (derived-only `EffectiveWiringLayout`, straight-line homerun, workspace placement plane, persistence like arrays).

Verify: `npx vite-node scripts/verifyHomerunWiring.mjs` (plus existing P5 regression scripts).

NEXT: P6 cable routing (logical/routed toggle) or next TDD phase.

Reference (source of truth): ElectricalDesign_TDD.md — read it first for every Electrical Design prompt. Follow it exactly; do not deviate from the architecture unless implementation reveals a genuine gap (then update the TDD, commit, continue).

Electrical Design rules (from the TDD — quick reference):

Electrical Design CONSUMES panel placement READ-ONLY; never mutates roof / obstacles / simulation / zoning / panel placement.
Arrays are auto-created from placement areas on entering the step.
One orientation/tilt per Array (MVP rule; different orientations = different arrays).
Arrays own Strings (organizationally).
Strings own the electrical values (voltage/current/power) — series connection.
Strings connect to MPPTs (= charge controllers); usually one string per MPPT.
MPPTs belong to Inverters; inverter is a termination point, NOT rendered in 3D.
New ElectricalStore holds arrays[]/strings[]/mppts[]/inverters[]/cables[]; never mutates panel/placement state.
UI is FUNCTIONAL only — FlowX front-end team does the beautification.

Implementation roadmap (see TDD section 11 for detail): P0 DONE — empty wizard step. P1 — Electrical Store + auto-create arrays + minimal workspace + selection (no edit). Task A: module folder scaffolding (features/ElectricalDesign/ with components/ hooks/ store/ services/ models/ utils/ constants/) — NO electrical logic, scaffolding only. Task B: ElectricalStore + auto-create one Array per placement area (VERIFY HARDEST — first touch of existing pipeline; confirm panel/ placement data untouched and Energy/Financial still correct). Task C: minimal functional workspace (toolbar/sidebar/canvas/properties). Task D: array selection + verify initialization. P2 — array editing (rename/split/merge; see TDD 12a merge/split rules). P3 — string creation (manual, then auto). P4 — inverter catalog + selection + MPPT assignment + balancing. P5 — electrical calculations (verify math vs a known example; confirm formulas with Harsha first — TDD open question 8). P6 — cable routing (logical → routed → length → drag-edit). P7 — shortest-path routing optimization (strong model; confirm algorithm intent). P8 — validation & warnings (deferred until after customer feedback).

Per-task discipline: prompt begins "Read ElectricalDesign_TDD.md first, follow it, implement only [task]"; analyze-first if structural; VERIFY in the running app (not the build log); commit each verified task.

NEXT

ELECTRICAL DESIGN P5E+ — termination placement + homerun cable length (when confirmed). 5E (full) — Merge + split zones (deferred). Panel drag-move / rotate — rotate control currently non-functional; fix later (NOT an electrical dependency).

DEFERRED — future upgrades & polish, BY STEP

Step 2: 2b-2 edit roofs in 3D; 2c roof-face splitting (real task). Step 3: 3c nicer obstacle models (AC/vent/tank look real — visual layer; CHECK first whether shadow raycasts obstacle MESH vs stored footprint before building); slope-accurate seating on pitched roofs (fine now, roofs default flat). Step 4: 4D seasonal; 4E Google Solar/NASA POWER/PVWatts (APIs enter — needs Google billing + Lumenor ask); 4F premium viz; 4B annual layer + fine-grid toggle; verify the "1895" number beside the exposure-score bar (likely a sum aggregate; tiny fix if stray). Arc hour labels: 4PM/6PM labels overlap near the horizon — minor, park with arc polish. Large-area performance: ~15k m² fine (minor lag); ~17k occasional "wait" popup (recoverable, completes); extreme (stadium/50k+) freezes. Known cheap fix: reduce shadow-chunk batch size for more frequent yields. Reclassified as extreme-scale edge case. Full UI/UX maturity pass (Steps 1–4): see UIUX_FUTURE_IMPROVEMENTS.md — premium consultant-feel review. PARKED until the pipeline reaches an end-to-end result. PVWatts validation — deferred to backend/API phase (CORS + key management). Multi-roof — drawable in Step 2 but pipeline carries one roof from Step 3; fold into electrical pass. Interim honesty note if >1 roof. Panel visual texture — parked (reads flat; cosmetic; after core engineering). Cross-cutting: scope search bar to Step 1; Google Photorealistic 3D Tiles (separate PAID product, proposal-view only); header chrome placeholders.

OPEN — not yet decided

Requirement-estimate step, Google Solar API coverage, PMSY/OCR/panel-library — PROJECT_CONTEXT section 4. Electrical Design open questions — ElectricalDesign_TDD.md.

Pipeline (data flow)

Location → Roof → Obstacles → Simulation (per-cell shade + exposureScore) → Zoning (classify → merge into zones → installable surface) → Panels (fill Excellent/Good/ allowed only) → Electrical Design (arrays/strings/MPPT/inverter/cable — consumes panels READ-ONLY) → Energy → Financials → Visualization → CRM. Panel-placement region is DERIVED (boundary − setbacks − obstacles − zones), never hand-drawn.