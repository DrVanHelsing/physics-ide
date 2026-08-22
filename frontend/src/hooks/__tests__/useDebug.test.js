/**
 * Task 15 — pauseState is a three-state machine ("running" | "pausing" |
 * "paused") owned by DebugContext, not a boolean useDebug flips optimistically
 * the moment Pause is clicked. handlePause moves to "pausing" and arms a
 * PAUSE_ACK_TIMEOUT_MS fallback: if the runtime's __phpause ack never arrives
 * (a program with no traced values never reaches a checkpoint — see
 * glowRunner's injected checkpoint), the fallback resumes the simulation and
 * surfaces an honest error instead of leaving a PAUSED badge lit over a
 * simulation that never stopped. handleResume cancels that fallback directly;
 * the ack itself (postMessage handling) is covered in useTrace.test.js.
 *
 * `../../utils/runner/glowRunner` is mocked: none of these tests need a real
 * runtime frame, only the calls useDebug makes into it.
 *
 * Fix round 1 (code review): the ack-timeout fallback is shared by
 * handlePause AND handleStepFrame (armPauseAckTimeout), and both capture
 * `runGenerationRef.current` when armed and bail in the callback if it no
 * longer matches — otherwise a stale timer from a session the student has
 * already left (exit debug, a fresh Run) fires ~1s later against whatever
 * now owns the screen. handleStepFrame needed the fallback in the first
 * place: a program with no traced values never reaches a checkpoint from
 * "Next frame" either, so without it pauseState would stick at "pausing"
 * forever — the exact bug class this task exists to fix.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import { SimulationProvider, useSimulationContext } from "../../contexts/SimulationContext";
import { DebugProvider, useDebugContext } from "../../contexts/DebugContext";
import { TraceProvider } from "../../contexts/TraceContext";
import { useDebug } from "../useDebug";
import { PAUSE_ACK_TIMEOUT_MS } from "../../constants";

vi.mock("../../utils/runner/glowRunner", () => ({
  runPython: vi.fn(),
  stopPython: vi.fn(),
  setRuntimeErrorSink: vi.fn(),
  setBreakpoints: vi.fn(),
  pausePython: vi.fn(),
  resumePython: vi.fn(),
  stepPython: vi.fn(),
  stepFrame: vi.fn(),
}));

import {
  pausePython,
  resumePython,
  stepPython,
  stepFrame,
  stopPython,
} from "../../utils/runner/glowRunner";

let mounted = null;
let latestDebug = null;
let latestDebugCtx = null;
let latestSimCtx = null;

function Consumer() {
  latestDebug = useDebug();
  latestDebugCtx = useDebugContext();
  latestSimCtx = useSimulationContext();
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
  latestDebug = null;
  latestDebugCtx = null;
  latestSimCtx = null;
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useDebug — pauseState state machine (Task 15)", () => {
  test("starts 'running'", () => {
    mounted = mountComponent(<Wrapped />);
    expect(latestDebugCtx.pauseState).toBe("running");
  });

  test("handlePause moves to 'pausing' immediately and calls pausePython", () => {
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.handlePause();
    });

    expect(pausePython).toHaveBeenCalledTimes(1);
    expect(latestDebugCtx.pauseState).toBe("pausing");
  });

  test("handleStepFrame moves to 'pausing' and calls stepFrame, never stepPython", () => {
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.handleStepFrame();
    });

    expect(stepFrame).toHaveBeenCalledTimes(1);
    expect(stepPython).not.toHaveBeenCalled();
    expect(latestDebugCtx.pauseState).toBe("pausing");
  });

  test("handleStep (Next value) is untouched by the pauseState machine — only the runtime's own ack changes it", () => {
    mounted = mountComponent(<Wrapped />);
    act(() => {
      latestDebugCtx.setPauseState("paused");
    });

    act(() => {
      latestDebug.handleStep();
    });

    expect(stepPython).toHaveBeenCalledTimes(1);
    expect(latestSimCtx.paused).toBe(true);
    expect(latestDebugCtx.pauseState).toBe("paused");
  });

  test("no ack within PAUSE_ACK_TIMEOUT_MS: resumes, tells the student why, and stops claiming paused", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.handlePause();
    });
    expect(latestDebugCtx.pauseState).toBe("pausing");

    act(() => {
      vi.advanceTimersByTime(PAUSE_ACK_TIMEOUT_MS);
    });

    expect(resumePython).toHaveBeenCalledTimes(1);
    expect(latestDebugCtx.pauseState).toBe("running");
    expect(latestSimCtx.paused).toBe(false);
    expect(latestSimCtx.status.type).toBe("error");
    expect(latestSimCtx.status.text).toBe(
      "Can't pause this simulation — it has no traced values.",
    );
  });

  test("handleResume before the timeout cancels the fallback — no error, no second resumePython call", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.handlePause();
    });
    act(() => {
      latestDebug.handleResume();
    });
    expect(resumePython).toHaveBeenCalledTimes(1);
    expect(latestDebugCtx.pauseState).toBe("running");
    expect(latestSimCtx.paused).toBe(false);

    act(() => {
      vi.advanceTimersByTime(PAUSE_ACK_TIMEOUT_MS);
    });

    // The fallback must not have fired a second time, and must not have
    // overwritten status with the "no traced values" error.
    expect(resumePython).toHaveBeenCalledTimes(1);
    expect(latestSimCtx.status.type).not.toBe("error");
  });

  test("pressing Pause twice re-arms the fallback rather than stacking two timers", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.handlePause();
    });
    act(() => {
      vi.advanceTimersByTime(PAUSE_ACK_TIMEOUT_MS / 2);
    });
    act(() => {
      latestDebug.handlePause(); // re-armed — the first timer must be cleared
    });
    act(() => {
      vi.advanceTimersByTime(PAUSE_ACK_TIMEOUT_MS / 2);
    });
    // Only PAUSE_ACK_TIMEOUT_MS/2 has elapsed since the SECOND call — if the
    // first timer had not been cleared, it would have already fired here.
    expect(resumePython).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(PAUSE_ACK_TIMEOUT_MS / 2);
    });
    expect(resumePython).toHaveBeenCalledTimes(1);
  });

  test("exiting debug mode before the timeout clears the pending fallback (Task 17)", () => {
    /* Task 17 made exit a RESUME, not a teardown: it no longer calls endRun,
       so it no longer bumps runGenerationRef and the generation guard alone
       would not save it — a timer armed a moment ago still matches the live
       generation. Clearing pauseAckTimerRef on exit is therefore load-bearing,
       not hygiene: without it the fallback would fire its "no traced values"
       error over the simulation this very call just resumed. */
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.handlePause();
    });
    expect(latestDebugCtx.pauseState).toBe("pausing");

    act(() => {
      latestDebug.handleExitDebug();
    });
    // The exit itself resumes — exactly once.
    expect(resumePython).toHaveBeenCalledTimes(1);
    expect(latestDebugCtx.pauseState).toBe("running");
    expect(latestSimCtx.paused).toBe(false);

    act(() => {
      vi.advanceTimersByTime(PAUSE_ACK_TIMEOUT_MS);
    });

    // No SECOND resume from a fallback that should have been cleared, and no
    // error clobbering the status handleExitDebug itself set.
    expect(resumePython).toHaveBeenCalledTimes(1);
    expect(latestSimCtx.status.type).not.toBe("error");
  });

  test("a fresh Run (runGenerationRef bumped directly) before the timeout also cancels the stale fallback", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.handlePause();
    });

    // Simulate handleRun's own teardown path bumping the shared generation
    // counter (see SimulationContext / useSimulation's endRun) without going
    // through handleExitDebug specifically — the guard is generation-based,
    // not tied to any one teardown path.
    act(() => {
      latestSimCtx.runGenerationRef.current += 1;
    });

    act(() => {
      vi.advanceTimersByTime(PAUSE_ACK_TIMEOUT_MS);
    });

    expect(resumePython).not.toHaveBeenCalled();
    expect(latestSimCtx.status.type).not.toBe("error");
  });
});

