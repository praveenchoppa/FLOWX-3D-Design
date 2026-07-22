Electrical Design — Technical Design Document (TDD)

Module: LumenDesignX › Electrical Design (Step 7) Status: ✅ v1.0 — FROZEN for implementation. Design phase complete. This is now a living document: it changes only when implementation reveals a genuine gap (implementation drives documentation, not the reverse). Do NOT add speculative sections ahead of the phase that needs them. Author: Neha (PM) · Source: requirements call with Harsha (CEO) Purpose of this doc: Single source of truth for the Electrical Design module. Every Cursor/Composer prompt should begin with "Follow ElectricalDesign_TDD.md. Do not deviate from the architecture unless explicitly required."

⚠️ Domain-correctness note: the electrical rules below were captured from a requirements call (partly translated). Before implementing calculations, Neha must confirm the electrical specifics (series voltage/current behaviour, the charge-controller balancing rule, string constraints) and the items in §12 Open Questions with Harsha. This doc structures the design; Harsha owns the domain truth.

1. Overview
Purpose

Convert the placed panel layout into a realistic solar electrical system: group panels into arrays, wire them into series strings, assign strings to inverter charge-controllers (MPPTs), and route DC cable — producing a clean visualization and the electrical values needed downstream.

Objectives (from Harsha)
Clean, clear visualization of how panels/structure connect electrically.
Shortest-path cable routing to minimise total wire used (optimization, not just cosmetic).
Produce the electrical values (voltage, current, power, DC capacity, DC/AC ratio) the design needs.
MVP Scope (build now)
Auto-create arrays from placement areas; split / merge / rename.
String creation — manual and automatic.
Inverter selection from a predefined catalog (built into this module for now).
MPPT (= charge-controller) assignment; usually one string per MPPT.
DC cable routing with a toggle (logical vs routed), cable-length calculation, drag-and-drop manual editing.
Electrical calculations: string voltage, current, power, total DC capacity, DC/AC ratio.
Multiple inverters per project.
Out of Scope (deferred — see §12)
Moving strings between MPPTs ("chaotic" — Harsha deferred).
Inverter-compatibility validation ("hard for now, build later").
All validation rules & warnings (build working output first, validate after customer feedback).
UI beautification — Harsha's front-end team does this. This module builds functional UI only.
Backend / persistence / Google Solar API (later phase, resources provided when reached).
2. Existing Pipeline & Where This Fits

The app is a one-way derived pipeline; downstream never modifies upstream. Electrical Design is inserted between Panels and Energy (already done as an empty step):

Location → Roof → Obstacles → Simulation → Zones → Panels
                                                      ↓
                                            ⚡ Electrical Design  (Step 7 — this module)
                                                      ↓
                                            Energy → Financial → Presentation → Project Summary

Consumption rule: Electrical Design consumes the placed-panel layout (read-only) and produces electrical structure + values. It must NOT modify panel placement, simulation, or the existing energy/financial engines. Energy may later read electrical output, but v1 keeps the existing Panels→Energy flow intact.

3. Functional Requirements
#	Requirement	Notes (from Harsha)
F1	Auto-create one Array per placement area on entering the step	User lands with useful groups, not an empty screen
F2	Split / merge / rename arrays	Reconciles geometric grouping vs electrical grouping
F3	Manual string creation	User draws/selects panels into a series string
F4	Automatic string creation	System groups panels into strings
F5	Inverter from predefined catalog	Built into module now; connected to real item-master at integration
F6	Multiple inverters per project	Supported
F7	Inverter as termination point, not a rendered 3D object	"Wires end here"; downstream team handles physical placement
F8	MPPT (= charge-controller) assignment	Count is dynamic per inverter model
F9	Cable routing toggle: logical / routed	Both modes
F10	Cable length calculation	e.g. "Total cable: 34.2 m"
F11	Drag-and-drop manual cable editing	
F12	Shortest-path routing	Minimise total cable (algorithm — see §12)
F13	Electrical calculations	String V, I, P; total DC capacity; DC/AC ratio
F14	Same-angle toggle for strings	Panels in a string need not share tilt/orientation, but toggle to enforce it
4. Core Concepts (onboarding)
Placement Area — where panels may be placed (from Step 5). A factory: it generates panels and the initial array, then Electrical Design effectively forgets it.
Array — an organizational grouping of panels (e.g. "South Roof"), typically by like orientation/tilt. Owns layout config, not electrical values.
String — a series connection of panels. The electrical unit: voltage adds across panels in series; current stays ~constant. Weakest panel caps the whole string (bottleneck effect — why strings avoid spanning mixed conditions).
MPPT / Charge Controller — treated as equivalent for MVP. An inverter has N of them; each usually takes one string. Balancing rule: summed string output ≤ charge-controller rating (≤ ~10% over tolerable, no more).
Inverter — from a catalog; has a charge-controller count, DC/line voltage & current, total load, phase. Represented as a termination point, not drawn.
Cable — the DC wiring; logical (connection) or routed (drawn path); has a calculated length.
5. Domain Model (Entities)

