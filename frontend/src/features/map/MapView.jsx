import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free"; // patches L.Map.prototype.pm
import { MdMyLocation } from "react-icons/md";
import { HiCheckCircle, HiX } from "react-icons/hi";
import { FiInfo, FiEdit2, FiMove, FiTrash2, FiCheck } from "react-icons/fi";
import { reverseGeocode } from "../../services/geocoding";
import { computeArea, computeUsableArea } from "../../utils/roofGeometry";
import MeasurementOverlay2D from "../measurements/MeasurementOverlay2D";

// Vite does not resolve Leaflet's default icon URLs — patch once at module level
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DEFAULT_CENTER = [20.5937, 78.9629]; // India fallback
const DEFAULT_ZOOM   = 5;
const LOCATED_ZOOM   = 19;

const DEFAULT_SETBACK = 0.5;

function hasFiniteCoords(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

const GLASS_BTN =
  "w-9 h-9 rounded-[10px] flex items-center justify-center " +
  "bg-[rgba(16,27,45,0.85)] backdrop-blur-lg " +
  "border border-[#23324A] " +
  "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#162338] hover:border-[#2a3850] " +
  "transition-all duration-150 cursor-pointer";

// ── Internal map helpers (must live inside MapContainer) ──────────────────

function FlyToLocation({ lat, lng, view3D }) {
  const map = useMap();
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!hasFiniteCoords(lat, lng)) {
      pendingRef.current = false;
      return;
    }

    const canFlyNow = () => {
      if (view3D) return false;
      const { x, y } = map.getSize();
      return x > 0 && y > 0;
    };

    const fly = () => {
      map.flyTo([lat, lng], LOCATED_ZOOM, { duration: 1.8 });
      pendingRef.current = false;
    };

    const attempt = () => {
      if (canFlyNow()) fly();
      else pendingRef.current = true;
    };

    attempt();

    const onResize = () => {
      if (pendingRef.current && canFlyNow()) fly();
    };

    map.on("resize", onResize);
    return () => map.off("resize", onResize);
  }, [lat, lng, map, view3D]);

  return null;
}

/**
 * Captures the map ref and tracks position/zoom changes.
 * Uses moveend + zoomend so the readout updates once per movement,
 * not on every animation frame.
 */
function MapInternals({ mapRef, onMove, onZoom }) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onMove(c.lat, c.lng);
    },
    zoomend: () => {
      const c = map.getCenter();
      onMove(c.lat, c.lng);
      onZoom(map.getZoom());
    },
  });

  useEffect(() => {
    mapRef.current = map;
    const c = map.getCenter();
    onMove(c.lat, c.lng);
    onZoom(map.getZoom());
  }, [map, mapRef, onMove, onZoom]);

  return null;
}

// ── Draggable location marker ─────────────────────────────────────────────
//
// Uses a local `stablePos` state so the <Marker> position prop does NOT change
// during drag. Without this, react-leaflet calls marker.setLatLng() on every
// re-render triggered by the drag event, which fights Leaflet's own drag handling
// and causes the marker to stutter or snap back to a stale position.
//
// During drag  : stablePos is frozen → react-leaflet is silent → Leaflet controls
//                the marker natively. location.lat/lng updates live via setLocation
//                so the panel fields and readout follow in real time.
// On dragend   : stablePos syncs to the final position, then reverseGeocode fires
//                once to fill location.address.
// On external  : search / locate / coordinate-paste calls setLocation → useEffect
//                detects !isDragging and updates stablePos → marker moves to match.

