/**
 * electricalStore.jsx — P1/P2/P3 Electrical Design context + reducer.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import {
  buildArraysFromPlacement,
  mergeElectricalArrays,
  mergePersistedArrayTransforms,
  placementInitFingerprint,
  renameElectricalArray,
  splitElectricalArray,
} from "../models/array.js";
import {
  arrayHasElectricalConfig,
  purgeArrayElectricalConfig,
  ROTATE_CONFIGURED_CONFIRM_MESSAGE,
  UNFREEZE_CONFIGURED_CONFIRM_MESSAGE,
} from "../models/arrayElectricalConfig.js";
import { normalizeRotationDeg, validateArrayRotation } from "../models/arrayRotation.js";
import {
  addPanelsToString,
  createStringFromSelection,
  deleteElectricalString,
  purgeStringsAndSyncArrays,
  removePanelsFromString,
  renameElectricalString,
} from "../models/string.js";
import {
  addInverterFromCatalog,
  changeInverterSpecification,
  selectInverterFromCatalog,
  syncMpptsAfterPlacementRefresh,
} from "../models/inverter.js";
import { mpptsForInverter } from "../models/mppt.js";
import {
  assignStringToMppt as assignStringToMpptPure,
  hasMultiStringMpptAssignments,
  normalizeOneStringPerMppt,
  removeStringFromMppt as removeStringFromMpptPure,
  syncMpptsAfterStringRemoval,
} from "../models/stringAssignment.js";
import { EMPTY_ELECTRICAL_COLLECTIONS } from "../constants/defaults.js";
import {
  DEFAULT_MPPT_ALLOWED_OVERLOAD_PERCENT,
  normalizeMpptAllowedOverload,
} from "../constants/mpptUtilizationConfig.js";
import {
  canPickPanelsInActiveArray,
  filterValidPanelIds,
  isPanelInArray,
} from "../utils/panelSelectionUtils.js";
import { computeAllIntraStringWiring } from "../services/intraStringWiring.js";
import { composeEffectiveWiring } from "../services/effectiveWiring.js";
import {
  createTerminationPoint,
  updateTerminationPointPosition,
} from "../models/terminationPoint.js";

/** @typedef {import("../models/array.js").ElectricalArray} ElectricalArray */

export const ElectricalStoreContext = createContext(null);

const ACTION = /** @type {const} */ ({
  INIT_FROM_PLACEMENT:        "INIT_FROM_PLACEMENT",
  SELECT_ARRAY:               "SELECT_ARRAY",
  RENAME_ARRAY:               "RENAME_ARRAY",
  MERGE_ARRAYS:               "MERGE_ARRAYS",
  SPLIT_ARRAY:                "SPLIT_ARRAY",
  CREATE_STRING:              "CREATE_STRING",
  RENAME_STRING:              "RENAME_STRING",
  DELETE_STRING:              "DELETE_STRING",
  ADD_PANELS_TO_STRING:       "ADD_PANELS_TO_STRING",
  REMOVE_PANELS_FROM_STRING:  "REMOVE_PANELS_FROM_STRING",
  SELECT_INVERTER:            "SELECT_INVERTER",
  SELECT_MPPT:                "SELECT_MPPT",
  SET_INVERTER_FROM_CATALOG:  "SET_INVERTER_FROM_CATALOG",
  ADD_INVERTER_FROM_CATALOG:    "ADD_INVERTER_FROM_CATALOG",
  CHANGE_INVERTER_SPEC:       "CHANGE_INVERTER_SPEC",
  ASSIGN_STRING_TO_MPPT:      "ASSIGN_STRING_TO_MPPT",
  REMOVE_STRING_FROM_MPPT:    "REMOVE_STRING_FROM_MPPT",
  NORMALIZE_MPPT_ASSIGNMENTS: "NORMALIZE_MPPT_ASSIGNMENTS",
  SELECT_STRING:              "SELECT_STRING",
  SELECT_PANEL:               "SELECT_PANEL",
  SELECT_ALL_PANELS_IN_ARRAY: "SELECT_ALL_PANELS_IN_ARRAY",
  CLEAR_PANEL_SELECTION:      "CLEAR_PANEL_SELECTION",
  PRUNE_PANEL_SELECTION:      "PRUNE_PANEL_SELECTION",
  SET_MPPT_ALLOWED_OVERLOAD:    "SET_MPPT_ALLOWED_OVERLOAD",
  SET_ARRAY_ROTATION:         "SET_ARRAY_ROTATION",
  SET_ARRAY_FROZEN:             "SET_ARRAY_FROZEN",
  SET_TERMINATION_POINT:        "SET_TERMINATION_POINT",
  CLEAR_TERMINATION_POINT:      "CLEAR_TERMINATION_POINT",
  SET_TERMINATION_PLACEMENT_MODE: "SET_TERMINATION_PLACEMENT_MODE",
  SELECT_TERMINATION_POINT:     "SELECT_TERMINATION_POINT",
});

function createInitialState() {
  return {
    ...EMPTY_ELECTRICAL_COLLECTIONS,
    selectedArrayIds:           [],
    activeArrayId:              null,
    selectedElectricalPanelIds: [],
    selectedStringId:           null,
    selectedInverterId:           null,
    selectedMpptId:               null,
    initFingerprint:            null,
    mpptAllowedOverloadPercent: DEFAULT_MPPT_ALLOWED_OVERLOAD_PERCENT,
    terminationPoint:           null,
    terminationPlacementMode: false,
    terminationPointSelected: false,
  };
}

function resolveActiveArray(arrays, activeArrayId) {
  if (!activeArrayId) return null;
  return arrays.find((a) => a.id === activeArrayId) ?? null;
}

