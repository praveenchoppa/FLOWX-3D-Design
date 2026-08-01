/**
 * PlacedPanels.jsx — Realistic PV rendering: shared row mounts + module surfaces.
 * Visualization only — reads engineering props via panelVisualContext.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import PvModuleAssembly from "./PvModuleAssembly.jsx";
import PvModulesInstanced from "./PvModulesInstanced.jsx";
import PvMountRows from "./PvMountRows.jsx";
import { resolvePanelMountVisual } from "./panelMountVisual.js";
import { ROOF_CONTACT_EPS } from "./pvModuleAssets.js";

const PANEL_DECK_OFFSET_M = 0.14;
const INSTANCED_THRESHOLD = 25;

function buildDeckYMap(roofSections) {
  const m = {};
  for (const sec of roofSections) {
    m[sec.id] = (sec.height ?? 3) + PANEL_DECK_OFFSET_M;
  }
  return m;
}

function raycastRoofXZ(clientX, clientY, camera, canvas, deckY) {
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(deckY + ROOF_CONTACT_EPS));
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  return { x: hit.x, z: hit.z };
}

function panelInArrayHighlight(panel, slotId, arrayHighlightRegionId, highlightPanelIdSet) {
  if (highlightPanelIdSet?.size) {
    return highlightPanelIdSet.has(slotId);
  }
  return !!arrayHighlightRegionId && panel.regionId === arrayHighlightRegionId;
}

function PlacedPanelsElectricalPick({
  panels,
  deckYMap,
  panelVisualContext,
  activeArrayPanelIdSet,
  selectedElectricalPanelIds = [],
  stringHighlightPanelIds = [],
  arrayHighlightRegionId,
  arrayHighlightPanelIds = null,
  dimInactiveArrays = false,
  onElectricalSelectPanel = () => {},
}) {
  const regionMap = panelVisualContext?.regionMap;

  const highlightPanelIdSet = useMemo(() => {
    if (!arrayHighlightPanelIds?.length) return null;
    return new Set(arrayHighlightPanelIds);
  }, [arrayHighlightPanelIds]);

  const electricalSelectedSet = useMemo(
    () => new Set(selectedElectricalPanelIds),
    [selectedElectricalPanelIds],
  );

  const stringHighlightSet = useMemo(
    () => (stringHighlightPanelIds?.length ? new Set(stringHighlightPanelIds) : null),
    [stringHighlightPanelIds],
  );

  const hasStringSelection = !!stringHighlightSet?.size;

  const hasArrayHighlight = !hasStringSelection
    && (!!highlightPanelIdSet?.size || !!arrayHighlightRegionId);

  return (
    <>
      <PvMountRows
        panels={panels}
        deckYMap={deckYMap}
        panelVisualContext={panelVisualContext}
      />
      {panels.map((panel) => {
        const slotId = panel.slotId ?? panel.id;
        const deckY = deckYMap[panel.roofId] ?? 3.02;
        const inActiveArray = activeArrayPanelIdSet?.has(slotId) ?? false;
        const inArrayHighlight = !hasStringSelection && panelInArrayHighlight(
          panel,
          slotId,
          arrayHighlightRegionId,
          highlightPanelIdSet,
        );
        const isElectricallySelected = electricalSelectedSet.has(slotId);
        const isStringMember = stringHighlightSet?.has(slotId) ?? false;
        const isStringHighlighted = isStringMember;
        const isDimmed = hasStringSelection
          ? !isStringMember
          : ((dimInactiveArrays && hasArrayHighlight && !inArrayHighlight)
            || (!inActiveArray && !!activeArrayPanelIdSet?.size));

        const mountVisual = resolvePanelMountVisual(
          panel,
          regionMap,
          panelVisualContext?.projectPanelDefaults,
        );

        return (
          <PvModuleAssembly
            key={slotId}
            panel={panel}
            deckY={deckY}
            mountVisual={mountVisual}
            arrayHighlight={inArrayHighlight && !isElectricallySelected && !isStringHighlighted}
            dimmed={isDimmed}
            electricalSelected={isElectricallySelected}
            stringMemberHighlight={isStringHighlighted}
            onClick={inActiveArray
              ? (e) => {
                e.stopPropagation();
                onElectricalSelectPanel(slotId, { additive: e.ctrlKey || e.metaKey });
              }
              : undefined}
          />
        );
      })}
    </>
  );
}

function PlacedPanelsInteractive({
  panels,
  deckYMap,
  panelVisualContext,
  selectedSlotId,
  arrayHighlightRegionId,
  arrayHighlightPanelIds = null,
  dimInactiveArrays = false,
  onSelectPanel,
  enableMoveDrag = false,
  snapSlots = [],
  onMovePanel = () => {},
  onDragActiveChange = () => {},
  nearestSnapSlotFn,
}) {
  const { camera, gl } = useThree();
  const [dragging, setDragging] = useState(false);
  const [dragFromSlotId, setDragFromSlotId] = useState(null);
  const [snapPreview, setSnapPreview] = useState(null);
  const dragPanelRef = useRef(null);
  const snapPreviewRef = useRef(null);

  const regionMap = panelVisualContext?.regionMap;

  const highlightPanelIdSet = useMemo(() => {
    if (!arrayHighlightPanelIds?.length) return null;
    return new Set(arrayHighlightPanelIds);
  }, [arrayHighlightPanelIds]);

  const hasArrayHighlight = !!highlightPanelIdSet?.size || !!arrayHighlightRegionId;

  const selectedPanel = panels.find((p) => (p.slotId ?? p.id) === selectedSlotId);
  const dragDeckY = selectedPanel ? (deckYMap[selectedPanel.roofId] ?? 3.02) : 3.02;

  useEffect(() => {
    snapPreviewRef.current = snapPreview;
  }, [snapPreview]);

  const finishDrag = useCallback(() => {
    const fromId = dragFromSlotId;
    const target = snapPreviewRef.current;
    if (fromId && target?.slotId && target.slotId !== fromId) {
      onMovePanel(fromId, target.slotId);
    }
    setDragging(false);
    setDragFromSlotId(null);
    setSnapPreview(null);
    onDragActiveChange(false);
  }, [dragFromSlotId, onMovePanel, onDragActiveChange]);

  useEffect(() => {
    if (!dragging) return undefined;

    const onPointerMove = (e) => {
      const hit = raycastRoofXZ(e.clientX, e.clientY, camera, gl.domElement, dragDeckY);
      if (!hit || !nearestSnapSlotFn) {
        setSnapPreview(null);
        return;
      }
      const originSlot = dragPanelRef.current
        ? [{
          ...dragPanelRef.current,
          slotId: dragPanelRef.current.slotId ?? dragPanelRef.current.id,
        }]
        : [];
      const snap = nearestSnapSlotFn(hit.x, hit.z, [...snapSlots, ...originSlot]);
      setSnapPreview(snap);
    };

    const onPointerUp = () => finishDrag();

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [
    dragging,
    camera,
    gl.domElement,
    dragDeckY,
    snapSlots,
    finishDrag,
    nearestSnapSlotFn,
  ]);

  const handlePointerDown = useCallback((e, panel) => {
    const slotId = panel.slotId ?? panel.id;
    if (!enableMoveDrag || slotId !== selectedSlotId) return;
    e.stopPropagation();
    dragPanelRef.current = panel;
    setDragging(true);
    setDragFromSlotId(panel.slotId ?? panel.id);
    onDragActiveChange(true);
  }, [enableMoveDrag, selectedSlotId, onDragActiveChange]);

  return (
    <>
      <PvMountRows
        panels={panels}
        deckYMap={deckYMap}
        panelVisualContext={panelVisualContext}
      />
      {panels.map((panel) => {
        const slotId = panel.slotId ?? panel.id;
        const isDraggingThis = dragging && slotId === dragFromSlotId;
        if (isDraggingThis && snapPreview && snapPreview.slotId !== slotId) {
          return null;
        }

        const deckY = deckYMap[panel.roofId] ?? 3.02;
        const isSelected = slotId === selectedSlotId;
        const inArrayHighlight = !isSelected
          && panelInArrayHighlight(panel, slotId, arrayHighlightRegionId, highlightPanelIdSet);
        const isDimmed = dimInactiveArrays
          && hasArrayHighlight
          && !isSelected
          && !inArrayHighlight;

        const displayPanel = (isDraggingThis && snapPreview)
          ? {
            ...panel,
            center: snapPreview.center,
            width: snapPreview.width,
            length: snapPreview.length,
            rotation: snapPreview.rotation,
          }
          : panel;

        const mountVisual = resolvePanelMountVisual(
          displayPanel,
          regionMap,
          panelVisualContext?.projectPanelDefaults,
        );

        return (
          <PvModuleAssembly
            key={slotId}
            panel={displayPanel}
            deckY={deckY}
            mountVisual={mountVisual}
            selected={isSelected}
            dragging={isDraggingThis}
            arrayHighlight={inArrayHighlight}
            dimmed={isDimmed}
            showSelectionRing={isSelected && !dragging}
            onClick={(e) => {
              e.stopPropagation();
              if (!dragging) onSelectPanel(slotId);
            }}
            onPointerDown={(e) => handlePointerDown(e, panel)}
          />
        );
      })}
    </>
  );
}

function PlacedPanelsStatic({
  panels,
  deckYMap,
  panelVisualContext,
  instanced,
  arrayHighlightRegionId = null,
  arrayHighlightPanelIds = null,
  dimInactiveArrays = false,
}) {
  const regionMap = panelVisualContext?.regionMap;

  const highlightPanelIdSet = useMemo(() => {
    if (!arrayHighlightPanelIds?.length) return null;
    return new Set(arrayHighlightPanelIds);
  }, [arrayHighlightPanelIds]);

  const hasArrayHighlight = !!highlightPanelIdSet?.size || !!arrayHighlightRegionId;

  if (instanced && !hasArrayHighlight) {
    return (
      <PvModulesInstanced
        panels={panels}
        deckYMap={deckYMap}
        panelVisualContext={panelVisualContext}
      />
    );
  }

  return (
    <>
      <PvMountRows
        panels={panels}
        deckYMap={deckYMap}
        panelVisualContext={panelVisualContext}
      />
      {panels.map((panel) => {
        const slotId = panel.slotId ?? panel.id;
        const deckY = deckYMap[panel.roofId] ?? 3.02;
        const inArrayHighlight = panelInArrayHighlight(
          panel,
          slotId,
          arrayHighlightRegionId,
          highlightPanelIdSet,
        );
        const isDimmed = dimInactiveArrays && hasArrayHighlight && !inArrayHighlight;
        const mountVisual = resolvePanelMountVisual(
          panel,
          regionMap,
          panelVisualContext?.projectPanelDefaults,
        );
        return (
          <PvModuleAssembly
            key={slotId}
            panel={panel}
            deckY={deckY}
            mountVisual={mountVisual}
            arrayHighlight={inArrayHighlight}
            dimmed={isDimmed}
          />
        );
      })}
    </>
  );
}

export default function PlacedPanels({
  placedPanels           = [],
  roofSections           = [],
  panelVisualContext     = null,
  interactive            = false,
  electricalPanelPicking = false,
  activeArrayPanelIds    = null,
  selectedElectricalPanelIds = [],
  stringHighlightPanelIds = [],
  onElectricalSelectPanel = () => {},
  selectedSlotId         = null,
  arrayHighlightRegionId = null,
  arrayHighlightPanelIds = null,
  dimInactiveArrays      = false,
  onSelectPanel          = () => {},
  enableMoveDrag         = false,
  snapSlots              = [],
  onMovePanel            = () => {},
  onDragActiveChange     = () => {},
  nearestSnapSlotFn      = null,
}) {
  const panels = useMemo(
    () => placedPanels.filter((p) => p?.center && p.width > 0 && p.length > 0),
    [placedPanels],
  );

  const deckYMap = useMemo(() => buildDeckYMap(roofSections), [roofSections]);

  const activeArrayPanelIdSet = useMemo(() => {
    if (!activeArrayPanelIds?.length) return null;
    return new Set(activeArrayPanelIds);
  }, [activeArrayPanelIds]);

  if (!panels.length) return null;

  if (interactive) {
    return (
      <PlacedPanelsInteractive
        panels={panels}
        deckYMap={deckYMap}
        panelVisualContext={panelVisualContext}
        selectedSlotId={selectedSlotId}
        arrayHighlightRegionId={arrayHighlightRegionId}
        arrayHighlightPanelIds={arrayHighlightPanelIds}
        dimInactiveArrays={dimInactiveArrays}
        onSelectPanel={onSelectPanel}
        enableMoveDrag={enableMoveDrag}
        snapSlots={snapSlots}
        onMovePanel={onMovePanel}
        onDragActiveChange={onDragActiveChange}
        nearestSnapSlotFn={nearestSnapSlotFn}
      />
    );
  }

  if (electricalPanelPicking) {
    return (
      <PlacedPanelsElectricalPick
        panels={panels}
        deckYMap={deckYMap}
        panelVisualContext={panelVisualContext}
        activeArrayPanelIdSet={activeArrayPanelIdSet}
        selectedElectricalPanelIds={selectedElectricalPanelIds}
        stringHighlightPanelIds={stringHighlightPanelIds}
        arrayHighlightRegionId={arrayHighlightRegionId}
        arrayHighlightPanelIds={arrayHighlightPanelIds}
        dimInactiveArrays={dimInactiveArrays}
        onElectricalSelectPanel={onElectricalSelectPanel}
      />
    );
  }

  return (
    <PlacedPanelsStatic
      panels={panels}
      deckYMap={deckYMap}
      panelVisualContext={panelVisualContext}
      instanced={panels.length > INSTANCED_THRESHOLD}
      arrayHighlightRegionId={arrayHighlightRegionId}
      arrayHighlightPanelIds={arrayHighlightPanelIds}
      dimInactiveArrays={dimInactiveArrays}
    />
  );
}

export { buildDeckYMap };
