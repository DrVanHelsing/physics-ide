/**
 * Task 14 — "only instrumentable lines get a Monaco gutter breakpoint".
 *
 * CodeEditor's glyph-margin click handler used to accept a breakpoint on any
 * line. This test drives the real handler registered on `editor.onMouseDown`
 * with a fake Monaco (so no real editor/worker needs to boot under jsdom) and
 * checks that a click on a non-breakable line is refused while a click on a
 * breakable one still toggles.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { mountComponent } from "../../test/renderHelpers";
import CodeEditor from "../CodeEditor";

/** Captured by the fake editor's onMouseDown so the test can fire it manually. */
let capturedMouseDown = null;

function makeFakeEditor() {
  return {
    getValue: () => "",
    setValue: vi.fn(),
    onDidChangeModelContent: vi.fn(),
    onMouseDown: vi.fn((cb) => {
      capturedMouseDown = cb;
    }),
    deltaDecorations: vi.fn((_old, decos) => decos.map((_, i) => `deco-${i}`)),
    updateOptions: vi.fn(),
    dispose: vi.fn(),
  };
}

const fakeEditor = makeFakeEditor();

vi.mock("../../utils/monaco/monacoLib", () => ({
  default: {
    editor: {
      create: vi.fn(() => fakeEditor),
      setTheme: vi.fn(),
    },
    Range: class Range {
      constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
        this.startLineNumber = startLineNumber;
        this.startColumn = startColumn;
        this.endLineNumber = endLineNumber;
        this.endColumn = endColumn;
      }
    },
  },
}));

vi.mock("../../utils/monaco/monacoThemes", () => ({
  registerPhysicsThemes: vi.fn(() => Promise.resolve()),
  physicsThemeName: (isDark) => (isDark ? "physics-dark" : "physics-light"),
}));

/** Simulate a Monaco glyph-margin click at `lineNumber`. */
function clickGutter(lineNumber) {
  capturedMouseDown({ target: { type: 2, position: { lineNumber } } });
}

/** Wait for CodeEditor's dynamic import + registerPhysicsThemes chain to settle. */
const flush = () => new Promise((r) => setTimeout(r, 0));

let mounted = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  capturedMouseDown = null;
  vi.clearAllMocks();
});

describe("CodeEditor — breakableLines gates the gutter click", () => {
  test("a click on a line NOT in breakableLines does not toggle", async () => {
    const onToggle = vi.fn();
    mounted = mountComponent(
      <CodeEditor
        value="x = 1"
        onChange={() => {}}
        isDark={false}
        breakpointLines={new Set()}
        onToggleLineBreakpoint={onToggle}
        breakableLines={new Set([2, 3])}
      />
    );
    await flush();
    expect(capturedMouseDown).toBeTruthy();

    clickGutter(5);
    expect(onToggle).not.toHaveBeenCalled();
  });

  test("a click on a line IN breakableLines toggles normally", async () => {
    const onToggle = vi.fn();
    mounted = mountComponent(
      <CodeEditor
        value="x = 1"
        onChange={() => {}}
        isDark={false}
        breakpointLines={new Set()}
        onToggleLineBreakpoint={onToggle}
        breakableLines={new Set([2, 3])}
      />
    );
    await flush();

    clickGutter(2);
    expect(onToggle).toHaveBeenCalledWith(2);
  });

  test("breakableLines omitted (not yet wired) is permissive — every click still toggles", async () => {
    const onToggle = vi.fn();
    mounted = mountComponent(
      <CodeEditor
        value="x = 1"
        onChange={() => {}}
        isDark={false}
        breakpointLines={new Set()}
        onToggleLineBreakpoint={onToggle}
      />
    );
    await flush();

    clickGutter(7);
    expect(onToggle).toHaveBeenCalledWith(7);
  });
});