function clearPanelSelectionState(state) {
  return { ...state, selectedElectricalPanelIds: [] };
}

function clearStringSelectionState(state) {
  return { ...state, selectedStringId: null };
}

function clearElectricalSelectionState(state) {
  return { ...state, selectedInverterId: null, selectedMpptId: null };
}

function clearDesignSelectionState(state) {
  return {
    ...clearPanelSelectionState(clearStringSelectionState(state)),
    selectedArrayIds: [],
    activeArrayId:    null,
  };
}

function setActiveArray(state, arrayId) {
  return {
    ...clearElectricalSelectionState(clearPanelSelectionState(clearStringSelectionState(state))),
    activeArrayId: arrayId,
  };
}

/** @param {ReturnType<typeof createInitialState>} state @param {object} action */
function electricalReducer(state, action) {
  switch (action.type) {
    case ACTION.INIT_FROM_PLACEMENT: {
      const { arrays, fingerprint, persistedInverters = [], persistedMppts = [] } = action.payload;
      const firstId = arrays[0]?.id ?? null;
      const preservedInverters = (state.inverters?.length ? state.inverters : persistedInverters) ?? [];
      const preservedMppts = syncMpptsAfterPlacementRefresh(
        state.mppts?.length ? state.mppts : persistedMppts,
      );
      const preservedInverterId = preservedInverters.some(
        (i) => i.id === state.selectedInverterId,
      )
        ? state.selectedInverterId
        : (preservedInverters[0]?.id ?? null);

      return {
        ...state,
        arrays,
        strings:                    [],
        inverters:                  preservedInverters,
        mppts:                      preservedMppts,
        selectedArrayIds:           firstId ? [firstId] : [],
        activeArrayId:              firstId,
        selectedElectricalPanelIds: [],
        selectedStringId:           null,
        selectedInverterId:         preservedInverterId,
        selectedMpptId:             null,
        initFingerprint:            fingerprint,
      };
    }
    case ACTION.SELECT_ARRAY: {
      const { arrayId, additive } = action.payload;
      if (!arrayId) {
        return clearElectricalSelectionState({
          ...state,
          selectedArrayIds:           [],
          activeArrayId:              null,
          selectedElectricalPanelIds: [],
          selectedStringId:           null,
        });
      }
      if (!additive) {
        const isOnlySelected = state.selectedArrayIds.length === 1
          && state.selectedArrayIds[0] === arrayId;
        if (isOnlySelected) {
          return clearElectricalSelectionState({
            ...state,
            selectedArrayIds:           [],
            activeArrayId:              null,
            selectedElectricalPanelIds: [],
            selectedStringId:           null,
          });
        }
        return setActiveArray(
          { ...state, selectedArrayIds: [arrayId] },
          arrayId,
        );
      }
      const has = state.selectedArrayIds.includes(arrayId);
      return {
        ...clearElectricalSelectionState(clearPanelSelectionState(clearStringSelectionState(state))),
        activeArrayId: null,
        selectedArrayIds: has
          ? state.selectedArrayIds.filter((id) => id !== arrayId)
          : [...state.selectedArrayIds, arrayId],
      };
    }
    case ACTION.RENAME_ARRAY: {
      const { arrayId, displayName } = action.payload;
      return {
        ...state,
        arrays: renameElectricalArray(state.arrays, arrayId, displayName),
      };
    }
    case ACTION.MERGE_ARRAYS: {
      const { arrays, strings, mppts, mergedId } = action.payload;
      return {
        ...state,
        arrays,
        strings,
        mppts,
        selectedArrayIds:           mergedId ? [mergedId] : [],
        activeArrayId:              mergedId,
        selectedElectricalPanelIds: [],
        selectedStringId:           null,
      };
    }
    case ACTION.SPLIT_ARRAY: {
      const { arrays, strings, mppts, newArrayId } = action.payload;
      return {
        ...state,
        arrays,
        strings,
        mppts,
        selectedArrayIds:           newArrayId ? [newArrayId] : [],
        activeArrayId:              newArrayId,
        selectedElectricalPanelIds: [],
        selectedStringId:           null,
      };
    }
    case ACTION.CREATE_STRING: {
      const { arrays, strings, stringId, arrayId } = action.payload;
      return clearElectricalSelectionState({
        ...state,
        arrays,
        strings,
        selectedArrayIds:           arrayId ? [arrayId] : state.selectedArrayIds,
        activeArrayId:              arrayId ?? state.activeArrayId,
        selectedElectricalPanelIds: [],
        selectedStringId:           stringId,
      });
    }
    case ACTION.RENAME_STRING: {
      const { strings } = action.payload;
      return { ...state, strings };
    }
    case ACTION.DELETE_STRING: {
      const { arrays, strings, mppts, arrayId } = action.payload;
      return {
        ...state,
        arrays,
        strings,
        mppts,
        selectedArrayIds:           arrayId ? [arrayId] : state.selectedArrayIds,
        activeArrayId:              arrayId ?? state.activeArrayId,
        selectedElectricalPanelIds: [],
        selectedStringId:           null,
      };
    }
    case ACTION.ADD_PANELS_TO_STRING: {
      const { arrays, strings, stringId, arrayId } = action.payload;
      return {
        ...state,
        arrays,
        strings,
        selectedArrayIds:           arrayId ? [arrayId] : state.selectedArrayIds,
        activeArrayId:              arrayId ?? state.activeArrayId,
        selectedElectricalPanelIds: [],
        selectedStringId:           stringId,
      };
    }
    case ACTION.REMOVE_PANELS_FROM_STRING: {
      const { arrays, strings, mppts, stringId, arrayId, deleted } = action.payload;
      return {
        ...state,
        arrays,
        strings,
        mppts,
        selectedArrayIds:           arrayId ? [arrayId] : state.selectedArrayIds,
        activeArrayId:              arrayId ?? state.activeArrayId,
        selectedElectricalPanelIds: [],
        selectedStringId:           deleted ? null : stringId,
      };
    }
    case ACTION.SELECT_STRING: {
      const { stringId, arrayId } = action.payload;
      if (!stringId) {
        return clearStringSelectionState(state);
      }
      return clearElectricalSelectionState({
        ...clearPanelSelectionState(state),
        selectedStringId: stringId,
        selectedArrayIds: arrayId ? [arrayId] : state.selectedArrayIds,
        activeArrayId:    arrayId ?? state.activeArrayId,
      });
    }
    case ACTION.SELECT_INVERTER: {
      const { inverterId } = action.payload;
      if (!inverterId) {
        return clearElectricalSelectionState(state);
      }
      return {
        ...clearDesignSelectionState(state),
        selectedInverterId: inverterId,
        selectedMpptId:     null,
      };
    }
    case ACTION.SELECT_MPPT: {
      const { mpptId, inverterId } = action.payload;
      if (!mpptId) {
        return { ...state, selectedMpptId: null };
      }
      return {
        ...clearDesignSelectionState(state),
        selectedInverterId: inverterId ?? state.selectedInverterId,
        selectedMpptId:     mpptId,
      };
    }
    case ACTION.SET_INVERTER_FROM_CATALOG: {
      const { inverters, mppts, strings, inverterId } = action.payload;
      return {
        ...clearDesignSelectionState(state),
        inverters,
        mppts,
        strings,
        selectedInverterId: inverterId,
        selectedMpptId:     null,
      };
    }
    case ACTION.ADD_INVERTER_FROM_CATALOG: {
      const { inverters, mppts, inverterId } = action.payload;
      return {
        ...clearDesignSelectionState(state),
        inverters,
        mppts,
        selectedInverterId: inverterId,
        selectedMpptId:     null,
      };
    }
    case ACTION.CHANGE_INVERTER_SPEC: {
      const { inverters, mppts, strings, inverterId } = action.payload;
      return {
        ...clearDesignSelectionState(state),
        inverters,
        mppts,
        strings,
        selectedInverterId: inverterId,
        selectedMpptId:     null,
      };
    }
    case ACTION.ASSIGN_STRING_TO_MPPT: {
      const { arrays, strings, mppts, stringId, mpptId } = action.payload;
      return {
        ...state,
        arrays:           arrays ?? state.arrays,
        strings,
        mppts,
        selectedStringId: stringId,
        selectedMpptId:   mpptId,
      };
    }
    case ACTION.REMOVE_STRING_FROM_MPPT: {
      const { strings, mppts, stringId } = action.payload;
      return {
        ...state,
        strings,
        mppts,
        selectedStringId: stringId,
      };
    }
    case ACTION.NORMALIZE_MPPT_ASSIGNMENTS: {
      const { strings, mppts } = action.payload;
      return { ...state, strings, mppts };
    }
    case ACTION.SELECT_PANEL: {
      const { panelId, additive } = action.payload;
      const activeArray = resolveActiveArray(state.arrays, state.activeArrayId);
      if (!canPickPanelsInActiveArray(state.activeArrayId, state.selectedArrayIds)) {
        return state;
      }
      if (!isPanelInArray(panelId, activeArray)) {
        return state;
      }

      const base = clearElectricalSelectionState(
        state.selectedStringId ? state : clearStringSelectionState(state),
      );

      if (additive) {
        const has = base.selectedElectricalPanelIds.includes(panelId);
        return {
          ...base,
          selectedElectricalPanelIds: has
            ? base.selectedElectricalPanelIds.filter((id) => id !== panelId)
            : [...base.selectedElectricalPanelIds, panelId],
        };
      }

      const isOnlySelected = base.selectedElectricalPanelIds.length === 1
        && base.selectedElectricalPanelIds[0] === panelId;
      if (isOnlySelected) return base;

      return {
        ...base,
        selectedElectricalPanelIds: [panelId],
      };
    }
    case ACTION.SELECT_ALL_PANELS_IN_ARRAY: {
      const activeArray = resolveActiveArray(state.arrays, state.activeArrayId);
      if (!canPickPanelsInActiveArray(state.activeArrayId, state.selectedArrayIds)) {
        return state;
      }
      return clearElectricalSelectionState({
        ...clearStringSelectionState(state),
        selectedElectricalPanelIds: [...(activeArray?.panelIds ?? [])],
      });
    }
    case ACTION.CLEAR_PANEL_SELECTION: {
      if (!state.selectedElectricalPanelIds.length) return state;
      return clearPanelSelectionState(state);
    }
    case ACTION.PRUNE_PANEL_SELECTION: {
      const activeArray = resolveActiveArray(state.arrays, state.activeArrayId);
      const pruned = filterValidPanelIds(state.selectedElectricalPanelIds, activeArray);
      if (pruned.length === state.selectedElectricalPanelIds.length
        && pruned.every((id, i) => id === state.selectedElectricalPanelIds[i])) {
        return state;
      }
      return { ...state, selectedElectricalPanelIds: pruned };
    }
    case ACTION.SET_MPPT_ALLOWED_OVERLOAD: {
      return {
        ...state,
        mpptAllowedOverloadPercent: normalizeMpptAllowedOverload(action.payload),
      };
    }
    case ACTION.SET_ARRAY_ROTATION: {
      const { arrays, strings, mppts, arrayId } = action.payload;
      return {
        ...state,
        arrays,
        strings,
        mppts,
        selectedArrayIds:           arrayId ? [arrayId] : state.selectedArrayIds,
        activeArrayId:              arrayId ?? state.activeArrayId,
        selectedElectricalPanelIds: [],
        selectedStringId:           null,
      };
    }
    case ACTION.SET_ARRAY_FROZEN: {
      const { arrays, strings, mppts, arrayId } = action.payload;
      return {
        ...state,
        arrays,
        strings,
        mppts,
        selectedArrayIds:           arrayId ? [arrayId] : state.selectedArrayIds,
        activeArrayId:              arrayId ?? state.activeArrayId,
      };
    }
    case ACTION.SET_TERMINATION_POINT: {
      const { terminationPoint } = action.payload;
      return {
        ...clearPanelSelectionState(clearStringSelectionState(state)),
        terminationPoint,
        terminationPlacementMode: false,
        terminationPointSelected: true,
        selectedArrayIds:         [],
        activeArrayId:            null,
      };
    }
    case ACTION.CLEAR_TERMINATION_POINT: {
      return {
        ...state,
        terminationPoint:           null,
        terminationPointSelected:   false,
        terminationPlacementMode:   false,
      };
    }
    case ACTION.SET_TERMINATION_PLACEMENT_MODE: {
      const { active } = action.payload;
      return {
        ...clearPanelSelectionState(clearStringSelectionState(state)),
        terminationPlacementMode: active,
        terminationPointSelected: active ? false : state.terminationPointSelected,
        selectedArrayIds:         active ? [] : state.selectedArrayIds,
        activeArrayId:            active ? null : state.activeArrayId,
      };
    }
    case ACTION.SELECT_TERMINATION_POINT: {
      const { selected } = action.payload;
      if (!state.terminationPoint) return state;
      return {
        ...clearPanelSelectionState(clearStringSelectionState(state)),
        terminationPointSelected: selected,
        selectedArrayIds:         selected ? [] : state.selectedArrayIds,
        activeArrayId:            selected ? null : state.activeArrayId,
        selectedStringId:           selected ? null : state.selectedStringId,
      };
    }
    default:
      return state;
  }
}

