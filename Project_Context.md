LumenDesignX — Project Context (Master)

Read this file fully before doing anything. It is the single source of truth for the project's vision, the decisions that have been locked, and the questions that are still open. Do not write code from this file. After reading, confirm your understanding. Each workflow step's detailed spec will be given to you separately, one at a time, after its design is finalized.

What this is

LumenDesignX is the 3D solar design module inside FlowX (Lumenor AI Tech's solar EPC platform). It lets a sales engineer produce, inside the customer's Lead record, a complete rooftop solar design — roof boundary, shadow analysis, energy yield, financials, BOQ, and a branded proposal — in under 45 minutes, and that design flows forward into project execution with no re-entry.

It is built to compete with Aurora Solar, HelioScope, OpenSolar (global) and Solar Ladder, Reslink (India). The differentiators vs those tools:

Google Solar API auto roof detection (neither Indian competitor uses it) DISCOM electricity-bill OCR -> exact rupee savings on real consumption Interactive client share link (orbit + shadow slider on the customer's phone) Design -> project handoff (BOQ auto-populates inventory/procurement) WhatsApp-native proposal sharing Zone-gated panel placement (see decisions below) — our own addition; no competitor does it

Full product vision, personas, functional requirements, data model, and metrics live in the PRD (FlowX_LumenDesignX_PRD_v2.0). Treat the PRD as the vision and requirements reference — but where it conflicts with the locked decisions in section 3, the decisions win.

The product workflow (revised)

The PRD describes a 7-step sale-stage flow. After an architecture review with the founder, the workflow was revised into this order:

Location -> Roof -> Obstacles -> Simulation -> Zones -> Panels -> Electrical Design -> Energy -> Financials -> Visualization -> CRM

The key revision: solar simulation runs before panel placement, with a zoning step in between. You cannot place panels well until you know where the shadows fall — so we simulate first, classify the roof into zones, then place panels only in the high-yield zones. The PRD's original order (Panel Config before shadow) is superseded by this. Do not follow the PRD's sequence.

Electrical Design is a workflow step inserted between Panels and Energy (added after the founder requirements call). See locked decision "Electrical Design Architecture" in section 3 and the full spec in ElectricalDesign_TDD.md.

The early "requirement" idea and the BOQ are two different things:

Requirement estimate (early): rough target — how many kW, approx panel count — used to guide the design. BOQ (late): exact quantities (panels, inverter, cables, mounting), computed from the finished placement, then carried into the project. The BOQ is an output of the design, not an input. It cannot come first.

Locked decisions (do not re-open these)

These were decided deliberately. Do not propose alternatives unless explicitly asked.

Map stack is temporary. We currently use Leaflet + OpenStreetMap/Nominatim + Esri satellite tiles as a stand-in. The final product will use the billed Google APIs (Google Maps JS, Geocoding, Places, Solar API). We are on the free stack for now only to avoid billing during development. Do not treat the current map/ geocoding stack as final, and keep the map and geocoding behind clean boundaries so the Google swap later is contained. Drawing library: leaflet-geoman (@geoman-io/leaflet-geoman-free), attached to the raw Leaflet map via useMap(). We are not using react-leaflet-draw — it is abandoned (built for react-leaflet v2) and incompatible with react-leaflet 5. Roof geometry state is an array of section objects, never a single polygon: roofSections: [{ id, name, coordinates, areaM2, vertexCount }]. Single roof today = an array of length 1. Required for future multi-roof support with no refactor. (The PRD's data model uses a single boundaries JSON; our front-end state uses the sections array. Reconcile to the backend later.) Pipeline order: Simulation -> Zoning -> Panel Placement. No place-then-prune. Zoning is auto-by-default with manual override. Zone score blends irradiance (sun access) and orientation/tilt — not shadow alone. Manual zones include semantic types (Maintenance, Future Expansion, Restricted). Area math: Leaflet gives [lat, lng]; turf expects GeoJSON [lng, lat]. Always swap before computing area, or values will be wrong. Panels are opaque over the satellite map. Glassmorphism only on the floating search bar and toolbar — translucent panels over aerial imagery hurt readability. Contextual, mutually-exclusive tools. Each mode/step shows only its own toolbox, and only when that mode is active (e.g. the drawing toolbox appears in Manual Draw, hides in Auto Detect). Only one tool owns the canvas at a time — selecting a tool disables the others; a Pointer/Done resting state disables all canvas modes and is where plain selection-by-click happens. Never show all tools at once; never run two canvas modes simultaneously. Applies to every step (drawing, obstacles, zoning, panel placement), not just Step 1. Premium design system — tokens + shared components, never ad-hoc inline styles. All UI must use ONE shared visual language so the look is consistent and can be changed in one place later. Reuse the existing panel primitives (panelUtils.jsx: PanelShell, PanelHeader, DataRow, KpiCard, SEC_LABEL, DIVIDER) and the shared tokens below; do not hand-code new spacing/fonts/colors per component.

Colors: bg 
#071120, surface 
#101B2D, surface-hover 
#162338, border 
#23324A; primary 
#4F8CFF, success 
#00E38C, warning 
#FFB547; text-primary 
#F8FAFC, text-secondary 
#94A3B8. Accent (blue) used sparingly — for the active/selected state, not everywhere. Type scale: section labels small + uppercase + letter-spaced + text-secondary; values/body in text-primary; clear hierarchy (don't make everything the same size). Spacing: generous, consistent rhythm — use a fixed scale (e.g. 4/8/12/16/24px), even gaps between sections (~24px), comfortable padding; never cramped or clipped. Radius: 20px on cards/panels, full on pills; consistent everywhere. Glass only on floating elements (search bar, toolbars); panels stay opaque (decision 7). Every new feature's UI should feel like it belongs to the same product and flow — prioritize spacing, hierarchy, and consistency, not just wiring the feature.

Electrical Design Architecture (Locked). Electrical Design is a standalone workflow step inserted between Panels and Energy. It CONSUMES the final panel placement as READ-ONLY input. It must never modify: roof geometry, obstacles, simulation, zoning, or panel placement. Instead it derives a SEPARATE electrical model: Placement Area -> Array -> String -> MPPT -> Inverter -> Cable Where each level means:

Array = organizational group of panels (one orientation/tilt per array — MVP rule).
String = panels wired in series; this is where electrical values (V/I/P) live.
MPPT = charge controller; an inverter input channel; usually one string per MPPT.
Inverter = device holding the MPPTs; converts DC->AC; represented as a termination point, NOT rendered as a 3D object.
Cable = DC wiring (logical or routed mode); has a calculated length. Energy and downstream modules may CONSUME electrical output, but the upstream placement pipeline remains IMMUTABLE. The architecture, domain model, roadmap, and open questions for this module are defined in ElectricalDesign_TDD.md (v1.0 + ADDENDUM A), which is the source of truth for the module. UI beautification for this module is handled by the FlowX front-end team; this module builds FUNCTIONAL UI only.

Implementation status (as of 2026-08-01): the Electrical Design module is FEATURE-COMPLETE for the MVP — arrays (rename/split/merge/rotate), strings, MPPTs, MULTIPLE INVERTERS, per-inverter DC/AC + utilization, intra-string + homerun wiring with a user-placed termination point and real cable length. See CURRENT_STATUS.md and ElectricalDesign_TDD.md Addendum A.

Additional locked points established during implementation (details in TDD Addendum A):

MULTIPLE INVERTERS are supported (F6). Each inverter owns its MPPTs; DC/AC ratio and utilization are per-inverter; one shared termination point regardless of inverter count.
The inverter TERMINATION POINT is USER-PLACED on the workspace (so homerun cable length is real, not fabricated). Reposition = delete + re-place for the MVP.
Step-7 ARRAY ROTATION is the one deliberate, narrow exception to "read-only placement": it is a read-side RIGID transform (rotationDeg, absolute-from-baseline) that turns an array's panels around their centroid WITHOUT mutating baseline geometry or changing panel identity. It is NOT layout regeneration. (Currently works but UX imperfect — a flagged future refinement.)
DATA-HONESTY PRINCIPLE (applies module-wide, and is a good principle for the whole product): every displayed number is REAL, honestly-PENDING ("—"), or clearly-labeled-INDICATIVE — NEVER plausible-but-fake. The electrical catalogs (panel STC specs, inverter capacities) are development-grade placeholders today; string V/I show "—" until real panel datasheet specs exist, and MPPT utilization is labeled indicative until the real inverter item-master connects. Do NOT resolve these by estimating values.
Open — NOT yet decided (do not invent answers)

When we reach these, we will decide together. Until then, leave clean placeholders and do not hardcode assumptions.

Zoning acceptance criteria. Zoning is our headline differentiator but has no defined thresholds/behaviour yet beyond a rough 4-band score (Excellent / Good / Average / Avoid). The hard part — turning a shadow/irradiance heatmap into clean polygon zones automatically — is unspecified. Likely path: start grid/cell-based, add polygon contour-tracing later. Not finalized. Requirement-estimate step. Agreed it exists conceptually, but it is not yet a defined wizard step. Placement in the flow is TBD. Google Solar API coverage for Tier-2/3 AP/Telangana addresses is unverified (PRD open question OQ1). Manual polygon must always work as the fallback. PMSY subsidy slabs, DISCOM OCR engine choice, panel-library scope — all open per PRD OQ3/OQ4/OQ5. Electrical Design open questions — see the Open Questions section of ElectricalDesign_TDD.md (output format, string->MPPT "lugs" representation, shortest-path algorithm, electrical formula confirmation, etc.). Do not invent answers for these; they are resolved with the founder / at the relevant phase.

Tech stack

React, Vite, Tailwind CSS, Leaflet, react-leaflet. Drawing: leaflet-geoman. Geometry: turf.js. 3D: React Three Fiber / Three.js (+ drei). Map/geocoding is currently the free Leaflet/OSM/Esri stack (temporary — see decision 3). Future APIs (placeholders only for now): Google Maps/Places/Geocoding, Google Solar, Google Vision, NASA POWER, PVWatts.

Development philosophy

Workflow-first: finalize a step before implementing it. Build step by step. Never build the whole app at once. Reusable components, scalable architecture, real EPC workflows. Analyze existing code before changing it; preserve what works. Avoid overengineering: Aurora-grade workflow thinking, pilot-grade implementation. Large workflow modules require a Technical Design Document (TDD) before implementation. Once a TDD is frozen, implementation drives further documentation updates — not the reverse. (Established with ElectricalDesign_TDD.md.)

How you (the AI) should act: as a senior solar software architect and senior React engineer. Analyze and explain your approach before writing code. Do not modify unrelated files. Do not generate code until asked for a specific step.

How we work

The workflow has 11 steps (section 2). They are listed so you understand the destination — they are not all build orders. We finalize and build one step at a time: we design a step together, then its detailed spec is given to you as a separate document, and only then do you build it. Until a step's spec arrives, treat that step as not-yet-defined.

Working code to preserve (do not rebuild): three-pane layout, Esri satellite tiles, flyTo animation, location marker, Nominatim address/city search, reverse geocoding, browser geolocation.

Documentation structure (each file, one responsibility):

PROJECT_CONTEXT.md — product vision, locked decisions, workflow (stable).
CURRENT_STATUS.md — progress tracker, current implementation phase (living).
ElectricalDesign_TDD.md — Electrical Design architecture, domain model, roadmap, open questions (frozen v1.0; living per its own rule). Do not duplicate content across these; provide all three to Cursor as context.
What to do now

Read this file and the PRD fully. Confirm your understanding of: the product vision, the revised pipeline order, the locked decisions (including the temporary map stack and the Electrical Design architecture), and what is still open. Do not write code yet, and do not start any step until its spec is given to you.