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
});
