/**
 * Runtime proof script for SearchBar error path.
 * Run: node scripts/debug-search-runtime.mjs
 */
import { chromium } from "playwright";

const URL = "http://localhost:5173/";

async function inspectElement(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { exists: false };

    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      exists: true,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      zIndex: cs.zIndex,
      transform: cs.transform,
      position: cs.position,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      inViewport: rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth,
      text: el.textContent?.trim().slice(0, 120),
    };
  }, selector);
}

async function runSearchScenario(page, logs, query, label) {
  const input = page.locator('input[placeholder*="Search address"]');
  await input.waitFor({ timeout: 15000 });
  await input.fill(query);

  const searchBtn = page.locator('button:has-text("Search")').first();
  await searchBtn.click();

  await page.waitForTimeout(2500);

  console.log(`\n========== SCENARIO ${label} ==========`);
  console.log("\n=== CONSOLE LOGS ===");
  for (const line of logs) console.log(line);

  const debugBanner = await inspectElement(page, '[data-testid="search-debug-banner"]');
  const errorCard = await inspectElement(page, "#search-error-message");

  console.log("\n=== DEBUG BANNER ===");
  console.log(JSON.stringify(debugBanner, null, 2));

  console.log("\n=== ERROR CARD ===");
  console.log(JSON.stringify(errorCard, null, 2));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const logs = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[SearchBar]")) logs.push(text);
  });

  console.log("Navigating to", URL);
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });

  await runSearchScenario(page, logs, "ganinger", "A-normal");

  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.route("**/nominatim.openstreetmap.org/**", (route) => route.abort("failed"));
  logs.length = 0;
  await runSearchScenario(page, logs, "ganinger", "B-blocked-fetch");

  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.unroute("**/nominatim.openstreetmap.org/**");
  await page.route("**/nominatim.openstreetmap.org/**", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "text/plain",
      body: "Access denied. See https://operations.osmfoundation.org/policies/nominatim/",
    });
  });
  logs.length = 0;
  await runSearchScenario(page, logs, "ganinger", "C-403-access-denied");

  await browser.close();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
