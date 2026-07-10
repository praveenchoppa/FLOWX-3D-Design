/**
 * Irregular-roof placement diagnostic — L/stair-step shapes (~168 m² / 4 regions).
 * Run: npx vite-node scripts/realRoofShapeDiag.mjs
 * Real roof export: DevTools → copy(JSON.stringify(window.__FLOWX_PLACEMENT_READY__))
 *   then: npx vite-node scripts/realRoofShapeDiag.mjs path/to/placement.json
 */
import { readFileSync } from "node:fs";

import { computePanelLayout } from "../src/features/panels/panelPlacement.js";
import { DEFAULT_PANEL_ID, getPanelById } from "../src/features/panels/panelTypes.js";
import { shoelaceAreaM2 } from "../src/features/zones/placementReady.js";

const panel = getPanelById(DEFAULT_PANEL_ID);
const MODULE_M2 = panel.width * panel.height;

/** L-shape: horizontal bar + vertical arm (stair-step friendly). */
function lShapeRing(originU, originV, barU, barV, armU, armV) {
  return [
    [originU, originV],
    [originU + barU, originV],
    [originU + barU, originV + barV],
    [originU + armU, originV + barV],
    [originU + armU, originV + barV + armV],
    [originU, originV + barV + armV],
  ];
}

/** Stair-step notch (two-level L). */
function stairStepRing(originU, originV, w, h, notchU, notchV) {
  return [
    [originU, originV],
    [originU + w, originV],
    [originU + w, originV + notchV],
    [originU + w - notchU, originV + notchV],
    [originU + w - notchU, originV + h],
    [originU, originV + h],
  ];
}

function regionFromRing(id, roofId, ring, azimuth = 180) {
  const areaM2 = shoelaceAreaM2(ring);
  return { id, roofId, outerRing: ring, holes: [], areaM2, azimuth, zoneClass: "good" };
}

/** Synthetic 4-region roof mimicking merged zone polygons (~168 m² total). */
function syntheticRealRoofPlacement() {
  const regions = [
    regionFromRing("reg-good-0", "roof-1", lShapeRing(-14, -6, 10, 3, 4, 5)),
    regionFromRing("reg-good-1", "roof-1", lShapeRing(-2, -6, 9, 3.5, 3.5, 4.5)),
    regionFromRing("reg-excellent-0", "roof-1", stairStepRing(8, -5, 8, 7, 4, 3)),
    regionFromRing("reg-excellent-1", "roof-1", lShapeRing(18, -4, 7, 2.5, 3, 6)),
  ];
  const total = regions.reduce((s, r) => s + r.areaM2, 0);
  return {
    installableRegions: regions,
    blockedRegions: [],
    summary: { totalInstallableAreaM2: total, regionCount: regions.length },
  };
}

function printReport(placement, label) {
  const layout = computePanelLayout(placement, panel);
  const { perRegion, global: g } = layout.diagnostics;

  console.log(`\n=== ${label} ===`);
  console.log(`Total installable: ${placement.summary.totalInstallableAreaM2.toFixed(1)} m²`);
  console.log(`Total panels placed: ${layout.summary.total}\n`);

  console.table(perRegion.map((r) => ({
    regionId:      r.regionId,
    polygonM2:     r.originalAreaM2,
    bboxUxV_m:     `${r.alignedBBoxSpanU_m}x${r.alignedBBoxSpanV_m}`,
    bboxAreaM2:    r.bboxAreaM2,
    polyDivBbox:   r.polygonToBBoxRatio,
    irregular:     r.irregularShape ? "YES" : "no",
    generated:     r.candidateGridSlots,
    accepted:      r.slotsAccepted,
    rejected:      r.slotsRejected,
    acceptPct:     r.acceptRatePct,
    dominant:      r.dominantRejectReason,
    outside:       r.rejectedBecause.outsideRegion,
    hole:          r.rejectedBecause.hole,
    blocked:       r.rejectedBecause.blocked,
    theoretical:   r.theoreticalPanels100Pct,
    coverage:      r.gridCoverage.coverageVerdict,
  })));

  const totalTheoretical = perRegion.reduce((s, r) => s + r.theoreticalPanels100Pct, 0);
  const totalGenerated   = perRegion.reduce((s, r) => s + r.candidateGridSlots, 0);
  const totalAccepted    = perRegion.reduce((s, r) => s + r.slotsAccepted, 0);
  const totalOutside     = perRegion.reduce((s, r) => s + r.rejectedBecause.outsideRegion, 0);
  const avgRatio         = perRegion.reduce((s, r) => s + (r.polygonToBBoxRatio ?? 0), 0) / perRegion.length;

  console.log("\nAggregate:");
  console.log({
    regions:              g.regionCount,
    theoreticalAt100Pct:  totalTheoretical,
    candidatesGenerated:  totalGenerated,
    accepted:             totalAccepted,
    rejectedOutside:      totalOutside,
    avgPolyDivBbox:       +avgRatio.toFixed(3),
    fillEfficiencyPct:    +((totalAccepted * MODULE_M2 / placement.summary.totalInstallableAreaM2) * 100).toFixed(1),
  });

  return { layout, perRegion };
}

const jsonPath = process.argv[2];
if (jsonPath) {
  const raw = JSON.parse(readFileSync(jsonPath, "utf8"));
  printReport(raw, `REAL ROOF EXPORT (${jsonPath})`);
} else {
  printReport(syntheticRealRoofPlacement(), "SYNTHETIC IRREGULAR ROOF (4 L/stair regions, ~168 m²)");
  console.log("\nTip: export live roof with window.__FLOWX_PLACEMENT_READY__ in DevTools on Step 6.");
}
