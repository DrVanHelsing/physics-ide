/**
 * portal-e2e.mjs — the classroom platform's golden flow, end to end.
 *
 * One browser run of the whole assignment loop, driven the way two people
 * would drive it — a teacher in one browser context, a student in another,
 * each with their own cookie jar:
 *
 *   1. Teacher (the seeded admin) signs in, creates a class, authors an
 *      assignment (title, one paragraph, points, standard rules), publishes.
 *   2. Student signs up through the API, confirms through the pretend inbox
 *      (`/api/admin/emails` — read exactly the way a human reads the admin
 *      Emails tab), joins by class code, opens the assignment, presses Start
 *      work, lands in the IDE with the brief pane and the rules chip, edits
 *      the workspace, submits, and reads back a fingerprint.
 *   3. Teacher's inbox shows 1 of 1, the marking room renders the snapshot,
 *      a mark is saved and released.
 *   4. The gradebook shows it; the student's Home strip carries the feedback
 *      and the assignment page shows the mark.
 *
 * Alongside the flow it sweeps every screen it lands on for the two things
 * no unit test can see: `.welcome-btn` ghosts (the alias retired in Plan 5's
 * Task 13 must never come back) and rule-less classes (a class on a live
 * element that no stylesheet rule mentions — an unstyled surface). Both are
 * harvested from `document.styleSheets` in the page itself, the same
 * stylesheet-harvest idea the Task 13 sweep used by hand.
 *
 * Usage:
 *   npm run db:up && npm run db:migrate && npm run seed   # Postgres, schema, seeded admin
 *   npm run dev                                           # backend :4000 + frontend :3000
 *   node frontend/scripts/portal-e2e.mjs
 *
 * The migrate step is not optional: a dev database one migration behind
 * answers GET /api/assignments/:id with a 500 (`column "adjustment" does not
 * exist`) and the run dies at the first assignment page.
 *
 * Output: PASS/FAIL per check, screenshots in frontend/e2e/portal-*.png,
 * results in frontend/e2e/portal-results.json, exit 0 on a full pass.
 *
 * The IDE's own suite (e2e-test.mjs) covers the IDE; this one covers the
 * portal and the two places they meet — the brief pane and the rules chip.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = 'http://localhost:3000';
const E2E_DIR = path.join(ROOT, 'e2e');
if (!fs.existsSync(E2E_DIR)) fs.mkdirSync(E2E_DIR, { recursive: true });

// The seeded admin — same defaults backend/src/seed.ts uses, overridable the
// same way, so a machine that seeded with its own credentials still runs.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@physics-ide.local').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin-dev-password';

// ─── ANSI colours ────────────────────────────────────────────────────────────
const C = { pass: '\x1b[32m', fail: '\x1b[31m', info: '\x1b[33m', dim: '\x1b[90m', reset: '\x1b[0m' };
const PASS = `${C.pass}PASS${C.reset}`;
const FAIL = `${C.fail}FAIL${C.reset}`;
const INFO = `${C.info}INFO${C.reset}`;

// ─── Run-scoped fixture data ─────────────────────────────────────────────────
/* Every run mints its own class and student so a second run never collides
   with the first one's rows (the dev database is not reset between runs). */
const RUN = Date.now().toString(36);
const CLASS_NAME = `E2E Portal ${RUN}`;
const ASSIGNMENT_TITLE = `Bouncing ball ${RUN}`;
const INSTRUCTIONS_PARAGRAPH =
  'Model a ball dropped from two metres and measure how high it bounces.';
const STUDENT_NAME = `E2E Student ${RUN}`;
const STUDENT_EMAIL = `e2e.student.${RUN}@example.test`;
const STUDENT_PASSWORD = 'portal-e2e-password';
const POINTS = 20;
const AWARDED = 17;
const MARK_COMMENT = 'Good model — say why the bounce height falls each time.';

/* standard_classwork (shared/src/workspaceRules.ts) switches off import,
   export & copy and templates, and RulesChip renders them in the shared
   schema's own field order. This is the sentence a student must read. */
const EXPECTED_RULES_SENTENCE = 'Your teacher has turned off: import, export & copy, templates';

// ─── Test state ───────────────────────────────────────────────────────────────
let totalPass = 0, totalFail = 0;
const failLog = [];
const consoleErrors = [];
/** Per-screen sweep results, summarised as two checks at the end. */
const sweeps = [];

