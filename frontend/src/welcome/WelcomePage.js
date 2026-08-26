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
 *   2 screenshot pairs   assets/welcome/*.webp, captured live against the
 *                          running product on the Projectile Motion template
 *                          (blocks_projectile), both themes:
 *                            §3 editor-{dark,light}.webp — the block editor,
 *                              viewport hidden for width, showing Simulation
 *                              Start through the geometry constants.
 *                              Captured by e2e/welcome-shots-probe.mjs;
 *                              unchanged since tranche 2 (61548B / 66146B,
 *                              1280×730).
 *                            §4 viewport-{dark,light}.webp — the 3D viewport
 *                              mid-run, the ball arcing over the ground past
 *                              its launch marker into its second bounce.
 *                              Re-captured for tranche 2.5 (polish brief
 *                              move 3 — "frame full of scene, not empty
 *                              canvas") by e2e/welcome-shots-recapture.mjs
 *                              (gitignored, not shipped): the camera is
 *                              zoomed directly (scene.range = 8, probed
 *                              against 6/7/8/9/10 so the post-bounce ball
 *                              stays in frame) rather than cropping a small,
 *                              distant subject, then the pane's own chrome
 *                              and empty sky/ground are cropped away.
 *                              635×255, 3710B / 3538B — the telemetry label
 *                              this pair used to show moved out of frame
 *                              under the tighter camera, so the alt text and
 *                              caption no longer claim it; §4's prose above
 *                              still does, truthfully, since that claim is
 *                              about the feature, not this one frame.
 *                          134942B total, well under the 1.2MB budget. A
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
 *    The site header (WelcomeHeader.js, tranche 2.5) is a child component,
 *    not a bare Link in this file, so it does not trip the grep below — but
 *    it holds the same discipline: this page passes it onSignIn={() =>
 *    go("/auth/signin")}, so its Sign in control still stamps the pass.
 *    WelcomeSubpage.js (/about, /contact) passes no onSignIn — those two
 *    routes are gate-free, like /join, so their header falls back to a
 *    plain Link, the same shape JoinClassPage.js already uses.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import GravityPlayground from "./GravityPlayground";
import WelcomeHeader from "./WelcomeHeader";
import DebugDemo from "./DebugDemo";
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
   drawer claim; do not add one here or there.
   Each entry is [name, ≤6-word teaser, full detail] — the teaser is what
   <summary> shows closed, the detail is what a click discloses (fun-redesign
   brief §2, §7 entry: "each of the 8 .welcome-stage cards becomes a native
   <details>/<summary>"). "Describe"'s teaser is the brief's own example, kept
   verbatim. */
const PIPELINE = [
  ["Explore", "Look at the raw data first", "Show the table, the first or last N rows, one column, one cell; count rows, columns and unique values; name a column's type."],
  ["Describe", "the whole statistics toolkit", "Mean, median, mode, min, max, range, sum, count, standard deviation, percentile, interquartile range — or every statistic for a column at once."],
  ["Uncertainty", "Put an error bar on it", "Standard error of the mean, a measurement printed as value ± uncertainty, and relative uncertainty as a percentage."],
  ["Relationships", "Fit a line, get r", "Least-squares straight-line fit, and Pearson's r as its own block."],
  ["Linearise", "Straighten a curve first", "Transform a column by ln, log₁₀, √, x² or 1/x, or multiply two columns into a new one — the standard trick for straightening a curve."],
  ["Shape", "Filter, sort and group rows", "Filter rows on one condition or two joined by AND/OR, sort, drop missing values, find where a value is missing, count and average per group."],
  ["Chart", "Six chart types, one block", "Bar, line, scatter, histogram, box plot, and scatter with a regression line. Charts save as image files."],
  ["Communicate", "Write the result up", "Write a note, print a result, compare two results side by side, state a conclusion, export the table as CSV, and reveal the generated Python."],
];

/* §7's chip row — the six built-in datasets, one chip each. These strings
   are locked verbatim: welcomePage.test.js greps container.textContent for
   each parenthetical substring (the numbers are re-derived from the JSON
   files on every test run, per the ledger above). Reformat the wrapper,
   never the string. */
const DATASETS = [
  "Planets (9 rows)",
  "Palmer Penguins (30)",
  "Weather / Cape Town vs Johannesburg (28)",
  "Pendulum lab measurements (56)",
  "Spring / Hooke’s law (8)",
  "Free fall (12)",
];

