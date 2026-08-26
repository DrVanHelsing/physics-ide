import { describe, test, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { mountComponent, click, byText } from "../../test/renderHelpers";
import WelcomePage from "../WelcomePage";
import { WELCOME_PASSED_SESSION_KEY } from "../../constants";
import { BLOCK_TEMPLATES, DS_TEMPLATES } from "../../utils/blockTemplates";

const PENDING_TEMPLATE_KEY = "pide_pending_template";

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
    /* Scoped to .welcome-cta (the door row), not the whole hero, since
       tranche 1: the hero also carries the quiet "Join your class" door,
       which is a hero <button> but not one of the three doors this test
       locks. The door row itself is unchanged — same three labels, same
       order. */
    const { container, unmount } = mount();
    const labels = [...container.querySelectorAll(".welcome-cta button")].map(
      (b) => b.textContent.replace(/\s+/g, " ").trim(),
    );
    expect(labels).toEqual([
      "Use the IDE — no account needed",
      "Create an account",
      "Sign in",
    ]);
    unmount();
  });

  test("every CTA stamps the session pass before navigating — all seven, clicked", () => {
    /* The grep test above proves no CTA uses a bare <Link>; only a click proves
       the handler that IS wired stamps the pass. A source grep cannot see a
       computed path, and a footer button that forgot go() sends the visitor to
       "/" where WelcomeGate bounces them straight back here — the exact
       infinite-loop the brief names as the easiest way to break this page.
       So: both hero and footer, primary, secondary and ghost. */
    const { container, unmount } = mount();
    const ctas = [
      ...container.querySelectorAll(".welcome-hero button"),
      ...container.querySelectorAll(".welcome-foot button"),
    ];
    /* 7 since tranche 1: 3 hero doors + the hero's quiet "Join your class"
       door (→ /join, ungated but still stamped through go() so "/" behaves
       the same for the rest of the session) + footer primary + 2 quiet
       links. The in-page playground anchor is an <a>, not a button, and is
       deliberately not counted — it never navigates. */
    expect(ctas).toHaveLength(7);
    expect(ctas).toContain(byText(container, "Open the IDE"));
    for (const cta of ctas) {
      sessionStorage.clear();
      expect(sessionStorage.getItem(WELCOME_PASSED_SESSION_KEY)).toBeNull();
      click(cta);
      expect(sessionStorage.getItem(WELCOME_PASSED_SESSION_KEY)).toBe("1");
    }
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
    /* Every entry here bans a PROMISE, not a word. The bare /gradebook/i this
       list shipped with banned the truthful "…and a gradebook are designed but
       not shipped" as well as "our gradebook lets you…", which made the one
       honest denial on the page unwritable — a test that forbids truth-telling
       is the wrong shape. Verb-anchored, it still catches the claim. */
    const banned = [
      /version history/i, /restore a previous/i, /roll ?back/i,
      /assignment[s]? (are|is) (available|here)/i, /marking is/i,
      /gradebook (is|lets|gives|includes)/i,
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

  /* ── Tranche 1's three structural locks. Same discipline as the keycap
     row: the page's copy and shape are test-locked, so a later edit moves
     a test in the same commit or does not move the page. ─────────────── */

  test("the linked stat tiles are real anchors to their exact sections — and the unlinked one is not", () => {
    /* The four tiles whose subject has an in-page section are <a>; the
       documentation tile has no target on this page and must stay a <div>.
       Both dataset and chart tiles point at §7 — the data section covers
       both. */
    const { container, unmount } = mount();
    const tiles = [...container.querySelectorAll(".welcome-stat")].map((t) => [
      t.querySelector(".welcome-stat__n").textContent,
      t.tagName,
      t.getAttribute("href"),
    ]);
    expect(tiles).toEqual([
      ["151", "A", "#s-editor"],
      ["18", "A", "#s-start"],
      ["6", "A", "#s-data"],
      ["6", "A", "#s-data"],
      ["14", "DIV", null],
      ["0", "A", "#s-yours"],
    ]);
    // …and every linked target actually exists on this page.
    for (const [, tag, href] of tiles) {
      if (tag === "A") expect(container.querySelector(href)).toBeTruthy();
    }
    unmount();
  });

  test("the anchor rail is a nav of exactly the nine eyebrowed sections, in page order", () => {
    /* s-what and s-numbers are deliberately absent — their headings are
       visually hidden landmarks, not destinations a reader names. The
       order is the page's true section order (play BEFORE class). */
    const { container, unmount } = mount();
    const rail = container.querySelector('nav[aria-label="Page sections"]');
    expect(rail).toBeTruthy();
    const links = [...rail.querySelectorAll("a")];
    expect(links).toHaveLength(9);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "#s-editor",
      "#s-view",
      "#s-debug",
      "#s-measure",
      "#s-data",
      "#s-start",
      "#s-yours",
      "#s-play",
      "#s-class",
    ]);
    // Every rail target is a real id on this page.
    for (const a of links) {
      expect(container.querySelector(a.getAttribute("href"))).toBeTruthy();
    }
    unmount();
  });

  test("the first-five-minutes strip is an ol of exactly three imperatives, text locked", () => {
    /* Locked the way the keycap row is: these are the three things a
       reader is told to do, and each is a claim verified by doing it. The
       step numbers are CSS counters, so the text carries no numerals. */
    const { container, unmount } = mount();
    const list = container.querySelector("ol.welcome-steps__list");
    expect(list).toBeTruthy();
    const items = [...list.querySelectorAll(":scope > li")];
    expect(items).toHaveLength(3);
    expect(items.map((li) => li.textContent.replace(/\s+/g, " ").trim())).toEqual([
      "Open the IDE — no account needed.",
      "Open a worked project.",
      "Press Run, then change one number.",
    ]);
    unmount();
  });

  /* ── Tranche 2's worked-project tiles: §8, four real templates opened in
     one click. Same click-through pass-stamp idiom as the "all seven"
     test above, plus the pending-template key each tile is responsible
     for. Scoped to .welcome-tile, NOT .welcome-hero/.welcome-foot, so the
     existing "seven CTAs" lock above does not move — these are a distinct,
     separately-locked set of gated CTAs. ─────────────────────────────── */

  test("exactly four worked-project tiles, each naming a real template id", () => {
    const { container, unmount } = mount();
    const tiles = [...container.querySelectorAll(".welcome-tile")];
    expect(tiles).toHaveLength(4);
    const ids = tiles.map((t) => t.getAttribute("data-template-id"));
    expect(ids).toEqual([
      "blocks_projectile",
      "blocks_pendulum",
      "blocks_orbits",
      "ds_penguins_stats",
    ]);
    // Verified against the actual registries the IDE opens them from — not
    // just internally consistent with this file's own copy of the ids.
    for (const id of ids) {
      const isReal =
        BLOCK_TEMPLATES.some((t) => t.id === id) || DS_TEMPLATES.some((t) => t.id === id);
      expect(isReal).toBe(true);
    }
    unmount();
  });

  test("each tile writes its template id to sessionStorage and stamps the welcome pass through go()", () => {
    const { container, unmount } = mount();
    const tiles = [...container.querySelectorAll(".welcome-tile")];
    for (const tile of tiles) {
      const id = tile.getAttribute("data-template-id");
      sessionStorage.clear();
      expect(sessionStorage.getItem(PENDING_TEMPLATE_KEY)).toBeNull();
      expect(sessionStorage.getItem(WELCOME_PASSED_SESSION_KEY)).toBeNull();
      click(tile);
      expect(sessionStorage.getItem(PENDING_TEMPLATE_KEY)).toBe(id);
      expect(sessionStorage.getItem(WELCOME_PASSED_SESSION_KEY)).toBe("1");
    }
    unmount();
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
    /* "run / stop", not "run", since tranche 1: utils/hotkeys.js maps
       Ctrl/Cmd+Enter to "runToggle" — Run and Stop are one button in the
       viewport header and the keyboard matches it. The old label promised
       less than the key does. Bare F5 maps to runToggle too; it is named in
       §4's prose, and the row deliberately stays at the three chords a
       student is told to learn. */
    expect(items.map((li) => li.textContent.replace(/\s+/g, " ").trim())).toEqual([
      "Ctrl+Enter run / stop",
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
