import { describe, test, expect } from "vitest";
import { matchHotkey, isTypingTarget } from "../hotkeys";

const ev = (over) => ({
  key: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over,
});

describe("matchHotkey", () => {
  /* runToggle, not run: Run and Stop are one button in the viewport header,
     and the keyboard matches it. Mapping Ctrl+Enter to run only meant that
     pressing it mid-simulation called handleRun on a live session and did
     nothing observable — which is how it was reported. */
  test("Ctrl+Enter and Cmd+Enter toggle the run", () => {
    expect(matchHotkey(ev({ key: "Enter", ctrlKey: true }))).toBe("runToggle");
    expect(matchHotkey(ev({ key: "Enter", metaKey: true }))).toBe("runToggle");
  });

  test("F5 toggles the run, but only unmodified", () => {
    expect(matchHotkey(ev({ key: "F5" }))).toBe("runToggle");
    expect(matchHotkey(ev({ key: "F5", ctrlKey: true }))).toBeNull();
    expect(matchHotkey(ev({ key: "F5", shiftKey: true }))).toBeNull();
  });

  test("Escape stays stop-only — it must never START a simulation", () => {
    expect(matchHotkey(ev({ key: "Escape" }))).toBe("stop");
    expect(matchHotkey(ev({ key: "Escape" }))).not.toBe("runToggle");
  });

  test("Ctrl+S and Cmd+S save, in either letter case", () => {
    expect(matchHotkey(ev({ key: "s", ctrlKey: true }))).toBe("save");
    expect(matchHotkey(ev({ key: "S", metaKey: true }))).toBe("save");
  });

  test("Ctrl+Shift+S is not save (leave Save As to the browser)", () => {
    expect(matchHotkey(ev({ key: "s", ctrlKey: true, shiftKey: true }))).toBeNull();
  });

  test("bare Escape stops", () => {
    expect(matchHotkey(ev({ key: "Escape" }))).toBe("stop");
    expect(matchHotkey(ev({ key: "Escape", ctrlKey: true }))).toBeNull();
  });

  test("ordinary typing matches nothing", () => {
    for (const key of ["a", "s", "Enter", "Tab", " "]) {
      expect(matchHotkey(ev({ key }))).toBeNull();
    }
  });
});

describe("isTypingTarget", () => {
  test("text-entry elements and Monaco count as typing surfaces", () => {
    const host = document.createElement("div");
    host.innerHTML =
      '<input id="i"><textarea id="t"></textarea><div id="c" contenteditable="true"></div>' +
      '<div class="monaco-host"><span id="m"></span></div><div id="plain"></div>';
    document.body.appendChild(host);
    for (const id of ["i", "t", "c", "m"]) {
      expect(isTypingTarget(host.querySelector(`#${id}`))).toBe(true);
    }
    expect(isTypingTarget(host.querySelector("#plain"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    host.remove();
  });
});