/* [numeral, label, in-page target or null, hover/focus-revealed provenance
   note]. A tile whose subject has a section on this page is a real
   <a href="#…"> to it; the documentation lives inside the IDE, not on this
   page, so that tile stays plain text. Both dataset and chart tiles point at
   §7 — the data section covers both. The fourth field is §10's new
   micro-interaction (fun-redesign brief §2, §10 entry): it elaborates the
   existing label, never a new numeral — the ledger at the top of this file
   is what each note is drawn from. */
const STATS = [
  ["151", "block types", "s-editor", "120 purpose-built, 31 standard Blockly"],
  ["18", "worked projects", "s-start", "4 Python, 4 blocks, 7 data science, 3 hybrid"],
  ["6", "built-in datasets", "s-data", "planets, penguins, weather, pendulum, spring, free fall"],
  ["6", "chart types", "s-data", "bar, line, scatter, histogram, box, and a fitted scatter"],
  ["14", "documentation sections", null, "Getting Started through the VPython Reference"],
  ["0", "servers doing your physics", "s-yours", "GlowScript, Monaco and Blockly all run in your browser"],
];

/* §4's two enumerations, as chip rows instead of run-on sentences (fun-
   redesign brief §2, §4 entry). Camera-control detail moves to Help. */
const SCENE_OBJECTS = ["Spheres", "Boxes", "Cylinders", "Arrows", "Helixes", "Springs", "Trails", "Labels"];
const VECTOR_OPS = ["Magnitude", "Unit vector", "Dot", "Cross", "Trig", "Clamp", "Min / max"];

/* §9's export-format run-on sentence, as a chip row (same .badge primitive
   §8 already uses — zero new CSS for the chips themselves). */
const EXPORT_FORMATS = [".py", ".xml", "PDF (code)", "PDF (blocks)", "PNG", ".physide.json"];

/* §12's four join methods — text-only chips, per the file boundary's own
   instruction: no existing imported icon reads cleanly as "code" / "link" /
   "QR" / "email", and Icons.js is out of scope for a new export. */
const JOIN_WAYS = ["Code", "Link", "QR", "Email"];

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

/* §9's artifact (fun-redesign brief §2, §9 entry): a small static mock of
   the product's real sync-chip visual language — conceptually, not the
   component itself; this file only, no import of the real SyncChip. Hover
   or focus steps its label through the three states a real sync chip can
   show. Each step is a discrete response to one interaction, not a running
   animation — the RM table's §9 row asks for an instant swap, never a
   cross-fade, so this needs no reduced-motion guard beyond "add no
   transition here," which it already does not. */
const SYNC_STATES = ["Saved", "Syncing", "Offline"];

