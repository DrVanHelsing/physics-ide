/**
 * Task 15 — Pause tells the truth.
 *
 * useTrace's postMessage listener now handles a second message type,
 * `__phpause`, alongside `__phtr`: an acknowledgement posted by the runtime
 * itself (glowRunner's injected checkpoint) rather than assumed the moment
 * the student clicks Pause. `paused:true` moves pauseState to "paused",
 * mirrors onto SimulationContext's `paused`, and cancels whatever fallback
 * timer useDebug's handlePause armed (see useDebug.test.js for the timer's
 * own arm/fire behaviour — this file only proves the ack clears it).
 * `paused:false` moves pauseState back to "running". Both `__phpause` and
 * `__phtr` carry `i` — the runtime's rate()-call counter — which lands in
 * TraceContext's `iteration`.
 *
 * Also covers Step 3: the 250 ms block-highlight-clear timer must not fire
 * while paused, since trace events (which would otherwise keep refreshing
 * it) stop arriving the moment the runtime actually stops.
 *
 * `../../utils/runner/glowRunner` is mocked — pausePython/setBreakpoints are
 * the only exports this hook (and DebugContext) touch; no real runtime frame
 * is needed for any of this.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import { SimulationProvider, useSimulationContext } from "../../contexts/SimulationContext";
import { DebugProvider, useDebugContext } from "../../contexts/DebugContext";
import { TraceProvider, useTraceContext } from "../../contexts/TraceContext";
import { useTrace } from "../useTrace";
import { HIGHLIGHT_DURATION_MS, TRACE_DEBOUNCE_MS } from "../../constants";

vi.mock("../../utils/runner/glowRunner", () => ({
  pausePython: vi.fn(),
  setBreakpoints: vi.fn(),
}));

let mounted = null;
let latestDebugCtx = null;
let latestTraceCtx = null;
let latestSimCtx = null;

function Consumer() {
  useTrace();
  latestDebugCtx = useDebugContext();
  latestTraceCtx = useTraceContext();
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

/** Dispatch a postMessage-shaped `message` event synchronously (inside act). */
function postMessage(data) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data }));
  });
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  latestDebugCtx = null;
  latestTraceCtx = null;
  latestSimCtx = null;
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useTrace — __phpause handling (Task 15)", () => {
  test("paused:true moves pauseState to 'paused', mirrors SimulationContext.paused, and reads the iteration", () => {
    mounted = mountComponent(<Wrapped />);

    postMessage({ type: "__phpause", paused: true, b: "block-1", i: 7 });

    expect(latestDebugCtx.pauseState).toBe("paused");
    expect(latestSimCtx.paused).toBe(true);
    expect(latestTraceCtx.iteration).toBe(7);
  });

  test("paused:false moves pauseState back to 'running' and clears SimulationContext.paused", () => {
    mounted = mountComponent(<Wrapped />);
    postMessage({ type: "__phpause", paused: true, i: 3 });
    expect(latestDebugCtx.pauseState).toBe("paused");

    postMessage({ type: "__phpause", paused: false });

    expect(latestDebugCtx.pauseState).toBe("running");
    expect(latestSimCtx.paused).toBe(false);
  });

  test("a paused:true ack cancels a pending fallback timer (the ack-timeout race useDebug's handlePause arms)", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    // Stand in for useDebug's handlePause arming the shared fallback timer:
    // same ref, same shape (see DebugContext's pauseAckTimerRef).
    act(() => {
      latestDebugCtx.pauseAckTimerRef.current = setTimeout(() => {
        latestSimCtx.setStatus({ text: "should not fire", type: "error" });
      }, 1000);
    });

    postMessage({ type: "__phpause", paused: true, i: 1 });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(latestSimCtx.status.text).not.toBe("should not fire");
  });

  test("__phtr also updates iteration", () => {
    mounted = mountComponent(<Wrapped />);
    postMessage({ type: "__phtr", n: "x", v: "1.5", b: "block-1", i: 12 });
    expect(latestTraceCtx.iteration).toBe(12);
  });
});

