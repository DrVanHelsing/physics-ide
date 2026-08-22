/**
 * Task 14 — breakableIds/isBreakable on DebugContext, and the toggleBreakpoint
 * guard that stops a breakpoint from ever being SET on a block that can never
 * pause (while still letting an old project's stale breakpoint be REMOVED).
 *
 * `../../utils/runner/glowRunner`'s setBreakpoints is a real, un-mocked
 * no-op here: it only touches an active runtime frame, and no run is active
 * in these tests, so it is safe to leave un-mocked (matches how DebugContext
 * itself uses it — see the `breakpoints` effect).
 */
import { describe, test, expect, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import { DebugProvider, useDebugContext } from "../DebugContext";

let mounted = null;
let latestCtx = null;

function Consumer() {
  latestCtx = useDebugContext();
  return null;
}

function Wrapped() {
  return (
    <DebugProvider>
      <Consumer />
    </DebugProvider>
  );
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  latestCtx = null;
});

describe("DebugContext — breakableIds / isBreakable", () => {
  test("starts empty, and isBreakable is false for anything before a code-generation pass", () => {
    mounted = mountComponent(<Wrapped />);
    expect(latestCtx.breakableIds).toEqual(new Set());
    expect(latestCtx.isBreakable("block-1")).toBe(false);
  });

  test("setBreakableIds publishes the set, and isBreakable reflects it", () => {
    mounted = mountComponent(<Wrapped />);
    act(() => {
      latestCtx.setBreakableIds(new Set(["block-1", "block-2"]));
    });
    expect(latestCtx.isBreakable("block-1")).toBe(true);
    expect(latestCtx.isBreakable("block-2")).toBe(true);
    expect(latestCtx.isBreakable("block-3")).toBe(false);
  });
});

describe("DebugContext — toggleBreakpoint guard", () => {
  test("cannot SET a breakpoint on a block that is not breakable", () => {
    mounted = mountComponent(<Wrapped />);
    act(() => {
      latestCtx.toggleBreakpoint("sphere-block");
    });
    expect(latestCtx.breakpoints.has("sphere-block")).toBe(false);
  });

  test("CAN set a breakpoint once the block is published as breakable", () => {
    mounted = mountComponent(<Wrapped />);
    act(() => {
      latestCtx.setBreakableIds(new Set(["time-step-block"]));
    });
    act(() => {
      latestCtx.toggleBreakpoint("time-step-block");
    });
    expect(latestCtx.breakpoints.has("time-step-block")).toBe(true);
  });

  test("an existing breakpoint can always be REMOVED, even if it is no longer breakable", () => {
    mounted = mountComponent(<Wrapped />);
    // Set it while breakable...
    act(() => {
      latestCtx.setBreakableIds(new Set(["time-step-block"]));
    });
    act(() => {
      latestCtx.toggleBreakpoint("time-step-block");
    });
    expect(latestCtx.breakpoints.has("time-step-block")).toBe(true);

    // ...then a regeneration drops it from the breakable set (e.g. the block
    // was deleted/changed), simulating a stale project's breakpoint.
    act(() => {
      latestCtx.setBreakableIds(new Set());
    });
    expect(latestCtx.isBreakable("time-step-block")).toBe(false);

    // Toggling again must remove it, not silently refuse.
    act(() => {
      latestCtx.toggleBreakpoint("time-step-block");
    });
    expect(latestCtx.breakpoints.has("time-step-block")).toBe(false);
  });

  test("toggleBreakpoint with no blockId is a no-op", () => {
    mounted = mountComponent(<Wrapped />);
    const before = latestCtx.breakpoints;
    act(() => {
      latestCtx.toggleBreakpoint(null);
      latestCtx.toggleBreakpoint(undefined);
      latestCtx.toggleBreakpoint("");
    });
    expect(latestCtx.breakpoints).toBe(before);
  });
});

describe("DebugContext — pauseState (Task 15)", () => {
  // pauseState is a three-state machine ("running" | "pausing" | "paused"):
  // the UI must never claim "paused" until the runtime's __phpause ack says
  // so (handled in useTrace), and useDebug/useTrace share one pauseAckTimerRef
  // instance for the ack-timeout fallback — both live on this context so
  // neither hook has to reimplement or duplicate the other's ref.

  test("starts 'running', with a pauseStateRef mirror and a null pauseAckTimerRef", () => {
    mounted = mountComponent(<Wrapped />);
    expect(latestCtx.pauseState).toBe("running");
    expect(latestCtx.pauseStateRef.current).toBe("running");
    expect(latestCtx.pauseAckTimerRef.current).toBe(null);
  });

  test("setPauseState publishes the new state and pauseStateRef mirrors it", () => {
    mounted = mountComponent(<Wrapped />);
    act(() => {
      latestCtx.setPauseState("pausing");
    });
    expect(latestCtx.pauseState).toBe("pausing");
    expect(latestCtx.pauseStateRef.current).toBe("pausing");

    act(() => {
      latestCtx.setPauseState("paused");
    });
    expect(latestCtx.pauseState).toBe("paused");
    expect(latestCtx.pauseStateRef.current).toBe("paused");
  });

  test("pauseAckTimerRef is one shared mutable instance, not re-created per render", () => {
    mounted = mountComponent(<Wrapped />);
    const ref = latestCtx.pauseAckTimerRef;
    act(() => {
      latestCtx.setPauseState("pausing");
    });
    expect(latestCtx.pauseAckTimerRef).toBe(ref);
  });
});