function DraggableMarker({ location, setLocation }) {
  const markerRef  = useRef(null);
  const isDragging = useRef(false);

  const [stablePos, setStablePos] = useState(
    hasFiniteCoords(location.lat, location.lng) ? [location.lat, location.lng] : null
  );

  // Sync marker position when location changes from external sources.
  // Skipped during drag — Leaflet already controls the marker.
  useEffect(() => {
    if (isDragging.current || !hasFiniteCoords(location.lat, location.lng)) return;
    setStablePos([location.lat, location.lng]);
  }, [location.lat, location.lng]);

  if (!stablePos) return null;

  return (
    <Marker
      position={stablePos}
      draggable={true}
      ref={markerRef}
      eventHandlers={{
        // Prevent geoman draw/removal modes from reacting to clicks on the
        // location marker. Stopping the underlying DOM event before it bubbles
        // to the map container means neither the draw-vertex handler nor the
        // removal handler ever fires.
        click: (e) => {
          L.DomEvent.stopPropagation(e.originalEvent);
        },
        dragstart: () => {
          isDragging.current = true;
        },
        drag: (e) => {
          const { lat, lng } = e.target.getLatLng();
          // Live update — panel fields and readout follow the marker
          setLocation((prev) => ({ ...prev, lat, lng }));
        },
        dragend: async (e) => {
          isDragging.current = false;
          const { lat, lng } = e.target.getLatLng();
          // Sync stablePos so future external updates get the right baseline
          setStablePos([lat, lng]);
          // One reverse-geocode call on drop
          try {
            const address = await reverseGeocode(lat, lng);
            setLocation({ lat, lng, address });
          } catch {
            setLocation((prev) => ({ ...prev, lat, lng }));
          }
        },
      }}
    />
  );
}

// ── Geoman drawing manager ────────────────────────────────────────────────
// Must live inside <MapContainer> so useMap() resolves.
// Geoman is attached imperatively to the raw Leaflet map instance — no React
// wrapper exists for it (react-leaflet-draw is abandoned on react-leaflet v5).
//
// CRITICAL: geoman's global modes are mutually exclusive. enableGlobalEditMode()
// silently disables draw, enableGlobalRemovalMode() silently disables the others.
// All three must NEVER be called together. The fix is one mode at a time:
//   disable all → enable exactly one → done.
//
// activeTool drives which mode is active:
//   'draw'    → enableDraw('Polygon')
//   'edit'    → enableGlobalEditMode()
//   'delete'  → enableGlobalRemovalMode()
//   'pointer' → all disabled (safe resting state)
//
// Event routing (map-level — geoman re-emits all layer events to the map):
//   pm:create  → push new section into roofSections[]
//   pm:edit    → recompute coordinates / areaM2 / vertexCount / usableAreaM2
//   pm:remove  → filter that section out of roofSections[]

const STYLE_NORMAL   = { color: "#3d72cc", weight: 2, fillColor: "#3d72cc", fillOpacity: 0.12 };
const STYLE_SELECTED = { color: "#4F8CFF", weight: 3, fillColor: "#4F8CFF", fillOpacity: 0.28 };

