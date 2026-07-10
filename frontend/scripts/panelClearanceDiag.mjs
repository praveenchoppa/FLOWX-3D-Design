/**
 * Synthetic before/after gate — 3×58 m² clean rectangles.
 * Run: npx vite-node scripts/panelClearanceDiag.mjs
 */
import { computePanelLayout } from "../src/features/panels/panelPlacement.js";
import { DEFAULT_PANEL_ID, getPanelById } from "../src/features/panels/panelTypes.js";

const panel = getPanelById(DEFAULT_PANEL_ID);

function rectRing(cx, cz, w, h) {
  const hw = w / 2;
  const hh = h / 2;
  return [
    [cx - hw, cz - hh], [cx + hw, cz - hh],
    [cx + hw, cz + hh], [cx - hw, cz + hh],
  ];
}

const W = 10;
const H = 5.8;
const AREA = W * H;

const placement = {
  installableRegions: [
    { id: "reg-excellent-0", roofId: "roof-1", outerRing: rectRing(-12, 0, W, H), holes: [], areaM2: AREA, azimuth: 180 },
    { id: "reg-excellent-1", roofId: "roof-1", outerRing: rectRing(0, 0, W, H), holes: [], areaM2: AREA, azimuth: 180 },
    { id: "reg-good-2",      roofId: "roof-1", outerRing: rectRing(12, 0, W, H), holes: [], areaM2: AREA, azimuth: 180 },
  ],
  blockedRegions: [],
  summary: { totalInstallableAreaM2: AREA * 3, regionCount: 3 },
};

/** Recorded pre-fix baseline (wrong-axis stepping + corner rotation bug). */
const BEFORE = [
  { regionId: "reg-excellent-0", generated: 14, accepted: 7,  rejected: 7, outsideRegion: 7 },
  { regionId: "reg-excellent-1", generated: 14, accepted: 6,  rejected: 8, outsideRegion: 8 },
  { regionId: "reg-good-2",      generated: 14, accepted: 6,  rejected: 8, outsideRegion: 8 },
];

const layout = computePanelLayout(placement, panel, { placementDiagnostics: false });
const after = placement.installableRegions.map((r) => {
  const accepted = layout.allValidSlots.filter((s) => s.regionId === r.id).length;
  const d = layout.diagnostics?.perRegion?.find((p) => p.regionId === r.id);
  return {
    regionId: r.id,
    generated: d?.candidateGridSlots ?? null,
    accepted,
    rejected: (d?.candidateGridSlots ?? accepted) - accepted,
    outsideRegion: d?.rejectedBecause?.outsideRegion ?? null,
  };
});

// Re-run with diagnostics for reject breakdown
const layoutDiag = computePanelLayout(placement, panel);
const afterDiag = layoutDiag.diagnostics.perRegion.map((r) => ({
  regionId:            r.regionId,
  generated:           r.candidateGridSlots,
  accepted:            r.slotsAccepted,
  rejected:            r.slotsRejected,
  outsideRegion:       r.rejectedBecause.outsideRegion,
  acceptRatePct:       r.acceptRatePct,
}));

console.log("\n=== SYNTHETIC BEFORE/AFTER (3×10×5.8m, azimuth 180°, no obstacles) ===\n");
console.log("BEFORE (pre-fix baseline):");
console.table(BEFORE);
console.log("\nAFTER (current):");
console.table(afterDiag);
console.log("\nTOTAL accepted:", layoutDiag.summary.total, " (gate: 48–54, per region 16–18)");
console.log("Grid steps: col=1.154m (width+gap), row=2.578m (length+interRow)");
