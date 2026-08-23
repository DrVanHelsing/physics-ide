import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { mountComponent } from "../../test/renderHelpers";
import * as Icons from "../Icons";

const SRC = readFileSync(resolve(__dirname, "../Icons.js"), "utf8");

describe("one icon module, one idiom (spec §18 D10)", () => {
  test("the welcome fork is gone", () => {
    expect(existsSync(resolve(__dirname, "../../welcome/WelcomeIcons.js"))).toBe(false);
  });

  test("the welcome icons live here now", () => {
    for (const n of ["OrbitIcon", "ChartIcon", "LocalFirstIcon", "PrivacyIcon",
                     "BlocksIcon", "GraduationCapIcon"]) {
      expect(typeof Icons[n]).toBe("function");
    }
  });

  test("ClassroomIcon was not re-added — GraduationCapIcon already covers it", () => {
    expect(Icons.ClassroomIcon).toBeUndefined();
  });

  test("every export takes a size prop and defaults to 16", () => {
    const { container, unmount } = mountComponent(
      <div>{Object.values(Icons).map((I, i) => <I key={i} />)}</div>,
    );
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg.getAttribute("width")).toBe("16");
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    }
    unmount();
  });

  test("every export honours an explicit size", () => {
    const { container, unmount } = mountComponent(
      <div>
        {["OrbitIcon", "ChartIcon", "LocalFirstIcon", "PrivacyIcon", "BlocksIcon"].map((n) => {
          const I = Icons[n];
          return <I key={n} size={28} />;
        })}
      </div>,
    );
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg.getAttribute("width")).toBe("28");
      expect(svg.getAttribute("height")).toBe("28");
    }
    unmount();
  });

  test("no emoji anywhere in the module", () => {
    expect(SRC).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  // The house idiom, not just presence: arrow-function export destructuring
  // `size` with a `{}` default, spreading `{...sz(size)}` onto the <svg>, with
  // no hardcoded width/height/viewBox/stroke attributes duplicated per-icon.
  describe("the four folded-in icons follow the house idiom exactly", () => {
    for (const name of ["OrbitIcon", "ChartIcon", "LocalFirstIcon", "PrivacyIcon"]) {
      test(`${name} is declared as ({ size } = {}) => <svg {...sz(size)}>...`, () => {
        const re = new RegExp(
          `export const ${name} = \\(\\{ size \\} = \\{\\}\\) => \\(\\s*<svg \\{\\.\\.\\.sz\\(size\\)\\}>`,
        );
        expect(SRC).toMatch(re);
      });
    }
  });

  test("the welcome module's own conventions did not carry over — no hardcoded 28px sizing or 1.6 stroke width anywhere in Icons.js", () => {
    expect(SRC).not.toMatch(/width="28"/);
    expect(SRC).not.toMatch(/height="28"/);
    expect(SRC).not.toMatch(/strokeWidth="1\.6"/);
    expect(SRC).not.toMatch(/focusable="false"/);
  });

  test("BlocksIcon resolves to the IDE's four-square grid, not the welcome fork's two overlapping squares", () => {
    // The welcome variant used a 3.25/11/2.5 geometry; the surviving export uses
    // a 3/7/1 four-rect grid. Guard against the duplicate quietly reappearing.
    expect(SRC).not.toMatch(/rx="2\.5"/);
    expect(SRC).toMatch(
      /export const BlocksIcon = \(\{ size \} = \{\}\) => \(\s*<svg \{\.\.\.sz\(size\)\}><rect x="3" y="3" width="7" height="7" rx="1"\/>/,
    );
  });

  test("BlocksIcon is exported exactly once (no reintroduced duplicate)", () => {
    const matches = SRC.match(/export const BlocksIcon = /g) || [];
    expect(matches).toHaveLength(1);
  });
});
