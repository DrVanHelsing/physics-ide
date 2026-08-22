import { describe, test, expect } from "vitest";
import { visibleControls } from "../visibleControls";

const base = { mode: "blocks", goal: "physics", role: "user", isTeacher: false, runState: "idle" };
const v = (over) => visibleControls({ ...base, ...over });

describe("visibleControls", () => {
  test("run/stop lifecycle", () => {
    expect(v({ runState: "idle" }).primary).toEqual(["run", "modeToggle"]);
    expect(v({ runState: "booting" }).primary).toEqual(["run", "stop", "modeToggle"]);
    expect(v({ runState: "running" }).primary).toEqual(["stop", "modeToggle"]);
  });
  test("datascience goal hides every sim control", () => {
    const out = v({ goal: "datascience", runState: "running" });
    expect(out.primary).toEqual(["modeToggle"]);
    expect(out.view).not.toContain("viewport");
    expect(out.view).not.toContain("trace");
    expect(out.view).not.toContain("debug");
  });
  test("hybrid goal behaves like physics", () => {
    expect(v({ goal: "hybrid" }).primary).toContain("run");
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
  test("clear is blocks-mode only; help and reset always", () => {
    expect(v({ mode: "text" }).view).not.toContain("clear");
    expect(v({ mode: "blocks" }).view).toContain("clear");
    for (const mode of ["blocks", "text"]) {
      expect(v({ mode }).view).toContain("help");
      expect(v({ mode }).view).toContain("reset");
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