function GeomanDrawing({
  isManualMode,
  activeTool,
  roofSections,
  setRoofSections,
  selectedRoofId,
  setSelectedRoofId,
  onRoofMeasureEditChange = () => {},
  onRoofEditLiveChange    = () => {},
}) {
  const map        = useMap();
  const counterRef = useRef(0); // monotonic; auto-names "Roof 1", "Roof 2", …
  const layersRef  = useRef(new Map()); // id → L.Polygon — needed for setStyle

  // Mirror activeTool in a ref so polygon click handlers always read the
  // current tool without stale closures. useEffect syncs it after every render.
  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // ── Apply selected tool — one mode at a time ──────────────────────────────
  useEffect(() => {
    if (!map.pm) return;

    // Always clear all modes first — geoman modes are mutually exclusive.
    map.pm.disableDraw();
    map.pm.disableGlobalEditMode();
    map.pm.disableGlobalRemovalMode();

    if (!isManualMode) return; // leaving Manual mode: all off, done

    switch (activeTool) {
      case "draw":
        map.pm.enableDraw("Polygon", {
          snappable: true,
          allowSelfIntersection: false,
          continueDrawing: true, // restart draw automatically after each polygon close
        });
        break;
      case "edit":
        map.pm.enableGlobalEditMode();
        break;
      case "delete":
        map.pm.enableGlobalRemovalMode();
        break;
      // "pointer": all modes disabled — already done above
    }

    return () => {
      if (map.pm) {
        map.pm.disableDraw();
        map.pm.disableGlobalEditMode();
        map.pm.disableGlobalRemovalMode();
      }
    };
  }, [activeTool, isManualMode, map]);

  // ── Apply selected/normal highlight to all tracked layers ─────────────────
  useEffect(() => {
    layersRef.current.forEach((layer, id) => {
      layer.setStyle(id === selectedRoofId ? STYLE_SELECTED : STYLE_NORMAL);
    });
  }, [selectedRoofId]);

  // ── Reconcile map layers with roofSections state ──────────────────────────
  // When a section is deleted via the panel (not geoman's removal tool), it is
  // removed from roofSections[] but the Leaflet layer persists on the map.
  // This effect detects orphaned layers and removes them.
  useEffect(() => {
    if (!map) return;
    const currentIds = new Set(roofSections.map((s) => s.id));
    layersRef.current.forEach((layer, id) => {
      if (!currentIds.has(id)) {
        layer.off("click");
        map.removeLayer(layer);
        layersRef.current.delete(id);
      }
    });
  }, [roofSections, map]);

  // ── Wire geoman map-level events to roofSections[] ────────────────────────
  useEffect(() => {
    if (!map.pm) return;

    const handleCreate = ({ layer }) => {
      counterRef.current += 1;
      const latLngs     = layer.getLatLngs()[0]; // outer ring (open — first ≠ last)
      const id          = layer._leaflet_id;
      const coordinates = latLngs.map((ll) => [ll.lat, ll.lng]);
      const areaM2      = computeArea(latLngs);

      // Track the layer for highlight management
      layersRef.current.set(id, layer);

      // Click-to-select: only fires in Pointer/Done mode.
      layer.on("click", () => {
        if (activeToolRef.current === "pointer") {
          setSelectedRoofId(id);
        }
      });

      setRoofSections((prev) => [
        ...prev,
        {
          id,
          name:         `Roof ${counterRef.current}`,
          coordinates,
          areaM2,
          vertexCount:  latLngs.length,
          // Step 2a — metadata defaults (flagged as 'default' until user edits)
          roofType:     "Flat RCC",
          pitch:        0,
          azimuth:      180,
          height:       3,
          setback:      DEFAULT_SETBACK,
          usableAreaM2: computeUsableArea(coordinates, DEFAULT_SETBACK),
          metadataSource: "default",
        },
      ]);
    };

    // pm:edit fires on the map whenever any layer's vertex drag ends.
    // Geoman re-emits the layer event to the map, so no per-layer binding needed.
    const handleEdit = ({ layer }) => {
      if (!layer) return;
      const latLngs     = layer.getLatLngs()[0];
      const id          = layer._leaflet_id;
      const coordinates = latLngs.map((ll) => [ll.lat, ll.lng]);
      const areaM2      = computeArea(latLngs);
      setRoofSections((prev) =>
        prev.map((sec) =>
          sec.id === id
            ? {
                ...sec,
                coordinates,
                areaM2,
                vertexCount:  latLngs.length,
                // Recompute usable area — boundary changed, setback stays
                usableAreaM2: computeUsableArea(coordinates, sec.setback ?? DEFAULT_SETBACK),
              }
            : sec
        )
      );
    };

    const handleRemove = ({ layer }) => {
      const id = layer._leaflet_id;
      layer.off("click"); // clean up listener before the layer is discarded
      layersRef.current.delete(id);
      setRoofSections((prev) => prev.filter((s) => s.id !== id));
    };

    map.on("pm:create", handleCreate);
    map.on("pm:edit",   handleEdit);
    map.on("pm:remove", handleRemove);

    return () => {
      map.off("pm:create", handleCreate);
      map.off("pm:edit",   handleEdit);
      map.off("pm:remove", handleRemove);
    };
  }, [map, setRoofSections, setSelectedRoofId]);

  // ── Live roof measurement during geoman vertex / layer drag ─────────────
  useEffect(() => {
    if (!map?.pm) return undefined;

    const liveFromLayer = (layer) => {
      if (!layer?.getLatLngs) return null;
      const latLngs = layer.getLatLngs()[0];
      if (!latLngs?.length) return null;
      return latLngs.map((ll) => [ll.lat, ll.lng]);
    };

    const handleMarkerDragStart = ({ layer }) => {
      onRoofMeasureEditChange(true);
      const coordinates = liveFromLayer(layer);
      if (coordinates) onRoofEditLiveChange({ coordinates });
    };
    const handleMarkerDrag = ({ layer }) => {
      const coordinates = liveFromLayer(layer);
      if (coordinates) onRoofEditLiveChange({ coordinates });
    };
    const handleMarkerDragEnd = () => {
      onRoofMeasureEditChange(false);
      onRoofEditLiveChange(null);
    };
    const handleDragStart = ({ layer }) => {
      onRoofMeasureEditChange(true);
      const coordinates = liveFromLayer(layer);
      if (coordinates) onRoofEditLiveChange({ coordinates });
    };
    const handleDrag = ({ layer }) => {
      const coordinates = liveFromLayer(layer);
      if (coordinates) onRoofEditLiveChange({ coordinates });
    };
    const handleDragEnd = () => {
      onRoofMeasureEditChange(false);
      onRoofEditLiveChange(null);
    };

    map.on("pm:markerdragstart", handleMarkerDragStart);
    map.on("pm:markerdrag",      handleMarkerDrag);
    map.on("pm:markerdragend",   handleMarkerDragEnd);
    map.on("pm:dragstart",       handleDragStart);
    map.on("pm:drag",            handleDrag);
    map.on("pm:dragend",         handleDragEnd);

    return () => {
      map.off("pm:markerdragstart", handleMarkerDragStart);
      map.off("pm:markerdrag",      handleMarkerDrag);
      map.off("pm:markerdragend",   handleMarkerDragEnd);
      map.off("pm:dragstart",       handleDragStart);
      map.off("pm:drag",            handleDrag);
      map.off("pm:dragend",         handleDragEnd);
    };
  }, [map, onRoofMeasureEditChange, onRoofEditLiveChange]);

  return null;
}

