/**
 * HelpPage.js
 *
 * Full-screen contextual help & documentation for Physics IDE.
 * Covers every feature from blocks to code to physics models.
 * Designed for junior developers, senior developers, and educators.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AtomIcon, RocketIcon, BlocksIcon, BookOpenIcon, CodeIcon,
  DownloadIcon, ZapIcon, LayersIcon, EditIcon, BugIcon,
  TableIcon, GraduationCapIcon,
} from "./Icons";
import { BLOCK_PALETTE, cssVarFor } from "../utils/blockly/blockPalette";
import { ChartIcon } from "./Icons";

/* ── Mini demo clips (captured by scripts/help-video-capture.mjs) ──
   Muted, looping, a few seconds each — they show the gesture the prose
   describes. Vite serves these as hashed asset URLs. */
import runBlocksVideo from "../assets/help/run-blocks.webm";
import runBlocksPoster from "../assets/help/run-blocks-poster.webp";
import liveGraphsVideo from "../assets/help/live-graphs.webm";
import liveGraphsPoster from "../assets/help/live-graphs-poster.webp";
import debugRecordVideo from "../assets/help/debug-record.webm";
import debugRecordPoster from "../assets/help/debug-record-poster.webp";
import analyseRoundtripVideo from "../assets/help/analyse-roundtrip.webm";
import analyseRoundtripPoster from "../assets/help/analyse-roundtrip-poster.webp";
import dataScienceVideo from "../assets/help/data-science.webm";
import dataSciencePoster from "../assets/help/data-science-poster.webp";

/* ── Tiny inline components ──────────────────────────────── */
function Code({ children }) {
  return <code className="help-inline-code">{children}</code>;
}
function Pre({ children }) {
  return (
    <pre className="help-code-block">
      <code>{children}</code>
    </pre>
  );
}
function Tag({ color = "blue", children }) {
  return <span className={`help-tag help-tag--${color}`}>{children}</span>;
}

/**
 * A block-category chip that is literally the colour of the blocks it names.
 *
 * Distinct from Tag (color="…") on purpose. Tag is the page's general-purpose
 * chip and has 51 uses that are not block categories at all — goal badges,
 * toolbar verbs, difficulty ratings, tab and export-format names — so it keeps
 * its ad-hoc colour words and its .help-tag--* rules. Only the eight chips that
 * name a real drawer come here, where the colour is the palette's and cannot
 * drift from the blocks it describes. Before Tranche 3 these eight quoted raw
 * Blockly hue integers, three of which were wrong and one of which ("colour
 * 330") named a hue no block ever used.
 */
