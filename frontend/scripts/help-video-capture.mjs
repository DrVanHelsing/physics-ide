/**
 * help-video-capture.mjs — capture the Help page's demo loops.
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
 *   run-blocks, live-graphs, debug-record, analyse-roundtrip, data-science,
 *   blocks-basics, code-mode, templates-gallery, save-projects
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

/* Deep-IA start menu (wizard deleted): a template card on the landing
   creates the project on click; a goal card creates a blank one. Both
   helpers below click the card's .start-card-main. Title-first matching
   so a description mentioning the same words can't shadow the card. */
async function clickTemplateCard(page, templatePattern) {
  await page.evaluate((pat) => {
    const re = new RegExp(pat, 'i');
    const cards = [...document.querySelectorAll('.start-card--template')];
    const card = cards.find((el) => re.test(el.querySelector('.start-card-title')?.textContent || ''))
      || cards.find((el) => re.test(el.textContent));
    if (!card) throw new Error('template card not found: ' + pat);
    card.querySelector('.start-card-main').click();
  }, templatePattern);
}

/** Wizard walk: goal card → Template radio → template card. Stops BEFORE
 *  "Create project" so callers can choose whether creation is on camera. */
async function createFromTemplate(page, goalPattern, templatePattern, W = 1) {
  // goalPattern kept in the signature for the call sites' readability;
  // the landing rail already carries every goal's templates.
  await goHome(page);
  await clickTemplateCard(page, templatePattern);
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

/* ── On-camera gesture helpers (blocks-basics / code-mode / templates /
      save-projects). Headless screencast draws no cursor, so what the
      camera sees is the UI reacting: hover states lighting up, a block
      following the drag, the flyout opening. Real mouse events all the
      way — nothing here reaches into React or Blockly to fake a result. */

/** Small glide to (x, y) then a real click — the glide exists so hover
 *  styling fires before the press (cards, toolbar buttons). */
async function glideClick(page, x, y) {
  const steps = 6;
  const sx = x - 120, sy = y - 70;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(sx + ((x - sx) * i) / steps, sy + ((y - sy) * i) / steps);
    await delay(28);
  }
  await delay(90);
  await page.mouse.click(x, y);
}

/** Press at (fx, fy), glide to (tx, ty), release. Slow enough that the
 *  dragged block visibly travels on camera. */
async function smoothDrag(page, fx, fy, tx, ty, steps = 16, stepDelay = 35) {
  await page.mouse.move(fx, fy);
  await page.mouse.down();
  await delay(140);
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fx + ((tx - fx) * i) / steps, fy + ((ty - fy) * i) / steps);
    await delay(stepDelay);
  }
  await delay(140);
  await page.mouse.up();
}

/** Rect of the first element matching selector whose text matches pattern
 *  (case-insensitive), as [x, y, w, h] — or null. */
async function rectOf(page, selector, pattern) {
  return page.evaluate((sel, pat) => {
    const el = [...document.querySelectorAll(sel)]
      .find((e) => new RegExp(pat, 'i').test(e.textContent) && e.getBoundingClientRect().width > 0);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  }, selector, pattern);
}

/** Click a Blockly toolbox category by name until its flyout is open
 *  (a click on an already-open category toggles it closed, so check). */
async function openCategory(page, name, W = 1) {
  for (let tries = 0; tries < 2; tries++) {
    const r = await rectOf(page, '.blocklyTreeRow', '^' + name);
    if (!r) throw new Error('toolbox category not found: ' + name);
    await glideClick(page, r[0] + r[2] / 2, r[1] + r[3] / 2);
    await delay(480 * W);
    const open = await page.evaluate(() => {
      const fly = window.Blockly?.getMainWorkspace()?.getFlyout();
      return !!fly?.isVisible();
    });
    if (open) return;
  }
  throw new Error('flyout did not open for category: ' + name);
}

/** Screen rect [x, y, w, h] of a flyout block by type, or null. */
async function flyoutBlockRect(page, type) {
  return page.evaluate((t) => {
    const fly = window.Blockly.getMainWorkspace().getFlyout();
    const b = (fly?.getWorkspace().getTopBlocks(true) || []).find((x) => x.type === t);
    if (!b) return null;
    const r = b.getSvgRoot().getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  }, type);
}

/** Screen rect [x, y, w, h] of a main-workspace block by type, or null. */
async function workspaceBlockRect(page, type) {
  return page.evaluate((t) => {
    const ws = window.Blockly.getMainWorkspace();
    const b = ws.getAllBlocks(false).find((x) => x.type === t);
    if (!b) return null;
    const r = b.getSvgRoot().getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  }, type);
}