describe("useDebug — handleStepFrame gets the same honest ack-timeout fallback (Task 15 fix round 1)", () => {
  test("no ack within PAUSE_ACK_TIMEOUT_MS: resumes, tells the student why, and stops claiming paused", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.handleStepFrame();
    });
    expect(latestDebugCtx.pauseState).toBe("pausing");

    act(() => {
      vi.advanceTimersByTime(PAUSE_ACK_TIMEOUT_MS);
    });

    expect(resumePython).toHaveBeenCalledTimes(1);
    expect(latestDebugCtx.pauseState).toBe("running");
    expect(latestSimCtx.paused).toBe(false);
    expect(latestSimCtx.status.type).toBe("error");
    expect(latestSimCtx.status.text).toBe(
      "Can't pause this simulation — it has no traced values.",
    );
  });

  test("an ack (simulated by clearing pauseAckTimerRef, as useTrace's handler does) cancels the fallback", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.handleStepFrame();
    });
    act(() => {
      if (latestDebugCtx.pauseAckTimerRef.current) {
        clearTimeout(latestDebugCtx.pauseAckTimerRef.current);
      }
      latestDebugCtx.setPauseState("paused");
    });

    act(() => {
      vi.advanceTimersByTime(PAUSE_ACK_TIMEOUT_MS);
    });

    expect(resumePython).not.toHaveBeenCalled();
    expect(latestDebugCtx.pauseState).toBe("paused");
    expect(latestSimCtx.status.type).not.toBe("error");
  });

  test("leaving debug mode cancels handleStepFrame's fallback exactly like handlePause's", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.handleStepFrame();
    });
    act(() => {
      latestDebug.handleExitDebug();
    });
    act(() => {
      vi.advanceTimersByTime(PAUSE_ACK_TIMEOUT_MS);
    });

    // One resume — the exit's own. The armed fallback was cleared with it.
    expect(resumePython).toHaveBeenCalledTimes(1);
    expect(latestSimCtx.status.type).not.toBe("error");
  });

  test("a stale generation (a fresh Run) still cancels the fallback", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebug.handleStepFrame();
    });
    act(() => {
      latestSimCtx.runGenerationRef.current += 1; // handleRun's own teardown
    });
    act(() => {
      vi.advanceTimersByTime(PAUSE_ACK_TIMEOUT_MS);
    });

    expect(resumePython).not.toHaveBeenCalled();
    expect(latestSimCtx.status.type).not.toBe("error");
  });
});

