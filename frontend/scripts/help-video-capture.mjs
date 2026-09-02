/**
 * help-video-capture.mjs — capture the Help page's five demo loops.
 *
 * Replicates the welcome-page pipeline (throwaway puppeteer capture +
 * ffmpeg encode): each clip is recorded off the REAL product on the dev
 * server with page.screencast(), then re-encoded as a short MUTED
 * vp9/webm loop (width 960, ≤8s, crf 34) plus a first-frame .webp poster.
 *
 * Usage (dev server must already be running on :3000):
 *   cd frontend && node scripts/help-video-capture.mjs
 *
 * Outputs:
 *   src/assets/help/<name>.webm + <name>-poster.webp   for
 *   run-blocks, live-graphs, debug-record, analyse-roundtrip, data-science
 *
 * Raw intermediates land in e2e/ and are deleted after encoding.
 * On a clip failure a debug screenshot is written to
 * e2e/help-capture-debug-<name>-try<N>.png and the clip is retried once
 * with longer waits.
 */

import puppeteer from 'puppeteer';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = 'http://localhost:3000';
const E2E_DIR = path.join(ROOT, 'e2e');
const HELP_DIR = path.join(ROOT, 'src', 'assets', 'help');
for (const d of [E2E_DIR, HELP_DIR]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const notes = [];   // substitutions / deviations worth reporting
const failures = []; // clips that did not survive the retry

/* ── Harness idioms (mirrors scripts/e2e-test.mjs) ─────────────────────── */

async function goHome(page) {
  // Welcome gate: stamp the session pass (WELCOME_PASSED_SESSION_KEY in
  // src/constants) instead of clicking through, then reload onto "/".
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => sessionStorage.setItem('pide_welcome_passed', '1'));
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  if (/\/welcome(?:$|[/?#])/.test(page.url())) {
    // Belt-and-braces: the stamp is honoured on "/" — click through if the
    // gate still routed us (should not happen once the stamp is set).
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.btn--primary')]
        .find((b) => /use the ide/i.test(b.textContent));
      if (btn) btn.click();
    });
    await page.waitForFunction(() => !location.pathname.startsWith('/welcome'), { timeout: 8000 }).catch(() => {});
  }
  // A reload can land straight back in the last-open project; the header's
  // own Menu button is the product's way back to the start menu.
  const sawOverlay = await page
    .waitForSelector('.start-menu-overlay', { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!sawOverlay) {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.tb-btn--nav')];
      const m = btns.find((b) => /menu/i.test(b.textContent) || b.title?.includes('Menu'));
      if (m) m.click();
    });
    await page.waitForSelector('.start-menu-overlay', { timeout: 8000 });
  }
  await delay(300);
}

async function selectTemplate(page, templatePattern) {
  await page.evaluate((pat) => {
    const templates = [...document.querySelectorAll('.start-wizard-template')];
    const t = templates.find((el) => new RegExp(pat, 'i').test(el.textContent));
    if (t) t.click();
    else throw new Error('template not found: ' + pat);
  }, templatePattern);
  await delay(300);
}

async function clickCreate(page) {
  const created = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => /create.?project/i.test(b.textContent) && !b.disabled);
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!created) throw new Error('Create project button not found or disabled');
}

/** Wizard walk: goal card → Template radio → template card. Stops BEFORE
 *  "Create project" so callers can choose whether creation is on camera. */
async function openWizardOnTemplate(page, goalPattern, templatePattern, W = 1) {
  await goHome(page);
  await page.evaluate((pat) => {
    const cards = [...document.querySelectorAll('button.start-card--goal')];
    const card = cards.find((c) => new RegExp(pat, 'i').test(c.textContent));
    if (card) card.click();
    else throw new Error('goal card not found: ' + pat);
  }, goalPattern);
  await delay(600 * W);
  await page.evaluate(() => {
    const radios = [...document.querySelectorAll('.start-wizard-radio')];
    const t = radios.find((r) => /template/i.test(r.textContent));
    if (t) t.click();
  });
  await delay(400 * W);
  await selectTemplate(page, templatePattern);
}

