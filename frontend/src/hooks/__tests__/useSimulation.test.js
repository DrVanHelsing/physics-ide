/**
 * Task 16 — the `booting` phase between Run and the first frame.
 *
 * `handleRun` flips `running` true synchronously (so the UI can disable the
 * Run button) but only resolves `runPython` once the runtime has actually
 * loaded, compiled and rendered a first frame — that gap used to have no
 * dedicated state, so pressing Run replaced the idle placeholder with a
 * blank rectangle for however long six CDN scripts take to load. `booting`
 * exists to cover exactly that window, and per the "no control reports
 * success it cannot verify" constraint it must clear only when runPython's
 * awaited promise actually settles — success or failure — never on a timer.
 *
 * `../../utils/runner/glowRunner` is mocked so the test can hold `runPython`
 * open on a controlled promise and resolve/reject it on its own schedule.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import { SimulationProvider, useSimulationContext } from "../../contexts/SimulationContext";
import { DebugProvider } from "../../contexts/DebugContext";
import { TraceProvider } from "../../contexts/TraceContext";
import { useSimulation } from "../useSimulation";

vi.mock("../../utils/runner/glowRunner", () => ({
  runPython: vi.fn(),
  stopPython: vi.fn(),
  setBreakpoints: vi.fn(),
}));

import { runPython } from "../../utils/runner/glowRunner";

/** A promise this test can resolve/reject on its own schedule. */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Flush pending microtasks (promise chains) via a real macrotask tick. */
const flush = () => new Promise((r) => setTimeout(r, 0));

let mounted = null;
let latestSim = null;
let latestCtx = null;

function Consumer() {
  latestSim = useSimulation();
  latestCtx = useSimulationContext();
  return null;
}

function Wrapped() {
  return (
    <SimulationProvider>
      <DebugProvider>
        <TraceProvider>
          <Consumer />
        </TraceProvider>
      </DebugProvider>
    </SimulationProvider>
  );
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  latestSim = null;
  latestCtx = null;
  vi.clearAllMocks();
});

describe("useSimulation — booting phase", () => {
  test("Run acknowledges immediately: running and booting both flip true before runPython settles", () => {
    const run = deferred();
    runPython.mockReturnValue(run.promise);
    mounted = mountComponent(<Wrapped />);

    expect(latestCtx.running).toBe(false);
    expect(latestCtx.booting).toBe(false);

    act(() => {
      latestSim.handleRun();
    });

    expect(latestCtx.running).toBe(true);
    expect(latestCtx.booting).toBe(true);
    expect(latestCtx.status.text).toBe("Starting simulation…");
  });

  test("a successful boot clears booting the moment runPython resolves, leaving running true", async () => {
    const run = deferred();
    runPython.mockReturnValue(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);

    run.resolve();
    await act(async () => {
      await flush();
    });

    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.running).toBe(true);
    expect(latestCtx.status.type).toBe("success");
  });

  test("a failed boot clears booting and surfaces the failure through the existing status/error path — it never sticks", async () => {
    const run = deferred();
    runPython.mockReturnValue(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);

    run.reject(new Error("Execution error: no canvas"));
    await act(async () => {
      await flush();
    });

    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.running).toBe(false);
    expect(latestCtx.status.type).toBe("error");
    expect(latestCtx.status.text).toBe("Execution error: no canvas");
  });

  test("Stop clears booting even mid-boot, so it never sticks true past a Stop click", () => {
    const run = deferred();
    runPython.mockReturnValue(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);

    act(() => {
      latestSim.handleStop();
    });

    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.running).toBe(false);
  });

  test("Reset to blocks clears booting even mid-boot", () => {
    const run = deferred();
    runPython.mockReturnValue(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);

    act(() => {
      latestSim.handleResetToBlocks();
    });

    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.running).toBe(false);
  });
});
