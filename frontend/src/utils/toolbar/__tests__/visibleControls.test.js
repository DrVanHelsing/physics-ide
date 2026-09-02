import { describe, test, expect } from "vitest";
import { visibleControls } from "../visibleControls";

const base = { mode: "blocks", goal: "physics", role: "user", isTeacher: false, runState: "idle" };
const v = (over) => visibleControls({ ...base, ...over });

describe("visibleControls", () => {
  /* The header no longer carries run/stop at ANY run state — every sim
     control moved to the viewport pane header (components/SimControls.js),
     as one toggle rather than two mutually-exclusive buttons. Asserted
     across the whole lifecycle so a re-introduction here fails loudly. */
  test("the header carries no run/stop at any point in the lifecycle", () => {
    for (const runState of ["idle", "booting", "running"]) {
      const out = v({ runState });
      expect(out.primary).toEqual(["modeToggle"]);
      for (const zone of Object.values(out)) {
        expect(zone).not.toContain("run");
        expect(zone).not.toContain("stop");
      }
    }
  });
  test("datascience goal hides every sim control", () => {
    const out = v({ goal: "datascience", runState: "running" });
    expect(out.primary).toEqual(["modeToggle"]);
    expect(out.view).not.toContain("viewport");
    expect(out.view).not.toContain("trace");
    expect(out.view).not.toContain("debug");
  });
  test("hybrid goal behaves like physics", () => {
    // Both sim goals get the viewport/trace/debug view slots; neither gets
    // run/stop in the header any more, so the view zone is the tell.
    expect(v({ goal: "hybrid" }).view).toContain("viewport");
    expect(v({ goal: "hybrid", runState: "running" }).view).toEqual(
      v({ goal: "physics", runState: "running" }).view,
    );
  });
  test("zoom never appears in any configuration", () => {
    for (const goal of ["physics", "datascience", "hybrid"])
      for (const runState of ["idle", "booting", "running"])
        for (const mode of ["blocks", "text"])
          for (const zone of Object.values(v({ goal, runState, mode })))
            expect(zone).not.toContain("zoom");
  });
  test("trace/debug slots exist only while a sim is live", () => {
    expect(v({ runState: "idle" }).view).not.toContain("trace");
    expect(v({ runState: "booting" }).view).toEqual(expect.arrayContaining(["trace", "debug"]));
    expect(v({ runState: "running" }).view).toEqual(expect.arrayContaining(["trace", "debug"]));
  });

  /* Task 17: "only while live" alone would let Stop strand a student inside
     debug mode — Exit Debug would leave the header with the run — and would
     orphan a drawer the student opened themselves. Their own state keeps them
     on screen past the end of the run. */
  test("debug survives the end of the run while debug mode is on", () => {
    expect(v({ runState: "idle", debugMode: true }).view).toContain("debug");
    expect(v({ runState: "idle", debugMode: false }).view).not.toContain("debug");
  });

  test("trace survives the end of the run while the drawer is open", () => {
    expect(v({ runState: "idle", traceVisible: true }).view).toContain("trace");
    expect(v({ runState: "idle", debugMode: true }).view).toContain("trace");
    expect(v({ runState: "idle" }).view).not.toContain("trace");
  });

  test("neither axis resurrects them for a datascience project", () => {
    const out = v({ goal: "datascience", runState: "idle", debugMode: true, traceVisible: true });
    expect(out.view).not.toContain("trace");
    expect(out.view).not.toContain("debug");
  });

  test("trace still precedes debug in the view zone", () => {
    const view = v({ runState: "running" }).view;
    expect(view.indexOf("trace")).toBeLessThan(view.indexOf("debug"));
  });
  test("clear is blocks-mode only; help always; reset ONLY as the analyse return (Plan 10 win 3)", () => {
    expect(v({ mode: "text" }).view).not.toContain("clear");
    expect(v({ mode: "blocks" }).view).toContain("clear");
    for (const mode of ["blocks", "text"]) {
      expect(v({ mode }).view).toContain("help");
      // The old unconditional "Back to Blocks" duplicated the mode toggle.
      expect(v({ mode }).view).not.toContain("reset");
      expect(v({ mode, analysisReturn: true }).view).toContain("reset");
    }
  });
  test("guest sees sign-in, others the account chip; file basics always", () => {
    expect(v({ role: "guest" }).file).toContain("signIn");
    expect(v({ role: "guest" }).file).not.toContain("account");
    expect(v({ role: "user" }).file).toContain("account");
    expect(v({ role: "admin" }).file).toContain("account");
    for (const role of ["guest", "user", "admin"])
      expect(v({ role }).file).toEqual(expect.arrayContaining(["save", "fileMenu", "themeToggle"]));
  });
});

