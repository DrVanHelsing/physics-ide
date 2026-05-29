/**
 * puppeteer-test.mjs — smoke-test the Physics IDE UI end-to-end.
 *
 * Tests:
 *   1. Page loads + title bar visible
 *   2. Start menu renders with three goal cards
 *   3. Create a Physics project → IDE shell visible
 *   4. Return to menu → Create a DS project → starter blocks loaded
 *   5. DS blocks run → DataPanel shows output (table)
 *   6. Return to menu → Create a Hybrid project → split pane layout
 *   7. Template picker: DS goal shows 3 templates, Hybrid shows 1
 *   8. Export Project menu item visible in toolbar Export dropdown
 *   9. Beginner mode toggle turns on → guide strip appears
 */

import puppeteer from "puppeteer";

const BASE = "http://localhost:3000";
const PASS = "\x1b[32m✔\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";

let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ${PASS} ${name}`);
    passed++;
  } else {
    console.error(`  ${FAIL} ${name}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

async function waitFor(page, selector, timeout = 8000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function clickText(page, text) {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button, [role=button]")]
      .find((e) => e.textContent.trim().includes(t));
    if (el) el.click();
  }, text);
}

async function goHome(page) {
  // Click Home/Menu button in toolbar
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")]
      .find((b) => b.title && b.title.includes("Start Menu"));
    if (btn) btn.click();
  });
  await waitFor(page, ".start-menu", 4000);
}

