import { describe, test, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { mountComponent, click, byText } from "../../test/renderHelpers";
import WelcomePage from "../WelcomePage";
import { WELCOME_PASSED_SESSION_KEY } from "../../constants";

const SRC = readFileSync(resolve(__dirname, "../WelcomePage.js"), "utf8");
const mount = () => mountComponent(<MemoryRouter><WelcomePage /></MemoryRouter>);

describe("the front page", () => {
  beforeEach(() => sessionStorage.clear());

  test("every internal CTA goes through go() — the single easiest way to break this page", () => {
    // No bare navigation to the three gated destinations.
    expect(SRC).not.toMatch(/<Link\s+to=["']\/(auth\/sign(in|up))?["']/);
    expect(SRC).not.toMatch(/navigate\(\s*["']\/(auth\/sign(in|up))?["']\s*\)/);
  });

  test("the three doors keep their exact promise, order and destinations", () => {
    const { container, unmount } = mount();
    const labels = [...container.querySelectorAll(".welcome-hero button")].map(
      (b) => b.textContent.replace(/\s+/g, " ").trim(),
    );
    expect(labels).toEqual([
      "Use the IDE — no account needed",
      "Create an account",
      "Sign in",
    ]);
    unmount();
  });

  test("a CTA stamps the session pass before navigating", () => {
    const { container, unmount } = mount();
    click(byText(container, "Use the IDE — no account needed"));
    expect(sessionStorage.getItem(WELCOME_PASSED_SESSION_KEY)).toBe("1");
    unmount();
  });

  test("heading order is repaired: one h1, sections are h2, cards are h3", () => {
    const { container, unmount } = mount();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("h2").length).toBeGreaterThan(5);
    // No h3 without an h2 above it, and no card title promoted to h2.
    const order = [...container.querySelectorAll("h1,h2,h3")].map((h) => h.tagName);
    expect(order[0]).toBe("H1");
    expect(order.includes("H3")).toBe(true);
    // Every H3 is preceded somewhere above by an H2 — the comment above, enforced.
    order.forEach((tag, i) => {
      if (tag === "H3") expect(order.slice(0, i).includes("H2")).toBe(true);
    });
    unmount();
  });

  test("landmarks and labelled sections", () => {
    const { container, unmount } = mount();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelectorAll("footer")).toHaveLength(1);
    for (const s of container.querySelectorAll("section")) {
      expect(s.getAttribute("aria-labelledby")).toBeTruthy();
      // …and the id it points at actually exists on this page.
      expect(container.querySelector(`#${s.getAttribute("aria-labelledby")}`)).toBeTruthy();
    }
    unmount();
  });

  test("a skip link is the first focusable thing on a nine-screen page", () => {
    const { container, unmount } = mount();
    const skip = container.querySelector(".welcome-skip");
    expect(skip).toBeTruthy();
    expect(skip.getAttribute("href")).toBe("#welcome-main");
    expect(container.querySelector("#welcome-main")).toBeTruthy();
    unmount();
  });

  test("the non-claims list is honoured — no promise the product cannot keep", () => {
    const banned = [
      /version history/i, /restore a previous/i, /roll ?back/i,
      /assignment[s]? (are|is) (available|here)/i, /marking is/i, /gradebook/i,
      /exam mode/i, /lockdown/i, /collision/i, /cloud/i,
      /we('| ha)?ve sent/i, /check your inbox/i,
      /every run captures/i, /unlimited/i, /schools? (use|trust)/i,
      /press run to see your analysis/i,
    ];
    for (const re of banned) expect(SRC).not.toMatch(re);
  });

  test("the one sanctioned acknowledgement is present and impossible to miss", () => {
    const { container, unmount } = mount();
    const panel = container.querySelector(".welcome-notbuilt");
    expect(panel).toBeTruthy();
    expect(panel.className).toContain("card--panel");
    expect(panel.textContent).toMatch(/Not yet built\./);
    expect(panel.textContent).toMatch(/designed but not shipped/);
    unmount();
  });

  test("no emoji", () => {
    expect(SRC).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });
});

/* ── The numbers ledger, checked against the tree rather than against a note.
   Plan 5's rule is "if a claim cannot be pointed at a file, it does not ship";
   these three read the file and compare. ─────────────────────────────────── */
describe("the front page's numerals trace to source", () => {
  const TOOLBOX = readFileSync(
    resolve(__dirname, "../../utils/blockly/toolbox.js"),
    "utf8",
  );
  const BUILTINS = resolve(__dirname, "../../utils/dataset/builtins");

  test("151 toolbox block types, and the stat tile says so", () => {
    const uniq = new Set(
      [...TOOLBOX.matchAll(/<block type="([a-zA-Z0-9_]+)"/g)].map((m) => m[1]),
    );
    expect(uniq.size).toBe(151);
    expect(SRC).toMatch(/\b151\b/);
  });

  test("6 chart types — the ds_chart_* blocks, which is not the same as the Charts drawer's block count", () => {
    const charts = new Set(
      [...TOOLBOX.matchAll(/<block type="(ds_chart_[a-z_]+)"/g)].map((m) => m[1]),
    );
    // ds_save_chart_block sits in the same drawer and is a save action, not a
    // chart type; ds_chart_scatter_fit_block sits in a different drawer and is.
    expect([...charts].sort()).toEqual([
      "ds_chart_bar_block",
      "ds_chart_box_block",
      "ds_chart_histogram_block",
      "ds_chart_line_block",
      "ds_chart_scatter_block",
      "ds_chart_scatter_fit_block",
    ]);
    expect(charts.size).toBe(6);
  });

  test("every built-in dataset's row count on the page is the row count in its JSON", () => {
    const rows = Object.fromEntries(
      readdirSync(BUILTINS).map((f) => {
        const j = JSON.parse(readFileSync(resolve(BUILTINS, f), "utf8"));
        return [f.replace(/\.json$/, ""), j.rows.length];
      }),
    );
    expect(rows).toEqual({
      planets: 9, penguins: 30, weather: 28, pendulum: 56, spring: 8, freefall: 12,
    });
    // The page states each one; a change to a JSON must break this test.
    const { container, unmount } = mount();
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain(`Planets (${rows.planets} rows)`);
    expect(text).toContain(`Palmer Penguins (${rows.penguins})`);
    expect(text).toContain(`Cape Town vs Johannesburg (${rows.weather})`);
    expect(text).toContain(`Pendulum lab measurements (${rows.pendulum})`);
    expect(text).toContain(`Spring / Hooke’s law (${rows.spring})`);
    expect(text).toContain(`Free fall (${rows.freefall})`);
    unmount();
  });

  test("the keycap row is exactly the three shipped hotkeys — no invented fourth", () => {
    const { container, unmount } = mount();
    const items = [...container.querySelectorAll(".welcome-keys > li")];
    expect(items).toHaveLength(3);
    expect(items.map((li) => li.textContent.replace(/\s+/g, " ").trim())).toEqual([
      "Ctrl+Enter run",
      "Esc stop",
      "Ctrl+S save",
    ]);
    // Keycaps are real <kbd> in the IDE's own treatment.
    expect(container.querySelectorAll(".welcome-keys kbd.tb-kbd")).toHaveLength(5);
    unmount();
  });

  test("six stat tiles, mono and tabular, and the rhetorical zero is one of them", () => {
    const { container, unmount } = mount();
    const stats = [...container.querySelectorAll(".welcome-stat")];
    expect(stats).toHaveLength(6);
    const values = stats.map((s) => s.querySelector(".welcome-stat__n").textContent);
    expect(values).toEqual(["151", "18", "6", "6", "14", "0"]);
    unmount();
  });
});
