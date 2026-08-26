/**
 * WelcomePage — the front page at /welcome.
 *
 * v2 (2026-08-26): a full redesign onto the user's own wireframe — a
 * full-viewport hero (giant title + a full-bleed, click-to-drop physics
 * canvas) with the site nav sitting at the hero's bottom edge and sticking
 * to the top of the screen on scroll, then five minimal sections, a quiet
 * numbers ribbon, and a one-line footer. The nine-screen, chip-dense
 * "fun pivot" this replaces is retired in full — see
 * .superpowers/sdd/welcome-upgrade/redesign-v2-report.md for the section
 * census, the video-or-fallback outcome, and exactly which locks moved,
 * survived unchanged, or were cut with the section that carried them.
 *
 * The rule this file is still written under (Plan 5, spec §18) is
 * unchanged: **if a claim cannot be pointed at a file, it does not ship.**
 * The one thing the product does not do yet is stated plainly in §5 below
 * rather than omitted.
 *
 * ── THE NUMBERS LEDGER ───────────────────────────────────────────────────
 * Every numeral on the page (now the closing ribbon, RIBBON below), and
 * where it comes from. welcomePage.test.js re-derives the two that can
 * change under this file's feet (toolbox block count, chart-block count) on
 * every run, so a data change breaks the build rather than the reader's
 * trust — the per-dataset row-count breakdown that used to be checked the
 * same way lived in §7's chip row (retired; see the report), so only the
 * "6" total survives as a ribbon numeral, unbroken down.
 *
 *   151 block types      utils/blockly/toolbox.js — unique <block type=…>
 *   18 worked projects   precodedExamples.js EXAMPLES = 4; blockTemplates.js
 *                          BLOCK_TEMPLATES = 4, DS_TEMPLATES = 10 (7 data-science
 *                          + 3 hybrid analyses) → 4+4+7+3
 *   6 built-in datasets  utils/dataset/dataset.js BUILTIN_LOADERS — 6 files
 *                          in utils/dataset/builtins/*.json
 *   6 chart types        the six ds_chart_* blocks: bar, line, scatter,
 *                          histogram, box (Charts drawer) and scatter_fit
 *                          (Analyzing Relationships).
 *   14 doc sections      components/HelpPage.js — 14 section objects
 *   0 servers            GlowScript is vendored, Monaco and Blockly are
 *                          bundled, the data-science blocks run as JS.
 *   3 keycaps shown      utils/hotkeys.js matchHotkey — Ctrl/Cmd+Enter and bare
 *                          F5 both return "runToggle": Run and Stop are ONE
 *                          button in the viewport header and the keyboard
 *                          matches it, so the row's first keycap says
 *                          "run / stop", not "run". Esc is stop-only by design,
 *                          Ctrl/Cmd+S saves. F5 is named in §1's helpref
 *                          pointer to Help, not the row.
 *                          Space / F10 / Shift+F10 are debug-mode-only
 *                          (hooks/useDebugHotkeys.js) and are named in §1's
 *                          second helpref pointer to Help (right-click/
 *                          Alt-click to set a breakpoint is there too),
 *                          never in the keycap row. §1, not the old §4/§5,
 *                          because v2 folded "watch it run" and "look
 *                          inside" into one video section — see the report's
 *                          "where the restored facts now live" note.
 *   4 worked-project     Tranche 2, §8, now §4 "Open something real":
 *   tiles opened           blocks_projectile, blocks_pendulum, blocks_orbits
 *                          (blockTemplates.js BLOCK_TEMPLATES) and
 *                          ds_penguins_stats (DS_TEMPLATES) — verified
 *                          against those exports directly, opened via
 *                          pendingTemplate.js + hooks/usePendingTemplateSeed.js
 *                          onto StartMenu's own buildManifestSpec.
 *   2 demo video loops   assets/welcome/demo-run.webm (blocks snap → Run →
 *                          the 3D scene moving, captured on the Projectile
 *                          Motion template) and demo-analysis.webm (loading
 *                          the Palmer Penguins dataset → a chart drawing and
 *                          the table filling, captured on the Penguins:
 *                          exploratory analysis template) — both captured
 *                          live against the running product by the throwaway
 *                          frontend/e2e/welcome-video-capture.mjs (gitignored,
 *                          not shipped) and encoded with ffmpeg (present on
 *                          this machine), muted vp9/webm loops. Poster frames
 *                          (demo-run-poster.webp, demo-analysis-poster.webp)
 *                          are each video's first captured frame, shown under
 *                          prefers-reduced-motion in place of autoplay.
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
 *    through go() like the rest.
 *    The site nav (WelcomeHeader.js) is a child component, not a bare Link in
 *    this file, so it does not trip the grep below — but it holds the same
 *    discipline: this page passes it onSignIn={() => go("/auth/signin")} and
 *    onOpenIde={() => go("/")}, so its Sign in and Open the IDE controls still
 *    stamp the pass. WelcomeSubpage.js (/about, /contact) passes neither —
 *    those two routes are gate-free, like /join, so their header falls back
 *    to plain Links, the same shape JoinClassPage.js already uses.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import GravityPlayground from "./GravityPlayground";
import WelcomeHeader from "./WelcomeHeader";
import { setPendingTemplate } from "./pendingTemplate";
import {
  PlayIcon,
  BlocksIcon,
  ChartIcon,
  BookOpenIcon,
  GraduationCapIcon,
  RocketIcon,
  AtomIcon,
  GlobeIcon,
  TableIcon,
} from "../components/Icons";
import { WELCOME_PASSED_SESSION_KEY } from "../constants";
import demoRunWebm from "../assets/welcome/demo-run.webm";
import demoRunPoster from "../assets/welcome/demo-run-poster.webp";
import demoAnalysisWebm from "../assets/welcome/demo-analysis.webm";
import demoAnalysisPoster from "../assets/welcome/demo-analysis-poster.webp";

/* The section identity ramp, exactly as pane headers use it
   (workspace.css:65-67), resolved by name into the shared `.welcome-cat-*`
   utility (welcome.css) — never string-concatenated from anything but this
   trusted table. */
