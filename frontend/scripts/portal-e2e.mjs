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
 *   5. Peer sharing (Plan 7): the teacher flips Sharing rules On; a second
 *      student (B) signs up, confirms and joins the same way the first did;
 *      student A — offered no Share… inside rule-bound assignment work —
 *      makes a project of their own, shares it with B through File →
 *      Share…, and B adds it to their projects and lands in the IDE with
 *      the credit chip on it. Three browser contexts, three cookie jars.
 *   6. Notifications and data care (Plan 8): the teacher publishes a SECOND
 *      assignment and student A's bell grows an unread badge, whose newest
 *      row is the renderer's own sentence; opening the bell marks it read
 *      and the badge stays gone across a reload. A switches Due-tomorrow
 *      reminders off on /profile and the switch holds across a reload. A
 *      second, still-pending share gives `Waiting on them` something to
 *      show, and Revoke takes it off BOTH people's pages. Finally a
 *      throwaway student — signed up, confirmed and signed in for the
 *      purpose — is exported and then erased from the admin console's Data
 *      requests tab, the People tab reads `erased`, and their old email no
 *      longer opens the door. Four browser contexts, four cookie jars.
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

/* Plan 7 (peer sharing): a SECOND student, signed up the same way the first
   was, so the share has a real classmate to land on. Student A shares, B
   receives — two more cookie jars than the assignments flow needed. */
const STUDENT_B_NAME = `E2E Peer ${RUN}`;
const STUDENT_B_EMAIL = `e2e.peer.${RUN}@example.test`;
/* A share is a copy-out, so the assignment work itself refuses to be shared
   (standard_classwork switches export & copy off). The student makes an
   ordinary project of their own to share — through the start menu's wizard,
   the way any student would — and this is what it is called. */
const PERSONAL_TITLE = `Peer project ${RUN}`;

/* standard_classwork (shared/src/workspaceRules.ts) switches off import,
   export & copy and templates, and RulesChip renders them in the shared
   schema's own field order. This is the sentence a student must read. */
const EXPECTED_RULES_SENTENCE = 'Your teacher has turned off: import, export & copy, templates';

/* Plan 7's two verbatim sentences, said in the product's own words:
   ShareDialog's HANDOFF_SENTENCE (design D§8 — revocation policy stated at
   the point of use) and attributionSentence() (spec §8.1 — the credit that
   travels with the copy). Both are asserted character for character. */
const HANDOFF_SENTENCE = "Once they add it, it's theirs — you can't take it back.";
const ATTRIBUTION_SENTENCE = `Based on work shared by ${STUDENT_NAME}`;

/* Plan 8 (notifications + data care). The SECOND assignment exists to make
   one new unread notification land in a bell whose earlier rows the run has
   already read — a badge that reads exactly "1" is evidence; a badge that
   merely exists is not. */
const ASSIGNMENT_TITLE_2 = `Rolling ball ${RUN}`;
/* notifications.ts's `assignment.published` sentence, character for
   character — curly quotes and all. The renderer is the one source of these
   words and this is the assertion that keeps it honest. */
const BELL_PUBLISHED_SENTENCE = `New assignment in ${CLASS_NAME}: “${ASSIGNMENT_TITLE_2}”`;
/* SWITCHABLE_EMAIL_KEYS (shared/src/notifications.ts) is the order the five
   .pref-row switches render in; index 3 is `due-tomorrow`, and ProfilePage's
   PREF_LABELS gives it this label. Both are asserted, so a reorder or a
   relabel is a failure here rather than a silent drift. */
const DUE_TOMORROW_INDEX = 3;
const DUE_TOMORROW_LABEL = 'Due-tomorrow reminders';

/* The throwaway. A person who exists only to be exported and then erased —
   never a member of the class, so the erase cannot disturb anything the rest
   of the flow asserts. */
const THROWAWAY_NAME = `E2E Throwaway ${RUN}`;
const THROWAWAY_EMAIL = `e2e.throwaway.${RUN}@example.test`;
/* DataRequestsTab's resting copy and its consequence sentence, both verbatim
   (the component exports the second as ERASE_SENTENCE). */
const DATA_REQUESTS_RESTING = 'Search for a person to export or erase their data.';
/* auth.ts's signin refusal for an email that does not resolve. After the
   scrub the account's email is `erased+<id>@erased.invalid`, so the old
   address hits the UNKNOWN-EMAIL door, not the deactivated one — the
   account is not disabled, it is gone. */
const SIGNIN_REFUSED = 'Invalid email or password.';

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

/** Open the IDE header's File menu and return the labels it offers. The
 *  menu's own contents are the assertion in two places (Share… absent inside
 *  locked assignment work, present on the student's own project), so reading
 *  them is a first-class step rather than a click helper. */
async function openFileMenu(page) {
  await page.waitForSelector('button[title="File — import and export"]', { timeout: 20000 });
  await page.click('button[title="File — import and export"]');
  await page.waitForSelector('.tb-dropdown-menu', { timeout: 10000 });
  return page.$$eval('.tb-dropdown-menu .tb-dropdown-item', (els) =>
    els.map((e) => e.textContent.trim()),
  );
}

