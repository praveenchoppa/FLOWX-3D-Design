/**
 * MeasurementOverlay3D.jsx — Phase 1B CAD engineering dimension overlay (3D).
 *
 * Visual-only. All numeric values sourced from measurementUtils (unchanged).
 * When "Show Dimensions" is ON, renders ALL roofs, obstacles, and panel arrays.
 * When OFF, only the object currently being edited is shown.
 */

import { useMemo } from "react";
import { Html } from "@react-three/drei";

import { computeDesignCenter } from "../view3d/roofGeometry3d";
import CadDimensionAnnotation3D from "./CadDimensionAnnotation3D";
import {
  CAD_CATEGORY,
  CAD_DIM_OFFSET_ROOF,
  CAD_LABEL_BG,
  CAD_LABEL_RADIUS,
  buildRoofCadAxesFromCoordinates,
  computePanelArrayFootprintVisual,
  getCadCategoryStyle,
  shouldShowCadObject,
} from "./cadDimensionRenderer";
import {
  computeObstacleDimensions,
  computeRingAxisDimensions,
  formatMeasurement,
} from "./measurementUtils";

const PANEL_DECK_OFFSET_M = 0.14;
const PANEL_THICKNESS_M   = 0.04;
const DECK_SURFACE_EPS    = 0.08;

function roofDeckSurfaceY(section) {
  return Math.max(section?.height ?? 3, 0.15) + DECK_SURFACE_EPS;
}

function obstacleDeckY(obstacle, roofSections) {
  const sec = roofSections.find((s) => s.id === obstacle.roofId);
  return sec ? Math.max(sec.height ?? 3, 0.15) + DECK_SURFACE_EPS : DECK_SURFACE_EPS;
}

function panelArrayDeckY(panels, roofSections) {
  const roofId = panels[0]?.roofId;
  const sec = roofSections.find((s) => s.id === roofId);
  return (sec?.height ?? 3) + PANEL_DECK_OFFSET_M + PANEL_THICKNESS_M / 2 + DECK_SURFACE_EPS;
}

/** Permanent CAD-style height label above an obstacle (not a hover tooltip). */
function ObstacleHeightLabel3D({ obstacle, roofSections, visible }) {
  if (!visible || !obstacle) return null;

  const sec = roofSections.find((s) => s.id === obstacle.roofId);
  const baseY = sec ? Math.max(sec.height ?? 3, 0.15) + 0.02 : DECK_SURFACE_EPS;
  const h = obstacle.height ?? 0;
  const style = getCadCategoryStyle(CAD_CATEGORY.OBSTACLE);
  const labelY = baseY + h + 0.38;

  return (
    <Html
      position={[obstacle.position.x, labelY, obstacle.position.z]}
      center
      distanceFactor={12}
      occlude={false}
      zIndexRange={[100, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          padding:        "5px 10px",
          borderRadius:   `${CAD_LABEL_RADIUS}px`,
          background:     CAD_LABEL_BG,
          border:         `1px solid ${style.border}`,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          color:          style.text,
          fontSize:       "11px",
          fontWeight:     600,
          fontFamily:     "ui-monospace, SFMono-Regular, Menlo, monospace",
          textAlign:      "center",
          lineHeight:     1.35,
          whiteSpace:     "nowrap",
          boxShadow:      "0 2px 10px rgba(0, 0, 0, 0.38)",
        }}
      >
        <div style={{ color: "#F8FAFC", fontSize: "10px", marginBottom: 2 }}>
          {obstacle.type ?? "Obstacle"}
        </div>
        <div>H: {formatMeasurement(h)}</div>
      </div>
    </Html>
  );
}