const CAT = {
  work: "motion",
  blocks: "values",
  analyse: "data-science",
  open: "logic",
  classrooms: "communicate",
};

/* §"Blocks or Python"'s artefact: a block stack and the Python it generates.
   Hand-spanned, no highlighting library (Budget §4.4). The Python is what
   blocklyGenerator.js actually emits for these blocks — sphere_block,
   set_velocity_block, forever_loop_block, rate_block, apply_force_block,
   update_position_block. The COPY (every character these six lines render)
   is unchanged from tranche 2 — only the markup changed, to real block
   facsimiles (welcome-real-blocks plan). `cat` is each block's REAL
   registry category (blockRegistry.js — sphere_block: Objects,
   set_velocity_block/apply_force_block/update_position_block: Motion,
   forever_loop_block/rate_block: Control), not the section's own accent.
   `segs` replaces the old flat `t` string: an array of plain strings and
   `slot(...)`-wrapped value spans that render as lighter input pills — but
   every segment's text, concatenated in order, reproduces the original `t`
   character-for-character (checked line by line below), so the ledger
   discipline holds under the new markup. `children` replaces the old `d`
   depth flag: forever_loop_block is the toolbox's one C-block among these
   six, and its three children (rate/apply_force/update_position) now nest
   inside its own DOM node — real C-wrap geometry, not a padding-left
   indent. `i` is each block's index into the index-aligned PYTHON array
   below, preserved through the nesting so the hover-link still lights up
   the right Python line regardless of DOM depth. */