/**
 * Task 17 — debug is a MODE of the shell. Entering used to call endRun (stop
 * the runtime, bump the generation) while HelpPage promised "the simulation
 * pauses immediately", so a student who clicked Debug mid-run landed on a
 * blank black rectangle. Entering now pauses; leaving resumes. Neither is a
 * teardown any more, and both reset pauseState so a mid-pause exit cannot
 * leave a stale "pausing"/"paused" behind.
 */
describe("useDebug — entering pauses, leaving resumes (Task 17)", () => {
  test("entering while a run is live pauses it — it never stops it", () => {
    mounted = mountComponent(<Wrapped />);
    act(() => {
      latestSimCtx.setRunning(true);
    });

    act(() => {
      latestDebug.handleEnterDebug();
    });

    expect(stopPython).not.toHaveBeenCalled();
    expect(pausePython).toHaveBeenCalledTimes(1);
    expect(latestSimCtx.running).toBe(true);
    expect(latestDebugCtx.debugMode).toBe(true);
    expect(latestDebugCtx.pauseState).toBe("pausing");
  });

  test("entering with nothing running resets a stale pauseState instead of inheriting it", () => {
    mounted = mountComponent(<Wrapped />);
    act(() => {
      latestDebugCtx.setPauseState("paused");
      latestSimCtx.setPaused(true);
    });

    act(() => {
      latestDebug.handleEnterDebug();
    });

    expect(pausePython).not.toHaveBeenCalled(); // nothing to pause
    expect(latestDebugCtx.pauseState).toBe("running");
    expect(latestSimCtx.paused).toBe(false);
    expect(latestDebugCtx.debugMode).toBe(true);
  });

  test("leaving resumes, resets pauseState, and does not tear the run down", () => {
    mounted = mountComponent(<Wrapped />);
    act(() => {
      latestSimCtx.setRunning(true);
    });
    act(() => {
      latestDebug.handlePause();
    });
    act(() => {
      latestDebugCtx.setPauseState("paused"); // the runtime acknowledged
      latestSimCtx.setPaused(true);
    });

    act(() => {
      latestDebug.handleExitDebug();
    });

    expect(resumePython).toHaveBeenCalledTimes(1);
    expect(stopPython).not.toHaveBeenCalled();
    expect(latestSimCtx.running).toBe(true);
    expect(latestDebugCtx.pauseState).toBe("running");
    expect(latestSimCtx.paused).toBe(false);
    expect(latestDebugCtx.debugMode).toBe(false);
    expect(latestSimCtx.status.text).toBe("Simulation running");
  });

  test("leaving with nothing running says Ready, not Simulation running", () => {
    mounted = mountComponent(<Wrapped />);
    act(() => {
      latestDebug.handleExitDebug();
    });
    expect(latestSimCtx.status.text).toBe("Ready");
  });
});