function check(label, cond, detail = '') {
  if (cond) {
    totalPass++;
    console.log(`  ${PASS} ${label}`);
  } else {
    totalFail++;
    const msg = `${label}${detail ? ' — ' + detail : ''}`;
    failLog.push(msg);
    console.log(`  ${FAIL} ${msg}`);
  }
}

function info(msg) { console.log(`  ${INFO} ${msg}`); }
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Puppeteer helpers ────────────────────────────────────────────────────────
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(E2E_DIR, `portal-${name}.png`), fullPage: false });
}

/** React's controlled inputs ignore a plain `.value =`; go through the native
 *  setter and fire the events React listens for (same idiom e2e-test.mjs uses). */
async function setInput(page, selector, value) {
  const handle = await page.waitForSelector(selector, { timeout: 15000 });
  await handle.evaluate((el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

/** Click the one control whose text matches — buttons and links alike, so a
 *  `<Link className="btn">` is reachable by the words on it, like a person. */
async function clickByText(page, selector, pattern) {
  const clicked = await page.evaluate((sel, pat) => {
    const re = new RegExp(pat, 'i');
    const el = [...document.querySelectorAll(sel)].find((e) => re.test(e.textContent || ''));
    if (!el || el.disabled) return false;
    el.click();
    return true;
  }, selector, pattern.source ?? pattern);
  if (!clicked) throw new Error(`no enabled "${pattern}" in ${selector}`);
  return clicked;
}

async function textOf(page, selector) {
  return page.$eval(selector, (el) => el.textContent.trim()).catch(() => null);
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

/** SyncProvider's guest-import prompt (spec §3.2) is a fixed-position box that
 *  appears the first time a signed-in visitor reaches the IDE with local guest
 *  projects. Declining it is what a student with nothing to import does, and
 *  it keeps the box from sitting over anything this run clicks next. */
async function dismissGuestImport(page) {
  const dismissed = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.guest-import button')]
      .find((b) => /not now/i.test(b.textContent));
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (dismissed) await delay(400);
  return dismissed;
}

function attachConsoleCapture(page, who) {
  /* Same ignore list as the IDE suite, plus the dev-server noise a portal run
     adds: a signed-out /api/auth/me is a 401 by design, and Vite's HMR client
     chatters over a websocket. */
  const IGNORABLE = /favicon|ResizeObserver|Warning:|Download the React|ReactDOM\.render|Failed to load resource|\[vite\]|net::ERR_ABORTED/i;
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !IGNORABLE.test(msg.text())) {
      consoleErrors.push(`${who}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    if (!IGNORABLE.test(err.message)) consoleErrors.push(`${who} PAGE: ${err.message}`);
  });
}

// ─── The stylesheet-harvest sweep (Task 13's idea, run per screen) ───────────
/**
 * Harvest every class name any loaded stylesheet rule mentions, then walk the
 * live DOM and report class tokens with no rule behind them. Third-party
 * render hosts (Blockly, Monaco, TipTap's ProseMirror, KaTeX) generate their
 * own class vocabulary from their own bundled CSS or from none at all, so
 * their subtrees are skipped — this sweep is about the product's own markup.
 */
async function sweepScreen(page, screen) {
  const result = await page.evaluate(() => {
    const styled = new Set();
    const visit = (rules) => {
      for (const rule of rules) {
        if (rule.selectorText) {
          for (const m of rule.selectorText.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) styled.add(m[1]);
        }
        if (rule.cssRules) visit(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try { visit(sheet.cssRules); } catch { /* cross-origin sheet — not ours */ }
    }

    /* Third-party render targets: their class vocabulary is generated by the
       library (and styled from the library's own CSS, or not at all), so the
       host element AND its subtree are outside this sweep's remit. */
    const SKIP_HOSTS = '.blockly-host, .blocklyWidgetDiv, .blocklyTooltipDiv, .monaco-editor, .ProseMirror, .katex';
    const skipRoots = [...document.querySelectorAll(SKIP_HOSTS)];
    const insideSkipped = (el) => skipRoots.some((r) => r.contains(el));
    const IGNORE = [/^blockly/i, /^monaco/i, /^mtk/, /^ProseMirror/, /^katex/, /^codicon/, /^tippy/];

    const ruleless = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (insideSkipped(el)) continue;
      for (const cls of el.classList) {
        if (styled.has(cls)) continue;
        if (IGNORE.some((re) => re.test(cls))) continue;
        ruleless.add(cls);
      }
    }
    return {
      ruleless: [...ruleless].sort(),
      welcomeBtns: document.querySelectorAll('.welcome-btn, [class*="welcome-btn"]').length,
      styledCount: styled.size,
    };
  });
  sweeps.push({ screen, ...result });
  if (result.styledCount < 50) info(`sweep "${screen}": only ${result.styledCount} styled classes harvested`);
  if (result.ruleless.length > 0) info(`sweep "${screen}": rule-less → ${result.ruleless.join(', ')}`);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

/* Two contexts, not two pages: a shared context shares one cookie jar, and
   the teacher's session would sign the student out (and vice versa) on every
   swap. This is genuinely two browsers. */
const teacherCtx = await browser.createBrowserContext();
const studentCtx = await browser.createBrowserContext();
const teacher = await teacherCtx.newPage();
const student = await studentCtx.newPage();
await teacher.setViewport({ width: 1440, height: 900 });
await student.setViewport({ width: 1440, height: 900 });
attachConsoleCapture(teacher, 'teacher');
attachConsoleCapture(student, 'student');

let classId = null;
let assignmentId = null;
let joinCode = null;
let studentFingerprint = null;

try {
  // ── 1: Teacher signs in ────────────────────────────────────────────────────
  console.log('\n═══ 1: Teacher signs in ═════════════════════════════════════════════');
  await teacher.goto(`${BASE}/auth/signin`, { waitUntil: 'networkidle0', timeout: 30000 });
  await setInput(teacher, 'input[type="email"]', ADMIN_EMAIL);
  await setInput(teacher, 'input[type="password"]', ADMIN_PASSWORD);
  await clickByText(teacher, 'button', /^sign in$/);
  const signedIn = await teacher
    .waitForFunction(() => location.pathname === '/', { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check('Teacher signs in and Sign in lands on the IDE at "/"', signedIn,
    signedIn ? '' : `still at ${teacher.url()}`);
  await delay(1500);
  await dismissGuestImport(teacher);

  await teacher.goto(`${BASE}/classes`, { waitUntil: 'networkidle0', timeout: 30000 });
  await teacher.waitForSelector('.page-header__title', { timeout: 15000 });
  check('/classes renders the class wall for the teacher',
    (await textOf(teacher, '.page-header__title')) === 'My classes');
  await sweepScreen(teacher, 'teacher /classes');
  await screenshot(teacher, '01-teacher-classes');

  // ── 2: Create a class ──────────────────────────────────────────────────────
  console.log('\n═══ 2: Teacher creates a class ══════════════════════════════════════');
  await clickByText(teacher, '.classes-actions .btn', /new class/);
  await teacher.waitForSelector('form.auth-form .input', { timeout: 15000 });
  await setInput(teacher, 'form.auth-form .input', CLASS_NAME);
  await clickByText(teacher, 'form.auth-form button[type="submit"]', /create class/);
  const landedOnClass = await teacher
    .waitForFunction(() => /^\/classes\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  classId = teacher.url().split('/classes/')[1];
  check('New class created and its page opens', landedOnClass && !!classId, teacher.url());
  await teacher.waitForSelector('.page-header__title', { timeout: 15000 });
  check('The class page is titled with the new class name',
    (await textOf(teacher, '.page-header__title'))?.includes(CLASS_NAME));
  await sweepScreen(teacher, 'class page (assignments tab)');
  await screenshot(teacher, '02-class-created');

  // The join code, read where a teacher reads it — the People tab.
  await teacher.goto(`${BASE}/classes/${classId}/people`, { waitUntil: 'networkidle0', timeout: 30000 });
  await teacher.waitForSelector('.join-code-big', { timeout: 15000 });
  joinCode = await textOf(teacher, '.join-code-big');
  check('People tab shows a well-formed class join code', /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(joinCode ?? ''), String(joinCode));
  await sweepScreen(teacher, 'class People tab');

  // ── 3: Author the assignment ───────────────────────────────────────────────
  console.log('\n═══ 3: Teacher authors and publishes an assignment ══════════════════');
  await teacher.goto(`${BASE}/classes/${classId}/assignments/new`, { waitUntil: 'networkidle0', timeout: 30000 });
  await teacher.waitForSelector('input[name="title"]', { timeout: 15000 });
  await setInput(teacher, 'input[name="title"]', ASSIGNMENT_TITLE);
  await setInput(teacher, 'input[name="points"]', String(POINTS));
  // The TipTap editor is behind a lazy boundary — wait for the real thing,
  // then type into it exactly as a teacher would.
  await teacher.waitForSelector('.rich-text-editor .ProseMirror', { timeout: 20000 });
  await teacher.click('.rich-text-editor .ProseMirror');
  await teacher.keyboard.type(INSTRUCTIONS_PARAGRAPH, { delay: 4 });
  await delay(300);
  check('Instructions editor holds the typed paragraph',
    (await textOf(teacher, '.rich-text-editor .ProseMirror'))?.includes('bounces'));
  check('Rules picker starts on Standard classwork',
    (await textOf(teacher, '.rules-picker .auth-door--on'))?.includes('Standard classwork'));
  await sweepScreen(teacher, 'assignment editor (new)');
  await screenshot(teacher, '03-assignment-editor');

  await clickByText(teacher, '.assignments-actions button[type="submit"]', /^save$/);
  await teacher.waitForFunction(
    () => /^\/classes\/[0-9a-f-]{36}$/.test(location.pathname),
    { timeout: 20000 },
  );
  await teacher.waitForSelector('.assignment-list .assignment-row', { timeout: 15000 });
  const draftBadge = await teacher.$eval('.assignment-list .assignment-row .badge', (el) => el.textContent.trim());
  check('A saved-but-unpublished assignment lists as a draft', draftBadge === 'draft', draftBadge);

  await clickByText(teacher, '.assignment-list .assignment-row', new RegExp(RUN));
  await teacher.waitForFunction(
    () => /^\/classes\/[0-9a-f-]{36}\/assignments\/[0-9a-f-]{36}$/.test(location.pathname),
    { timeout: 20000 },
  );
  assignmentId = teacher.url().split('/assignments/')[1];
  await teacher.waitForSelector('.assignments-actions a.btn', { timeout: 20000 });
  await clickByText(teacher, '.assignments-actions a.btn', /^edit$/);
  await teacher.waitForSelector('input[name="title"]', { timeout: 20000 });
  await teacher.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => /^publish$/i.test(b.textContent.trim())),
    { timeout: 20000 },
  );
  check('The draft carries the publish consequence line, verbatim',
    (await bodyText(teacher)).includes('Students in this class will see it immediately.'));

  await clickByText(teacher, '.assignments-actions button', /^publish$/);
  const published = await teacher
    .waitForFunction(
      () => [...document.querySelectorAll('button')].some((b) => /close now/i.test(b.textContent)),
      { timeout: 20000 },
    )
    .then(() => true)
    .catch(() => false);
  check('Publish steps the assignment out of draft (Close now replaces Publish)', published);
  await screenshot(teacher, '04-published');

  await teacher.goto(`${BASE}/classes/${classId}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await teacher.waitForSelector('.assignment-list .assignment-row .badge', { timeout: 15000 });
  const openBadge = await teacher.$eval('.assignment-list .assignment-row .badge', (el) => el.textContent.trim());
  check('The published assignment reads "open" in the class list', openBadge === 'open', openBadge);

  // ── 4: Student signs up (API) and confirms through the pretend inbox ───────
  console.log('\n═══ 4: Student signs up and confirms through the pretend inbox ══════');
  await student.goto(`${BASE}/auth/signup`, { waitUntil: 'networkidle0', timeout: 30000 });
  const signup = await student.evaluate(async (body) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  }, { name: STUDENT_NAME, email: STUDENT_EMAIL, password: STUDENT_PASSWORD, wantsTeacher: false, consent: true });
  check('POST /api/auth/signup creates the student account', signup.status === 201,
    `${signup.status} ${JSON.stringify(signup.data)}`);

  // Read the inbox the way the admin Emails tab does.
  const inbox = await teacher.evaluate(async () => {
    const res = await fetch('/api/admin/emails?limit=50');
    return res.ok ? res.json() : { emails: [] };
  });
  const confirmMail = (inbox.emails ?? []).find(
    (e) => e.toEmail === STUDENT_EMAIL && e.template === 'confirm',
  );
  const confirmLink = confirmMail?.bodyText?.match(/https?:\/\/\S+\/auth\/confirm\?token=[A-Za-z0-9_-]+/)?.[0] ?? null;
  check('The pretend inbox carries the student\'s confirmation email and its link',
    !!confirmMail && !!confirmLink, confirmMail ? String(confirmLink) : 'no confirm mail for the student');

  /* The link is minted against APP_BASE_URL (127.0.0.1 in dev) while this run
     drives localhost. Same server, different spelling of the loopback — keep
     the run on one origin so one cookie jar holds the whole session. */
  const confirmUrl = confirmLink ? BASE + new URL(confirmLink).pathname + new URL(confirmLink).search : null;
  await student.goto(confirmUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  await delay(600);
  check('Opening the emailed link confirms the address',
    (await bodyText(student)).includes('Your email address is confirmed.'));
  await sweepScreen(student, '/auth/confirm');

  // ── 5: Student signs in and joins by code ─────────────────────────────────
  console.log('\n═══ 5: Student signs in and joins by class code ═════════════════════');
  await student.goto(`${BASE}/auth/signin`, { waitUntil: 'networkidle0', timeout: 30000 });
  await setInput(student, 'input[type="email"]', STUDENT_EMAIL);
  await setInput(student, 'input[type="password"]', STUDENT_PASSWORD);
  await clickByText(student, 'button', /^sign in$/);
  await student.waitForFunction(() => location.pathname === '/', { timeout: 25000 });
  await delay(1500);
  await dismissGuestImport(student);

  await student.goto(`${BASE}/join`, { waitUntil: 'networkidle0', timeout: 30000 });
  await setInput(student, '.auth-form .input', joinCode);
  await clickByText(student, '.auth-form button[type="submit"]', /^join$/);
  const joined = await student
    .waitForFunction(
      (name) => (document.querySelector('p.auth-text[role="status"]')?.textContent ?? '').includes(`You're in ${name}!`),
      { timeout: 20000 },
      CLASS_NAME,
    )
    .then(() => true)
    .catch(() => false);
  check('Joining by code says which class, by name', joined,
    joined ? '' : (await textOf(student, 'p.auth-text[role="status"]')) ?? 'no status line');
  await screenshot(student, '05-joined');
  await student.waitForFunction(
    () => /^\/classes\/[0-9a-f-]{36}$/.test(location.pathname),
    { timeout: 20000 },
  );

  // ── 6: Student opens the assignment and starts work ───────────────────────
  console.log('\n═══ 6: Student opens the assignment and starts work ═════════════════');
  await student.waitForSelector('.assignment-list .assignment-row', { timeout: 20000 });
  await clickByText(student, '.assignment-list .assignment-row', new RegExp(RUN));
  await student.waitForSelector('.assignment-page-header h2', { timeout: 20000 });
  check('The student\'s assignment page shows the title and the open badge',
    (await textOf(student, '.assignment-page-header h2')) === ASSIGNMENT_TITLE &&
      (await textOf(student, '.assignment-page-header .badge')) === 'open');
  check('The instructions the teacher typed reach the student',
    (await bodyText(student)).includes(INSTRUCTIONS_PARAGRAPH));
  check('The one big button offers Start work',
    (await textOf(student, '.assignments-actions .btn--primary')) === 'Start work');
  await sweepScreen(student, 'student assignment page');
  await screenshot(student, '06-student-assignment');

  await clickByText(student, '.assignments-actions button', /^start work$/);
  let started = await student
    .waitForFunction(() => location.pathname === '/', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  const startRefusal = started ? null : await textOf(student, '.page-body .alert--danger');
  check('Start work is accepted the first time it is pressed', started,
    startRefusal ?? 'no navigation and no refusal shown');
  if (!started) {
    info('Pressing Start work again (startWork.js is retry-safe by design) so the rest of the golden flow can be driven — the check above stands failed.');
    await clickByText(student, '.assignments-actions button', /^start work$/);
    started = await student
      .waitForFunction(() => location.pathname === '/', { timeout: 25000 })
      .then(() => true)
      .catch(() => false);
    if (!started) throw new Error(`Start work refused twice: ${await textOf(student, '.page-body .alert--danger')}`);
  }
  const briefShown = await student
    .waitForSelector('.brief-pane', { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  /* Spec §6.2: Start work opens the work. startWork.js stamps
     LAST_PROJECT_KEY and calls navigate("/") — a client-side transition,
     while ProjectContext only reads that key in its once-per-app-load
     bootstrap. This check asserts the promise, not the mechanism. */
  check('Start work lands the student IN their assignment work, not back at the start menu', briefShown,
    briefShown ? '' : `at ${student.url()}, start menu: ${(await student.$('.start-menu-overlay')) !== null}`);
  if (!briefShown) {
    info('Reloading "/" so the rest of the golden flow can still be driven — the check above stands failed.');
    await student.reload({ waitUntil: 'networkidle0', timeout: 30000 });
    await student.waitForSelector('.brief-pane', { timeout: 30000 });
    await dismissGuestImport(student);
  }
  await student.waitForSelector('.brief-pane .pane-header--brief', { timeout: 15000 });
  check('The brief pane is headed by the assignment title',
    (await textOf(student, '.brief-pane .pane-header__title'))?.includes(ASSIGNMENT_TITLE));
  check('The brief pane carries the instructions, not just the title',
    (await textOf(student, '.brief-pane__body'))?.includes(INSTRUCTIONS_PARAGRAPH));
  await student.waitForSelector('.rules-chip', { timeout: 15000 });
  check('The rules chip names exactly what standard classwork switches off',
    (await textOf(student, '.rules-chip')) === EXPECTED_RULES_SENTENCE,
    String(await textOf(student, '.rules-chip')));
  await sweepScreen(student, 'IDE in assignment work');
  await screenshot(student, '07-ide-brief-dark');

  // Both themes where it matters: the assignment chrome inside the IDE.
  await student.click('.tb-btn--theme');
  await delay(500);
  const ideLight = await student.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await screenshot(student, '08-ide-brief-light');
  check('The IDE theme toggle repaints the assignment chrome in light mode', ideLight === 'light', String(ideLight));
  await student.click('.tb-btn--theme');
  await delay(500);

  // ── 7: The edit, and the submit that carries it ───────────────────────────
  console.log('\n═══ 7: The student edits the workspace and submits ══════════════════');
  const blocksBefore = await student.$$eval('.blockly-host svg .blocklyDraggable', (els) => els.length);
  await student.click('.block-search-input');
  await student.type('.block-search-input', 'sphere', { delay: 20 });
  await student.waitForSelector('.block-search-item', { timeout: 10000 });
  await student.click('.block-search-item');
  await delay(1200);
  const blocksAfter = await student.$$eval('.blockly-host svg .blocklyDraggable', (els) => els.length);
  check('Inserting a block from the search really changes the workspace',
    blocksAfter > blocksBefore, `${blocksBefore} → ${blocksAfter}`);
  // MANIFEST_AUTOSAVE_MS is 3000: let the edit reach the manifest before the
  // submit pushes it, exactly as a student pausing to press Submit would.
  await delay(4500);

  await clickByText(student, '.brief-pane__footer button', /^submit$/);
  const submitted = await student
    .waitForSelector('.brief-pane__footer .alert--success', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  const submitText = await textOf(student, '.brief-pane__footer .alert--success');
  const submitMatch = (submitText ?? '').match(/attempt (\d+)\. Fingerprint ([0-9a-f]{8})\./);
  studentFingerprint = submitMatch?.[2] ?? null;
  check('Submit from the brief pane reports attempt 1 and a fingerprint',
    submitted && submitMatch?.[1] === '1' && !!studentFingerprint, String(submitText));
  await screenshot(student, '09-submitted');

  // ── 8: The teacher's inbox ────────────────────────────────────────────────
  console.log('\n═══ 8: The teacher\'s inbox ═════════════════════════════════════════');
  await teacher.goto(`${BASE}/classes/${classId}/assignments/${assignmentId}/inbox`, {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });
  await teacher.waitForSelector('.inbox-progress-line', { timeout: 20000 });
  check('The inbox reads 1 of 1 submitted',
    (await textOf(teacher, '.inbox-progress-line')) === '1 of 1 submitted',
    String(await textOf(teacher, '.inbox-progress-line')));
  const inboxRow = await teacher.$eval('.admin-table tbody tr', (tr) => tr.innerText.replace(/\s+/g, ' '));
  check('The roster row is the student, badged submitted',
    inboxRow.includes(STUDENT_NAME) && inboxRow.includes('submitted'), inboxRow);
  await sweepScreen(teacher, 'submissions inbox');
  await screenshot(teacher, '10-inbox');

  // ── 9: The marking room ───────────────────────────────────────────────────
  console.log('\n═══ 9: The marking room ════════════════════════════════════════════');
  await teacher.click('.admin-table tbody a');
  await teacher.waitForSelector('.marking-room__fingerprint', { timeout: 25000 });
  const roomFingerprint = await textOf(teacher, '.marking-room__fingerprint');
  check('The marking room shows the same submission the student just made',
    !!studentFingerprint && roomFingerprint?.startsWith(studentFingerprint),
    `room ${roomFingerprint} vs student ${studentFingerprint}`);
  /* A read-only Blockly workspace renders blocks without `.blocklyDraggable`,
     so read the rendered block labels instead — and assert the one the
     student actually inserted is among them: that proves the snapshot is the
     edited workspace, not an empty starting point. */
  await teacher
    .waitForFunction(
      () => document.querySelectorAll('.submission-viewer__pane svg text').length > 0,
      { timeout: 25000 },
    )
    .catch(() => {});
  const snapshotLabels = await teacher.$$eval('.submission-viewer__pane svg text', (els) =>
    els.map((e) => e.textContent.trim()).filter(Boolean),
  );
  check('The read-only viewer renders the submitted blocks, the student\'s new one included',
    snapshotLabels.some((t) => /sphere/i.test(t)), snapshotLabels.slice(0, 8).join(' | '));
  const historyCount = await teacher.$$eval('.marking-room__history .history-checkpoint', (els) => els.length);
  check('The History panel lists the checkpoints behind the submission', historyCount > 0, `${historyCount} entries`);
  await sweepScreen(teacher, 'marking room');
  await screenshot(teacher, '11-marking-room');

  // ── 10: Mark, then release ────────────────────────────────────────────────
  console.log('\n═══ 10: Save a mark, then release it ═══════════════════════════════');
  await setInput(teacher, '.marking-panel__field input[type="number"]', String(AWARDED));
  await setInput(teacher, '.marking-panel__field textarea', MARK_COMMENT);
  await clickByText(teacher, '.marking-panel .assignments-actions button', /save draft/);
  const savedDraft = await teacher
    .waitForFunction(() => document.querySelector('.marking-panel')?.innerText.includes('Draft saved.'), { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check('Save draft is acknowledged in the panel', savedDraft);
  await clickByText(teacher, '.marking-panel .assignments-actions button', /^release$/);
  const released = await teacher
    .waitForFunction(() => document.querySelector('.marking-panel')?.innerText.includes('Released.'), { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check('Release is acknowledged in the panel', released);
  await screenshot(teacher, '12-marked-and-released');

  // ── 11: The gradebook ─────────────────────────────────────────────────────
  console.log('\n═══ 11: The gradebook ══════════════════════════════════════════════');
  await teacher.goto(`${BASE}/classes/${classId}/gradebook`, { waitUntil: 'networkidle0', timeout: 30000 });
  await teacher.waitForSelector('.admin-table tbody tr', { timeout: 20000 });
  const header = await teacher.$eval('.admin-table thead', (el) => el.innerText.replace(/\s+/g, ' '));
  const row = await teacher.$eval('.admin-table tbody tr', (el) => el.innerText.replace(/\s+/g, ' '));
  check('The gradebook column is the assignment, out of its points',
    header.includes(ASSIGNMENT_TITLE) && header.includes(`(/${POINTS})`), header);
  check('The released mark shows in the student\'s row, with no draft flag',
    row.includes(STUDENT_NAME) && row.includes(String(AWARDED)) && !row.includes('draft'), row);
  await sweepScreen(teacher, 'gradebook');
  await screenshot(teacher, '13-gradebook');

  // ── 12: What the student sees back ────────────────────────────────────────
  console.log('\n═══ 12: The student reads the feedback ═════════════════════════════');
  await student.goto(`${BASE}/classes`, { waitUntil: 'networkidle0', timeout: 30000 });
  await student.waitForSelector('.home-strip', { timeout: 20000 });
  const strip = await student.$eval('.home-strip', (el) => el.innerText.replace(/\s+/g, ' '));
  check('The Home strip carries the recent feedback',
    strip.includes('Recent feedback') && strip.includes(ASSIGNMENT_TITLE), strip.slice(0, 160));
  await sweepScreen(student, 'student /classes with the Home strip');

  // The portal in light mode — the same toggle, on the other side of the app.
  await student.click('.page-header__bar .tb-btn--theme');
  await delay(500);
  const portalLight = await student.evaluate(() => document.documentElement.getAttribute('data-theme'));
  check('The portal header\'s theme toggle repaints the portal in light mode',
    portalLight === 'light', String(portalLight));
  await sweepScreen(student, 'student /classes (light)');
  await screenshot(student, '14-student-home-light');
  await student.click('.page-header__bar .tb-btn--theme');
  await delay(500);

  await student.goto(`${BASE}/classes/${classId}/assignments/${assignmentId}`, {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });
  await student.waitForSelector('.assignment-page-header h2', { timeout: 20000 });
  const studentPage = await bodyText(student);
  check('The assignment page shows the released score and the comment',
    studentPage.includes(`Score: ${AWARDED}/${POINTS}`) && studentPage.includes(MARK_COMMENT),
    studentPage.slice(0, 200).replace(/\s+/g, ' '));
  await sweepScreen(student, 'student assignment page (marked)');
  await screenshot(student, '15-student-feedback');
} catch (err) {
  check('The golden flow runs to the end without throwing', false, err.message);
  await screenshot(teacher, 'zz-teacher-at-failure').catch(() => {});
  await screenshot(student, 'zz-student-at-failure').catch(() => {});
}

// ── 13: The sweeps, summarised ──────────────────────────────────────────────
console.log('\n═══ 13: Design-system sweeps across every screen visited ════════════');
const ghosts = sweeps.filter((s) => s.welcomeBtns > 0);
check('No .welcome-btn ghosts on any screen this run touched',
  ghosts.length === 0,
  ghosts.map((s) => `${s.screen}:${s.welcomeBtns}`).join(', '));

const ruleless = sweeps.filter((s) => s.ruleless.length > 0);
const rulelessNames = [...new Set(ruleless.flatMap((s) => s.ruleless))].sort();
check('No rule-less classes on the screens this plan shipped',
  ruleless.length === 0,
  rulelessNames.map((n) => `.${n} (${ruleless.filter((s) => s.ruleless.includes(n)).map((s) => s.screen).join(' / ')})`).join('; '));
info(`${sweeps.length} screen sweeps run`);

console.log('\n═══ FINAL: Console error audit ══════════════════════════════════════');
check('Zero JS console errors across the whole run', consoleErrors.length === 0,
  consoleErrors.length > 0 ? `${consoleErrors.length} — first: ${consoleErrors[0]?.slice(0, 200)}` : '');
consoleErrors.slice(0, 5).forEach((e, i) => info(`Error ${i + 1}: ${e.slice(0, 200)}`));

// ─── Summary ────────────────────────────────────────────────────────────────
await browser.close();

console.log('\n' + '═'.repeat(70));
console.log(`${C.pass}PASS${C.reset}: ${totalPass}  ${C.fail}FAIL${C.reset}: ${totalFail}  Total: ${totalPass + totalFail}`);
if (failLog.length > 0) {
  console.log(`\n${C.fail}Failed checks:${C.reset}`);
  failLog.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}

fs.writeFileSync(
  path.join(E2E_DIR, 'portal-results.json'),
  JSON.stringify(
    { pass: totalPass, fail: totalFail, failures: failLog, sweeps, consoleErrors, run: RUN, timestamp: new Date().toISOString() },
    null,
    2,
  ),
);

console.log(`\nScreenshots saved to: ${E2E_DIR} (portal-*.png)`);
console.log(`Results JSON: ${path.join(E2E_DIR, 'portal-results.json')}`);

process.exit(totalFail > 0 ? 1 : 0);
