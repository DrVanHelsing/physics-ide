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
import { DebugProvider, useDebugContext } from "../../contexts/DebugContext";
import { TraceProvider, useTraceContext } from "../../contexts/TraceContext";
import { useSimulation } from "../useSimulation";

vi.mock("../../utils/runner/glowRunner", () => ({
  runPython: vi.fn(),
  stopPython: vi.fn(),
  setBreakpoints: vi.fn(),
  setRuntimeErrorSink: vi.fn(),
}));

import { runPython, setRuntimeErrorSink } from "../../utils/runner/glowRunner";

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
let latestDebug = null;
let latestTrace = null;

function Consumer() {
  latestSim = useSimulation();
  latestCtx = useSimulationContext();
  latestDebug = useDebugContext();
  latestTrace = useTraceContext();
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
  latestDebug = null;
  latestTrace = null;
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
    // describeRunError (Task 13) strips the "Execution error:" wrapper and
    // maps an unrecognised message to a plain-English fallback title.
    expect(latestCtx.status.text).toBe("The simulation stopped with an error.");
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

  test("a superseded run's late resolution cannot clear a newer run's booting state or overwrite its status", async () => {
    // Run is never disabled while booting (no gating on the button or the
    // hotkey), so an ordinary double Run-click starts a second handleRun
    // while the first is still awaiting a slow runPython. glowRunner's own
    // activeRunToken guard resolves a superseded call SILENTLY AS SUCCESS
    // (no throw) — without a React-level generation guard, that stale
    // resolution's own `finally` would clear `booting` while the newer run
    // is still in flight, reopening the exact blank-rectangle window this
    // whole feature exists to close.
    const runA = deferred();
    const runB = deferred();
    runPython.mockReturnValueOnce(runA.promise).mockReturnValueOnce(runB.promise);
    mounted = mountComponent(<Wrapped />);

    // Run A starts.
    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);

    // Run B starts before A has resolved — A is now stale/superseded.
    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);
    expect(latestCtx.status.text).toBe("Starting simulation…");

    // A (the stale run) resolves first. Its own "success" must not reach
    // through and clear `booting` or stomp the status B still owns.
    runA.resolve();
    await act(async () => {
      await flush();
    });
    expect(latestCtx.booting).toBe(true);
    expect(latestCtx.status.text).toBe("Starting simulation…");
    expect(latestCtx.status.type).toBe("");

    // B (the current run) resolves — only now does booting actually clear.
    runB.resolve();
    await act(async () => {
      await flush();
    });
    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.running).toBe(true);
    expect(latestCtx.status.type).toBe("success");
  });

  test("a superseded run's late rejection cannot clear a newer run's booting state or overwrite its status", async () => {
    const runA = deferred();
    const runB = deferred();
    runPython.mockReturnValueOnce(runA.promise).mockReturnValueOnce(runB.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestSim.handleRun();
    });
    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);

    // A (stale) fails. Its catch must not clear booting, flip running back
    // to false, or overwrite the status B still owns.
    runA.reject(new Error("Execution error: stale failure"));
    await act(async () => {
      await flush();
    });
    expect(latestCtx.booting).toBe(true);
    expect(latestCtx.running).toBe(true);
    expect(latestCtx.status.text).toBe("Starting simulation…");

    // B (current) succeeds afterward.
    runB.resolve();
    await act(async () => {
      await flush();
    });
    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.running).toBe(true);
    expect(latestCtx.status.type).toBe("success");
  });

  test("Stop bumps the generation, so a stale in-flight run cannot resurrect state after an explicit Stop", async () => {
    const run = deferred();
    runPython.mockReturnValueOnce(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);

    act(() => {
      latestSim.handleStop();
    });
    expect(latestCtx.running).toBe(false);
    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.status.text).toBe("Simulation stopped");

    // The stopped run's promise finally resolves — it must not reopen
    // running/booting or overwrite the "Simulation stopped" status.
    run.resolve();
    await act(async () => {
      await flush();
    });
    expect(latestCtx.running).toBe(false);
    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.status.text).toBe("Simulation stopped");
  });

  test("Home bumps the generation too, so a stale in-flight run cannot resurrect state after leaving for the start menu", async () => {
    // handleHome is a teardown path just like Stop/Reset — it must route
    // through the same endRun() so booting can never stick and a stale
    // settle can't write into a session that has moved on (T16 guard).
    const run = deferred();
    runPython.mockReturnValueOnce(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);

    act(() => {
      latestSim.handleHome();
    });
    expect(latestCtx.running).toBe(false);
    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.status.text).toBe("Ready");

    // The stale run's promise finally resolves — it must not reopen
    // running/booting or overwrite the "Ready" status this session moved on to.
    run.resolve();
    await act(async () => {
      await flush();
    });
    expect(latestCtx.running).toBe(false);
    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.status.text).toBe("Ready");
  });
});