function slot(text) {
  return { text, slot: true };
}
const BLOCK_STACK = [
  {
    i: 0,
    cat: "objects", // sphere_block
    // "ball = sphere" + "   " + "pos " + "(0, 5, 0)" + "   " + "radius " + "0.5"
    //   = "ball = sphere   pos (0, 5, 0)   radius 0.5"
    segs: ["ball = sphere", "   ", "pos ", slot("(0, 5, 0)"), "   ", "radius ", slot("0.5")],
  },
  {
    i: 1,
    cat: "motion", // set_velocity_block
    // "set ball velocity to" + "   " + "vector " + "3, 0, 0"
    //   = "set ball velocity to   vector 3, 0, 0"
    segs: ["set ball velocity to", "   ", "vector ", slot("3, 0, 0")],
  },
  {
    i: 2,
    cat: "control", // forever_loop_block — the one C-block among these six
    segs: ["forever"],
    children: [
      {
        i: 3,
        cat: "control", // rate_block
        // "rate " + "60" = "rate 60"
        segs: ["rate ", slot("60")],
      },
      {
        i: 4,
        cat: "motion", // apply_force_block
        // "apply force to ball" + "   " + "accel " + "(0, -9.81, 0)" + "   " + "dt " + "0.01"
        //   = "apply force to ball   accel (0, -9.81, 0)   dt 0.01"
        segs: [
          "apply force to ball",
          "   ",
          "accel ",
          slot("(0, -9.81, 0)"),
          "   ",
          "dt ",
          slot("0.01"),
        ],
      },
      {
        i: 5,
        cat: "motion", // update_position_block
        // "update position of ball" + "   " + "dt " + "0.01"
        //   = "update position of ball   dt 0.01"
        segs: ["update position of ball", "   ", "dt ", slot("0.01")],
      },
    ],
  },
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

/* The closing ribbon (retired §10's six stat tiles — no links, no
   hover-reveals, no per-item target: redesign brief, numbers strip
   "compressed to a single quiet one-line ribbon"). [numeral, label]. */
const RIBBON = [
  ["151", "block types"],
  ["18", "worked projects"],
  ["6", "built-in datasets"],
  ["6", "chart types"],
  ["14", "documentation sections"],
  ["0", "servers doing your physics"],
];

/* §4 "Open something real"'s four worked-project tiles — unchanged ids from
   tranche 2, each a real template id verified against blockTemplates.js's
   BLOCK_TEMPLATES / DS_TEMPLATES (see the ledger). A click stamps the id via
   pendingTemplate.js and goes through go("/") like every other CTA on this
   page. `cat` tints the tile per block-category colour (redesign brief:
   "tinted per block-category colour (colour!)") — the same four categories
   the hero canvas already draws its balls in, cycled one per tile. */
const WORKED_TILES = [
  {
    id: "blocks_projectile",
    title: "Projectile Motion",
    Icon: RocketIcon,
    cat: "motion",
    mechanism:
      "Drag scales with speed squared; the ball loses energy at each bounce until it settles.",
  },
  {
    id: "blocks_pendulum",
    title: "Simple Pendulum",
    Icon: AtomIcon,
    cat: "values",
    mechanism:
      "A nonlinear restoring force and linear damping set the angular acceleration every frame.",
  },
  {
    id: "blocks_orbits",
    title: "Sun, Earth & Moon",
    Icon: GlobeIcon,
    cat: "objects",
    mechanism:
      "Two gravity sources at once — the Moon orbits Earth while Earth orbits the Sun — integrated with velocity-Verlet.",
  },
  {
    id: "ds_penguins_stats",
    title: "Penguins: Exploratory Analysis",
    Icon: TableIcon,
    cat: "data-science",
    mechanism: "Bill length regressed against body mass, with Pearson’s r and a fitted line over the scatter.",
  },
];

function prefersReducedMotion() {
  try {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    return false;
  }
}

/* A real block facsimile for §"Blocks or Python" — CSS-only, category-fill,
   white label, a slot pill per value, C-wrap for forever_loop_block's three
   children (welcome.css .welcome-block*). Deliberately non-interactive: the
   hover-link that syncs the matching Python line is a mouse-only nicety
   (onMouseEnter/onMouseLeave), not a control — no button role, no tabindex,
   no keyboard handler, so a diagram never reads as a fake interactive
   widget. Recurses once in practice (forever_loop_block's children do not
   themselves nest), but is written generally rather than special-cased. */
function Block({ b, activeLine, setActiveLine }) {
  const isActive = activeLine === b.i;
  return (
    <div className={`welcome-block welcome-block--${b.cat}${b.children ? " welcome-block--c" : ""}`}>
      <div
        className={`welcome-block__bar${isActive ? " is-active" : ""}`}
        onMouseEnter={() => setActiveLine(b.i)}
        onMouseLeave={() => setActiveLine((cur) => (cur === b.i ? null : cur))}
      >
        <span className="welcome-block__label">
          {b.segs.map((s, j) =>
            typeof s === "string" ? (
              s
            ) : (
              <span key={j} className="welcome-block__slot">{s.text}</span>
            ),
          )}
        </span>
      </div>
      {b.children ? (
        <div className="welcome-block__c-body">
          {b.children.map((c) => (
            <Block key={c.i} b={c} activeLine={activeLine} setActiveLine={setActiveLine} />
          ))}
          <div className="welcome-block__c-foot" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}

/** An eyebrow micro-label carrying its section's category mark. */
function Eyebrow({ Icon, children }) {
  return (
    <p className="welcome-eyebrow">
      <span className="welcome-eyebrow__mark" aria-hidden="true"><Icon size={14} /></span>
      {children}
    </p>
  );
}

/* §1 and §3's artefact: a short, muted, looping capture of the real product
   (redesign brief: "the most literal claim on the page"). Under
   prefers-reduced-motion the video never autoplays — a poster frame plus a
   real Play button take its place, so motion only ever starts on a
   deliberate click (the same "degrade, don't delete" rule the hero canvas
   and the old scroll-reveal already follow). */
function DemoVideo({ webm, poster, width, height, alt, caption }) {
  const [reduced] = useState(prefersReducedMotion);
  const [playing, setPlaying] = useState(false);
  const live = !reduced || playing;
  return (
    <figure className="welcome-demo">
      {live ? (
        <video
          className="welcome-demo__video"
          src={webm}
          poster={poster}
          width={width}
          height={height}
          autoPlay={!reduced}
          loop
          muted
          playsInline
          aria-label={alt}
        />
      ) : (
        <div className="welcome-demo__poster" style={{ aspectRatio: `${width} / ${height}` }}>
          <img className="welcome-demo__poster-img" src={poster} alt={alt} width={width} height={height} />
          <button
            type="button"
            className="welcome-demo__play"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: ${alt}`}
          >
            <PlayIcon size={22} />
          </button>
        </div>
      )}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export default function WelcomePage() {
  const navigate = useNavigate();
  /* §"Blocks or Python"'s hover-link: which index (if any) is under the
     pointer or keyboard focus. Both BLOCK_STACK and PYTHON are index-
     aligned (see their own comments above), so one integer is the whole
     mechanism — no state machine needed. Unchanged from tranche 2. */
  const [activeLine, setActiveLine] = useState(null);

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
       resolve to their final state rather than staying at opacity 0. */
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

      {/* ── Hero: the only thing a visitor sees on open ─────────────────
          Full-viewport (welcome.css: min-height calc(100vh - header-h)),
          giant title over a full-bleed, click-to-drop physics canvas — the
          gravity-playground engine promoted here from its own retired
          section (redesign brief: "the hero's interactive animation"). The
          nav (WelcomeHeader) is deliberately the NEXT element in the DOM,
          not a child of this <header> — it sits at the hero's bottom edge
          and sticks to the top of the screen on scroll, pure CSS, no JS
          (welcome.css's `.welcome-header { position: sticky; top: 0 }`). */}
      <header className="welcome-hero">
        <GravityPlayground />
        <div className="welcome-hero__content">
          <h1>Physics IDE</h1>
          <p className="welcome-tagline">
            Build a simulation with blocks or Python, run it live in 3D, then analyse the
            data it produces — free, in your browser, no account needed.
          </p>
          <button className="btn btn--primary btn--lg" type="button" onClick={() => go("/")}>
            Use the IDE — no account needed
          </button>
        </div>
      </header>

      <WelcomeHeader onSignIn={() => go("/auth/signin")} onOpenIde={() => go("/")} />

      <div id="welcome-main" tabIndex={-1} />

      {/* §1 — "See it work": the product on video, plus the run/debug
          keyboard facts (redesign task: the F5↔Ctrl+Enter equivalence, the
          Space/F10/Shift+F10 debug chords and the right-click/Alt-click
          breakpoint gesture MUST survive this redesign — this is where they
          now live, as quiet reference text under the clip rather than their
          own section; see the ledger above and the report's "where the
          restored facts now live" note). */}
      <section className={`welcome-section welcome-cat-${CAT.work} welcome-reveal`} aria-labelledby="s-work">
        <Eyebrow Icon={PlayIcon}>See it work</Eyebrow>
        <h2 id="s-work">Blocks snap together. Press Run. Watch it move.</h2>
        <p>
          This clip is the real product, not a mock-up — a block stack builds a scene, then
          the physics plays out live in 3D.
        </p>
        <DemoVideo
          webm={demoRunWebm}
          poster={demoRunPoster}
          width={960}
          height={540}
          alt="The block editor on the Projectile Motion template: a stack of blocks, then the Run button pressed, then the 3D viewport showing the ball arc and bounce."
          caption="Projectile Motion: blocks to a running 3D scene, captured live."
        />
        <p className="welcome-helpref">
          <kbd className="tb-kbd">F5</kbd> is a bare-key match for{" "}
          <kbd className="tb-kbd">Ctrl</kbd>
          <span className="welcome-keys__plus">+</span>
          <kbd className="tb-kbd">Enter</kbd> — both run or stop the simulation. Full
          keyboard reference lives in Help, inside the IDE.
        </p>
        <ul className="welcome-keys">
          <li><kbd className="tb-kbd">Ctrl</kbd><span className="welcome-keys__plus">+</span><kbd className="tb-kbd">Enter</kbd> run / stop</li>
          <li><kbd className="tb-kbd">Esc</kbd> stop</li>
          <li><kbd className="tb-kbd">Ctrl</kbd><span className="welcome-keys__plus">+</span><kbd className="tb-kbd">S</kbd> save</li>
        </ul>
        <p className="welcome-helpref">
          In Debug Mode, right-click a block — or Alt-click it — to set a breakpoint.{" "}
          <kbd className="tb-kbd">Space</kbd> pauses and resumes,{" "}
          <kbd className="tb-kbd">F10</kbd> steps a frame,{" "}
          <kbd className="tb-kbd">Shift</kbd>
          <span className="welcome-keys__plus">+</span>
          <kbd className="tb-kbd">F10</kbd> steps to the next value.
        </p>
      </section>

      {/* §2 — "Blocks or Python": the interactive compare panel, decluttered
          (no chips, no screenshot around it) — unchanged mechanism from
          tranche 2. */}
      <section className={`welcome-section welcome-cat-${CAT.blocks} welcome-reveal`} aria-labelledby="s-blocks">
        <Eyebrow Icon={BlocksIcon}>Blocks or Python</Eyebrow>
        <h2 id="s-blocks">Same project, two views.</h2>
        <p>
          Drag blocks, or write Python — the blocks generate real, readable code, and
          either view stays in sync with the other.
        </p>
        <div className="welcome-compare">
          <div className="welcome-compare__side">
            <p className="welcome-compare__label">What you drag</p>
            <div className="welcome-code welcome-code--blocks">
              {BLOCK_STACK.map((b) => (
                <Block key={b.i} b={b} activeLine={activeLine} setActiveLine={setActiveLine} />
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
      </section>

      {/* §3 — "From run to analysis": the second video loop. */}
      <section className={`welcome-section welcome-cat-${CAT.analyse} welcome-reveal`} aria-labelledby="s-analyse">
        <Eyebrow Icon={ChartIcon}>From run to analysis</Eyebrow>
        <h2 id="s-analyse">One block turns a run into a chart.</h2>
        <p>
          Record what happened, or load a dataset — the same blocks describe it, chart it,
          and fit a line through it.
        </p>
        <DemoVideo
          webm={demoAnalysisWebm}
          poster={demoAnalysisPoster}
          width={960}
          height={540}
          alt="A data-science project on the Penguins template: the block pipeline running, a data table filling with rows, then a chart drawing bill length against body mass."
          caption="Palmer Penguins: a table fills, then a chart draws — captured live."
        />
      </section>

      {/* §4 — "Open something real": four real templates, one click away,
          plus the class-code join door (redesign brief: moved here from the
          old hero — "everything else leaves the hero"). */}
      <section className={`welcome-section welcome-cat-${CAT.open} welcome-reveal`} aria-labelledby="s-open">
        <Eyebrow Icon={BookOpenIcon}>Open something real</Eyebrow>
        <h2 id="s-open">18 worked projects. Four are one click away.</h2>
        <p>
          Open a real template as a guest, no setup — or start from nothing inside the IDE.
        </p>
        <div className="welcome-grid">
          {WORKED_TILES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`card card--interactive welcome-tile welcome-cat-${t.cat}`}
              data-template-id={t.id}
              onClick={() => openTile(t.id)}
            >
              <span className="welcome-tile__icon" aria-hidden="true"><t.Icon size={20} /></span>
              <h3 className="welcome-tile__title">{t.title}</h3>
              <p className="welcome-tile__mech">{t.mechanism}</p>
            </button>
          ))}
        </div>
        {/* The fourth door: /join is ungated, but go() stamps the pass
            first like every other door on this page (hard constraint 2). */}
        <p className="welcome-quiet">
          Have a class code?{" "}
          <button className="welcome-linklike" type="button" onClick={() => go("/join")}>
            Join your class
          </button>
        </p>
      </section>

      {/* §5 — "For classrooms": the honesty section. Two short lines, the
          locked "Not yet built." panel verbatim, and a link out for depth —
          the privacy and accessibility paragraphs tranche 2.5 added here
          move to /about (outside this file's boundary) rather than surviving
          on a five-section page. */}
      <section className={`welcome-section welcome-cat-${CAT.classrooms} welcome-reveal`} aria-labelledby="s-class">
        <Eyebrow Icon={GraduationCapIcon}>For classrooms</Eyebrow>
        <h2 id="s-class">Classes today. Assignments next.</h2>
        <p>
          Any teacher can sign up and create a class in a minute — no approval queue.
        </p>
        <p>
          The roster, join settings and people are real today.
        </p>
        <div className="card card--panel welcome-notbuilt">
          <h3>Not yet built.</h3>
          <p>
            Assignments, submissions, marking, feedback and a gradebook are designed but
            not shipped. When marking arrives it will be announced here.
          </p>
        </div>
        <p className="welcome-helpref">
          More on roles, join policies and privacy in <Link to="/about">About</Link>.
        </p>
      </section>

      {/* The closing ribbon: one quiet line, six numerals, no tiles, no
          hover-reveals (redesign brief). A visually-hidden heading keeps it
          a real landmark without adding a visible seventh "idea" to the
          page. */}
      <section className="welcome-ribbon welcome-reveal" aria-labelledby="s-numbers">
        <h2 id="s-numbers" className="welcome-sr">Physics IDE by the numbers</h2>
        <ul className="welcome-ribbon__list">
          {RIBBON.map(([n, label]) => (
            <li key={label}>
              <span className="welcome-ribbon__n">{n}</span> {label}
            </li>
          ))}
        </ul>
      </section>

      <footer className="welcome-foot welcome-reveal">
        <p className="welcome-foot__scope">
          The IDE needs a laptop or desktop — 1024px or wider. This page reads fine on a phone.
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
