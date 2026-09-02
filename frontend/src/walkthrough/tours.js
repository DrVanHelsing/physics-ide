/**
 * Guided tours — the walkthrough definitions (data only; the engine lives in
 * components/walkthrough/WalkthroughOverlay.js).
 *
 * Each tour runs in ONE UI context at a time ("menu" or "ide"); a step whose
 * `action` changes the context (opening a template, running the sim) executes
 * through the executor IDELayout supplies, and the engine simply keeps its
 * step index while the branch beneath it re-renders. Targets are CSS
 * selectors of real, stable product classes — a step whose target is not on
 * screen is skipped with a console.warn, never a crash, so a tour survives
 * cosmetic reworks of the surfaces it narrates.
 *
 * Every fundamental of the platform gets a tour (user order, 2026-09-02):
 * creating and running a simulation, blocks vs code, live graphs, debugging
 * and recording, data science, and project management. Classroom features
 * are documented in Help's "For Educators" section — they need a signed-in
 * account and a second role to demonstrate, which a spotlight tour on this
 * device cannot honestly stage.
 */

export const TOURS = [
  {
    id: "first-simulation",
    title: "Your first simulation",
    blurb: "From the start menu to a running 3D physics scene.",
    steps: [
      {
        target: ".start-card--goal",
        title: "Pick a goal",
        body: "A goal card creates a blank project instantly — Physics Modelling for 3D simulations, Data Science for datasets and charts, Hybrid for both. No forms first; you can rename the project later.",
      },
      {
        target: ".start-card--template",
        title: "Or start from a template",
        body: "Template cards are complete, working projects — projectile motion, springs, orbits, pendulums. One click opens the project ready to run. We will open one now.",
      },
      {
        action: "openTemplate:blocks_projectile",
        target: ".blocklyToolboxDiv",
        title: "The block toolbox",
        body: "Every physics idea is a block, grouped by colour: Objects for spheres and boxes, Motion for velocity and forces, Control for loops. Drag any block onto the canvas to use it.",
      },
      {
        target: ".block-search-bar",
        title: "Find any block",
        body: "Type here to search all the blocks at once instead of opening categories one by one.",
      },
      {
        target: ".sim-controls",
        title: "Run it",
        body: "Run starts the simulation — the blocks become VPython and execute in the 3D viewport. We will run it now.",
      },
      {
        action: "run",
        target: "#glowscript-host",
        title: "The 3D viewport",
        body: "The simulation is live. Drag to rotate the camera, scroll to zoom, right-drag to pan. The telemetry label updates every frame.",
      },
      {
        target: ".sim-controls",
        title: "Stop when done",
        body: "Stop ends the run and returns the viewport to rest. Change any block and run again — that loop is the whole workflow.",
        end: "stop",
      },
    ],
  },
  {
    id: "blocks-and-code",
    title: "Blocks and code",
    blurb: "The same physics, two views — and how they stay in sync.",
    steps: [
      {
        action: "openTemplate:blocks_spring",
        target: ".mode-toggle",
        title: "Two editors, one project",
        body: "The toggle switches between the Blocks editor and the Code editor. Blocks projects generate their Python live — switch any time to read what your blocks became.",
      },
      {
        action: "mode:code",
        target: ".mode-toggle",
        title: "The generated Python",
        body: "This is real VPython — the exact program the Run button executes. In a blocks project the code view is read-only, so the blocks always stay the source of truth.",
      },
      {
        action: "mode:blocks",
        target: ".blocklyToolboxDiv",
        title: "Back to blocks",
        body: "Edits happen here, and the Python follows. Code-first projects work the other way around: they open straight into an editable code editor.",
      },
    ],
  },
  {
    id: "live-graphs",
    title: "Live graphs",
    blurb: "Watch a quantity graph itself while the simulation runs.",
    steps: [
      {
        action: "openTemplate:blocks_pendulum_shm",
        target: ".blocklyToolboxDiv",
        title: "The Graphs category",
        body: "Three blocks draw graphs during a run: a graph display creates the chart, a series names a curve on it, and a plot point adds a value each frame inside the loop.",
      },
      {
        target: ".sim-controls",
        title: "Run the SHM pendulum",
        body: "This template graphs displacement, velocity and acceleration live. We will run it now — watch below the 3D scene.",
      },
      {
        action: "run",
        target: "#glowscript-host",
        title: "Scene above, graphs below",
        body: "The scene shares the pane with its graphs — the bob swings while the curves grow point by point. Read the period straight off the displacement curve: T = 2π√(L/g) ≈ 2.84 s.",
        end: "stop",
      },
    ],
  },
  {
    id: "debug-and-record",
    title: "Debug and record",
    blurb: "Pause the physics, inspect every variable, save a run as data.",
    steps: [
      {
        action: "openTemplate:blocks_pendulum",
        target: ".sim-controls",
        title: "Start a run first",
        body: "Debugging happens on a live simulation, so we will run the pendulum now.",
      },
      {
        action: "run",
        target: ".sim-controls",
        title: "Enter debug mode",
        body: "The Debug control appears while a run is live. It pauses the simulation and opens the trace drawer, where every variable streams frame by frame. Step forward one frame at a time, or set breakpoints on blocks.",
      },
      {
        target: "#glowscript-host",
        title: "Record a run",
        body: "In the trace drawer, Record captures the frames into a table. When you stop recording, the run becomes a dataset — chart it, or send it to the analysis side of a hybrid project. That is how simulation becomes data.",
        end: "stop",
      },
    ],
  },
  {
    id: "data-science",
    title: "Data science",
    blurb: "Datasets, statistics and charts — the other half of the IDE.",
    steps: [
      {
        action: "openTemplate:ds_penguins_stats",
        target: ".blocklyToolboxDiv",
        title: "Data science blocks",
        body: "A Data Science project swaps the 3D viewport for the Data panel. The blocks load datasets, filter and group rows, compute statistics, fit regressions, and draw charts.",
      },
      {
        target: ".data-panel, .ds-table-wrapper",
        title: "The Data panel",
        body: "Results render here as the blocks execute: tables, summary statistics, and charts. Edit any block and the whole analysis re-runs.",
      },
    ],
  },
  {
    id: "projects-and-saving",
    title: "Projects and saving",
    blurb: "Where your work lives, and how to name, save and reopen it.",
    steps: [
      {
        action: "openTemplate:blocks_projectile",
        target: "button.project-title",
        title: "Name your project",
        body: "Click the title in the header to rename it. Everything is saved on this computer automatically as you work.",
      },
      {
        target: ".tb-btn--save",
        title: "Save on demand",
        body: "Save writes the project immediately — the status bar confirms it. Signed-in users also sync to the classroom server, so work follows you between devices.",
      },
      {
        target: ".tb-btn--nav",
        title: "Back to the menu",
        body: "The Menu button returns to the start menu, where the Continue list holds every saved project — most recent first. The small × on a row deletes a project, with a confirmation.",
      },
    ],
  },
];

export function getTour(id) {
  return TOURS.find((t) => t.id === id) || null;
}