export default function MeasurementOverlay3D({
  showDimensions      = false,
  measurementStepVisibility = {},
  measureEdit         = {},
  roofSections        = [],
  selectedRoofId      = null,
  centre              = null,
  obstacles           = [],
  selectedObstacleId  = null,
  obstacleLiveScale   = null,
  zoneOuterRing       = null,
  zoneEditorActive    = false,
  zoneBaseY           = 0,
  placedPanels        = [],
  roofSectionsForPanels = [],
}) {
  const allowRoof     = !!measurementStepVisibility.roof;
  const allowObstacle = !!measurementStepVisibility.obstacle;
  const allowZone     = !!measurementStepVisibility.zone;
  const allowPanel    = !!measurementStepVisibility.panel;

  const designCentre = centre ?? computeDesignCenter(roofSections);

  const roofAnnotations = useMemo(() => {
    if (!designCentre) return [];
    return roofSections
      .filter((sec) => sec.coordinates?.length >= 3)
      .map((sec) => {
        const axes = buildRoofCadAxesFromCoordinates(
          sec.coordinates,
          designCentre,
          CAD_DIM_OFFSET_ROOF,
        );
        return {
          id:        sec.id,
          axes,
          y:         roofDeckSurfaceY(sec),
          isEditing: !!measureEdit.roof && sec.id === selectedRoofId,
        };
      })
      .filter((ann) => ann.axes.length > 0);
  }, [roofSections, designCentre, measureEdit.roof, selectedRoofId]);

  const obstacleAnnotations = useMemo(() => (
    obstacles.map((obs) => {
      const isSelected = obs.id === selectedObstacleId;
      const liveScale = isSelected && obstacleLiveScale != null ? obstacleLiveScale : undefined;
      const dims = computeObstacleDimensions(obs, liveScale);
      return {
        id:        obs.id,
        centerX:   obs.position.x,
        centerZ:   obs.position.z,
        y:         obstacleDeckY(obs, roofSections),
        rotationY: obs.rotation ?? 0,
        widthX:    dims.widthX,
        lengthY:   dims.lengthY,
        isEditing: !!measureEdit.obstacle && isSelected,
      };
    })
  ), [obstacles, roofSections, selectedObstacleId, obstacleLiveScale, measureEdit.obstacle]);

  const panelArrayAnnotations = useMemo(() => {
    /** @type {Map<string, object[]>} */
    const byRegion = new Map();
    for (const panel of placedPanels) {
      if (!panel?.regionId || !panel?.center) continue;
      if (!byRegion.has(panel.regionId)) byRegion.set(panel.regionId, []);
      byRegion.get(panel.regionId).push(panel);
    }

    const sections = roofSectionsForPanels.length ? roofSectionsForPanels : roofSections;

    return [...byRegion.entries()].map(([regionId, panels]) => {
      const footprint = computePanelArrayFootprintVisual(panels);
      if (!footprint) return null;
      return {
        id:        regionId,
        ...footprint,
        y: panelArrayDeckY(panels, sections),
      };
    }).filter(Boolean);
  }, [placedPanels, roofSectionsForPanels, roofSections]);

  const zoneAnnotation = useMemo(() => {
    if (!zoneOuterRing?.length || !zoneEditorActive) return null;
    const dims = computeRingAxisDimensions(zoneOuterRing);
    let sx = 0;
    let sz = 0;
    for (const pt of zoneOuterRing) {
      sx += pt[0];
      sz += pt[1] ?? pt[2] ?? 0;
    }
    return {
      id:        "zone-edit",
      centerX:   sx / zoneOuterRing.length,
      centerZ:   sz / zoneOuterRing.length,
      y:         zoneBaseY + DECK_SURFACE_EPS,
      rotationY: 0,
      widthX:    dims.widthX,
      lengthY:   dims.lengthY,
      isEditing: !!measureEdit.zone,
    };
  }, [zoneOuterRing, zoneEditorActive, zoneBaseY, measureEdit.zone]);

  return (
    <>
      {roofAnnotations.map((ann) => (
        allowRoof && shouldShowCadObject(showDimensions, ann.isEditing) ? (
          <CadDimensionAnnotation3D
            key={`roof-${ann.id}`}
            axes={ann.axes}
            y={ann.y}
            category={CAD_CATEGORY.ROOF}
          />
        ) : null
      ))}

      {obstacleAnnotations.map((ann) => (
        allowObstacle && shouldShowCadObject(showDimensions, ann.isEditing) ? (
          <CadDimensionAnnotation3D
            key={`obs-${ann.id}`}
            centerX={ann.centerX}
            centerZ={ann.centerZ}
            y={ann.y}
            rotationY={ann.rotationY}
            widthX={ann.widthX}
            lengthY={ann.lengthY}
            category={CAD_CATEGORY.OBSTACLE}
          />
        ) : null
      ))}

      {obstacles.map((obs) => (
        <ObstacleHeightLabel3D
          key={`obs-h-${obs.id}`}
          obstacle={obs}
          roofSections={roofSections}
          visible={allowObstacle && showDimensions}
        />
      ))}

      {allowPanel && panelArrayAnnotations.map((ann) => (
        showDimensions ? (
          <CadDimensionAnnotation3D
            key={`array-${ann.id}`}
            centerX={ann.centerX}
            centerZ={ann.centerZ}
            y={ann.y}
            rotationY={ann.rotationY}
            widthX={ann.widthX}
            lengthY={ann.lengthY}
            category={CAD_CATEGORY.ARRAY}
          />
        ) : null
      ))}

      {allowZone && zoneAnnotation && shouldShowCadObject(showDimensions, zoneAnnotation.isEditing) && (
        <CadDimensionAnnotation3D
          key="zone-edit"
          centerX={zoneAnnotation.centerX}
          centerZ={zoneAnnotation.centerZ}
          y={zoneAnnotation.y}
          rotationY={zoneAnnotation.rotationY}
          widthX={zoneAnnotation.widthX}
          lengthY={zoneAnnotation.lengthY}
          category={CAD_CATEGORY.ZONE}
        />
      )}
    </>
  );
}