Electrical values live on the String, not the Array. Array = grouping; String = electrical unit.

Array
id
name                    editable (e.g. "South Roof")
sourcePlacementAreaId    reference to origin (may be null after merge)
panelIds[]               panels in this array
orientation              layout config (portrait / landscape) — ONE per array (design rule)
tilt                     layout config — ONE per array (design rule)
spacing                  layout config
chargeControllerId       which MPPT it feeds (set later)
stringIds[]              strings inside this array

Changing orientation/tilt/spacing = regenerate this array's layout (reuses Step-6 config-regenerate pattern), NOT mesh rotation.

String
id
name
arrayId                  parent array
orderedPanelSequence[]   panels in series ORDER (order matters for routing)
startPanelId             first in series (derived from sequence)
endPanelId               last in series → termination toward MPPT
mpptId                   assigned charge-controller
calculatedVoltage        sum of panel Vmp across the series
calculatedCurrent        ~single-panel current (series)
calculatedPower          V × I
sameAngleEnforced        boolean (the F14 toggle)
status                   valid / warning (validation deferred — field reserved)
Inverter
id
model                    from predefined catalog
totalLoad                capacity
lineVoltage
dcVoltage
dcCurrent
chargeControllerCount    = number of MPPTs
mpptIds[]
phase                    single / 3-phase (affects string grouping)
                         NOT rendered — termination point only
MPPT (= Charge Controller for MVP)
id
inverterId
stringIds[]              usually 1 (multiple avoided in v1)
capacity                 rating; balancing: Σ string output ≤ capacity (+~10% max)
Cable
id
stringId                 (or arrayId) the connection it represents
startPoint
endPoint
path[]                   routed points (visual mode)
length                   calculated
mode                     logical | routed
6. Entity Relationships
Placement Area
      │ generates (factory — then forgotten)
      ▼
Array ──────────── contains ──────────▶ String(s)
  │                                        │
  │ feeds                                  │ assigned to
  ▼                                        ▼
(charge controller)                      MPPT
                                           │ belongs to
                                           ▼
                                        Inverter (termination point)

Cable connects: String start/end panels ──▶ MPPT/Inverter termination

Ownership: Inverter owns MPPTs. Array owns Strings (organizationally). String references its MPPT. Cable references its String. Electrical values are computed on Strings and aggregated up (String → MPPT → Inverter → system DC capacity / DC-AC ratio).

7. State Management
Panels Store  (existing — read-only to this module)
      │ read placed panels
      ▼
Electrical Store  (NEW)
      arrays[]      strings[]     mppts[]     inverters[]     cables[]
      (initialized empty; arrays auto-populated on entry)
      │ produces electrical output
      ▼
Energy Module  (later consumer; v1 leaves existing flow intact)
New ElectricalStore (context/store) holds all five entity collections.
On entering Step 7: initialize store → auto-create one Array per placement area (F1).
Electrical Store reads panels but never mutates the panel/placement/simulation state.
8. User Workflow (every step)
Enter Electrical Design
      ↓
Electrical Store initializes
      ↓
Auto-create Arrays (one per placement area)          [F1]
      ↓
Render arrays in left tree + on canvas
      ↓
User edits arrays: rename / split / merge            [F2]
      ↓
Create strings (manual select OR auto-generate)      [F3, F4]
      ↓
Select inverter from catalog                         [F5]
      ↓
Assign strings → MPPTs (charge controllers)          [F8]
      ↓
Generate wiring: logical or routed (toggle)          [F9]
      ↓
Cable routing + length (drag-drop edit)              [F10, F11, F12]
      ↓
Electrical calculations (V, I, P, DC cap, DC/AC)     [F13]

Selection model (reuses existing patterns):

Array selection → via left sidebar (like placement areas today).
Panel selection → via 3D click (like today).
Selecting an entity updates the right-hand Properties panel.
9. Component Architecture
ElectricalDesign/
  ElectricalWorkspace.jsx        top-level layout (toolbar + left + canvas + right)
  Toolbar.jsx                    mode toggles (auto/manual string, logical/routed)
  LeftSidebar/
    ArrayTree.jsx                arrays → strings tree, selection
  PropertiesPanel.jsx            fields of selected array/string/inverter
  Canvas/
    ElectricalCanvasOverlay.jsx  reuses existing roof/panel 3D view
    ConnectionLayer.jsx          strings + cables drawn over panels
  InverterCatalog.jsx            predefined inverter picker

Functional, not polished. Harsha's team beautifies. Build working layout + interactions; do not spend credits on premium styling.

10. Folder Structure
features/ElectricalDesign/
  components/     (as §9)
  hooks/          useElectricalStore, useArraySelection, ...
  store/          electricalStore (context/reducer)
  services/       stringGenerator, cableRouter, electricalCalculations
  models/         array, string, inverter, mppt, cable (entity factories/validators)
  utils/          geometry, seriesMath
  constants/      inverterCatalog, defaults
