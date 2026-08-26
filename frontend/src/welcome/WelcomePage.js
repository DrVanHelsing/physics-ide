/**
 * WelcomePage — the front page at /welcome.
 *
 * A door with six adjectives on it became nine screens of checkable fact.
 * The rule this file is written under (Plan 5, spec §18): **if a claim cannot
 * be pointed at a file, it does not ship.** Nothing here is aspirational, and
 * the one thing the product does not do yet is stated plainly in §12 rather
 * than omitted.
 *
 * ── THE NUMBERS LEDGER ───────────────────────────────────────────────────
 * Every numeral on the page, and where it comes from. Re-derived in this
 * worktree; welcomePage.test.js re-derives the last two on every run so a
 * data change breaks the build rather than the reader's trust.
 *
 *   151 block types      utils/blockly/toolbox.js — unique <block type=…>
 *   120 purpose-built    `npm run check:blocks`: "120 entries in 19 categories;
 *   across 19 drawers      120 toolbox ids and 26 drawers reconcile both ways".
 *                          26 drawers exist; 19 of them OWN purpose-built
 *                          blocks. The other seven are the two parent drawers
 *                          (Data Science, Advanced) and five stock-only ones
 *                          (Variables, Functions, Loops, Text, Lists).
 *   31 standard blocks   151 toolbox ids − 120 registry ids. They are NOT all
 *                          in the Advanced drawer. Re-derived by walking the
 *                          toolbox with a category stack: 23 are (Loops 4,
 *                          Text 11, Lists 8) and 8 are not — logic_null and
 *                          logic_ternary sit in the top-level Logic drawer
 *                          (toolbox.js:243-244) and math_number_property,
 *                          math_round, math_on_list, math_modulo,
 *                          math_random_int, math_random_float in the top-level
 *                          Math drawer (:252-260). §3's copy says 23 / 8; an
 *                          earlier draft said "in the Advanced drawer" and was
 *                          wrong about a quarter of them.
 *   18 worked projects   precodedExamples.js EXAMPLES = 4; blockTemplates.js
 *                          BLOCK_TEMPLATES = 4, DS_TEMPLATES = 10 (7 data-science
 *                          + 3 hybrid analyses), HYBRID_TOPICS = 3 → 4+4+7+3
 *   6 built-in datasets  utils/dataset/dataset.js BUILTIN_LOADERS
 *   9/30/28/56/8/12      utils/dataset/builtins/*.json — rows.length, counted:
 *                          planets 9, penguins 30, weather 28, pendulum 56,
 *                          spring 8, freefall 12. The brief's values were right.
 *   6 chart types        the six ds_chart_* blocks: bar, line, scatter,
 *                          histogram, box (Charts drawer) and scatter_fit
 *                          (Analyzing Relationships). ds_save_chart_block is in
 *                          the Charts drawer too but is a save action, so the
 *                          drawer holds six blocks and the product six types —
 *                          the same number for two different reasons.
 *   14 doc sections      components/HelpPage.js — 14 section objects
 *   3 keycaps shown      utils/hotkeys.js matchHotkey — Ctrl/Cmd+Enter and bare
 *                          F5 both return "runToggle": Run and Stop are ONE
 *                          button in the viewport header and the keyboard
 *                          matches it, so the row's first keycap says
 *                          "run / stop", not "run". Esc is stop-only by design
 *                          (a key that could START a simulation is not what
 *                          anyone reaches for Escape expecting), Ctrl/Cmd+S
 *                          saves. F5 is named in §4's prose, not the row.
 *                          Space / F10 / Shift+F10 are debug-mode-only
 *                          (hooks/useDebugHotkeys.js) and are named in prose,
 *                          never in the keycap row.
 *   01–09 and 1–3        the anchor rail's section numbers and the first-five-
 *                          minutes step numbers are CSS counters (welcome.css),
 *                          never source literals — ordinals of the page's own
 *                          structure, not claims about the product.
 *   5 roles              docs/classroom-platform.md §2 — "Five kinds of people"
 *   4 join doors         code, link, QR (PeopleTab.js), email invite
 *   3 join policies      shared/src/classes.ts JOIN_MODES
 *   200 accounts         admin setting `account_cap`
 *   100 projects         backend routes/projects.ts MAX_PROJECTS_PER_USER
 *   0 servers            GlowScript is vendored, Monaco and Blockly are
 *                          bundled, the data-science blocks run as JS.
 *   4 worked-project     Tranche 2, §8: blocks_projectile, blocks_pendulum,
 *   tiles opened           blocks_orbits (blockTemplates.js BLOCK_TEMPLATES)
 *                          and ds_penguins_stats (blockTemplates.js
 *                          DS_TEMPLATES) — verified against those exports
 *                          directly, opened via pendingTemplate.js +
 *                          hooks/usePendingTemplateSeed.js onto StartMenu's
 *                          own buildManifestSpec.
 *   2 screenshot pairs   assets/welcome/*.webp, captured live via
 *                          e2e/welcome-shots-probe.mjs against the running
 *                          product on the Projectile Motion template
 *                          (blocks_projectile), both themes:
 *                            §3 editor-{dark,light}.webp — the block editor,
 *                              viewport hidden for width, showing Simulation
 *                              Start through the geometry constants
 *                              (61548B / 66146B).
 *                            §4 viewport-{dark,light}.webp — the 3D viewport
 *                              mid-run, ball past the bounce peak with its
 *                              trail and the vy telemetry label (6706B /
 *                              6526B).
 *                          140926B total, well under the 1.2MB budget. A
 *                          data-science chart pair was not attempted — it
 *                          needs its own template run + pipeline wait on top
 *                          of the two pairs above; ships as two pairs.
 *
 * ── THE TWO HARD CONSTRAINTS ─────────────────────────────────────────────
 * 1. WelcomeGate.js is correct and is not touched by this file.
 * 2. Every call to action goes through go(), which stamps the session pass
 *    before navigating. A bare router Link pointed at the IDE anywhere on this
 *    page bounces the visitor straight back here and reads as an infinite loop.
 *    welcomePage.test.js greps this file for that mistake, so do not write the
 *    forbidden form here even as an example. Two shapes are NOT calls to
 *    action and stay outside go(): in-page anchors (#s-…), which never leave
 *    the page, and nothing else — the /join door IS a call to action and goes
 *    through go() like the rest (go() takes any path, and a visitor who chose
 *    a door has passed the welcome page in every sense the gate cares about).
 */