function SyncChipMock() {
  const [i, setI] = useState(0);
  const step = () => setI((n) => (n + 1) % SYNC_STATES.length);
  return (
    <button
      type="button"
      className="welcome-syncchip"
      onMouseEnter={step}
      onFocus={step}
      aria-label={`Sync status, a mock — currently showing "${SYNC_STATES[i]}"; hover or focus to see the next state`}
    >
      <span className="welcome-syncchip__dot" aria-hidden="true" />
      {SYNC_STATES[i]}
    </button>
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
  const { isDark } = useTheme();
  /* §2b's checklist gamification: which of the three first-five-minutes
     steps a visitor has marked done. Component state only, no storage — a
     reload resets it, same as the rest of this page's interactivity. */
  const [doneSteps, setDoneSteps] = useState(() => new Set());
  const toggleStep = useCallback((i) => {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);
  /* §3's block↔Python hover-link: which index (if any) is under the
     pointer or keyboard focus. Both BLOCK_STACK and PYTHON are index-
     aligned (see their own comments above), so one integer is the whole
     mechanism — no state machine needed. */
  const [activeLine, setActiveLine] = useState(null);
  /* The anchor rail's active-section highlight — a state toggle driven by
     scroll position, not an animation (RM table: "No change needed"). */
  const [activeSection, setActiveSection] = useState(null);

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

  useEffect(() => {
    /* Degrade, don't delete: without IntersectionObserver the rail simply
       never highlights an active section — nothing on the page breaks, the
       rail still works as a plain set of anchors (RM table, "Rail
       active-section highlight" row). */
    if (typeof IntersectionObserver === "undefined") return undefined;
    const sections = document.querySelectorAll("section[aria-labelledby]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.getAttribute("aria-labelledby"));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main className="welcome">
      <a className="welcome-skip" href="#welcome-main">Skip to content</a>

      {/* The slim site header (brief move 4): mounted here and reused,
          unchanged, on /about and /contact via WelcomeSubpage.js. The lone
          floating ThemeToggleButton this replaced is gone — the toggle now
          lives in the header's right cluster. Sign in goes through go(), so
          this page's every-CTA-through-go() rule (hard constraint 2, above)
          still holds even though the control lives in a child component. */}
      <WelcomeHeader onSignIn={() => go("/auth/signin")} />

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
            <li
              key={id}
              className={`welcome-section--${cat}${activeSection === id ? " is-active" : ""}`}
            >
              <a href={`#${id}`}>
                <span className="welcome-rail__mark" aria-hidden="true"><Icon size={12} /></span>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* §2 — the fast orientation for someone who will not scroll far.
          Each cell is a flip-tile (fun-redesign brief §2, §2 entry): the
          label + a glyph show by default, the sentence reveals on hover or
          focus via a max-height/opacity transition. Keyboard reachable
          because the label is a real <button> — :focus-within on the
          wrapping .welcome-flip fires the same reveal a mouse hover does. */}
      <section className="welcome-band welcome-reveal" aria-labelledby="s-what">
        <h2 id="s-what" className="welcome-sr">What Physics IDE is</h2>
        <div className="welcome-flip">
          <button type="button" className="welcome-flip__face">
            <span className="welcome-flip__mark" aria-hidden="true"><LocalFirstIcon size={18} /></span>
            <strong>Runs in your browser.</strong>
          </button>
          <p className="welcome-flip__body">
            GlowScript 3.2 VPython, the Monaco code editor and the block editor all ship
            with the app; no server does your physics.
          </p>
        </div>
        <div className="welcome-flip">
          <button type="button" className="welcome-flip__face">
            <span className="welcome-flip__mark" aria-hidden="true"><BlocksIcon size={18} /></span>
            <strong>Two editors, one project.</strong>
          </button>
          <p className="welcome-flip__body">
            Drag blocks or write Python — the toolbar toggle switches views, and the
            blocks generate readable Python you can flip to and inspect.
          </p>
        </div>
        <div className="welcome-flip">
          <button type="button" className="welcome-flip__face">
            <span className="welcome-flip__mark" aria-hidden="true"><AtomIcon size={18} /></span>
            <strong>Three kinds of project.</strong>
          </button>
          <p className="welcome-flip__body">
            Physics modelling, data science, or hybrid — a simulation and the analysis of
            the data it just produced.
          </p>
        </div>
      </section>

      {/* §2b — the first five minutes. Three imperatives the reader verifies
          by doing them; the step numbers are a CSS counter, not copy.
          Gamified (fun-redesign brief §2, §2b entry): clicking a step toggles
          its `is-done` class, which draws a checkmark and strikes the text.
          The checkmark is a decorative, aria-hidden, empty <span> — it adds
          zero characters to the <li>'s textContent, so the test-locked
          strings below stay byte-for-byte what the "first-five-minutes strip
          is an ol of exactly three imperatives, text locked" test expects
          (welcomePage.test.js lines 195-210, per the brief's migration plan
          item 1: verified by re-running that test, not by inspection). */}
      <section className="welcome-steps welcome-reveal" aria-labelledby="s-first">
        <h2 id="s-first" className="welcome-sr">The first five minutes</h2>
        <ol className="welcome-steps__list">
          {[
            "Open the IDE — no account needed.",
            "Open a worked project.",
            "Press Run, then change one number.",
          ].map((text, i) => (
            <li key={text} className={doneSteps.has(i) ? "is-done" : undefined}>
              <button type="button" className="welcome-steps__btn" onClick={() => toggleStep(i)}>
                <span className="welcome-steps__check" aria-hidden="true" />
                {text}
              </button>
            </li>
          ))}
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
          151 block types across 19 drawers — the toolbox filters itself to your project.
        </p>
        <p className="welcome-helpref">
          Search, right-click Help, and the Monaco fallback are covered in Help, inside
          the IDE.
        </p>

        {/* The compare panel is now interactive (fun-redesign brief §2, §3
            entry, and its own #1 priority in the prioritized cut-line): hover
            or tab-focus a block chip and its index-aligned Python line lights
            up. BLOCK_STACK and PYTHON are already index-aligned (see their
            own comments above) — one integer of state is the whole
            mechanism, no highlighting library, no state machine. This
            directly demonstrates "blocks generate readable Python" instead
            of asserting it in the prose just cut above. */}
        <div className="welcome-compare">
          <div className="welcome-compare__side">
            <p className="welcome-compare__label">What you drag</p>
            <div className="welcome-code welcome-code--blocks">
              {BLOCK_STACK.map((b, i) => (
                <div key={b.t} className={`welcome-code__row welcome-code__row--d${b.d}`}>
                  <button
                    type="button"
                    className={`welcome-code__chip${activeLine === i ? " is-active" : ""}`}
                    onMouseEnter={() => setActiveLine(i)}
                    onMouseLeave={() => setActiveLine((cur) => (cur === i ? null : cur))}
                    onFocus={() => setActiveLine(i)}
                    onBlur={() => setActiveLine((cur) => (cur === i ? null : cur))}
                  >
                    {b.t}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="welcome-compare__side">
            <p className="welcome-compare__label">What it writes</p>
            <pre className="welcome-code"><code>{PYTHON.map((line, i) => (
              <span key={i} className={`welcome-code__line${activeLine === i ? " is-active" : ""}`}>
                {line.map(([text, kind], j) => (
                  <span key={j} className={kind ? `welcome-tok welcome-tok--${kind}` : undefined}>
                    {text}
                  </span>
                ))}
                {"\n"}
              </span>
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

      {/* §4 — the 3D viewport. First of four `welcome-section--band`
          sections (brief move 1): every second .welcome-section (§4, §6,
          §8, §12 — 2nd/4th/6th/8th of the page's eight) carries the
          full-bleed surface + category-strip chapter marker; welcome.css
          carries the rest of the rationale. */}
      <section
        className={`welcome-section welcome-section--${CAT.viewport} welcome-section--band welcome-reveal`}
        aria-labelledby="s-view"
      >
        <Eyebrow Icon={OrbitIcon}>Watch it run</Eyebrow>
        <h2 id="s-view">Physics you can see happening.</h2>
        <p>
          Simulations render live in 3D — GlowScript VPython, shipped with the app, works
          offline. A telemetry label keeps live values in the scene while it runs.
        </p>
        {/* The two enumerations that used to be run-on sentences (fun-
            redesign brief §2, §4 entry) — scannable chip rows instead of
            parsed prose. Camera-control detail (reset/fit/fullscreen/
            snapshot) moves to Help's Viewport reference. */}
        <ul className="welcome-chips">
          {SCENE_OBJECTS.map((o) => <li key={o} className="badge">{o}</li>)}
        </ul>
        <ul className="welcome-chips">
          {VECTOR_OPS.map((o) => <li key={o} className="badge badge--accent">{o}</li>)}
        </ul>
        <p className="welcome-helpref">
          Camera reset, fit, fullscreen and snapshot are covered in Viewport, inside Help.
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
            alt="The 3D viewport mid-run on the Projectile Motion template, camera zoomed to the bounce: the ball arcing over the ground on its trail, past the launch marker and the ball's second bounce."
            width={635}
            height={255}
          />
          <figcaption>
            The scene renders live while the loop runs — this frame is zoomed to the bounce
            instead of the wide default view.
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
          Debug Mode pauses the simulation without losing it — step a frame, step to the
          next value, or just watch.
        </p>
        <p>
          If a program has nothing to pause on, it says so instead of hanging.
        </p>
        {/* §5's artifact (fun-redesign brief §2, §5 entry, and #3 in its
            prioritized cut-line): the page's biggest gap before this
            tranche — the strongest differentiator, previously the most
            text-only section with no artifact at all. DebugDemo.js
            demonstrates the dashed/solid outline claim above instead of only
            stating it. */}
        <DebugDemo />
        <p className="welcome-helpref">
          Pin, filter, threshold alerts, snapshots and watch expressions are covered in
          Debug Mode, inside Help.
        </p>
      </section>

      {/* §6 — from a run to a dataset. */}
      <section
        className={`welcome-section welcome-section--${CAT.measure} welcome-section--band welcome-reveal`}
        aria-labelledby="s-measure"
      >
        <Eyebrow Icon={RecordIcon}>Measure it</Eyebrow>
        <h2 id="s-measure">Turn a simulation into data you can analyse.</h2>
        <p>
          Record a run, then turn it into a dataset with Chart — or export it as CSV.
          Hybrid projects keep the viewport and the data panel in one pane.
        </p>
        {/* The record/export/crop sentence becomes a diagram of the actual
            pipeline (fun-redesign brief §2, §6 entry) — the same badge chip
            + arrow language as §11's gravity-preset row, at the scale of a
            three-step flow. Static, not interactive: nothing in this brief
            asks §6's artifact to click. */}
        <div className="welcome-pipeline-mini">
          <span className="badge badge--accent">Run</span>
          <span className="welcome-pipeline-mini__arrow" aria-hidden="true">→</span>
          <span className="badge badge--accent">Record</span>
          <span className="welcome-pipeline-mini__arrow" aria-hidden="true">→</span>
          <span className="badge badge--accent">Chart</span>
        </div>
        <p className="welcome-helpref">
          Choosing which variables to keep and cropping a time range are covered in
          Measure, inside Help.
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
          Load one of six built-in datasets — or bring your own CSV, or promote a run into
          one.
        </p>
        {/* The dataset-list sentence becomes a chip row (fun-redesign brief
            §2, §7 entry): every chip's text reproduces one of the six
            row-count substrings the "every built-in dataset's row count on
            the page is the row count in its JSON" test greps for, verbatim,
            parenthetical included — the DATASETS array above IS those six
            locked strings (test-lock migration plan item 2). */}
        <ul className="welcome-chips">
          {DATASETS.map((d) => <li key={d} className="badge">{d}</li>)}
        </ul>
        {/* Each stage becomes a native <details>/<summary> (fun-redesign
            brief §2, §7 entry, and #2 in its prioritized cut-line): zero-JS,
            keyboard-native, no ARIA needed. Kills the section's densest wall
            of always-open prose — 8 full sentences — with progressive
            disclosure. Nothing here locks the panel's markup shape (test-lock
            migration plan: "no lock exists" for this section's card bodies),
            so the tag swap is free. */}
        <div className="welcome-grid">
          {PIPELINE.map(([name, teaser, line]) => (
            <details key={name} className="card welcome-stage">
              <summary>
                <h3>{name}</h3>
                <span className="welcome-stage__teaser">{teaser}</span>
              </summary>
              <p>{line}</p>
            </details>
          ))}
        </div>
        <p>
          A least-squares fit reports slope, intercept, R&sup2; and n with a plain-English
          verdict, and the whole pipeline re-runs live as you edit blocks.
        </p>
      </section>

      {/* §8 — starting points. */}
      <section
        className={`welcome-section welcome-section--${CAT.starting} welcome-section--band welcome-reveal`}
        aria-labelledby="s-start"
      >
        <Eyebrow Icon={BookOpenIcon}>Don&rsquo;t start from nothing</Eyebrow>
        <h2 id="s-start">18 worked projects, ready to open.</h2>
        <p>
          18 worked projects — 4 Python examples, the same 4 as blocks, 7 data-science
          investigations, 3 hybrid topics.
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
        <p className="welcome-helpref">
          Starter chips for an empty canvas, the new-project wizard, and all 14 Help
          sections live inside the IDE.
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
          Your work saves to your computer first, and syncs to your account when
          you&rsquo;re signed in.
        </p>
        <p>Export any way you like:</p>
        {/* The export-format run-on sentence becomes a chip row (fun-redesign
            brief §2, §9 entry) — same .badge primitive §8 already uses. */}
        <ul className="welcome-chips">
          {EXPORT_FORMATS.map((f) => <li key={f} className="badge">{f}</li>)}
        </ul>
        {/* A small static mock of the sync chip's own language (see
            SyncChipMock above) demonstrates "the sync chip tells you the
            truth at a glance" instead of describing it. */}
        <SyncChipMock />
        <p className="welcome-note">
          If the same project is edited in two places, the most recent edit wins and the
          older version is kept rather than discarded.
        </p>
        <p className="welcome-helpref">
          Guest import, per-account limits and sync timing are covered in{" "}
          <Link to="/about">About</Link>.
        </p>
      </section>

      {/* §10 — by the numbers. */}
      <section className="welcome-numbers welcome-reveal" aria-labelledby="s-numbers">
        <h2 id="s-numbers" className="welcome-sr">Physics IDE by the numbers</h2>
        {/* A tile with an in-page section is a real anchor to it; the global
            focus-visible ring covers a[href], so no :focus rule anywhere.
            Each tile also gets a hover/focus-revealed provenance caption
            (fun-redesign brief §2, §10 entry, and #5 in its prioritized
            cut-line) — the same max-height/opacity reveal pattern as §2's
            flip-tiles. The numeral itself (.welcome-stat__n) is untouched:
            it never animates, on load or on hover — the brief's hard
            boundary in §0, satisfied by construction since the note is a
            separate sibling span, not part of the numeral. The unlinked "14"
            tile has no <a> to carry :hover/:focus-visible, so it gets an
            explicit tabIndex — still a <div> (the "linked stat tiles" test
            checks tagName, unaffected), just keyboard-reachable now. */}
        {STATS.map(([n, label, target, note]) => {
          const body = (
            <>
              <span className="welcome-stat__n">{n}</span>
              <span className="welcome-stat__label">{label}</span>
              <span className="welcome-stat__note">{note}</span>
            </>
          );
          return target ? (
            <a key={label} className="welcome-stat" href={`#${target}`}>{body}</a>
          ) : (
            <div key={label} className="welcome-stat" tabIndex={0}>{body}</div>
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
        className={`welcome-section welcome-section--${CAT.classrooms} welcome-section--band welcome-reveal`}
        aria-labelledby="s-class"
      >
        <Eyebrow Icon={GraduationCapIcon}>For teachers</Eyebrow>
        <h2 id="s-class">Classes today. Assignments next.</h2>
        <p>
          Any teacher can sign up and create a class in a minute — no approval queue.
        </p>
        <p>Four ways to invite people in:</p>
        {/* The four join methods, as a chip row (fun-redesign brief §2, §12
            entry) instead of a clause-heavy sentence. Text-only, per the file
            boundary: no icon already imported into this file reads cleanly
            as "code" / "link" / "QR" / "email", and components/Icons.js is
            out of scope for a new export to make one fit better. */}
        <ul className="welcome-chips">
          {JOIN_WAYS.map((w) => <li key={w} className="badge">{w}</li>)}
        </ul>
        <p className="welcome-helpref">
          Roles, join policies, the People tab and archiving are covered in{" "}
          <Link to="/about">About</Link>.
        </p>

        {/* Friendlier framing (fun-redesign brief §3): a warmer lead-in
            before the two locked phrases, which must survive verbatim
            (test-lock migration plan item 4) — "Not yet built." and
            "designed but not shipped", both still present below,
            byte-for-byte. */}
        <div className="card card--panel welcome-notbuilt">
          <p className="welcome-notbuilt__lead">
            The roster, join settings and people are real today.
          </p>
          <h3>Not yet built.</h3>
          <p>
            Assignments, submissions, marking, feedback and a gradebook are designed but
            not shipped. When marking arrives it will be announced here.
          </p>
        </div>

        <div className="welcome-privacy">
          <h3>
            <span className="welcome-privacy__mark" aria-hidden="true"><PrivacyIcon size={16} /></span>
            No surveillance layer
          </h3>
          <p>
            No tracking, no paste detection, no webcam, no keystroke logging — the only
            record kept is signups, joins and join requests, so a join can be audited,
            never so a student can be watched. <Link to="/about">More in About</Link>.
          </p>
        </div>

        <div className="welcome-access">
          <h3>Accessibility is a code path, too</h3>
          <p>
            Contrast is checked in code, one focus ring serves the whole product, and
            reduced motion actually turns the animation off — end to end, tested.{" "}
            <Link to="/about">More in About</Link>.
          </p>
        </div>
      </section>

      <footer className="welcome-foot welcome-reveal">
        <p className="welcome-foot__scope">
          The IDE needs a laptop or desktop — 1024px or wider. This page reads fine on a phone.
        </p>
        <p>
          No charge, no billing — a 200-account cap the software enforces itself.
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
