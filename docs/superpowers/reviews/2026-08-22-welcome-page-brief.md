# Welcome Page Brief

**Produced:** 2026-08-22 by a multi-agent discovery workflow (design-system map, surface audit, spec inventory, capability inventory).
**Status:** research input — not yet applied.

---

# Welcome Page Brief — Physics IDE

**Status:** design + content brief for rebuilding `frontend/src/welcome/WelcomePage.js` (and its styles) into a genuinely informative front page.
**Scope:** content, structure, visual system, responsive behaviour, and the honesty boundary. Gate behaviour is unchanged and is a hard constraint.

---

## 0. The problem in one line

The current page is a door with six adjectives on it. It has a hero, six 30-word cards, a gravity toy, and a footer — a visitor leaves knowing the product exists but not what it *does*. The directive is to make it informative: a person should be able to read this page and correctly decide whether Physics IDE is the tool for their lesson, their homework, or their department — without signing up, and without being told anything untrue.

The constraint that makes this hard: roughly a third of what the classroom spec describes is not built. The page gets longer and more specific, which means every added sentence is a new chance to promise something that does not exist. Section 5 is the enforcement list.

---

## 1. Who the page serves

Three readers, in descending order of how much the page has to do for them.

### 1.1 The guest exploring (primary — design for this person)

A curious learner, a self-teaching student, a hobbyist, or a teacher who has not yet decided to sign in. They arrived from a link, a search, or a colleague. **They have no account and they should never feel they need one.**

They arrive asking: *What is this? Is it a toy or a real tool? Do I have to install anything? Do I have to sign up?*

They must leave knowing:
- It runs entirely in the browser — nothing to install, nothing sent to a server to compute.
- There are two ways to build the same project (blocks, real Python) and you can switch at any time.
- It renders live 3D physics, and it also does a full data-analysis pipeline — these are two halves of one product, not a physics tool with a chart bolted on.
- Guest mode is the complete product. Nothing is held back.
- Their work saves to their own machine and keeps working with the Wi-Fi off.

The page fails this person if it reads like a marketing page for something they must buy into. The single most persuasive move available is **specificity** — 151 blocks, 6 datasets, 18 worked examples, a real debugger — because specificity is the thing a brochure cannot fake.

### 1.2 The student joining a class (shortest path — do not slow them down)

Arrives via a join code, a join link, or a QR code projected on a whiteboard. Often on a phone, because the QR was scanned with a phone.

They arrive asking: *I was told to sign up here. What do I type? Will this work on my phone?*

They must leave knowing, within one screen:
- Where "Sign in" and "Create an account" are (top of the page, always).
- That signing in means their projects follow them between school and home.
- That the IDE itself wants a laptop or desktop — **this page is the only surface in the product that a phone will realistically load**, so it must say so plainly rather than letting them discover it by scrolling a broken editor.
- That signing out on a shared computer clears the projects pulled down from their account, while guest work stays put.

Design consequence: the three doors must be reachable without scrolling on a phone, and the page must not bury the sign-in path under 2000px of feature copy.

### 1.3 The teacher evaluating (deepest read — give them the most detail and the most honesty)

A physics or science teacher, possibly a head of department, deciding whether to put this in front of 30 students next term. They are the reader most likely to read every word, and the reader most damaged by an overpromise: they will build a term plan on it.

They arrive asking: *Can my students use this without accounts? What does it cost me to set up? Can I collect and mark work? Is it spying on my kids? What happens when the school Wi-Fi drops?*

They must leave knowing:
- Classes exist today: create a class, four ways to let students in (code, link, QR, email invite), three join policies, a full roster, roles including a teaching-assistant hat, archive at year end.
- **Assignments and marking do not exist yet.** Stated once, plainly, in the classroom section — not hidden in a footnote and not softened into ambiguity.
- Teacher signup is open to anyone — no approval queue, no institutional licence.
- The site has a hard 200-account cap.
- There is no surveillance layer: no paste detection, no webcam, no keystroke scanning. There is an append-only event log of signups and class joins, and that is the whole of it.
- Everything computational happens in the browser, so a dead network stops sync, not work.

The honest "not yet" line is an asset with this reader, not a liability. A teacher who is told what is missing trusts what they are told is present.

---

## 2. Section-by-section content outline

