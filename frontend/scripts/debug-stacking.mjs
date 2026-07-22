/**
 * Stacking context investigation — desktop vs responsive.
 * Run: node scripts/debug-stacking.mjs
 */
import { chromium } from "playwright";

const URL = "http://localhost:5173/";

async function inspectStack(page) {
  return page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: typeof el.className === "string" ? el.className.slice(0, 100) : null,
        position: cs.position,
        zIndex: cs.zIndex,
        opacity: cs.opacity,
        transform: cs.transform,
        isolation: cs.isolation,
        overflow: cs.overflow,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      };
    };

    const error = document.querySelector("#search-error-message");
    const header = document.querySelector("header");
    const searchRoot = document.querySelector('input[placeholder*="Search address"]')?.closest(".relative.w-full");
    const workspaceRow = header?.nextElementSibling;
    const mapColumn = workspaceRow?.querySelector(":scope > div.flex-1");
    const mapViewRoot = document.querySelector(".leaflet-container")?.closest(".rounded-\\[20px\\]");
    const leafletContainer = document.querySelector(".leaflet-container");
    const mapPane = document.querySelector(".leaflet-map-pane");

    let hit = null;
    let tileHit = null;
    if (error) {
      const r = error.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      hit = {
        cx,
        cy,
        top: pick(top),
        isError: top === error || error.contains(top),
      };
      tileHit = pick(document.elementFromPoint(cx, cy + 1));
    }

    const chain = (el) => {
      const out = [];
      let node = el;
      while (node && node !== document.body) {
        out.push(pick(node));
        node = node.parentElement;
      }
      return out;
    };

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      error: pick(error),
      hit,
      tileHit,
      header: pick(header),
      searchRoot: pick(searchRoot),
      workspaceRow: pick(workspaceRow),
      mapColumn: pick(mapColumn),
      mapViewRoot: pick(mapViewRoot),
      leafletContainer: pick(leafletContainer),
      mapPane: pick(mapPane),
      errorAncestorChain: error ? chain(error) : [],
      workspaceRowChain: workspaceRow ? chain(workspaceRow) : [],
    };
  });
}

async function triggerError(page) {
  const input = page.locator('input[placeholder*="Search address"]');
  await input.waitFor({ state: "attached", timeout: 15000 });
  await input.fill("ganinger", { force: true });
  await page.locator('button:has-text("Search")').first().click({ force: true });
  await page.waitForTimeout(2500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport: vp });
    await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
    await triggerError(page);
    const data = await inspectStack(page);
    console.log(`\n========== ${vp.name.toUpperCase()} ${vp.width}x${vp.height} ==========`);
    console.log(JSON.stringify(data, null, 2));
    await page.close();
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