/** Wait until a project id that was not on the server before appears there —
 *  the sync engine's adopt-and-push, OBSERVED rather than assumed. A share
 *  names a project the server must already own (`shares.ts`'s NO_SUCH_PROJECT
 *  refusal), so this is the precondition, not a convenience. */
async function waitForPushedProject(page, known) {
  const handle = await page
    .waitForFunction(
      async (before) => {
        const res = await fetch('/api/projects');
        if (!res.ok) return false;
        const data = await res.json();
        const fresh = (data.projects ?? []).map((p) => p.id).filter((id) => !before.includes(id));
        return fresh[0] ?? false;
      },
      { timeout: 45000, polling: 1500 },
      known,
    )
    .catch(() => null);
  return handle ? handle.jsonValue() : null;
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
/* Plan 7: student B receives the share. Same reasoning as the pair above —
   a share that both people drive from one cookie jar proves nothing. */
const studentBCtx = await browser.createBrowserContext();
/* Plan 8: the throwaway who gets erased. Its own jar because the erase
   destroys every session it holds — sharing a jar would sign someone else
   out mid-flow, and the closed-door check needs a browser that still
   remembers nothing but the old password. */
const throwawayCtx = await browser.createBrowserContext();
const teacher = await teacherCtx.newPage();
const student = await studentCtx.newPage();
const studentB = await studentBCtx.newPage();
const throwaway = await throwawayCtx.newPage();
await teacher.setViewport({ width: 1440, height: 900 });
await student.setViewport({ width: 1440, height: 900 });
await studentB.setViewport({ width: 1440, height: 900 });
await throwaway.setViewport({ width: 1440, height: 900 });
attachConsoleCapture(teacher, 'teacher');
attachConsoleCapture(student, 'student');
attachConsoleCapture(studentB, 'student B');
attachConsoleCapture(throwaway, 'throwaway');

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

  // ── 13: The teacher opens the sharing door; a second student arrives ──────
  console.log('\n═══ 13: Sharing rules On, and a second student joins ════════════════');
  await teacher.goto(`${BASE}/classes/${classId}/settings`, { waitUntil: 'networkidle0', timeout: 30000 });
  await teacher.waitForSelector('input[name="peerSharing"]', { timeout: 20000 });
  /* Off by default (D§5.1's fail-closed switch) — assert that BEFORE pressing
     On, or "it is on" proves nothing about what the teacher did. */
  const doorsBefore = await teacher.$$eval('input[name="peerSharing"]', (els) => els.map((e) => e.checked));
  await teacher.evaluate(() => document.querySelectorAll('input[name="peerSharing"]')[1].click());
  /* The door is painted from the SAVED class, not from the click: waiting for
     `auth-door--on` waits for the PATCH and the refetch behind it, which is
     what makes this a round-trip assertion rather than a DOM one. */
  const sharingOn = await teacher
    .waitForFunction(
      () => {
        const inputs = document.querySelectorAll('input[name="peerSharing"]');
        return (
          inputs.length === 2 &&
          inputs[1].checked &&
          inputs[1].closest('label')?.classList.contains('auth-door--on') === true
        );
      },
      { timeout: 20000 },
    )
    .then(() => true)
    .catch(() => false);
  check('Class Settings starts with sharing Off and the door flips to On when the teacher presses it',
    doorsBefore.length === 2 && doorsBefore[0] === true && doorsBefore[1] === false && sharingOn,
    `doors before ${JSON.stringify(doorsBefore)}, flipped ${sharingOn}`);
  await sweepScreen(teacher, 'class Settings tab (sharing on)');

  // Student B — signed up, confirmed and joined exactly as student A was.
  await studentB.goto(`${BASE}/auth/signup`, { waitUntil: 'networkidle0', timeout: 30000 });
  const signupB = await studentB.evaluate(async (body) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  }, { name: STUDENT_B_NAME, email: STUDENT_B_EMAIL, password: STUDENT_PASSWORD, wantsTeacher: false, consent: true });
  const inboxB = await teacher.evaluate(async () => {
    const res = await fetch('/api/admin/emails?limit=100');
    return res.ok ? res.json() : { emails: [] };
  });
  const confirmMailB = (inboxB.emails ?? []).find(
    (e) => e.toEmail === STUDENT_B_EMAIL && e.template === 'confirm',
  );
  const confirmLinkB = confirmMailB?.bodyText?.match(/https?:\/\/\S+\/auth\/confirm\?token=[A-Za-z0-9_-]+/)?.[0] ?? null;
  if (confirmLinkB) {
    const linkB = new URL(confirmLinkB);
    await studentB.goto(BASE + linkB.pathname + linkB.search, { waitUntil: 'networkidle0', timeout: 30000 });
    await delay(600);
  }
  const confirmedB = !!confirmLinkB && (await bodyText(studentB)).includes('Your email address is confirmed.');
  check('A second student signs up and confirms through the pretend inbox',
    signupB.status === 201 && confirmedB,
    `signup ${signupB.status} ${JSON.stringify(signupB.data)}, confirm link ${String(confirmLinkB)}`);
  if (!confirmedB) throw new Error('student B could not be confirmed — the sharing flow has nobody to share with');

  await studentB.goto(`${BASE}/auth/signin`, { waitUntil: 'networkidle0', timeout: 30000 });
  await setInput(studentB, 'input[type="email"]', STUDENT_B_EMAIL);
  await setInput(studentB, 'input[type="password"]', STUDENT_PASSWORD);
  await clickByText(studentB, 'button', /^sign in$/);
  await studentB.waitForFunction(() => location.pathname === '/', { timeout: 25000 });
  await delay(1500);
  await dismissGuestImport(studentB);

  await studentB.goto(`${BASE}/join`, { waitUntil: 'networkidle0', timeout: 30000 });
  await setInput(studentB, '.auth-form .input', joinCode);
  await clickByText(studentB, '.auth-form button[type="submit"]', /^join$/);
  const joinedB = await studentB
    .waitForFunction(
      (name) => (document.querySelector('p.auth-text[role="status"]')?.textContent ?? '').includes(`You're in ${name}!`),
      { timeout: 20000 },
      CLASS_NAME,
    )
    .then(() => true)
    .catch(() => false);
  check('Student B joins the same class by code', joinedB,
    joinedB ? '' : (await textOf(studentB, 'p.auth-text[role="status"]')) ?? 'no status line');
  await studentB.waitForFunction(
    () => /^\/classes\/[0-9a-f-]{36}$/.test(location.pathname),
    { timeout: 20000 },
  );

  // ── 14: Share → accept → the credit that follows the copy ────────────────
  console.log('\n═══ 14: Share → accept → attribution ════════════════════════════════');
  await student.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 30000 });
  const backInIde = await student
    .waitForSelector('.app-header', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (!backInIde) {
    // The bootstrap restore did not reopen the assignment work — open it from
    // the library, the way a student would, rather than failing the segment.
    await student.waitForSelector('.start-menu-overlay .start-project-open', { timeout: 20000 });
    await student.click('.start-menu-overlay .start-project-open');
    await student.waitForSelector('.app-header', { timeout: 25000 });
  }
  await delay(1200);
  await dismissGuestImport(student);

  /* D§5.3/D§5.4: a share is a copy-out, so standard classwork's
     `exportAndCopy: false` hides Share… entirely — refused means ABSENT, not
     a greyed-out temptation. Reading the whole menu makes the negative
     assertion honest: an empty read would pass this vacuously. */
  const assignmentFileMenu = await openFileMenu(student);
  check('Inside standard-classwork assignment work the File menu offers no Share…',
    assignmentFileMenu.length > 0 && !assignmentFileMenu.some((t) => /^share/i.test(t)),
    assignmentFileMenu.join(' | '));
  await student.keyboard.press('Escape');
  await delay(300);

  // So the student has something of their own to share: a plain project, made
  // from the start menu the way any student makes one — a goal card creates
  // instantly now (the wizard is gone), and the title is set in the IDE
  // header, which is the same path a real student renames through.
  await student.click('.app-header__identity .tb-btn--nav');
  await student.waitForSelector('.start-menu-overlay .start-card--goal', { timeout: 20000 });
  const knownProjects = await student.evaluate(async () => {
    const res = await fetch('/api/projects');
    const data = res.ok ? await res.json() : { projects: [] };
    return (data.projects ?? []).map((p) => p.id);
  });
  await student.click('.start-grid .start-card--goal .start-card-main');
  await student.waitForSelector('.app-header', { timeout: 25000 });
  await student.waitForSelector('button.project-title', { timeout: 15000 });
  await student.click('button.project-title');
  await student.waitForSelector('input.project-title-input', { timeout: 8000 });
  await setInput(student, 'input.project-title-input', PERSONAL_TITLE);
  await student.keyboard.press('Enter');
  await delay(800);
  const personalId = await waitForPushedProject(student, knownProjects);
  const personalTitleShown = await textOf(student, '.status-bar__project');
  check('The student\'s own project is created from the start menu and reaches the server',
    !!personalId && personalTitleShown === PERSONAL_TITLE,
    `pushed ${String(personalId)}, status bar "${String(personalTitleShown)}"`);

  const personalFileMenu = await openFileMenu(student);
  check('File → Share… is offered on the student\'s own project, where no rule forbids a copy',
    personalFileMenu.some((t) => /^share/i.test(t)), personalFileMenu.join(' | '));
  await student.evaluate(() => {
    const item = [...document.querySelectorAll('.tb-dropdown-menu .tb-dropdown-item')]
      .find((b) => /^share/i.test(b.textContent.trim()));
    item?.click();
  });
  await student.waitForSelector('.share-dialog', { timeout: 15000 });
  await student.waitForSelector('.share-roster .auth-door', { timeout: 20000 });
  const roster = await student.$$eval('.share-roster .auth-door', (els) => els.map((e) => e.textContent.trim()));
  check('The dialog resolves the one class with sharing on and lists its roster, the sharer excluded',
    roster.includes(STUDENT_B_NAME) && !roster.includes(STUDENT_NAME), roster.join(' | '));
  const handoffNote = await textOf(student, '.share-dialog__note');
  check('The dialog says the consequence in the product\'s own words, verbatim',
    handoffNote === HANDOFF_SENTENCE, String(handoffNote));
  await sweepScreen(student, 'share dialog');
  await screenshot(student, '10-share-dialog');

  await student.evaluate((name) => {
    const label = [...document.querySelectorAll('.share-roster .auth-door')]
      .find((l) => l.textContent.trim() === name);
    label?.querySelector('input[type="radio"]')?.click();
  }, STUDENT_B_NAME);
  await student.waitForFunction(
    () => {
      const b = document.querySelector('.share-dialog__actions .btn--primary');
      return !!b && !b.disabled;
    },
    { timeout: 15000 },
  );
  await student.click('.share-dialog__actions .btn--primary');
  const shareDone = await student
    .waitForSelector('.share-dialog__done', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  const shareDoneText = await textOf(student, '.share-dialog__done');
  check('Share confirms by name and says where the copy waits',
    shareDone &&
      shareDoneText === `Shared with ${STUDENT_B_NAME}. It will wait on their class page until they add it.`,
    String(shareDoneText ?? (await textOf(student, '.share-dialog .alert--danger'))));
  await student.keyboard.press('Escape');
  await delay(400);

  /* D§6: the receive surface renders NOTHING when empty — the sharer has
     nothing pending, so their own class page must not grow a section. */
  await student.goto(`${BASE}/classes/${classId}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await student.waitForSelector('.page-header__title', { timeout: 20000 });
  await delay(1200);
  check('The sharer\'s own class page grows no "Shared with you" — nothing is pending for them',
    (await student.$('.shared-with-you')) === null);

  await studentB.goto(`${BASE}/classes/${classId}`, { waitUntil: 'networkidle0', timeout: 30000 });
  const sectionShown = await studentB
    .waitForSelector('.shared-with-you .share-row', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  const shareRow = sectionShown
    ? await studentB.$eval('.shared-with-you .share-row', (el) => el.innerText.replace(/\s+/g, ' ').trim())
    : null;
  check('Student B\'s class page offers the share, named by its sharer and its title',
    sectionShown && shareRow.includes(STUDENT_NAME) && shareRow.includes(PERSONAL_TITLE),
    String(shareRow));
  await sweepScreen(studentB, 'student B class page (shared with you)');

  await clickByText(studentB, '.shared-with-you .share-row button', /add to my projects/);
  const bAtIde = await studentB
    .waitForFunction(() => location.pathname === '/', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  const chipShown = await studentB
    .waitForSelector('.attribution-chip', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  check('Add to my projects lands student B in the IDE with the copy open',
    bAtIde && chipShown,
    bAtIde ? 'at "/" but no attribution chip' : `at ${studentB.url()} — ${await textOf(studentB, '.shared-with-you .alert--danger')}`);
  const chipText = await textOf(studentB, '.attribution-chip');
  check('The status bar credits the sharer by name, in §8.1\'s own sentence',
    chipText === ATTRIBUTION_SENTENCE, String(chipText));
  check('The copy opens under the title it was shared under',
    (await textOf(studentB, '.status-bar__project')) === PERSONAL_TITLE,
    String(await textOf(studentB, '.status-bar__project')));
  await sweepScreen(studentB, 'IDE holding an accepted copy');
  await screenshot(studentB, '11-attribution-chip');

  // The second label surface: the same sentence under the library row.
  await studentB.click('.app-header__identity .tb-btn--nav');
  const libraryLabelShown = await studentB
    .waitForSelector('.start-menu-overlay .start-project-attrib', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  const libraryLabel = await textOf(studentB, '.start-project-attrib');
  check('The start menu\'s library row carries the same credit under the copy',
    libraryLabelShown && libraryLabel === ATTRIBUTION_SENTENCE, String(libraryLabel));
  await sweepScreen(studentB, 'start menu with an accepted copy');
  await screenshot(studentB, '12-library-label');

  /* One pending hand-off, once accepted, is gone: the section that appeared
     for B must disappear again rather than offering a second copy. */
  await studentB.goto(`${BASE}/classes/${classId}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await studentB.waitForSelector('.page-header__title', { timeout: 20000 });
  await delay(1200);
  check('Once accepted, "Shared with you" is gone from student B\'s class page',
    (await studentB.$('.shared-with-you')) === null);

  // ── 15: The bell — a second assignment, an unread badge, mark-all ────────
  console.log('\n═══ 15: The bell rings for a second assignment ══════════════════════');
  /* Clear the decks first. Student A already holds unread rows from earlier
     in this very flow (the mark this run released is one of them), so a
     badge that merely EXISTS proves nothing about the publish below.
     Opening the bell is the product's own mark-all gesture (D§3) — this is
     the same click a student makes, used here to establish a zero. */
  await student.goto(`${BASE}/classes`, { waitUntil: 'networkidle0', timeout: 30000 });
  await student.waitForSelector('.bell-trigger', { timeout: 20000 });
  await delay(1200);
  await student.click('.bell-trigger');
  await student.waitForSelector('.tb-dropdown-menu', { timeout: 15000 });
  await student
    .waitForFunction(() => document.querySelector('.bell-badge') === null, { timeout: 20000 })
    .catch(() => {});
  await student.keyboard.press('Escape');
  await delay(400);

  /* The fixture: a second published assignment, minted through the teacher's
     own session with two real requests. The AUTHORING UI is already covered
     end to end above (segment 3) — what is under test here is the delivery,
     so this is the shortest honest way to make the bell ring. */
  const publish2 = await teacher.evaluate(async (cid, title) => {
    const mk = await fetch(`/api/classes/${cid}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const made = await mk.json().catch(() => null);
    const id = made?.assignment?.id ?? null;
    if (!id) return { create: mk.status, publish: 0, data: made };
    const pub = await fetch(`/api/assignments/${id}/publish`, { method: 'POST' });
    return { create: mk.status, publish: pub.status, id, data: await pub.json().catch(() => null) };
  }, classId, ASSIGNMENT_TITLE_2);
  check('The teacher publishes a second assignment into the same class',
    publish2.create === 201 && publish2.publish === 200,
    `create ${publish2.create}, publish ${publish2.publish} — ${JSON.stringify(publish2.data)}`);

  await student.goto(`${BASE}/classes`, { waitUntil: 'networkidle0', timeout: 30000 });
  const badgeOne = await student
    .waitForFunction(() => document.querySelector('.bell-badge')?.textContent.trim() === '1', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  check('Publishing lands exactly one unread notification in the student\'s bell',
    badgeOne, `badge reads ${JSON.stringify(await textOf(student, '.bell-badge'))}`);
  await screenshot(student, '13-bell-unread');

  await student.click('.bell-trigger');
  await student.waitForSelector('.tb-dropdown-menu .bell-item', { timeout: 20000 });
  const bellRows = await student.$$eval('.bell-item .bell-item__text', (els) =>
    els.map((e) => e.textContent.trim()),
  );
  check('The bell\'s newest row is the published assignment, in the renderer\'s own words',
    bellRows[0] === BELL_PUBLISHED_SENTENCE, String(bellRows[0]));
  await sweepScreen(student, 'student /classes with the bell open');
  await screenshot(student, '14-bell-open');
  await student.keyboard.press('Escape');
  await delay(400);

  /* Opening it was the mark-all. The reload is what makes this a server
     assertion rather than a local one — the badge must not come back. */
  await student.goto(`${BASE}/classes`, { waitUntil: 'networkidle0', timeout: 30000 });
  await student.waitForSelector('.bell-trigger', { timeout: 20000 });
  await delay(2000);
  check('Opening the bell marked everything read — the badge stays gone across a reload',
    (await student.$('.bell-badge')) === null,
    `badge reads ${JSON.stringify(await textOf(student, '.bell-badge'))}`);

  // ── 16: The five switches on /profile ───────────────────────────────────
  console.log('\n═══ 16: The student switches an email off, and it holds ═════════════');
  await student.goto(`${BASE}/profile`, { waitUntil: 'networkidle0', timeout: 30000 });
  await student.waitForSelector('.pref-row', { timeout: 20000 });
  const prefLabels = await student.$$eval('.pref-row', (els) => els.map((e) => e.textContent.trim()));
  check('/profile lists the five email switches in the shared key order',
    prefLabels.length === 5 && prefLabels[DUE_TOMORROW_INDEX] === DUE_TOMORROW_LABEL,
    prefLabels.join(' | '));
  const prefsBefore = await student.$$eval('.pref-row input[type="checkbox"]', (els) => els.map((e) => e.checked));
  await student.evaluate((i) => {
    document.querySelectorAll('.pref-row input[type="checkbox"]')[i].click();
  }, DUE_TOMORROW_INDEX);
  await clickByText(student, '.auth-form button', /save notification settings/);
  const prefsSaved = await student
    .waitForFunction(
      () => (document.querySelector('p.auth-text[role="status"]')?.textContent ?? '').includes('Notification settings saved.'),
      { timeout: 20000 },
    )
    .then(() => true)
    .catch(() => false);
  await sweepScreen(student, '/profile with the switches');

  await student.reload({ waitUntil: 'networkidle0', timeout: 30000 });
  await student.waitForSelector('.pref-row input[type="checkbox"]', { timeout: 20000 });
  await delay(800);
  const prefsAfter = await student.$$eval('.pref-row input[type="checkbox"]', (els) => els.map((e) => e.checked));
  check('Due-tomorrow reminders is off after a reload, and only that one switch moved',
    prefsSaved &&
      prefsBefore.every((v) => v === true) &&
      prefsAfter[DUE_TOMORROW_INDEX] === false &&
      prefsAfter.filter((v) => v === true).length === 4,
    `saved ${prefsSaved}, before ${JSON.stringify(prefsBefore)}, after ${JSON.stringify(prefsAfter)}`);

  // ── 17: Waiting on them, and the Revoke that empties both sides ─────────
  console.log('\n═══ 17: Waiting on them → Revoke ═══════════════════════════════════');
  /* The sharing segment above ends with the share ACCEPTED, and an accepted
     share is not pending — `Waiting on them` renders nothing for it, by
     design. So mint a fresh one: the same project offered to the same
     classmate a second time, which the route allows precisely because the
     first is no longer pending (shares.ts's dup check is scoped to
     `status = 'pending'`). Driven through student A's own session; the
     Share… dialog that normally does this is asserted in full in segment 14. */
  const mint = await student.evaluate(async (cid, pid, bName) => {
    const rr = await fetch(`/api/shares/roster/${cid}`);
    const roster = rr.ok ? await rr.json() : { members: [] };
    const b = (roster.members ?? []).find((m) => m.name === bName);
    if (!b) return { status: 0, data: { error: `no ${bName} on the roster` } };
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: cid, recipientId: b.userId, projectId: pid }),
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  }, classId, personalId, STUDENT_B_NAME);
  check('A second hand-off of the same project to the same classmate is accepted',
    mint.status === 201, `${mint.status} ${JSON.stringify(mint.data)}`);

  await student.goto(`${BASE}/classes/${classId}`, { waitUntil: 'networkidle0', timeout: 30000 });
  const waitingShown = await student
    .waitForSelector('.waiting-on-them .share-row', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  const waitingHeading = await textOf(student, '.waiting-on-them .section-title');
  const waitingTo = await textOf(student, '.waiting-on-them .waiting-row__to');
  const waitingTitle = await textOf(student, '.waiting-on-them .share-row__title');
  check('The sharer\'s class page grows "Waiting on them", naming the project and who holds it',
    waitingShown &&
      waitingHeading === 'Waiting on them' &&
      waitingTo === `to ${STUDENT_B_NAME}` &&
      waitingTitle === PERSONAL_TITLE,
    `"${String(waitingHeading)}" / "${String(waitingTo)}" / "${String(waitingTitle)}"`);
  await sweepScreen(student, 'student A class page (waiting on them)');
  await screenshot(student, '15-waiting-on-them');

  await studentB.goto(`${BASE}/classes/${classId}`, { waitUntil: 'networkidle0', timeout: 30000 });
  const bOfferedAgain = await studentB
    .waitForSelector('.shared-with-you .share-row', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  check('The same pending share is on the recipient\'s page — both sides see it before the revoke',
    bOfferedAgain);

  await clickByText(student, '.waiting-on-them button', /^revoke$/);
  const revokedForA = await student
    .waitForFunction(() => document.querySelector('.waiting-on-them') === null, { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  check('Revoke empties the sharer\'s own list — the section renders nothing, not an empty heading',
    revokedForA, String(await textOf(student, '.waiting-on-them')));

  await studentB.goto(`${BASE}/classes/${classId}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await studentB.waitForSelector('.page-header__title', { timeout: 20000 });
  await delay(1500);
  check('The revoked offer is gone from the recipient\'s page too',
    (await studentB.$('.shared-with-you')) === null);

  // ── 18: Data requests — the export, the erase, the closed door ──────────
  console.log('\n═══ 18: Admin data requests — export, erase, and the door ═══════════');
  await throwaway.goto(`${BASE}/auth/signup`, { waitUntil: 'networkidle0', timeout: 30000 });
  const signupT = await throwaway.evaluate(async (body) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  }, { name: THROWAWAY_NAME, email: THROWAWAY_EMAIL, password: STUDENT_PASSWORD, wantsTeacher: false, consent: true });
  const inboxT = await teacher.evaluate(async () => {
    const res = await fetch('/api/admin/emails?limit=100');
    return res.ok ? res.json() : { emails: [] };
  });
  const confirmMailT = (inboxT.emails ?? []).find(
    (e) => e.toEmail === THROWAWAY_EMAIL && e.template === 'confirm',
  );
  const confirmLinkT = confirmMailT?.bodyText?.match(/https?:\/\/\S+\/auth\/confirm\?token=[A-Za-z0-9_-]+/)?.[0] ?? null;
  if (confirmLinkT) {
    const linkT = new URL(confirmLinkT);
    await throwaway.goto(BASE + linkT.pathname + linkT.search, { waitUntil: 'networkidle0', timeout: 30000 });
    await delay(600);
  }
  await throwaway.goto(`${BASE}/auth/signin`, { waitUntil: 'networkidle0', timeout: 30000 });
  await setInput(throwaway, 'input[type="email"]', THROWAWAY_EMAIL);
  await setInput(throwaway, 'input[type="password"]', STUDENT_PASSWORD);
  await clickByText(throwaway, 'button', /^sign in$/);
  const throwawayIn = await throwaway
    .waitForFunction(() => location.pathname === '/', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  check('A throwaway account signs up, confirms and signs in — a real door to close',
    signupT.status === 201 && !!confirmLinkT && throwawayIn,
    `signup ${signupT.status}, confirm link ${String(confirmLinkT)}, signed in ${throwawayIn}`);
  if (!throwawayIn) throw new Error('the throwaway could not sign in — the erase has nothing to prove');
  await delay(1200);
  await dismissGuestImport(throwaway);

  await teacher.goto(`${BASE}/admin`, { waitUntil: 'networkidle0', timeout: 30000 });
  await teacher.waitForSelector('.tabs .tab', { timeout: 20000 });
  const adminTabs = await teacher.$$eval('.tabs .tab', (els) => els.map((e) => e.textContent.trim()));
  await clickByText(teacher, '.tabs .tab', /^data requests$/);
  await teacher.waitForSelector('.page-body .empty', { timeout: 20000 });
  check('The console\'s fifth tab is Data requests, and it rests on its prompt rather than listing everyone',
    adminTabs[4] === 'Data requests' &&
      (await textOf(teacher, '.page-body .empty'))?.includes(DATA_REQUESTS_RESTING),
    `${adminTabs.join(' | ')} — "${String(await textOf(teacher, '.page-body .empty'))}"`);

  await setInput(teacher, '.admin-search-input', THROWAWAY_EMAIL);
  const foundThrowaway = await teacher
    .waitForFunction(
      (email) => [...document.querySelectorAll('.admin-table tbody tr')].some((tr) => tr.innerText.includes(email)),
      { timeout: 20000 },
      THROWAWAY_EMAIL,
    )
    .then(() => true)
    .catch(() => false);
  check('Searching the Data requests tab finds the one person it was asked for',
    foundThrowaway, String(await textOf(teacher, '.admin-table tbody tr')));

  /* The download itself is a browser save (a Blob and a discarded <a>) —
     what the run can honestly assert is the fetch behind it, so it makes
     the same call the button makes, from the same session. */
  const exported = await teacher.evaluate(async (email) => {
    const list = await fetch(`/api/admin/users?q=${encodeURIComponent(email)}`);
    const users = list.ok ? (await list.json()).users ?? [] : [];
    const u = users.find((x) => x.email === email);
    if (!u) return { id: null, status: 0, keys: [] };
    const res = await fetch(`/api/admin/users/${u.id}/export`);
    const data = await res.json().catch(() => null);
    return { id: u.id, status: res.status, keys: data ? Object.keys(data) : [], userEmail: data?.user?.email ?? null };
  }, THROWAWAY_EMAIL);
  check('Export answers 200 with the whole record — its own note first, then the person',
    exported.status === 200 &&
      exported.keys[0] === 'note' &&
      exported.keys.includes('user') &&
      exported.userEmail === THROWAWAY_EMAIL,
    `${exported.status} keys=${exported.keys.slice(0, 6).join(',')} user.email=${String(exported.userEmail)}`);
  const throwawayId = exported.id;
  if (!throwawayId) throw new Error('the admin search could not resolve the throwaway id');

  await clickByText(teacher, '.admin-actions .btn--danger', /erase/);
  await teacher.waitForSelector('.erase-dialog', { timeout: 20000 });
  const eraseBtnState = async () =>
    teacher.$$eval('.erase-dialog__actions button', (els) => {
      const b = els.find((e) => /erase permanently/i.test(e.textContent));
      return b ? b.disabled : null;
    });
  const disabledEmpty = await eraseBtnState();
  await setInput(teacher, '.erase-dialog input[type="text"]', `not-${THROWAWAY_EMAIL}`);
  await delay(300);
  const disabledWrong = await eraseBtnState();
  await setInput(teacher, '.erase-dialog input[type="text"]', THROWAWAY_EMAIL);
  await delay(300);
  const enabledExact = await eraseBtnState();
  check('Erase permanently unlocks only on the account\'s own email, typed exactly',
    disabledEmpty === true && disabledWrong === true && enabledExact === false,
    `empty ${disabledEmpty}, wrong ${disabledWrong}, exact ${enabledExact}`);
  await sweepScreen(teacher, 'admin Data requests (erase dialog)');
  await screenshot(teacher, '16-data-requests');

  await clickByText(teacher, '.erase-dialog__actions button', /erase permanently/);
  const eraseDone = await teacher
    .waitForFunction(() => document.querySelector('.erase-dialog') === null, { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  if (!eraseDone) throw new Error(`the erase dialog stayed open: ${await textOf(teacher, '.erase-dialog .alert--danger')}`);

  /* The scrub rewrote the email to `erased+<id>@erased.invalid`, so the old
     address no longer finds them — the id does, and it is the only handle
     that survives an erasure by design. */
  await clickByText(teacher, '.tabs .tab', /^people$/);
  await teacher.waitForSelector('.admin-search-input', { timeout: 20000 });
  await setInput(teacher, '.admin-search-input', throwawayId);
  const erasedRow = await teacher
    .waitForFunction(
      () => {
        const rows = [...document.querySelectorAll('.admin-table tbody tr')];
        return rows.length === 1 && rows[0].querySelector('.status-erased') !== null;
      },
      { timeout: 25000 },
    )
    .then(() => true)
    .catch(() => false);
  const erasedCells = erasedRow
    ? await teacher.$eval('.admin-table tbody tr', (tr) => {
        const tds = [...tr.querySelectorAll('td')];
        return {
          status: tds[3].textContent.trim(),
          actions: tds[4].querySelectorAll('button').length,
          name: tds[0].textContent.trim(),
        };
      })
    : null;
  check('The People tab shows the third status — "erased", under one name, with no action left to offer',
    erasedRow && erasedCells.status === 'erased' && erasedCells.actions === 0 &&
      erasedCells.name === 'Removed student',
    JSON.stringify(erasedCells));
  await sweepScreen(teacher, 'admin People tab (an erased shell)');

  await throwaway.goto(`${BASE}/auth/signin`, { waitUntil: 'networkidle0', timeout: 30000 });
  await setInput(throwaway, 'input[type="email"]', THROWAWAY_EMAIL);
  await setInput(throwaway, 'input[type="password"]', STUDENT_PASSWORD);
  await clickByText(throwaway, 'button', /^sign in$/);
  const refusal = await throwaway
    .waitForSelector('.auth-form .alert--danger', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  const refusalText = await textOf(throwaway, '.auth-form .alert--danger');
  check('The erased account\'s old email no longer opens the door',
    refusal && refusalText === SIGNIN_REFUSED && throwaway.url().includes('/auth/signin'),
    `"${String(refusalText)}" at ${throwaway.url()}`);
  await sweepScreen(throwaway, '/auth/signin refusing an erased address');

  // ── 18b: The pretend inbox on camera — Emails tab + webhook door ─────────
  console.log('\n═══ 18b: The pretend inbox on camera — Emails tab + webhook door ════');
  /* The `bounced` render stays a Task 4 unit test, deliberately: the sole
   * writer of `emails` rows is a mail driver (backend/src/email/mailer.ts —
   * `grep insert(emails)` returns exactly that one non-test site), the dev
   * driver never sets providerId, and no admin route creates an emails row.
   * So this flow can never produce a bounced row to photograph, and it does
   * not try — the webhook checks below prove the DOOR, not the badge. */
  await teacher.goto(`${BASE}/admin`, { waitUntil: 'networkidle0', timeout: 30000 });
  await clickByText(teacher, 'button[role="tab"]', /^Emails$/);
  await teacher.waitForSelector('.admin-mail-row', { timeout: 20000 });
  const mailRows = await teacher.$$eval('.admin-mail-row', (rows) =>
    rows.map((r) => r.innerText.replace(/\s+/g, ' ')));
  const studentConfirmRow = mailRows.find((t) => t.includes(STUDENT_EMAIL) && /confirm/i.test(t));
  check('The Emails tab lists the run\'s own mail — the student\'s confirm at minimum',
    !!studentConfirmRow, `rows: ${mailRows.length}`);
  check('The Status column reads "dev" — the pretend inbox names its driver',
    !!studentConfirmRow && / dev( |$)/.test(studentConfirmRow), String(studentConfirmRow));
  /* Keyboard: Enter on a focused row expands it (AdminConsole's own
   * onKeyDown handler; spec §9's keyboard row). */
  await teacher.focus('.admin-mail-row');
  await teacher.keyboard.press('Enter');
  const mailExpanded = await teacher
    .waitForSelector('.admin-mail-body', { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check('Enter expands a focused row into the full message body', mailExpanded);
  await screenshot(teacher, '17-emails-tab');
  await sweepScreen(teacher, 'admin Emails tab');

  // The webhook door, from inside the page (same-origin fetch, real route).
  const WEBHOOK_SECRET = process.env.MAIL_WEBHOOK_SECRET ?? 'dev-mail-hook';
  const noSecretStatus = await teacher.evaluate(async () => {
    const res = await fetch('/api/mail/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'hard_bounce', email: 'e2e@example.test', 'message-id': 'e2e-no-secret' }),
    });
    return res.status;
  });
  check('The webhook door refuses a missing secret with 403', noSecretStatus === 403,
    `status ${noSecretStatus}`);
  const unknownIdResult = await teacher.evaluate(async (secret) => {
    const res = await fetch('/api/mail/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mail-secret': secret },
      body: JSON.stringify({ event: 'hard_bounce', email: 'e2e@example.test', 'message-id': 'e2e-unknown-id' }),
    });
    const data = await res.json().catch(() => null);
    const after = await fetch('/api/admin/emails?limit=200').then((r) => r.json()).catch(() => ({ emails: [] }));
    return {
      status: res.status,
      ok: data?.ok === true,
      bounced: (after.emails ?? []).filter((e) => e.status === 'bounced').length,
    };
  }, WEBHOOK_SECRET);
  check('An unknown message-id with the correct secret is 200-and-no-write',
    unknownIdResult.status === 200 && unknownIdResult.ok && unknownIdResult.bounced === 0,
    JSON.stringify(unknownIdResult));
} catch (err) {
  check('The golden flow runs to the end without throwing', false, err.message);
  await screenshot(teacher, 'zz-teacher-at-failure').catch(() => {});
  await screenshot(student, 'zz-student-at-failure').catch(() => {});
  await screenshot(studentB, 'zz-student-b-at-failure').catch(() => {});
  await screenshot(throwaway, 'zz-throwaway-at-failure').catch(() => {});
}

// ── 19: The sweeps, summarised ──────────────────────────────────────────────
console.log('\n═══ 19: Design-system sweeps across every screen visited ════════════');
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