Structure: hero → doors → a short "what it is" band → seven substantive sections → numbers → playground → classrooms → honesty footer. Roughly 9 screens of scroll on a laptop. Every section carries an eyebrow micro-label, one headline, 2–4 sentences of body, and where possible **one concrete artefact** (a code snippet, a keycap row, a chip list) rather than more prose.

Copy below is written to be used close to verbatim. Every factual claim is traceable to the verified inventory; the "do not write" notes are the traps found in the current copy.

---

### §1 — Hero (keep, tighten)

Keep the orbit motif, the h1, and the three doors. Change the tagline to do work.

- **h1:** `Physics IDE`
- **Tagline (replaces "Build, run, and understand physics — right in your browser."):**
  > Build a physics simulation with blocks or with Python, watch it run in 3D, then analyse the data it produced — all in the browser, with no account and nothing to install.

  That single sentence names all four pillars (two editors, 3D, data, no account). Keep it to one sentence; the current tagline's problem is not length, it is that it says nothing a hundred other tools could not say.
- **Sub-line, small, `--text-dim`:** `Free, offline-capable, and open to guests. Built for physics classrooms.`
- **Three doors, unchanged in destination and order:**
  1. `Use the IDE — no account needed` → `/` (the one filled primary)
  2. `Create an account` → `/auth/signup`
  3. `Sign in` → `/auth/signin`
- Under the doors, one line of reassurance: `Guests get the complete IDE. Nothing is held back.`

**Do not write:** "the world's first", "AI-powered", any claim about number of users or schools.

---

### §2 — "What it is" band (new, short)

Three inline statements immediately below the fold, no cards — a fast orientation for someone who will not scroll far.

> **Runs in your browser.** GlowScript 3.2 VPython, the Monaco code editor and the block editor all ship with the app. No server does your physics.
> **Two editors, one project.** Drag blocks or write Python — the toolbar toggle switches views, and the blocks generate readable Python you can flip to and inspect.
> **Three kinds of project.** Physics modelling, data science, or hybrid — a simulation and the analysis of the data it just produced.

---

### §3 — Blocks and code

**Eyebrow:** `The editor` — **Headline:** `Start with blocks. Move to Python when you're ready.`

Copy points:
- 151 block types in the toolbox: 120 purpose-built for physics and data, plus 31 standard Blockly blocks in an Advanced drawer.
- 19 drawers: Values, Objects, Motion, State, Control, Logic, Math, Variables, a ten-stage Data Science drawer, and Advanced (3D Math, Raw Python, Loops, Text, Lists, Functions).
- The toolbox filters itself to the project's goal — a physics project never shows data blocks; a data project never shows Objects or Motion.
- Search the whole library by name or keyword from the box above the canvas; results insert straight into the program.
- Right-click any block → **Help** jumps to that block's entry in the built-in documentation.
- Blocks generate Python you can read. The Blocks/Code toggle sits in the toolbar.

**Artefact for this section:** a small side-by-side — a described block stack on the left, the generated Python on the right, in `--mono` with `--accent-blue` / `--accent-green` accents. This is the single highest-value visual on the page; it proves the "readable Python" claim instead of asserting it.

**Do not write:** that Python edits round-trip back into blocks (not claimed anywhere in the inventory — do not imply it).

---

### §4 — The 3D viewport

**Eyebrow:** `Watch it run` — **Headline:** `Physics you can see happening.`

Copy points:
- Simulations render live in a 3D viewport — GlowScript 3.2 VPython, shipped with the app, so it works offline.
- Physics blocks: spheres, boxes, cylinders, arrows, helixes and springs, glowing spheres, trails, text labels, point lights, scene and camera.
- Motion blocks: set velocity, update position (`pos += v·dt`), apply force (`v += a·dt`), gravity, rotation — plus vector maths: magnitude, unit vector, dot, cross, trig, clamp, min/max, power.
- Camera controls float over the scene while it runs: reset camera, fit scene to view, fullscreen, and pop a snapshot into a new tab — no stopping and restarting.
- Drag the divider to resize editor and viewport, or hide the viewport and work full-width.

**Artefact:** a `<kbd>` row using the IDE's own keycap styling — `Ctrl` `Enter` run · `Esc` stop · `Ctrl` `S` save. Exactly these. There are four hotkeys in the product and no more.

**Do not write:** "collisions" (the current card says this; there is no collision block in the registry). Do not write "Ctrl+C to copy" — deliberately unbound.

