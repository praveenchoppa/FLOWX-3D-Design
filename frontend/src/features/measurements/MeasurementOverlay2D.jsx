/**
 * MeasurementOverlay2D.jsx — Phase 1B CAD roof dimensions on the Leaflet map.
 */

import { useEffect, useMemo, useState } from "react";
import { useMap } from "react-leaflet";

import { computeDesignCenter } from "../view3d/roofGeometry3d";
import CadDimensionSvg2D from "./CadDimensionSvg2D";
import { CAD_CATEGORY, CAD_DIM_OFFSET_ROOF, roofCentroidSceneXZ, shouldShowCadObject } from "./cadDimensionRenderer";
import { computeRoofSectionDimensions } from "./measurementUtils";

export default function MeasurementOverlay2D({
  showDimensions  = false,
  roofSections    = [],
  selectedRoofId  = null,
  roofEditLive    = null,
  measureEditRoof = false,
}) {
  const map = useMap();
  const [, setTick] = useState(0);

  const centre = useMemo(
    () => computeDesignCenter(roofSections),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(roofSections.map((s) => s.coordinates))],
  );

  const roofItems = useMemo(() => {
    if (!centre) return [];

    return roofSections
      .filter((sec) => sec.coordinates?.length >= 3)
      .map((sec) => {
        const liveCoords = (
          roofEditLive?.coordinates?.length
          && sec.id === selectedRoofId
        )
          ? roofEditLive.coordinates
          : sec.coordinates;

        const dims = computeRoofSectionDimensions(liveCoords, centre);
        const c = roofCentroidSceneXZ(liveCoords, centre);
        return {
          id:        sec.id,
          centerX:   c.x,
          centerZ:   c.z,
          rotationY: ((sec.azimuth ?? 180) * Math.PI) / 180,
          widthX:    dims.widthX,
          lengthY:   dims.lengthY,
          isEditing: measureEditRoof && sec.id === selectedRoofId,
        };
      });
  }, [roofSections, centre, roofEditLive, selectedRoofId, measureEditRoof]);

  const visibleItems = roofItems.filter((item) =>
    shouldShowCadObject(showDimensions, item.isEditing),
  );

  useEffect(() => {
    if (!visibleItems.length) return undefined;
    const onMove = () => setTick((t) => t + 1);
    map.on("move zoom zoomend moveend resize", onMove);
    return () => {
      map.off("move zoom zoomend moveend resize", onMove);
    };
  }, [map, visibleItems.length]);

  if (!visibleItems.length) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[1001] overflow-visible"
      style={{ width: "100%", height: "100%" }}
    >
      {visibleItems.map((item) => (
        <CadDimensionSvg2D
          key={item.id}
          map={map}
          centre={centre}
          centerX={item.centerX}
          centerZ={item.centerZ}
          rotationY={item.rotationY}
          widthX={item.widthX}
          lengthY={item.lengthY}
          category={CAD_CATEGORY.ROOF}
          dimOffset={CAD_DIM_OFFSET_ROOF}
        />
      ))}
    </svg>
  );
}