import React, { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import GravityPlayground from "./GravityPlayground";
import ThemeToggleButton from "../components/layout/ThemeToggleButton";
import { useTheme } from "../contexts/ThemeContext";
import { setPendingTemplate } from "./pendingTemplate";
import {
  BlocksIcon,
  OrbitIcon,
  BugIcon,
  RecordIcon,
  ChartIcon,
  BookOpenIcon,
  LocalFirstIcon,
  ZapIcon,
  GraduationCapIcon,
  PrivacyIcon,
  RocketIcon,
  AtomIcon,
  GlobeIcon,
  TableIcon,
} from "../components/Icons";
import { WELCOME_PASSED_SESSION_KEY } from "../constants";
import editorLightShot from "../assets/welcome/editor-light.webp";
import editorDarkShot from "../assets/welcome/editor-dark.webp";
import viewportLightShot from "../assets/welcome/viewport-light.webp";
import viewportDarkShot from "../assets/welcome/viewport-dark.webp";

/* The section identity ramp, exactly as pane headers use it
   (workspace.css:65-67). Resolved by name — never string-concatenated. */
const CAT = {
  editor: "values",
  viewport: "motion",
  debugger: "control",
  measure: "objects",
  data: "data-science",
  starting: "logic",
  yours: "advanced",
  play: "motion",
  classrooms: "communicate",
};

/* The anchor rail: the nine sections that carry an eyebrow, in page order,
   each pointing at the id its h2 already owns. §2 (s-what) and §10
   (s-numbers) are deliberately absent — their headings are visually hidden
   landmarks, not destinations a reader names. Numbers come from a CSS
   counter, so the rail renders 01–09 without a numeral in this file. */
const RAIL = [
  ["s-editor", "Editor", BlocksIcon, CAT.editor],
  ["s-view", "Run", OrbitIcon, CAT.viewport],
  ["s-debug", "Debug", BugIcon, CAT.debugger],
  ["s-measure", "Measure", RecordIcon, CAT.measure],
  ["s-data", "Analyse", ChartIcon, CAT.data],
  ["s-start", "Projects", BookOpenIcon, CAT.starting],
  ["s-yours", "Your work", LocalFirstIcon, CAT.yours],
  ["s-play", "Try it", ZapIcon, CAT.play],
  ["s-class", "Teachers", GraduationCapIcon, CAT.classrooms],
];

/* §3's artefact: a block stack and the Python it generates. Hand-spanned, no
   highlighting library (Budget §4.4). The Python is what blocklyGenerator.js
   actually emits for these blocks — sphere_block, set_velocity_block,
   forever_loop_block, rate_block, apply_force_block, update_position_block. */
const BLOCK_STACK = [
  { d: 0, t: "ball = sphere   pos (0, 5, 0)   radius 0.5" },
  { d: 0, t: "set ball velocity to   vector 3, 0, 0" },
  { d: 0, t: "forever" },
  { d: 1, t: "rate 60" },
  { d: 1, t: "apply force to ball   accel (0, -9.81, 0)   dt 0.01" },
  { d: 1, t: "update position of ball   dt 0.01" },
];

/* [text, accent] — "k" keyword, "f" call, null plain. */
const PYTHON = [
  [["ball = ", null], ["sphere", "f"], ["(pos=", null], ["vector", "f"], ["(0,5,0), radius=0.5)", null]],
  [["ball.velocity = ", null], ["vector", "f"], ["(3,0,0)", null]],
  [["while", "k"], [" ", null], ["True", "k"], [":", null]],
  [["  ", null], ["rate", "f"], ["(60)", null]],
  [["  ball.velocity = ball.velocity + ", null], ["vector", "f"], ["(0,-9.81,0) * 0.01", null]],
  [["  ball.pos = ball.pos + ball.velocity * 0.01", null]],
];

/* §7 — the pipeline, one short line each. These are reading labels, NOT drawer
   names — only Explore, Uncertainty and Communicate are also drawers, and Chart
   is the Charts drawer minus its plural. Describe is the Statistics drawer,
   Relationships is Analyzing Relationships, Linearise is Transforming Data, and
   Shape spans two (Filter & Sort, Group & Compare). The rendered copy makes no
   drawer claim; do not add one here or there. */
const PIPELINE = [
  ["Explore", "Show the table, the first or last N rows, one column, one cell; count rows, columns and unique values; name a column's type."],
  ["Describe", "Mean, median, mode, min, max, range, sum, count, standard deviation, percentile, interquartile range — or every statistic for a column at once."],
  ["Uncertainty", "Standard error of the mean, a measurement printed as value ± uncertainty, and relative uncertainty as a percentage."],
  ["Relationships", "Least-squares straight-line fit, and Pearson's r as its own block."],
  ["Linearise", "Transform a column by ln, log₁₀, √, x² or 1/x, or multiply two columns into a new one — the standard trick for straightening a curve."],
  ["Shape", "Filter rows on one condition or two joined by AND/OR, sort, drop missing values, find where a value is missing, count and average per group."],
  ["Chart", "Bar, line, scatter, histogram, box plot, and scatter with a regression line. Charts save as image files."],
  ["Communicate", "Write a note, print a result, compare two results side by side, state a conclusion, export the table as CSV, and reveal the generated Python."],
];

/* [numeral, label, in-page target or null]. A tile whose subject has a
   section on this page is a real <a href="#…"> to it; the documentation
   lives inside the IDE, not on this page, so that tile stays plain text.
   Both dataset and chart tiles point at §7 — the data section covers both. */
const STATS = [
  ["151", "block types", "s-editor"],
  ["18", "worked projects", "s-start"],
  ["6", "built-in datasets", "s-data"],
  ["6", "chart types", "s-data"],
  ["14", "documentation sections", null],
  ["0", "servers doing your physics", "s-yours"],
];

/* §8 — the four worked-project tiles a visitor can open right now, each a
   real template id verified against blockTemplates.js's BLOCK_TEMPLATES /
   DS_TEMPLATES (see the ledger). A click stamps the id via pendingTemplate.js
   and goes through go("/") like every other CTA on this page; the IDE's
   usePendingTemplateSeed picks it up and builds the project through the
   wizard's own buildManifestSpec — this file never touches manifest shape.
   Mechanism line only: what the template computes, not how good it is. */
const WORKED_TILES = [
  {
    id: "blocks_projectile",
    title: "Projectile Motion",
    Icon: RocketIcon,
    mechanism:
      "Drag scales with speed squared; the ball loses energy at each bounce until it settles.",
  },
  {
    id: "blocks_pendulum",
    title: "Simple Pendulum",
    Icon: AtomIcon,
    mechanism:
      "A nonlinear restoring force and linear damping set the angular acceleration every frame.",
  },
  {
    id: "blocks_orbits",
    title: "Sun, Earth & Moon",
    Icon: GlobeIcon,
    mechanism:
      "Two gravity sources at once — the Moon orbits Earth while Earth orbits the Sun — integrated with velocity-Verlet.",
  },
  {
    id: "ds_penguins_stats",
    title: "Penguins: Exploratory Analysis",
    Icon: TableIcon,
    mechanism: "Bill length regressed against body mass, with Pearson’s r and a fitted line over the scatter.",
  },
];

/** An eyebrow micro-label carrying its section's category mark. */
function Eyebrow({ Icon, children }) {
  return (
    <p className="welcome-eyebrow">
      <span className="welcome-eyebrow__mark" aria-hidden="true"><Icon size={14} /></span>
      {children}
    </p>
  );
}

/* A theme-matched product screenshot: dark src in dark, light in light.
   Real width/height (no CLS), lazy — these sit well below the fold. */
function ThemeImage({ isDark, light, dark, alt, width, height }) {
  return (
    <img
      className="welcome-shot"
      src={isDark ? dark : light}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
    />
  );
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();

  const go = useCallback(
    (path) => {
      // Session-scoped pass: "/" renders the IDE for the rest of this browser
      // session, and a new session meets the front door again.
      sessionStorage.setItem(WELCOME_PASSED_SESSION_KEY, "1");
      navigate(path);
    },
    [navigate],
  );

  /* A worked-project tile: stamp the template id, then the same go("/") every
     other CTA on this page uses — the gate stamp and navigation discipline
     stay untouched (hard constraint 2, above). */
  const openTile = useCallback(
    (id) => {
      setPendingTemplate(id);
      go("/");
    },
    [go],
  );

  useEffect(() => {
    const els = document.querySelectorAll(".welcome-reveal");
    /* Degrade, don't delete: without an IntersectionObserver the reveals
       resolve to their final state rather than leaving nine screens at
       opacity 0. Same rule the reduced-motion block follows. */
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-on"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.classList.add("is-on");
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main className="welcome">
      <a className="welcome-skip" href="#welcome-main">Skip to content</a>

      <div className="welcome-toolbar">
        <ThemeToggleButton isDark={isDark} onToggle={toggle} />
      </div>

      <header className="welcome-hero">
        <div className="welcome-orbit" aria-hidden="true">
          <div className="welcome-orbit__sun" />
          <div className="welcome-orbit__path welcome-orbit__path--a"><i /></div>
          <div className="welcome-orbit__path welcome-orbit__path--b"><i /></div>
        </div>
        <h1>Physics IDE</h1>
        <p className="welcome-tagline">
          Build a physics simulation with blocks or with Python, watch it run in 3D,
          then analyse the data it produced — all in the browser, with no account
          and nothing to install.
        </p>
        <p className="welcome-subline">
          Free, offline-capable, and open to guests. Built for physics classrooms.
        </p>
        {/* The primary door is a row of its own so its size can say what the
            copy already says: this is the one most visitors want. The two
            account doors sit beneath it at their old size. */}
        <div className="welcome-cta">
          <button className="btn btn--primary btn--lg" type="button" onClick={() => go("/")}>
            Use the IDE — no account needed
          </button>
          <div className="welcome-cta__alt">
            <button className="btn btn--lg" type="button" onClick={() => go("/auth/signup")}>
              Create an account
            </button>
            <button className="btn btn--lg" type="button" onClick={() => go("/auth/signin")}>
              Sign in
            </button>
          </div>
        </div>
        <p className="welcome-reassure">Guests get the complete IDE. Nothing is held back.</p>
        {/* An in-page anchor, not a door — it never leaves the page, so it
            does not go through go() and is not a hero <button>. */}
        <p className="welcome-hero__quiet">
          <a className="welcome-hero__peek" href="#s-play">See it run — the gravity playground ↓</a>
        </p>
        {/* The fourth door: /join is ungated, but go() stamps the pass first
            like every other door — see hard constraint 2 in the header. */}
        <p className="welcome-hero__quiet">
          Have a class code?{" "}
          <button className="welcome-linklike" type="button" onClick={() => go("/join")}>
            Join your class
          </button>
        </p>
      </header>

      <div id="welcome-main" tabIndex={-1} />

      {/* The anchor rail — fixed to the left edge, ≥1280px only (welcome.css
          hides it below that, where it would cover content). It sits directly
          after the skip target on purpose: a keyboard visitor who skips the
          hero lands on the list of places to go. */}
      <nav className="welcome-rail" aria-label="Page sections">
        <ol>
          {RAIL.map(([id, label, Icon, cat]) => (
            <li key={id} className={`welcome-section--${cat}`}>
              <a href={`#${id}`}>
                <span className="welcome-rail__mark" aria-hidden="true"><Icon size={12} /></span>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* §2 — the fast orientation for someone who will not scroll far. */}
      <section className="welcome-band welcome-reveal" aria-labelledby="s-what">
        <h2 id="s-what" className="welcome-sr">What Physics IDE is</h2>
        <p>
          <strong>Runs in your browser.</strong> GlowScript 3.2 VPython, the Monaco code
          editor and the block editor all ship with the app; no server does your physics.
        </p>
        <p>
          <strong>Two editors, one project.</strong> Drag blocks or write Python — the
          toolbar toggle switches views, and the blocks generate readable Python you can
          flip to and inspect.
        </p>
        <p>
          <strong>Three kinds of project.</strong> Physics modelling, data science, or
          hybrid — a simulation and the analysis of the data it just produced.
        </p>
      </section>

      {/* §2b — the first five minutes. Three imperatives the reader verifies
          by doing them; the step numbers are a CSS counter, not copy. */}
      <section className="welcome-steps welcome-reveal" aria-labelledby="s-first">
        <h2 id="s-first" className="welcome-sr">The first five minutes</h2>
        <ol className="welcome-steps__list">
          <li>Open the IDE — no account needed.</li>
          <li>Open a worked project.</li>
          <li>Press Run, then change one number.</li>
        </ol>
      </section>

      {/* §3 — blocks and code. */}
      <section
        className={`welcome-section welcome-section--${CAT.editor} welcome-reveal`}
        aria-labelledby="s-editor"
      >
        <Eyebrow Icon={BlocksIcon}>The editor</Eyebrow>
        <h2 id="s-editor">Start with blocks. Move to Python when you&rsquo;re ready.</h2>
        <p>
          151 block types: <strong>120 purpose-built for physics and data across 19
          drawers</strong>, plus 31 standard Blockly blocks — 23 of them in the Advanced
          drawer, the other eight in Logic and Math. The toolbox filters itself to the
          project&rsquo;s goal — a physics project never shows data blocks; a data
          project never shows Objects or Motion.
        </p>
        <p>
          {/* "inserts straight into the program" is a checked claim:
              BlocklyWorkspace.js insertBlock() builds the block and
              appendToSetup() attaches it to the end of the simulation's
              setup, selected; when there is nothing to attach to it lands
              selected at the centre of the view. */}
          Search the whole library by name or keyword from the box above the canvas —
          choose a result and the block is inserted straight into your program,
          selected and ready to wire in. Right-click a block and choose{" "}
          <strong>Help</strong> to jump straight to its entry in the built-in
          documentation.
        </p>
        <p>
          {/* Each clause checked: CodeEditor.js (bundled dynamic import, the
              <textarea> fallback and its test), monacoThemes.js (VPython
              vocabulary in the monarch grammar; physics-light / physics-dark
              built from BLOCK_PALETTE). */}
          The Python side is the Monaco editor, bundled with the app and Python-aware —
          it knows the VPython vocabulary and colours it from the same palette the
          blocks use, in both themes. If the editor bundle ever fails to load, a plain
          text area takes over so you can keep writing.
        </p>

        <div className="welcome-compare">
          <div className="welcome-compare__side">
            <p className="welcome-compare__label">What you drag</p>
            <div className="welcome-code welcome-code--blocks">
              {BLOCK_STACK.map((b) => (
                <div key={b.t} className={`welcome-code__row welcome-code__row--d${b.d}`}>
                  <span className="welcome-code__chip">{b.t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="welcome-compare__side">
            <p className="welcome-compare__label">What it writes</p>
            <pre className="welcome-code"><code>{PYTHON.map((line, i) => (
              <React.Fragment key={i}>
                {line.map(([text, kind], j) => (
                  <span key={j} className={kind ? `welcome-tok welcome-tok--${kind}` : undefined}>
                    {text}
                  </span>
                ))}
                {"\n"}
              </React.Fragment>
            ))}</code></pre>
          </div>
        </div>

        <figure className="welcome-shot-figure">
          <ThemeImage
            isDark={isDark}
            light={editorLightShot}
            dark={editorDarkShot}
            alt="The block editor open on the Projectile Motion template: Simulation Start, a run-Python block setting scene.range, and a stack of named colour and geometry constants each set to a vector block."
            width={1280}
            height={730}
          />
          <figcaption>
            A real project, not a mock-up: blocks nest into value slots — vectors, math and
            physics constants compose the way the generated Python reads them.
          </figcaption>
        </figure>
      </section>

      {/* §4 — the 3D viewport. */}
      <section
        className={`welcome-section welcome-section--${CAT.viewport} welcome-reveal`}
        aria-labelledby="s-view"
      >
        <Eyebrow Icon={OrbitIcon}>Watch it run</Eyebrow>
        <h2 id="s-view">Physics you can see happening.</h2>
        <p>
          Simulations render live in a 3D viewport — GlowScript 3.2 VPython, shipped with
          the app, so it works offline. Spheres, boxes, cylinders, arrows, helixes and
          springs, glowing spheres, trails, text labels, point lights, scene and camera.
        </p>
        <p>
          Motion blocks set velocity, update position, apply force, add gravity and rotate
          — with vector maths beside them: magnitude, unit vector, dot, cross, trig, clamp,
          min and max. Camera controls float over the scene while it runs: reset camera,
          fit scene to view, fullscreen, and copy a snapshot to a new tab. Drag the divider
          to resize, or hide the viewport and work full-width.
        </p>
        <p>
          {/* Checked: label_full_block and telemetry_update_block
              (blocklyGenerator.js) render a live in-scene label as
              "name = round(value, dp) unit"; HelpPage's four examples show
              elapsed time, speed and KE/PE energy on exactly that label. */}
          A simulation can carry its own read-out in the scene: telemetry blocks keep a
          live label showing values like elapsed time, speed and energy, rounded,
          unit-labelled and rewritten every frame. Run and Stop are one button in the
          viewport header, and the keyboard matches it — <kbd className="tb-kbd">F5</kbd>{" "}
          does the same as <kbd className="tb-kbd">Ctrl</kbd>
          <span className="welcome-keys__plus">+</span>
          <kbd className="tb-kbd">Enter</kbd>.
        </p>
        <ul className="welcome-keys">
          <li><kbd className="tb-kbd">Ctrl</kbd><span className="welcome-keys__plus">+</span><kbd className="tb-kbd">Enter</kbd> run / stop</li>
          <li><kbd className="tb-kbd">Esc</kbd> stop</li>
          <li><kbd className="tb-kbd">Ctrl</kbd><span className="welcome-keys__plus">+</span><kbd className="tb-kbd">S</kbd> save</li>
        </ul>

        <figure className="welcome-shot-figure">
          <ThemeImage
            isDark={isDark}
            light={viewportLightShot}
            dark={viewportDarkShot}
            alt="The 3D viewport mid-run on the Projectile Motion template: the ball past the peak of its bounce, its trail arcing behind it over the ground, with a live vy telemetry label."
            width={635}
            height={730}
          />
          <figcaption>
            The scene renders live while the loop runs — the telemetry label rewrites itself
            every frame.
          </figcaption>
        </figure>
      </section>

      {/* §5 — the debugger, the strongest differentiator. */}
      <section
        className={`welcome-section welcome-section--${CAT.debugger} welcome-reveal`}
        aria-labelledby="s-debug"
      >
        <Eyebrow Icon={BugIcon}>Look inside</Eyebrow>
        <h2 id="s-debug">A debugger that doesn&rsquo;t lie to you.</h2>
        <p>
          Debug Mode pauses and resumes with <kbd className="tb-kbd">Space</kbd>, steps one
          animation frame with <kbd className="tb-kbd">F10</kbd>, and steps to the next
          reported value with <kbd className="tb-kbd">Shift</kbd>
          <span className="welcome-keys__plus">+</span>
          <kbd className="tb-kbd">F10</kbd> — all while the simulation stays on screen.
        </p>
        <p>
          Set breakpoints by right-clicking a block or Alt-clicking it. Blocks that <em>can</em>{" "}
          pause show a dashed outline, blocks with a breakpoint a solid one, and the toolbar
          shows how many are set. If a program has no traced values to pause on, it says so
          plainly instead of hanging. That is what the headline means: it is a code path,
          not a slogan.
        </p>
        <p>
          A live variable panel groups setup constants, live loop values and your own watch
          expressions, each row carrying a sparkline of its history. Pin a variable, filter
          the list, set a threshold alert, take a snapshot to compare against, or click a
          name to light up the block that sets it. Type any Python expression into the
          watch box — total energy, say — and see it evaluated every frame on the next run.
        </p>
      </section>

      {/* §6 — from a run to a dataset. */}
      <section
        className={`welcome-section welcome-section--${CAT.measure} welcome-reveal`}
        aria-labelledby="s-measure"
      >
        <Eyebrow Icon={RecordIcon}>Measure it</Eyebrow>
        <h2 id="s-measure">Turn a simulation into data you can analyse.</h2>
        <p>
          <strong>Record a run</strong> to capture every value as it changes, then export
          it as CSV — or press <strong>Chart</strong> to turn that recording into a dataset
          you can work on with the data blocks. Telemetry labels put the numbers in the
          scene while it runs; recording puts them in a table when it stops.
        </p>
        <p>
          When you save a run as a dataset you choose exactly which variables to keep and
          crop it to a time range — useful for cutting a projectile off before it lands.
          Hybrid projects stack the viewport and the data panel in one pane, so a
          simulation and its analysis sit together.
        </p>
      </section>

      {/* §7 — the data-science half. */}
      <section
        className={`welcome-section welcome-section--${CAT.data} welcome-reveal`}
        aria-labelledby="s-data"
      >
        <Eyebrow Icon={ChartIcon}>Analyse</Eyebrow>
        <h2 id="s-data">A full data pipeline, in the same blocks.</h2>
        <p>
          <strong>Load</strong> one of six built-in datasets, each shipping with a
          description of every column — Planets (9 rows), Palmer Penguins (30),
          Weather / Cape Town vs Johannesburg (28), Pendulum lab measurements (56),
          Spring / Hooke&rsquo;s law (8), Free fall (12) — or your own CSV, or a dataset
          promoted from a run.
        </p>
        <div className="welcome-grid">
          {PIPELINE.map(([name, line]) => (
            <article key={name} className="card welcome-stage">
              <h3>{name}</h3>
              <p>{line}</p>
            </article>
          ))}
        </div>
        <p>
          A least-squares fit reports slope, intercept, R&sup2; and n written out as an
          equation with a plain-English verdict on the fit — Excellent, Strong, Moderate or
          Weak. <strong>The pipeline re-runs as you change blocks</strong>: table,
          statistics and charts refresh as you work.
        </p>
      </section>

      {/* §8 — starting points. */}
      <section
        className={`welcome-section welcome-section--${CAT.starting} welcome-reveal`}
        aria-labelledby="s-start"
      >
        <Eyebrow Icon={BookOpenIcon}>Don&rsquo;t start from nothing</Eyebrow>
        <h2 id="s-start">18 worked projects, ready to open.</h2>
        <p>
          Four pre-coded Python examples — Projectile Motion with air drag and telemetry,
          a Spring-Mass Oscillator with live energy readouts, a Sun&ndash;Earth&ndash;Moon
          three-body orbit on velocity-Verlet, and a Nonlinear Damped Pendulum. The same
          four rebuilt as block templates. Seven data-science investigations. Three hybrid
          topics that pair a simulation with its matching analysis.
        </p>
        <p>Four are one click away, open as a guest, no setup:</p>
        <div className="welcome-grid">
          {WORKED_TILES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="card card--interactive welcome-tile"
              data-template-id={t.id}
              onClick={() => openTile(t.id)}
            >
              <span className="welcome-tile__icon" aria-hidden="true"><t.Icon size={20} /></span>
              <h3 className="welcome-tile__title">{t.title}</h3>
              <p className="welcome-tile__mech">{t.mechanism}</p>
            </button>
          ))}
        </div>
        <ul className="welcome-chips">
          <li className="badge badge--accent">measure damping from the pendulum</li>
          <li className="badge badge--accent">measure g from the projectile</li>
          <li className="badge badge--accent">find k from the spring</li>
        </ul>
        <p>
          An empty canvas offers one-click starter chips and a short beginner tip you can
          dismiss for the next one. A short wizard at the start asks for a title, blank or
          template, and which editor to open in. And the built-in documentation has 14
          searchable sections, from
          Getting Started and Debug Mode to the Block Reference, the VPython Reference and
          For Educators.
        </p>
      </section>

      {/* §9 — yours, offline. */}
      <section
        className={`welcome-section welcome-section--${CAT.yours} welcome-reveal`}
        aria-labelledby="s-yours"
      >
        <Eyebrow Icon={LocalFirstIcon}>Your work</Eyebrow>
        <h2 id="s-yours">Saved on your computer first. Always.</h2>
        <p>
          Projects are named and renameable, save themselves as you work, and appear on a
          Continue list with how long ago you touched them. Export as Python
          (<code>.py</code>), blocks (<code>.xml</code>), a PDF of the code, a PDF of the
          blocks, a PNG of the viewport, or a complete project bundle
          (<code>.physide.json</code>) — or copy the code straight out. Open files back in
          as <code>.py</code>, <code>.xml</code> or <code>.physide.json</code>.
        </p>
        <p>
          Signed in, your work also syncs to your account — after every save, after every
          delete, and again when you sign in, return to the tab, or come back online. The
          sync chip tells you the truth at a glance, so a dead network stops the syncing
          and not the working. Start at school, carry on at home on a different computer.
        </p>
        <p>
          Sign up after working as a guest and you are offered a one-click import of the
          projects already in your browser — or decline, and they stay where they are. On a
          shared computer, signing out clears the projects pulled down from your account
          while guest work stays put. Limits are stated plainly: 100 projects per account
          and a size cap per project, both with plain-English messages when you reach them.
        </p>
        <p className="welcome-note">
          If the same project is edited in two places, the most recent edit wins and the
          older version is kept rather than discarded.
        </p>
      </section>

      {/* §10 — by the numbers. */}
      <section className="welcome-numbers welcome-reveal" aria-labelledby="s-numbers">
        <h2 id="s-numbers" className="welcome-sr">Physics IDE by the numbers</h2>
        {/* A tile with an in-page section is a real anchor to it; the global
            focus-visible ring covers a[href], so no :focus rule anywhere. */}
        {STATS.map(([n, label, target]) => {
          const body = (
            <>
              <span className="welcome-stat__n">{n}</span>
              <span className="welcome-stat__label">{label}</span>
            </>
          );
          return target ? (
            <a key={label} className="welcome-stat" href={`#${target}`}>{body}</a>
          ) : (
            <div key={label} className="welcome-stat">{body}</div>
          );
        })}
      </section>

      {/* §11 — the playground, moved here as the reward at the end of the read. */}
      <section
        className={`welcome-play welcome-section--${CAT.play} welcome-reveal`}
        aria-labelledby="s-play"
      >
        <Eyebrow Icon={ZapIcon}>Try it</Eyebrow>
        <h2 id="s-play">Rules in, motion out.</h2>
        <p>
          Drag the gravity slider and click to drop a ball. This box runs the same idea the
          IDE does — you write the rule, the simulation plays it out.
        </p>
        <GravityPlayground />
      </section>

      {/* §12 — for classrooms: the honesty section. */}
      <section
        className={`welcome-section welcome-section--${CAT.classrooms} welcome-reveal`}
        aria-labelledby="s-class"
      >
        <Eyebrow Icon={GraduationCapIcon}>For teachers</Eyebrow>
        <h2 id="s-class">Classes today. Assignments next.</h2>
        <p>
          Anyone can sign up as a teacher — choose <strong>I&rsquo;m a teacher</strong> on
          the signup form, no approval queue. Create a class with a name and an optional
          subject or year label. There are four ways in: a short join code (like
          <code>KQ4-7PM</code> — its alphabet was chosen so no two characters look alike
          read off a projector), a copyable link, a QR code for the board, and email
          invites you can paste as a whole list. Invite people as
          students, teaching assistants or co-teachers; pending invites can be resent or
          revoked.
        </p>
        <p>
          Three join policies per class — <strong>open</strong>, <strong>approval</strong>{" "}
          and <strong>paused</strong> — and you can regenerate the code at any time to
          retire the old one. A People tab holds the full roster and can remove a member.
          Archive a class at year end and it turns read-only for everyone; unarchive it
          later. Five roles across the system, and a site-wide 200-account cap the system
          enforces itself.
        </p>

        <div className="card card--panel welcome-notbuilt">
          <h3>Not yet built.</h3>
          <p>
            Assignments, submissions, marking, feedback and a gradebook are designed but
            not shipped. A class today holds its roster, its join settings and its people
            — the Assignments tab says so itself. When marking arrives it will be
            announced here.
          </p>
        </div>

        <div className="welcome-privacy">
          <h3>
            <span className="welcome-privacy__mark" aria-hidden="true"><PrivacyIcon size={16} /></span>
            No surveillance layer
          </h3>
          <p>
            No tracking, no paste detection, no webcam, no keystroke logging. The platform
            keeps an append-only record of account signups, class joins and join requests —
            that is the whole of the monitoring, and it exists so a join can be audited, not
            so a student can be watched.
          </p>
        </div>

        <div className="welcome-access">
          <h3>Accessibility is a code path, too</h3>
          <p>
            {/* Every clause checked against its file: blockPalette.js ships
                relativeLuminance/contrastRatio and blockPalette.test.js holds
                every category's fill and secondary to the 4.5:1 AA floor;
                tokens.css defines the one :where() focus-visible ring;
                welcome.css / workspace.css / viewport.css carry the
                reduced-motion guards and e2e-test.mjs asserts the guard is in
                the shipped CSS; AdminConsole.js is a role="tablist" with
                ArrowLeft/ArrowRight, ClassChrome link tabs carry
                aria-current="page", and JoinClassPage / PeopleTab /
                InviteLandingPage / SyncChip are aria-live regions. */}
            The block palette ships its own contrast arithmetic, and the test suite holds
            every generated block colour to the WCAG AA floor. One keyboard focus ring
            serves the whole product, defined once at zero specificity so no component
            overrides it by accident. Ask your system for reduced motion and the animation
            stops — this page&rsquo;s orbit, the IDE&rsquo;s idle screen — with an
            end-to-end test asserting the guard ships in the CSS. The classroom portal
            works from a keyboard: the admin console&rsquo;s tabs are ARIA tabs the arrow
            keys walk, class tabs are plain links that declare the current page, and
            joining, inviting and syncing announce their progress through live regions.
            And the theme toggle is at the top of this page, so you can check both themes
            before you commit to anything.
          </p>
        </div>
      </section>

      <footer className="welcome-foot welcome-reveal">
        <p className="welcome-foot__scope">
          The IDE needs a laptop or desktop — 1024px or wider. This page reads fine on a phone.
        </p>
        <p>
          No charge and no billing. A hard 200-account cap keeps the site small on purpose.
        </p>
        <p>
          A hosted tool lasts only as long as someone pays for its servers. This one has
          no such dependency — the physics runs on your machine, projects are saved there
          first, the account cap is enforced by the software itself, and there is no bill
          whose failure can switch anything off.
        </p>
        <button className="btn btn--primary btn--lg" type="button" onClick={() => go("/")}>
          Open the IDE
        </button>
        <div className="welcome-foot__links">
          <button className="btn btn--ghost" type="button" onClick={() => go("/auth/signup")}>
            Create an account
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => go("/auth/signin")}>
            Sign in
          </button>
        </div>
      </footer>
    </main>
  );
}