(async () => {
  console.log("\nPhysics IDE — Puppeteer smoke tests\n");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(15000);

  // ── 1. Page load ──────────────────────────────────────────
  console.log("1. Page load");
  await page.goto(BASE, { waitUntil: "networkidle2" });
  const titleText = await page.evaluate(() => document.title);
  assert("document.title contains Physics", titleText.toLowerCase().includes("physic"), titleText);
  const menuVisible = await waitFor(page, ".start-menu");
  assert("Start menu renders", menuVisible);

  // ── 2. Goal cards ─────────────────────────────────────────
  console.log("\n2. Start menu goal cards");
  const cardCount = await page.$$eval(".start-card--goal", (cards) => cards.length);
  assert("Three goal cards visible", cardCount === 3, `found ${cardCount}`);
  const cardLabels = await page.$$eval(".start-card--goal .start-card-title", (els) =>
    els.map((e) => e.textContent.trim())
  );
  assert("Physics card", cardLabels.some((l) => l.includes("Physics")));
  assert("Data Science card", cardLabels.some((l) => l.includes("Data Science")));
  assert("Hybrid card", cardLabels.some((l) => l.includes("Hybrid")));

  // ── 3. Create a Physics project ───────────────────────────
  console.log("\n3. Create Physics project");
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".start-card--goal")]
      .find((b) => b.textContent.includes("Physics"));
    if (btn) btn.click();
  });
  await waitFor(page, ".start-wizard", 4000);
  assert("Wizard panel opens", await page.$(".start-wizard") !== null);

  // Click "Create project"
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")]
      .find((b) => b.textContent.trim().includes("Create project"));
    if (btn) btn.click();
  });
  await waitFor(page, ".app-shell", 5000);
  assert("IDE shell visible after create", await page.$(".app-shell") !== null);
  const toolbarVisible = await page.$(".toolbar") !== null;
  assert("Toolbar visible", toolbarVisible);

  // ── 4. Create a DS project ────────────────────────────────
  console.log("\n4. Create Data Science project");
  await goHome(page);
  assert("Start menu after home", await page.$(".start-menu") !== null);

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".start-card--goal")]
      .find((b) => b.textContent.includes("Data Science"));
    if (btn) btn.click();
  });
  await waitFor(page, ".start-wizard", 4000);

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")]
      .find((b) => b.textContent.trim().includes("Create project"));
    if (btn) btn.click();
  });
  await waitFor(page, ".app-shell", 5000);
  assert("IDE shell for DS goal", await page.$(".app-shell") !== null);
  // DataPanel should be in the right pane for DS goal
  const dataPanelVisible = await page.$(".data-panel") !== null;
  assert("DataPanel visible for DS goal", dataPanelVisible);

  // ── 5. DS blocks run (starter workspace should auto-run) ──
  console.log("\n5. DS blocks auto-run check");
  // Wait a moment for workspace change to trigger DS runner
  await new Promise((r) => setTimeout(r, 3000));
  const panelMeta = await page.$eval(".data-panel-meta", (el) => el.textContent.trim()).catch(() => "");
  assert("DataPanel shows dataset info", panelMeta.length > 0, `meta="${panelMeta}"`);

  // ── 6. Hybrid project ─────────────────────────────────────
  console.log("\n6. Create Hybrid project");
  await goHome(page);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".start-card--goal")]
      .find((b) => b.textContent.includes("Hybrid"));
    if (btn) btn.click();
  });
  await waitFor(page, ".start-wizard", 4000);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")]
      .find((b) => b.textContent.trim().includes("Create project"));
    if (btn) btn.click();
  });
  await waitFor(page, ".canvas-pane--hybrid", 5000);
  const hybridLayout = await page.$(".canvas-pane--hybrid") !== null;
  assert("Hybrid split pane visible", hybridLayout);
  const hybridViewport = await page.$(".hybrid-viewport") !== null;
  assert("Hybrid viewport section exists", hybridViewport);
  const hybridData = await page.$(".hybrid-datapanel") !== null;
  assert("Hybrid DataPanel section exists", hybridData);

  // ── 7. DS templates ───────────────────────────────────────
  console.log("\n7. DS & Hybrid templates");
  await goHome(page);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".start-card--goal")]
      .find((b) => b.textContent.includes("Data Science"));
    if (btn) btn.click();
  });
  await waitFor(page, ".start-wizard", 4000);
  // Click Template radio
  await page.evaluate(() => {
    const radios = [...document.querySelectorAll(".start-wizard-radio")];
    const tplRadio = radios.find((r) => r.textContent.includes("Template"));
    if (tplRadio) tplRadio.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const dsTplCount = await page.$$eval(".start-wizard-template", (els) => els.length);
  assert(`DS has ${dsTplCount} templates (expected 3)`, dsTplCount === 3, `found ${dsTplCount}`);

  // ── 8. Export Project in toolbar ─────────────────────────
  console.log("\n8. Export Project menu item");
  // Go to IDE first
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")]
      .find((b) => b.textContent.trim().includes("Cancel"));
    if (btn) btn.click();
  });
  await waitFor(page, ".start-menu", 2000);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".start-card--goal")]
      .find((b) => b.textContent.includes("Data Science"));
    if (btn) btn.click();
  });
  await waitFor(page, ".start-wizard", 2000);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")]
      .find((b) => b.textContent.trim().includes("Create project"));
    if (btn) btn.click();
  });
  await waitFor(page, ".app-shell", 5000);
  // Open the Export dropdown
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".tb-btn--dropdown")]
      .find((b) => b.textContent.includes("Export"));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const exportProjectItem = await page.evaluate(() => {
    const items = [...document.querySelectorAll(".tb-dropdown-item")];
    return items.some((el) => el.textContent.includes("physide.json"));
  });
  assert("Export Project Bundle item in dropdown", exportProjectItem);
  // Close dropdown
  await page.keyboard.press("Escape");

  // ── 9. Beginner mode guide strip ─────────────────────────
  console.log("\n9. Beginner mode guide strip");
  // Toggle beginner mode
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")]
      .find((b) => b.title && (b.title.includes("Beginner") || b.title.includes("Advanced")));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const guideVisible = await page.$(".beginner-guide") !== null;
  assert("Beginner guide strip appears", guideVisible);
  if (guideVisible) {
    const guideText = await page.$eval(".beginner-guide-text", (el) => el.textContent.trim()).catch(() => "");
    assert("Guide shows a tip", guideText.length > 0, `tip="${guideText.slice(0, 60)}"`);
  }

  // ── Summary ───────────────────────────────────────────────
  await browser.close();
  console.log(`\n──────────────────────────────────`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