11. Implementation Roadmap
Phase	Scope	Model
P0 ✅	Empty Electrical Design step in wizard (done)	Composer
P1	Electrical Store + auto-create arrays from placement areas + minimal functional workspace + array selection (NO editing)	Composer (one solid prompt)
P2	Array editing: rename / split / merge	Composer
P3	String creation — manual, then automatic	Composer (auto-string logic may want a strong model)
P4	Inverter catalog + selection + MPPT assignment + balancing	Composer
P5	Electrical calculations (V/I/P, DC capacity, DC/AC)	Composer + verify math against a known example
P6	Cable routing: logical → routed → length → drag-edit	Composer
P7	Shortest-path routing optimization	Strong model (algorithm design)
P8	Validation & warnings	After customer feedback (deferred)

Each phase: analyze-first if structural → implement → verify in the running app → commit. Never trust "build passes"; run it.

12. Open Questions (confirm with Harsha before the relevant phase)
Final output format — on-canvas visual only, or exportable (AutoCAD/DXF)? (Un-answered in call — blocks P6 scope.)
String → MPPT connection ("lugs") — exact representation unclear; both parties said "research it." (Blocks P4 data detail.)
Shortest-path algorithm — Harsha called it an "equation, O-to-E" (possibly mis-transcribed "obsidian/Euclidean"). Likely a Minimum Spanning Tree (least total cable to connect points) rather than pure shortest-path, possibly with obstacle-avoidance. Confirm the intent and pick MST vs Dijkstra at P7.
Array = single orientation always? — MVP DECISION (reasoned, not yet Harsha-confirmed): yes — an array holds one orientation/tilt; different orientations → different arrays; merge across differing orientations disallowed. Confirm at TDD review; revisit if Harsha wants mixed-orientation arrays.
MPPT with multiple strings — "usually avoid" now; allowed in a later version?
Validation rules — deferred; define after first customer feedback.
Backend persistence — module is in-memory; persistence strategy is a later backend-phase decision.
Electrical formula confirmation — confirm series V-adds / I-constant behaviour and the exact charge-controller balancing tolerance (~10%) with Harsha before P5.
12a. Array Merge / Split Rules (for P2)

Merge — combine two or more arrays into one.

Input:  Array A, Array B (+ …)
Output: one new Array
Rules:
  - panelIds        = union of all input arrays' panels
  - sourcePlacementAreaId = null if inputs came from different placement areas
                            (keep the shared id if all inputs share one)
  - stringIds       = INVALIDATED — existing strings are cleared; user recreates
  - orientation/tilt: **DESIGN RULE (MVP decision — reasoned, not yet Harsha-confirmed):**
                      an Array holds panels of ONE orientation/tilt.
                      If the two arrays share orientation/tilt → merge, preserve it.
                      If they differ → merge is NOT allowed (they stay separate arrays).
                      Rationale: mixing orientations in one group causes the series bottleneck
                      problem Harsha described; different orientations = different arrays.
                      (Confirm with Harsha at review; revisit if he wants mixed-orientation arrays.)
  - name            = user-provided (default e.g. "Merged Array")

Split — divide one array into two.

Input:  an Array + a selection of its panels
Output: original Array (minus selected) + new Array (the selected panels)
Rules:
  - selected panels MOVE to the new array (removed from the original)
  - both arrays' stringIds = INVALIDATED — strings cleared, user recreates
  - new array inherits orientation/tilt from the source (user may change → regenerate)
  - sourcePlacementAreaId carried to the new array (same origin)
  - name = user-provided (default e.g. "Array N")

Common rule: any array structural change invalidates that array's strings. Strings depend on which panels are in the array, so changing membership makes existing strings stale. See §12b.

12b. State Invalidation Rules

The project has already hit stale-state bugs; this table is the guard. When the left action happens, the middle becomes stale and must be recomputed/cleared (right). Mirror the existing DIRTY/CLEAN + explicit-refresh pattern — never silently show stale electrical numbers.

Action	Invalidates	Needs recompute / rebuild
Split array	that array's strings	Yes — clear strings, user recreates
Merge arrays	inputs' strings	Yes — clear strings, user recreates
Change array orientation / tilt / spacing	that array's panel layout	Yes — regenerate layout (Step-6 pattern) → strings stale
Add / delete / move a panel	strings containing that panel	Yes — recompute affected string V/I/P
Change / reselect inverter	MPPT assignments for its strings	Yes — reassign strings → MPPTs
Reassign string → different MPPT	that MPPT's balancing (Σ output ≤ capacity)	Yes — re-check balancing
Edit a string's panel set	that string's V/I/P + cable	Yes — recompute string + reroute cable

Principle: electrical values are derived — treat them like the downstream numbers in the main pipeline. On any upstream change, mark stale and recompute on explicit refresh (or immediately for cheap values), never display stale figures as if current.

13. Deferred / Future Features
Moving strings between MPPTs.
Inverter-compatibility validation.
Full validation & warning system.
Google Solar API (auto roof / irradiance).
Backend, auth, persistence, FlowX CRM integration.
Advanced shortest-path/routing optimization beyond MVP.
Panel rotation (note: the individual-panel rotate control is currently a non-functional button — fix as a separate small task; NOT a dependency for electrical work).