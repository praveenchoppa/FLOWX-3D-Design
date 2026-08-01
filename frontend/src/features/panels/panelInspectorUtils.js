/**
 * panelInspectorUtils.js — User-facing selected panel display (pure, UI only).
 */
import { getPanelById } from "./panelTypes.js";
import { inferPanelOrientation } from "./panelEditorUtils.js";

function panelsForArea(areaId, placedPanels) {
  return (placedPanels ?? []).filter(
    (p) => p.regionId === areaId || p.regionId?.startsWith(`${areaId}::`),
  );
}

function findPlacementAreaForPanel(panel, placementAreas = []) {
  const regionId = panel?.regionId;
  if (!regionId) return null;

  return (placementAreas ?? []).find((area) => {
    if (area.deleted) return false;
    return regionId === area.id || regionId.startsWith(`${area.id}::`);
  }) ?? null;
}

function sortPanelsForIndex(panels) {
  return [...panels].sort((a, b) => {
    const rowA = a.row ?? 0;
    const rowB = b.row ?? 0;
    if (rowA !== rowB) return rowA - rowB;
    const colA = a.col ?? 0;
    const colB = b.col ?? 0;
    if (colA !== colB) return colA - colB;
    const idA = a.slotId ?? a.id ?? "";
    const idB = b.slotId ?? b.id ?? "";
    return idA.localeCompare(idB);
  });
}

/**
 * Build user-facing inspector fields for a selected placed panel.
 *
 * @param {object|null} panel
 * @param {object[]} placementAreas
 * @param {object|null} panelLayout
 * @param {object[]} [panelArrays]
 */
export function buildSelectedPanelDisplayInfo(
  panel,
  placementAreas = [],
  panelLayout = null,
  panelArrays = [],
) {
  if (!panel) return null;

  const area = findPlacementAreaForPanel(panel, placementAreas);
  const mod = getPanelById(panel.panelTypeId);
  const powerW = mod?.powerW ?? mod?.power ?? 0;

  const areaPanels = area
    ? sortPanelsForIndex(panelsForArea(area.id, panelLayout?.placedPanels ?? []))
    : sortPanelsForIndex([panel]);

  const slotId = panel.slotId ?? panel.id;
  const panelIndex = areaPanels.findIndex((p) => (p.slotId ?? p.id) === slotId);
  const panelNumber = panelIndex >= 0 ? panelIndex + 1 : null;

  const array = panelArrays.find(
    (a) => a.regionId === panel.regionId || a.id === panel.regionId,
  );

  const width = panel.width ?? mod?.widthM ?? mod?.width;
  const length = panel.length ?? mod?.heightM ?? mod?.height;

  return {
    placementAreaName:  area?.name ?? "—",
    panelNumber,
    moduleLabel:        mod
      ? `${mod.manufacturer} ${mod.model} ${powerW}W`
      : "—",
    orientation:        inferPanelOrientation(panel),
    dimensionsLabel:    width != null && length != null
      ? `${width.toFixed(2)} × ${length.toFixed(2)} m`
      : "—",
    capacityLabel:      powerW > 0 ? `${(powerW / 1000).toFixed(2)} kW` : "—",
    arrayLabel:         array?.displayName ?? null,
  };
}