describe("useTrace — scope survives the message pipeline (Task 16 fix)", () => {
  /* Task 16's `__phtr` template gained `s:'<scope>'` alongside `n`/`v`/`b`/`i`
     so TraceContext.updateTrace can tag a Map entry `scope: "setup" | "loop" |
     "watch"`. That field only reaches TraceContext if useTrace's postMessage
     handler actually forwards it into the batch it hands `updateTrace` — a
     seam none of the instrumentor or TraceTable tests exercise, since both
     construct `entry.scope` by hand rather than going through this pipeline.
     These dispatch a REAL `message` event (not a direct __physide_trace_cb
     call) and advance past the debounce, so the whole path — postMessage →
     debounce batch → updateTrace → TraceContext Map — is proved end to end. */
  test("a __phtr message carrying s:'setup' lands in TraceContext with that scope", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    postMessage({ type: "__phtr", n: "m", v: "2.5", b: "line_2", s: "setup", i: 0 });
    act(() => { vi.advanceTimersByTime(TRACE_DEBOUNCE_MS); });

    expect(latestTraceCtx.traceData.get("m")?.scope).toBe("setup");
  });

  test("a __phtr message carrying s:'watch' lands in TraceContext with that scope", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    postMessage({ type: "__phtr", n: "0.5*k*x**2", v: "1.25", b: "watch_0", s: "watch", i: 0 });
    act(() => { vi.advanceTimersByTime(TRACE_DEBOUNCE_MS); });

    expect(latestTraceCtx.traceData.get("0.5*k*x**2")?.scope).toBe("watch");
  });

  test("a __phtr message with no s at all still defaults to 'loop' (back-compat with block-project checkpoints)", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    postMessage({ type: "__phtr", n: "t", v: "0.4", b: "line_9", i: 0 });
    act(() => { vi.advanceTimersByTime(TRACE_DEBOUNCE_MS); });

    expect(latestTraceCtx.traceData.get("t")?.scope).toBe("loop");
  });
});

describe("useTrace — highlight pins while paused (Task 15)", () => {
  test("while running, the 250ms timer still clears the highlight as before", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      window.__physide_trace_cb({ x: { v: "1", b: "block-1" } });
    });
    expect(latestDebugCtx.executingBlockId).toBe("block-1");

    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_DURATION_MS);
    });
    expect(latestDebugCtx.executingBlockId).toBe(null);
  });

  test("while paused, the 250ms timer must NOT clear the highlight", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebugCtx.setPauseState("paused");
    });
    act(() => {
      window.__physide_trace_cb({ x: { v: "1", b: "block-1" } });
    });
    expect(latestDebugCtx.executingBlockId).toBe("block-1");

    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_DURATION_MS * 4);
    });
    // Trace events stopped arriving (the runtime really did stop), but the
    // highlight must stay pinned at the block where execution stopped.
    expect(latestDebugCtx.executingBlockId).toBe("block-1");
  });

  test("resuming (pauseState back to 'running') lets the next highlight clear normally", () => {
    vi.useFakeTimers();
    mounted = mountComponent(<Wrapped />);

    act(() => {
      latestDebugCtx.setPauseState("paused");
    });
    act(() => {
      window.__physide_trace_cb({ x: { v: "1", b: "block-1" } });
    });
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_DURATION_MS);
    });
    expect(latestDebugCtx.executingBlockId).toBe("block-1"); // still pinned

    act(() => {
      latestDebugCtx.setPauseState("running");
    });
    act(() => {
      window.__physide_trace_cb({ x: { v: "2", b: "block-1" } }); // re-arms the timer
    });
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_DURATION_MS);
    });
    expect(latestDebugCtx.executingBlockId).toBe(null);
  });
});