---

### §5 — The debugger (the strongest differentiator — give it a full section)

**Eyebrow:** `Look inside` — **Headline:** `A debugger that doesn't lie to you.`

This is the section most likely to convince a teacher, because it is the thing block-based physics tools do not have.

Copy points:
- Debug Mode pauses and resumes with `Space`, steps one animation frame with `F10`, steps to the next reported value with `Shift+F10` — all while the simulation stays on screen.
- Set breakpoints by right-clicking a block or Alt-clicking it. Blocks that *can* pause show a dashed outline; blocks with a breakpoint show a solid red one; the toolbar shows how many are set.
- **If a program has no traced values to pause on, it says so plainly instead of hanging.** Call this out explicitly — it is the "doesn't lie" claim, and it is real.
- A live variable panel shows every value as it changes, grouped into setup constants, live loop values, and your own watch expressions, each row carrying a sparkline of its history.
- Pin variables, filter the list, set a threshold alert, take a snapshot to compare against, and click a variable name to light up the block that sets it.
- Type any Python expression into the watch box — total energy, for instance — and see it evaluated every frame on the next run.

---

### §6 — From a run to a dataset

**Eyebrow:** `Measure it` — **Headline:** `Turn a simulation into data you can analyse.`

Copy points:
- **Record a run** to capture every value, then export it as CSV — or press **Chart** to turn that recording into a dataset.
- When saving a run as a dataset, choose exactly which variables to keep and crop it to a time range — useful for cutting a projectile off before it bounces.
- Hybrid projects show the 3D viewport and the data panel stacked in one pane, so a simulation and its analysis sit side by side.