/** A goal card creates its blank blocks project on click now. */
async function createBlankBlocks(page, goalPattern, W = 1) {
  await goHome(page);
  await page.evaluate((pat) => {
    const cards = [...document.querySelectorAll('.start-card--goal')];
    const card = cards.find((c) => new RegExp(pat, 'i').test(c.textContent));
    if (!card) throw new Error('goal card not found: ' + pat);
    card.querySelector('.start-card-main').click();
  }, goalPattern);
  await delay(2500 * W);
  await page.waitForSelector('.tb-btn--run', { timeout: 15000 * W });
  await page.waitForFunction(
    () => !!window.Blockly?.getMainWorkspace(),
    { timeout: 10000 * W, polling: 200 },
  );
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
    // draw BELOW the scene. The template now creates the graph displays
    // AFTER the 3D objects, so the scene canvas is FIRST in the runtime
    // iframe with the three Plotly .glowscript-graph divs stacked under it
    // (probed live 2026-09-02: canvas@16, graphs@393/848/1303 in a 662px
    // pane; only an anonymous wrapper div actually scrolls —
    // doc.scrollingElement clamps). The default scroll position already
    // frames the swinging bob above the first live graph, so the clip just
    // pins the scrolling wrapper to the top and films.
    async run(page, W) {
      await createFromTemplate(page, 'physics.?modelling', 'SHM Pendulum \\(Blocks', W);
      await page.click('.tb-btn--run');
      await waitForScene(page, 30000 * W);
      await page.waitForFunction(() => {
        const f = document.querySelector('#glowscript-host iframe');
        try { return f.contentDocument.querySelectorAll('.glowscript-graph').length >= 1; } catch { return false; }
      }, { timeout: 15000 * W, polling: 250 }).catch(() => {
        notes.push('live-graphs: no .glowscript-graph div detected before capture.');
      });
      await page.evaluate(() => {
        const f = document.querySelector('#glowscript-host iframe');
        const doc = f?.contentDocument;
        if (!doc) return;
        for (const el of [doc.scrollingElement, ...doc.querySelectorAll('div')]) {
          if (el && el.scrollHeight > el.clientHeight + 10) { el.scrollTop = 0; break; }
        }
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
    // The Penguins card creates on click now (wizard deleted). Creation is
    // ON CAMERA so the clip shows the IDE loading and the table + chart
    // rendering — the capture starts on the start menu, the click happens
    // inside it.
    async run(page, W) {
      await goHome(page);
      await delay(300);
      await captureClip(page, this.raw, async () => {
        await delay(400);
        await clickTemplateCard(page, 'penguins');
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
  {
    name: 'blocks-basics',
    // Core editing gestures on a BLANK physics Blocks project: drag a
    // sphere block out of the Objects flyout, snap a box block beneath it,
    // then drag the box onto the trashcan. The trashcan is the custom
    // .workspace-trash delete area (WorkspaceTrash.js) — laid out at rest,
    // fades in when a drag starts, and Blockly's own drag system disposes
    // of anything dropped on it. The 3D viewport is hidden OFF camera
    // first ("Hide 3D viewport" toolbar toggle) so the workspace has the
    // full frame and the wide object blocks don't clip under the runtime
    // pane.
    async run(page, W) {
      await createBlankBlocks(page, 'physics.?modelling', W);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('.app-header button')]
          .find((x) => /hide 3d viewport/i.test(x.title || '') || /hide 3d viewport/i.test(x.getAttribute('aria-label') || ''));
        if (b) b.click();
        else throw new Error('Hide 3D viewport toggle not found');
      });
      await delay(700 * W); // Blockly re-lays-out into the widened pane
      await captureClip(page, this.raw, async () => {
        await delay(250);
        // 1. palette → workspace: drag the preset sphere block out
        await openCategory(page, 'Objects', W);
        const fly1 = await flyoutBlockRect(page, 'preset_sphere_block');
        if (!fly1) throw new Error('preset_sphere_block not in the Objects flyout');
        // grab (+40, +15) from the block corner; drop so its top-left lands
        // clear of the starter Simulation Start/End stack
        const dropX = 460, dropY = 350;
        await smoothDrag(page, fly1[0] + 40, fly1[1] + 15, dropX + 40, dropY + 15, 16, 32);
        await delay(350);
        const sphere = await workspaceBlockRect(page, 'preset_sphere_block');
        if (!sphere) throw new Error('sphere block did not land in the workspace');
        // 2. connect: drag the preset box block so its previous-connection
        //    notch meets the sphere's next connection (snap radius assists)
        await openCategory(page, 'Objects', W);
        const fly2 = await flyoutBlockRect(page, 'preset_box_block');
        if (!fly2) throw new Error('preset_box_block not in the Objects flyout');
        await smoothDrag(page, fly2[0] + 40, fly2[1] + 15, sphere[0] + 40 + 4, sphere[1] + sphere[3] + 15 - 4, 13, 30);
        await delay(350);
        let connected = await page.evaluate(() => {
          const b = window.Blockly.getMainWorkspace().getAllBlocks(false)
            .find((x) => x.type === 'preset_box_block');
          return !!b?.previousConnection?.isConnected();
        });
        if (!connected) {
          // the drop missed the snap radius — a short corrective drag, with
          // the exact delta between the two connections read off Blockly
          const fix = await page.evaluate(() => {
            const ws = window.Blockly.getMainWorkspace();
            const box = ws.getAllBlocks(false).find((x) => x.type === 'preset_box_block');
            const sph = ws.getAllBlocks(false).find((x) => x.type === 'preset_sphere_block');
            if (!box?.previousConnection || !sph?.nextConnection) return null;
            const r = box.getSvgRoot().getBoundingClientRect();
            return {
              from: [r.x + 40, r.y + 15],
              dx: (sph.nextConnection.x - box.previousConnection.x) * ws.scale,
              dy: (sph.nextConnection.y - box.previousConnection.y) * ws.scale,
            };
          });
          if (fix) {
            await smoothDrag(page, fix.from[0], fix.from[1], fix.from[0] + fix.dx, fix.from[1] + fix.dy, 8, 30);
            await delay(400);
          }
          connected = await page.evaluate(() => {
            const b = window.Blockly.getMainWorkspace().getAllBlocks(false)
              .find((x) => x.type === 'preset_box_block');
            return !!b?.previousConnection?.isConnected();
          });
          if (!connected) throw new Error('box block never snapped under the sphere block');
        }
        await delay(350);
        // 3. delete: drag the box block onto the trashcan
        const before = await page.evaluate(() => window.Blockly.getMainWorkspace().getAllBlocks(false).length);
        const box = await workspaceBlockRect(page, 'preset_box_block');
        const trash = await page.evaluate(() => {
          const t = document.querySelector('.workspace-trash');
          if (!t) return null;
          const r = t.getBoundingClientRect();
          return [r.x + r.width / 2, r.y + r.height / 2];
        });
        if (!box || !trash) throw new Error('box block or .workspace-trash not found for the delete gesture');
        await smoothDrag(page, box[0] + 30, box[1] + 12, trash[0], trash[1], 13, 30);
        await delay(650); // Blockly's shrink-into-the-can animation
        const after = await page.evaluate(() => window.Blockly.getMainWorkspace().getAllBlocks(false).length);
        if (after >= before) throw new Error('trash drop did not dispose of the block');
        await delay(450);
      });
    },
  },
  {
    name: 'code-mode',
    // Two-way mode switch on a Blocks template: Blocks → Code shows the
    // generated Python in Monaco, a gentle scroll through it, then back to
    // Blocks. The header .mode-toggle drives both directions.
    async run(page, W) {
      await createFromTemplate(page, 'physics.?modelling', 'Projectile \\(Blocks', W);
      await delay(500);
      await captureClip(page, this.raw, async () => {
        await delay(500); // hold on the blocks view first
        const codeBtn = await rectOf(page, '.mode-toggle button', 'code');
        if (!codeBtn) throw new Error('.mode-toggle Code button not found');
        await glideClick(page, codeBtn[0] + codeBtn[2] / 2, codeBtn[1] + codeBtn[3] / 2);
        await page.waitForSelector('div.monaco-editor', { timeout: 10000 * W });
        await delay(800); // Python renders + syntax highlight settles
        // scroll past the None-preamble so the real simulation code shows
        const ed = await page.$('div.monaco-editor');
        const ebox = await ed.boundingBox();
        await page.mouse.move(ebox.x + ebox.width / 2, ebox.y + ebox.height / 2);
        for (let i = 0; i < 6; i++) { await page.mouse.wheel({ deltaY: 160 }); await delay(150); }
        await delay(400);
        const blocksBtn = await rectOf(page, '.mode-toggle button', 'blocks');
        if (!blocksBtn) throw new Error('.mode-toggle Blocks button not found');
        await glideClick(page, blocksBtn[0] + blocksBtn[2] / 2, blocksBtn[1] + blocksBtn[3] / 2);
        await page.waitForSelector('.blockly-host', { timeout: 8000 * W }).catch(() => {
          notes.push('code-mode: .blockly-host not confirmed after toggling back.');
        });
        await delay(1000);
      });
    },
  },
  {
    name: 'templates-gallery',
    // The start menu's own "Start from a template" card grid: hover across
    // the cards, scroll the menu so the grid's second row shows, then click
    // one — a featured-template card creates the project directly
    // (StartMenu.openTemplate), so the IDE opens on camera off that single
    // click. (The start menu is due a rework — re-shoot this clip when
    // that lands.)
    async run(page, W) {
      await goHome(page);
      await delay(300);
      await captureClip(page, this.raw, async () => {
        await delay(600); // hold on the start menu
        const cards = await page.evaluate(() => [...document.querySelectorAll('.start-card--template')]
          .slice(0, 3)
          .map((c) => { const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
        if (!cards.length) throw new Error('no .start-card--template cards on the start menu');
        for (const [cx, cy] of cards) { await page.mouse.move(cx, cy); await delay(400); }
        // scroll so the grid's lower row is in view
        for (let i = 0; i < 3; i++) { await page.mouse.wheel({ deltaY: 140 }); await delay(200); }
        await delay(300);
        // pick the SHM Pendulum card (re-read: the scroll moved it)
        const pick = await rectOf(page, '.start-card--template', 'SHM Pendulum');
        if (!pick) throw new Error('SHM Pendulum template card not visible after scrolling');
        await glideClick(page, pick[0] + pick[2] / 2, pick[1] + pick[3] / 2);
        await page.waitForSelector('.tb-btn--run', { timeout: 15000 * W });
        // the Blockly workspace injects a beat after the IDE shell mounts —
        // hold until the template's blocks are actually on screen
        await page.waitForFunction(
          () => (window.Blockly?.getMainWorkspace()?.getAllBlocks(false) || []).length > 0,
          { timeout: 10000 * W, polling: 200 },
        ).catch(() => {
          notes.push('templates-gallery: template blocks not confirmed on screen before the clip ended.');
        });
        // Screencast quirk, diagnosed live: Chromium only emits screencast
        // frames when pixels change, and the freshly opened IDE is fully
        // static — so without motion the encoded clip freezes on a
        // half-mounted frame (page.screenshot shows the IDE fine while the
        // very same screencast's last frame has an unpainted workspace).
        // Hover down the toolbox categories: real gesture, natural "here's
        // your new project" beat, and every hover emits fresh frames.
        for (const cat of ['Values', 'Objects', 'Motion']) {
          const r = await rectOf(page, '.blocklyTreeRow', '^' + cat).catch(() => null);
          if (r) { await page.mouse.move(r[0] + r[2] / 2, r[1] + r[3] / 2); await delay(380); }
        }
        await page.mouse.move(400, 400);
        await delay(600); // the IDE settles on camera
      });
    },
  },
  {
    name: 'save-projects',
    // Rename + save + the project turning up on the start menu: click the
    // header project title (ProjectTitle.js — click to rename, Enter
    // commits), type a new name, press the header Save button (the status
    // bar acknowledges with "Saved …"), then Menu back to the start menu
    // where the renamed project tops the Continue list. Run this clip in
    // its OWN invocation: the browser profile is fresh per launch, so the
    // Continue list then shows exactly the one renamed project.
    async run(page, W) {
      await createFromTemplate(page, 'physics.?modelling', 'Projectile \\(Blocks', W);
      await delay(600);
      await captureClip(page, this.raw, async () => {
        await delay(350);
        const title = await rectOf(page, 'button.project-title', '.');
        if (!title) throw new Error('header project title (button.project-title) not found');
        await glideClick(page, title[0] + title[2] / 2, title[1] + title[3] / 2);
        await page.waitForSelector('input.project-title-input', { timeout: 4000 * W });
        await delay(250); // the input auto-selects the old name
        await page.keyboard.type('Projectile Lab', { delay: 45 });
        await delay(250);
        await page.keyboard.press('Enter');
        await delay(400);
        const save = await rectOf(page, '.tb-btn--save', 'save');
        if (!save) throw new Error('header Save button (.tb-btn--save) not found');
        await glideClick(page, save[0] + save[2] / 2, save[1] + save[3] / 2);
        await delay(800); // status bar: Saved "Projectile Lab"
        const menu = await rectOf(page, '.tb-btn--nav', 'menu');
        if (!menu) throw new Error('header Menu button (.tb-btn--nav) not found');
        await glideClick(page, menu[0] + menu[2] / 2, menu[1] + menu[3] / 2);
        await page.waitForSelector('.start-project-list', { timeout: 8000 * W });
        // hover the renamed project's row — highlights it AND keeps
        // screencast frames flowing over the otherwise-static menu
        const row = await rectOf(page, '.start-project-row', 'Projectile Lab');
        if (row) {
          await page.mouse.move(row[0] + row[2] * 0.4, row[1] + row[3] / 2);
          await delay(600);
          await page.mouse.move(row[0] + row[2] * 0.55, row[1] + row[3] / 2);
        }
        await delay(900); // hold on the Continue list with the renamed project
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
