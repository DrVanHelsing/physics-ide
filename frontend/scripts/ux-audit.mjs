/**
 * ux-audit.mjs — UI/UX Quality Audit for Physics IDE
 *
 * Checks:
 *   C.1  Color contrast (WCAG AA: ≥4.5:1 normal, ≥3:1 large/bold)
 *   C.2  Typography & font sizes
 *   C.3  Toolbox category UX (vs MakeCode reference)
 *   C.4  Button/target sizing (WCAG 2.5.5)
 *   C.5  Visual consistency
 *   C.6  Feedback & loading states
 *   C.7  Accessibility (aria labels, keyboard nav)
 *   C.8  MakeCode comparison matrix
 *
 * Usage:
 *   npm run dev   # ensure :3000 is running
 *   node scripts/ux-audit.mjs
 *
 * Output: docs/ux-audit.md  (markdown report with findings)
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = 'http://localhost:3000';
const E2E_DIR = path.join(ROOT, 'e2e');
const REPORT_PATH = path.join(ROOT, 'docs', 'ux-audit.md');
if (!fs.existsSync(E2E_DIR)) fs.mkdirSync(E2E_DIR, { recursive: true });

const C = { pass: '\x1b[32m', fail: '\x1b[31m', warn: '\x1b[33m', dim: '\x1b[90m', reset: '\x1b[0m' };

// ─── Colour maths ─────────────────────────────────────────────────────────────
function parseRgb(cssColor) {
  if (!cssColor) return null;
  const m = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

function relativeLuminance(r, g, b) {
  return [r, g, b].reduce((acc, c, i) => {
    const ch = c / 255;
    const lin = ch <= 0.03928 ? ch / 12.92 : Math.pow((ch + 0.055) / 1.055, 2.4);
    return acc + lin * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function contrastRatio(l1, l2) {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function ratingFor(ratio, isLargeText) {
  const pass = isLargeText ? ratio >= 3 : ratio >= 4.5;
  const passAA = ratio >= 4.5;
  const passAAA = ratio >= 7;
  if (passAAA) return 'AAA';
  if (passAA) return 'AA';
  if (pass) return 'AA-large';
  return 'FAIL';
}

// ─── State ────────────────────────────────────────────────────────────────────
const findings = [];
const screenshots = [];
let auditPass = 0, auditFail = 0, auditWarn = 0;

function record(category, element, detail, status, value = '') {
  findings.push({ category, element, detail, status, value });
  const icon = status === 'PASS' ? `${C.pass}PASS${C.reset}` :
               status === 'FAIL' ? `${C.fail}FAIL${C.reset}` :
               status === 'WARN' ? `${C.warn}WARN${C.reset}` : `${C.dim}INFO${C.reset}`;
  if (status === 'PASS') auditPass++;
  else if (status === 'FAIL') auditFail++;
  else if (status === 'WARN') auditWarn++;
  console.log(`  ${icon} [${category}] ${element}: ${detail}${value ? ' — ' + value : ''}`);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Browser setup ────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

async function screenshot(name) {
  const p = path.join(E2E_DIR, `ux-${name}.png`);
  await page.screenshot({ path: p });
  screenshots.push({ name, path: p });
}

async function goHome() {
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await delay(500);
}

async function createPhysicsProject() {
  await goHome();
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('button.start-card--goal')];
    const c = cards.find(c => /physics.?modelling/i.test(c.textContent));
    if (c) c.click();
  });
  await delay(700);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /create.?project/i.test(b.textContent));
    if (btn) btn.click();
  });
  await delay(3000);
}

async function createDsProject() {
  await goHome();
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('button.start-card--goal')];
    const c = cards.find(c => /data.?science/i.test(c.textContent));
    if (c) c.click();
  });
  await delay(700);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /create.?project/i.test(b.textContent));
    if (btn) btn.click();
  });
  await delay(3000);
}

// ─── C.1: Colour Contrast ─────────────────────────────────────────────────────
console.log('\n═══ C.1: Colour Contrast (WCAG AA) ══════════════════════════════════');

// Helper: measure contrast of an element's text vs background
async function measureContrast(selector, label, isLargeText = false) {
  const result = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const style = getComputedStyle(el);
    const bgEl = (() => {
      let e = el;
      while (e) {
        const bg = getComputedStyle(e).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        e = e.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    })();
    return { color: style.color, bg: bgEl, fontSize: style.fontSize, fontWeight: style.fontWeight };
  }, selector);

  if (!result) {
    record('C.1 Contrast', label, 'element not found', 'INFO', selector);
    return;
  }

  const fg = parseRgb(result.color);
  const bg = parseRgb(result.bg);
  if (!fg || !bg) {
    record('C.1 Contrast', label, 'could not parse colours', 'INFO', `fg:${result.color} bg:${result.bg}`);
    return;
  }

  const lFg = relativeLuminance(fg.r, fg.g, fg.b);
  const lBg = relativeLuminance(bg.r, bg.g, bg.b);
  const ratio = contrastRatio(lFg, lBg);
  const rating = ratingFor(ratio, isLargeText);
  const status = rating === 'FAIL' ? 'FAIL' : rating === 'AA-large' ? 'WARN' : 'PASS';
  record('C.1 Contrast', label, `${ratio.toFixed(2)}:1 (${rating}) — ${result.fontSize} ${result.fontWeight}w`, status);
}

// Start menu contrast
await goHome();
await screenshot('start-menu');
await measureContrast('.start-card-title', 'Goal card title');
await measureContrast('.start-card-desc', 'Goal card description');
await measureContrast('.start-section-label', 'Section label ("Create New")');
await measureContrast('.start-action-btn', 'Sidebar action button');

// IDE contrast
await createPhysicsProject();
await screenshot('ide-physics');
await measureContrast('.tb-btn-label', 'Toolbar button label', true);
await measureContrast('.tb-zoom-label', 'Zoom label', true);
await measureContrast('.blocklyTreeLabel', 'Toolbox category label', true);

// DS project
await createDsProject();
await screenshot('ide-ds');
await measureContrast('.ds-value-num', 'DS value number');
await measureContrast('.ds-value-label', 'DS value label');
await measureContrast('.ds-table th', 'DS table header', true);
await measureContrast('.ds-table td', 'DS table cell');

// ─── C.2: Typography & Font Sizes ────────────────────────────────────────────
console.log('\n═══ C.2: Typography & Font Sizes ════════════════════════════════════');

// MakeCode reference: block labels 14-16px, category labels 14px
const FONT_CHECKS = [
  { selector: '.blocklyTreeLabel', label: 'Toolbox category label', minPx: 13, ref: 'MakeCode uses 14px' },
  { selector: '.tb-btn-label', label: 'Toolbar button label', minPx: 12, ref: 'min 12px' },
  { selector: '.ds-value-num', label: 'DS value number', minPx: 12, ref: 'min 12px' },
  { selector: '.ds-table td', label: 'DS table cell', minPx: 12, ref: 'min 12px' },
  { selector: '.start-card-title', label: 'Goal card title', minPx: 14, ref: 'min 14px' },
  { selector: '.start-wizard-radio-label', label: 'Wizard radio label', minPx: 13, ref: 'min 13px' },
];

await createPhysicsProject();
for (const fc of FONT_CHECKS) {
  const result = await page.evaluate((sel, min) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const size = parseFloat(getComputedStyle(el).fontSize);
    return { size, passes: size >= min };
  }, fc.selector, fc.minPx);

  if (!result) {
    record('C.2 Typography', fc.label, 'element not found', 'INFO', fc.selector);
  } else {
    const status = result.passes ? 'PASS' : result.size >= fc.minPx - 2 ? 'WARN' : 'FAIL';
    record('C.2 Typography', fc.label,
      `${result.size.toFixed(1)}px (min ${fc.minPx}px, ${fc.ref})`, status);
  }
}

// Check Blockly block label size (SVG text element)
await createPhysicsProject();
const blockLabelSize = await page.evaluate(() => {
  const texts = [...document.querySelectorAll('.blocklyText, .blocklyEditableText text')];
  if (!texts.length) return null;
  const sizes = texts.map(t => parseFloat(getComputedStyle(t).fontSize || t.getAttribute('font-size') || '0')).filter(s => s > 0);
  return sizes.length ? Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length) : null;
});
if (blockLabelSize !== null) {
  record('C.2 Typography', 'Block label font-size (SVG)',
    `${blockLabelSize}px (MakeCode uses 14-16px)`,
    blockLabelSize >= 12 ? 'PASS' : blockLabelSize >= 11 ? 'WARN' : 'FAIL');
} else {
  record('C.2 Typography', 'Block label font-size', 'could not measure SVG text', 'INFO');
}

// ─── C.3: Toolbox Category UX ────────────────────────────────────────────────
console.log('\n═══ C.3: Toolbox Category UX ════════════════════════════════════════');

await createPhysicsProject();
await screenshot('toolbox-physics');

const toolboxAudit = await page.evaluate(() => {
  const categories = [...document.querySelectorAll('.blocklyTreeRow')];
  const results = categories.map(row => {
    const label = row.querySelector('.blocklyTreeLabel')?.textContent?.trim() || '?';
    const style = getComputedStyle(row);
    const hasColorIndicator = row.querySelector('[style*="background"], [class*="color"]') !== null ||
      style.borderLeft !== '' || style.borderLeftColor !== '';
    const hasIcon = row.querySelector('img, svg, [class*="icon"]') !== null;
    return { label, hasColorIndicator, hasIcon };
  });
  return results;
});

toolboxAudit.forEach(cat => {
  record('C.3 Toolbox', `Category: ${cat.label}`,
    cat.hasIcon ? 'has icon' : 'no icon — MakeCode has icons per category',
    cat.hasIcon ? 'PASS' : 'WARN');
});

// Check Advanced drawer expand indicator
const advancedRow = toolboxAudit.find(c => /advanced/i.test(c.label));
if (advancedRow) {
  const hasExpandArrow = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.blocklyTreeRow')];
    const adv = rows.find(r => /advanced/i.test(r.querySelector('.blocklyTreeLabel')?.textContent || ''));
    if (!adv) return false;
    return adv.querySelector('[class*="arrow"], [class*="expand"], [class*="triangle"]') !== null ||
           adv.innerHTML.includes('▶') || adv.innerHTML.includes('▸') || adv.innerHTML.includes('›');
  });
  record('C.3 Toolbox', 'Advanced drawer expand indicator',
    hasExpandArrow ? 'expand arrow present' : 'no visible expand arrow — discoverability concern',
    hasExpandArrow ? 'PASS' : 'WARN');
}

// Block search prominence
const searchBarVisible = await page.evaluate(() => {
  const bar = document.querySelector('.block-search, .block-search-bar, .block-search-input');
  if (!bar) return false;
  const rect = bar.getBoundingClientRect();
  return rect.width > 100 && rect.height > 20;
});
record('C.3 Toolbox', 'Block search bar visibility',
  searchBarVisible ? 'visible and sized adequately' : 'not found or too small',
  searchBarVisible ? 'PASS' : 'WARN');

// Category ordering (simpler → complex)
const categoryOrder = toolboxAudit.map(c => c.label);
record('C.3 Toolbox', 'Category ordering', `[${categoryOrder.join(' → ')}]`, 'INFO');

// MakeCode has search at top of toolbox panel; Physics IDE has it below toolbar
record('C.3 Toolbox', 'Block search placement',
  'Currently below toolbar in block editor (MakeCode places search at top of toolbox panel)', 'INFO');

// ─── C.4: Button & Target Sizing ─────────────────────────────────────────────
console.log('\n═══ C.4: Button & Interactive Element Sizing ════════════════════════');

// WCAG 2.5.5: 44×44px recommended, 24×24px minimum
const SIZE_CHECKS = [
  { selector: '.tb-btn--run', label: 'Run button' },
  { selector: '.tb-btn--stop', label: 'Stop button' },
  { selector: '.tb-btn--nav', label: 'Menu/Help button' },
  { selector: '.tb-btn--theme', label: 'Theme toggle' },
  { selector: '.tb-btn--dropdown', label: 'Export dropdown' },
  { selector: 'button.start-card--goal', label: 'Goal card (start menu)' },
  { selector: '.start-project-delete', label: 'Project delete button' },
  { selector: '.start-wizard-primary', label: 'Create project button' },
];

for (const sc of SIZE_CHECKS) {
  const size = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  }, sc.selector);

  if (!size) {
    // Try from start menu
    await goHome();
    const sizeFromHome = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }, sc.selector);
    if (!sizeFromHome) {
      record('C.4 Sizing', sc.label, 'element not found', 'INFO', sc.selector);
      continue;
    }
    const minOk = sizeFromHome.w >= 24 && sizeFromHome.h >= 24;
    const recOk = sizeFromHome.w >= 44 && sizeFromHome.h >= 44;
    record('C.4 Sizing', sc.label,
      `${sizeFromHome.w}×${sizeFromHome.h}px (min 24px, rec 44px)`,
      recOk ? 'PASS' : minOk ? 'WARN' : 'FAIL');
  } else {
    const minOk = size.w >= 24 && size.h >= 24;
    const recOk = size.w >= 44 && size.h >= 44;
    record('C.4 Sizing', sc.label,
      `${size.w}×${size.h}px (min 24px, rec 44px)`,
      recOk ? 'PASS' : minOk ? 'WARN' : 'FAIL');
  }
}

// Back to IDE for remaining checks
await createPhysicsProject();

// ─── C.5: Visual Consistency ──────────────────────────────────────────────────
console.log('\n═══ C.5: Visual Consistency ══════════════════════════════════════════');

// Check Run button colour (should be visually distinct from other buttons)
const runBtnColor = await page.evaluate(() => {
  const btn = document.querySelector('.tb-btn--run');
  return btn ? getComputedStyle(btn).backgroundColor : null;
});
const stopBtnColor = await page.evaluate(() => {
  const btn = document.querySelector('.tb-btn--stop');
  return btn ? getComputedStyle(btn).backgroundColor : null;
});
record('C.5 Consistency', 'Run button colour', runBtnColor || 'not found',
  runBtnColor && runBtnColor !== 'rgba(0, 0, 0, 0)' ? 'PASS' : 'INFO');
record('C.5 Consistency', 'Stop button colour', stopBtnColor || 'not found', 'INFO');

// Mode toggle active state
const modeToggleActiveStyle = await page.evaluate(() => {
  const active = document.querySelector('.mode-toggle .active, [class*="mode"][class*="active"]');
  return active ? { class: active.className, bg: getComputedStyle(active).backgroundColor } : null;
});
record('C.5 Consistency', 'Mode toggle active state',
  modeToggleActiveStyle ? `active class present, bg: ${modeToggleActiveStyle.bg}` : 'active state not detected',
  modeToggleActiveStyle ? 'PASS' : 'INFO');

// Header separator consistency — the flat .tb-separator rules between button
// groups were replaced by zone gaps plus one .app-header__sep divider between
// the brand and the project title.
const separatorCount = await page.evaluate(() =>
  document.querySelectorAll('.app-header__sep').length
);
record('C.5 Consistency', 'Header separators', `${separatorCount} separator(s)`, 'INFO');

// Check for undo/redo buttons visibility (MakeCode has them top-level)
const hasUndoRedo = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, .app-header button')];
  return btns.some(b => /undo|redo/i.test(b.title || b.textContent || b.ariaLabel || ''));
});
record('C.5 Consistency', 'Undo/Redo visibility',
  hasUndoRedo ? 'visible in toolbar' : 'not in main toolbar (in Blockly\'s own toolbar — MakeCode has top-level undo)',
  hasUndoRedo ? 'PASS' : 'WARN');

// ─── C.6: Feedback & Loading States ───────────────────────────────────────────
console.log('\n═══ C.6: Feedback & Loading States ══════════════════════════════════');

// DS live execution feedback (DS project)
await createDsProject();
await screenshot('ds-live-feedback');
const dsPanel = await page.$('.data-panel, [class*="data-panel"]');
record('C.6 Feedback', 'DS auto-execution feedback (table visible)',
  dsPanel !== null ? 'data panel present after project load' : 'data panel not detected',
  dsPanel !== null ? 'PASS' : 'WARN');

// Status bar exists
await createPhysicsProject();
const statusBar = await page.evaluate(() => {
  const bar = document.querySelector('[class*="console-bar"], [class*="status-bar"]');
  return bar ? { text: bar.textContent.trim().substring(0, 80), class: bar.className } : null;
});
record('C.6 Feedback', 'Status bar present', statusBar ? statusBar.text : 'not found',
  statusBar ? 'PASS' : 'WARN');

// Run → immediate visual feedback timing
const runTimestamp = Date.now();
const runBtn = await page.$('.tb-btn--run');
if (runBtn) {
  await runBtn.click();
  // Check for running indicator within 500ms
  await delay(300);
  const hasRunningState = await page.evaluate(() =>
    document.querySelector('.console-bar--running, [class*="running"], .spinner, [class*="spin"]') !== null
  );
  const elapsed = Date.now() - runTimestamp;
  record('C.6 Feedback', 'Run → running indicator timing',
    `indicator${hasRunningState ? '' : ' NOT'} shown within ${elapsed}ms`,
    hasRunningState ? 'PASS' : 'WARN');
  await page.click('.tb-btn--stop').catch(() => {});
  await delay(500);
}

// ─── C.7: Accessibility ───────────────────────────────────────────────────────
console.log('\n═══ C.7: Accessibility ═══════════════════════════════════════════════');

await createPhysicsProject();

// Check aria-labels on icon-only buttons
const a11yChecks = [
  { selector: '.tb-btn--run', label: 'Run button' },
  { selector: '.tb-btn--stop', label: 'Stop button' },
  { selector: '.tb-btn--theme', label: 'Theme toggle' },
  { selector: '.tb-btn--dropdown', label: 'Export dropdown' },
];

for (const ac of a11yChecks) {
  const attrs = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return {
      ariaLabel: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      text: el.textContent.trim().substring(0, 30),
    };
  }, ac.selector);

  if (!attrs) {
    record('C.7 A11y', ac.label, 'element not found', 'INFO');
    continue;
  }
  const hasLabel = !!(attrs.ariaLabel || attrs.title || attrs.text.length > 1);
  record('C.7 A11y', `${ac.label} accessible label`,
    `aria-label:"${attrs.ariaLabel}" title:"${attrs.title}" text:"${attrs.text}"`,
    hasLabel ? 'PASS' : 'FAIL');
}

// Modal accessibility
await goHome();
await page.evaluate(() => {
  const cards = [...document.querySelectorAll('button.start-card--goal')];
  const c = cards.find(c => /physics.?modelling/i.test(c.textContent));
  if (c) c.click();
});
await delay(600);
const wizardModal = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"], .start-wizard');
  if (!dialog) return null;
  return {
    role: dialog.getAttribute('role'),
    ariaModal: dialog.getAttribute('aria-modal'),
    ariaLabel: dialog.getAttribute('aria-label') || dialog.getAttribute('aria-labelledby'),
  };
});
record('C.7 A11y', 'Create project wizard modal',
  wizardModal ? `role="${wizardModal.role}" aria-modal="${wizardModal.ariaModal}"` : 'no role="dialog" found',
  wizardModal?.role === 'dialog' ? 'PASS' : 'WARN');

// Project delete button aria-label
await goHome();
// Create a project first to have a list item
const delBtn = await page.evaluate(() => {
  const btn = document.querySelector('.start-project-delete');
  return btn ? { ariaLabel: btn.getAttribute('aria-label'), title: btn.getAttribute('title') } : null;
});
if (delBtn) {
  record('C.7 A11y', 'Project delete button aria-label',
    `aria-label:"${delBtn.ariaLabel}"`,
    delBtn.ariaLabel ? 'PASS' : 'FAIL');
}

// Help overlay accessibility
await createPhysicsProject();
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.tb-btn--nav, .tb-btn')];
  const h = btns.find(b => /help/i.test(b.textContent));
  if (h) h.click();
});
await delay(600);
const helpModal = await page.evaluate(() => {
  const overlay = document.querySelector('.help-overlay');
  return overlay ? {
    role: overlay.getAttribute('role'),
    ariaModal: overlay.getAttribute('aria-modal'),
  } : null;
});
record('C.7 A11y', 'Help overlay modal attributes',
  helpModal ? `role="${helpModal.role}" aria-modal="${helpModal.ariaModal}"` : 'not found',
  helpModal?.ariaModal === 'true' ? 'PASS' : 'WARN');
await page.keyboard.press('Escape');
await delay(300);

// Keyboard nav on start menu
await goHome();
await page.keyboard.press('Tab');
await delay(200);
const focusedEl = await page.evaluate(() => {
  const el = document.activeElement;
  return el ? { tag: el.tagName, class: el.className.substring(0, 60), text: el.textContent.trim().substring(0, 30) } : null;
});
record('C.7 A11y', 'Keyboard Tab navigation (start menu)',
  focusedEl ? `Focus lands on: <${focusedEl.tag}> "${focusedEl.text}"` : 'no element focused',
  focusedEl && focusedEl.tag !== 'BODY' ? 'PASS' : 'WARN');

// ─── C.8: MakeCode Comparison Matrix ─────────────────────────────────────────
console.log('\n═══ C.8: MakeCode Comparison ════════════════════════════════════════');

// These are informational — collect data for the report
await createPhysicsProject();

const comparisonData = await page.evaluate(() => {
  const runBtn = document.querySelector('.tb-btn--run');
  const runRect = runBtn?.getBoundingClientRect();
  const toolbarHeight = document.querySelector('.app-header')?.getBoundingClientRect().height;
  const blockLabelSize = (() => {
    const texts = [...document.querySelectorAll('.blocklyText')];
    const sizes = texts.map(t => parseFloat(getComputedStyle(t).fontSize || '0')).filter(s => s > 0);
    return sizes.length ? (sizes.reduce((a,b)=>a+b,0)/sizes.length).toFixed(1) : '?';
  })();
  const categoryCount = document.querySelectorAll('.blocklyTreeRow').length;
  const hasCategoryIcons = [...document.querySelectorAll('.blocklyTreeRow')].some(r =>
    r.querySelector('img, svg:not(.blocklyFlyout svg)') !== null
  );
  const searchBar = document.querySelector('.block-search, .block-search-input');
  const searchPos = searchBar ? 'in editor pane below toolbar' : 'not found';

  return {
    runBtnSize: runRect ? `${Math.round(runRect.width)}×${Math.round(runRect.height)}px` : '?',
    toolbarHeight: toolbarHeight ? `${Math.round(toolbarHeight)}px` : '?',
    blockLabelSize,
    categoryCount,
    hasCategoryIcons,
    searchPos,
  };
});

const matrix = [
  ['Feature', 'Physics IDE', 'MakeCode', 'Gap'],
  ['Block label size', `${comparisonData.blockLabelSize}px`, '14-16px',
   comparisonData.blockLabelSize < '14' ? 'Consider increasing to 14px' : 'OK'],
  ['Category icons', comparisonData.hasCategoryIcons ? 'Yes' : 'Colour borders only', 'Icon + colour per category',
   comparisonData.hasCategoryIcons ? 'OK' : 'Add icons for visual scanning'],
  ['Run button size', comparisonData.runBtnSize, '≥60px high', ''],
  ['Toolbar height', comparisonData.toolbarHeight, '~48px', ''],
  ['Block search placement', comparisonData.searchPos, 'Top of toolbox panel', 'Consider moving to toolbox top'],
  ['Undo/Redo in toolbar', 'Blockly built-in (small)', 'Top-level prominent buttons', 'Consider promoting'],
  ['Error feedback', 'Status bar (bottom)', 'Inline simulator panel', 'Status bar requires scroll'],
  ['Template previews', 'Text descriptions', 'Screenshots + descriptions', 'Add visual previews'],
  ['Live output feedback', 'DS panel + 3D viewport', 'Simulator panel (always visible)', 'OK — multi-panel'],
  ['Keyboard shortcuts', 'Ctrl+Enter, Ctrl+S', 'Ctrl+Z, Space=Run, etc.', 'Document in Help'],
  ['Category count (physics)', `${comparisonData.categoryCount}`, '~8-10', ''],
];

matrix.forEach(([feat, phy, mk, gap]) => {
  if (feat === 'Feature') return; // header
  record('C.8 MakeCode', feat, `Physics IDE: ${phy} | MakeCode: ${mk}${gap ? ' | ' + gap : ''}`, 'INFO');
});

// ─── Generate Markdown Report ─────────────────────────────────────────────────
await browser.close();

function statusIcon(s) { return s === 'PASS' ? '✅' : s === 'FAIL' ? '❌' : s === 'WARN' ? '⚠️' : 'ℹ️'; }

const sections = {};
for (const f of findings) {
  if (!sections[f.category]) sections[f.category] = [];
  sections[f.category].push(f);
}

let md = `# Physics IDE — UX Audit Report

> Generated: ${new Date().toISOString()}
> Reference: Microsoft MakeCode (makecode.microbit.org)

## Summary

| Status | Count |
|--------|-------|
| ✅ Pass | ${auditPass} |
| ❌ Fail | ${auditFail} |
| ⚠️ Warn | ${auditWarn} |
| ℹ️ Info | ${findings.filter(f=>f.status==='INFO').length} |
| **Total** | **${findings.length}** |

---

`;

for (const [section, items] of Object.entries(sections)) {
  md += `## ${section}\n\n`;
  md += `| Status | Element | Detail |\n|--------|---------|--------|\n`;
  for (const item of items) {
    md += `| ${statusIcon(item.status)} ${item.status} | **${item.element}** | ${item.detail.replace(/\|/g, '\\|')} |\n`;
  }
  md += '\n';
}

md += `## C.8 MakeCode Comparison Matrix\n\n`;
md += `| Feature | Physics IDE | MakeCode | Gap / Opportunity |\n|---------|-------------|----------|-------------------|\n`;
matrix.slice(1).forEach(([feat, phy, mk, gap]) => {
  md += `| ${feat} | ${phy} | ${mk} | ${gap || '—'} |\n`;
});

md += `\n## Recommendations (Priority Order)\n\n`;

const fails = findings.filter(f => f.status === 'FAIL');
const warns = findings.filter(f => f.status === 'WARN');

if (fails.length === 0 && warns.length === 0) {
  md += '> All checks passed or informational — no critical issues found.\n\n';
} else {
  if (fails.length > 0) {
    md += '### Critical (Fix)\n\n';
    fails.forEach((f, i) => md += `${i+1}. **${f.element}**: ${f.detail}\n`);
    md += '\n';
  }
  if (warns.length > 0) {
    md += '### Improvements (Consider)\n\n';
    warns.forEach((f, i) => md += `${i+1}. **${f.element}**: ${f.detail}\n`);
    md += '\n';
  }
}

md += `## Screenshots\n\n`;
screenshots.forEach(s => md += `- \`e2e/ux-${s.name}.png\`\n`);

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, md, 'utf8');

console.log(`\n${'═'.repeat(60)}`);
console.log(`Pass: ${auditPass}  Fail: ${auditFail}  Warn: ${auditWarn}`);
console.log(`\nReport written to: ${REPORT_PATH}`);
if (auditFail > 0) console.log(`${C.fail}${auditFail} accessibility/contrast failure(s) — see report for details.${C.reset}`);
process.exit(auditFail > 0 ? 1 : 0);
