/**
 * Task 17 — debug keys, guarded.
 *
 * The old handler (DebugMode.js's bare window listener) bound Escape to "exit
 * debug mode" unconditionally, so with the save-run dialog or Help open on
 * top, Escape tore down the whole debug session and discarded the recording
 * context. Escape is not bound here at all. The listener exists only while
 * debug mode is on, ignores text-entry surfaces, and — like the toolbar
 * buttons it mirrors — does nothing when no simulation is running.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { mountComponent, keyDown } from "../../test/renderHelpers";
import { SimulationProvider, useSimulationContext } from "../../contexts/SimulationContext";
import { DebugProvider, useDebugContext } from "../../contexts/DebugContext";
import { TraceProvider } from "../../contexts/TraceContext";
import { useDebugHotkeys } from "../useDebugHotkeys";

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

import { pausePython, resumePython, stepPython, stepFrame } from "../../utils/runner/glowRunner";

let mounted = null;
let simCtx = null;
let dbgCtx = null;

function Consumer() {
  simCtx = useSimulationContext();
  dbgCtx = useDebugContext();
  useDebugHotkeys();
  return null;
}

function mount() {
  mounted = mountComponent(
    <SimulationProvider>
      <DebugProvider>
        <TraceProvider>
          <Consumer />
        </TraceProvider>
      </DebugProvider>
    </SimulationProvider>,
  );
}

/** Debug mode on, a simulation live — the only state these keys exist in. */
function armed() {
  mount();
  act(() => {
    dbgCtx.setDebugMode(true);
    simCtx.setRunning(true);
  });
}

const press = (init) => keyDown(document.body, init);

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  simCtx = null;
  dbgCtx = null;
  vi.clearAllMocks();
});

describe("useDebugHotkeys", () => {
  test("Space pauses a running simulation", () => {
    armed();
    press({ code: "Space" });
    expect(pausePython).toHaveBeenCalledTimes(1);
  });

  test("Space resumes once paused", () => {
    armed();
    act(() => {
      simCtx.setPaused(true);
    });
    press({ code: "Space" });
    expect(resumePython).toHaveBeenCalledTimes(1);
    expect(pausePython).not.toHaveBeenCalled();
  });

  test("F10 is Next frame; Shift+F10 is Next value", () => {
    armed();
    press({ code: "F10" });
    expect(stepFrame).toHaveBeenCalledTimes(1);
    expect(stepPython).not.toHaveBeenCalled();

    press({ code: "F10", shiftKey: true });
    expect(stepPython).toHaveBeenCalledTimes(1);
    expect(stepFrame).toHaveBeenCalledTimes(1);
  });

  test("Escape is not bound — closing an overlay is the overlay's job", () => {
    armed();
    press({ code: "Escape", key: "Escape" });
    expect(pausePython).not.toHaveBeenCalled();
    expect(resumePython).not.toHaveBeenCalled();
    expect(stepFrame).not.toHaveBeenCalled();
    expect(dbgCtx.debugMode).toBe(true); // the session survives
  });

  test("the keys do not exist while debug mode is off", () => {
    mount();
    act(() => {
      simCtx.setRunning(true);
    });
    press({ code: "Space" });
    press({ code: "F10" });
    expect(pausePython).not.toHaveBeenCalled();
    expect(stepFrame).not.toHaveBeenCalled();
  });

  test("nothing running: stepping is inert, so no ack timeout can accuse a dead runtime", () => {
    mount();
    act(() => {
      dbgCtx.setDebugMode(true);
    });
    press({ code: "Space" });
    press({ code: "F10" });
    expect(pausePython).not.toHaveBeenCalled();
    expect(stepFrame).not.toHaveBeenCalled();
  });

  test("typing in a text field is never a debug shortcut", () => {
    armed();
    const input = document.createElement("input");
    document.body.appendChild(input);
    try {
      keyDown(input, { code: "Space" });
      keyDown(input, { code: "F10" });
    } finally {
      input.remove();
    }
    expect(pausePython).not.toHaveBeenCalled();
    expect(stepFrame).not.toHaveBeenCalled();
  });

  test("the editor surfaces own their own keys", () => {
    armed();
    const host = document.createElement("div");
    host.className = "monaco-editor";
    document.body.appendChild(host);
    try {
      keyDown(host, { code: "Space" });
    } finally {
      host.remove();
    }
    expect(pausePython).not.toHaveBeenCalled();
  });

  test("the listener is torn down on unmount", () => {
    armed();
    mounted.unmount();
    mounted = null;
    press({ code: "Space" });
    expect(pausePython).not.toHaveBeenCalled();
  });
});