/* Task 12: the pure axis. `rules` is one new optional field — every other
   axis keeps behaving exactly as tested above. rules:null (no assignment
   context, or an assignment with no rules) must be byte-identical to rules
   being absent entirely, for every combination this module's other axes
   produce — that is the contract the item-level Toolbar/ViewportControls
   gating is built on top of. */
describe("visibleControls — workspace rules axis (Task 12)", () => {
  const GOALS = ["physics", "datascience", "hybrid"];
  const MODES = ["blocks", "text"];
  const RUN_STATES = ["idle", "booting", "running"];
  const ROLES = ["guest", "user", "admin"];
  const BOOL = [false, true];

  const OPEN = {
    editors: "both", debug: true, importFiles: true,
    exportAndCopy: true, advancedBlocks: true, templates: true,
  };
  const LOCKED = {
    editors: "blocks", debug: false, importFiles: false,
    exportAndCopy: false, advancedBlocks: false, templates: false,
  };

  test("rules: null is byte-identical to rules absent, across goal × mode × runState × role × debugMode × traceVisible", () => {
    for (const goal of GOALS)
      for (const mode of MODES)
        for (const runState of RUN_STATES)
          for (const role of ROLES)
            for (const debugMode of BOOL)
              for (const traceVisible of BOOL) {
                const axes = { mode, goal, role, isTeacher: false, runState, debugMode, traceVisible };
                expect(visibleControls({ ...axes, rules: null })).toEqual(visibleControls(axes));
              }
  });

  test('editors:"blocks" empties the primary zone — no modeToggle', () => {
    expect(v({ rules: { ...OPEN, editors: "blocks" } }).primary).toEqual([]);
  });

  test('editors:"code" empties the primary zone too', () => {
    expect(v({ rules: { ...OPEN, editors: "code" } }).primary).toEqual([]);
  });

  test('editors:"both" keeps modeToggle, exactly like rules absent', () => {
    expect(v({ rules: { ...OPEN, editors: "both" } }).primary).toEqual(["modeToggle"]);
  });

  test("debug:false beats both keep-alive axes — debugMode and traceVisible cannot resurrect it", () => {
    const rules = { ...OPEN, debug: false };
    expect(v({ runState: "idle", debugMode: true, rules }).view).not.toContain("debug");
    expect(v({ runState: "idle", traceVisible: true, debugMode: true, rules }).view).not.toContain("debug");
    expect(v({ runState: "running", debugMode: true, traceVisible: true, rules }).view).not.toContain("debug");
    // debug:true (or rules absent) is unaffected — the keep-alive axes still work.
    expect(v({ runState: "idle", debugMode: true, rules: { ...OPEN, debug: true } }).view).toContain("debug");
  });

  test("rules touch NOTHING else — trace/reset/clear/help and the whole file zone are unchanged (fileMenu gating is item-level in Toolbar, not key-level)", () => {
    for (const goal of GOALS)
      for (const mode of MODES)
        for (const runState of RUN_STATES)
          for (const role of ROLES) {
            const axes = { mode, goal, role, isTeacher: false, runState, debugMode: true, traceVisible: true };
            const locked = visibleControls({ ...axes, rules: LOCKED });
            const open = visibleControls(axes);
            // Every view-zone key except "debug" (already covered above) is unchanged.
            expect(locked.view.filter((k) => k !== "debug")).toEqual(open.view.filter((k) => k !== "debug"));
            // save/fileMenu themselves always stay — the LOCKED rules set turns
            // off importFiles/exportAndCopy, which must not remove them here.
            expect(locked.file).toEqual(open.file);
          }
  });
});
