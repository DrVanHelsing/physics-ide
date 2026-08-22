# Task 19 Report — Wrap-up: the full sweep, the docs, the handoff

Branch: `feature/classroom-platform`. Started at `8f7d4c2`. Final tip after this task: `68bfe6e`.

**Status: DONE.** Step 3 (the offline smoke test) originally surfaced a release-blocking
regression unrelated to offline/CDN behaviour: `rate()` inside any VPython animation loop
crashed Run with a JS `SyntaxError` in a real browser. Root-caused to
`frontend/src/utils/runner/glowRunner.js` lines 400–406 (commit `d80a5158`, Task 15). Per
instructions, this was not patched by me — reported to the controller instead. The controller's
fix landed in commit `68bfe6e` (`fix(frontend): rate() instrumentation speaks the compiler's
real grammar — parenthesized awaits no longer break the run`). **Step 3 was re-run against
`68bfe6e` and now passes in full**, with live evidence (real WebGL canvases, 45 genuine
telemetry samples showing a correct projectile trajectory, honest pause/step, zero regressions).
See "Step 3 — recovery and final result" below for the full chain: regression found → reported
→ fixed by the controller → independently re-verified by this task.

---

## Step 1: the straggler sweep — 12 assertions, actual results

| # | Grep | Expected | Actual | Verdict |
|---|------|----------|--------|---------|
| 1 | `window.Blockly` in `frontend/src` | nothing | 2 hits, both in `blocklyLib.js` | **Explained** — see below |
| 2 | `glowscript.org\|cdn.jsdelivr.net/npm/blockly` | nothing | nothing | Clean pass |
| 3 | `colour: [0-9]+` in `utils/blockly` | nothing | nothing | Clean pass |
| 4 | `colour="#` in `toolbox.js` | nothing | nothing | Clean pass |
| 5 | `beginnerEnabled\|beginnerVisible` | nothing | 1 hit, `blockRegistry.test.js:151` | **Explained** — see below |
| 6 | `dm-ctrl\|dm-panel\|dm-topbar\|dm-overlay\|DebugMode` | nothing | 25 hits | **Explained** — see below |
| 7 | `colour (45\|120\|160\|210\|230\|260\|330)` in `HelpPage.js` | nothing | nothing | Clean pass |
| 8 | `scene.background` in `blockTemplates.js`/`precodedExamples.js` | nothing | nothing | Clean pass |
| 9 | `__probe__\|SeparatorDot` in `frontend/src` | nothing | 1 hit → fixed → 0 | **Fixed**, see below |
| 10 | `helpUrl` count, `blocklyGenerator.js` | 1 | 3 | **Amended per controller note 2** |
| 11 | `GLOWSCRIPT_VERSION` count, `glowRunner.js` | 4 | 4 | Exact match |
| 12 | `<CategoryTag` count, `HelpPage.js` | 8 | 8 | Exact match |

### #1 — `window.Blockly` (2 hits, both explained)
Both hits are in `frontend/src/utils/blockly/blocklyLib.js`: a comment (line 2, "Every module
that used to read `window.Blockly`...") and the actual assignment (line 66). Read in context:
the assignment is gated `if (typeof window !== "undefined" && import.meta.env.DEV)` — a
dev-only test hook, explicitly commented as "Controller-authorized (Task 15)" for
`frontend/scripts/e2e-test.mjs`'s Part B2/C3 DOM-injection tests, and confirmed dead code (and
therefore absent) under `vite build`/`vite preview` per the comment and per `npm run build`'s
output (no `window.Blockly` reference reachable in the production bundle). Nothing under
`src/` reads it. This is the documented, sanctioned exception, not a regression.

### #5 — `beginnerEnabled|beginnerVisible` (1 hit, explained)
The single hit is `expect(e).not.toHaveProperty("beginnerVisible")` in
`blockRegistry.test.js:151` — a negative assertion proving the property was deleted, not a
surviving usage.

### #6 — `dm-ctrl|dm-panel|dm-topbar|dm-overlay|DebugMode` (25 hits, explained)
Isolated each fragment separately:
- `dm-ctrl`, `dm-topbar`, `dm-overlay`: **zero** hits each.
- `dm-panel`: **one** hit, in `styles/debug.css:583`, a comment reading "Was
  `.dm-panel--trace` .trace-panel / .trace-scroll" — documenting the historical class name that
  was renamed away, not a surviving rule.
- The remaining ~24 hits are all the bare substring `DebugMode` matching inside legitimate,
  *different* identifiers that happen to contain it: `onDebugMode` (prop), `setDebugMode`
  (state setter), `debugMode` (state variable) — plus a handful of comments explicitly
  documenting that `DebugMode.js` was deleted and describing what it used to do (in
  `useDebugHotkeys.js`, `BlocklyWorkspace.js`, `IDELayout.js`, `downloadCsv.js`).
  `git grep -n "DebugMode\.js"` finds only comment references; `find frontend/src -iname
  "DebugMode.js"` returns nothing — the file is confirmed deleted.

### #9 — `SeparatorDot` (fixed)
Confirmed a single definition (`frontend/src/components/Icons.js:84`) and zero call sites
anywhere in `frontend/src`. Deleted the 3-line export per controller instruction. Re-ran the
grep after the fix: clean (exit 1, no matches). Committed separately as `e690cf2`.

### #10 — `helpUrl` count in `blocklyGenerator.js` (3, not the brief's stale "1")
Per controller note 2. The three hits are: a comment (line 1946), the "never clobber an
upstream URL" guard (line 1955: `if (def.helpUrl) continue;`), and the derivation assignment
itself (line 1956: `def.helpUrl = \`#/help?block=${entry.type}\`;`). For completeness, the
full `helpUrl` population across `frontend/src` is 23 hits across 5 files: `blocklyGenerator.js`
(3), `blockHelpUrl.test.js` (17 — the dedicated test suite), `HelpPage.js` (1, the anchor
route), `IDELayout.js` (1, wiring), `styles/pages.css` (1, styling). The brief's "1" evidently
predated Task 11's adaptation into a derivation loop plus dedicated test suite.