describe("useSimulation — every load path ends the run (Task 13)", () => {
  test("importing an .xml file mid-boot clears booting and bumps the generation, same as handleStop", async () => {
    // Before Task 13, handleImport's .xml branch hand-rolled
    // `stopPython(...); setRunning(false);` — it never cleared `booting` or
    // bumped `runGenerationRef`, so a project imported while a run was still
    // booting could have a stale in-flight handleRun's finally reach through
    // afterward and flip `booting` back on. Routing through the same endRun()
    // handleStop uses closes that gap.
    const run = deferred();
    runPython.mockReturnValueOnce(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);
    const generationBeforeImport = latestCtx.runGenerationRef.current;

    const file = { name: "project.xml" };
    const OriginalFileReader = global.FileReader;
    class FakeFileReader {
      readAsText() {
        this.result = "<xml></xml>";
        this.onload?.({ target: this });
      }
    }
    global.FileReader = FakeFileReader;
    try {
      act(() => {
        latestSim.handleImport(file);
      });
    } finally {
      global.FileReader = OriginalFileReader;
    }

    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.running).toBe(false);
    expect(latestCtx.runGenerationRef.current).toBeGreaterThan(generationBeforeImport);

    // The stale run's promise finally resolves — it must not reopen
    // running/booting now that the import has moved the session on.
    run.resolve();
    await act(async () => {
      await flush();
    });
    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.running).toBe(false);
  });

  test("loadWorkspaceXml mid-boot clears booting and bumps the generation, same as handleStop", async () => {
    const run = deferred();
    runPython.mockReturnValueOnce(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);
    const generationBeforeLoad = latestCtx.runGenerationRef.current;

    act(() => {
      latestSim.loadWorkspaceXml("<xml></xml>");
    });

    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.running).toBe(false);
    expect(latestCtx.runGenerationRef.current).toBeGreaterThan(generationBeforeLoad);

    run.resolve();
    await act(async () => {
      await flush();
    });
    expect(latestCtx.booting).toBe(false);
    expect(latestCtx.running).toBe(false);
  });
});

describe("useSimulation — the async error sink respects run generation (Task 13 fix round)", () => {
  // The sink registered with glowRunner (setRuntimeErrorSink) is a single,
  // long-lived callback — it does not know which run an incoming async error
  // "belongs to". Without a staleness check of its own, a stray report that
  // surfaces from a run that has since been superseded by a newer run (or
  // torn down by Stop/Reset/Home) would stomp whatever now owns the screen:
  // flipping `running` false and overwriting the live status with an error.
  // The fix compares a "confirmed generation" (set only once a run's own
  // runPython call has resolved AND was not itself superseded) against the
  // live runGenerationRef, exactly mirroring handleRun's own catch-clause
  // staleness guard.

  test("a sink report for a superseded run does not stomp a newer, still-booting run", async () => {
    const runA = deferred();
    const runB = deferred();
    runPython.mockReturnValueOnce(runA.promise).mockReturnValueOnce(runB.promise);
    mounted = mountComponent(<Wrapped />);

    // Run A starts and reaches "confirmed live".
    act(() => {
      latestSim.handleRun();
    });
    runA.resolve();
    await act(async () => {
      await flush();
    });
    expect(latestCtx.status.type).toBe("success");

    // The sink is registered once, at mount — capture it.
    const sink = setRuntimeErrorSink.mock.calls[0][0];
    expect(typeof sink).toBe("function");

    // Run B starts (generation bumps) but has not yet resolved — nothing has
    // confirmed it live yet.
    act(() => {
      latestSim.handleRun();
    });
    expect(latestCtx.booting).toBe(true);
    expect(latestCtx.status.text).toBe("Starting simulation…");

    // A stray async report — as if it arrived late from A's now-superseded
    // run — must be dropped: it must not touch B's still-booting session.
    act(() => {
      sink(new Error("Runtime error: ghost from a superseded run"));
    });
    expect(latestCtx.running).toBe(true);
    expect(latestCtx.booting).toBe(true);
    expect(latestCtx.status.text).toBe("Starting simulation…");
    expect(latestCtx.status.type).toBe("");
  });

  test("a sink report for the current, confirmed generation is acted on", async () => {
    const run = deferred();
    runPython.mockReturnValueOnce(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestSim.handleRun();
    });
    run.resolve();
    await act(async () => {
      await flush();
    });
    expect(latestCtx.status.type).toBe("success");
    expect(latestCtx.running).toBe(true);

    const sink = setRuntimeErrorSink.mock.calls[0][0];

    // This run has genuinely reached "confirmed live" and no newer run has
    // started since — a report through the sink now must be believed.
    act(() => {
      sink(new Error("Runtime error: ZeroDivisionError: division by zero"));
    });
    expect(latestCtx.running).toBe(false);
    expect(latestCtx.status.type).toBe("error");
    expect(latestCtx.status.text).toBe("Something was divided by zero.");
  });
});

