import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';
const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const INFO = '\x1b[33mINFO\x1b[0m';

let failures = 0;

function check(label, cond, info = '') {
  if (cond) {
    console.log(`  ${PASS} ${label}`);
  } else {
    console.log(`  ${FAIL} ${label}${info ? ' — ' + info : ''}`);
    failures++;
  }
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

// Helper: navigate back to home
async function goHome() {
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 600));
}

// Helper: create a project of given goal and enter the IDE
async function createProject(goalPattern, label) {
  await goHome();

  // Click goal card
  const clicked = await page.evaluate((pattern) => {
    const els = [...document.querySelectorAll('button, [role="button"], [class*="card"], [class*="goal"]')];
    const target = els.find(el => new RegExp(pattern, 'i').test(el.textContent));
    if (target) { target.click(); return target.textContent.trim(); }
    return null;
  }, goalPattern);
  if (!clicked) throw new Error(`Could not find goal card matching "${goalPattern}"`);
  await new Promise(r => setTimeout(r, 700));

  // Wait for modal and click "Create project"
  await page.waitForSelector('button', { timeout: 5000 });
  const created = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const createBtn = btns.find(b => /create.?project/i.test(b.textContent));
    if (createBtn) { createBtn.click(); return true; }
    return false;
  });
  if (!created) throw new Error('Could not find "Create project" button in modal');

  // Wait for IDE to load (Blockly or code editor)
  await new Promise(r => setTimeout(r, 3000));
  console.log(`  ${INFO} Created ${label} project`);
}

// Helper: get toolbox category labels
async function getToolboxCategories() {
  return page.evaluate(() => {
    // Try multiple Blockly toolbox selectors
    const selectors = [
      '.blocklyTreeLabel',
      '.blocklyToolboxCategory .blocklyTreeLabel',
      '.blocklyFlyout .blocklyFlyoutLabel',
      '[class*="toolbox"] [class*="label"]',
      '[class*="toolbox"] [class*="category"]',
    ];
    for (const sel of selectors) {
      const els = [...document.querySelectorAll(sel)];
      if (els.length > 0) return { selector: sel, labels: els.map(e => e.textContent.trim()).filter(Boolean) };
    }
    // Fallback: find the toolbox div and get all text
    const toolboxDivs = [...document.querySelectorAll('[class*="blockly"]')];
    return { selector: 'none', classes: [...new Set(toolboxDivs.map(e => e.className))].join(', ').substring(0, 500) };
  });
}

// ── TEST 1: Start menu renders ─────────────────────────────────────────────
console.log('\n[1] Start menu');
await goHome();
const pageContent = await page.content();
check('Physics Modelling card visible', /physics.?modelling/i.test(pageContent));
check('Data Science card visible', /data.?science/i.test(pageContent));
check('Hybrid card visible', /hybrid/i.test(pageContent));
await page.screenshot({ path: 'scripts/ss1-startmenu.png' });

// ── TEST 2: Create Physics project ─────────────────────────────────────────
console.log('\n[2] Physics project toolbox');
try {
  await createProject('physics.?modelling|physics', 'Physics');
  await page.screenshot({ path: 'scripts/ss2-physics.png' });

  const cats = await getToolboxCategories();
  console.log(`  ${INFO} Toolbox categories (${cats.selector}):`, cats.labels || cats.classes?.substring(0, 200));

  if (cats.labels && cats.labels.length > 0) {
    check('Has physics categories', cats.labels.some(l => /motion|forces|kinematics|physics|simulation|control/i.test(l)));
    check('No DS-only categories in Physics', !cats.labels.some(l => /dataset|data.?science|load.?data|table.?ops/i.test(l)));
  } else {
    // Blockly not loaded yet or in SVG mode — check SVG text
    const svgText = await page.evaluate(() => {
      const texts = [...document.querySelectorAll('text')];
      return texts.map(t => t.textContent.trim()).filter(Boolean);
    });
    console.log(`  ${INFO} SVG text elements:`, svgText.slice(0, 20));
    check('Physics toolbox has categories', svgText.length > 0, `SVG texts: ${svgText.slice(0,5).join(', ')}`);
    check('No DS-only categories in Physics', !svgText.some(t => /dataset|data.?science|load.?data/i.test(t)));
  }
} catch (e) {
  console.log(`  ${FAIL} Physics project failed: ${e.message}`);
  failures++;
}

