/**
 * Task 16 — Setup constants, watch expressions, and values a student can read.
 *
 * TraceTable now groups rows into up to four sections (Pinned, Watch,
 * Setup / constants — collapsed by default, Live values) based on the
 * `scope` TraceContext stamps onto each entry, renders a watch-expression
 * input in its header (armed via TraceContext's `watch`/`addWatch`, not a
 * prop — see the comment in TraceTable.js for why), formats numeric values
 * at fixed precision without truncating a vector's worth of characters, and
 * moves min/max + the snapshot diff behind a per-row expand-on-click detail
 * row instead of crowding the sparkline cell.
 *
 * TraceTable reads `watch`/`addWatch` straight off TraceContext, so every
 * mount here needs a real `<TraceProvider>` around it (mirrors the wrapping
 * pattern in hooks/__tests__/useTrace.test.js).
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import TraceTable from "../TraceTable";
import { TraceProvider } from "../../contexts/TraceContext";
import { mountComponent, click } from "../../test/renderHelpers";

function entry(overrides = {}) {
  return {
    value: "1.5",
    blockId: "line_3",
    scope: "loop",
    count: 3,
    flashKey: 1,
    delta: 0.1,
    min: 1.0,
    max: 2.0,
    history: ["1.0", "1.2", "1.5"],
    ...overrides,
  };
}

function type(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function submit(form) {
  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

function renderTable(data, extraProps = {}) {
  mounted = mountComponent(
    <TraceProvider>
      <TraceTable data={data} onHighlight={vi.fn()} onClear={vi.fn()} {...extraProps} />
    </TraceProvider>
  );
  return mounted;
}

function varNames() {
  return [...mounted.container.querySelectorAll(".trace-varname")].map((el) => el.textContent);
}

function sectionLabels() {
  return [...mounted.container.querySelectorAll(".trace-section-label")].map((el) => el.textContent);
}

describe("TraceTable — section rendering", () => {
  test("setup constants render collapsed by default, behind a labelled toggle", () => {
    const data = new Map([
      ["m", entry({ scope: "setup", value: "2.5" })],
      ["g", entry({ scope: "setup", value: "-9.81" })],
      ["t", entry({ scope: "loop", value: "0.4" })],
    ]);
    renderTable(data);

    // Collapsed: the setup vars are not in the DOM until the toggle opens.
    expect(varNames()).not.toContain("m");
    expect(varNames()).not.toContain("g");
    expect(varNames()).toContain("t");

    const toggle = mounted.container.querySelector(".trace-section-toggle");
    expect(toggle).toBeTruthy();
    expect(toggle.textContent).toContain("Setup / constants (2)");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(varNames()).toContain("m");
    expect(varNames()).toContain("g");

    // Clicking again re-collapses it.
    click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(varNames()).not.toContain("m");
  });

  test("watch expressions get their own always-open section, ahead of setup and live values", () => {
    const data = new Map([
      ["0.5*m*mag(v)**2", entry({ scope: "watch", value: "12.34" })],
      ["m", entry({ scope: "setup", value: "2.5" })],
      ["t", entry({ scope: "loop", value: "0.4" })],
    ]);
    renderTable(data);

    const labels = sectionLabels();
    expect(labels.some((l) => l.includes("Watch (1)"))).toBe(true);
    expect(labels).toContain("Live values");
    // Watch rows need no expand step — they're the whole point of adding one.
    expect(varNames()).toContain("0.5*m*mag(v)**2");
  });

  test("a plain project with only live values shows no section headers at all", () => {
    const data = new Map([["t", entry({ scope: "loop" })]]);
    renderTable(data);
    expect(mounted.container.querySelector(".trace-section-row")).toBeNull();
    expect(varNames()).toContain("t");
  });
});

describe("TraceTable — watch input arming", () => {
  test("typing an expression and submitting arms it: the input clears and the note appears", () => {
    renderTable(new Map());
    expect(mounted.container.querySelector(".trace-watch-note")).toBeNull();

    const input = mounted.container.querySelector(".trace-watch-input");
    type(input, "0.5*k*x**2");
    submit(mounted.container.querySelector(".trace-watch"));

    expect(input.value).toBe("");
    const note = mounted.container.querySelector(".trace-watch-note");
    expect(note).toBeTruthy();
    expect(note.textContent).toBe("1 watch — press Run to see it.");
  });

  test("submitting a second expression pluralises the note", () => {
    renderTable(new Map());
    const input = mounted.container.querySelector(".trace-watch-input");
    const form = mounted.container.querySelector(".trace-watch");

    type(input, "m");
    submit(form);
    type(input, "g");
    submit(form);

    const note = mounted.container.querySelector(".trace-watch-note");
    expect(note.textContent).toBe("2 watches — press Run to see them.");
  });

  test("submitting blank input arms nothing", () => {
    renderTable(new Map());
    const input = mounted.container.querySelector(".trace-watch-input");
    type(input, "   ");
    submit(mounted.container.querySelector(".trace-watch"));
    expect(mounted.container.querySelector(".trace-watch-note")).toBeNull();
  });
});

describe("TraceTable — value legibility (Step 5)", () => {
  test("a float value renders at fixed precision instead of jittering", () => {
    const data = new Map([["ke", entry({ value: "0.30000000000000004", delta: null })]]);
    renderTable(data);
    expect(mounted.container.querySelector(".trace-value").textContent).toBe("0.3000");
  });

  test("a full vector prints without an ellipsis at the widened value column", () => {
    const vec = "<1.234, -0.567, 8.901>"; // 22 chars — under the new 24-char cutoff
    const data = new Map([["pos", entry({ value: vec, delta: null })]]);
    renderTable(data);
    expect(mounted.container.querySelector(".trace-value").textContent).toBe(vec);
  });

  test("a value past the 24-char cutoff still truncates with an ellipsis", () => {
    const long = "<123.456789, -987.654321, 555.111222>"; // > 24 chars
    const data = new Map([["pos", entry({ value: long, delta: null })]]);
    renderTable(data);
    const text = mounted.container.querySelector(".trace-value").textContent;
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBe(25); // 24 chars + the ellipsis glyph
  });

  test("clicking a row's value cell opens the min/max/snapshot/block detail row, and a second click closes it", () => {
    const data = new Map([["v", entry({ min: 1, max: 9, value: "5", blockId: "line_7" })]]);
    renderTable(data);
    expect(mounted.container.querySelector(".trace-row-detail")).toBeNull();

    click(mounted.container.querySelector(".trace-col--value"));
    const detail = mounted.container.querySelector(".trace-row-detail");
    expect(detail).toBeTruthy();
    expect(detail.textContent).toContain("min");
    expect(detail.textContent).toContain("1");
    expect(detail.textContent).toContain("max");
    expect(detail.textContent).toContain("9");
    expect(detail.textContent).toContain("line_7");

    click(mounted.container.querySelector(".trace-col--value"));
    expect(mounted.container.querySelector(".trace-row-detail")).toBeNull();
  });

  test("the sparkline cell no longer renders a min/max chip or a snapshot chip", () => {
    const data = new Map([["v", entry({ min: 1, max: 9, value: "5" })]]);
    renderTable(data);
    expect(mounted.container.querySelector(".trace-minmax")).toBeNull();
    expect(mounted.container.querySelector(".trace-snap-chip")).toBeNull();
  });
});