describe("useSimulation — breakpoints are seeded before eval, only in debug mode (Task 14)", () => {
  // handleRun used to call runPython(code, hostId) with no breakpoints at
  // all, then push the live set into the iframe AFTER runPython resolved —
  // by which point __main__() had already started the loop and the very
  // first iteration could never be caught. The fix passes the breakpoints
  // as a runPython option so glowRunner can seed them before eval.

  test("debug mode ON: runPython is called with the live breakpoint set", async () => {
    const run = deferred();
    runPython.mockReturnValue(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.setDebugMode(true);
      latestDebug.setBreakableIds(new Set(["blk-1"]));
    });
    act(() => {
      latestDebug.toggleBreakpoint("blk-1");
    });
    expect(latestDebug.breakpoints.has("blk-1")).toBe(true);

    act(() => {
      latestSim.handleRun();
    });

    expect(runPython).toHaveBeenCalledTimes(1);
    const [, , opts] = runPython.mock.calls[0];
    expect(opts.breakpoints).toEqual(new Set(["blk-1"]));

    run.resolve();
    await act(async () => {
      await flush();
    });
  });

  test("debug mode OFF: runPython gets an EMPTY breakpoint set even if breakpoints exist", async () => {
    // useDebug's exit deliberately keeps `breakpoints` (so re-entering debug
    // mode finds them again) — only debugMode gates whether they are armed.
    // Without this, leaving debug mode and pressing Run would freeze the
    // simulation on the first iteration with no PAUSED indicator anywhere.
    const run = deferred();
    runPython.mockReturnValue(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.setDebugMode(true);
      latestDebug.setBreakableIds(new Set(["blk-1"]));
    });
    act(() => {
      latestDebug.toggleBreakpoint("blk-1");
    });
    act(() => {
      latestDebug.setDebugMode(false);
    });
    expect(latestDebug.breakpoints.has("blk-1")).toBe(true); // kept, not cleared

    act(() => {
      latestSim.handleRun();
    });

    const [, , opts] = runPython.mock.calls[0];
    expect(opts.breakpoints).toEqual(new Set());

    run.resolve();
    await act(async () => {
      await flush();
    });
  });
});

/**
 * Task 17 — the watch box reaches the runtime.
 *
 * TraceContext's `addWatch` armed expressions and TraceTable rendered them,
 * but NOTHING read `watch` back out: handleRun is the only place that hands
 * opts to runPython, and it passed `breakpoints` alone. The whole watch
 * feature stopped at the context boundary. It is wired here — and, unlike
 * breakpoints, it is deliberately NOT debug-gated: "watch my numbers while I
 * work" is a plain-run gesture.
 */
describe("useSimulation — watch expressions reach runPython (Task 17)", () => {
  test("an armed watch is passed through as opts.watch", async () => {
    const run = deferred();
    runPython.mockReturnValue(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestTrace.addWatch("0.5*m*v**2");
    });

    act(() => {
      latestSim.handleRun();
    });

    expect(runPython).toHaveBeenCalledTimes(1);
    const [, , opts] = runPython.mock.calls[0];
    expect(opts.watch).toEqual(["0.5*m*v**2"]);

    run.resolve();
    await act(async () => {
      await flush();
    });
  });

  test("watches are not debug-gated — a plain run carries them too", async () => {
    const run = deferred();
    runPython.mockReturnValue(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestTrace.addWatch("ball.pos.y");
    });
    expect(latestDebug.debugMode).toBe(false);

    act(() => {
      latestSim.handleRun();
    });

    const [, , opts] = runPython.mock.calls[0];
    expect(opts.watch).toEqual(["ball.pos.y"]);
    expect(opts.breakpoints).toEqual(new Set()); // debug off: no breakpoints armed

    run.resolve();
    await act(async () => {
      await flush();
    });
  });

  test("with no watches armed, opts.watch is an empty array, never undefined", async () => {
    const run = deferred();
    runPython.mockReturnValue(run.promise);
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestSim.handleRun();
    });

    const [, , opts] = runPython.mock.calls[0];
    expect(opts.watch).toEqual([]);

    run.resolve();
    await act(async () => {
      await flush();
    });
  });
});
