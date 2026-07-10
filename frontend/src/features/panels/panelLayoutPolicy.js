/**
 * panelLayoutPolicy.js — Phase 1 professional layout selection (pure).
 *
 * Selects a subset of already-validated allValidSlots[] for default placement.
 * Does NOT generate slots or alter containment — only filters candidates.
 *
 * Phase 1 goals:
 *   • Prefer longest continuous rows (grid phase tie-break lives in panelPlacement.js)
 *   • Remove isolated 1–2 panel islands
 *   • Preserve large connected groups
 *   • Maintain high utilization (start from full valid set, prune islands only)
 */

const MAX_ISLAND_SIZE = 2;

/** @typedef {{ slotId: string, regionId: string, row: number, col: number }} LayoutSlot */

/**
 * Index slots by region for adjacency queries.
 *
 * @param {LayoutSlot[]} slots
 * @returns {Map<string, Map<string, LayoutSlot>>}
 */
function slotsByRegionAndGridKey(slots) {
  /** @type {Map<string, Map<string, LayoutSlot>>} */
  const byRegion = new Map();
  for (const slot of slots) {
    if (!byRegion.has(slot.regionId)) byRegion.set(slot.regionId, new Map());
    byRegion.get(slot.regionId).set(`${slot.row}::${slot.col}`, slot);
  }
  return byRegion;
}

/**
 * 4-connected neighbours within the same region (same row col±1, same col row±1).
 *
 * @param {LayoutSlot} slot
 * @param {Map<string, LayoutSlot>} gridIndex
 * @returns {LayoutSlot[]}
 */
function adjacentSlots(slot, gridIndex) {
  const neighbours = [];
  const keys = [
    `${slot.row}::${slot.col - 1}`,
    `${slot.row}::${slot.col + 1}`,
    `${slot.row - 1}::${slot.col}`,
    `${slot.row + 1}::${slot.col}`,
  ];

  for (const key of keys) {
    const n = gridIndex.get(key);
    if (n) neighbours.push(n);
  }
  return neighbours;
}

/**
 * Connected components among active slots (4-adjacency, per region).
 *
 * @param {LayoutSlot[]} activeSlots
 * @returns {{ components: string[][], bySlotId: Map<string, number> }}
 */
export function findConnectedComponents(activeSlots) {
  const byRegion = slotsByRegionAndGridKey(activeSlots);
  /** @type {string[][]} */
  const components = [];
  /** @type {Map<string, number>} */
  const bySlotId = new Map();
  let compIdx = 0;

  for (const [, gridIndex] of byRegion) {
    const visited = new Set();

    for (const slot of gridIndex.values()) {
      if (visited.has(slot.slotId)) continue;

      /** @type {string[]} */
      const component = [];
      const queue = [slot];

      while (queue.length) {
        const cur = queue.pop();
        if (visited.has(cur.slotId)) continue;
        visited.add(cur.slotId);
        component.push(cur.slotId);

        for (const n of adjacentSlots(cur, gridIndex)) {
          if (!visited.has(n.slotId)) queue.push(n);
        }
      }

      for (const id of component) bySlotId.set(id, compIdx);
      components.push(component);
      compIdx += 1;
    }
  }

  return { components, bySlotId };
}

/**
 * Longest contiguous horizontal run (same region + row, consecutive cols).
 *
 * @param {LayoutSlot[]} activeSlots
 * @returns {number}
 */
export function computeLongestRowLength(activeSlots) {
  /** @type {Map<string, number[]>} */
  const colsByRegionRow = new Map();

  for (const slot of activeSlots) {
    const key = `${slot.regionId}::${slot.row}`;
    if (!colsByRegionRow.has(key)) colsByRegionRow.set(key, []);
    colsByRegionRow.get(key).push(slot.col);
  }

  let longest = 0;

  for (const cols of colsByRegionRow.values()) {
    cols.sort((a, b) => a - b);
    let run = 1;
    let maxRun = 1;
    for (let i = 1; i < cols.length; i++) {
      if (cols[i] === cols[i - 1] + 1) {
        run += 1;
        maxRun = Math.max(maxRun, run);
      } else {
        run = 1;
      }
    }
    longest = Math.max(longest, maxRun);
  }

  return longest;
}

/**
 * Count active slots belonging to components of size ≤ maxSize.
 *
 * @param {LayoutSlot[]} activeSlots
 * @param {number} [maxSize]
 * @returns {number}
 */
export function countIsolatedPanels(activeSlots, maxSize = MAX_ISLAND_SIZE) {
  const { components } = findConnectedComponents(activeSlots);
  return components
    .filter((c) => c.length <= maxSize)
    .reduce((sum, c) => sum + c.length, 0);
}

/**
 * Row segments for one region — maximal contiguous col runs per row index.
 *
 * @param {LayoutSlot[]} regionSlots
 * @returns {{ regionId: string, row: number, cols: number[], length: number }[]}
 */