**Do not write:** "every run captures data" (the current card's phrasing). Recording is opt-in — say *record a run*.

---

### §7 — The data-science half

**Eyebrow:** `Analyse` — **Headline:** `A full data pipeline, in the same blocks.`

This is 58 of the 120 blocks and it is currently represented on the page by one card reading "Charts & data". It needs its own section, and it is the section that sells the product to a lab-report-marking physics teacher.

Copy points:
- **Load:** six built-in datasets, each shipping with column descriptions — Planets (9 rows), Palmer Penguins (30), Weather, Cape Town vs Johannesburg (28), Pendulum lab measurements (56), Spring / Hooke's law (8), Free fall (12). Or load your own CSV, or a dataset promoted from a simulation run.
- **Explore:** show the table, first/last N rows, one column, one cell, count rows, count columns, list column names, count unique values, identify a column's data type.
- **Describe:** mean, median, mode, min, max, range, sum, count, standard deviation, percentile, interquartile range, an all-statistics summary for one column, and a side-by-side comparison of two.
- **Uncertainty, built for lab work:** standard error of the mean, print a measurement as value ± uncertainty, relative uncertainty as a percentage.
- **Relationships:** fit a straight line by least squares and get slope, intercept, R² and n written out as an equation with a plain-English verdict on the fit — Excellent, Strong, Moderate or Weak. Pearson's r is its own block.
- **Linearise:** a transform-column block (ln, log₁₀, √, x², 1/x) or multiply two columns into a new one — the standard trick for straightening a curve.
- **Shape:** filter rows (equals, greater than, less than, or two conditions with AND/OR), sort, drop missing values, find the rows where a value is missing, count per group, mean per group.
- **Chart:** bar, line, scatter, histogram, box plot, and scatter with a regression line. Charts save as image files.
- **Communicate:** write a note, print a result, compare two results side by side, state a conclusion, export the table as CSV, and reveal the generated Python behind your blocks.
- **The pipeline re-runs as you change blocks** — table, statistics and charts refresh live.

**Do not write:** "press Run to see your analysis." Data-science projects have no Run button by design; the Run/Stop controls only appear for physics and hybrid goals. Getting this wrong teaches a student a control that isn't there.

---

### §8 — Starting points

**Eyebrow:** `Don't start from nothing` — **Headline:** `18 worked projects, ready to open.`

Copy points:
- Four pre-coded Python examples: Projectile Motion with air drag and telemetry; Spring-Mass Oscillator with live energy readouts; a Sun–Earth–Moon three-body orbit using velocity-Verlet; a Nonlinear Damped Pendulum.
- The same four rebuilt as block templates.
- Seven data-science investigations: Penguins exploratory analysis, a two-city weather comparison, Planets and Kepler's third law, repeated-measurement uncertainty, Hooke's law regression, pendulum linearisation, and free fall to measure *g*.
- Three hybrid topics that pair a simulation with its matching analysis: measure damping from the pendulum, measure *g* from the projectile, find *k* from the spring.
- An empty canvas offers one-click starter chips — *A ball that falls*, *An animation loop*, *Gravity* for physics; *Load a dataset*, *Show the table* for data — plus a short rotating beginner tip.
- A short wizard at the start asks for a title, blank or template, and which editor to open in; hybrid also asks model-first or data-first.
- Built-in documentation with 14 searchable sections, including Getting Started, Debug Mode, Block Reference, VPython Reference, For Educators and Keyboard Shortcuts.

**Artefact:** render the three hybrid topics as chips — they are the most striking single fact about the product ("measure *g* from your own simulated projectile") and they read better as three short chips than as a sentence.

---

### §9 — Yours, offline

**Eyebrow:** `Your work` — **Headline:** `Saved on your computer first. Always.`

Copy points:
- Projects are named, renameable, save themselves to your browser as you work, and appear on a Continue list with how long ago you touched them.
- Export as Python (`.py`), blocks (`.xml`), a PDF of the code, a PDF of the blocks, a PNG of the 3D viewport (checked to make sure it isn't blank), or a complete project bundle (`.physide.json`). Or copy the code to the clipboard.
- Open files back in: `.py`, `.xml`, and `.physide.json`.
- Signed in, work also syncs to your account — after every save, after every delete, and again when you sign in, return to the tab, or come back online.
- A sync chip tells you the truth at a glance: *Saved on this computer — Synced*, *Syncing…*, or *Waiting for connection*. If the Wi-Fi dies you keep working and it catches up later.
- Start at school, carry on at home on a different computer.
- Sign up after working as a guest and you'll be offered a one-click import of your existing browser projects — or decline, and they stay where they are.
- On a shared computer, signing out clears the projects pulled down from your account; guest work stays put.
- Limits, stated plainly: 100 projects per account, and a size cap per project, both with plain-English messages when you hit them.

**Conflict handling — word exactly like this and no further:**
> If the same project is edited in two places, the most recent edit wins and the older version is kept rather than discarded.

**Do not write:** "browse your version history", "restore an earlier version", "see every version of your work". The backend keeps up to 20 versions and can restore them; **no frontend code calls those endpoints.** A student cannot reach a single old version today.

---

### §10 — By the numbers (new, compact strip)

A row of six mono, tabular-figure stat tiles. Cheap to build, high credibility, and it lets a skimmer absorb the whole product in three seconds.

`151` block types · `18` worked projects · `6` built-in datasets · `6` chart types · `14` documentation sections · `0` servers doing your physics

The last tile is the rhetorical one and it is literally true: GlowScript is vendored, Monaco and Blockly are bundled, and the data-science blocks execute as JavaScript in the browser.

---

### §11 — Feel it work (keep the playground, move it here)

Keep `GravityPlayground` — it is the only interactive proof on the page and it is genuinely on-brand. Two changes:

- Move it below the substantive sections. It currently sits where a "how does this work" section should be; as a reward at the end of the read it works better.
- Retitle from "Feel it work" to something that connects it to the product: **`Rules in, motion out.`** Body: `Drag the gravity slider and click to drop a ball. This box runs the same idea the IDE does — you write the rule, the simulation plays it out.`
- The slider is currently a raw, unstyled `<input type="range">` with no visible label. It needs a real `<label>`, a value readout in `--mono`, and token-based track/thumb styling. There is no range primitive in the system (the IDE's zoom slider was deleted); build one from `--bg-input`, `--border`, `--radius-pill`, `--accent`, and keep it in the welcome stylesheet.

---

### §12 — For classrooms (the honesty section)

**Eyebrow:** `For teachers` — **Headline:** `Classes today. Assignments next.`

Lead with the "next" in the headline so nobody feels sold to. Then be specific about what exists:

- Anyone can sign up as a teacher — one checkbox at signup, no approval queue.
- Create a class with a name and an optional subject or year label. A class wall shows every class you're in and which role you hold in it.
- Four ways in: a short join code (like `KQ4-7PM`), a copyable join link, a QR code rendered on the class page for projecting onto the board, and email invites you can paste as a whole list.
- Invite people as students, teaching assistants, or co-teachers. Pending invites can be resent or revoked.
- Three join policies per class: **open** (anyone with the code joins instantly), **approval** (joiners wait on a list you approve or deny), or **paused** (nobody can join). Regenerate the code at any time to retire the old one.
- A People tab with the full roster — names, emails, roles — and the ability to remove a member.
- Archive a class at year end and it becomes read-only for everyone; unarchive it later. Archived classes collapse onto their own shelf.
- Five roles: guest, student, teacher, teaching assistant (a per-class hat), and site admin.
- A site-wide 200-account cap, enforced by the system itself.

**The honest paragraph — include it, set apart in a `.card--panel`, not hidden:**
> **Not yet built.** Assignments, submissions, marking, feedback and a gradebook are designed but not shipped. A class today holds its roster, its join settings and its people — the Assignments tab says so itself. When marking arrives it will be announced here.

**Privacy, as its own short block:**
> No tracking, no paste detection, no webcam, no keystroke logging. The platform keeps an append-only record of account signups, class joins and join requests — that is the whole of the monitoring, and it exists so a join can be audited, not so a student can be watched.

---

### §13 — Footer

- One line on scope: `The IDE needs a laptop or desktop — 1024px or wider. This page reads fine on a phone.` (Honest, useful to the QR-scanning student, and it pre-empts the worst first impression the product can make.)
- Replace `Free for classrooms.` — it reads like a pricing tier. Use: `No charge and no billing. A hard 200-account cap keeps the site small on purpose.`
- Repeat the primary CTA: `Open the IDE`.
- A quiet link back up to `Create an account` / `Sign in` for the student who scrolled past the hero.

---

## 3. How it should look

### 3.1 First, fix what the current page already breaks

The existing welcome CSS predates the token system and violates it in ten places. The rebuild must clear all of them, because the directive includes "match the modernized IDE's design system."

| Current (platform.css) | Replace with |
|---|---|
| `.welcome-tagline { font-size: 17px }` | `var(--fs-lg)` (17px is a named one-off the scale replaced) |
| `.welcome-play h2 { font-size: 22px }` | `var(--fs-2xl)` |
| `.welcome-hero h1 { font-size: 44px }` | `var(--fs-hero)` — the token exists for exactly this |
| `letter-spacing: 0.5px` | `var(--label-tracking)` (0.02em) — every other tracking in the system is em-based |
| `.welcome-card h2 { font-size: 16px }` | `var(--fs-xl)` |
| `.welcome-card p { font-size: 13px; line-height: 1.55 }` | `var(--fs-md)` / `var(--lh-normal)` |
| `border-radius: 8px` on the canvas | `var(--radius-lg)` (10px) or `var(--radius)` (6px) — 8px is not in the scale |
| `transition: opacity 0.5s` on `.welcome-reveal` | `var(--transition-slow)` (240ms) — 0.5s is a fourth duration |
| `padding: 48px 20px 64px`, `margin: 56px/64px/72px auto 0` | the `--space-*` ramp; 20/56/64/72 are off-ramp |
| `.welcome { color: var(--text-bright) }` | body text is `var(--text)`; `--text-bright` is for headings only |

### 3.2 Icons — collapse the fork

`frontend/src/welcome/WelcomeIcons.js` is a second, parallel icon file: same conventions, but `strokeWidth="1.6"` against `Icons.js`'s 2, a hardcoded 28px against the `sz(size)` prop, and a `BlocksIcon` that **also exists in `Icons.js` with different geometry**. The product ships two different "blocks" icons.

Fold the six welcome icons into `frontend/src/components/Icons.js` as normal `({ size }) =>` exports using the shared `base`/`sz` helpers, delete `WelcomeIcons.js`, and reconcile `BlocksIcon` to one shape. The longer page needs roughly a dozen more icons (debug, dataset, chart, export, class, offline, search, template); every one of them is an addition to `Icons.js`, never an inline one-off.

**No emoji.** Standing rule, restated in both icon files. The original Task-10 spec proposed emoji feature icons; that part of the spec is void.

### 3.3 Colour and identity

- Use `--cat-*` as the section identity ramp, exactly as pane headers do. Suggested: blocks/editor → `--cat-values`, code → `--cat-objects`, motion/3D → `--cat-motion`, data science → `--cat-data-science`, classrooms → `--cat-control`. Section eyebrows carry a 2px top rule or a dot in the category colour; the fill variant, never the `-bright` variant, for anything text sits on.
- **`--cat-*-bright` is decorative only** — orbit dots, glow, the playground balls. Never a text or fill colour that needs contrast.
- **The reserved red band (hue 340°–15°) is off limits.** No red accent, no red category, no filled red button anywhere on this page. Red belongs to errors and breakpoints.
- **One filled primary visible at a time.** The hero's "Use the IDE" is `.btn--primary`; the footer's repeat may also be `.btn--primary` because the two are never on screen together, but nothing else on the page may be filled. Secondary doors are plain `.btn`; in-section links are `.btn--ghost`.

### 3.4 Primitives

- Feature and section cards: `.card` + `.card--interactive` where clickable, `.card--panel` for the opaque "not yet built" notice sitting on `--bg-base`.
- Buttons: plain `.btn`, with `.btn--lg` for the three doors (38px — comfortably above the 32px coarse-pointer floor).
- Section eyebrows: the four `--label-*` vars. Never hand-written uppercase + letterspacing.
- Keycaps: real `<kbd>` with the `.tb-kbd` treatment (`--mono`, `--fs-2xs`, `--key-bg`, `--key-border`). This visually ties the page to the IDE header for free.
- Stat tiles: `--mono` with `font-variant-numeric: tabular-nums`, following `.tb-chip--quiet`.
- Code samples: `--mono`, `--bg-input` ground, `--border`, `--radius-sm`, syntax accents from `--accent-blue` / `--accent-green` only.

### 3.5 Theming

- **`data-theme` attribute only.** There is not one `prefers-color-scheme` rule in the app's CSS and this page must not introduce the first. (`prefers-reduced-motion` is unrelated and stays.)
- Dark is the default and binds to bare `:root`; light is a single `[data-theme="light"]` override block. If any welcome colour needs a light correction that a token swap can't reach, write it as `[data-theme="light"] .welcome-…` — the sanctioned escape hatch, used sparingly.
- Every surface paints an explicit token background; nothing relies on inheritance.
- The page should carry a theme toggle in a top-right corner using the existing `useTheme()` hook — a visitor evaluating the product should be able to see both themes before committing, and the page currently offers no way to.

### 3.6 Motion

- Keep the orbit and the scroll reveal. Retime the reveal to `--transition-slow`.
- `prefers-reduced-motion` is mandatory and the house pattern is **degrade, don't delete**: the orbit stops spinning but keeps its shape (mirror the boot atom, which stops orbiting and keeps a slow nucleus pulse); reveals resolve to their final state instead of never appearing; the playground still accepts clicks and still drops balls, it just doesn't animate the drop with easing flourishes. The e2e suite fails the build if a reduced-motion guard is missing from shipped CSS.
- No new dependencies. CSS keyframes, one IntersectionObserver, one requestAnimationFrame canvas — the existing budget.

### 3.7 Responsive

The welcome page is **currently absent from the platform's only responsive block** (`platform.css:296`, `max-width: 1024px`), so the 44px hero, the 260px canvas and the `minmax(260px, 1fr)` grid have no small-screen handling at all. Fix that, and go further than the rest of the platform does:

- **≥1280px:** three-column feature grid, six-across numbers strip, side-by-side blocks/Python comparison.
- **1024–1280px (the stated minimum):** two-column grid, numbers strip wraps to 3×2, comparison stays side-by-side. Nothing is hidden — the 1024px rule is that nothing load-bearing disappears at the floor, only that it shortens.
- **≤1024px:** single-column cards; hero size becomes `clamp(var(--fs-2xl), 6vw, var(--fs-hero))`; section rhythm drops one step on the `--space-*` ramp; blocks/Python comparison stacks vertically.
- **≤720px (phone — a deliberate exception):** the rest of the product has no obligation below 1024px, but this page does, because a student scanning a projected QR code lands here on a phone. The three doors become `.btn--block` full-width and stack; the numbers strip becomes 2×3; the playground canvas shrinks and keeps `touch-action: none`; the footer's "the IDE needs a laptop" line becomes the most important sentence on the screen and should be given real prominence at this width.
- **Placement warning:** the responsive block in `platform.css` sits at the end of the file for a documented reason — the admin/classes base rules are unconditional and equal-specificity, so source order decides. Welcome's responsive rules must go at or below that block, never above the welcome base rules.
- **Coarse pointer:** `responsive.css`'s `pointer: coarse` bump lists only `.tb-*` classes, so nothing on this page is covered. Either extend that block or size the welcome controls at `--control-h-lg` from the start.

### 3.8 Accessibility (non-negotiable)

- Heading order must be repaired: the page currently has `<h1>` and then `<h2>` for both section titles *and* card titles. Sections are `h2`, cards inside them are `h3`.
- Landmarks: one `<main>`, `<section>`s with `aria-labelledby` pointing at their headings, one `<footer>`.
- Decorative marks (`.welcome-orbit`, card icons) stay `aria-hidden="true"` — already correct.
- The playground slider needs a real associated `<label>` and an `aria-valuetext` carrying units ("12 metres per second squared").
- The playground canvas needs a text alternative describing what it does, and its click-to-drop interaction needs a keyboard equivalent or an honest statement that it is decorative.
- Do not override the global focus ring. The single `:where(...)` rule at zero specificity handles everything; `.auth-input:focus` is the cautionary example of how a 0-1-1 rule silently defeats it product-wide.
- Add a skip link — the page is about to become nine screens long, and the three doors are at the top.

---

## 4. What must not change

### 4.1 The gate, exactly as it is

`frontend/src/welcome/WelcomeGate.js` implements the v2 contract and it is correct. Do not touch it, and do not resurrect the v1 behaviour still shown in the code blocks of the Task 10 plan document (`localStorage WELCOME_SEEN_KEY`, a `projectCount` grandfather, an async `listProjects` read). That plan file contradicts itself; the shipped code is the truth.

The invariants:

- `shouldShowWelcome({ signedInHint, sessionPassed })` returns `!signedInHint && !sessionPassed`.
- `signedInHint` reads `SIGNED_IN_HINT_KEY` from **localStorage**; `sessionPassed` reads `WELCOME_PASSED_SESSION_KEY` from **sessionStorage**.
- The IDE stays at `/`. `WelcomeGate` wraps it and issues `<Navigate to="/welcome" replace />`.
- **The front door appears once per browser session** for a not-signed-in visitor. A new session meets it again.
- Signed-in visitors are never hijacked.
- `/welcome` remains directly and permanently reachable, ungated, forever.
- The whole decision is synchronous — no storage read to await, no flash of the wrong screen.
- Storage blocked (private window, locked-down browser) is caught and treated as a fresh guest.

### 4.2 Every CTA stamps the pass

`WelcomePage`'s `go(path)` helper writes `WELCOME_PASSED_SESSION_KEY` before navigating. **Every new call-to-action anywhere on the longer page must route through `go()`.** This is the single easiest way to break the page: an "Open the IDE" link added in section 8 that uses a bare `<Link to="/">` will bounce the visitor straight back to `/welcome`, and it will look like an infinite loop.

Audit rule for the implementation: zero `<Link>`/`navigate` calls to `/`, `/auth/signup` or `/auth/signin` on this page that do not go through `go()`.

### 4.3 The three doors

Same three, same destinations, same order, same promise. `Use the IDE — no account needed` stays the filled primary, and the "guests get the complete IDE" claim stays true — do not add any copy that gates a feature behind an account.

### 4.4 Budget

No new npm dependencies. The page is CSS keyframes + one IntersectionObserver + one rAF canvas, and it should still be that after the rebuild. If the blocks/Python comparison is tempting to build with a syntax-highlighting library — it isn't worth it; hand-span the tokens.

---

## 5. Explicit non-claims

Every item below is specified in `docs/classroom-platform.md` but **not built**. None of it may appear on this page in any form — not as a feature, not as a screenshot, not as a "coming soon" bullet list that reads like a roadmap promise. The one sanctioned acknowledgement is the single "Not yet built" paragraph in §12.

**Must not be described as things the product does:**

1. **Assignments.** The class Assignments tab is a literal placeholder (`ClassChrome.js` exports `AssignmentsStub`). The database schema has no assignments table.
2. **Everything downstream of assignments:** submissions, snapshots, the submissions inbox, the teacher marking room, read-only submissions, the teacher "test copy", Previous/Next across scripts, marks, feedback, mark release, "return for changes", the gradebook, spreadsheet export, and the student "My marks" / "Due soon" / "Recent feedback" screens.
3. **The instructions/guide page editor** (rich text, images, embedded video, callouts, equations, attachments) and **teacher starter projects**.
4. **Per-assignment workspace rules.** `shared/src/workspaceRules.ts` defines "Open practice", "Standard classwork" and "Locked-down assessment", and nothing imports it. **Teachers cannot switch off import, export, debug, or advanced blocks.** Do not hint at exam mode, lockdown, or restricted workspaces.
5. **Pairs and groups** (the baton model).
6. **Real email delivery.** Only the dev mailer exists — it writes messages to a table for the admin console's pretend inbox. Confirmation, reset, teacher-alert and class-invite templates exist but nothing is sent. **Handle with care:** email confirmation is a genuine gate ("your address must be confirmed before you can join or create a class"), so the constraint may be stated, but the page must never promise that a message will arrive. If this page ships before real mail is wired, drop the sentence entirely rather than soften it. Say nothing at all about the teacher-signup admin alert.
7. **The in-app notification bell** and notification preference switches.
8. **Peer sharing and the share ledger.** No tables, no routes, no UI. Do not imply students can share projects with each other.
9. **Admin "data requests"** — export or erase one person. The admin routes are users, cap, emails, health, classes, and nothing else.
10. **Browsable version history.** The backend keeps up to 20 versions and can restore them; no frontend code calls those endpoints. "Nothing is silently destroyed" is true and may be said. "Browse your history", "roll back", "restore a previous version" are false today.

**Accuracy traps beyond the not-built list:**

11. **Never tell a data-science user to press Run.** There is no Run button for that goal, by design. The pipeline re-runs on every workspace change.
12. **Only four hotkeys.** `Ctrl/Cmd+Enter` or `F5` = Run, `Escape` = Stop, `Ctrl/Cmd+S` = Save — plus `Space` / `F10` / `Shift+F10`, live only in debug mode. `Ctrl+C` is deliberately unbound. Do not invent a shortcut for the page's keycap row.
13. **No collision blocks.** Drop "collisions" from the 3D card, where it currently appears.
14. **Recording is opt-in.** Not "every run captures data" — *record a run*.
15. **The DS "Save chart as image" block downloads an SVG.** Only the post-promotion chart overlay offers both SVG and PNG. Say "charts save as image files" rather than naming a format the block doesn't produce.
16. **No cloud compute.** Nothing physical or analytical touches a server. Do not use "cloud" as a positive; the honest and stronger claim is the opposite.
17. **No mobile or tablet IDE.** `pointer: coarse` support is explicitly "does not break on a tablet" — no gestures, no touch UI. 1024px is the stated minimum. The welcome page reading well on a phone is not a claim that the IDE does.
18. **Not unlimited.** 200 accounts site-wide, 100 projects per account, a size cap per project. If the page mentions signing up, the cap is worth one honest clause.
19. **No usage claims.** No school counts, no user counts, no testimonials, no logos.

**Enforcement rule for whoever writes the final copy:** every number on the page must trace to the verified inventory (151 / 120 / 31 / 43 / 58 / 19 / 18 / 4+4+7+3 / 6 datasets / 9-30-28-56-8-12 rows / 6 charts / 14 doc sections / 5 roles / 4 join doors / 3 join policies / 200 / 100 / GlowScript 3.2 / Monaco 0.45). If a claim cannot be pointed at a file, it does not ship.

---

## 6. Files this touches

- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\welcome\WelcomePage.js` — rewritten, longer, same `go()` contract
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\welcome\WelcomeIcons.js` — **deleted**, contents merged into `frontend\src\components\Icons.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\components\Icons.js` — gains the six welcome icons plus ~12 new section icons, reconciles the duplicate `BlocksIcon`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\welcome\GravityPlayground.js` — labelled, token-styled slider; text alternative for the canvas
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\styles\platform.css` — welcome block (lines 212–280) rewritten onto tokens; welcome selectors added to the responsive region at the end of the file. Consider splitting the welcome rules into their own stylesheet, placed on the correct side of `primitives.css` in the `frontend\src\styles.css` manifest.
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\welcome\WelcomeGate.js` — **unchanged**
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\constants.js` — unchanged; `WELCOME_PASSED_SESSION_KEY` and `SIGNED_IN_HINT_KEY` keep their names