function collectHighlightPanelIds(arrays, selectedArrayIds) {
  const ids = new Set();
  for (const arrayId of selectedArrayIds) {
    const arr = arrays.find((a) => a.id === arrayId);
    for (const pid of arr?.panelIds ?? []) ids.add(pid);
  }
  return [...ids];
}

export function ElectricalStoreProvider({
  active,
  panelLayout,
  baselinePanelLayout = null,
  placementReady,
  placementAreas = [],
  usePlacementAreaPanelWorkflow = false,
  projectPanelDefaults,
  selectedPanel = null,
  roofSections = [],
  designCentre = null,
  persistedArrays = [],
  persistedInverters = [],
  persistedMppts = [],
  persistedTerminationPoint = null,
  onArraysChange,
  onInvertersChange,
  onTerminationPointChange,
  onRegisterArrayToolHandlers,
  onRegisterTerminationHandlers,
  onSelectionChange,
  onRegisterPanelPickHandlers,
  children,
}) {
  const [state, dispatch] = useReducer(electricalReducer, undefined, createInitialState);
  const electricalActiveRef = useRef(false);

  const fingerprint = useMemo(
    () => placementInitFingerprint({
      panelLayout: baselinePanelLayout ?? panelLayout,
      placementReady,
      placementAreas,
      usePlacementAreaPanelWorkflow,
      projectPanelDefaults,
    }),
    [
      baselinePanelLayout,
      panelLayout,
      placementReady,
      placementAreas,
      usePlacementAreaPanelWorkflow,
      projectPanelDefaults,
    ],
  );

  useEffect(() => {
    if (!active) return;
    if (state.initFingerprint === fingerprint) return;

    const arrays = mergePersistedArrayTransforms(
      buildArraysFromPlacement({
        panelLayout: baselinePanelLayout ?? panelLayout,
        placementReady,
        placementAreas,
        usePlacementAreaPanelWorkflow,
        projectPanelDefaults,
        selectedPanel,
      }),
      persistedArrays,
    );

    dispatch({
      type: ACTION.INIT_FROM_PLACEMENT,
      payload: {
        arrays,
        fingerprint,
        persistedInverters,
        persistedMppts,
      },
    });
  }, [
    active,
    fingerprint,
    state.initFingerprint,
    baselinePanelLayout,
    panelLayout,
    placementReady,
    placementAreas,
    usePlacementAreaPanelWorkflow,
    projectPanelDefaults,
    selectedPanel,
    persistedArrays,
    persistedInverters,
    persistedMppts,
  ]);

  const selectArray = useCallback((arrayId, options = {}) => {
    dispatch({
      type: ACTION.SELECT_ARRAY,
      payload: { arrayId, additive: !!options.additive },
    });
  }, []);

  const renameArray = useCallback((arrayId, displayName) => {
    const trimmed = displayName?.trim();
    if (!trimmed) return;
    dispatch({ type: ACTION.RENAME_ARRAY, payload: { arrayId, displayName: trimmed } });
  }, []);

  const mergeArrays = useCallback((arrayIds, displayName) => {
    const mergeResult = mergeElectricalArrays(state.arrays, arrayIds, displayName);
    if (!mergeResult.ok) return mergeResult;

    const purged = purgeStringsAndSyncArrays(
      mergeResult.arrays,
      state.strings,
      arrayIds,
    );
    const mppts = syncMpptsAfterStringRemoval(purged.strings, state.mppts);

    dispatch({
      type: ACTION.MERGE_ARRAYS,
      payload: {
        arrays:  purged.arrays,
        strings: purged.strings,
        mppts,
        mergedId: mergeResult.merged.id,
      },
    });
    return { ...mergeResult, arrays: purged.arrays, strings: purged.strings, mppts };
  }, [state.arrays, state.strings, state.mppts]);

  const splitArray = useCallback((sourceArrayId, selectedPanelIds, displayName) => {
    const splitResult = splitElectricalArray(
      state.arrays,
      sourceArrayId,
      selectedPanelIds,
      displayName,
    );
    if (!splitResult.ok) return splitResult;

    const purged = purgeStringsAndSyncArrays(
      splitResult.arrays,
      state.strings,
      [sourceArrayId],
    );
    const mppts = syncMpptsAfterStringRemoval(purged.strings, state.mppts);

    dispatch({
      type: ACTION.SPLIT_ARRAY,
      payload: {
        arrays:     purged.arrays,
        strings:    purged.strings,
        mppts,
        newArrayId: splitResult.split.id,
      },
    });
    return { ...splitResult, arrays: purged.arrays, strings: purged.strings, mppts };
  }, [state.arrays, state.strings, state.mppts]);

  const createString = useCallback((arrayId, selectedPanelIds, displayName) => {
    const result = createStringFromSelection(
      state.arrays,
      state.strings,
      arrayId,
      selectedPanelIds,
      panelLayout,
      displayName,
    );
    if (!result.ok) return result;

    const arraysWithFreeze = result.arrays.map((a) => (
      a.id === arrayId ? { ...a, frozen: true } : a
    ));

    dispatch({
      type: ACTION.CREATE_STRING,
      payload: {
        arrays:   arraysWithFreeze,
        strings:  result.strings,
        stringId: result.string.id,
        arrayId,
      },
    });
    return { ...result, arrays: arraysWithFreeze };
  }, [state.arrays, state.strings, panelLayout]);

  const renameString = useCallback((stringId, displayName) => {
    const result = renameElectricalString(state.strings, stringId, displayName);
    if (!result.ok) return result;
    dispatch({ type: ACTION.RENAME_STRING, payload: { strings: result.strings } });
    return result;
  }, [state.strings]);

  const deleteString = useCallback((stringId) => {
    const result = deleteElectricalString(state.arrays, state.strings, stringId);
    if (!result.ok) return result;
    const mppts = syncMpptsAfterStringRemoval(result.strings, state.mppts);
    dispatch({
      type: ACTION.DELETE_STRING,
      payload: {
        arrays:  result.arrays,
        strings: result.strings,
        mppts,
        arrayId: result.arrayId,
      },
    });
    return { ...result, mppts };
  }, [state.arrays, state.strings, state.mppts]);

  const addPanelsToStringAction = useCallback((stringId, panelIds) => {
    const result = addPanelsToString(
      state.arrays,
      state.strings,
      stringId,
      panelIds,
      panelLayout,
    );
    if (!result.ok) return result;
    dispatch({
      type: ACTION.ADD_PANELS_TO_STRING,
      payload: {
        arrays:   result.arrays,
        strings:  result.strings,
        stringId: result.stringId,
        arrayId:  result.arrayId,
      },
    });
    return result;
  }, [state.arrays, state.strings, panelLayout]);

  const removePanelsFromStringAction = useCallback((stringId, panelIds) => {
    const result = removePanelsFromString(
      state.arrays,
      state.strings,
      stringId,
      panelIds,
      panelLayout,
    );
    if (!result.ok) return result;
    const mppts = syncMpptsAfterStringRemoval(result.strings, state.mppts);
    dispatch({
      type: ACTION.REMOVE_PANELS_FROM_STRING,
      payload: {
        arrays:   result.arrays,
        strings:  result.strings,
        mppts,
        stringId: result.stringId,
        arrayId:  result.arrayId,
        deleted:  result.deleted,
      },
    });
    return { ...result, mppts };
  }, [state.arrays, state.strings, state.mppts, panelLayout]);

  const selectString = useCallback((stringId) => {
    if (!stringId) {
      dispatch({ type: ACTION.SELECT_STRING, payload: { stringId: null, arrayId: null } });
      return;
    }
    const str = state.strings.find((s) => s.id === stringId);
    dispatch({
      type: ACTION.SELECT_STRING,
      payload: { stringId, arrayId: str?.arrayId ?? null },
    });
  }, [state.strings]);

  const deselectString = useCallback(() => {
    dispatch({ type: ACTION.SELECT_STRING, payload: { stringId: null, arrayId: null } });
  }, []);

  const selectInverter = useCallback((inverterId) => {
    if (!inverterId) {
      dispatch({ type: ACTION.SELECT_INVERTER, payload: { inverterId: null } });
      return;
    }
    dispatch({ type: ACTION.SELECT_INVERTER, payload: { inverterId } });
  }, []);

  const selectMppt = useCallback((mpptId) => {
    if (!mpptId) {
      dispatch({ type: ACTION.SELECT_MPPT, payload: { mpptId: null, inverterId: null } });
      return;
    }
    const mppt = state.mppts.find((m) => m.id === mpptId);
    dispatch({
      type: ACTION.SELECT_MPPT,
      payload: { mpptId, inverterId: mppt?.inverterId ?? null },
    });
  }, [state.mppts]);

  const setInverterFromCatalog = useCallback((catalogId) => {
    const result = selectInverterFromCatalog(
      catalogId,
      state.inverters,
      state.mppts,
      state.strings,
    );
    if (!result.ok) return result;
    dispatch({
      type: ACTION.SET_INVERTER_FROM_CATALOG,
      payload: {
        inverters:  result.inverters,
        mppts:      result.mppts,
        strings:    result.strings,
        inverterId: result.inverter.id,
      },
    });
    return result;
  }, [state.inverters, state.mppts, state.strings]);

  const addInverterFromCatalogAction = useCallback((catalogId) => {
    const result = addInverterFromCatalog(
      catalogId,
      state.inverters,
      state.mppts,
    );
    if (!result.ok) return result;
    dispatch({
      type: ACTION.ADD_INVERTER_FROM_CATALOG,
      payload: {
        inverters:  result.inverters,
        mppts:      result.mppts,
        inverterId: result.inverter.id,
      },
    });
    return result;
  }, [state.inverters, state.mppts]);

  const changeInverterSpecAction = useCallback((catalogId, inverterId) => {
    const result = changeInverterSpecification(
      catalogId,
      inverterId,
      state.inverters,
      state.mppts,
      state.strings,
    );
    if (!result.ok) return result;
    dispatch({
      type: ACTION.CHANGE_INVERTER_SPEC,
      payload: {
        inverters:  result.inverters,
        mppts:      result.mppts,
        strings:    result.strings,
        inverterId: result.inverter.id,
      },
    });
    return result;
  }, [state.inverters, state.mppts, state.strings]);

  const assignStringToMppt = useCallback((stringId, mpptId) => {
    const result = assignStringToMpptPure(
      state.strings,
      state.mppts,
      stringId,
      mpptId,
      null,
    );
    if (!result.ok) return result;

    const stringRecord = result.strings.find((s) => s.id === result.stringId);
    const arraysWithFreeze = stringRecord
      ? state.arrays.map((a) => (
        a.id === stringRecord.arrayId ? { ...a, frozen: true } : a
      ))
      : state.arrays;

    dispatch({
      type: ACTION.ASSIGN_STRING_TO_MPPT,
      payload: {
        arrays:   arraysWithFreeze,
        strings:  result.strings,
        mppts:    result.mppts,
        stringId: result.stringId,
        mpptId:   result.mpptId,
      },
    });
    return result;
  }, [state.strings, state.mppts, state.arrays]);

  const removeStringFromMppt = useCallback((stringId) => {
    const result = removeStringFromMpptPure(state.strings, state.mppts, stringId);
    if (!result.ok) return result;
    dispatch({
      type: ACTION.REMOVE_STRING_FROM_MPPT,
      payload: {
        strings:  result.strings,
        mppts:    result.mppts,
        stringId: result.stringId,
      },
    });
    return result;
  }, [state.strings, state.mppts]);

  const selectPanel = useCallback((panelId, options = {}) => {
    if (!panelId) return;
    dispatch({
      type: ACTION.SELECT_PANEL,
      payload: { panelId, additive: !!options.additive },
    });
  }, []);

  const selectAllPanelsInActiveArray = useCallback(() => {
    dispatch({ type: ACTION.SELECT_ALL_PANELS_IN_ARRAY });
  }, []);

  const clearPanelSelection = useCallback(() => {
    dispatch({ type: ACTION.CLEAR_PANEL_SELECTION });
  }, []);

  const setMpptAllowedOverload = useCallback((allowedOverloadPercent) => {
    dispatch({
      type: ACTION.SET_MPPT_ALLOWED_OVERLOAD,
      payload: allowedOverloadPercent,
    });
  }, []);

  const baselinePanels = useMemo(
    () => (baselinePanelLayout ?? panelLayout)?.placedPanels ?? [],
    [baselinePanelLayout, panelLayout],
  );

  const rotateArray = useCallback((arrayId, rotationDeg, options = {}) => {
    const array = state.arrays.find((a) => a.id === arrayId);
    if (!array) return { ok: false, reason: "Array could not be found." };
    if (array.frozen) {
      return { ok: false, reason: "Array is frozen. Unfreeze before rotating." };
    }

    const hasConfig = arrayHasElectricalConfig(array, state.strings, state.mppts);
    if (hasConfig && !options.confirmed) {
      return {
        ok:           false,
        needsConfirm: true,
        message:      ROTATE_CONFIGURED_CONFIRM_MESSAGE,
      };
    }

    let arrays = state.arrays;
    let strings = state.strings;
    let mppts = state.mppts;

    if (hasConfig && options.confirmed) {
      const purged = purgeArrayElectricalConfig(arrays, strings, arrayId, mppts);
      arrays = purged.arrays;
      strings = purged.strings;
      mppts = purged.mppts;
    }

    const targetArray = arrays.find((a) => a.id === arrayId) ?? array;
    const validation = validateArrayRotation({
      baselinePanels,
      array: targetArray,
      rotationDeg,
      placementReady,
    });
    if (!validation.ok) return validation;

    const normalized = normalizeRotationDeg(rotationDeg);
    const nextArrays = arrays.map((a) => (
      a.id === arrayId ? { ...a, rotationDeg: normalized } : a
    ));

    dispatch({
      type: ACTION.SET_ARRAY_ROTATION,
      payload: { arrays: nextArrays, strings, mppts, arrayId },
    });

    return { ok: true, rotationDeg: normalized };
  }, [state.arrays, state.strings, state.mppts, baselinePanels, placementReady]);

  const setArrayFrozen = useCallback((arrayId, frozen, options = {}) => {
    const array = state.arrays.find((a) => a.id === arrayId);
    if (!array) return { ok: false, reason: "Array could not be found." };

    if (!frozen) {
      const hasConfig = arrayHasElectricalConfig(array, state.strings, state.mppts);
      if (hasConfig && !options.confirmed) {
        return {
          ok:           false,
          needsConfirm: true,
          message:      UNFREEZE_CONFIGURED_CONFIRM_MESSAGE,
        };
      }

      let arrays = state.arrays;
      let strings = state.strings;
      let mppts = state.mppts;

      if (hasConfig && options.confirmed) {
        const purged = purgeArrayElectricalConfig(arrays, strings, arrayId, mppts);
        arrays = purged.arrays;
        strings = purged.strings;
        mppts = purged.mppts;
      }

      const nextArrays = arrays.map((a) => (
        a.id === arrayId ? { ...a, frozen: false } : a
      ));

      dispatch({
        type: ACTION.SET_ARRAY_FROZEN,
        payload: { arrays: nextArrays, strings, mppts, arrayId },
      });

      return { ok: true, frozen: false };
    }

    const nextArrays = state.arrays.map((a) => (
      a.id === arrayId ? { ...a, frozen: true } : a
    ));

    dispatch({
      type: ACTION.SET_ARRAY_FROZEN,
      payload: {
        arrays:  nextArrays,
        strings: state.strings,
        mppts:   state.mppts,
        arrayId,
      },
    });

    return { ok: true, frozen: true };
  }, [state.arrays, state.strings, state.mppts]);

  const placeTerminationPoint = useCallback((x, z) => {
    if (state.terminationPoint) {
      return { ok: false, reason: "Termination point already placed. Drag to reposition." };
    }
    const next = createTerminationPoint({ x, z });
    dispatch({
      type: ACTION.SET_TERMINATION_POINT,
      payload: { terminationPoint: next },
    });
    return { ok: true, terminationPoint: next };
  }, [state.terminationPoint]);

  const moveTerminationPoint = useCallback((x, z) => {
    if (!state.terminationPoint) return { ok: false, reason: "No termination point." };
    const next = updateTerminationPointPosition(state.terminationPoint, x, z);
    dispatch({
      type: ACTION.SET_TERMINATION_POINT,
      payload: { terminationPoint: next },
    });
    return { ok: true, terminationPoint: next };
  }, [state.terminationPoint]);

  const clearTerminationPoint = useCallback(() => {
    dispatch({ type: ACTION.CLEAR_TERMINATION_POINT });
    return { ok: true };
  }, []);

  const setTerminationPlacementMode = useCallback((active) => {
    if (active && state.terminationPoint) {
      return { ok: false, reason: "Termination point already placed. Drag to reposition." };
    }
    dispatch({
      type: ACTION.SET_TERMINATION_PLACEMENT_MODE,
      payload: { active: !!active },
    });
    return { ok: true };
  }, [state.terminationPoint]);

  const selectTerminationPoint = useCallback((selected = true) => {
    dispatch({
      type: ACTION.SELECT_TERMINATION_POINT,
      payload: { selected: !!selected },
    });
  }, []);

  const selectedArrays = useMemo(
    () => state.arrays.filter((a) => state.selectedArrayIds.includes(a.id)),
    [state.arrays, state.selectedArrayIds],
  );

  const selectedArray = selectedArrays.length === 1 ? selectedArrays[0] : null;

  const activeArray = useMemo(
    () => resolveActiveArray(state.arrays, state.activeArrayId),
    [state.arrays, state.activeArrayId],
  );

  const selectedString = useMemo(
    () => state.strings.find((s) => s.id === state.selectedStringId) ?? null,
    [state.strings, state.selectedStringId],
  );

  const projectInverter = useMemo(
    () => state.inverters[0] ?? null,
    [state.inverters],
  );

  const selectedInverter = useMemo(
    () => state.inverters.find((i) => i.id === state.selectedInverterId) ?? null,
    [state.inverters, state.selectedInverterId],
  );

  const selectedMppt = useMemo(
    () => state.mppts.find((m) => m.id === state.selectedMpptId) ?? null,
    [state.mppts, state.selectedMpptId],
  );

  const inverterMppts = useMemo(() => {
    const inv = selectedInverter ?? projectInverter;
    return inv ? mpptsForInverter(state.mppts, inv) : [];
  }, [state.mppts, selectedInverter, projectInverter]);

  const canPickPanels = useMemo(
    () => canPickPanelsInActiveArray(state.activeArrayId, state.selectedArrayIds),
    [state.activeArrayId, state.selectedArrayIds],
  );

  const highlightPanelIds = useMemo(
    () => collectHighlightPanelIds(state.arrays, state.selectedArrayIds),
    [state.arrays, state.selectedArrayIds],
  );

  const stringHighlightPanelIds = useMemo(
    () => selectedString?.orderedPanelSequence ?? [],
    [selectedString],
  );

  const stringWiring = useMemo(
    () => composeEffectiveWiring({
      strings: state.strings,
      panelLayout,
      roofSections,
      terminationPoint: state.terminationPoint,
      designCentre,
    }),
    [state.strings, panelLayout, roofSections, state.terminationPoint, designCentre],
  );

  useEffect(() => {
    if (!active) {
      electricalActiveRef.current = false;
      return;
    }
    const justActivated = !electricalActiveRef.current;
    electricalActiveRef.current = true;
    if (!justActivated || !persistedTerminationPoint) return;
    dispatch({
      type: ACTION.SET_TERMINATION_POINT,
      payload: { terminationPoint: persistedTerminationPoint },
    });
  }, [active, persistedTerminationPoint]);

  useEffect(() => {
    if (!active) return;
    dispatch({ type: ACTION.PRUNE_PANEL_SELECTION });
  }, [active, state.arrays, state.activeArrayId]);

  useEffect(() => {
    if (!active) return;
    if (!hasMultiStringMpptAssignments(state.mppts)) return;
    const result = normalizeOneStringPerMppt(state.strings, state.mppts);
    if (!result.changed) return;
    dispatch({
      type: ACTION.NORMALIZE_MPPT_ASSIGNMENTS,
      payload: { strings: result.strings, mppts: result.mppts },
    });
  }, [active, state.mppts, state.strings]);

  useEffect(() => {
    if (!active || !onRegisterPanelPickHandlers) return;
    onRegisterPanelPickHandlers({
      selectPanel,
      clearPanelSelection,
    });
    return () => onRegisterPanelPickHandlers(null);
  }, [active, onRegisterPanelPickHandlers, selectPanel, clearPanelSelection]);

  useEffect(() => {
    if (!active || !onArraysChange) return;
    onArraysChange(state.arrays);
  }, [active, onArraysChange, state.arrays]);

  useEffect(() => {
    if (!active || !onInvertersChange) return;
    onInvertersChange({ inverters: state.inverters, mppts: state.mppts });
  }, [active, onInvertersChange, state.inverters, state.mppts]);

  useEffect(() => {
    if (!active || !onTerminationPointChange) return;
    onTerminationPointChange(state.terminationPoint);
  }, [active, onTerminationPointChange, state.terminationPoint]);

  useEffect(() => {
    if (!active || !onRegisterArrayToolHandlers) return;
    onRegisterArrayToolHandlers({
      rotateArray,
      setArrayFrozen,
    });
    return () => onRegisterArrayToolHandlers(null);
  }, [active, onRegisterArrayToolHandlers, rotateArray, setArrayFrozen]);

  useEffect(() => {
    if (!active || !onRegisterTerminationHandlers) return;
    onRegisterTerminationHandlers({
      placeTerminationPoint,
      moveTerminationPoint,
      clearTerminationPoint,
      setTerminationPlacementMode,
      selectTerminationPoint,
    });
    return () => onRegisterTerminationHandlers(null);
  }, [
    active,
    onRegisterTerminationHandlers,
    placeTerminationPoint,
    moveTerminationPoint,
    clearTerminationPoint,
    setTerminationPlacementMode,
    selectTerminationPoint,
  ]);

  useEffect(() => {
    if (!active || !onSelectionChange) return;
    onSelectionChange({
      selectedArrayIds:           state.selectedArrayIds,
      selectedArrayId:            selectedArray?.id ?? null,
      highlightPanelIds,
      activeArrayId:              state.activeArrayId,
      activeArrayPanelIds:        activeArray?.panelIds ?? [],
      selectedElectricalPanelIds: state.selectedElectricalPanelIds,
      selectedStringId:           state.selectedStringId,
      selectedInverterId:         state.selectedInverterId,
      selectedMpptId:             state.selectedMpptId,
      stringHighlightPanelIds,
      stringWiringSegments:       stringWiring.intraSegments,
      homerunWiringSegments:      stringWiring.homerunSegments,
      stringWiringByStringId:     stringWiring.byStringId,
      terminationPoint:           state.terminationPoint,
      terminationPlacementMode:   state.terminationPlacementMode,
      terminationPointSelected:   state.terminationPointSelected,
      canPickPanels,
    });
  }, [
    active,
    onSelectionChange,
    state.selectedArrayIds,
    selectedArray,
    highlightPanelIds,
    state.activeArrayId,
    activeArray,
    state.selectedElectricalPanelIds,
    state.selectedStringId,
    state.selectedInverterId,
    state.selectedMpptId,
    stringHighlightPanelIds,
    stringWiring,
    state.terminationPoint,
    state.terminationPlacementMode,
    state.terminationPointSelected,
    canPickPanels,
  ]);

  const value = useMemo(
    () => ({
      ...state,
      panelLayout,
      selectedArray,
      selectedArrays,
      activeArray,
      selectedString,
      projectInverter,
      selectedInverter,
      selectedMppt,
      inverterMppts,
      canPickPanels,
      highlightPanelIds,
      stringHighlightPanelIds,
      selectArray,
      renameArray,
      mergeArrays,
      splitArray,
      createString,
      renameString,
      deleteString,
      addPanelsToString: addPanelsToStringAction,
      removePanelsFromString: removePanelsFromStringAction,
      selectString,
      deselectString,
      selectInverter,
      selectMppt,
      setInverterFromCatalog,
      addInverterFromCatalog: addInverterFromCatalogAction,
      changeInverterSpecification: changeInverterSpecAction,
      assignStringToMppt,
      removeStringFromMppt,
      selectPanel,
      selectAllPanelsInActiveArray,
      clearPanelSelection,
      setMpptAllowedOverload,
      rotateArray,
      setArrayFrozen,
      placeTerminationPoint,
      moveTerminationPoint,
      clearTerminationPoint,
      setTerminationPlacementMode,
      selectTerminationPoint,
      stringWiring,
      effectiveWiring: stringWiring,
    }),
    [
      state,
      panelLayout,
      selectedArray,
      selectedArrays,
      activeArray,
      selectedString,
      projectInverter,
      selectedInverter,
      selectedMppt,
      inverterMppts,
      canPickPanels,
      highlightPanelIds,
      stringHighlightPanelIds,
      stringWiring,
      selectArray,
      renameArray,
      mergeArrays,
      splitArray,
      createString,
      renameString,
      deleteString,
      addPanelsToStringAction,
      removePanelsFromStringAction,
      selectString,
      deselectString,
      selectInverter,
      selectMppt,
      setInverterFromCatalog,
      addInverterFromCatalogAction,
      changeInverterSpecAction,
      assignStringToMppt,
      removeStringFromMppt,
      selectPanel,
      selectAllPanelsInActiveArray,
      clearPanelSelection,
      setMpptAllowedOverload,
      rotateArray,
      setArrayFrozen,
      placeTerminationPoint,
      moveTerminationPoint,
      clearTerminationPoint,
      setTerminationPlacementMode,
      selectTerminationPoint,
    ],
  );

  return (
    <ElectricalStoreContext.Provider value={value}>
      {children}
    </ElectricalStoreContext.Provider>
  );
}

export function useElectricalStoreContext() {
  const ctx = useContext(ElectricalStoreContext);
  if (!ctx) {
    throw new Error("useElectricalStore must be used within ElectricalStoreProvider");
  }
  return ctx;
}