// ── Project Status card helper ────────────────────────────────────────────

function StatusRow({ label, ok, sub }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? (
        <HiCheckCircle className="text-[#00E38C] mt-0.5 shrink-0" size={14} />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-[#23324A] shrink-0 mt-0.5" />
      )}
      <div className="leading-none">
        <span className="text-[11px] text-[#F8FAFC]">{label}</span>
        {sub && (
          <span className="text-[10px] text-[#94A3B8] ml-1.5">{sub}</span>
        )}
      </div>
    </div>
  );
}

// ── MapView ───────────────────────────────────────────────────────────────

export default function MapView({
  location,
  setLocation,
  roofSections,
  setRoofSections,
  selectedRoofId,
  setSelectedRoofId,
  selectedDetectionMethod,
  // activeTool is now owned by DesignStudio and passed down
  activeTool,
  setActiveTool,
  // currentStep controls which tools are contextually active (decision 8)
  currentStep,
  // panelCollapsed triggers invalidateSize() so the map tiles fill newly freed width
  panelCollapsed,
  // view3D: when switching BACK from 3D to 2D the map was hidden (display:none);
  // invalidateSize() ensures tiles fill the container correctly on un-hide.
  view3D,
  // panelResizeTick: incremented on panel drag-end so Leaflet refills any grey
  // gap created when the flex layout reflows to the new panel width.
  panelResizeTick,
  roofDetected,
  showDimensions = false,
  roofEditLive = null,
  measureEditRoof = false,
  onRoofMeasureEditChange = () => {},
  onRoofEditLiveChange = () => {},
}) {
  const hasLocation = hasFiniteCoords(location.lat, location.lng);
  const mapRef      = useRef(null);

  // ── Resize map after panel slide, 2D↔3D toggle, or panel drag-resize ─────
  // The panel CSS transition takes 200ms; 3D toggle is instant (display:none);
  // panel drag commits on mouseup (no transition delay needed — use short wait).
  useEffect(() => {
    const delay = view3D === false ? 80 : 250;
    const t = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, delay);
    return () => clearTimeout(t);
  }, [panelCollapsed, view3D, panelResizeTick]);

  // ── Step-aware tool activation (PROJECT_CONTEXT decision 8) ──────────────
  // Step 1 → drawing tools shown/enabled only when the user has chosen Manual Draw.
  // Step 2 → drawing tools always available (boundary-management mode).
  // Step 3+ → no drawing tools; all geoman modes disabled.
  const toolsActive =
    currentStep === 2 ||
    (currentStep === 1 && selectedDetectionMethod === "manual");

  const [zoom,      setZoom]      = useState(DEFAULT_ZOOM);
  const [mapCenter, setMapCenter] = useState({ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] });
  const [showHint,  setShowHint]  = useState(true);
  const [isLocating, setIsLocating] = useState(false);

  const handleMove = useCallback((lat, lng) => setMapCenter({ lat, lng }), []);
  const handleZoom = useCallback((z) => setZoom(z), []);

  const roofCreated = roofSections.length > 0;

  // ── Locate button — geolocation → reverse geocode → setLocation ───────────
  const handleLocate = useCallback(async () => {
    if (!navigator.geolocation || isLocating) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const address = await reverseGeocode(lat, lng);
          setLocation({ address, lat, lng });
        } catch {
          setLocation({ address: "", lat, lng });
        } finally {
          setIsLocating(false);
        }
      },
      () => { setIsLocating(false); },
      { timeout: 10000 }
    );
  }, [isLocating, setLocation]);

  return (
    <div className="h-full w-full relative rounded-[20px] overflow-hidden border border-[#23324A]">

      {/* ── Leaflet map ── */}
      <MapContainer
        center={hasLocation ? [location.lat, location.lng] : DEFAULT_CENTER}
        zoom={hasLocation ? LOCATED_ZOOM : DEFAULT_ZOOM}
        zoomControl={false}
        attributionControl={true}
        className="h-full w-full"
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri"
          maxZoom={22}
          maxNativeZoom={19}
        />
        <FlyToLocation
          lat={location.lat}
          lng={location.lng}
          view3D={view3D}
        />
        <MapInternals mapRef={mapRef} onMove={handleMove} onZoom={handleZoom} />
        <DraggableMarker location={location} setLocation={setLocation} />
        <GeomanDrawing
          isManualMode={toolsActive}
          activeTool={activeTool}
          roofSections={roofSections}
          setRoofSections={setRoofSections}
          selectedRoofId={selectedRoofId}
          setSelectedRoofId={setSelectedRoofId}
          onRoofMeasureEditChange={onRoofMeasureEditChange}
          onRoofEditLiveChange={onRoofEditLiveChange}
        />
        {!view3D && (
          <MeasurementOverlay2D
            showDimensions={showDimensions}
            roofSections={roofSections}
            selectedRoofId={selectedRoofId}
            roofEditLive={roofEditLive}
            measureEditRoof={measureEditRoof}
          />
        )}
      </MapContainer>

      {/* ── Project Status card — Step 1 only (onboarding element).
           Hidden on Steps 2+ to clear the top-left for the view toggle. */}
      {currentStep === 1 && (
        <div className="absolute top-4 left-4 z-[1000] w-[210px] px-4 py-3.5 rounded-[14px] bg-[rgba(16,27,45,0.88)] backdrop-blur-xl border border-[#23324A] shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          <p className="text-[9px] font-bold tracking-[0.2em] text-[#94A3B8] uppercase mb-3">
            Project Status
          </p>
          <div className="flex flex-col gap-2.5">
            <StatusRow label="Location Selected"     ok={hasLocation} />
            <StatusRow label="Coordinates Available" ok={hasLocation} />
            <StatusRow
              label="Roof Boundary"
              ok={roofCreated}
              sub={roofCreated ? "Created" : "Not Created"}
            />
          </div>
        </div>
      )}

      {/* ── Onboarding hint — top-center, dismissible ── */}
      {showHint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[320px] px-4 py-3 rounded-[14px] bg-[rgba(16,27,45,0.88)] backdrop-blur-xl border border-[#23324A] shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#4F8CFF]/12 border border-[#4F8CFF]/25 flex items-center justify-center shrink-0 mt-0.5">
            <FiInfo size={13} className="text-[#4F8CFF]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#F8FAFC] text-xs font-medium leading-snug">
              Search a location to get started
            </p>
            <p className="text-[#94A3B8] text-[11px] mt-0.5 leading-snug">
              Then detect or draw the roof boundary.
            </p>
          </div>
          <button
            onClick={() => setShowHint(false)}
            className="shrink-0 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors mt-0.5"
          >
            <HiX size={13} />
          </button>
        </div>
      )}

      {/* ── Drawing toolbar — visible when tools are contextually active ── */}
      {toolsActive && (
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-1 p-2 rounded-[14px] bg-[rgba(16,27,45,0.92)] backdrop-blur-xl border border-[#23324A] shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          <p className="text-[9px] font-bold tracking-[0.15em] text-[#94A3B8] uppercase px-2 pb-1">
            Tools
          </p>
          {[
            { tool: "draw",    label: "Draw",   Icon: FiEdit2  },
            { tool: "edit",    label: "Edit",   Icon: FiMove   },
            { tool: "delete",  label: "Delete", Icon: FiTrash2 },
            { tool: "pointer", label: "Done",   Icon: FiCheck  },
          ].map(({ tool, label, Icon }) => (
            <button
              key={tool}
              onClick={() => setActiveTool(tool)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${
                activeTool === tool
                  ? tool === "delete"
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-[#4F8CFF]/10 border-[#4F8CFF]/30 text-[#4F8CFF]"
                  : "border-transparent text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#162338]"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Draw hint — visible while Draw tool is active ── */}
      {toolsActive && activeTool === "draw" && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 rounded-xl bg-[rgba(16,27,45,0.85)] backdrop-blur-lg border border-[#23324A] whitespace-nowrap shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
          <span className="text-[11px] text-[#F8FAFC]">
            Click points on the roof — double-click or click the first point to finish
          </span>
        </div>
      )}

      {/* ── Custom controls — left mid ── */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className={GLASS_BTN}
          title="Zoom in"
        >
          <span className="text-lg font-light leading-none select-none">+</span>
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className={GLASS_BTN}
          title="Zoom out"
        >
          <span className="text-lg font-light leading-none select-none">−</span>
        </button>
        <div className="w-9 h-px bg-[#23324A] my-0.5" />
        <div
          className={`${GLASS_BTN} cursor-default pointer-events-none font-bold text-[11px] select-none`}
        >
          N
        </div>
        <button
          onClick={handleLocate}
          disabled={isLocating}
          className={`${GLASS_BTN} ${isLocating ? "opacity-60 cursor-not-allowed" : ""}`}
          title="Use my location"
        >
          <MdMyLocation size={16} className={isLocating ? "animate-pulse" : ""} />
        </button>
      </div>

      {/* ── Map readout — bottom-center (live map center + zoom) ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-4 px-4 py-2 rounded-xl bg-[rgba(16,27,45,0.85)] backdrop-blur-lg border border-[#23324A] whitespace-nowrap shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#94A3B8]">Lat / Lng</span>
          <span className="text-[11px] font-mono text-[#F8FAFC]">
            {`${mapCenter.lat.toFixed(4)}° N, ${mapCenter.lng.toFixed(4)}° E`}
          </span>
        </div>
        <div className="w-px h-3 bg-[#23324A]" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#94A3B8]">Zoom Level</span>
          <span className="text-[11px] text-[#F8FAFC]">{zoom.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