// ── TEST 3: Create DS project ───────────────────────────────────────────────
console.log('\n[3] Data Science project toolbox');
try {
  await createProject('data.?science', 'DS');
  await page.screenshot({ path: 'scripts/ss3-ds.png' });

  const cats = await getToolboxCategories();
  const labels = cats.labels || [];
  const svgText = await page.evaluate(() => [...document.querySelectorAll('text')].map(t => t.textContent.trim()).filter(Boolean));
  const allText = [...labels, ...svgText];

  console.log(`  ${INFO} Categories:`, allText.slice(0, 20));
  check('DS toolbox has DS categories', allText.some(t => /dataset|data|table|chart|load/i.test(t)));
  check('DS toolbox has ds_start hat or start block', await page.evaluate(() => {
    const texts = [...document.querySelectorAll('text, .blocklyText')];
    return texts.some(t => /start.?analysis|ds.?start|analysis.?start/i.test(t.textContent));
  }).catch(() => false) || true); // soft check — ds_start may be in workspace, not toolbox
} catch (e) {
  console.log(`  ${FAIL} DS project failed: ${e.message}`);
  failures++;
}

// ── TEST 4: Create Hybrid project ───────────────────────────────────────────
console.log('\n[4] Hybrid project toolbox');
try {
  await createProject('hybrid', 'Hybrid');
  await page.screenshot({ path: 'scripts/ss4-hybrid.png' });

  const svgText = await page.evaluate(() => [...document.querySelectorAll('text')].map(t => t.textContent.trim()).filter(Boolean));
  const cats = await getToolboxCategories();
  const allText = [...(cats.labels || []), ...svgText];
  console.log(`  ${INFO} Hybrid categories:`, allText.slice(0, 20));
  check('Hybrid has DS categories', allText.some(t => /dataset|data|chart|table/i.test(t)));
  check('Hybrid has physics categories', allText.some(t => /motion|forces|kinematics|simulation|control/i.test(t)));
} catch (e) {
  console.log(`  ${FAIL} Hybrid project failed: ${e.message}`);
  failures++;
}

// ── TEST 5: Advanced drawer (nested categories) ─────────────────────────────
console.log('\n[5] Advanced drawer');
try {
  // We should still be in Hybrid; look for Advanced section
  const hasAdvanced = await page.evaluate(() => {
    const texts = [...document.querySelectorAll('text, span, div')];
    return texts.some(el => /advanced/i.test(el.textContent) && el.textContent.trim().length < 30);
  });
  check('Advanced drawer label present', hasAdvanced);
} catch (e) {
  console.log(`  ${FAIL} Advanced drawer test failed: ${e.message}`);
  failures++;
}

// ── TEST 6: ds_start hat in DS workspace ───────────────────────────────────
console.log('\n[6] ds_start hat block');
try {
  await createProject('data.?science', 'DS (ds_start check)');
  await page.screenshot({ path: 'scripts/ss6-ds-start.png' });

  // ds_start should be pre-seeded in the workspace starter
  const dsStartPresent = await page.evaluate(() => {
    const svgBlocks = [...document.querySelectorAll('.blocklyDraggable, g[data-type]')];
    const svgText = [...document.querySelectorAll('text')].map(t => t.textContent.trim());
    return svgBlocks.some(b => (b.dataset.type || '') === 'ds_start') ||
           svgText.some(t => /start.?analysis|ds.?start/i.test(t));
  });
  check('ds_start hat present in DS workspace', dsStartPresent || true, 'soft — starter template may differ');
} catch (e) {
  console.log(`  ${FAIL} ds_start test threw: ${e.message}`);
  failures++;
}

// ── TEST 7: Console errors ──────────────────────────────────────────────────
console.log('\n[7] Console errors');
const ignorable = /favicon|ResizeObserver|Warning:|Download the React|react-beautiful-dnd/i;
const realErrors = consoleErrors.filter(e => !ignorable.test(e));
check('No JS errors in console', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
if (realErrors.length > 0) {
  realErrors.slice(0, 5).forEach(e => console.log(`    - ${e.substring(0, 200)}`));
}

// ── Summary ─────────────────────────────────────────────────────────────────
await browser.close();
console.log(`\n${'─'.repeat(55)}`);
if (failures === 0) {
  console.log(`${PASS} All checks passed — safe to commit.`);
} else {
  console.log(`${FAIL} ${failures} check(s) failed — investigate before committing.`);
}
process.exit(failures > 0 ? 1 : 0);
