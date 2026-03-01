/**
 * HelpPage.js
 *
 * Full-screen contextual help & documentation for Physics IDE.
 * Covers every feature from blocks to code to physics models.
 * Designed for junior developers, senior developers, and educators.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  AtomIcon, RocketIcon, BlocksIcon, BookOpenIcon, CodeIcon,
  DownloadIcon, ZapIcon, LayersIcon, EditIcon, UsersIcon,
} from "./Icons";

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
function SectionAnchor({ id }) {
  return <div id={id} className="help-section-anchor" />;
}

/* ── Section icon map ────────────────────────────────────── */
const SECTION_ICON_MAP = {
  "overview":        AtomIcon,
  "getting-started": RocketIcon,
  "block-editor":    BlocksIcon,
  "block-reference": BookOpenIcon,
  "code-editor":     CodeIcon,
  "templates":       LayersIcon,
  "custom-scenes":   EditIcon,
  "vpython-ref":     CodeIcon,
  "physics-models":  AtomIcon,
  "export":          DownloadIcon,
  "educators":       UsersIcon,
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

/* ── Navigation structure ────────────────────────────────── */
const NAV = [
  { id: "overview",        label: "Overview",               Icon: AtomIcon },
  { id: "getting-started", label: "Getting Started",        Icon: RocketIcon },
  { id: "block-editor",    label: "Block Editor",           Icon: BlocksIcon },
  { id: "block-reference", label: "Block Reference",        Icon: BookOpenIcon },
  { id: "code-editor",     label: "Code Editor",            Icon: CodeIcon },
  { id: "templates",       label: "Built-in Templates",     Icon: LayersIcon },
  { id: "custom-scenes",   label: "Custom Scenes",          Icon: EditIcon },
  { id: "vpython-ref",     label: "VPython Reference",      Icon: CodeIcon },
  { id: "physics-models",  label: "Physics Models",         Icon: AtomIcon },
  { id: "export",          label: "Export & Share",         Icon: DownloadIcon },
  { id: "educators",       label: "For Educators",          Icon: UsersIcon },
  { id: "shortcuts",       label: "Keyboard Shortcuts",     Icon: ZapIcon },
];

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function HelpPage({ onClose }) {
  const [activeSection, setActiveSection] = useState("overview");
  const contentRef = useRef(null);

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

  function scrollTo(id) {
    const el = contentRef.current;
    if (!el) return;
    const target = el.querySelector(`#${id}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
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

            {/* ══════════════ OVERVIEW ══════════════ */}
            <SectionAnchor id="overview" />
            <section className="help-section">
              <SectionHeader id="overview">Overview</SectionHeader>
              <p>
                <strong>Physics IDE</strong> is a browser-based physics simulation environment that lets you
                build, run, and explore 3D physics simulations without installing anything. It combines a
                visual <strong>block editor</strong> (powered by Google Blockly) with a full{" "}
                <strong>VPython / GlowScript 3.2 code editor</strong> and a live <strong>3D viewport</strong>{" "}
                that renders real-time WebGL simulations.
              </p>
              <Note type="info">
                Physics IDE runs entirely in your browser. All simulations execute inside an isolated
                GlowScript 3.2 runtime — no server needed, no data uploaded.
              </Note>

              <h3 className="help-h3">Architecture at a glance</h3>
              <div className="help-arch-grid">
                <div className="help-arch-box help-arch-box--blue">
                  <strong>Block Editor</strong>
                  <p>Drag-and-drop Blockly blocks. Each block generates valid VPython code automatically.</p>
                </div>
                <div className="help-arch-box help-arch-box--purple">
                  <strong>Code Editor</strong>
                  <p>Monaco-powered editor (same engine as VS Code). Read-only view in block mode; editable in code-template and blank projects.</p>
                </div>
                <div className="help-arch-box help-arch-box--green">
                  <strong>3D Viewport</strong>
                  <p>Isolated iframe running GlowScript 3.2. Renders WebGL via VPython's web runtime. Camera: left-drag to orbit, right-drag to pan, scroll to zoom.</p>
                </div>
              </div>

              <h3 className="help-h3">Two ways to build</h3>
              <table className="help-table">
                <thead>
                  <tr><th>Method</th><th>Best for</th><th>Code editable?</th></tr>
                </thead>
                <tbody>
                  <tr><td><Tag color="purple">Blocks</Tag> Block Editor</td><td>Learners, prototyping</td><td>Read-only mirror</td></tr>
                  <tr><td><Tag color="blue">Code</Tag> Code Template</td><td>Intermediate learners, customization</td><td>Yes — full Monaco editor</td></tr>
                  <tr><td><Tag color="green">Blank</Tag> Blank Project</td><td>Advanced users, custom models</td><td>Yes (code view only)</td></tr>
                </tbody>
              </table>

              <h3 className="help-h3">Switching views on templates</h3>
              <p>
                When working with a template, use the <strong>Blocks / Code</strong> toggle in the
                toolbar to switch between both representations:
              </p>
              <ul className="help-list">
                <li>
                  <Tag color="purple">Blocks Template</Tag> — <strong>Blocks</strong> is the
                  editable Block Editor; <strong>Code</strong> shows the generated VPython (read-only).
                </li>
                <li>
                  <Tag color="blue">Code Template</Tag> — <strong>Code</strong> is the editable
                  Code Editor; <strong>Blocks</strong> shows the block structure (read-only reference).
                </li>
              </ul>
              <Note type="tip">
                Toggling between Blocks and Code is the quickest way to study how visual blocks
                translate to VPython code — ideal for students transitioning from visual to
                textual programming.
              </Note>
            </section>

            {/* ══════════════ GETTING STARTED ══════════════ */}
            <SectionAnchor id="getting-started" />
            <section className="help-section">
              <SectionHeader id="getting-started">Getting Started</SectionHeader>

              <h3 className="help-h3">The Start Menu</h3>
              <p>
                When you launch Physics IDE you land on the <strong>Start Menu</strong>. Three types of
                project are available:
              </p>
              <ul className="help-list">
                <li>
                  <Tag color="purple">Blocks Template</Tag> — loads a complete pre-built simulation into the
                  Block Editor. Every block is wired up and ready to run. Use this to learn how block
                  programs map to VPython code.
                </li>
                <li>
                  <Tag color="blue">Code Example</Tag> — loads a polished VPython simulation directly into
                  the Code Editor. Fully editable. Use this to study real physics code or tweak parameters.
                </li>
                <li>
                  <Tag color="green">Blank Project</Tag> — empty workspace. Start building from scratch
                  in either blocks or code mode.
                </li>
              </ul>

              <Note type="tip">
                <strong>Tip for educators:</strong> Start with a <em>Blocks Template</em> for a live
                demo — students can immediately see how the blocks translate to code by switching to
                the Code tab.
              </Note>

              <h3 className="help-h3">Running a simulation</h3>
              <ol className="help-list">
                <li>Select a template or build your own model.</li>
                <li>Click <Tag color="green">▶ Run</Tag> in the toolbar.</li>
                <li>The 3D Viewport will initialise the GlowScript runtime and start rendering.</li>
                <li>Use the mouse to <strong>orbit</strong> (left drag), <strong>pan</strong> (right drag), and <strong>zoom</strong> (scroll wheel) inside the viewport.</li>
                <li>Click <Tag color="red">■ Stop</Tag> to halt the simulation.</li>
              </ol>

              <h3 className="help-h3">Saving your work</h3>
              <p>
                Physics IDE <strong>auto-saves</strong> your workspace every 2 seconds to browser
                localStorage. Your session will be restored when you reopen the app. For permanent
                saves use the <strong>Export</strong> buttons.
              </p>
            </section>

            {/* ══════════════ BLOCK EDITOR ══════════════ */}
            <SectionAnchor id="block-editor" />
            <section className="help-section">
              <SectionHeader id="block-editor">Block Editor</SectionHeader>
              <p>
                The Block Editor uses <strong>Google Blockly v11</strong>. Blocks are grouped into
                categories in the toolbox on the left. Drag a block onto the canvas, connect it to
                others, and click <Tag color="green">▶ Run</Tag> — Physics IDE translates the block
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

              <h3 className="help-h3">Beginner / Advanced mode</h3>
              <p>
                The <strong>Beginner / Advanced</strong> button in the toolbar switches the toolbox
                between two modes:
              </p>
              <ul className="help-list">
                <li>
                  <Tag color="green">Beginner</Tag> — shows only the <strong>\uD83D\uDE80 Starter</strong> category
                  plus stripped-down Values, Objects, Motion, Control, Logic, and Math categories.
                  Advanced topics (Functions, Lists, Text, raw Python) are hidden.
                </li>
                <li>
                  <Tag color="blue">Advanced</Tag> — shows all categories including Functions, Lists,
                  Text, Advanced (raw Python), and the full Physics Expressions set.
                </li>
              </ul>
              <Note type="tip">
                Start new students in <strong>Beginner</strong> mode. The \uD83D\uDE80 Starter
                category has every block needed to build a complete physics simulation on a single screen.
              </Note>

              <h3 className="help-h3">\uD83D\uDE80 Starter category</h3>
              <p>
                The <strong>Starter</strong> category appears at the top of the toolbox in both modes.
                It is a curated shortcut panel containing the most commonly needed blocks
                for a first simulation, labelled and grouped by purpose:
              </p>
              <ul className="help-list">
                <li><strong>Quick create objects</strong> — <Code>preset_sphere_block</Code>, <Code>preset_box_block</Code></li>
                <li><strong>Physics constants</strong> — <Code>physics_const_block</Code></li>
                <li><strong>Initial velocity</strong> — <Code>set_velocity_block</Code></li>
                <li><strong>Simulation setup</strong> — <Code>set_gravity_block</Code>, <Code>time_step_block</Code></li>
                <li><strong>Main loop</strong> — <Code>forever_loop_block</Code>, <Code>rate_block</Code>, <Code>update_position_block</Code>, <Code>apply_force_block</Code></li>
                <li><strong>Conditions</strong> — <Code>if_block</Code>, <Code>if_else_block</Code></li>
              </ul>

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

              <h3 className="help-h3">Quick Create <Tag color="blue">colour 210</Tag> <Tag color="green">beginner friendly</Tag></h3>
              <p className="help-tip">
                Quick-create blocks pack all object settings into a single block using inline
                number fields and a colour picker — no composable value slots required.
                Ideal for beginners building their first simulation.
              </p>
              <div className="help-block-table">
                <div className="help-block-row">
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
                <div className="help-block-row">
                  <div className="help-block-name">preset_box_block</div>
                  <div className="help-block-desc">
                    Create a box with all settings inline: variable name, position, width
                    \u00d7 height \u00d7 depth, and colour.
                    <Pre>wall = box(pos=vector(0, -1, 0), size=vector(10, 0.5, 10), color=vector(0.2, 0.4, 0.2))</Pre>
                    Great for floors, walls, and platforms. For opacity or expression-based sizing, use <Code>box_block</Code> instead.
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Scene Objects <Tag color="blue">colour 210</Tag></h3>
              <div className="help-block-table">
                <div className="help-block-row">
                  <div className="help-block-name">sphere_block</div>
                  <div className="help-block-desc">
                    Creates a basic VPython sphere assigned to a <strong>variable dropdown</strong> (native Blockly variable).
                    Position, radius, and colour are value sockets that accept snap-in blocks.
                    <Pre>ball = sphere(pos=vector(0,0,0), radius=1, color=vector(1,0,0))</Pre>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">sphere_trail_block</div>
                  <div className="help-block-desc">
                    Creates a sphere with a motion trail. All trail parameters are passed in the constructor as required by GlowScript 3.2.
                    Extra value sockets: <Code>trail_r</Code> (trail radius), <Code>trail_col</Code> (trail colour), <Code>retain</Code> (max trail points).
                    <Pre>ball = sphere(pos=vector(0,0.35,0), radius=0.28, color=...,{"\n"}       make_trail=True, trail_radius=0.035, trail_color=..., retain=260)</Pre>
                    <Note type="warning"><Code>make_trail=True</Code> must be set in the constructor. Use this block instead of <Code>sphere_block</Code> whenever you need a trail.</Note>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">sphere_emissive_block</div>
                  <div className="help-block-desc">
                    Creates a self-illuminating (glow) sphere with configurable <Code>opacity</Code>.
                    Used for stars, corona halos, and particle effects where the object should appear to emit light.
                    <Pre>sun = sphere(pos=vector(0,0,0), radius=1.05, color=..., emissive=True, opacity=1)</Pre>
                    <Note type="warning"><Code>emissive=True</Code> must be set in the constructor in GlowScript 3.2.</Note>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">box_block</div>
                  <div className="help-block-desc">
                    Creates a VPython box using composable value sockets for <Code>pos</Code>, <Code>size</Code>, and <Code>color</Code>.
                    <Pre>wall = box(pos=vector(0,0,0), size=vector(1,1,1), color=...)</Pre>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">box_opacity_block</div>
                  <div className="help-block-desc">
                    Creates a box with an <Code>opacity</Code> field (0 = invisible, 1 = solid). The position fields accept Python expressions
                    (e.g. <Code>mass.pos.x</Code>) so the box can be positioned relative to another object at creation time.
                    <Pre>shadow = box(pos=vector(mass.pos.x,-1.08,0), size=vector(1,0.01,1), color=..., opacity=0.45)</Pre>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">cylinder_block</div>
                  <div className="help-block-desc">
                    Creates a cylinder from <Code>pos</Code> to <Code>pos + axis</Code>. The axis vector determines both direction and length.
                    <Pre>rod = cylinder(pos=vector(0,0,0), axis=vector(4,0,0), radius=0.3)</Pre>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">arrow_block</div>
                  <div className="help-block-desc">
                    Creates a VPython arrow. The <Code>axis</Code> vector sets direction and length.
                    Ideal for visualising velocity, force, and acceleration vectors.
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">helix_block</div>
                  <div className="help-block-desc">
                    Creates a basic helix with <Code>pos</Code>, <Code>axis</Code>, and <Code>radius</Code>. Update <Code>axis</Code> each frame to animate stretch.
                    For springs that need specific <Code>coils</Code> and <Code>thickness</Code>, use <Code>helix_full_block</Code> instead.
                    <Pre>spring = helix(pos=anchor, axis=vector(L0,0,0), radius=0.3)</Pre>
                  </div>
                </div>
                <div className="help-block-row">
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
                <div className="help-block-row">
                  <div className="help-block-name">vector_block</div>
                  <div className="help-block-desc">
                    Creates a <Code>vector(x, y, z)</Code> value. Snap into pos, axis, size,
                    velocity, or colour slots on other blocks.
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">colour_block</div>
                  <div className="help-block-desc">
                    Pick a colour from a visual colour palette. Outputs a VPython
                    <Code>vector(r, g, b)</Code> colour. Snap into any colour slot.
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">expr_block</div>
                  <div className="help-block-desc">
                    Type any Python expression. Snaps into number, vector, or colour
                    slots. Useful for complex formulas — for common physics quantities
                    use the dedicated blocks below instead.
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">physics_const_block</div>
                  <div className="help-block-desc">
                    Insert a standard physics constant via a dropdown. Choose from:
                    <Pre>g = 9.81         (standard gravity, m/s\u00b2){"\n"}G = 6.674e-11    (gravitational constant){"\n"}\u03c0 = pi          (used directly in VPython){"\n"}e = 2.718         (Euler\u2019s number){"\n"}c = 3e8           (speed of light, m/s){"\n"}k\u2091 = 8.988e9   (Coulomb\u2019s constant){"\n"}h = 6.626e-34    (Planck\u2019s constant){"\n"}m\u2091 = 9.109e-31 (electron mass, kg){"\n"}m\u209a = 1.673e-27 (proton mass, kg)</Pre>
                    Snap into any numeric slot instead of typing raw values. Improves
                    readability and prevents transcription errors.
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Physics Expressions <Tag color="teal">colour 160</Tag></h3>
              <div className="help-block-table">
                <div className="help-block-row">
                  <div className="help-block-name">get_prop_block</div>
                  <div className="help-block-desc">
                    Read any property of an object variable. Set the variable name in the
                    left field and the attribute in the right field.
                    <Pre>ball.velocity   earth.pos   ball.radius</Pre>
                    Snap the result into any value slot, or chain into component/mag blocks.
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">get_component_block</div>
                  <div className="help-block-desc">
                    Get the <Code>x</Code>, <Code>y</Code>, or <Code>z</Code> scalar
                    component of a vector. Chain with <Code>get_prop_block</Code> — snap
                    <Code>ball.pos</Code> in and select <Code>y</Code> to get <Code>ball.pos.y</Code>.
                    <Pre>ball.pos.y   ball.velocity.x</Pre>
                    Snap the result into a <Code>logic_compare</Code> condition or math slot.
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">mag_block</div>
                  <div className="help-block-desc">
                    Magnitude (scalar length) of a vector. Chain with <Code>get_prop_block</Code>:
                    snap <Code>ball.velocity</Code> into the slot to get speed.
                    <Pre>mag(ball.velocity)  # → speed (scalar)</Pre>
                    <Note type="tip">Compare with a number using a Logic Compare block: <Code>mag(ball.velocity) &lt; 0.06</Code>.</Note>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">norm_block</div>
                  <div className="help-block-desc">
                    Unit vector in the direction of the input. Use to find the direction
                    of a displacement or force vector.
                    <Pre>norm(r_es)  # → direction from sun to earth</Pre>
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Motion / Physics <Tag color="yellow">colour 45</Tag></h3>
              <div className="help-block-table">
                <div className="help-block-row">
                  <div className="help-block-name">set_velocity_block</div>
                  <div className="help-block-desc">
                    Sets an object's initial velocity vector.
                    <Pre>ball.velocity = vector(10, 5, 0)</Pre>
                    VPython objects do not have a built-in <Code>.velocity</Code> property — this
                    creates a custom attribute that your loop must use to update position.
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">update_position_block</div>
                  <div className="help-block-desc">
                    <strong>Euler integration step</strong> — advances position by one time step.
                    <Pre>ball.pos = ball.pos + ball.velocity * dt</Pre>
                    Place inside a <Code>forever</Code> loop after updating velocity.
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">apply_force_block</div>
                  <div className="help-block-desc">
                    Applies a constant acceleration (force/mass) vector to an object's velocity.
                    <Pre>ball.velocity = ball.velocity + vector(fx, fy, fz) * dt</Pre>
                    The vector values are acceleration (m/s²), not force in N. Divide
                    your force by mass before entering it.
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">set_gravity_block</div>
                  <div className="help-block-desc">
                    Defines a gravity vector in the −Y direction.
                    <Pre>g = vector(0, -9.81, 0)</Pre>
                    Use this in your loop: <Code>ball.velocity = ball.velocity + g * dt</Code>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">set_scalar_block</div>
                  <div className="help-block-desc">
                    Assigns any Python expression to a variable chosen from a Blockly variable dropdown.
                    <Pre>m = 0.34</Pre>
                    The value field accepts any Python expression (e.g. <Code>pi * r**2</Code>).
                  </div>
                </div>

                <div className="help-block-row">
                  <div className="help-block-name">set_attr_expr_block</div>
                  <div className="help-block-desc">
                    One-line attribute assignment: <Code>object.attr = expr</Code>.
                    <Pre>ball.pos = vector(0, 0, 0)</Pre>
                    Very flexible — use for updating any object property.
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">add_attr_expr_block</div>
                  <div className="help-block-desc">
                    Attribute increment: <Code>object.attr += expr</Code>.
                    <Pre>ball.velocity = ball.velocity + acceleration * dt</Pre>
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Control <Tag color="purple">colour 260</Tag></h3>
              <div className="help-block-table">
                <div className="help-block-row">
                  <div className="help-block-name">forever_loop_block</div>
                  <div className="help-block-desc">
                    Wraps its body in <Code>while True:</Code>. Every VPython simulation needs exactly
                    one of these as the animation loop. Place all physics updates inside it.
                    <Pre>{`while True:\n    rate(200)\n    ball.pos = ball.pos + ball.velocity * dt`}</Pre>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">for_range_block</div>
                  <div className="help-block-desc">
                    A for-loop over a numeric range. Loop variable is a Blockly variable dropdown, plus
                    <Code>start</Code>, <Code>stop</Code>, and <Code>step</Code>.
                    Accepts nested blocks in its body. Used to create repeated objects (distance ticks, starfields, etc.).
                    <Pre>{`for i in range(0, 31, 5):\n    cylinder(pos=vector(i, 0, 0), axis=vector(0, 0.04, 0), ...)`}</Pre>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">if_block</div>
                  <div className="help-block-desc">
                    A conditional statement with a free-text condition field. Accepts nested blocks in its body.
                    Fully nestable — place an <Code>if_block</Code> inside another <Code>if_block</Code> body for nested conditions.
                    <Pre>{`if ball.pos.y < ball.radius:\n    ball.pos.y = ball.radius\n    if ball.velocity.y < 0:\n        ball.velocity.y = -0.55 * ball.velocity.y`}</Pre>
                    <Note type="tip">For complex boolean conditions (e.g. <Code>x &lt; 0 and mag(v) &lt; 0.1</Code>) type them directly into the condition field.</Note>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">if_else_block</div>
                  <div className="help-block-desc">
                    An if/else conditional with separate bodies for the true and false branches.
                    Fields: free-text <Code>condition</Code>, plus two block sockets (<Code>do</Code> and <Code>else</Code>).
                    Replaces raw Python ternary patterns in block templates.
                    <Pre>{`if stretch > 0:\n    spring.color = vector(1, 0.45, 0.15)\nelse:\n    spring.color = vector(0.3, 0.55, 1)`}</Pre>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">break_loop_block</div>
                  <div className="help-block-desc">
                    Emits a Python <Code>break</Code> statement. Place inside a <Code>forever_loop_block</Code>
                    (typically nested inside an <Code>if_block</Code>) to terminate the animation when
                    a stop condition is met.
                    <Pre>{`if mag(ball.velocity) < 0.08 and ball.pos.y <= ball.radius + 0.01:\n    break`}</Pre>
                    <Note type="info">Used in the Projectile template to stop the loop when the ball comes to rest.</Note>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">rate_block</div>
                  <div className="help-block-desc">
                    Throttles the loop to N iterations per second. This is <strong>essential</strong> — without
                    it the browser tab will freeze. Typical values: 100–500. Higher = smoother but more CPU.
                    <Pre>rate(240)</Pre>
                    <Note type="warning">Always place <Code>rate()</Code> as the first line inside a <Code>forever</Code> loop.</Note>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">time_step_block</div>
                  <div className="help-block-desc">
                    Defines the simulation time step <Code>dt</Code>.
                    <Pre>dt = 0.01  # seconds per step</Pre>
                    Smaller dt = more accurate but slower. Typical: 0.001–0.01 s for most simulations.
                  </div>
                </div>
              </div>

              <h3 className="help-h3">Utility <Tag color="pink">colour 330</Tag></h3>
              <div className="help-block-table">
                <div className="help-block-row">
                  <div className="help-block-name">local_light_block</div>
                  <div className="help-block-desc">
                    Adds a point light source at a given position.
                    <Pre>local_light(pos=vector(0, 10, 5), color=color.white)</Pre>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">label_block</div>
                  <div className="help-block-desc">
                    Creates a simple on-screen text label at a 3D position (white, no box, transparent background).
                    Update <Code>.text</Code> each frame using <Code>set_attr_expr_block</Code> for live telemetry.
                    <Pre>info = label(text="", pos=vector(5,8,0), box=False, opacity=0, color=color.white)</Pre>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">label_full_block</div>
                  <div className="help-block-desc">
                    Creates a named telemetry label with a configurable <Code>height</Code> field (font size in pixels).
                    Always outputs white text, no box, transparent background — the standard HUD style used in all built-in templates.
                    <Pre>telemetry = label(pos=vector(8.5, 9.2, 0), text="", height=12, box=False, opacity=0, color=color.white)</Pre>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">telemetry_update_block</div>
                  <div className="help-block-desc">
                    Updates a label variable's <Code>.text</Code> using up to 5 metric rows.
                    Each row is formatted as: <Code>name = round(value, dp) unit</Code>.
                    <Pre>{`telemetry.text = "t = " + str(round(t, 2)) + " s" + "\\n" + "speed = " + str(round(mag(ball.velocity), 2)) + " m/s"`}</Pre>
                    <Note type="tip">Leave metric name/value blank to skip that row.</Note>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">comment_block</div>
                  <div className="help-block-desc">
                    Emits a Python comment. Good for documenting block programs.
                    <Pre># This is a comment</Pre>
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">python_raw_block</div>
                  <div className="help-block-desc">
                    <strong>Power-user block</strong> — inserts any raw Python code as a statement.
                    Use when no specific block exists for what you need. Also supports multi-line
                    Python via <Code>\n</Code> in the field text. The built-in templates use this
                    block for scene setup (title, background, range) since those are raw property
                    assignments with no dedicated semantic block.
                  </div>
                </div>
                <div className="help-block-row">
                  <div className="help-block-name">python_raw_expr_block</div>
                  <div className="help-block-desc">
                    Like <Code>python_raw_block</Code> but acts as an <em>expression output</em>
                    (connectable to value sockets). Use to pass complex expressions like
                    <Code>mag(v)</Code> or <Code>norm(r_vec)</Code> into other blocks.
                  </div>
                </div>
              </div>
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
                  <tr><td>Blank Project</td><td>✅ Yes — Code View Only</td><td>Write VPython directly</td></tr>
                  <tr><td>Code Template</td><td>✅ Yes</td><td>Edit the pre-loaded simulation</td></tr>
                  <tr><td>Blocks Template</td><td>❌ Read-only mirror</td><td>Shows generated code</td></tr>
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
              <p>Physics IDE ships with three fully worked simulations available in both Code and Blocks modes.</p>
              <Note type="tip">
                All three Blocks templates are built entirely from semantic blocks — no <Code>python_raw_block</Code> is used.
                Every scene property, object constructor, for-loop, if-statement, and telemetry update
                has a dedicated block. This makes the templates fully inspectable and editable in the Block Editor.
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
            </section>

            {/* ══════════════ EXPORT ══════════════ */}
            <SectionAnchor id="export" />
            <section className="help-section">
              <SectionHeader id="export">Export &amp; Share</SectionHeader>
              <p>Physics IDE provides four export formats, all accessible from the toolbar.</p>
              <table className="help-table">
                <thead><tr><th>Button</th><th>Format</th><th>Contents</th><th>Best for</th></tr></thead>
                <tbody>
                  <tr>
                    <td><Tag color="blue">.py</Tag></td>
                    <td>Python file</td>
                    <td>The current VPython code (generated or written)</td>
                    <td>Running locally in a VPython desktop installation, sharing code</td>
                  </tr>
                  <tr>
                    <td><Tag color="purple">.xml</Tag></td>
                    <td>Blockly XML</td>
                    <td>Complete serialised block workspace</td>
                    <td>Saving and sharing block programs; restoring exact block layout</td>
                  </tr>
                  <tr>
                    <td><Tag color="teal">Blocks PDF</Tag></td>
                    <td>PDF image</td>
                    <td>Screenshot of the current block canvas</td>
                    <td>Assessment submissions, handouts, printed documentation</td>
                  </tr>
                  <tr>
                    <td><Tag color="teal">Code PDF</Tag></td>
                    <td>PDF document</td>
                    <td>Formatted VPython source code</td>
                    <td>Assessment submissions, code review printouts</td>
                  </tr>
                </tbody>
              </table>
              <Note type="tip">
                Students can submit both the <strong>.xml</strong> (block structure) and the
                <strong>Code PDF</strong> as a complete assignment package. Lecturers can reload the
                .xml to inspect the original block program.
              </Note>

              <h3 className="help-h3">Importing a saved workspace</h3>
              <p>
                To reload a <Code>.xml</Code> file: on the Start Menu, choose{" "}
                <strong>Blank Project</strong>, then use your browser to open the page and paste the
                XML into the block workspace via Blockly's built-in import (right-click the canvas →
                Import XML). A dedicated import button is planned for a future version.
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
                  installation required. Any device with a modern browser can run Physics IDE.
                </li>
                <li>
                  <strong>Export for assessment</strong> — PDF export (blocks and code) provides clean
                  submission artefacts.
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
                    <strong>Build from scratch</strong>
                    <p>Students create a custom simulation in a Blank Project — e.g. a bouncing ball,
                    pendulum, or electric field visualisation. Assessment via code PDF + blocks XML.</p>
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
                </tbody>
              </table>

              <h3 className="help-h3">Deploying to students</h3>
              <p>
                Physics IDE is a static React app. The production build can be deployed to any
                static hosting service (Vercel, Netlify, GitHub Pages, a school web server) with no
                server-side setup. Students access it via URL in any modern browser — no accounts,
                no downloads required.
              </p>
              <Pre>{`# Run locally:\nnpm install\nnpm start\n\n# Build for production:\nnpm run build\n\n# Deploy to Vercel:\nvercel --prod`}</Pre>
            </section>

            {/* ══════════════ SHORTCUTS ══════════════ */}
            <SectionAnchor id="shortcuts" />
            <section className="help-section">
              <SectionHeader id="shortcuts">Keyboard Shortcuts</SectionHeader>
              <table className="help-table">
                <thead><tr><th>Where</th><th>Shortcut</th><th>Action</th></tr></thead>
                <tbody>
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
                </tbody>
              </table>
            </section>

            <div className="help-footer">
              Physics IDE — Open source physics simulation environment · Built with React, Blockly & GlowScript 3.2 VPython
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