async function createFromTemplate(page, goalPattern, templatePattern, W = 1) {
  await openWizardOnTemplate(page, goalPattern, templatePattern, W);
  await clickCreate(page);
  await delay(3000 * W);
  await page.waitForSelector('.tb-btn--run', { timeout: 15000 * W });
}

/** The GlowScript runtime is a same-origin iframe in #glowscript-host; the
 *  scene exists once a <canvas> appears inside it (runtime loads several CDN
 *  scripts first — seconds, not ms). */
async function waitForScene(page, timeout) {
  await page.waitForFunction(() => {
    const f = document.querySelector('#glowscript-host iframe');
    try { return !!f?.contentDocument?.querySelector('canvas'); } catch { return false; }
  }, { timeout, polling: 200 });
}

/* ── Capture + encode ──────────────────────────────────────────────────── */

async function captureClip(page, rawPath, during) {
  const recorder = await page.screencast({ path: rawPath });
  try {
    await during();
  } finally {
    await recorder.stop();
  }
}

function encodeClip(rawPath, name) {
  const out = path.join(HELP_DIR, `${name}.webm`);
  const poster = path.join(HELP_DIR, `${name}-poster.webp`);
  execFileSync('ffmpeg', [
    '-y', '-i', rawPath,
    '-t', '8', '-an',
    '-vf', 'scale=960:-2',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34',
    '-deadline', 'good', '-cpu-used', '2', '-row-mt', '1',
    out,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  execFileSync('ffmpeg', [
    '-y', '-i', out,
    '-vframes', '1', '-q:v', '80',
    poster,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  fs.unlinkSync(rawPath); // raw intermediate gone
  return out;
}

/* ── The five clips ────────────────────────────────────────────────────── */

const CLIPS = [
  {
    name: 'run-blocks',
    // Blocks projectile template ('Projectile \(Blocks' — a bare /Projectile/
    // would match the code example), Run, ball flies ~6s.
    async run(page, W) {
      await createFromTemplate(page, 'physics.?modelling', 'Projectile \\(Blocks', W);
      await page.click('.tb-btn--run');
      await waitForScene(page, 30000 * W);
      await delay(300);
      await captureClip(page, this.raw, async () => { await delay(7500); });
    },
  },
  {
    name: 'live-graphs',
    // SHM Pendulum blocks template: bob swings while the three live graphs
    // draw below the scene. Scroll the runtime iframe a touch so the scene
    // bottom and the first graph share the frame.
    async run(page, W) {
      await createFromTemplate(page, 'physics.?modelling', 'SHM Pendulum \\(Blocks', W);
      await page.click('.tb-btn--run');
      await waitForScene(page, 30000 * W);
      // The three live graphs are Plotly divs stacked ABOVE the 3D scene in
      // the runtime iframe (probed live: .glowscript-graph divs first, the
      // WebGL scene canvas last, and only an anonymous wrapper div actually
      // scrolls - doc.scrollingElement clamps). scrollIntoView on the scene
      // canvas puts the full scene at the bottom of the pane with the
      // adjacent live graph drawing above it.
      await page.waitForFunction(() => {
        const f = document.querySelector('#glowscript-host iframe');
        try { return f.contentDocument.querySelectorAll('.glowscript-graph').length >= 1; } catch { return false; }
      }, { timeout: 15000 * W, polling: 250 }).catch(() => {
        notes.push('live-graphs: no .glowscript-graph div detected before capture.');
      });
      await page.evaluate(() => {
        const f = document.querySelector('#glowscript-host iframe');
        const c = f?.contentDocument?.querySelector('canvas');
        if (c) c.scrollIntoView({ block: 'end' });
      });
      await delay(400);
      await captureClip(page, this.raw, async () => { await delay(8000); });
    },
  },
  {
    name: 'debug-record',
    // Spring-Mass template (runs indefinitely -> values stream). The header
    // Debug control only EXISTS while a run is live (utils/toolbar/
    // visibleControls.js: `sim && (live || debugMode)`), so Run comes first.
    // Entering debug pauses the running sim (useDebug.handleEnterDebug), so
    // the clip resumes via SimControls before the Record -> REC cycle.
    // ON CAMERA: Debug pressed -> trace drawer opens -> Resume -> Record ->
    // ~4s of streaming values -> REC to stop.
    async run(page, W) {
      await createFromTemplate(page, 'physics.?modelling', 'Spring-Mass .Blocks', W);
      await page.click('.tb-btn--run');
      await waitForScene(page, 30000 * W);
      await delay(600);
      await captureClip(page, this.raw, async () => {
        await delay(400);
        const clicked = await page.evaluate(() => {
          const btns = [...document.querySelectorAll('.app-header .tb-btn')];
          const d = btns.find((b) => /debug/i.test(b.title || '') || /debug/i.test(b.textContent));
          if (d) { d.click(); return true; }
          return false;
        });
        if (!clicked) throw new Error('header Debug control (.tb-btn matching /debug/i) not found while running');
        await page.waitForSelector('.debug-drawer', { timeout: 8000 * W }); // drawer opens with the mode
        // entering debug paused the sim - resume so values stream again
        const resumed = await page.waitForFunction(() => {
          const b = [...document.querySelectorAll('.sim-controls .tb-btn')]
            .find((x) => /^resume/i.test(x.title || ''));
          if (b) { b.click(); return true; }
          return false;
        }, { timeout: 4000 * W, polling: 200 }).then(() => true).catch(() => false);
        if (!resumed) notes.push('debug-record: pause-ack never landed - Resume not clicked (values may have kept streaming).');
        await delay(400);
        await page.click('.trace-rec-btn');           // Record
        await delay(3800);                            // values stream
        await page.click('.trace-rec-btn--active');   // REC -> stop
        await delay(800);
      });
    },
  },
  {
    name: 'analyse-roundtrip',
    // Hybrid topic via the wizard: Run ~3s, Stop, then the analyse
    // affordance if one is reachable — otherwise the 3D/data split with the
    // divider being dragged (noted as a substitution).
    async run(page, W) {
      await createFromTemplate(page, 'hybrid', 'Projectile.*measure g', W);
      await page.click('.tb-btn--run');
      await waitForScene(page, 30000 * W);
      await delay(300);
      await captureClip(page, this.raw, async () => {
        await delay(3000);                            // run ~3s
        await page.click('.tb-btn--stop').catch(() => {});
        await delay(900);
        const analyse = await page.evaluate(() => {
          const btns = [...document.querySelectorAll('button')];
          const a = btns.find((b) => /analys/i.test(b.textContent) || /analys/i.test(b.title || ''));
          if (a && !a.disabled) { a.click(); return true; }
          return false;
        });
        if (analyse) {
          await delay(3500);                          // chart/analysis view
        } else {
          notes.push('analyse-roundtrip: no chart/analyse affordance reachable after Stop — substituted Run + the hybrid 3D/data split with the divider being dragged.');
          const d = await page.$('.pane-divider--row');
          if (!d) throw new Error('.pane-divider--row not found for the divider-drag substitution');
          const box = await d.boundingBox();
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          await page.mouse.move(cx, cy);
          await page.mouse.down();
          for (let i = 1; i <= 10; i++) { await page.mouse.move(cx, cy - (90 * i) / 10); await delay(55); }
          for (let i = 1; i <= 12; i++) { await page.mouse.move(cx, cy - 90 + (150 * i) / 12); await delay(55); }
          for (let i = 1; i <= 6; i++) { await page.mouse.move(cx, cy + 60 - (60 * i) / 6); await delay(55); }
          await page.mouse.up();
          await delay(600);
        }
      });
    },
  },
  {
    name: 'data-science',
    // DS wizard → template path → Penguins. Creation is ON CAMERA so the
    // clip shows the IDE loading and the table + chart rendering.
    async run(page, W) {
      await openWizardOnTemplate(page, 'data.?science', 'penguins', W);
      await delay(300);
      await captureClip(page, this.raw, async () => {
        await delay(400);
        await clickCreate(page);
        // The DS runner executes on a workspace CHANGE event (IDELayout's
        // handleWorkspaceChange) - the initial template load fires none, so
        // nudge the first block a pixel and back to trigger the analysis.
        // window.Blockly is exposed by the dev server (DEV-only, like the
        // e2e suite's Part B2 relies on).
        await page.waitForFunction(
          () => (window.Blockly?.getMainWorkspace()?.getAllBlocks(false) || []).length > 0,
          { timeout: 10000 * W, polling: 250 },
        );
        await delay(600);
        await page.evaluate(() => {
          const b = window.Blockly.getMainWorkspace().getAllBlocks(false)[0];
          b.moveBy(1, 0);
          b.moveBy(-1, 0);
        });
        await page.waitForSelector('.ds-table', { timeout: 8000 * W }).catch(() => {
          notes.push('data-science: .ds-table not confirmed inside the capture window.');
        });
        await delay(5200);                            // chart draws under the table
      });
    },
  },
];

/* ── Main ──────────────────────────────────────────────────────────────── */

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

// Optional CLI filter: node scripts/help-video-capture.mjs debug-record data-science
const only = process.argv.slice(2);
const RUN_CLIPS = only.length ? CLIPS.filter((c) => only.includes(c.name)) : CLIPS;

for (const clip of RUN_CLIPS) {
  clip.raw = path.join(E2E_DIR, `help-raw-${clip.name}.webm`);
  let done = false;
  for (let attempt = 1; attempt <= 2 && !done; attempt++) {
    const W = attempt === 1 ? 1 : 1.8; // retry once with longer waits
    try {
      console.log(`\n── ${clip.name} (attempt ${attempt}) ──`);
      await clip.run(page, W);
      encodeClip(clip.raw, clip.name);
      console.log(`   ok → ${clip.name}.webm + ${clip.name}-poster.webp`);
      done = true;
    } catch (e) {
      console.error(`   FAIL: ${e.message}`);
      const shot = path.join(E2E_DIR, `help-capture-debug-${clip.name}-try${attempt}.png`);
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      if (fs.existsSync(clip.raw)) fs.unlinkSync(clip.raw);
      if (attempt === 2) failures.push(`${clip.name}: ${e.message} (screenshots: e2e/help-capture-debug-${clip.name}-try*.png)`);
    }
  }
}

await browser.close();

/* ── Verify + report ───────────────────────────────────────────────────── */

console.log('\n=== Help demo assets ===');
console.log('name'.padEnd(34) + 'size'.padEnd(12) + 'duration');
let allOk = true;
for (const clip of CLIPS) {
  for (const suffix of ['.webm', '-poster.webp']) {
    const f = path.join(HELP_DIR, `${clip.name}${suffix}`);
    if (!fs.existsSync(f)) { console.log(`${(clip.name + suffix).padEnd(34)}MISSING`); allOk = false; continue; }
    const size = fs.statSync(f).size;
    let dur = '-';
    if (suffix === '.webm') {
      try {
        dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim() + 's';
      } catch { dur = '?'; }
      if (size < 100 * 1024 || size > 6 * 1024 * 1024) { allOk = false; console.log(`   ^ SIZE OUT OF BOUNDS (100KB..6MB)`); }
    }
    console.log(`${(clip.name + suffix).padEnd(34)}${(Math.round(size / 1024) + ' KB').padEnd(12)}${dur}`);
  }
}
if (notes.length) { console.log('\nNotes / substitutions:'); for (const n of notes) console.log('  - ' + n); }
if (failures.length) { console.log('\nFAILED clips:'); for (const f of failures) console.log('  - ' + f); }
process.exit(failures.length || !allOk ? 1 : 0);