### #8 accounting (broader than the literal grep, per controller note 1)
The literal Step-1 grep is already scoped to `blockTemplates.js`/`precodedExamples.js` and is
clean. Ran an unscoped sweep across all of `frontend/src` for completeness (this closes Plan 2
Task 14's handoff): 7 hits in `HelpPage.js` (documented API — search-index content strings and
`<Pre>` code samples at lines 130, 155, 1203, 1288, 1639, 1886, 1944), 2 in
`vectorChainTypeChecks.test.js` (a comment documenting the historical removal), and exactly 1
in `glowRunner.js:648` — `applyRuntimeTheme`'s single sanctioned assignment. "One background,
not seven" holds.

---

## Step 2: the full verification sweep

```
npm run test -w frontend      → Test Files 60 passed (60); Tests 448 passed (448)
npm run check:blocks          → ✔ Registry OK: 120 entries in 19 categories; 120 toolbox ids
                                  and 26 drawers reconcile both ways.
npm run build -w frontend     → ✓ built in 22.40s (pre-existing dynamic/static import mixing
                                  warnings and >500kB chunk warnings, not new, not errors)
npm run typecheck -w backend  → silent, exit 0
npm run typecheck -w shared   → silent, exit 0
```

448/448 across 60 files matches the stated baseline exactly. `check:blocks` message matches
the brief's expected string verbatim. Both typechecks are silent, proving backend/shared
untouched by this plan. Ran with `npm run test -w frontend` per the controller's amendment 7
(narrower than the brief's plain `npm run test`, which would run all three workspaces —
backend/shared verification is via typecheck here instead).

**Update after the Step 3 regression's fix (`68bfe6e`)**: re-ran `npm run test -w frontend` as
part of verifying the fix — now **456/456 across 61 files** (the fix commit's 8 new tests in
`glowRunner.test.js`, all passing; nothing else changed). `check:blocks`/`build`/typechecks were
not re-run a second time in full since the fix is scoped to one runner file with no toolbox,
registry, backend, or shared touches — but the frontend build was redone as part of the Step 3
recovery pass (clean, see below) and is the actual artifact the recovery smoke test ran against.

---

## Step 3: the offline smoke test — regression found, fixed, and re-verified

This section is kept in its original chronological order: first the initial run against
`8f7d4c2` (which found the regression), then the recovery run against the controller's fix at
`68bfe6e`. Both are real evidence, not narrative — the first run is what justified stopping
instead of patching; the second is what closes the loop.

### Methodology
Built the frontend (`npm run build -w frontend`), started `vite preview` on port 4173 as a
background process (PID tracked, killed at the end), and drove it with a small Puppeteer
script (the same dependency and DOM conventions as `frontend/scripts/e2e-test.mjs`) using CDP
request interception to abort any request whose hostname matched `*.glowscript.org`,
`cdn.jsdelivr.net`, or `fonts.googleapis.com`, while logging every request/response.