function CategoryTag({ category, children }) {
  const e = BLOCK_PALETTE[category];
  if (!e) throw new Error(`CategoryTag: unknown block category ${JSON.stringify(category)}`);
  return (
    <span
      className="help-tag help-tag--cat"
      style={{ background: `var(${cssVarFor(category)})`, color: e.on }}
    >
      {children || category}
    </span>
  );
}
function Note({ type = "info", children }) {
  const icons = {
    info:    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    tip:     <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none"/></svg>,
    warning: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  };
  return (
    <div className={`help-note help-note--${type}`}>
      <span className="help-note-icon" style={{ flexShrink: 0, marginTop: 1 }}>{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}
function Kbd({ children }) {
  return <kbd className="help-kbd">{children}</kbd>;
}
/* A silent looping demo clip with a caption. preload="metadata" keeps the
   dozen clips on the page from all downloading up front; the poster paints
   until the loop starts. */
function HelpVideo({ src, poster, caption }) {
  return (
    <figure className="help-video">
      <video
        src={src}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-label={caption || "Demo clip"}
      />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
function SectionAnchor({ id }) {
  return <div id={id} className="help-section-anchor" />;
}

/* ── Section icon map ────────────────────────────────────── */
const SECTION_ICON_MAP = {
  "overview":        AtomIcon,
  "getting-started": RocketIcon,
  "debug-mode":      BugIcon,
  "block-editor":    BlocksIcon,
  "block-reference": BookOpenIcon,
  "live-graphs":     ChartIcon,
  "data-science":    TableIcon,
  "code-editor":     CodeIcon,
  "templates":       LayersIcon,
  "custom-scenes":   EditIcon,
  "vpython-ref":     CodeIcon,
  "physics-models":  AtomIcon,
  "export":          DownloadIcon,
  "educators":       GraduationCapIcon,
  "shortcuts":       ZapIcon,
};

function SectionHeader({ id, children }) {
  const Icon = SECTION_ICON_MAP[id] || AtomIcon;
  return (
    <div className="help-section-header">
      <div className="help-section-icon-badge">
        <Icon size={18} />
      </div>
      <h2 className="help-h2">{children}</h2>
    </div>
  );
}

/* ── Searchable content index ───────────────────────────── */
const SEARCH_INDEX = [
  {
    id: "overview",
    title: "Overview",
    content: "Physics IDE browser-based physics simulation data science environment three goals Physics Modelling Data Science Hybrid block editor VPython GlowScript 3D viewport WebGL architecture project goal wizard multi-project",
  },
  {
    id: "getting-started",
    title: "Getting Started",
    content: "start menu goal card Physics Modelling Data Science Hybrid blank template wizard title project list run simulation stop toolbar 3D viewport orbit pan zoom camera auto-save localForage multi-project open delete",
  },
  {
    id: "debug-mode",
    title: "Debug Mode",
    content: "debug mode breakpoints pause resume step execution highlight yellow glow red dot trace recording CSV synchronous stop block click toggle debugger inspect simulation code-only step forward F10 space pause overlay three panel",
  },
  {
    id: "block-editor",
    title: "Block Editor",
    content: "Google Blockly v11 goal-filtered toolbox drag connect blocks right-click duplicate delete undo redo Ctrl+Z Ctrl+Y code mirror block search Advanced drawer 3D Math Raw Python Loops sphere box gravity loop forever rate update position apply force logic loops math functions text variables physics constants domain filter",
  },
  {
    id: "block-reference",
    title: "Block Reference",
    content: "block reference objects motion forces physics constants values math logic control loops functions lists text advanced raw Python sphere box cylinder arrow helix ring trail velocity acceleration gravity mass bounce friction scene background expr_block expression custom code python_raw_block python_raw_expr_block define_const_block constant sim_start_block sim_end_block simulation structure rotate_object_block scene_camera_block cross_product_block dot_product_block math_trig_block sin cos tan radians degrees sqrt abs vector_compose_block math_pow_block math_min_block math_max_block math_clamp_block clamp power exponent 3D math trig",
  },
  {
    id: "live-graphs",
    title: "Live Graphs",
    content: "live graphs graph display series plot gcurve gdots line dots colour color legend graph panel under scene plot points during run graph_display_block graph_series_block graph_plot_block xtitle ytitle axis labels scene yields 55% real-time telemetry velocity displacement acceleration SHM pendulum graphs of motion",
  },
  {
    id: "data-science",
    title: "Data Science",
    content: "data science DS blocks toolbox load dataset penguins weather planets pendulum spring free fall freefall CSV trace filter sort group mean median mode min max range sum count stddev statistics regression slope intercept R squared linear fit uncertainty standard error linearization chart bar line scatter histogram box plot communicate note conclusion result Data panel Arquero Observable Plot ds_start_block ds_load_builtin_block ds_show_table_block ds_calc_mean_block ds_filter_eq_block ds_group_count_block ds_chart_bar_block ds_linear_regression_block ds_chart_scatter_fit_block ds_multiply_columns_block ds_print_uncertainty_block",
  },
  {
    id: "code-editor",
    title: "Code Editor",
    content: "Monaco editor VS Code syntax highlighting autocomplete IntelliSense VPython Python code template blank project read-only editable font size minimap line numbers keybindings shortcuts",
  },
  {
    id: "templates",
    title: "Built-in Templates",
    content: "built-in templates physics projectile motion pendulum spring orbital gravity data science penguins weather planets exploratory analysis compare cities Kepler regression Hooke's law spring constant uncertainty repeated measurements standard error pendulum period length mass investigation free fall measure g linearization hybrid topic coupling model-first data-first measure g from vertical velocity vy find k Fspring damping coefficient gamma Analyse this run",
  },
  {
    id: "custom-scenes",
    title: "Custom Scenes",
    content: "custom scenes variable dialog add variable rename delete variable management custom objects scene setup camera background colour color title",
  },
  {
    id: "vpython-ref",
    title: "VPython Reference",
    content: "VPython reference GlowScript 3.2 sphere box cylinder arrow helix ring curve points scene canvas rate loop vector vec color opacity texture pos radius axis up make_trail scene.title scene.background scene.camera scene.width scene.height",
  },
  {
    id: "physics-models",
    title: "Physics Models",
    content: "physics models kinematics Newton laws force mass acceleration gravity friction drag projectile circular motion orbital spring Hooke's law pendulum energy momentum conservation wave oscillation electric magnetic field Coulomb Lorentz",
  },
  {
    id: "export",
    title: "Export & Share",
    content: "export share download save PNG screenshot PDF print trace table CSV blocks workspace XML VPython code copy clipboard report project bundle physide.json import Open",
  },
  {
    id: "educators",
    title: "For Educators",
    content: "educators teachers classroom students physics data science guided learning assessment print PDF trace table lesson plan curriculum deployment Vercel classes class code join QR invite assignments instructions starter project workspace rules open practice standard classwork locked assessment guides submissions submit receipt fingerprint late marking marking room test copy teaching assistant draft release return gradebook CSV export pairs groups editing baton accounts sign in teacher account backend Fastify PostgreSQL 200 account cap",
  },
  {
    id: "shortcuts",
    title: "Keyboard Shortcuts",
    content: "keyboard shortcuts Ctrl+Enter run F5 run Escape stop Ctrl+S save Ctrl+Z undo Ctrl+Y redo Ctrl+A select all Delete Backspace Escape close help space Enter debug F10",
  },
];

/* ── Search results component ────────────────────────────── */
function highlight(text, query) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="help-search-highlight">{part}</mark> : part
  );
}

function SearchResults({ query, results, onNavigate }) {
  if (!query.trim()) return null;
  return (
    <div className="help-search-results">
      <p className="help-search-results-meta">
        {results.length === 0
          ? `No results for "${query}"`
          : `${results.length} section${results.length !== 1 ? "s" : ""} matching "${query}"`}
      </p>
      {results.map(({ id, title, snippet }) => (
        <button
          key={id}
          className="help-search-result-item"
          onClick={() => onNavigate(id)}
        >
          <span className="help-search-result-icon">
            {React.createElement(SECTION_ICON_MAP[id] || AtomIcon, { size: 14 })}
          </span>
          <span className="help-search-result-body">
            <span className="help-search-result-title">{highlight(title, query)}</span>
            <span className="help-search-result-snippet">{highlight(snippet, query)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── Navigation structure ────────────────────────────────── */
const NAV = [
  { id: "overview",        label: "Overview",               Icon: AtomIcon },
  { id: "getting-started", label: "Getting Started",        Icon: RocketIcon },
  { id: "debug-mode",      label: "Debug Mode",             Icon: BugIcon },
  { id: "block-editor",    label: "Block Editor",           Icon: BlocksIcon },
  { id: "block-reference", label: "Block Reference",        Icon: BookOpenIcon },
  { id: "live-graphs",     label: "Live Graphs",            Icon: ChartIcon },
  { id: "data-science",    label: "Data Science",           Icon: TableIcon },
  { id: "code-editor",     label: "Code Editor",            Icon: CodeIcon },
  { id: "templates",       label: "Built-in Templates",     Icon: LayersIcon },
  { id: "custom-scenes",   label: "Custom Scenes",          Icon: EditIcon },
  { id: "vpython-ref",     label: "VPython Reference",      Icon: CodeIcon },
  { id: "physics-models",  label: "Physics Models",         Icon: AtomIcon },
  { id: "export",          label: "Export & Share",         Icon: DownloadIcon },
  { id: "educators",       label: "For Educators",          Icon: GraduationCapIcon },
  { id: "shortcuts",       label: "Keyboard Shortcuts",     Icon: ZapIcon },
];

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function HelpPage({ onClose, focusBlockId }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const contentRef = useRef(null);
  const searchInputRef = useRef(null);

  /* Compute search results */
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_INDEX
      .map((entry) => {
        const titleMatch = entry.title.toLowerCase().includes(q);
        const contentMatch = entry.content.toLowerCase().includes(q);
        if (!titleMatch && !contentMatch) return null;
        /* Build a short snippet around the first match in content */
        const words = entry.content.split(" ");
        const idx = words.findIndex((w) => w.toLowerCase().includes(q));
        const start = Math.max(0, idx - 4);
        const snippet = words.slice(start, start + 12).join(" ") + (words.length > start + 12 ? "…" : "");
        return { id: entry.id, title: entry.title, snippet, titleMatch };
      })
      .filter(Boolean)
      .sort((a, b) => (b.titleMatch ? 1 : 0) - (a.titleMatch ? 1 : 0));
  }, [searchQuery]);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* Track active section via IntersectionObserver */
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const anchors = el.querySelectorAll(".help-section-anchor");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { root: el, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );
    anchors.forEach((a) => obs.observe(a));
    return () => obs.disconnect();
  }, []);

  /* Deep link from a block's right-click → Help (helpUrl "#/help?block=<id>").
     The anchor may be the row itself, or (for the two combined rows that
     document a pair of blocks) a hidden alias <span> inside the row — walk
     up to the row so the highlight and scroll target the visible entry. */
  useEffect(() => {
    if (!focusBlockId) return;
    const el = document.getElementById(`help-block-${focusBlockId}`);
    if (!el) return;
    const row = el.closest(".help-block-row") || el;
    row.scrollIntoView?.({ block: "center", behavior: "smooth" });
    row.classList.add("help-block-entry--focused");
    const t = setTimeout(() => row.classList.remove("help-block-entry--focused"), 2000);
    // Also clear the ring on cleanup (a new focusBlockId arriving, or
    // unmount, before the 2s timeout fires) — otherwise a superseded row
    // stays lit forever once its removal timer is cancelled.
    return () => {
      clearTimeout(t);
      row.classList.remove("help-block-entry--focused");
    };
  }, [focusBlockId]);

  function scrollTo(id) {
    const el = contentRef.current;
    if (!el) return;
    const target = el.querySelector(`#${id}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  function handleSearchNavigate(id) {
    setSearchQuery("");
    /* Small delay so the content re-renders before scrolling */
    setTimeout(() => scrollTo(id), 50);
  }

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label="Physics IDE Help">
      <div className="help-shell">
        {/* ── Top bar ── */}
        <div className="help-topbar">
          <div className="help-topbar-left">
            <span className="help-topbar-icon"><AtomIcon size={22} /></span>
            <h1 className="help-topbar-title">Physics IDE — Complete Guide</h1>
          </div>
          <button className="help-close-btn" onClick={onClose} title="Close Help (Esc)">
            Close
          </button>
        </div>

        <div className="help-body">
          {/* ── Sidebar ── */}
          <nav className="help-sidebar">
            {/* Search input */}
            <div className="help-search-box">
              <svg className="help-search-icon" viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                ref={searchInputRef}
                className="help-search-input"
                type="text"
                placeholder="Search help…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search help"
              />
              {searchQuery && (
                <button
                  className="help-search-clear"
                  onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <p className="help-sidebar-label">Sections</p>
            {NAV.map(({ id, label, Icon: NavIcon }) => (
              <button
                key={id}
                className={`help-nav-item${activeSection === id ? " help-nav-item--active" : ""}`}
                onClick={() => scrollTo(id)}
              >
                <span className="help-nav-icon"><NavIcon size={14} /></span>
                {label}
              </button>
            ))}
          </nav>

          {/* ── Main content ── */}
          <div className="help-content" ref={contentRef}>
            {searchQuery.trim() && (
              <SearchResults
                query={searchQuery}
                results={searchResults}
                onNavigate={handleSearchNavigate}
              />
            )}
            <div style={searchQuery.trim() ? { display: "none" } : {}}>

            {/* ══════════════ OVERVIEW ══════════════ */}
            <SectionAnchor id="overview" />
            <section className="help-section">
              <SectionHeader id="overview">Overview</SectionHeader>
              <p>
                <strong>Physics IDE</strong> is a browser-based environment for physics simulation and
                foundational data science. It combines a visual <strong>block editor</strong> (Google Blockly),
                a <strong>Monaco code editor</strong>, a live <strong>3D WebGL viewport</strong>, and a
                reactive <strong>Data panel</strong> — all running entirely in the browser with no installation required.
              </p>
              <Note type="info">
                All simulations and analyses execute locally in your browser. Physics simulations run
                inside an isolated GlowScript 3.2 iframe. Data Science analyses run in an async
                JavaScript sandbox. Simulations and analyses never run on a server. If you create an account, your projects can also sync to it — guests stay entirely local.
              </Note>

              <h3 className="help-h3">Three project goals</h3>
              <table className="help-table">
                <thead>
                  <tr><th>Goal</th><th>Toolbox</th><th>Output panel</th><th>Use it for</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><Tag color="blue">Physics Modelling</Tag></td>
                    <td>Values, Objects, Motion, State, Control, Logic, Math + Advanced</td>
                    <td>3D Viewport</td>
                    <td>VPython simulations — projectile, orbital, pendulum, spring</td>
                  </tr>
                  <tr>
                    <td><Tag color="green">Data Science</Tag></td>
                    <td>Data Science, Control, Logic, Math + Advanced</td>
                    <td>Data panel (tables, charts, values)</td>
                    <td>Exploratory data analysis on built-in or imported datasets</td>
                  </tr>
                  <tr>
                    <td><Tag color="purple">Hybrid</Tag></td>
                    <td>All physics and DS categories</td>
                    <td>3D Viewport + Data panel</td>
                    <td>Promote a simulation run to a dataset; analyse in the same project</td>
                  </tr>
                </tbody>
              </table>

              <h3 className="help-h3">Architecture at a glance</h3>
              <div className="help-arch-grid">
                <div className="help-arch-box help-arch-box--blue">
                  <strong>Block Editor</strong>
                  <p>Google Blockly v11. The toolbox is generated per goal — physics projects
                  never show DS blocks; DS projects never show physics objects. Each block
                  generates executable code automatically.</p>
                </div>
                <div className="help-arch-box help-arch-box--purple">
                  <strong>Code Editor</strong>
                  <p>Monaco (VS Code engine). Editable in blank and code-template projects.
                  Read-only code mirror when working in Blocks mode — shows the VPython generated
                  from your block stack in real time.</p>
                </div>
                <div className="help-arch-box help-arch-box--green">
                  <strong>3D Viewport</strong>
                  <p>Isolated iframe running GlowScript 3.2 VPython. Camera: left-drag to orbit,
                  right-drag to pan, scroll to zoom. Physics simulations render here.</p>
                </div>
                <div className="help-arch-box help-arch-box--teal">
                  <strong>Data Panel</strong>
                  <p>DS and Hybrid projects only. Re-executes the DS analysis automatically on
                  every workspace change and renders tables, charts, numeric values, and
                  conclusion cards in the right-hand panel.</p>
                </div>
              </div>

              <h3 className="help-h3">Two editing modes — every goal</h3>
              <p>
                Within any goal, use the <strong>Blocks / Code</strong> toggle in the toolbar to
                switch between both representations. In a Blocks project the Code tab is a
                read-only mirror — ideal for students learning to read generated VPython. In
                a Code project the Blocks tab provides a read-only block reference.
              </p>
              <Note type="tip">
                Toggling between Blocks and Code is the most effective way to help students
                connect visual programming to text programming at their own pace.
              </Note>
            </section>

            {/* ══════════════ GETTING STARTED ══════════════ */}
            <SectionAnchor id="getting-started" />
            <section className="help-section">
              <SectionHeader id="getting-started">Getting Started</SectionHeader>

              <h3 className="help-h3">The Start Menu</h3>
              <p>
                When you launch Physics IDE you land on the <strong>Start Menu</strong>. It shows
                your saved projects at the top, then one <strong>Start something new</strong>{" "}
                section: three goal cards that create a blank project instantly, followed by every
                template — Physics, Data science, and Hybrid topics.
              </p>
              <table className="help-table">
                <thead>
                  <tr><th>Goal card</th><th>What you get</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><Tag color="blue">Physics Modelling</Tag></td>
                    <td>A block workspace connected to the 3D viewport — or click the card's <em>Start in code instead</em> link for a plain Python editor.</td>
                  </tr>
                  <tr>
                    <td><Tag color="green">Data Science</Tag></td>
                    <td>A block workspace with the Data panel. A <Code>ds_start_block</Code> hat is pre-seeded; the DS templates sit right below the goal cards.</td>
                  </tr>
                  <tr>
                    <td><Tag color="purple">Hybrid</Tag></td>
                    <td>Both the 3D viewport and Data panel active. Simulate and analyse in the same project — or pick a coupled <strong>Hybrid topic</strong> from the templates below the cards.</td>
                  </tr>
                </tbody>
              </table>

              <h3 className="help-h3">Creating a project</h3>
              <p>
                <strong>One click.</strong> A goal card creates a blank project of that goal; a
                template card creates a project from that template. There is no form in between —
                name the project afterwards by clicking its title in the IDE header.
              </p>
              <Note type="tip">
                <strong>Hybrid topic</strong> cards — Pendulum, Projectile, Spring, SHM pendulum —
                load a simulation <em>and</em> remember its paired analysis. Each opens on its
                natural side (the simulation, or the data), and carries a{" "}
                <em>"Start from the other half"</em> link if you want the reverse. After you save a
                run, the chart offers <strong>"Analyse this run →"</strong>, which loads the paired
                analysis with the run label already filled in.
              </Note>

              <h3 className="help-h3">Managing projects</h3>
              <p>
                All projects are listed on the Start Menu and persist across browser sessions via
                IndexedDB (localForage). Each project shows its goal, title, and last-modified time.
                Click a project row to open it, or click the delete button on the right to remove it.
              </p>
              <p>
                To return to the Start Menu from inside the IDE, click the <strong>Menu</strong>
                button at the left of the toolbar.
              </p>

              <h3 className="help-h3">Running a physics simulation</h3>
              <HelpVideo
                src={runBlocksVideo}
                poster={runBlocksPoster}
                caption="Run a blocks project: the 3D scene starts, the trail draws, the graph plots."
              />
              <ol className="help-list">
                <li>Open or create a Physics Modelling or Hybrid project.</li>
                <li>Click <Tag color="green">Run</Tag> in the toolbar (or press <Kbd>Ctrl+Enter</Kbd>).</li>
                <li>The 3D Viewport initialises the GlowScript runtime and starts rendering.</li>
                <li>Use the mouse to <strong>orbit</strong> (left drag), <strong>pan</strong> (right drag), and <strong>zoom</strong> (scroll wheel).</li>
                <li>Click <Tag color="red">Stop</Tag> to halt the simulation.</li>
              </ol>

              <h3 className="help-h3">Running a data science analysis</h3>
              <p>
                Data Science and Hybrid projects <strong>auto-execute</strong> the analysis every
                time the block workspace changes. You do not need to press Run. The Data panel on
                the right updates automatically with tables, charts, and values as you build your
                analysis. If there is a runner error, the status bar at the bottom displays the
                error message.
              </p>

              <h3 className="help-h3">Saving your work</h3>
              <p>
                Physics IDE <strong>auto-saves</strong> every project to the browser's IndexedDB
                storage after each change. Your projects are restored when you reopen the app. For
                portable saves or submissions, use the <strong>File</strong> menu in the
                toolbar.
              </p>
            </section>

            {/* ══════════════ DEBUG MODE ══════════════ */}
            <SectionAnchor id="debug-mode" />
            <section className="help-section">
              <SectionHeader id="debug-mode">Debug Mode</SectionHeader>
              <p>
                Debug Mode is a mode of the editor, for step-through inspection of a running
                simulation. Access it by clicking the <Tag color="purple">Debug</Tag> button in
                the toolbar. The simulation pauses immediately. Your blocks stay on screen; the
                trace panel opens beside the viewport.
              </p>
              <HelpVideo
                src={debugRecordVideo}
                poster={debugRecordPoster}
                caption="Enter Debug during a run, resume, and record the trace — variables stream live."
              />

              <h3 className="help-h3">What changes when you enter</h3>
              <p>Nothing is replaced — the editor grows debug controls:</p>
              <ul className="help-list">
                <li>
                  <strong>Your workspace stays editable</strong> — the same blocks (or the same code
                  editor), in the same place. Right-click a block to <strong>toggle a breakpoint</strong>{" "}
                  on it, or hold <Kbd>Alt</Kbd> and click it.
                </li>
                <li>
                  <strong>The 3D Viewport keeps its frame</strong> — the simulation is paused where it
                  was, and the camera is still interactive.
                </li>
                <li>
                  <strong>The Trace panel docks beside the viewport</strong> — a live variable trace
                  with sparklines, delta, min and max columns, a search filter, and pin-to-top
                  support. Drag its edge to resize it.
                </li>
                <li>
                  <strong>The toolbar grows a debug group</strong> — Pause / Resume, Next frame and
                  Next value, next to the Run button you already know. Recording lives in the
                  trace panel itself.
                </li>
              </ul>

              <h3 className="help-h3">Playback controls</h3>
              <table className="help-table">
                <thead><tr><th>Button</th><th>Keyboard</th><th>Action</th></tr></thead>
                <tbody>
                  <tr>
                    <td><Tag color="green">Run</Tag></td>
                    <td>—</td>
                    <td>Start or continue the simulation from the beginning</td>
                  </tr>
                  <tr>
                    <td><Tag color="red">Stop</Tag></td>
                    <td>—</td>
                    <td>
                      Stop the simulation. Pressing Run clears the trace table and starts a fresh
                      recording; Stop leaves the last values on screen so you can read them.
                    </td>
                  </tr>
                  <tr>
                    <td><Tag color="yellow">Pause</Tag></td>
                    <td><Kbd>Space</Kbd></td>
                    <td>Pause the simulation at the current frame</td>
                  </tr>
                  <tr>
                    <td><Tag color="yellow">Resume</Tag></td>
                    <td><Kbd>Space</Kbd></td>
                    <td>Resume a paused simulation</td>
                  </tr>
                  <tr>
                    <td><Tag color="blue">Next frame</Tag></td>
                    <td><Kbd>F10</Kbd></td>
                    <td>Advance one whole animation frame — one timestep of your loop</td>
                  </tr>
                  <tr>
                    <td><Tag color="blue">Next value</Tag></td>
                    <td><Kbd>Shift</Kbd> + <Kbd>F10</Kbd></td>
                    <td>Advance to the next single reported value inside that frame</td>
                  </tr>
                  <tr>
                    <td><Tag color="purple">Exit Debug</Tag></td>
                    <td>—</td>
                    <td>Leave Debug Mode. The simulation resumes; your work stays where it is.</td>
                  </tr>
                </tbody>
              </table>

              <h3 className="help-h3">Breakpoints</h3>
              <p>
                In block-based projects, you can set breakpoints directly in the Blocks panel:
              </p>
              <ol className="help-list">
                <li>Right-click a block (or hold <Kbd>Alt</Kbd> and click it) — a <strong>red
                    outline</strong> appears to show a breakpoint is set.</li>
                <li>Do the same again to remove the breakpoint.</li>
                <li>When the simulation runs and reaches a breakpointed block, execution stops
                    <strong> synchronously</strong> — the simulation freezes at that exact point.</li>
                <li>Use <Kbd>F10</Kbd> to step forward, or <Kbd>Space</Kbd> to resume running.</li>
              </ol>
              <Note type="tip">
                Breakpoints go on blocks that report a value — the “set”, “add to”, “update
                position”, “apply force”, “time step” and “define constant” blocks. Those blocks
                show a dashed outline in Debug Mode; right-clicking any other block tells you it
                can’t pause there.
              </Note>
              <Note type="tip">
                Breakpoints are remembered when you leave Debug Mode, but they only pause the
                simulation while Debug Mode is on. Set multiple breakpoints to jump between key
                moments in your simulation loop.
              </Note>

              <h3 className="help-h3">Execution highlight</h3>
              <p>
                While the simulation is running in Debug Mode, the <strong>block that is currently
                executing</strong> is highlighted with a <strong>yellow glow</strong>. This lets you
                see — in real time — where execution is at any given moment, which is especially
                useful when stepping through a simulation manually with <Kbd>F10</Kbd>.
              </p>

              <h3 className="help-h3">What the trace table shows</h3>
              <p>
                The trace table shows every variable that changes inside your loop, plus a collapsed{" "}
                <strong>Setup / constants</strong> section for the values you set before it. To watch
                anything else — total energy, say — type the expression into the watch box and press
                Run.
              </p>

              <h3 className="help-h3">Trace recording &amp; CSV export</h3>
              <p>
                The trace panel beside the viewport can record all variable values over time for
                post-run analysis:
              </p>
              <ol className="help-list">
                <li>Click <Tag color="red">Record</Tag> to start recording.</li>
                <li>Run or step through the simulation — every trace update is captured.</li>
                <li>Click <Tag color="red">REC</Tag> again to end the recording (the button shows REC while it runs).</li>
                <li>Click <Tag color="blue">Rec.CSV</Tag> to download the recorded data as a CSV
                    file containing variable, value, delta, min, max, and timestamp columns.</li>
              </ol>
              <Note type="info">
                The CSV export is a snapshot of the <em>recorded</em> data. If you record
                while stepping, each step produces one row per active variable.
              </Note>

              <h3 className="help-h3">Code-only projects</h3>
              <p>
                When debugging a <Tag color="green">Blank Project</Tag> or{" "}
                <Tag color="blue">Code Example</Tag>, you debug in the code editor you were already
                writing in. Breakpoints are a block-editor feature — they go on blocks that report a
                value — so in a code project use Pause, <strong>Next frame</strong> and{" "}
                <strong>Next value</strong> to walk through execution. Trace recording and CSV export
                work exactly the same way.
              </p>
            </section>

            {/* ══════════════ BLOCK EDITOR ══════════════ */}
            <SectionAnchor id="block-editor" />
            <section className="help-section">
              <SectionHeader id="block-editor">Block Editor</SectionHeader>
              <p>
                The Block Editor uses <strong>Google Blockly v11</strong>. Blocks are grouped into
                categories in the toolbox on the left. Drag a block onto the canvas, connect it to
                others, and click <Tag color="green">Run</Tag> — Physics IDE translates the block
                stack into VPython and executes it instantly.
              </p>

              <h3 className="help-h3">Key interactions</h3>
              <ul className="help-list">
                <li><strong>Drag</strong> blocks from the toolbox onto the canvas.</li>
                <li><strong>Connect</strong> blocks by dragging one onto the notch of another.</li>
                <li><strong>Edit fields</strong> by clicking on text/number inputs inside a block.</li>
                <li><strong>Right-click</strong> a block for Duplicate, Delete, Help, etc.</li>
                <li><strong>Ctrl+Z / Ctrl+Y</strong> — Undo / Redo.</li>
                <li><strong>Delete / Backspace</strong> — delete selected block.</li>
                <li><strong>Ctrl+A</strong> — select all blocks.</li>
                <li><strong>Scroll</strong> or pinch to zoom the canvas.</li>
              </ul>

              <h3 className="help-h3">Code mirror</h3>
              <p>
                Every change to the block workspace instantly regenerates the equivalent VPython code.
                Switch to the <Tag color="blue">Code</Tag> tab to see the generated Python — this is a
                powerful learning tool, especially for students who are moving from visual to textual
                programming.
              </p>

              <Note type="warning">
                The Code tab is <strong>read-only</strong> in Blocks mode. To freely edit code,
                use a Code Example template or a Blank Project.
              </Note>

              <h3 className="help-h3">Block search</h3>
              <p>
                A <strong>search bar</strong> sits above the Blockly canvas. Start typing any block name,
                category, or keyword — matching blocks appear in a dropdown. Click a result to jump
                straight to that category in the toolbox.
              </p>
              <ul className="help-list">
                <li>Type <Code>sphere</Code> → shows Quick Sphere, Sphere, Sphere + trail…</li>
                <li>Type <Code>gravity</Code> → shows Gravity, Apply force, and Physics Constant.</li>
                <li>Type <Code>loop</Code> → shows Forever loop and For loop.</li>
                <li>Press <Kbd>&times;</Kbd> in the search bar to clear and close results.</li>
              </ul>

              <h3 className="help-h3">Goal-filtered toolbox</h3>
              <p>
                The toolbox is generated per project goal. Physics Modelling projects show Values,
                Objects, Motion, State, and the physics control blocks. Data Science projects show
                only the Data Science category and shared utility categories (Control, Logic, Math,
                Variables). Hybrid projects show all categories. This means students see only what
                is relevant to their current task.
              </p>
              <p>
                Power-user categories — <strong>3D Math</strong>, <strong>Raw Python</strong>,
                Loops, Text, Lists, and Functions — are grouped inside an{" "}
                <strong>Advanced drawer</strong> that collapses under a single expandable row at
                the bottom of the toolbox. Click it to expand or collapse.
              </p>

              <h3 className="help-h3">Standard Blockly categories</h3>
              <p>
                In addition to Physics blocks, the toolbox includes all standard Blockly categories:
              </p>
              <ul className="help-list">
                <li><strong>Logic</strong> — <Code>if / else</Code>, boolean operators</li>
                <li><strong>Loops</strong> — <Code>repeat</Code>, <Code>while</Code>, <Code>for each</Code></li>
                <li><strong>Math</strong> — arithmetic, trig functions, <Code>random</Code>, <Code>pi</Code></li>
                <li><strong>Text</strong> — string creation and concatenation</li>
                <li><strong>State</strong> — Physics IDE assignment/motion blocks (<Code>set_scalar</Code>, <Code>set_attr</Code>, etc.)</li>
                <li><strong>Variables</strong> — native Blockly variables (<Code>variables_get</Code>, <Code>variables_set</Code>, rename/delete)</li>
                <li><strong>Functions</strong> — define and call custom procedures</li>
              </ul>

              <h3 className="help-h3">Variable model (important)</h3>
              <p>
                Physics IDE now uses <strong>native Blockly variables</strong> for object/loop/state names.
                Name fields are variable dropdowns (not free text), so renaming a variable updates all connected
                references consistently.
              </p>
              <ul className="help-list">
                <li>Use object blocks to create objects into variables (for example <Code>ground</Code>, <Code>ball</Code>).</li>
                <li>Use <strong>Variables → get</strong> blocks as inputs to value sockets whenever you want direct variable references.</li>
                <li>Use <strong>Variables → set</strong> for generic variable assignment patterns in addition to Physics <Code>set_scalar_block</Code>.</li>
              </ul>
            </section>

            {/* ══════════════ BLOCK REFERENCE ══════════════ */}
            <SectionAnchor id="block-reference" />
            <section className="help-section">
              <SectionHeader id="block-reference">Block Reference</SectionHeader>
              <p>All custom Physics IDE blocks and the VPython code they generate.</p>

              <h3 className="help-h3">Quick Create <CategoryTag category="Objects" /></h3>
              <p className="help-tip">
                Quick-create blocks pack all object settings into a single block using inline
                number fields and a colour picker — no composable value slots required.
                Ideal for beginners building their first simulation.
              </p>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-preset_sphere_block">
                  <div className="help-block-name">preset_sphere_block</div>
                  <div className="help-block-desc">
                    Create a sphere with a single block. Set the variable name, position
                    (x, y, z), radius, and colour directly in the block fields — no snapping
                    required.
                    <Pre>ball = sphere(pos=vector(0, 0, 0), radius=1, color=vector(1.0, 0.27, 0.27))</Pre>
                    <Note type="tip">When the simulation grows more complex, graduate to <Code>sphere_block</Code>
                    which uses composable value-slot inputs for expressions and variables.</Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-preset_box_block">
                  <div className="help-block-name">preset_box_block</div>
                  <div className="help-block-desc">
                    Create a box with all settings inline: variable name, position, width
                    \u00d7 height \u00d7 depth, and colour.
                    <Pre>wall = box(pos=vector(0, -1, 0), size=vector(10, 0.5, 10), color=vector(0.2, 0.4, 0.2))</Pre>
                    Great for floors, walls, and platforms. For opacity or expression-based sizing, use <Code>box_block</Code> instead.
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Scene Objects <CategoryTag category="Objects" /></h3>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-sphere_block">
                  <div className="help-block-name">sphere_block</div>
                  <div className="help-block-desc">
                    Creates a basic VPython sphere assigned to a <strong>variable dropdown</strong> (native Blockly variable).
                    Position, radius, and colour are value sockets that accept snap-in blocks.
                    <Pre>ball = sphere(pos=vector(0,0,0), radius=1, color=vector(1,0,0))</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-sphere_trail_block">
                  <div className="help-block-name">sphere_trail_block</div>
                  <div className="help-block-desc">
                    Creates a sphere with a motion trail. All trail parameters are passed in the constructor as required by GlowScript 3.2.
                    Extra value sockets: <Code>trail_r</Code> (trail radius), <Code>trail_col</Code> (trail colour), <Code>retain</Code> (max trail points).
                    <Pre>ball = sphere(pos=vector(0,0.35,0), radius=0.28, color=...,{"\n"}       make_trail=True, trail_radius=0.035, trail_color=..., retain=260)</Pre>
                    <Note type="warning"><Code>make_trail=True</Code> must be set in the constructor. Use this block instead of <Code>sphere_block</Code> whenever you need a trail.</Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-sphere_emissive_block">
                  <div className="help-block-name">sphere_emissive_block</div>
                  <div className="help-block-desc">
                    Creates a self-illuminating (glow) sphere with configurable <Code>opacity</Code>.
                    Used for stars, corona halos, and particle effects where the object should appear to emit light.
                    <Pre>sun = sphere(pos=vector(0,0,0), radius=1.05, color=..., emissive=True, opacity=1)</Pre>
                    <Note type="warning"><Code>emissive=True</Code> must be set in the constructor in GlowScript 3.2.</Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-box_block">
                  <div className="help-block-name">box_block</div>
                  <div className="help-block-desc">
                    Creates a VPython box using composable value sockets for <Code>pos</Code>, <Code>size</Code>, and <Code>color</Code>.
                    <Pre>wall = box(pos=vector(0,0,0), size=vector(1,1,1), color=...)</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-box_opacity_block">
                  <div className="help-block-name">box_opacity_block</div>
                  <div className="help-block-desc">
                    Creates a box with an <Code>opacity</Code> field (0 = invisible, 1 = solid). The position fields accept Python expressions
                    (e.g. <Code>mass.pos.x</Code>) so the box can be positioned relative to another object at creation time.
                    <Pre>shadow = box(pos=vector(mass.pos.x,-1.08,0), size=vector(1,0.01,1), color=..., opacity=0.45)</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-cylinder_block">
                  <div className="help-block-name">cylinder_block</div>
                  <div className="help-block-desc">
                    Creates a cylinder from <Code>pos</Code> to <Code>pos + axis</Code>. The axis vector determines both direction and length.
                    <Pre>rod = cylinder(pos=vector(0,0,0), axis=vector(4,0,0), radius=0.3)</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-arrow_block">
                  <div className="help-block-name">arrow_block</div>
                  <div className="help-block-desc">
                    Creates a VPython arrow. The <Code>axis</Code> vector sets direction and length.
                    Ideal for visualising velocity, force, and acceleration vectors.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-helix_block">
                  <div className="help-block-name">helix_block</div>
                  <div className="help-block-desc">
                    Creates a basic helix with <Code>pos</Code>, <Code>axis</Code>, and <Code>radius</Code>. Update <Code>axis</Code> each frame to animate stretch.
                    For springs that need specific <Code>coils</Code> and <Code>thickness</Code>, use <Code>helix_full_block</Code> instead.
                    <Pre>spring = helix(pos=anchor, axis=vector(L0,0,0), radius=0.3)</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-helix_full_block">
                  <div className="help-block-name">helix_full_block</div>
                  <div className="help-block-desc">
                    Creates a helix with full constructor parameters: <Code>coils</Code>, <Code>thickness</Code>, and expression-based
                    <Code>pos</Code> / <Code>axis</Code> fields. Used in the Spring-Mass template to match exact visual proportions.
                    <Pre>spring = helix(pos=anchor, axis=vector(4.0,0,0), radius=0.36, coils=16, thickness=0.055, color=...)</Pre>
                  </div>
                </div>

              </div>

              <h3 className="help-h3">Values <Tag color="purple">snap-in blocks</Tag></h3>
              <p className="help-tip">
                Value blocks are small blocks that <strong>snap into input slots</strong> on
                larger blocks. Drag a vector, colour, or expression block and plug it
                into any empty slot.
              </p>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-vector_block">
                  <div className="help-block-name">vector_block</div>
                  <div className="help-block-desc">
                    Creates a <Code>vector(x, y, z)</Code> value. Snap into pos, axis, size,
                    velocity, or colour slots on other blocks.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-colour_block">
                  <div className="help-block-name">colour_block</div>
                  <div className="help-block-desc">
                    Pick a colour from a visual colour palette. Outputs a VPython
                    <Code>vector(r, g, b)</Code> colour. Snap into any colour slot.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-expr_block">
                  <div className="help-block-name">expr_block</div>
                  <div className="help-block-desc">
                    <strong>The Swiss-army expression block.</strong> Type any Python expression
                    into the text field — the block wraps it in parentheses and snaps into
                    <em>any</em> value socket (number, vector, colour, boolean).
                    <Pre>{`# Snap into a velocity slot:
ball.velocity = (5 * cos(radians(45)))

# Snap into a colour slot:
ball.color = (vector(abs(ball.pos.y)/10, 0.2, 1))

# Snap into a force slot:
ball.velocity += (vector(0, -9.81 * mass, 0)) * dt

# Snap into a boolean condition slot:
(mag(ball.velocity) < 0.05 and ball.pos.y < 0.1)`}</Pre>
                    <Note type="tip">
                      Start simple: drag an <Code>expr_block</Code> into a slot and type a variable name
                      (e.g. <Code>g</Code>). As formulas grow more complex, use dedicated
                      Physics Expression blocks instead for readability.
                    </Note>
                    <Note type="warning">
                      The field is a single-line text input. For multi-line logic, use
                      <Code>if_block</Code> or <Code>if_else_block</Code> — never newlines inside expr_block.
                    </Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-define_const_block">
                  <div className="help-block-name">define_const_block</div>
                  <div className="help-block-desc">
                    Define a reusable named constant at the top of your program. Set the variable
                    name in the dropdown and snap any value block (number, physics constant, expression)
                    into the <Code>= </Code> slot.
                    <Pre>{`MASS   = 0.5   # kg
SPRING = 12.0  # N/m
CHARGE = 1.6e-19`}</Pre>
                    The constant name appears in the Blockly <em>Variables</em> category so you can
                    reference it anywhere without retyping. Pair with <Code>physics_const_block</Code>
                    to snap in a standard value:
                    <Pre>GRAVITY = 9.81  # from the g constant block</Pre>
                    <Note type="tip">
                      Use ALL_CAPS names by convention to visually distinguish constants from loop
                      variables.
                    </Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-physics_const_block">
                  <div className="help-block-name">physics_const_block</div>
                  <div className="help-block-desc">
                    Insert a standard physics constant via a dropdown. Choose from:
                    <Pre>g  = 9.81         (standard gravity, m/s²){"\n"}G  = 6.674e-11    (gravitational constant){"\n"}π  = pi           (used directly in VPython){"\n"}e  = 2.718        (Euler's number){"\n"}c  = 3e8          (speed of light, m/s){"\n"}kₑ = 8.988e9     (Coulomb's constant){"\n"}h  = 6.626e-34   (Planck's constant){"\n"}mₑ = 9.109e-31   (electron mass, kg){"\n"}mₚ = 1.673e-27   (proton mass, kg)</Pre>
                    Snap into any numeric slot instead of typing raw values. Improves
                    readability and prevents transcription errors.
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Physics Expressions <CategoryTag category="Values" /></h3>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-get_prop_block">
                  <div className="help-block-name">get_prop_block</div>
                  <div className="help-block-desc">
                    Read any property of an object variable. Set the variable name in the
                    left field and the attribute in the right field.
                    <Pre>ball.velocity   earth.pos   ball.radius</Pre>
                    Snap the result into any value slot, or chain into component/mag blocks.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-get_component_block">
                  <div className="help-block-name">get_component_block</div>
                  <div className="help-block-desc">
                    Get the <Code>x</Code>, <Code>y</Code>, or <Code>z</Code> scalar
                    component of a vector. Chain with <Code>get_prop_block</Code> — snap
                    <Code>ball.pos</Code> in and select <Code>y</Code> to get <Code>ball.pos.y</Code>.
                    <Pre>ball.pos.y   ball.velocity.x</Pre>
                    Snap the result into a <Code>logic_compare</Code> condition or math slot.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-mag_block">
                  <div className="help-block-name">mag_block</div>
                  <div className="help-block-desc">
                    Magnitude (scalar length) of a vector. Chain with <Code>get_prop_block</Code>:
                    snap <Code>ball.velocity</Code> into the slot to get speed.
                    <Pre>mag(ball.velocity)  # → speed (scalar)</Pre>
                    <Note type="tip">Compare with a number using a Logic Compare block: <Code>mag(ball.velocity) &lt; 0.06</Code>.</Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-norm_block">
                  <div className="help-block-name">norm_block</div>
                  <div className="help-block-desc">
                    Unit vector in the direction of the input. Use to find the direction
                    of a displacement or force vector.
                    <Pre>norm(r_es)  # → direction from sun to earth</Pre>
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Motion / Physics <CategoryTag category="Motion" /></h3>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-set_velocity_block">
                  <div className="help-block-name">set_velocity_block</div>
                  <div className="help-block-desc">
                    Sets an object's initial velocity vector.
                    <Pre>ball.velocity = vector(10, 5, 0)</Pre>
                    VPython objects do not have a built-in <Code>.velocity</Code> property — this
                    creates a custom attribute that your loop must use to update position.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-update_position_block">
                  <div className="help-block-name">update_position_block</div>
                  <div className="help-block-desc">
                    <strong>Euler integration step</strong> — advances position by one time step.
                    <Pre>ball.pos = ball.pos + ball.velocity * dt</Pre>
                    Place inside a <Code>forever</Code> loop after updating velocity.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-apply_force_block">
                  <div className="help-block-name">apply_force_block</div>
                  <div className="help-block-desc">
                    Applies a constant acceleration (force/mass) vector to an object's velocity.
                    <Pre>ball.velocity = ball.velocity + vector(fx, fy, fz) * dt</Pre>
                    The vector values are acceleration (m/s²), not force in N. Divide
                    your force by mass before entering it.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-set_gravity_block">
                  <div className="help-block-name">set_gravity_block</div>
                  <div className="help-block-desc">
                    Defines a gravity vector in the −Y direction.
                    <Pre>g = vector(0, -9.81, 0)</Pre>
                    Use this in your loop: <Code>ball.velocity = ball.velocity + g * dt</Code>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-set_scalar_block">
                  <div className="help-block-name">set_scalar_block</div>
                  <div className="help-block-desc">
                    Assigns any Python expression to a variable chosen from a Blockly variable dropdown.
                    <Pre>m = 0.34</Pre>
                    The value field accepts any Python expression (e.g. <Code>pi * r**2</Code>).
                  </div>
                </div>

                <div className="help-block-row" id="help-block-set_attr_expr_block">
                  <div className="help-block-name">set_attr_expr_block</div>
                  <div className="help-block-desc">
                    One-line attribute assignment: <Code>object.attr = expr</Code>.
                    <Pre>ball.pos = vector(0, 0, 0)</Pre>
                    Very flexible — use for updating any object property.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-add_attr_expr_block">
                  <div className="help-block-name">add_attr_expr_block</div>
                  <div className="help-block-desc">
                    Attribute increment: <Code>object.attr += expr</Code>.
                    <Pre>ball.velocity = ball.velocity + acceleration * dt</Pre>
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Control <CategoryTag category="Control" /></h3>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-forever_loop_block">
                  <div className="help-block-name">forever_loop_block</div>
                  <div className="help-block-desc">
                    Wraps its body in <Code>while True:</Code>. Every VPython simulation needs exactly
                    one of these as the animation loop. Place all physics updates inside it.
                    <Pre>{`while True:\n    rate(200)\n    ball.pos = ball.pos + ball.velocity * dt`}</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-for_range_block">
                  <div className="help-block-name">for_range_block</div>
                  <div className="help-block-desc">
                    A for-loop over a numeric range. Loop variable is a Blockly variable dropdown, plus
                    <Code>start</Code>, <Code>stop</Code>, and <Code>step</Code>.
                    Accepts nested blocks in its body. Used to create repeated objects (distance ticks, starfields, etc.).
                    <Pre>{`for i in range(0, 31, 5):\n    cylinder(pos=vector(i, 0, 0), axis=vector(0, 0.04, 0), ...)`}</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-if_block">
                  <div className="help-block-name">if_block</div>
                  <div className="help-block-desc">
                    A conditional statement with a free-text condition field. Accepts nested blocks in its body.
                    Fully nestable — place an <Code>if_block</Code> inside another <Code>if_block</Code> body for nested conditions.
                    <Pre>{`if ball.pos.y < ball.radius:\n    ball.pos.y = ball.radius\n    if ball.velocity.y < 0:\n        ball.velocity.y = -0.55 * ball.velocity.y`}</Pre>
                    <Note type="tip">For complex boolean conditions (e.g. <Code>x &lt; 0 and mag(v) &lt; 0.1</Code>) type them directly into the condition field.</Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-if_else_block">
                  <div className="help-block-name">if_else_block</div>
                  <div className="help-block-desc">
                    An if/else conditional with separate bodies for the true and false branches.
                    Fields: free-text <Code>condition</Code>, plus two block sockets (<Code>do</Code> and <Code>else</Code>).
                    Replaces raw Python ternary patterns in block templates.
                    <Pre>{`if stretch > 0:\n    spring.color = vector(1, 0.45, 0.15)\nelse:\n    spring.color = vector(0.3, 0.55, 1)`}</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-break_loop_block">
                  <div className="help-block-name">break_loop_block</div>
                  <div className="help-block-desc">
                    Emits a Python <Code>break</Code> statement. Place inside a <Code>forever_loop_block</Code>
                    (typically nested inside an <Code>if_block</Code>) to terminate the animation when
                    a stop condition is met.
                    <Pre>{`if mag(ball.velocity) < 0.08 and ball.pos.y <= ball.radius + 0.01:\n    break`}</Pre>
                    <Note type="info">Used in the Projectile template to stop the loop when the ball comes to rest.</Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-rate_block">
                  <div className="help-block-name">rate_block</div>
                  <div className="help-block-desc">
                    Throttles the loop to N iterations per second. This is <strong>essential</strong> — without
                    it the browser tab will freeze. Typical values: 100–500. Higher = smoother but more CPU.
                    <Pre>rate(240)</Pre>
                    <Note type="warning">Always place <Code>rate()</Code> as the first line inside a <Code>forever</Code> loop.</Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-time_step_block">
                  <div className="help-block-name">time_step_block</div>
                  <div className="help-block-desc">
                    Defines the simulation time step <Code>dt</Code>.
                    <Pre>dt = 0.01  # seconds per step</Pre>
                    Smaller dt = more accurate but slower. Typical: 0.001–0.01 s for most simulations.
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Utility <CategoryTag category="State" /></h3>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-local_light_block">
                  <div className="help-block-name">local_light_block</div>
                  <div className="help-block-desc">
                    Adds a point light source at a given position.
                    <Pre>local_light(pos=vector(0, 10, 5), color=color.white)</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-label_block">
                  <div className="help-block-name">label_block</div>
                  <div className="help-block-desc">
                    Creates a simple on-screen text label at a 3D position (white, no box, transparent background).
                    Update <Code>.text</Code> each frame using <Code>set_attr_expr_block</Code> for live telemetry.
                    <Pre>info = label(text="", pos=vector(5,8,0), box=False, opacity=0, color=color.white)</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-label_full_block">
                  <div className="help-block-name">label_full_block</div>
                  <div className="help-block-desc">
                    Creates a named telemetry label with a configurable <Code>height</Code> field (font size in pixels).
                    Always outputs white text, no box, transparent background — the standard HUD style used in all built-in templates.
                    <Pre>telemetry = label(pos=vector(8.5, 9.2, 0), text="", height=12, box=False, opacity=0, color=color.white)</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-telemetry_update_block">
                  <div className="help-block-name">telemetry_update_block</div>
                  <div className="help-block-desc">
                    Updates a label variable's <Code>.text</Code> using up to 5 metric rows.
                    Each row is formatted as: <Code>name = round(value, dp) unit</Code>.
                    <Pre>{`telemetry.text = "t = " + str(round(t, 2)) + " s" + "\\n" + "speed = " + str(round(mag(ball.velocity), 2)) + " m/s"`}</Pre>
                    <Note type="tip">Leave metric name/value blank to skip that row.</Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-comment_block">
                  <div className="help-block-name">comment_block</div>
                  <div className="help-block-desc">
                    Emits a Python comment. Good for documenting block programs.
                    <Pre># This is a comment</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-python_raw_block">
                  <div className="help-block-name">python_raw_block</div>
                  <div className="help-block-desc">
                    <strong>Advanced statement block</strong> — inlines any raw Python <em>statement</em>
                    exactly as typed. The text is emitted verbatim followed by a newline.
                    <Pre>{`# Single-statement examples:
scene.title = "Spring Mass"
scene.background = vector(0.05, 0.05, 0.1)
scene.range = 12

# Multi-line: separate lines with \n in the field
if t > 10:\n    break`}</Pre>
                    Built-in templates use this for scene setup properties that have no dedicated
                    semantic block. In the Block Toolbox it lives under the{" "}
                    <Tag color="red">Advanced</Tag> category.
                    <Note type="warning">
                      Do not use for expressions that produce a return value — use
                      <Code>python_raw_expr_block</Code> or <Code>expr_block</Code> for those.
                    </Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-python_raw_expr_block">
                  <div className="help-block-name">python_raw_expr_block</div>
                  <div className="help-block-desc">
                    <strong>Advanced expression block</strong> — like <Code>python_raw_block</Code>
                    but acts as an <em>value output</em> (connectable to any value socket).
                    Use when a formula is too complex for <Code>expr_block</Code> or the structured
                    Physics Expression blocks.
                    <Pre>{`# Examples snapped into value slots:
norm(earth.pos - sun.pos)   # unit direction vector
mag(ball.velocity) ** 2     # speed squared
abs(stretch / L0)           # normalised stretch`}</Pre>
                    <Note type="tip">
                      The only difference from <Code>expr_block</Code> is cosmetic — the block
                      label reads <Code>expr:</Code> and it lives in the Advanced toolbox category.
                      For everyday use, prefer <Code>expr_block</Code> (purple) since it is easier
                      to find in beginner and intermediate toolboxes.
                    </Note>
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Simulation Structure <CategoryTag category="Control" /></h3>
              <p className="help-tip">
                These blocks define the overall scaffold of a simulation — setup, teardown, scene
                camera, object rotation, and named constants.
              </p>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-sim_start_block">
                  <div className="help-block-name">sim_start_block</div>
                  <div className="help-block-desc">
                    <strong>Simulation header block</strong> — a hat block (always at the top of
                    the stack) that sets the scene title and wraps all setup code inside its body.
                    <Pre>{`# === Simulation Start: Spring Mass ===
scene.title = "Spring Mass"
  # ... all blocks inside the body execute here at top-level`}</Pre>
                    Drag all scene setup blocks (<Code>preset_sphere_block</Code>,
                    <Code>time_step_block</Code>, constants, etc.) into its body slot.
                    The hat shape prevents accidentally attaching code above it.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-sim_end_block">
                  <div className="help-block-name">sim_end_block</div>
                  <div className="help-block-desc">
                    <strong>Simulation footer block</strong> — emits a completion message after the
                    animation loop exits (e.g. after a <Code>break_loop_block</Code>).
                    <Pre>print("Simulation complete")</Pre>
                    Place immediately after the forever loop block.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-rotate_object_block">
                  <div className="help-block-name">rotate_object_block</div>
                  <div className="help-block-desc">
                    Rotate a VPython object by a given angle (in degrees) around an axis vector.
                    Internally converts to radians using <Code>radians()</Code>.
                    <Pre>{`obj.rotate(angle=radians(45), axis=vector(0,1,0))  # 45° around Y`}</Pre>
                    Snap a <Code>vector_block</Code> or <Code>get_prop_block</Code> into the axis slot
                    for dynamic rotation axes. Useful for spinning wheels, precessing gyroscopes, and
                    orbiting labels.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-scene_camera_block">
                  <div className="help-block-name">scene_camera_block</div>
                  <div className="help-block-desc">
                    Set any <Code>scene.*</Code> property at runtime using a dropdown.
                    Available properties:
                    <Pre>{`scene.center     = vector(0, 0, 0)   # camera look-at target
scene.forward    = vector(0, 0, -1)  # camera direction
scene.up         = vector(0, 1, 0)   # camera up direction
scene.range      = 10                # zoom level
scene.width      = 800               # canvas width (px)
scene.height     = 600               # canvas height (px)
scene.background = vector(0, 0, 0.1) # background colour`}</Pre>
                    Snap a <Code>vector_block</Code> or <Code>expr_block</Code> (for scalar range) into the value slot.
                  </div>
                </div>
              </div>

              <h3 className="help-h3">3D Math <CategoryTag category="3D Math" /></h3>
              <p className="help-tip">
                All of these blocks output values — snap them into any numeric or vector slot.
              </p>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-vector_compose_block">
                  <div className="help-block-name">vector_compose_block</div>
                  <div className="help-block-desc">
                    Build a <Code>vector(x, y, z)</Code> from three <em>value sockets</em> rather
                    than three plain number fields. Use when the components come from variables,
                    expressions, or other blocks.
                    <Pre>{`# x from a get_prop_block, y from expr_block, z constant:
vector(ball.velocity.x * 0.5,  -9.81 * mass,  0)`}</Pre>
                    The plain <Code>vector_block</Code> uses number fields — prefer
                    <Code>vector_compose_block</Code> whenever any component is a variable or formula.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-cross_product_block">
                  <div className="help-block-name">cross_product_block</div>
                  <div className="help-block-desc">
                    Cross product of two vectors (right-hand rule): returns a vector perpendicular
                    to both inputs. Essential for magnetic force <code>F = q·v × B</code>.
                    <Pre>{`F_mag = cross(ball.velocity, B_field)  # magnetic force direction`}</Pre>
                    Snap two <Code>get_prop_block</Code> or <Code>vector_block</Code> outputs into
                    the <Code>A</Code> and <Code>B</Code> slots.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-dot_product_block">
                  <div className="help-block-name">dot_product_block</div>
                  <div className="help-block-desc">
                    Dot product of two vectors: returns a scalar. Used for work
                    (<Code>W = F·d</Code>), projection, and angle-between-vectors.
                    <Pre>{`work      = dot(force, displacement)  # scalar W
cos_angle = dot(norm(a), norm(b))     # cosine of angle`}</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-math_trig_block">
                  <div className="help-block-name">math_trig_block</div>
                  <div className="help-block-desc">
                    Trigonometric and maths functions via a dropdown. All operate on VPython-compatible
                    values.
                    <Pre>{`sin(theta)      # theta in radians
cos(theta)
tan(theta)
asin(x)         # returns radians
acos(x)
atan(y)         # arctangent
radians(deg)    # convert degrees → radians
degrees(rad)    # convert radians → degrees
sqrt(x)         # square root
abs(x)          # absolute value`}</Pre>
                    <Note type="tip">
                      Use <Code>radians(45)</Code> to convert 45° before passing to
                      <Code>sin</Code> or <Code>cos</Code>.
                    </Note>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-math_pow_block">
                  <div className="help-block-name">math_pow_block</div>
                  <div className="help-block-desc">
                    Raise a base to an exponent (<Code>BASE ** EXP</Code>). Common uses:
                    <Pre>{`r ** 2        # squared — inverse-square gravity/electric
v ** 3        # cubed  — drag at high speed
mass ** 0.5   # square root via ** 0.5`}</Pre>
                    Snap value blocks into both <Code>BASE</Code> and <Code>EXP</Code> slots.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-math_min_block">
                  <span id="help-block-math_max_block" className="help-block-row-alias" aria-hidden="true" />
                  <div className="help-block-name">math_min_block / math_max_block</div>
                  <div className="help-block-desc">
                    Returns the smaller (or larger) of two values.
                    <Pre>{`# Bounce floor — never go below radius:
ball.pos.y = max(ball.pos.y, ball.radius)

# Cap speed to terminal velocity:
speed = min(mag(ball.velocity), v_term)`}</Pre>
                    Pair with <Code>set_attr_expr_block</Code> or snap into another expression.
                  </div>
                </div>
                <div className="help-block-row" id="help-block-math_clamp_block">
                  <div className="help-block-name">math_clamp_block</div>
                  <div className="help-block-desc">
                    Restrict a value to the range <Code>[lo, hi]</Code>.
                    Generates <Code>max(lo, min(val, hi))</Code>.
                    <Pre>{`# Keep opacity between 0 and 1:
ball.opacity = clamp(energy / E_max, 0, 1)

# Clamp steering angle:
angle = clamp(input_angle, -30, 30)`}</Pre>
                  </div>
                </div>
              </div>
            </section>

            {/* ══════════════ LIVE GRAPHS ══════════════ */}
            <SectionAnchor id="live-graphs" />
            <section className="help-section">
              <SectionHeader id="live-graphs">Live Graphs</SectionHeader>
              <p>
                Three blocks in the <CategoryTag category="Graphs" /> category draw
                graphs <strong>while the simulation runs</strong> — the curve grows in real
                time under the 3D scene, so students watch the motion and its graph take
                shape together.
              </p>
              <HelpVideo
                src={liveGraphsVideo}
                poster={liveGraphsPoster}
                caption="A pendulum swings while its graph draws itself point by point."
              />
              <h3 className="help-h3">How the three blocks fit together</h3>
              <ol className="help-list">
                <li>
                  A <Code>graph display</Code> block (in your setup, after the 3D objects)
                  creates the graph panel — give it a title and axis labels.
                </li>
                <li>
                  <Code>series</Code> blocks snap <em>inside</em> the display block. Each
                  series has a name, a style (a line or dots), and a colour — the name
                  appears in the graph's legend.
                </li>
                <li>
                  A <Code>plot (x, y) on …</Code> block goes <em>inside your animation
                  loop</em>: every frame it adds one point to the named series.
                </li>
              </ol>
              <Pre>{`graph(title="Swing angle", xtitle="t (s)", ytitle="theta (rad)", fast=False)
s_theta = gcurve(color=color.blue, label="s_theta")

# …inside the loop:
s_theta.plot(t, theta)`}</Pre>
              <Note type="tip">
                When a project has graphs, the 3D scene automatically shares the pane —
                the scene takes the top and the first graph is visible right below it.
                Scroll the pane to see more graphs.
              </Note>
              <Note type="info">
                Try the <strong>SHM pendulum</strong> template (Hybrid topics on the start
                menu): it draws displacement, velocity and acceleration live — the three
                graphs of motion, from a real simulation.
              </Note>

              <h3 className="help-h3">Graph blocks <CategoryTag category="Graphs" /></h3>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-graph_display_block">
                  <div className="help-block-name">graph_display_block</div>
                  <div className="help-block-desc">
                    Creates a live graph panel below the 3D scene. Set the title and the
                    x/y axis labels in the block's fields; snap one or more series blocks
                    into its body. Place it in setup — after your 3D objects, before the
                    animation loop.
                    <Pre>graph(title="My Graph", xtitle="t (s)", ytitle="value", fast=False)</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-graph_series_block">
                  <div className="help-block-name">graph_series_block</div>
                  <div className="help-block-desc">
                    Adds a named series to the display block it sits inside — drawn as a
                    line (<Code>gcurve</Code>) or dots (<Code>gdots</Code>), in a colour you
                    pick. The series name is a variable: the plot block refers to it, and
                    it labels the curve in the graph's legend.
                    <Pre>s_theta = gcurve(color=color.blue, label="s_theta")</Pre>
                  </div>
                </div>
                <div className="help-block-row" id="help-block-graph_plot_block">
                  <div className="help-block-name">graph_plot_block</div>
                  <div className="help-block-desc">
                    Adds one point (x, y) to a series. Put it inside your simulation loop
                    so a point lands every frame and the curve draws live — typically
                    <Code>plot (t, theta) on s_theta</Code>.
                    <Pre>s_theta.plot(t, theta)</Pre>
                    <Note type="tip">Plot <em>time</em> on x to see motion graphs; plot one
                    variable against another (say <Code>F</Code> vs <Code>x</Code>) to see
                    relationships, like Hooke's law's straight line.</Note>
                  </div>
                </div>
              </div>
            </section>

            {/* ══════════════ DATA SCIENCE ══════════════ */}
            <SectionAnchor id="data-science" />
            <section className="help-section">
              <SectionHeader id="data-science">Data Science</SectionHeader>
              <p>
                Data Science and Hybrid projects provide a full foundational data analysis workflow
                through blocks. Every block in the Data Science toolbox category produces visible
                output — tables, charts, numeric values, or conclusion cards — in the Data panel
                on the right. The analysis re-executes automatically on every workspace change.
              </p>
              <HelpVideo
                src={dataScienceVideo}
                poster={dataSciencePoster}
                caption="A dataset loads, statistics compute, and a chart renders — all from blocks."
              />
              <Note type="info">
                Data Science analyses run in an async JavaScript sandbox (not the GlowScript
                iframe). The Run button is not used — the analysis fires automatically as you build.
              </Note>

              <h3 className="help-h3">Analysis structure</h3>
              <p>
                Every analysis must begin with a <Code>ds_start_block</Code> hat block. All other
                DS blocks chain inside its body. Blocks outside the hat are greyed and ignored.
              </p>
              <Pre>{`Start analysis  "My Analysis"\n  df = load dataset  Penguins\n  show table  df\n  result = mean( df . bill_length_mm )\n  bar chart  df  x: species  y: body_mass_g`}</Pre>

              <h3 className="help-h3">Load blocks</h3>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-ds_load_builtin_block">
                  <div className="help-block-name">ds_load_builtin_block</div>
                  <div className="help-block-desc">Load one of the six built-in datasets into a variable: <strong>Planets</strong>, <strong>Penguins</strong>, <strong>Weather</strong>, <strong>Pendulum</strong>, <strong>Spring</strong>, or <strong>Free fall</strong>. The Pendulum, Spring, and Free fall sets are realistic first-year lab measurements (see the Built-in datasets table below).</div>
                </div>
                <div className="help-block-row" id="help-block-ds_load_csv_block">
                  <div className="help-block-name">ds_load_csv_block</div>
                  <div className="help-block-desc">Open a system file picker and load a CSV file. Column types are inferred automatically from the first 100 rows. The file is cached per variable name so the dialog opens only once.</div>
                </div>
                <div className="help-block-row" id="help-block-ds_load_trace_block">
                  <div className="help-block-name">ds_load_trace_block</div>
                  <div className="help-block-desc">Load a saved simulation trace as a dataset. Available only in Hybrid projects after a trace has been promoted via the Trace table. Paste the label from the Data panel's "Saved traces" list.</div>
                </div>
              </div>

              <h3 className="help-h3">Explore blocks</h3>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-ds_show_table_block">
                  <div className="help-block-name">ds_show_table_block</div>
                  <div className="help-block-desc">Render a scrollable table of the dataset. The table shows up to 12 rows; a "N more rows" indicator appears when the dataset is larger.</div>
                </div>
                <div className="help-block-row" id="help-block-ds_show_first_n_block">
                  <span id="help-block-ds_show_last_n_block" className="help-block-row-alias" aria-hidden="true" />
                  <div className="help-block-name">ds_show_first_n_block / ds_show_last_n_block</div>
                  <div className="help-block-desc">Show the first or last N rows as a table. Use after sorting to inspect the extreme values.</div>
                </div>
                <div className="help-block-row" id="help-block-ds_count_rows_block">
                  <div className="help-block-name">ds_count_rows_block</div>
                  <div className="help-block-desc">Output the total row count as a named numeric value. Useful after filtering to confirm the filter worked.</div>
                </div>
                <div className="help-block-row" id="help-block-ds_all_stats_block">
                  <div className="help-block-name">ds_all_stats_block</div>
                  <div className="help-block-desc">Show count, mean, median, min, max, range, sum, and spread (standard deviation) for a column in a compact grid.</div>
                </div>
              </div>

              <h3 className="help-h3">Statistics blocks</h3>
              <p>All statistics blocks store their result in a named variable and output a value card to the Data panel.</p>
              <table className="help-table">
                <thead><tr><th>Block</th><th>Computes</th></tr></thead>
                <tbody>
                  <tr><td><Code>ds_calc_mean_block</Code></td><td>Arithmetic mean of a numeric column</td></tr>
                  <tr><td><Code>ds_calc_median_block</Code></td><td>Median (middle value when sorted)</td></tr>
                  <tr><td><Code>ds_calc_mode_block</Code></td><td>Most frequently occurring value</td></tr>
                  <tr><td><Code>ds_calc_min_block</Code> / <Code>ds_calc_max_block</Code></td><td>Minimum / maximum of the column</td></tr>
                  <tr><td><Code>ds_calc_range_block</Code></td><td>max − min</td></tr>
                  <tr><td><Code>ds_calc_sum_block</Code></td><td>Sum of all non-missing values</td></tr>
                  <tr><td><Code>ds_calc_count_block</Code></td><td>Count of non-missing values</td></tr>
                  <tr><td><Code>ds_calc_stddev_block</Code></td><td>Sample standard deviation (n−1)</td></tr>
                </tbody>
              </table>

              <h3 className="help-h3">Filter and Sort blocks</h3>
              <p>All filter/sort blocks take an input dataset variable and produce a new result variable — the original is unchanged.</p>
              <table className="help-table">
                <thead><tr><th>Block</th><th>Operation</th></tr></thead>
                <tbody>
                  <tr><td><Code>ds_filter_eq_block</Code></td><td>Keep rows where column equals a value</td></tr>
                  <tr><td><Code>ds_filter_gt_block</Code></td><td>Keep rows where column is greater than a number</td></tr>
                  <tr><td><Code>ds_filter_lt_block</Code></td><td>Keep rows where column is less than a number</td></tr>
                  <tr><td><Code>ds_filter_and_block</Code></td><td>Keep rows matching two conditions simultaneously</td></tr>
                  <tr><td><Code>ds_filter_or_block</Code></td><td>Keep rows matching either condition</td></tr>
                  <tr><td><Code>ds_sort_asc_block</Code></td><td>Sort ascending by a column</td></tr>
                  <tr><td><Code>ds_sort_desc_block</Code></td><td>Sort descending by a column</td></tr>
                  <tr><td><Code>ds_remove_missing_block</Code></td><td>Drop rows where a column is null or empty</td></tr>
                  <tr><td><Code>ds_find_missing_block</Code></td><td>Keep only rows where a column is null or empty</td></tr>
                </tbody>
              </table>

              <h3 className="help-h3">Group and Compare blocks</h3>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-ds_group_count_block">
                  <div className="help-block-name">ds_group_count_block</div>
                  <div className="help-block-desc">Count rows per unique value in a group column. Outputs a table with one row per group and a count column.</div>
                </div>
                <div className="help-block-row" id="help-block-ds_group_mean_block">
                  <div className="help-block-name">ds_group_mean_block</div>
                  <div className="help-block-desc">Calculate the mean of a value column grouped by a categorical column. The result column is named <Code>mean_&lt;valueCol&gt;</Code>. Use this result variable in a bar chart to compare group averages.</div>
                </div>
              </div>

              <h3 className="help-h3">Analyse blocks <Tag color="teal">regression &amp; uncertainty</Tag></h3>
              <p>
                These blocks power the lab-style templates — linearising data, fitting straight
                lines, and reporting measurement uncertainty.
              </p>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-ds_linear_regression_block">
                  <div className="help-block-name">ds_linear_regression_block</div>
                  <div className="help-block-desc">Fit a straight line <Code>y = m·x + c</Code> to two numeric columns. Stores the result in a variable and shows a regression card with slope, intercept, R², and a quality rating. The slope is the physical quantity in most labs (g, k, −γ).</div>
                </div>
                <div className="help-block-row" id="help-block-ds_multiply_columns_block">
                  <div className="help-block-name">ds_multiply_columns_block</div>
                  <div className="help-block-desc">Create a new column from the product of two existing columns. Used to compute <Code>T² = period_s × period_s</Code> so T² vs length can be regressed.</div>
                </div>
                <div className="help-block-row" id="help-block-ds_add_column_transform_block">
                  <div className="help-block-name">ds_add_column_transform_block</div>
                  <div className="help-block-desc">Add a column derived from another via a transform (square, square-root, natural log, etc.) — e.g. <Code>ln(E_total)</Code> for the damping analysis or <Code>t²</Code> for a distance-vs-t² linearisation.</div>
                </div>
                <div className="help-block-row" id="help-block-ds_print_uncertainty_block">
                  <div className="help-block-name">ds_print_uncertainty_block</div>
                  <div className="help-block-desc">Report a column's <strong>mean ± standard error</strong> as an uncertainty card. Use on a set of repeated measurements (e.g. one length's timing trials).</div>
                </div>
                <div className="help-block-row" id="help-block-ds_calc_relative_uncertainty_block">
                  <div className="help-block-name">ds_calc_relative_uncertainty_block</div>
                  <div className="help-block-desc">Compute the relative uncertainty (standard error ÷ mean, as a %) for a column — a quick measure of how precise a measurement is.</div>
                </div>
              </div>

              <h3 className="help-h3">Chart blocks</h3>
              <table className="help-table">
                <thead><tr><th>Block</th><th>Chart type</th><th>Required fields</th></tr></thead>
                <tbody>
                  <tr><td><Code>ds_chart_bar_block</Code></td><td>Bar chart</td><td>x column (categorical), y column (numeric)</td></tr>
                  <tr><td><Code>ds_chart_line_block</Code></td><td>Line chart</td><td>x column, y column</td></tr>
                  <tr><td><Code>ds_chart_scatter_block</Code></td><td>Scatter plot</td><td>x column, y column</td></tr>
                  <tr><td><Code>ds_chart_scatter_fit_block</Code></td><td>Scatter plot with regression line</td><td>x column, y column, fit variable (from a regression block)</td></tr>
                  <tr><td><Code>ds_chart_histogram_block</Code></td><td>Histogram</td><td>numeric column</td></tr>
                  <tr><td><Code>ds_chart_box_block</Code></td><td>Box plot</td><td>value column; optional group column</td></tr>
                </tbody>
              </table>
              <Note type="tip">
                To chart grouped averages, chain a <Code>ds_group_mean_block</Code> first, then pass
                the result variable to <Code>ds_chart_bar_block</Code> with the group column as x and
                the <Code>mean_&lt;col&gt;</Code> column as y.
              </Note>

              <h3 className="help-h3">Communicate blocks</h3>
              <div className="help-block-table">
                <div className="help-block-row" id="help-block-ds_write_note_block">
                  <div className="help-block-name">ds_write_note_block</div>
                  <div className="help-block-desc">Insert a free-text markdown note in the Data panel. Use to annotate findings between charts.</div>
                </div>
                <div className="help-block-row" id="help-block-ds_print_result_block">
                  <div className="help-block-name">ds_print_result_block</div>
                  <div className="help-block-desc">Display a named variable as a labelled value card. Use after a stats block to show the result with a human-readable label.</div>
                </div>
                <div className="help-block-row" id="help-block-ds_state_conclusion_block">
                  <div className="help-block-name">ds_state_conclusion_block</div>
                  <div className="help-block-desc">Display a styled conclusion callout at the end of the analysis. Encourages students to articulate a finding in plain language.</div>
                </div>
                <div className="help-block-row" id="help-block-ds_export_table_block">
                  <div className="help-block-name">ds_export_table_block</div>
                  <div className="help-block-desc">Download the current dataset as a CSV file.</div>
                </div>
                <div className="help-block-row" id="help-block-ds_show_python_block">
                  <div className="help-block-name">ds_show_python_block</div>
                  <div className="help-block-desc">Reveal the generated Python (pandas-style) code for the current analysis. Useful for students transitioning to a Python data science workflow.</div>
                </div>
              </div>

              <h3 className="help-h3">Built-in datasets</h3>
              <table className="help-table">
                <thead><tr><th>Dataset</th><th>Rows</th><th>Columns</th><th>Key columns</th></tr></thead>
                <tbody>
                  <tr>
                    <td><strong>Penguins</strong></td>
                    <td>30</td>
                    <td>7</td>
                    <td>species, island, bill_length_mm, bill_depth_mm, flipper_length_mm, body_mass_g, sex</td>
                  </tr>
                  <tr>
                    <td><strong>Weather</strong></td>
                    <td>28</td>
                    <td>6</td>
                    <td>date, city, temp_high_c, temp_low_c, precip_mm, condition</td>
                  </tr>
                  <tr>
                    <td><strong>Planets</strong></td>
                    <td>9</td>
                    <td>7</td>
                    <td>name, type, mass_earth, radius_km, period_days, distance_au, moons</td>
                  </tr>
                  <tr>
                    <td><strong>Pendulum</strong></td>
                    <td>56</td>
                    <td>7</td>
                    <td>study, length_m, mass_kg, amplitude_deg, trial, time_10swings_s, period_s</td>
                  </tr>
                  <tr>
                    <td><strong>Spring</strong></td>
                    <td>8</td>
                    <td>3</td>
                    <td>mass_g, force_N, extension_m</td>
                  </tr>
                  <tr>
                    <td><strong>Free fall</strong></td>
                    <td>12</td>
                    <td>3</td>
                    <td>time_s, velocity_y_ms, distance_m</td>
                  </tr>
                </tbody>
              </table>
              <Note type="info">
                The <strong>Pendulum</strong> set is a two-study lab: a <em>length</em> study
                (length varied, mass fixed, three timed trials each) and a <em>mass</em> study
                (mass varied, length fixed). It deliberately ships <strong>no pre-computed T²</strong> —
                students compute period² themselves to discover T² ∝ L and that mass has no effect.
                <strong> Spring</strong> (Hooke's law: 100 g mass steps, k ≈ 19.6 N/m) and{" "}
                <strong>Free fall</strong> (drop from rest: velocity and distance vs time) round out
                the measurement labs.
              </Note>
            </section>

            {/* ══════════════ CODE EDITOR ══════════════ */}
            <SectionAnchor id="code-editor" />
            <section className="help-section">
              <SectionHeader id="code-editor">Code Editor</SectionHeader>
              <p>
                The Code Editor uses <strong>Monaco Editor</strong> (the engine powering Visual Studio
                Code) with Python syntax highlighting, line numbers, and bracket matching.
              </p>

              <h3 className="help-h3">When is code editable?</h3>
              <table className="help-table">
                <thead>
                  <tr><th>Project type</th><th>Code editable?</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  <tr><td>Blank Project</td><td>Yes — code view only</td><td>Write VPython directly</td></tr>
                  <tr><td>Code Template</td><td>Yes</td><td>Edit the pre-loaded simulation</td></tr>
                  <tr><td>Blocks Template</td><td>No — read-only mirror</td><td>Shows generated code</td></tr>
                </tbody>
              </table>

              <h3 className="help-h3">VPython script structure</h3>
              <p>Every script must start with the GlowScript header line:</p>
              <Pre>{`GlowScript 3.2 VPython\n\n# Scene setup (optional)\nscene.title = "My Simulation"\nscene.background = vector(0.02, 0.03, 0.09)\nscene.range = 10\n\n# Create objects\nball = sphere(pos=vector(0,0,0), radius=0.5, color=color.red)\n\n# Set initial conditions\nball.velocity = vector(5, 8, 0)\ng = vector(0, -9.81, 0)\ndt = 0.005\n\n# Animation loop\nwhile True:\n    rate(200)          # throttle to 200 iterations/second\n    ball.velocity += g * dt\n    ball.pos      += ball.velocity * dt`}</Pre>

              <Note type="info">
                The <Code>GlowScript 3.2 VPython</Code> header is <strong>required</strong>. Without it,
                the runtime will not recognise the script as VPython and will fail to compile.
              </Note>

              <h3 className="help-h3">Useful code editor shortcuts</h3>
              <table className="help-table">
                <thead><tr><th>Shortcut</th><th>Action</th></tr></thead>
                <tbody>
                  <tr><td><Kbd>Ctrl+/</Kbd></td><td>Toggle comment on selected lines</td></tr>
                  <tr><td><Kbd>Ctrl+D</Kbd></td><td>Select next occurrence of word</td></tr>
                  <tr><td><Kbd>Alt+↑ / Alt+↓</Kbd></td><td>Move line up / down</td></tr>
                  <tr><td><Kbd>Ctrl+Z</Kbd> / <Kbd>Ctrl+Y</Kbd></td><td>Undo / Redo</td></tr>
                  <tr><td><Kbd>Ctrl+F</Kbd></td><td>Find in editor</td></tr>
                </tbody>
              </table>
            </section>

            {/* ══════════════ TEMPLATES ══════════════ */}
            <SectionAnchor id="templates" />
            <section className="help-section">
              <SectionHeader id="templates">Built-in Templates</SectionHeader>
              <p>
                Physics IDE ships with four fully worked physics simulations, seven data science
                analyses, and three coupled hybrid topics. The physics templates are available in
                both Code and Blocks editing modes; the data science and hybrid analyses are
                block-only.
              </p>
              <Note type="tip">
                All four Physics Blocks templates are built entirely from semantic blocks — no{" "}
                <Code>python_raw_block</Code> is used. Every scene property, object constructor,
                loop, condition, and telemetry update has a dedicated block, making the templates
                fully inspectable in the Block Editor.
              </Note>

              <h3 className="help-h3">1 · Projectile Motion</h3>
              <Tag color="blue">Code</Tag>&nbsp;<Tag color="purple">Blocks</Tag>
              <p>
                A ball is launched at 52° with initial speed 17.5 m/s. The simulation includes:
              </p>
              <ul className="help-list">
                <li><strong>Quadratic aerodynamic drag</strong> — <Code>F_drag = ½ ρ Cd A v²</Code> opposing the velocity vector (ρ=1.225 kg/m³, Cd=0.47, m=0.34 kg)</li>
                <li><strong>Multi-bounce with energy loss</strong> — coefficient of restitution 0.55; the ball bounces realistically and decelerates via rolling friction</li>
                <li><strong>Live telemetry</strong> — elapsed time, speed, height above ground, range, peak height</li>
                <li><strong>Velocity arrow</strong> — updates direction and magnitude each frame</li>
                <li><strong>Visual props</strong> — launch rail, distance ticks, axis indicators, glow lighting</li>
              </ul>
              <Pre>{`# Key parameters you can change:\nv0 = 17.5       # launch speed (m/s)\nangle = radians(52)  # launch angle\nm = 0.34        # mass (kg) — affects drag deceleration\nCd = 0.47       # drag coefficient (sphere \u2248 0.47)`}</Pre>

              <h3 className="help-h3">2 · Spring-Mass Oscillator</h3>
              <Tag color="blue">Code</Tag>&nbsp;<Tag color="purple">Blocks</Tag>
              <p>
                A 1.2 kg mass attached to a spring (k=14 N/m) with linear damping (b=0.22 Ns/m). The simulation includes:
              </p>
              <ul className="help-list">
                <li><strong>Hooke's law</strong> — F_spring = −kx where x is stretch from natural length</li>
                <li><strong>Linear damping</strong> — F_damp = −bv (underdamped: b_crit ≈ 8.2 Ns/m)</li>
                <li><strong>Colour-mapped spring</strong> — helix colour shifts from cool to warm with tension magnitude</li>
                <li><strong>Phase-space arrow</strong> — traces the (x, v) phase-space trajectory in real time</li>
                <li><strong>KE/PE telemetry</strong> — live kinetic and potential energy readout</li>
              </ul>
              <Pre>{`k = 14.0   # spring constant (N/m)\nm = 1.2    # mass (kg)\nb = 0.22   # damping coefficient (Ns/m)\nL0 = 4.0   # natural length (m)\nx0 = 1.8   # initial stretch (m)`}</Pre>

              <h3 className="help-h3">3 · Planetary Orbit</h3>
              <Tag color="blue">Code</Tag>&nbsp;<Tag color="purple">Blocks</Tag>
              <p>
                A three-body simulation: a luminous star, an orbiting planet, and a moon orbiting the planet.
              </p>
              <ul className="help-list">
                <li><strong>Newtonian gravity</strong> — <Code>F = G·M·m / r²</Code> computed pairwise</li>
                <li><strong>Softening</strong> — minimum separation enforced to prevent singularities at close approach</li>
                <li><strong>Stable parameters</strong> — G=10, M_star=10.33 gives v_circ=3.55 at r=8.2; moon at r=0.95 from planet, well inside the Hill sphere (r_Hill ≈ 1.42)</li>
                <li><strong>Moon placement</strong> — moon starts above the planet (perpendicular to the radial axis) for the most stable and visually correct orbit</li>
                <li><strong>Live trails</strong> — planet retains 3200 trail points, moon 1200</li>
                <li><strong>Telemetry</strong> — planet and moon speeds, orbital radius</li>
              </ul>
              <Note type="info">
                The orbit uses dimensionless units (G=10 rather than 6.674×10⁻¹¹) so that a
                visually interesting orbit fits comfortably on screen. The physics is identical —
                only the scale is different.
              </Note>

              <h3 className="help-h3">4 · Simple Pendulum</h3>
              <Tag color="blue">Code</Tag>&nbsp;<Tag color="purple">Blocks</Tag>
              <p>
                A 1 kg bob on a 2 m rigid rod pivoting about the origin. The simulation includes:
              </p>
              <ul className="help-list">
                <li><strong>Full nonlinear ODE</strong> — <Code>α = −(g/L)·sin(θ)</Code> with no small-angle approximation; accurate for large swing angles</li>
                <li><strong>Linear damping</strong> — <Code>−b·ω</Code> added to the angular acceleration; set b=0 for ideal undamped oscillation</li>
                <li><strong>Symplectic (semi-implicit) Euler</strong> — omega is updated before theta each step; this preserves the Hamiltonian structure and keeps E_total stable without energy drift</li>
                <li><strong>Live geometry update</strong> — the rod cylinder axis and bob sphere position are recomputed from <Code>θ</Code> every frame using <Code>bob_x = L·sin(θ), bob_y = −L·cos(θ)</Code></li>
                <li><strong>Golden bob trail</strong> — 200-point trail traces the arc of oscillation</li>
                <li><strong>Full energy telemetry</strong> — live KE, PE, and E_total readout; total energy decays slowly with damping active</li>
              </ul>
              <Pre>{`# Key parameters you can change:\nL = 2.0              # pendulum length (m) \u2014 affects period T \u2248 2\u03c0\u221a(L/g)\nm = 1.0              # bob mass (kg)\nb = 0.10             # damping coefficient \u2014 0 = undamped, ~0.5 = heavy damping\ntheta = radians(30)  # initial angle \u2014 try 90\u00b0 for large-angle nonlinear behaviour`}</Pre>
              <Note type="tip">
                The Blocks template uses only composable blocks — no <Code>python_raw_block</Code>.
                The angular acceleration is built from <Code>math_trig_block</Code> (sin, cos, radians),
                <Code>vector_compose_block</Code>, <Code>math_pow_block</Code>, and nested arithmetic
                blocks. Students can read the physics directly from the block stack.
              </Note>

              <h3 className="help-h3">Data Science Templates</h3>
              <Tag color="green">Blocks</Tag>
              <Note type="info">
                Data Science templates are block-only. They auto-execute when loaded — the Data
                panel populates immediately with tables, charts, and values. No Run press is needed.
              </Note>

              <h3 className="help-h3">DS 1 · Penguins: Exploratory Analysis</h3>
              <p>
                A complete exploratory data analysis on the Palmer Penguins dataset. The template
                demonstrates the full Load → Explore → Analyse → Visualise → Communicate pipeline:
              </p>
              <ul className="help-list">
                <li>Load penguins; show the full table; count rows</li>
                <li>All-stats summary for body mass</li>
                <li>Group mean of body mass by species → bar chart of species averages</li>
                <li>Scatter plot of flipper length vs body mass</li>
                <li>Histogram of body mass distribution</li>
                <li>Written conclusion</li>
              </ul>

              <h3 className="help-h3">DS 2 · Weather: Compare Two Cities</h3>
              <p>
                Compares Cape Town and Johannesburg weather data across temperature ranges
                and over time:
              </p>
              <ul className="help-list">
                <li>Load weather; show the full table</li>
                <li>Group mean of high temperature by city → bar chart</li>
                <li>Filter to Cape Town only → line chart of daily high temperature</li>
                <li>Box plot of high-temperature spread for both cities side by side</li>
                <li>Written conclusion</li>
              </ul>

              <h3 className="help-h3">DS 3 · Planets: Kepler's Third Law</h3>
              <p>
                Investigates the relationship between orbital distance and period across the solar
                system, confirming Kepler's third law:
              </p>
              <ul className="help-list">
                <li>Load planets; show the full table</li>
                <li>Sort by distance from the Sun (ascending) → show sorted table</li>
                <li>Scatter plot of distance vs orbital period</li>
                <li>Calculate and print the maximum orbital period (Pluto, 90 560 days)</li>
                <li>Written conclusion: planets farther from the Sun take longer to orbit</li>
              </ul>

              <h3 className="help-h3">DS 4 · Pendulum: What Controls the Period?</h3>
              <p>
                The headline measurement lab, driven by the realistic <strong>Pendulum</strong>
                dataset. Two investigations in one analysis:
              </p>
              <ul className="help-list">
                <li>Filter to the <Code>length</Code> study → compute <Code>T_sq = period_s × period_s</Code> → regress T² vs length</li>
                <li>The slope is <Code>4π²/g</Code>, so a slope ≈ 4.03 recovers g ≈ 9.8 m/s² (R² ≈ 0.99)</li>
                <li>Filter to the <Code>mass</Code> study → mean period per mass → period stays flat ≈ 1.42 s</li>
                <li>Conclusion: <strong>T² ∝ L</strong>, and <strong>mass has no effect</strong> on the period</li>
              </ul>

              <h3 className="help-h3">DS 5 · Free Fall: Measure g</h3>
              <p>
                Uses the <strong>Free fall</strong> dropped-ball log to measure gravitational
                acceleration directly:
              </p>
              <ul className="help-list">
                <li>Load free fall; regress <Code>velocity_y_ms</Code> vs <Code>time_s</Code></li>
                <li>The slope is g ≈ 9.8 m/s² (a <Code>distance vs t²</Code> linearisation instead gives g/2)</li>
                <li>Written conclusion linking the slope to g</li>
              </ul>

              <h3 className="help-h3">DS 6 · Uncertainty: Repeated Measurements</h3>
              <p>
                A genuine repeated-measurement uncertainty lab (replacing the old two-city weather
                example), driven by the Pendulum trials:
              </p>
              <ul className="help-list">
                <li>Filter to one length's repeated timing trials</li>
                <li>Report period <strong>mean ± standard error</strong> and the relative uncertainty %</li>
                <li>Written conclusion on measurement precision</li>
              </ul>

              <h3 className="help-h3">DS 7 · Linear Regression: Hooke's Law</h3>
              <p>
                Fits a straight line to the <strong>Spring</strong> loading data:
              </p>
              <ul className="help-list">
                <li>Regress force vs extension → slope is the spring constant k ≈ 19.6 N/m</li>
                <li>Scatter-plus-fit chart with the regression line overlaid</li>
                <li>R², slope, and intercept reported as a regression card</li>
              </ul>

              <h3 className="help-h3">Hybrid Topics <Tag color="purple">simulate → analyse</Tag></h3>
              <p>
                Hybrid projects couple a simulation with its matching analysis. Pick a topic card
                on the start menu, run the simulation, save a run, then use{" "}
                <strong>"Analyse this run →"</strong> on the chart to load the paired analysis with
                the run label pre-filled.
              </p>
              <HelpVideo
                src={analyseRoundtripVideo}
                poster={analyseRoundtripPoster}
                caption="A hybrid project: the 3D scene and the data pane share the window — drag the divider to rebalance."
              />
              <table className="help-table">
                <thead><tr><th>Topic</th><th>Simulation telemetry</th><th>Analysis (slope)</th></tr></thead>
                <tbody>
                  <tr>
                    <td><strong>Pendulum: measure damping</strong></td>
                    <td>t, E_total</td>
                    <td>Regress ln(E) vs t → slope −γ (damping coefficient)</td>
                  </tr>
                  <tr>
                    <td><strong>Projectile: measure g</strong></td>
                    <td>t, vy (vertical velocity)</td>
                    <td>Regress vy vs t → slope −g (crop to before the first bounce)</td>
                  </tr>
                  <tr>
                    <td><strong>Spring-mass: find k</strong></td>
                    <td>stretch, Fspring</td>
                    <td>Regress Fspring vs stretch → slope −k (spring constant)</td>
                  </tr>
                </tbody>
              </table>
              <Note type="tip">
                The simulations expose the right telemetry for a clean linear fit: the projectile
                emits <Code>vy</Code> (so vy vs t is a straight line of slope −g, unlike height vs
                t² on an angled launch), and the spring emits <Code>Fspring</Code> (so force vs
                stretch is linear, unlike √PE which folds into a V-shape).
              </Note>
            </section>

            {/* ══════════════ CUSTOM SCENES ══════════════ */}
            <SectionAnchor id="custom-scenes" />
            <section className="help-section">
              <SectionHeader id="custom-scenes">Writing Custom Scenes</SectionHeader>
              <p>
                Physics IDE supports any valid GlowScript 3.2 VPython program. Here is a step-by-step
                guide to writing a new simulation from scratch.
              </p>

              <h3 className="help-h3">Step 1 — Choose project type</h3>
              <p>
                From the Start Menu, select <strong>Blank Project</strong>. This gives you a clean code
                editor where you can write VPython freely.
              </p>

              <h3 className="help-h3">Step 2 — Start with the header &amp; scene</h3>
              <Pre>{`GlowScript 3.2 VPython\n\nscene.title  = "My Custom Simulation"\nscene.background = vector(0.05, 0.07, 0.14)\nscene.range  = 12\nscene.ambient = color.gray(0.3)`}</Pre>

              <h3 className="help-h3">Step 3 — Create objects</h3>
              <Pre>{`# Objects are created once, before the loop\nground = box(pos=vector(0,-0.5,0), size=vector(20,1,8),\n             color=vector(0.2,0.4,0.2))\nball = sphere(pos=vector(-8,1,0), radius=0.45,\n              color=vector(1,0.4,0.2), make_trail=True,\n              trail_radius=0.05, retain=400)`}</Pre>
              <Note type="warning">
                <Code>make_trail=True</Code> and <Code>emissive=True</Code> must be set in the
                constructor. Setting them after creation causes a runtime error in GlowScript 3.2.
              </Note>

              <h3 className="help-h3">Step 4 — Set initial physics state</h3>
              <Pre>{`ball.velocity = vector(6, 4, 0)\ng  = vector(0, -9.81, 0)\ndt = 0.005`}</Pre>

              <h3 className="help-h3">Step 5 — Write the animation loop</h3>
              <Pre>{`while True:\n    rate(200)\n\n    # Physics update\n    ball.velocity = ball.velocity + g * dt\n    ball.pos      = ball.pos      + ball.velocity * dt\n\n    # Ground bounce\n    if ball.pos.y < ball.radius:\n        ball.pos.y    = ball.radius\n        if ball.velocity.y < 0:\n            ball.velocity.y *= -0.6`}</Pre>

              <h3 className="help-h3">Adding the simulation as a permanent template</h3>
              <p>
                To save your scene so it appears in the Start Menu, open{" "}
                <Code>src/utils/precodedExamples.js</Code> and add a new entry to the{" "}
                <Code>EXAMPLES</Code> array:
              </p>
              <Pre>{`{\n  id:          "my_sim",\n  title:       "My Simulation",\n  subtitle:    "Short description",\n  description: "Longer description shown in the card",\n  code: \`GlowScript 3.2 VPython\n  // ... your code here\n  \`,\n}`}</Pre>
              <p>
                Then add a corresponding icon and accent colour in{" "}
                <Code>src/components/StartMenu.js</Code>:
              </p>
              <Pre>{`const CARD_ICONS = {\n  my_sim: RocketIcon,\n  ...\n};\nconst ACCENT_COLORS = {\n  my_sim: "var(--accent-green)",\n  ...\n};`}</Pre>
              <Note type="tip">
                For a blocks version of your template, add a matching entry to{" "}
                <Code>src/utils/blockTemplates.js</Code> and update the ID maps in{" "}
                <Code>App.js</Code> (<Code>findBlockTemplateByCodeId</Code> and{" "}
                <Code>findCodeTemplateByBlockId</Code>).
              </Note>
            </section>

            {/* ══════════════ VPYTHON REFERENCE ══════════════ */}
            <SectionAnchor id="vpython-ref" />
            <section className="help-section">
              <SectionHeader id="vpython-ref">VPython Quick Reference</SectionHeader>

              <h3 className="help-h3">3D Objects</h3>
              <table className="help-table">
                <thead><tr><th>Object</th><th>Key parameters</th></tr></thead>
                <tbody>
                  <tr><td><Code>sphere</Code></td><td><Code>pos, radius, color, opacity, emissive, make_trail, retain, trail_radius</Code></td></tr>
                  <tr><td><Code>box</Code></td><td><Code>pos, size (vector), color, opacity</Code></td></tr>
                  <tr><td><Code>cylinder</Code></td><td><Code>pos, axis (vector = direction × length), radius, color</Code></td></tr>
                  <tr><td><Code>arrow</Code></td><td><Code>pos, axis, shaftwidth, color</Code> — update <Code>axis</Code> to animate</td></tr>
                  <tr><td><Code>helix</Code></td><td><Code>pos, axis, radius, coils, thickness, color</Code> — update <Code>axis</Code> for spring animation</td></tr>
                  <tr><td><Code>label</Code></td><td><Code>pos, text, height, color, box, opacity</Code> — update <Code>text</Code> each frame for HUD display</td></tr>
                  <tr><td><Code>local_light</Code></td><td><Code>pos, color</Code> — point light, up to 8 per scene</td></tr>
                </tbody>
              </table>

              <h3 className="help-h3">Vectors &amp; maths</h3>
              <Pre>{`v = vector(1, 2, 3)     # create vector\nmag(v)                  # magnitude (scalar)\nnorm(v)                 # unit vector\ndot(v1, v2)             # dot product\ncross(v1, v2)           # cross product\n\n# Useful maths functions\nsin(x),  cos(x),  tan(x)   # trig (radians)\nasin(x), acos(x), atan(x)  # inverse trig\nradians(deg)               # degrees → radians\npi, e                      # constants\nsqrt(x), abs(x), pow(x,n)  # common maths\nrandom()                   # random float [0,1)`}</Pre>

              <h3 className="help-h3">Scene properties</h3>
              <Pre>{`scene.title      = "Title string"\nscene.background = vector(r, g, b)  # 0–1 range\nscene.range      = 10               # camera half-width\nscene.center     = vector(x, y, z)  # look-at point\nscene.forward    = vector(x, y, z)  # camera direction\nscene.ambient    = color.gray(0.3)  # ambient light level`}</Pre>

              <h3 className="help-h3">Colour helpers</h3>
              <Pre>{`color.red,    color.green, color.blue\ncolor.white,  color.black, color.yellow\ncolor.orange, color.cyan,  color.magenta\ncolor.gray(f)   # f in 0.0–1.0\nvector(r, g, b) # custom RGB, values 0–1`}</Pre>

              <h3 className="help-h3">Common patterns</h3>
              <Pre>{`# Pattern 1: Euler integration\nobj.velocity = obj.velocity + acceleration * dt\nobj.pos      = obj.pos      + obj.velocity * dt\n\n# Pattern 2: Drag force (quadratic)\ndrag_k = 0.5 * rho * Cd * A\nF_drag = -drag_k * mag(v) * v  # vector\n\n# Pattern 3: Hooke's law\nstretch = current_length - natural_length\nF_spring = -k * stretch  # scalar along spring axis\n\n# Pattern 4: Gravity (two bodies)\nr_vec  = obj.pos - attractor.pos\nF_grav = -G * M * m / mag(r_vec)**2 * norm(r_vec)`}</Pre>
            </section>

            {/* ══════════════ PHYSICS MODELS ══════════════ */}
            <SectionAnchor id="physics-models" />
            <section className="help-section">
              <SectionHeader id="physics-models">Physics Models</SectionHeader>

              <h3 className="help-h3">Projectile Motion with Drag</h3>
              <div className="help-equation">
                <p><strong>Governing equations</strong></p>
                <p>Aerodynamic drag: <code className="help-eq">F_drag = −½ ρ Cd A |v| v</code></p>
                <p>Net acceleration: <code className="help-eq">a = g + F_drag / m</code></p>
                <p>Euler integration: <code className="help-eq">v(t+dt) = v(t) + a·dt</code>, <code className="help-eq">r(t+dt) = r(t) + v·dt</code></p>
              </div>
              <table className="help-table">
                <thead><tr><th>Symbol</th><th>Value</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td><Code>g</Code></td><td>9.81 m/s²</td><td>Gravitational acceleration (downward Y)</td></tr>
                  <tr><td><Code>ρ</Code></td><td>1.225 kg/m³</td><td>Air density at sea level</td></tr>
                  <tr><td><Code>Cd</Code></td><td>0.47</td><td>Drag coefficient (smooth sphere)</td></tr>
                  <tr><td><Code>m</Code></td><td>0.34 kg</td><td>Ball mass</td></tr>
                  <tr><td><Code>r</Code></td><td>0.28 m</td><td>Ball radius</td></tr>
                  <tr><td><Code>v₀</Code></td><td>17.5 m/s</td><td>Launch speed</td></tr>
                  <tr><td><Code>θ</Code></td><td>52°</td><td>Launch angle (≈ range-maximising for drag)</td></tr>
                </tbody>
              </table>
              <p>The bounce uses a <strong>coefficient of restitution</strong> e=0.55 (v_y ← −0.55·v_y) and rolling friction coefficient μ=0.12 per step to bring the ball to rest naturally.</p>

              <h3 className="help-h3">Spring-Mass Oscillator</h3>
              <div className="help-equation">
                <p><strong>Equation of motion</strong></p>
                <p><code className="help-eq">m·ẍ = −kx − bẋ</code></p>
                <p>Natural frequency: <code className="help-eq">ω₀ = √(k/m) = √(14/1.2) ≈ 3.42 rad/s</code></p>
                <p>Period: <code className="help-eq">T ≈ 2π/ω₀ ≈ 1.84 s</code></p>
                <p>Critical damping: <code className="help-eq">b_crit = 2√(km) ≈ 8.2 Ns/m</code></p>
              </div>
              <p>With b=0.22 the system is strongly <strong>underdamped</strong> (b/b_crit ≈ 0.027). Oscillations decay slowly — visible over many cycles.</p>
              <Pre>{`KE = 0.5 * m * v**2      # kinetic energy (J)\nPE = 0.5 * k * x**2      # elastic potential energy (J)\nE_total = KE + PE        # total mechanical energy (decreasing due to damping)`}</Pre>

              <h3 className="help-h3">Planetary Orbit (N-body gravity)</h3>
              <div className="help-equation">
                <p><strong>Gravitational acceleration</strong> on body i due to body j:</p>
                <p><code className="help-eq">a_i = −G·Mⱼ / |rᵢⱼ|² · r̂ᵢⱼ</code></p>
              </div>
              <table className="help-table">
                <thead><tr><th>Parameter</th><th>Value</th><th>Derived quantity</th></tr></thead>
                <tbody>
                  <tr><td>G</td><td>10 (dimensionless)</td><td>—</td></tr>
                  <tr><td>M_star</td><td>10.33</td><td>v_circ(planet) = √(G·M/r) = 3.55</td></tr>
                  <tr><td>M_planet</td><td>0.16</td><td>v_circ(moon) = √(G·M_p/r_moon) = 1.30</td></tr>
                  <tr><td>r_planet</td><td>8.2 units</td><td>Planet orbital radius</td></tr>
                  <tr><td>r_moon</td><td>0.95 units</td><td>Moon orbital radius (from planet)</td></tr>
                  <tr><td>r_Hill</td><td>≈ 1.42 units</td><td>Hill sphere radius; moon at 0.95 is stable</td></tr>
                </tbody>
              </table>
              <Note type="info">
                <strong>Hill sphere:</strong> r_Hill = r_planet × (M_planet / 3·M_star)^(1/3).
                A moon is gravitationally bound to its planet when its orbital radius is less than
                about half the Hill sphere radius.
              </Note>

              <h3 className="help-h3">Simple Pendulum</h3>
              <div className="help-equation">
                <p><strong>Governing equation (nonlinear ODE)</strong></p>
                <p>Full nonlinear: <code className="help-eq">θ̈ = α = −(g/L)·sin(θ) − b·ω</code></p>
                <p>Small-angle (|θ| ≪ 1 rad): <code className="help-eq">θ̈ ≈ −(g/L)·θ</code></p>
                <p>Period (small-angle, undamped): <code className="help-eq">T = 2π√(L/g) ≈ 2.84 s for L = 2 m</code></p>
                <p>Energy: <code className="help-eq">KE = ½mL²ω²</code> &nbsp; <code className="help-eq">PE = mgL(1−cosθ)</code></p>
              </div>
              <table className="help-table">
                <thead><tr><th>Symbol</th><th>Value</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td><Code>L</Code></td><td>2.0 m</td><td>Pendulum length (pivot to bob centre)</td></tr>
                  <tr><td><Code>m</Code></td><td>1.0 kg</td><td>Bob mass</td></tr>
                  <tr><td><Code>b</Code></td><td>0.10 Ns/rad</td><td>Linear damping coefficient — proportional to ω</td></tr>
                  <tr><td><Code>θ₀</Code></td><td>30° = π/6 rad</td><td>Initial angle from vertical; bob released from rest</td></tr>
                  <tr><td><Code>ω₀</Code></td><td>0 rad/s</td><td>Initial angular velocity</td></tr>
                  <tr><td><Code>g</Code></td><td>9.81 m/s²</td><td>Gravitational acceleration</td></tr>
                  <tr><td><Code>dt</Code></td><td>0.005 s</td><td>Time step (200 Hz)</td></tr>
                </tbody>
              </table>
              <Pre>{`# Integration scheme: Symplectic (semi-implicit) Euler\nalpha = -(g / L) * sin(theta) - b * omega\nomega = omega + alpha * dt   # update omega first (symplectic step)\ntheta = theta + omega * dt   # then theta (uses updated omega)\n\n# Bob Cartesian position\nbob_x = L * sin(theta)\nbob_y = -L * cos(theta)\n\n# Mechanical energy\nKE      = 0.5 * m * L**2 * omega**2      # rotational KE\nPE      = m * g * L * (1 - cos(theta))  # gravitational PE (zero at bottom)\nE_total = KE + PE                        # decays slowly when b > 0`}</Pre>
              <Note type="info">
                <strong>Symplectic vs standard Euler:</strong> Standard Euler updates theta before omega,
                causing artificial energy gain — the bob drifts outward over time even with b=0.
                Symplectic Euler (omega updated first) preserves the Hamiltonian structure of the equations
                of motion and keeps E_total numerically stable across thousands of oscillations.
              </Note>
              <p>With b=0.10 the system is <strong>lightly damped</strong>. The critical damping coefficient
              is <code className="help-eq">b_crit = 2mω₀L = 2×1.0×√(g/L)×2.0 ≈ 5.6 Ns/rad</code>; at b=0.10 the
              damping ratio is only ζ ≈ 0.018 — oscillations decay very slowly, making the energy decay
              clearly visible in the telemetry over many cycles.</p>
            </section>

            {/* ══════════════ EXPORT ══════════════ */}
            <SectionAnchor id="export" />
            <section className="help-section">
              <SectionHeader id="export">Export &amp; Share</SectionHeader>
              <p>
                Physics IDE provides seven export options, all accessible from the{" "}
                <strong>File</strong> menu in the toolbar. Saving your project is
                separate — <Kbd>Ctrl+S</Kbd> saves, it does not export.
              </p>
              <table className="help-table">
                <thead><tr><th>Export option</th><th>Format</th><th>Contents</th><th>Best for</th></tr></thead>
                <tbody>
                  <tr>
                    <td><Tag color="blue">Export as Python (.py)</Tag></td>
                    <td>Python file</td>
                    <td>Current VPython code (generated or written)</td>
                    <td>Running locally in a VPython desktop installation, sharing code</td>
                  </tr>
                  <tr>
                    <td><Tag color="purple">Export Blocks (.xml)</Tag></td>
                    <td>Blockly XML</td>
                    <td>Serialised block workspace</td>
                    <td>Saving and sharing block programs; restoring exact block layout</td>
                  </tr>
                  <tr>
                    <td><Tag color="teal">Code as PDF</Tag></td>
                    <td>PDF document</td>
                    <td>Formatted VPython source code</td>
                    <td>Assessment submissions, code review printouts</td>
                  </tr>
                  <tr>
                    <td><Tag color="teal">Blocks as PDF</Tag></td>
                    <td>PDF image</td>
                    <td>Screenshot of the current block canvas</td>
                    <td>Assessment submissions, handouts, printed documentation</td>
                  </tr>
                  <tr>
                    {/* The File-menu screenshot item is gone (Plan 10): the
                        camera button ON the 3D viewport is the one path. */}
                    <td><Tag color="blue">Viewport camera button</Tag></td>
                    <td>PNG image (opens in a new tab — right-click to save)</td>
                    <td>Current 3D viewport frame, taken where the picture is</td>
                    <td>Capturing a simulation state for reports or presentations</td>
                  </tr>
                  <tr>
                    <td><Tag color="green">Copy Code to Clipboard</Tag></td>
                    <td>Clipboard text</td>
                    <td>Current VPython code</td>
                    <td>Pasting into an external editor or LMS submission box</td>
                  </tr>
                  <tr>
                    <td><Tag color="purple">Export Project Bundle (.physide.json)</Tag></td>
                    <td>JSON file</td>
                    <td>Complete project manifest — goal, title, block XML, code, and datasets</td>
                    <td>Portable save; import on another machine or browser</td>
                  </tr>
                </tbody>
              </table>
              <Note type="tip">
                For a complete assessment submission, export the <strong>.xml</strong> (block
                structure) and the <strong>Code as PDF</strong>. Lecturers can reload the .xml
                to inspect and edit the original block program.
              </Note>

              <h3 className="help-h3">Importing a project</h3>
              <p>
                Open the <strong>File</strong> menu in the toolbar and choose{" "}
                <strong>Open project bundle</strong> to import a{" "}
                <Code>.physide.json</Code> project bundle. The imported project replaces the current
                workspace after a confirmation prompt. To restore a <Code>.xml</Code> Blockly
                workspace file, use the same menu's <strong>Import blocks or Python</strong> item,
                which accepts both <Code>.py</Code> and <Code>.xml</Code>.
              </p>

              <h3 className="help-h3">Exporting trace data (Debug Mode)</h3>
              <p>
                In Debug Mode, press <Tag color="red">Record</Tag>, run or step through the
                simulation, press <Tag color="red">REC</Tag> again to stop, then click{" "}
                <Tag color="blue">CSV</Tag> to download the trace data as a CSV file containing
                variable, value, delta, min, max, and timestamp columns for every captured event.
              </p>
            </section>

            {/* ══════════════ EDUCATORS ══════════════ */}
            <SectionAnchor id="educators" />
            <section className="help-section">
              <SectionHeader id="educators">For Educators</SectionHeader>

              <h3 className="help-h3">Physics IDE as a teaching tool</h3>
              <p>
                Physics IDE is designed to be used in educational settings from secondary school through
                to university level. Key pedagogical features:
              </p>
              <ul className="help-list">
                <li>
                  <strong>Dual representation</strong> — every block program has a 1:1 code mirror.
                  Students can transition from visual programming to writing VPython code at their own pace.
                </li>
                <li>
                  <strong>Physics first</strong> — all built-in templates use accurate, real-world physics
                  equations with documented parameters. Students can validate simulation results against
                  analytical solutions.
                </li>
                <li>
                  <strong>Instant 3D feedback</strong> — simulations run in under a second with no
                  installation required. Any laptop or desktop with a modern browser runs Physics
                  IDE; 1024px is the supported width floor.
                </li>
                <li>
                  <strong>Export for assessment</strong> — PDF export (blocks and code) provides clean
                  submission artefacts when you are marking off-platform. Inside a class, students
                  hand work in directly and you mark it here (see below).
                </li>
              </ul>

              <h3 className="help-h3">Suggested lesson progressions</h3>
              <div className="help-lesson-grid">
                <div className="help-lesson-card">
                  <div className="help-lesson-num">01</div>
                  <div className="help-lesson-body">
                    <strong>Introduction to simulation</strong>
                    <p>Open the Projectile Blocks template. Run it. Identify each block. Change launch angle 
                    and speed. Measure simulated range vs analytical range (no drag).</p>
                    <Tag color="green">Introductory</Tag>
                  </div>
                </div>
                <div className="help-lesson-card">
                  <div className="help-lesson-num">02</div>
                  <div className="help-lesson-body">
                    <strong>Adding drag</strong>
                    <p>Switch to Code view. Modify the drag coefficient Cd. Compare range with Cd=0 vs
                    Cd=0.47. Compare to analytical projectile range formula.</p>
                    <Tag color="yellow">Intermediate</Tag>
                  </div>
                </div>
                <div className="help-lesson-card">
                  <div className="help-lesson-num">03</div>
                  <div className="help-lesson-body">
                    <strong>Damped oscillations</strong>
                    <p>Use the Spring-Mass template. Vary damping coefficient b from 0 → b_crit.
                    Observe transition from underdamped → overdamped. Plot KE+PE decay.</p>
                    <Tag color="yellow">Intermediate</Tag>
                  </div>
                </div>
                <div className="help-lesson-card">
                  <div className="help-lesson-num">04</div>
                  <div className="help-lesson-body">
                    <strong>Orbital mechanics</strong>
                    <p>Open the Orbit template. Change planet initial speed and observe: circular orbit,
                    elliptical orbit, escape trajectory. Verify Kepler's third law numerically.</p>
                    <Tag color="red">Advanced</Tag>
                  </div>
                </div>
                <div className="help-lesson-card">
                  <div className="help-lesson-num">05</div>
                  <div className="help-lesson-body">
                    <strong>Pendulum &amp; nonlinear dynamics</strong>
                    <p>Open the Pendulum template. Compare period at 5° (small-angle) vs 60° (large-angle).
                    Measure how E_total decays with damping. Derive T analytically and compare to simulation.</p>
                    <Tag color="red">Advanced</Tag>
                  </div>
                </div>
                <div className="help-lesson-card">
                  <div className="help-lesson-num">06</div>
                  <div className="help-lesson-body">
                    <strong>Build from scratch</strong>
                    <p>Students create a custom simulation in a Blank Project — e.g. a bouncing ball,
                    charged particle, or two-body collision. Assessment via code PDF + blocks XML.</p>
                    <Tag color="red">Advanced</Tag>
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Parameter tables for student exercises</h3>
              <Note type="tip">
                When setting exercises, provide students with a specific set of parameters to use in the
                simulation, then ask them to verify the result analytically. This bridges computational
                and classical physics skills.
              </Note>
              <table className="help-table">
                <thead>
                  <tr><th>Exercise</th><th>Analytical formula</th><th>Expected result</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Projectile range (no drag)</td>
                    <td><Code>R = v₀² sin(2θ) / g</Code></td>
                    <td>R ≈ 30.0 m at v₀=17.5, θ=52°, g=9.81</td>
                  </tr>
                  <tr>
                    <td>Spring period</td>
                    <td><Code>T = 2π√(m/k)</Code></td>
                    <td>T ≈ 1.84 s at m=1.2, k=14</td>
                  </tr>
                  <tr>
                    <td>Circular orbit speed</td>
                    <td><Code>v = √(GM/r)</Code></td>
                    <td>v ≈ 3.55 at G=10, M=10.33, r=8.2</td>
                  </tr>
                  <tr>
                    <td>Pendulum period (small-angle)</td>
                    <td><Code>T = 2π√(L/g)</Code></td>
                    <td>T ≈ 2.84 s at L=2.0, g=9.81</td>
                  </tr>
                </tbody>
              </table>

              <div className="help-lesson-grid">
                <div className="help-lesson-card">
                  <div className="help-lesson-num">07</div>
                  <div className="help-lesson-body">
                    <strong>Data Science: first analysis</strong>
                    <p>Open the Penguins exploratory analysis template. Run through each block.
                    Ask students: which species is heaviest? How do you know?</p>
                    <Tag color="green">Introductory</Tag>
                  </div>
                </div>
                <div className="help-lesson-card">
                  <div className="help-lesson-num">08</div>
                  <div className="help-lesson-body">
                    <strong>Data Science: filter and compare</strong>
                    <p>Open the Weather template. Filter for one city, then filter for the other.
                    Use a box plot to compare spread. State a conclusion block.</p>
                    <Tag color="yellow">Intermediate</Tag>
                  </div>
                </div>
                <div className="help-lesson-card">
                  <div className="help-lesson-num">09</div>
                  <div className="help-lesson-body">
                    <strong>Hybrid: simulate then analyse</strong>
                    <p>Create a Hybrid project and pick the <strong>Projectile: measure g</strong>
                    topic. Run the simulation, record the trace, and save a run cropped to before
                    the first bounce. Click <strong>"Analyse this run →"</strong> — the paired
                    analysis regresses vy vs t. Compare the slope (≈ −9.8 m/s²) to the known value
                    of g.</p>
                    <Tag color="red">Advanced</Tag>
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Classes, assignments and marking</h3>
              <p>
                Physics IDE is also a classroom platform. Signing in is optional — a guest gets
                the whole IDE with nothing held back — but a signed-in teacher can create a class
                and set work against it. Anyone may sign up as a teacher; there is no approval
                queue.
              </p>
              <ul className="help-list">
                <li>
                  <strong>A class</strong> — created from a name and an optional subject or year
                  label. Students join by a short code, a link, a QR code on the board, or an
                  email invite. Joining is open, by approval, or paused.
                </li>
                <li>
                  <strong>Assignments</strong> — instructions written as a real document (headings,
                  images, formulas, embedded video), an optional pinned starter project, dates and
                  points, and workspace rules that decide which tools the student has while
                  working. Three presets ship — open practice, standard classwork, locked
                  assessment — and a teacher can save their own combination.
                </li>
                <li>
                  <strong>Submissions</strong> — the student works in a private copy and hands it
                  in. The receipt carries a fingerprint of exactly what was submitted, and work
                  handed in after the due date is labelled late.
                </li>
                <li>
                  <strong>Marking</strong> — the submission opens as a read-only script; running it
                  means opening a test copy, which lands in the marker's own projects. Marks and
                  comments can be drafted by a teaching assistant and are released by the teacher,
                  or the work is returned for changes and reopens.
                </li>
                <li>
                  <strong>Gradebook</strong> — every released mark for the class in one grid,
                  exportable to CSV.
                </li>
                <li>
                  <strong>Pairs and groups</strong> — one shared project per group, an editing
                  baton so only one member writes at a time, and a submission that credits every
                  member.
                </li>
              </ul>
              <Note type="info">
                Physics and data analysis never <em>run</em> on a server, with or without an
                account — every simulation and every analysis executes on the machine in front
                of you. A guest's work never leaves the browser at all. Signing in syncs your
                projects to your account, and handing work in freezes a copy of the project as
                submitted; what moves is the saved work, never the running of it.
              </Note>

              <h3 className="help-h3">Deploying to students</h3>
              <p>
                The IDE itself is a static React single-page application: it runs entirely in the
                browser, and a guest needs no account and uploads nothing. Built that way, it can
                be deployed to any static hosting service — Vercel, Cloudflare Pages, Netlify,
                GitHub Pages, or a school web server — and students reach it by URL with nothing
                to install and no account to create.
              </p>
              <p>
                The classroom half needs one more piece alongside that static build: accounts,
                classes, assignments, submissions and marks live in a Fastify and PostgreSQL
                service. It is one small server for one school, hard-capped at 200 accounts, and
                it never runs anybody's physics.
              </p>
              <Pre>{`# Run locally:\nnpm install\nnpm start\n\n# Build for production:\nnpm run build\n\n# Deploy to Vercel:\nvercel --prod`}</Pre>
              <p>
                See <Code>DEPLOY.md</Code> in the project root for the static build's full Vercel
                and Cloudflare Pages instructions, including SPA rewrite configuration and CI
                smoke tests.
              </p>
            </section>

            {/* ══════════════ SHORTCUTS ══════════════ */}
            <SectionAnchor id="shortcuts" />
            <section className="help-section">
              <SectionHeader id="shortcuts">Keyboard Shortcuts</SectionHeader>
              <table className="help-table">
                <thead><tr><th>Where</th><th>Shortcut</th><th>Action</th></tr></thead>
                <tbody>
                  <tr><td>Global</td><td><Kbd>Ctrl+Enter</Kbd></td><td>Run the simulation</td></tr>
                  <tr><td>Global</td><td><Kbd>F5</Kbd></td><td>Run the simulation</td></tr>
                  <tr><td>Global</td><td><Kbd>Esc</Kbd></td><td>Stop the simulation</td></tr>
                  <tr><td>Global</td><td><Kbd>Ctrl+S</Kbd></td><td>Save the project</td></tr>
                  <tr><td>Global</td><td><Kbd>Esc</Kbd></td><td>Close Help page</td></tr>
                  <tr><td>Block canvas</td><td><Kbd>Ctrl+Z</Kbd></td><td>Undo last block action</td></tr>
                  <tr><td>Block canvas</td><td><Kbd>Ctrl+Y</Kbd></td><td>Redo</td></tr>
                  <tr><td>Block canvas</td><td><Kbd>Delete</Kbd> / <Kbd>Backspace</Kbd></td><td>Delete selected block</td></tr>
                  <tr><td>Block canvas</td><td><Kbd>Ctrl+A</Kbd></td><td>Select all blocks</td></tr>
                  <tr><td>Block canvas</td><td><Kbd>Ctrl+C</Kbd> / <Kbd>Ctrl+V</Kbd></td><td>Copy / paste block</td></tr>
                  <tr><td>Code editor</td><td><Kbd>Ctrl+/</Kbd></td><td>Toggle line comment</td></tr>
                  <tr><td>Code editor</td><td><Kbd>Alt+↑/↓</Kbd></td><td>Move line up / down</td></tr>
                  <tr><td>Code editor</td><td><Kbd>Ctrl+F</Kbd></td><td>Find in file</td></tr>
                  <tr><td>3D Viewport</td><td>Left drag</td><td>Orbit camera</td></tr>
                  <tr><td>3D Viewport</td><td>Right drag</td><td>Pan camera</td></tr>
                  <tr><td>3D Viewport</td><td>Scroll wheel</td><td>Zoom in / out</td></tr>
                  <tr><td>Debug Mode</td><td><Kbd>Space</Kbd></td><td>Pause / Resume simulation</td></tr>
                  <tr><td>Debug Mode</td><td><Kbd>F10</Kbd></td><td>Next frame — one whole timestep</td></tr>
                  <tr><td>Debug Mode</td><td><Kbd>Shift</Kbd> + <Kbd>F10</Kbd></td><td>Next value — one reported value</td></tr>
                </tbody>
              </table>
            </section>

            <div className="help-footer">
              Physics IDE v1.0 — Browser-based physics simulation and data science environment · React · Google Blockly · Monaco · GlowScript 3.2 VPython · Arquero · Observable Plot
            </div>
            </div>{/* end hidden-when-searching wrapper */}
          </div>
        </div>
      </div>
    </div>
  );
}
