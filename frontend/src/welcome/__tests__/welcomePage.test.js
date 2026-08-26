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

  /* v2: the redesign brief strips the hero to a title, a subline and ONE
     primary door — "everything else leaves the hero." The old three-button
     door row (primary + the two account doors) is gone; the two account
     doors now live in the site nav (WelcomeHeader) and the footer instead. */
  test("the hero keeps exactly one door, and it is the primary one", () => {
    const { container, unmount } = mount();
    const heroButtons = [...container.querySelectorAll(".welcome-hero button")];
    expect(heroButtons).toHaveLength(1);
    expect(heroButtons[0].textContent.replace(/\s+/g, " ").trim()).toBe(
      "Use the IDE — no account needed",
    );
    unmount();
  });

  test("the footer's three doors keep their exact promise and order", () => {
    const { container, unmount } = mount();
    const labels = [...container.querySelectorAll(".welcome-foot button")].map(
      (b) => b.textContent.replace(/\s+/g, " ").trim(),
    );
    expect(labels).toEqual(["Open the IDE", "Create an account", "Sign in"]);
    unmount();
  });

  test("every hero/footer CTA stamps the session pass before navigating — all four, clicked", () => {
    /* v2: was seven (3 hero doors + the hero's own quiet join-class line +
       footer primary + 2 quiet links) when the hero carried every door.
       The redesign strips the hero to its one primary door and moves
       "Join your class" into §4, next to the worked-project tiles it now
       sits beside (tested separately below) — so this lock now covers
       exactly the hero's one button plus the footer's three. A source grep
       cannot see a computed path, so only a click proves each wired
       handler stamps the pass — a button that forgot go() sends the
       visitor to "/" where WelcomeGate bounces them straight back here. */
    const { container, unmount } = mount();
    const ctas = [
      ...container.querySelectorAll(".welcome-hero button"),
      ...container.querySelectorAll(".welcome-foot button"),
    ];
    expect(ctas).toHaveLength(4);
    expect(ctas).toContain(byText(container, "Open the IDE", ".welcome-foot button"));
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

  test("a skip link is the first focusable thing on the page", () => {
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

  /* ── v2 retirements. Each lock below is REMOVED, not merely edited, with
     a why-comment explaining what took its section's place — per the
     redesign brief's own migration rule: "section-specific locks (rail,
     steps strip, stat-tile anchors, playground-section) are REMOVED WITH
     WHY-COMMENTS as their sections retire."

     - "the linked stat tiles are real anchors..." — the nine linked/hover-
       revealing stat tiles became the six-item closing ribbon (plain text,
       no links, no hover-reveal). See "the closing ribbon" test below.
     - "the anchor rail is a nav of exactly the nine eyebrowed sections..."
       — the rail retires with the nine-section page it indexed; the sticky
       nav plus a five-section page replace in-page navigation entirely
       (redesign brief: "this supersedes the earlier keep-the-rail
       directive per the user's new only-thing-on-screen wireframe — if the
       rail's removal is wrong, it is one revert away").
     - "the first-five-minutes strip is an ol of exactly three
       imperatives..." — §2b is not one of the redesign's five sections and
       is cut in full; the three imperatives it gamified are not claims
       this file re-derives elsewhere.
     - "chapter bands (brief move 1) — every second .welcome-section..." —
       the alternating full-bleed category-band device retires with the
       nine-section rhythm it decorated; five sections at plain --space-9
       separation read cleanly without it (redesign brief: "do not
       clutter").
     - "framed evidence (brief move 3) — the two product screenshots" — the
       editor/viewport screenshot pair is replaced by the two demo videos;
       see "the two demo videos" below for their own lock.
     - "every built-in dataset's row count on the page is the row count in
       its JSON" — the six-chip dataset breakdown lived in the old §7,
       which is not one of the five sections and is cut; only the ribbon's
       undifferentiated "6 built-in datasets" total survives, re-derived by
       the new test below (file count, not a per-file breakdown the page
       no longer states). ─────────────────────────────────────────────── */

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

  test("\"Join your class\" moved from the hero to §4, and still stamps the pass through go()", () => {
    const { container, unmount } = mount();
    const section = container.querySelector('section[aria-labelledby="s-open"]');
    expect(section).toBeTruthy();
    const btn = byText(section, "Join your class");
    expect(btn).toBeTruthy();
    sessionStorage.clear();
    click(btn);
    expect(sessionStorage.getItem(WELCOME_PASSED_SESSION_KEY)).toBe("1");
    unmount();
  });

  test("each of the five sections tints its own block-category colour by name", () => {
    // Resolved via the trusted CAT table, never string-concatenated from
    // anything but it — see this file's own header comment.
    const { container, unmount } = mount();
    const ids = ["s-work", "s-blocks", "s-analyse", "s-open", "s-class"];
    for (const id of ids) {
      const section = container.querySelector(`section[aria-labelledby="${id}"]`);
      expect(section).toBeTruthy();
      expect(section.className).toMatch(/welcome-cat-[a-z-]+/);
    }
    unmount();
  });
});

/* ── The site nav, mounted on the front page (WelcomeHeader.js). The
   header component's own props/behaviour are covered thoroughly in
   welcomeHeader.test.js; these three integration checks (unchanged since
   tranche 2.5) plus the new v2 "Open the IDE" wiring test are what belong
   here — that this page passes its own real go() through, not a stub. ── */
describe("the site nav, mounted on the front page", () => {
  test("WelcomeHeader is mounted, outside the hero/footer CTA counts the tests above lock", () => {
    const { container, unmount } = mount();
    expect(container.querySelector(".welcome-header")).toBeTruthy();
    expect(container.querySelector(".welcome-hero .welcome-header")).toBeNull();
    unmount();
  });

  test("the nav's Sign in is wired to this page's own go(), not a bare Link", () => {
    const { container, unmount } = mount();
    const btn = container.querySelector(".welcome-header__signin button");
    expect(btn).toBeTruthy();
    sessionStorage.clear();
    click(btn);
    expect(sessionStorage.getItem(WELCOME_PASSED_SESSION_KEY)).toBe("1");
    unmount();
  });

  test("the nav's Open the IDE (v2's trailing door, per the wireframe) is wired to this page's own go()", () => {
    const { container, unmount } = mount();
    const btn = byText(container, "Open the IDE", ".welcome-header__cluster button");
    expect(btn).toBeTruthy();
    sessionStorage.clear();
    click(btn);
    expect(sessionStorage.getItem(WELCOME_PASSED_SESSION_KEY)).toBe("1");
    unmount();
  });

  test("the nav's For teachers uses the in-page anchor here, not a full navigation", () => {
    const { container, unmount } = mount();
    const teachers = [...container.querySelectorAll(".welcome-header__nav a")].find(
      (a) => a.textContent === "For teachers",
    );
    expect(teachers.getAttribute("href")).toBe("#s-class");
    unmount();
  });
});

/* ── v2's demo videos — the product on video, replacing the old §3/§4
   screenshot pair (see the retirement note above). Reduced-motion's
   poster-and-Play-button swap is DemoVideo's own concern (WelcomePage.js)
   and is exercised at the unit level there is no separate spec file for;
   these two checks cover the default (motion-allowed) mount, which is what
   jsdom's matchMedia stub always reports. ─────────────────────────────── */
describe("the two demo videos (v2 — the product on video)", () => {
  test("both figures render a real, muted, looping <video> with a poster, dimensions and an aria-label", () => {
    const { container, unmount } = mount();
    const figures = [...container.querySelectorAll("figure.welcome-demo")];
    expect(figures).toHaveLength(2);
    const videos = [...container.querySelectorAll("video.welcome-demo__video")];
    expect(videos).toHaveLength(2);
    for (const v of videos) {
      expect(v.getAttribute("src")).toBeTruthy();
      expect(v.getAttribute("poster")).toBeTruthy();
      expect(v.getAttribute("width")).toBeTruthy();
      expect(v.getAttribute("height")).toBeTruthy();
      expect(v.muted).toBe(true);
      expect(v.loop).toBe(true);
      expect(v.getAttribute("aria-label")).toBeTruthy();
    }
    for (const f of figures) expect(f.querySelector("figcaption")).toBeTruthy();
    unmount();
  });
});

/* ── The numbers ledger, checked against the tree rather than against a note.
   Plan 5's rule is "if a claim cannot be pointed at a file, it does not ship";
   these read the file and compare. v2: the six numerals moved from nine
   linked, hover-revealing stat tiles to one quiet ribbon (redesign brief) —
   the derivations themselves are unchanged where the underlying fact still
   appears on the page. ─────────────────────────────────────────────────── */
describe("the front page's numerals trace to source", () => {
  const TOOLBOX = readFileSync(
    resolve(__dirname, "../../utils/blockly/toolbox.js"),
    "utf8",
  );
  const BUILTINS = resolve(__dirname, "../../utils/dataset/builtins");

  test("151 toolbox block types, and the ribbon says so", () => {
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

  test("6 built-in datasets — the ribbon's total matches the number of dataset JSON files", () => {
    /* v2: the old per-dataset row-count chip row (§7, retired — see the
       retirement note above) is not one of the five sections and does not
       survive; only the undifferentiated ribbon total does, so this is
       what re-derives it now. */
    const files = readdirSync(BUILTINS).filter((f) => f.endsWith(".json"));
    expect(files).toHaveLength(6);
  });

  test("the keycap row is exactly the three shipped hotkeys — no invented fourth", () => {
    const { container, unmount } = mount();
    const items = [...container.querySelectorAll(".welcome-keys > li")];
    expect(items).toHaveLength(3);
    /* "run / stop", not "run": utils/hotkeys.js maps Ctrl/Cmd+Enter to
       "runToggle" — Run and Stop are one button in the viewport header and
       the keyboard matches it. Bare F5 maps to runToggle too; it is named
       in §1's helpref pointer to Help, and the row deliberately stays at
       the three chords a student is told to learn. */
    expect(items.map((li) => li.textContent.replace(/\s+/g, " ").trim())).toEqual([
      "Ctrl+Enter run / stop",
      "Esc stop",
      "Ctrl+S save",
    ]);
    // Keycaps are real <kbd> in the IDE's own treatment.
    expect(container.querySelectorAll(".welcome-keys kbd.tb-kbd")).toHaveLength(5);
    unmount();
  });

  test("the closing ribbon is six numerals inline with their labels — no tiles, no links, no hover-reveal", () => {
    const { container, unmount } = mount();
    const items = [...container.querySelectorAll(".welcome-ribbon__list li")];
    expect(items).toHaveLength(6);
    expect(items.map((li) => li.textContent.replace(/\s+/g, " ").trim())).toEqual([
      "151 block types",
      "18 worked projects",
      "6 built-in datasets",
      "6 chart types",
      "14 documentation sections",
      "0 servers doing your physics",
    ]);
    // No tiles, no anchors, no hover-revealed provenance notes (redesign brief).
    expect(container.querySelectorAll(".welcome-ribbon a")).toHaveLength(0);
    unmount();
  });
});