### What held (the actual offline/CDN promise)
- IDE loads: page title correct, start-menu overlay renders.
- Block editor renders: `.blockly-host svg` present with real `.blocklyDraggable` blocks
  (bundled Blockly, no `window.Blockly` in production, confirmed by Step 1 #1's build check).
- Debug mode UI opens correctly (Debug button found, pause chip present); pause/step could not
  be fully exercised in this first pass because Run itself failed (see below) — fully verified
  in the recovery pass once the regression was fixed (see "Recovery" below).
- Monaco (Code view) renders fully — `div.monaco-editor` present — with **zero** requests to
  any of the three blocked domains. This is because Monaco is *also* fully bundled
  (`monaco-editor@0.45.0` via `frontend/src/utils/monaco/monacoLib.js`, dynamic-imported as a
  same-origin chunk; the built `dist/assets/` includes `monacoLib-*.js`, `editor.api-*.js`,
  `editor.worker-*.js`, `editor-*.css`, `monacoLib-*.css`, `codicon-*.ttf` — all local). This
  was already true and already documented (see "docs deviation" below) — it is *not* new work
  from this plan, but it means the offline promise for Monaco is stronger than "degrades to a
  textarea": it doesn't need to degrade at all.
- Network accounting: 2 blocked requests, both to `fonts.googleapis.com` (the CSS `@import`),
  both aborted before reaching the network. Zero requests reached `glowscript.org` or
  `cdn.jsdelivr.net` (none were even attempted — nothing in the app references them, confirming
  Step 1 #2). The only same-origin HTTP errors seen were `500` on `/api/auth/me` and `404` on
  `/favicon.ico` — both expected artifacts of running `vite preview` with no backend behind it
  (the dev-server's `/api` proxy to `:4000` doesn't exist under `preview`), unrelated to the
  three blocked domains and unrelated to this plan.

### What broke — the actual regression
**"A template runs and draws in the 3D viewport" fails.** Clicking Run on the Projectile block
template (and independently, the Spring template) produces the status-bar error "Python
couldn't read one of your lines. There's a typo near the reported line. Unexpected token ';'"
— a *live* trip through `describeRunError`'s new plain-English wording, but wrapping a genuine
`SyntaxError` thrown by `frameWindow.eval()` in `glowRunner.js`.

**This is 100% reproducible independent of the offline blocking** — I confirmed it fails
identically with no request interception at all, on both `vite preview` (built, port 4173) and
`vite dev` (port 3000). It is not a CDN/offline artifact; it is a standalone functional
regression that breaks Run in every environment.

**Root cause**, isolated by capturing the actual compiled+trace-injected JS the app was about
to `eval()` and running it through `node --check`:

```
__compiled-full.js:249
        (window.__physide_iter=(window.__physide_iter||0)+1;if(window.__physide_frame_steps>0){window.__physide_frame_steps--;if(window.__physide_frame_steps===0){window.__physide_paused=true;window.__physide_steps=0;}}await rate(240));
                                                           ^
SyntaxError: Unexpected token ';'
```

`frontend/src/utils/runner/glowRunner.js`, function `executeCompiled`, lines 400–406:

```js
traceInjected = traceInjected.replace(
  /\b(await\s+)?rate\s*\(/g,
  "window.__physide_iter=(window.__physide_iter||0)+1;" +
    "if(window.__physide_frame_steps>0){window.__physide_frame_steps--;" +
    "if(window.__physide_frame_steps===0){window.__physide_paused=true;window.__physide_steps=0;}}" +
    "$&",
);
```

This regex assumes every `rate(...)` call sits at the start of a bare JS statement, so
prepending a semicolon-terminated statement sequence is always safe. But GlowScript's
RapydScript compiler emits an awaited `rate()` call as a **parenthesized expression-statement**
— `(await rate(240));` — not a bare one. The regex fires *inside* those parens too (it matches
`await rate(` wherever it appears), so the injected `if(){...}` / `;`-separated statements land
inside a parenthesized expression, which cannot contain a statement sequence. `node --check`
confirms the exact failure at the first injected semicolon inside the parens.

**Attribution**: `git blame` traces the regex to commit `d80a51581a95be03b88a615b28c4ae1440261829`
— `fix(frontend): pause is acknowledged by the runtime; Next frame steps a real timestep;
highlight pins while paused` — Task 15's "Next frame" frame-boundary instrumentation. The one
later commit that touched this file (`cf09eda`, Task 16's setup/watch tracing) only modified
the separate `_phtr_` trace-injection regex a few lines above (which is unaffected — it matches
plain `_phtr_NAME = value;` assignments, which RapydScript does emit unwrapped, and passed
`node --check` cleanly) and did not touch or fix the `rate()` regex. The bug is present,
unfixed, at the branch tip `8f7d4c2`.

**Impact**: because `rate()` is the standard GlowScript throttle call used in essentially every
VPython animation loop, this breaks Run for the general case, not an edge case — confirmed with
two independent templates (Projectile, Spring). It blocks Step 3's "runs and draws" requirement,
and by extension items 1, 3, 4, 5, 9 of the Step 7 hand-off list below (anything that needs a
running simulation). The existing 448 unit tests do not catch it because they run in jsdom
against mocked/string-level assertions of the instrumentor's output, not a real browser `eval()`
of RapydScript's actual compiled shape — a real coverage gap worth flagging to whoever owns the
fix.

**I did not patch this.** I added a one-line temporary diagnostic (`window.__T19_FULL_COMPILED
= traceInjected` inside the existing catch block) purely to capture the failing string for
`node --check`, then reverted it — `git diff` against `glowRunner.js` is empty. All test/debug
scripts and screenshots were written outside git tracking or removed; `git status` is clean
throughout.

**Recommendation (at the time)**: fix before the tranche is called ready, and hold the Step 7
hand-off until it lands. Reported to the controller instead of patching — see below.

### Recovery — the fix, and the re-verification

The controller's fix landed as commit `68bfe6e` — `fix(frontend): rate() instrumentation
speaks the compiler's real grammar — parenthesized awaits no longer break the run` — which
replaces the blind-substitution regex with `injectFrameBoundaries()`
(`glowRunner.js:295-399`): a proper scanner that finds each `rate(` call site, walks a
depth-counted paren matcher (`findMatchingParen`) to find where its argument list actually
ends, detects whether it's wrapped in RapydScript's `(await rate(...));` expression-statement
form (checking for a genuine statement boundary — `;`, `{`, `}`, or start-of-file — immediately
before the wrapping paren), and only then wraps the **whole original statement** (parens
included) in a fresh `{ bookkeeping; originalStatement }` block — never injecting a statement
sequence into an expression position. Anything that doesn't match a recognized statement shape
is left untouched rather than guessed at. The commit also adds
`frontend/src/utils/runner/__tests__/glowRunner.test.js` (8 new tests covering the bare,
awaited, and parenthesized-await shapes, plus the "leave embedded calls alone" boundary cases).

**Unit tests**: `npm run test -w frontend` now reports **456/456 across 61 files** (up from the
448/60 baseline — the fix commit's 8 new tests, all passing; nothing else changed test-count-wise).

**Live re-verification**: rebuilt (`npm run build -w frontend`, clean), relaunched `vite
preview` on port 4173 (backgrounded, PID tracked, killed after), and re-ran the same
domain-blocking Puppeteer harness against `68bfe6e`. Two harness gaps from the first pass were
fixed along the way (both artifacts of *my* test script, not the product): (a) headless Chrome
needs explicit software-WebGL flags (`--use-gl=angle --use-angle=swiftshader-webgl
--enable-unsafe-swiftshader --ignore-gpu-blocklist --disable-gpu-sandbox`) or GlowScript
correctly reports "Can't create canvas: WebGL not supported" and never mounts one — a headless-
harness limitation, confirmed by first reproducing it, then fixing it, not a product bug; (b)
GlowScript's canvas lives inside the `<iframe title="GlowScript Runtime">` that `.glow-host`
hosts, a separate document, so it must be looked for via `page.frames()`, not the top document.

**Result — 15 of 16 automated checks pass; the 1 "failure" is the harness's own over-strict
console-error assertion, not a product issue** (see accounting below):

```
=== 1. IDE loads (offline network) ===
  PASS  Page loads with correct title
  PASS  Start menu overlay renders

=== 2. Block editor renders (bundled Blockly) ===
  PASS  Blockly workspace SVG rendered
  PASS  Blockly workspace has blocks (Projectile template)

=== 3. Template runs and draws (vendored GlowScript, no glowscript.org) ===
  PASS  Run button present
  PASS  Run: running state indicated
  PASS  GlowScript canvas mounted (WebGL, inside the runtime iframe)
  PASS  Simulation produced telemetry (genuinely running physics)

=== 4. Debug mode pauses and steps ===
  PASS  Debug button found
  PASS  Debug mode entered (Pause/Next frame controls appear)
  PASS  Pause chip reaches "Paused" (honest ack, not immediate)
  PASS  Next frame button found
  PASS  Next frame advances the iteration counter

=== 5. Monaco editor (bundled npm dependency, not CDN) ===
  INFO  Monaco rendered: true, textarea fallback shown: false
  PASS  Code view renders (Monaco OR textarea fallback, never blank)

=== Network accounting ===
  INFO  Blocked requests (2): fonts.googleapis.com
  INFO  Allowed hosts (1): 127.0.0.1
  PASS  No requests reached glowscript.org/jsdelivr/fonts.googleapis (all intercepted+aborted)

FAIL  No unexplained console errors — [2× net::ERR_CONNECTION_REFUSED (my own interception
      aborting the fonts.googleapis.com requests — the block working exactly as intended),
      5× 500 on /api/auth/me and 2× 404 on /favicon.ico (pre-existing, `vite preview` has no
      backend behind it — the dev proxy to :4000 doesn't exist under `preview`; unrelated to
      this plan or to the three blocked domains), 1× "Permissions policy violation: unload is
      not allowed" (benign browser notice, unrelated)]
```

The one FAIL is my harness's blanket "any console.error is suspicious" assertion catching
exactly the noise it was told to expect elsewhere in the same run (the blocked-domain refusals)
plus pre-existing, already-investigated noise from running a backend-less preview server — not
a new or unexplained error. Substantively this is **16/16**.

Ground-truth proof the physics is genuinely running (not just "no error thrown"): the telemetry
hook captured 45 real trace samples across the run, e.g. (values redacted to the interesting
ones) `ball.pos` progressing `<0.285, 0.711, 0>` → `<0.849, 1.397, 0>` → `<1.213, 1.815, 0>`
while `ball.velocity`, `drag`, and `acceleration` all decrease consistently frame to frame — a
textbook projectile-with-drag trajectory, not placeholder or stuck data. Independently
reproduced with the Spring template as well (both templates were the ones that failed
identically before the fix).

**Debug mode fully exercised, not just UI-present**: clicking Debug mid-run genuinely paused
the simulation — the toolbar chip read "Pausing…" then advanced to "Paused · iteration N" only
after the runtime's own `__phpause` acknowledgement (never an instant, faked pause), and
clicking "Next frame" advanced the iteration counter by exactly one, matching Task 15's honest-
ack and real-timestep contract.

**Conclusion**: the regression is fixed, no new regressions were introduced, and Step 3's full
requirement set now holds against `68bfe6e`: IDE loads, block editor renders, a template runs
and draws in the 3D viewport, debug mode pauses and steps, and only Monaco (which turns out not
to need to) could have degraded to a textarea. The Step 7 hand-off below is no longer blocked.

Both servers (`vite dev` :3000 from the first pass, `vite preview` :4173 from both passes) were
killed by PID; confirmed down via `curl` returning connection failures and `netstat` showing no
listeners on either port. All ad hoc scripts/screenshots from this recovery run were removed;
`git status` is clean.

---

## Step 4: product-contract.md — applied with one documented deviation

Applied both rationale-cell appends exactly as specified:
- **Block toolbox row (:34)** gained: "Category and block colour come from one module,
  `src/utils/blockly/blockPalette.js`, and `npm run check:blocks` validates registry↔toolbox
  ids AND category names in both directions." (confirmed `blockPalette.js` exists.)
- **Runtime abstraction row (:38)** gained: "The GlowScript 3.2 runtime is vendored at
  `frontend/public/vendor/glowscript/` (six files, provenance and SHA-256s recorded there) so
  §101's offline promise holds; Blockly is a pinned-exact npm dependency, not a CDN script."
  (confirmed six vendored files present: `glow.3.2.min.js`, `jquery.min.js`,
  `jquery.textchange.custom.js`, `jquery-ui.custom.min.js`, `RScompiler.3.2.min.js`,
  `RSrun.3.2.min.js`.)

**Deviation, with evidence: did NOT apply the brief's proposed line :107 replacement.** The
brief assumed the current line :107 reads "No HTTP requests to non-CDN origins after first
load. Smoke-tested in CI." — but the actual current text (already landed, evidently by Plan 3
before this plan started) is:

> "No HTTP requests to any third-party origin after first load, with one tracked exception: the
> Google Fonts `@import` in `styles.css` (documented deferral) — the historical 'Monaco stays on
> a CDN' carve-out behind the old 'non-CDN origins' wording is gone now that Monaco is bundled
> alongside Blockly and the vendored GlowScript runtime. ... Smoke-tested in CI."

Line :101 similarly already states "Blockly ..., the GlowScript 3.2 runtime, and Monaco ... are
all bundled or vendored at build time, same-origin, with no CDN dependency for any of the three
(Plan 3, the MakeCode overhaul)." Applying the brief's proposed text verbatim would have
*reintroduced* a false "except the Monaco CDN" claim into a doc that already correctly says that
carve-out is gone — confirmed false by my own Step 3 testing (Monaco rendered with zero requests
to any blocked domain). Left :101 and :107 untouched since they are already accurate and already
stronger than what the brief asked for. §36's orphan wording ("greyed and ignored") was also
checked against the shipped `orphans.js`/`planOrphanState` implementation per instruction 5 — it
matches exactly (uniform disable-set behaviour for both goals, no force-adoption), no edit
needed there.

## Step 5: README — applied with one corrected sentence

Inserted all three paragraphs from the brief immediately after the design-token paragraph, with
one correction: the brief's closing sentence "Monaco is still loaded from a CDN and falls back
to a plain textarea without it." is false for the same reason as above. Replaced with: "Monaco
(bundled since the prior MakeCode overhaul) completes the picture: all three now run
same-origin, with no CDN dependency left anywhere in the editor." Everything else in the three
paragraphs (block palette, debug-as-mode, Blockly/GlowScript bundling) was independently spot
checked and holds.

## Step 6: commits

1. `e690cf2` — `chore(frontend): drop unused SeparatorDot export from Icons.js` (Step 1 #9 fix,
   kept separate from the docs commit as instructed).
2. `5952a0d` — `docs: the block palette, the toolbox contract, the honest debugger, and
   offline-for-real` (Steps 4–5, with a note in the commit body pointing at this report for the
   line :101/:107 deviation).
3. `68bfe6e` — `fix(frontend): rate() instrumentation speaks the compiler's real grammar —
   parenthesized awaits no longer break the run` (**not authored by this task** — the
   controller's fix for the Step 3 regression reported above, merged onto the branch in
   response to this report; re-verified independently in the "Recovery" subsection of Step 3).

`git status` is clean after all three; no `e2e/*.png` were touched (per instruction 8 — no
screenshot refresh in this task). No additional commit was needed on top of `68bfe6e`: nothing
in the README/`product-contract.md` wording from commit `5952a0d` made any claim the fix
contradicts (the docs describe the block palette, toolbox contract, debug-as-mode UX, and
bundling/vendoring — none of which mention the `rate()` instrumentation internals), so no truth
adjustment was required.

---

## Step 7: hand-off checklist for the browser pass

**No longer blocked.** The Step 3 regression (`glowRunner.js:400-406`, pre-fix) is resolved by
`68bfe6e` and independently re-verified live (real Run, real WebGL canvas, real telemetry,
honest pause/step) — see Step 3's "Recovery" subsection. All ten surfaces below, and T15 in
particular, can now be meaningfully evaluated by a human pass.

Ten surfaces this plan deliberately changed — both themes on each:

1. **Block editor, physics goal** — every category is a new colour; chips and blocks match;
   block text is 13px; `sim_end` is purple, not red; orphaned blocks grey out instead of
   snapping into the program.
2. **Block editor, data-science goal** — Data Science is a collapsed parent drawer holding ten
   pipeline stages.
3. **Block editor, hybrid goal** — both families visible at once; read as two families, not
   twenty-six colours.
4. **Debug mode** — drawer docks *beside* a running viewport (lateral, caption strip still
   beneath the canvas); header's view zone grows a debug group; breakpoints offered only where
   they can fire; Pause says "Pausing…" first; "Next frame" moves the ball one step.
5. **The trace table** — Setup/constants collapsed section; the watch box; wide values with
   fixed decimals; expand-on-click detail row; clicking a variable name highlights its block.
6. **The Help page** — eight category chips are the actual block colours, other 51 unchanged;
   three false Debug claims corrected; right-click → Help lands on the entry.
7. **The start menu** — goal badges in family colours.
8. **The welcome page** — playground particles are product colours.
9. **The viewport in light mode, running a template** — background is the light theme's, not a
   hardcoded navy.
10. **The Trace toggle without Debug** — drawer opens on its own, toggle shows active state, no
    debug controls appear.

Plus the ledger's accumulated deferrals to fold into the same pass:
- **T9** drag-checks: scalar rejected from pos slots; vector/arithmetic snaps including the
  widened `math_arithmetic`.
- **T10** orphan greying across all three goals, the Gravity value-chip greying, and Plan 2's
  starter-chip/search-insert re-checks.
- **T12** label eyeballs.
- **T13** plain-English error messages (note: Step 3 exercised `describeRunError` live — the
  wording itself reads correctly, e.g. "Python couldn't read one of your lines. There's a typo
  near the reported line." — it's the *underlying* Run that's broken, not the message layer).
- **T14** breakpoint context-menu / Alt-click / hollow markers.
- **T15** pause chip truth + Next-frame stepping + highlight pin — **automatedly verified as
  part of Step 3's recovery pass** (Pausing…→Paused honest ack, Next frame advances the
  iteration counter by exactly one); still worth the human pass's own eyes for the highlight-pin
  visual and general feel, but no longer blocked on Run being broken.
- **T16** Setup/Watch sections + value legibility + 200px drawer floor.
- **T17** the 8-point drawer/toolbar pass + the 1024px header fit (~990px estimate).
- **T11** help deep-links (right-click → Help opens a NEW TAB landing focused — known quirk).

**Added by the final-review fix wave** (see that section at the end of this report):
- **Plan-3 close-out carry — the trashcan and the toolbox rail as delete targets.** Drag a block
  onto the trashcan: it deletes, and the lid opens red while a block hovers over it. Drag a block
  onto the toolbox rail instead: the rail tints and the block deletes there too. `Ctrl+Z` restores
  it in both cases.
- **Code view under debug mode.** Switch to Code view with debug mode on and confirm the surface
  now matches what the Help page has always told students: **no breakpoint gutter** (no red dots,
  no hollow rings, no executing-line arrow in the glyph margin — the whole dead surface is
  deleted), while **Pause / Next frame / Next value still work** and the pause chip still reports
  the iteration.
- **The drawer-resize gesture.** Drag the drawer handle up and down, release outside the handle,
  and confirm no cursor or text-selection state sticks afterwards (the resize cursor reverts and
  nothing is left selected across the pane).

Also flagged per the brief: the 49 `e2e/*.png` are invalidated by items 1–5 and 9. One
screenshot-refresh commit recommended *after* the human pass, not during (not done here, per
instruction 8).

---

## Files changed this task

- `frontend/src/components/Icons.js` — deleted unused `SeparatorDot` export (commit `e690cf2`).
- `README.md` — added three paragraphs after the design-token paragraph, one sentence corrected
  from the brief (commit `5952a0d`).
- `docs/product-contract.md` — two rationale-cell appends (:34, :38); did NOT touch :101/:107,
  which are already stronger than the brief's proposed text (commit `5952a0d`).
- `frontend/src/utils/runner/glowRunner.js` — touched only transiently for diagnosis during the
  first Step 3 pass; reverted; zero net diff by me (verified via `git diff` at the time). The
  file's real, lasting change is the controller's own fix in `68bfe6e`
  (`injectFrameBoundaries()` + 8 new tests in
  `frontend/src/utils/runner/__tests__/glowRunner.test.js`), which I did not author — only
  re-verified.

No other files were modified by me. No `.superpowers` files besides this report and no e2e
screenshots were touched.

---

## Self-review

- Every Step 1 grep was actually run against the live tree, not assumed; every deviation from
  the brief's literal expectation is backed by inspecting the actual matching lines, not
  pattern-matching on the controller's hints alone (e.g. the `dm-panel` and `window.Blockly`
  hits were individually read in context, not just counted).
- The SeparatorDot deletion was verified both before (single definition, zero call sites) and
  after (grep clean) the edit.
- Step 2 gates were run against the tree *after* the SeparatorDot commit, so they reflect the
  actual final code, not a stale pre-fix state.
- Step 3's regression finding was independently corroborated three ways before being written up:
  (a) reproduces on `vite preview` (built) with blocking, (b) reproduces on `vite preview`
  without blocking, (c) reproduces on `vite dev` without blocking — ruling out both "offline
  artifact" and "test-harness timing artifact" as explanations before concluding it's a real
  product regression. Root cause was confirmed with `node --check` against the actual failing
  string, not inferred from the error message alone.
- The diagnostic instrumentation added to chase down the regression was reverted; `git diff`
  against `glowRunner.js` is empty, confirmed by direct diff output, not just by memory.
  All ad hoc test scripts/screenshots were created outside the repo or deleted; `git status` is
  clean.
- Both background servers were killed by PID after each pass (`vite preview` :4173 and
  `vite dev` :3000 on the first pass; `vite preview` :4173 again on the recovery pass);
  confirmed down via `curl` returning connection failures and `netstat` showing no listeners
  each time.
- The two documented deviations from the brief's literal docs text (line :107, README's Monaco
  sentence) were each checked against the actual shipped code (Monaco's dynamic import module,
  the built `dist/assets/` manifest) before being written, not assumed from the doc's own prior
  wording.
- §36 orphan wording was checked against `orphans.js`'s actual `planOrphanState` implementation,
  per instruction 5, even though the brief's edits didn't directly touch that section.
- The recovery pass did not just trust the controller's "re-review-verified" claim: I
  independently rebuilt, re-blocked the three domains, and re-drove the exact same interaction
  sequence that had failed before, plus read the fix's diff and its new test file myself before
  calling it verified. The two harness gaps found along the way (missing WebGL flags, wrong
  frame scope for the canvas check) were each reproduced, understood, and fixed in the harness
  before being written up as "not a product issue" — not asserted from assumption.
- Checked whether the fix commit required any adjustment to the Step 4/5 docs commit's wording:
  it does not (the docs describe the palette/toolbox/vendoring/debug-UX, none of which reference
  the `rate()` instrumentation internals) — confirmed by re-reading both diffs side by side, not
  assumed from "it's a different file."

## Concerns

1. **(Resolved)** `frontend/src/utils/runner/glowRunner.js:400-406` broke Run for any VPython
   program using `rate()` — i.e., essentially all physics simulations — with a JS
   `SyntaxError`, in every environment tested. Root-caused to commit `d80a5158` (Task 15),
   reported rather than patched per instructions, and fixed by the controller in `68bfe6e`.
   Independently re-verified live: real Run, real WebGL canvas, real telemetry (45 samples,
   correct trajectory), and honest pause/step. No further action needed.
2. The pre-fix 448-strong unit-test suite did not exercise a real browser `eval()` of the
   compiled RapydScript output, so it did not catch the regression above — the fix commit closes
   this specific gap with 8 new tests covering the bare/awaited/parenthesized `rate()` shapes,
   but it's worth noting for future instrumentation work on this file that jsdom/mocked-eval
   tests alone would not have caught this class of bug; a real-browser or captured-fixture check
   was needed.
3. Two small, documented deviations from the brief's literal docs text (`product-contract.md`
   lines :101/:107 left unchanged; README's Monaco sentence corrected) — both because the
   brief's assumed baseline was stale relative to Plan 3's already-landed Monaco bundling. Full
   justification is in the Step 4/5 sections above. No further doc changes were needed after the
   `rate()` fix landed.

---

# Final-review fix wave

One Critical, three Important, and a five-item cleanup list, applied in a single wave on
`feature/classroom-platform` at `68bfe6e`. Baseline before the wave: **456 passing across 61
files**. After: **467 passing across 60 files** (+11 net; +15 new, −3 from a deleted unreachable
suite, and −1 file). No dev server, no e2e screenshot refresh.

## C1 (Critical) — a watch expression injected a dedented probe before `else:`

**File:** `frontend/src/utils/runner/instrumentor.js`

The watch splice took its INDENT from the first loop-scope probe (`loopBodyIndent`) but its
POSITION from the last one (`lastLoopLineIndex`). When the last traced assignment sat inside an
`if` branch with an `else:` after it, the watch line was emitted at the outer indent *between*
the if-body and the `else:` — a Python `SyntaxError` at compile, which `describeRunError` then
reported as a typo in the student's own code. Any bounce-counter-shaped program with a watch
armed was dead on Run.

### RED evidence

Two new tests failed against the unfixed module, both naming the exact reported shape:

```
FAIL … > if/else in the loop body — with a watch armed
AssertionError: if/else in the loop body line 16: probe "    _phtr_watch_0 = str(t)"
  strands "    else:": expected 4 to be greater than 4

FAIL … > a watch probe lands AFTER the whole if/else, still inside the loop body
AssertionError: the watch probe must clear the whole if/else: expected 15 to be greater than 16
  (the watch landed at output line 15; `    else:` is line 16)

 Tests  2 failed | 16 passed (18)
```

### The fix

`instrumentor.js:102-115` (new `enterLoop` helper) and `:129-165`:

- `lastLoopLineIndex` (last *probe*) is replaced by **`lastLoopBodyIndex`** — the output index of
  the last line **belonging to the loop body**, i.e. every non-blank, non-comment source line at
  indent `> loopBaseIndent`, plus each loop-scope probe emitted after one (`:180`). By the time
  that line is reached, the source has already closed every nested `if`/`try` inside the body, so
  the dedent to the body indent has no continuation clause left to orphan.
- `loopBodyIndent` now comes from the **first line of the loop body** (`:163`), not the first
  probe, so it is the body's real indent whether or not that line is traced.
- Both are reset per-loop by `enterLoop()`, and a `while` at or outside the current loop's indent
  now starts a new loop (a *deeper* `while` is nested and does not reset) — so the indent used
  for the splice always belongs to the loop the splice lands in.
- Trailing blank/comment lines are not tracked, so the probe lands after the last real statement,
  not after the loop's whitespace; and `insertAt === output.length` is handled by `splice` when
  the loop is the last block in the file.
- Removed a dead branch while there: the exit-detection's `newLoop` re-entry could never fire —
  any line matching `^(\s*)while\s+` is intercepted by the earlier `loopMatch` block and
  `continue`s first.

### The structural-syntax test (the `rate()` lesson, pinned)

`frontend/src/utils/runner/__tests__/instrumentor.test.js:78-247` — a new
`describe("instrumented output is structurally valid Python")` with two structural assertions
applied to **every** fixture, since nothing here can compile Python:

1. **`assertIndentationIsConsistent`** — walks the instrumented source maintaining a stack of open
   indent levels, exactly as Python's tokenizer does: a line must match the open block's indent,
   open a deeper one only directly after a `:` header, or dedent to an indent some enclosing
   block already uses. Catches any probe emitted at an indent no block ever opened.
2. **`assertNoProbeStrandsAContinuation`** — no `_phtr_` probe may sit immediately above an
   `else` / `elif` / `except` / `finally` at its own indent or shallower. This is the assertion
   that goes RED on C1; check 1 alone does not catch it, because the stranded dedent is a legal
   dedent in isolation.

**Shape coverage** — four fixtures, each run twice (watch armed / no watch = 8 tests):

| Shape | What it pins |
|---|---|
| plain loop | the baseline: probe at the end of a flat body |
| **if/else in the loop body** | the C1 shape — traced assignment inside the `if`, `else:` after it |
| nested if, no else | a dedent across **two** levels (12 to 4) at the end of the body |
| try/except in the loop body | `except:` as a continuation at the body's own indent |

Plus two targeted tests: the watch probe must land *after* the whole if/else and read exactly
`    _phtr_watch_0 = str(t)`; and a source with trailing blank lines must not push the probe out
of the loop.

## I1 (Important) — the pause readout was hidden at the 1024px floor

`frontend/src/styles/chrome.css:266-276` hid `.tb-chip--quiet` at stage 2, and stage 2
(`max-width: 1120px`) is active *at* the declared 1024px floor. From 1024–1120px the
`Paused · iteration N` / `Pausing…` chip and its `aria-live` region did not render at all.

**Fix** — it shortens instead of disappearing:

- `frontend/src/components/Toolbar.js:129-141` — a new `pauseLabel` derives `{ full, short }`
  from `pauseState`/`iteration`. The short form keeps both facts the chip carries (state +
  iteration number) and drops only the word "iteration": `Paused · 42`, `Pausing…` (never
  abbreviated), `42`.
- `frontend/src/components/Toolbar.js:433-445` — the chip renders `stage2 ? short : full` as a
  **single text node** inside the same `aria-live="polite"` span, so what is announced is exactly
  what is shown; `title` carries the full phrase for hover. (A visually-hidden second copy was
  rejected: it duplicates the text in the accessibility tree and in `textContent`.)
- `frontend/src/styles/chrome.css:276` — `display: none` becomes `padding: 0 4px`; CSS only
  tightens now.

**Covering assertions** — `frontend/src/components/__tests__/ToolbarResponsive.test.js:112-146`,
in the existing stage-2 describe (which already drives `matchMedia`): the chip exists at stage 2,
keeps `aria-live="polite"`, reads exactly `Paused · 42`, and carries the full phrase in `title`;
`Pausing…` is never abbreviated; and a new full-width describe pins `Paused · iteration 42`.

## I2 (Important) — the dead code-mode breakpoint surface, deleted

Ruling followed: deleted, not wired.

**Confirmed no live consumers before deleting:**

- `<CodeEditor>` has exactly **one** call site, `frontend/src/components/layout/IDELayout.js:580`,
  and it passes only `value` / `isDark` / `readOnly` / `onChange`. (Repo-wide grep for
  `CodeEditor` returns that call site, the import at `:31`, an architecture comment at `:15`, the
  component itself, and its two test files.)
- Repo-wide grep for `breakableLines` / `breakpointLines` / `onToggleLineBreakpoint` /
  `executingLine` outside `CodeEditor.js` and the deleted test: **zero** hits. (`BlocklyWorkspace`
  has its own separate `breakpoints` / `isBreakable` / `executingBlockId` props — untouched.)
- Repo-wide grep for `dbg-glyph-bp` / `dbg-glyph-breakable` / `dbg-glyph-executing` /
  `dbg-executing-line`: only their definitions in `workspace.css` and their use as Monaco
  decoration class names inside `CodeEditor.js`. No `.js`, `.html`, `.css` or e2e reference
  anywhere else.

**Deleted:**

- `frontend/src/components/CodeEditor.js` — the four debug props, `onToggleBpRef` /
  `breakableLinesRef`, the three decoration-id refs, the `glyphMargin` editor option, the
  `editor.onMouseDown` gutter-click handler, and the three decoration `useEffect`s. The component
  is now `({ value, onChange, isDark, readOnly })`. Monaco fallback path, theme sync, readOnly
  sync and value sync are untouched. A header comment records **why** it is gone (the chain was
  doubly broken: `setBreakableIds` only runs in `syncFromBlocks`, which text mode skips, and
  `breakableIdsFromRegistry()` reads the block trace registry, which never sees the
  instrumentor's `codeTraceEntries`) so nobody re-adds it as a "missing feature".
- `frontend/src/components/__tests__/CodeEditor.breakableLines.test.js` — unreachable (3 tests).
- `frontend/src/styles/workspace.css:269-305` — the whole "Code-editor debug decorations
  (Monaco)" block, replaced by a 5-line comment pointing at `CodeEditor.js`.

**Scope note:** the ruling enumerated three rules; I deleted **four**. `.dbg-executing-line` (the
executing-row background highlight) was the `className` half of the same `executingLine`
decoration whose `glyphMarginClassName` was `.dbg-glyph-executing`, so removing that prop orphans
it identically. Leaving one unreferenced rule behind from the same deleted decoration would have
been the same dishonesty this finding exists to remove. Flagging it explicitly since it is one
item beyond the letter of the ruling.

One stale cross-reference cleaned: `BlocklyWorkspace.breakpointMenu.test.js:15` cited the deleted
file as the convention it follows for `vi.mock`; it now cites `WorkspaceTrash.test.js` only.

## I3 (Important) — `bp-block` is now debug-gated like its siblings

`frontend/src/components/BlocklyWorkspace.js:620` — `const isBp = breakpoints.has(block.id)`
becomes `const isBp = debugMode && breakpoints.has(block.id)`, matching `bp-available` (`:621`)
and `block-executing` (`:638`). Breakpoints arm only in debug mode and the set survives leaving
it, so an ungated `.bp-block` painted solid red outlines over a student's blocks outside debug
mode: they press Run, nothing pauses, and the marker has lied.

**Covering assertion** — `BlocklyWorkspace.breakpointMenu.test.js:206-228`: mounts with
`breakpoints: new Set(["blk-1"])` and `debugMode` on (`bp-block` present), then remounts with
`debugMode={false}` and asserts both `bp-block` and `bp-available` are gone — the breakpoint is
still *set*, it just stops advertising itself. The existing fake Blockly gained a `blocksRef`
(hoisted, reset per test) and a `fakeBlock()` helper whose SVG root records toggled classes.
**RED-verified**: reverting the one-line gate fails it with `expected true to be false`.

## Cleanup list

1. **`math_arithmetic` widening hardened** — `frontend/src/utils/blockly/blocklyGenerator.js:1906-1913`:
   `this.getInput("A")?.connection?.setCheck(...)`, same for `"B"`, and
   `this.outputConnection?.setCheck(...)`. A future Blockly rename now degrades to "no widening"
   instead of throwing inside `init` and killing every arithmetic block on the workspace.
2. **`STYLE_CATEGORY_ALIASES` deleted** — `frontend/src/utils/blockly/blockPalette.js:319-323` and
   its export at `:338`, replaced by a comment recording the retirement. Verified first that no
   registry entry still carries `category: "Starter"` or `"Scene"` (grep: 0 hits — Plan 4 Task 4's
   re-categorisation removed both). Its only remaining consumer, the now-no-op `??` fallback in
   `frontend/src/utils/blockly/__tests__/blockStyles.test.js:13`, is gone too: the test maps
   `entry.category` straight through `styleNameFor`, which is the invariant it was always meant
   to assert.
3. **Stale `useSimulation.js` narration corrected** — the `endRun` JSDoc (`:25-38`) claimed debug
   enter/exit tear the run down through it, and the `runGenerationRef` block comment (`:115-128`)
   claimed those paths bump the generation. `useDebug.js` does the opposite and load-bearingly so:
   `handleEnterDebug` pauses, `handleExitDebug` resumes, and exit must NOT bump the generation or
   a pause-ack timer armed moments earlier would be judged stale and skip its own cleanup. Both
   comments now say that, including *why* the non-bump matters. Also dropped "debug-enter" from
   the list of things that can supersede an in-flight run.
4. **`visibleControls.js:1-9` softened** — "Toolbar renders ONLY what these lists contain" now
   reads "Every keyed control in the header comes from these lists", with the one exception named:
   the debug group, which `Toolbar.js:381-445` renders inline behind a bare `{debugMode && …}`
   because it is a single block with no per-control visibility and no place in a zone's ordering.
5. **Browser-pass checklist amended** — three items added under "Plus the ledger's accumulated
   deferrals" in Step 7 above: the Plan-3 close-out trashcan/rail carry (drag to trashcan, lid
   opens red on hover; drag onto the toolbox rail, it tints and deletes; `Ctrl+Z` restores), a
   Code-view debug check confirming the surface now matches the Help text (no breakpoint gutter;
   Pause / Next frame / Next value still work), and the drawer-resize gesture (no stuck cursor or
   selection state).

## Verification

```
npx vitest run
 Test Files  60 passed (60)
      Tests  467 passed (467)
```

Per-file deltas (baseline to after): `instrumentor.test.js` 8 → 18; `ToolbarResponsive.test.js`
6 → 9; `BlocklyWorkspace.breakpointMenu.test.js` 11 → 12; `CodeEditor.breakableLines.test.js`
3 → deleted. Net **+11**, 456 → 467. Baseline re-measured from a clean `git stash` of this wave to
confirm the arithmetic.

```
npm run check:blocks
✔ Registry OK: 120 entries in 19 categories; 120 toolbox ids and 26 drawers reconcile both ways.
```

Message unchanged from baseline.

```
npm run build
✓ built in 24.49s
```

Only the pre-existing >500 kB chunk-size advisory (monaco / editor.api / index), unchanged.

## Concerns

1. **C1 is the third injection bug from this module**, and the two structural checks added here
   are still a *model* of Python's grammar, not Python. They pin indentation validity and the
   continuation-clause hazard — the two shapes that have actually shipped broken — but a fourth
   bug of a different kind (a malformed expression, a name collision) would slip past them. The
   durable fix remains a real-browser or captured-fixture compile check of the instrumented
   source, which Step 7 of this report already flags and which is out of scope here.
2. **The `assertIndentationIsConsistent` "opens a block" test is `stripped.endsWith(":")`**, which
   is exact for the statement shapes in these fixtures but would misread a line ending in a dict
   literal or a slice. Noted in the test file. If a future fixture needs one, the helper needs a
   real tokenizer, not a patch.
3. **I1's short form shortens the screen-reader announcement too** (`Paused · 42` rather than
   `Paused · iteration 42`) at 1024–1120px. This was a deliberate trade for a single text node —
   one source of truth for what is shown and what is announced — over a visually-hidden duplicate.
   State and iteration number both survive; only the word "iteration" is dropped, and `title`
   restores it. Worth a human ear on the narrow-viewport pass.
4. **I2 removed a surface, not a capability** — code-mode breakpoints have never worked. If the
   product later wants them, the real work is two chains, not a prop: populate `breakableIds` in
   text mode, and teach `breakableIdsFromRegistry()` about the instrumentor's `codeTraceEntries`.
   The deletion comment in `CodeEditor.js` records this so it is not rediscovered as a bug.
5. **I3's gate is on the decoration only.** Leaving debug mode still *keeps* the breakpoint set
   (`useDebug.handleExitDebug` does not clear it), which is the right behaviour — re-entering
   debug restores exactly what the student had. But it does mean a breakpoint can exist with no
   visible trace of it while outside debug mode. That is the honest arrangement (a marker that
   cannot fire must not be drawn) and matches `bp-available` and `block-executing`; flagging it in
   case the browser pass expects the set to stay visible.