export function findRowSegments(regionSlots) {
  if (!regionSlots.length) return [];

  const regionId = regionSlots[0].regionId;
  /** @type {Map<number, number[]>} */
  const colsByRow = new Map();

  for (const slot of regionSlots) {
    if (!colsByRow.has(slot.row)) colsByRow.set(slot.row, []);
    colsByRow.get(slot.row).push(slot.col);
  }

  /** @type {{ regionId: string, row: number, cols: number[], length: number }[]} */
  const segments = [];

  for (const [row, cols] of colsByRow) {
    const sorted = [...cols].sort((a, b) => a - b);
    let segStart = 0;
    for (let i = 1; i <= sorted.length; i++) {
      const breakRun = i === sorted.length || sorted[i] !== sorted[i - 1] + 1;
      if (breakRun) {
        const runCols = sorted.slice(segStart, i);
        segments.push({
          regionId,
          row,
          cols: runCols,
          length: runCols.length,
        });
        segStart = i;
      }
    }
  }

  return segments;
}

/**
 * Layout quality metrics for instrumentation.
 *
 * @param {LayoutSlot[]} allValidSlots
 * @param {LayoutSlot[]} activeSlots
 * @param {object} [extra]
 */
export function computeLayoutMetrics(allValidSlots, activeSlots, extra = {}) {
  const validCount = allValidSlots.length;
  const activeCount = activeSlots.length;
  const { components } = findConnectedComponents(activeSlots);
  const islandComponents = components.filter((c) => c.length <= MAX_ISLAND_SIZE);

  const panelsPerArray = {};
  for (const slot of activeSlots) {
    panelsPerArray[slot.regionId] = (panelsPerArray[slot.regionId] ?? 0) + 1;
  }

  const arrayCount = Object.keys(panelsPerArray).length;

  return {
    arrayCount,
    panelsPerArray,
    longestRowLength:     computeLongestRowLength(activeSlots),
    isolatedPanelCount:   countIsolatedPanels(activeSlots),
    utilization:          validCount > 0 ? +(activeCount / validCount).toFixed(4) : 0,
    utilizationPct:       validCount > 0 ? +((activeCount / validCount) * 100).toFixed(1) : 0,
    validSlotCount:       validCount,
    activeSlotCount:      activeCount,
    discardedSlotCount:   validCount - activeCount,
    connectedComponents:  components.length,
    islandComponentCount: islandComponents.length,
    ...extra,
  };
}

/**
 * Phase 1 professional layout: keep all valid slots except 1–2 panel islands.
 *
 * @param {LayoutSlot[]} allValidSlots
 * @returns {{
 *   activeSlotIds: string[],
 *   defaultRemoved: string[],
 *   metrics: object,
 *   decisions: object[],
 * }}
 */
export function selectProfessionalLayoutSlots(allValidSlots) {
  if (!allValidSlots?.length) {
    return {
      activeSlotIds:  [],
      defaultRemoved: [],
      metrics:        computeLayoutMetrics([], []),
      decisions:      [],
    };
  }

  const activeIds = new Set(allValidSlots.map((s) => s.slotId));
  /** @type {object[]} */
  const decisions = [];

  /** @type {Map<string, LayoutSlot[]>} */
  const byRegion = new Map();
  for (const slot of allValidSlots) {
    if (!byRegion.has(slot.regionId)) byRegion.set(slot.regionId, []);
    byRegion.get(slot.regionId).push(slot);
  }

  for (const [regionId, regionSlots] of byRegion) {
    const activeRegionSlots = regionSlots.filter((s) => activeIds.has(s.slotId));
    const { components } = findConnectedComponents(activeRegionSlots);

    for (const component of components) {
      if (component.length <= MAX_ISLAND_SIZE) {
        for (const slotId of component) {
          activeIds.delete(slotId);
        }
        decisions.push({
          type:     "remove_island",
          regionId,
          size:     component.length,
          slotIds:  component,
          reason:   `isolated_${component.length}_panel_component`,
        });
      }
    }
  }

  const activeSlotIds = allValidSlots
    .filter((s) => activeIds.has(s.slotId))
    .map((s) => s.slotId);

  const defaultRemoved = allValidSlots
    .filter((s) => !activeIds.has(s.slotId))
    .map((s) => s.slotId);

  const activeSlots = allValidSlots.filter((s) => activeIds.has(s.slotId));

  const segments = [];
  for (const [, regionSlots] of byRegion) {
    const activeInRegion = regionSlots.filter((s) => activeIds.has(s.slotId));
    segments.push(...findRowSegments(activeInRegion));
  }
  segments.sort((a, b) => b.length - a.length);

  const metrics = computeLayoutMetrics(allValidSlots, activeSlots, {
    longestRowSegment: segments[0]?.length ?? 0,
    rowSegmentCount:   segments.length,
  });

  return {
    activeSlotIds,
    defaultRemoved,
    metrics,
    decisions,
  };
}

/**
 * Compare grid phase candidates — prefer more valid slots, then longer rows.
 *
 * @param {number} acceptedA
 * @param {number} longestRowA
 * @param {number} acceptedB
 * @param {number} longestRowB
 * @returns {boolean} true if A is better than B
 */
export function isBetterGridPhase(acceptedA, longestRowA, acceptedB, longestRowB) {
  if (acceptedA !== acceptedB) return acceptedA > acceptedB;
  return longestRowA > longestRowB;
}
