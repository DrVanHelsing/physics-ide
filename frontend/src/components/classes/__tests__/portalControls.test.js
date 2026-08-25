import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "../../..");   // frontend/src

// Task 13: both lanes have merged, so every portal directory is covered and
// this is the FULL set of migration aliases primitives.css once carried.
// None of these names is an API — .btn/.card/.input/.alert/.badge/.tabs
// (primitives.css) and the platform-specific classes are. A hit here is a
// regression: fix the markup, never re-add the alias.
const DIRS = ["components/auth", "components/classes", "components/admin", "sync", "welcome"];
const ALIASES = [
  "admin-btn", "admin-btn--primary",
  "welcome-btn", "welcome-btn--small",
  "account-chip-btn",
  "auth-submit", "auth-input", "auth-error", "auth-card", "auth-title",
  "class-card", "welcome-card", "classes-newform",
  "account-chip-badge", "class-archived-badge",
  "admin-tabs", "admin-tab", "admin-tab--on",
];

// A class token, not a substring: "admin-tab" must flag class="admin-tab"
// without flagging the element id `admin-tab-People` (hyphen continues the
// token) or the platform class "admin-table" (word char continues it).
function aliasPattern(alias) {
  return new RegExp('["\'`\\s]' + alias + '(?![\\w-])');
}

function portalSources() {
  const out = [];
  for (const d of DIRS) {
    for (const f of readdirSync(join(ROOT, d))) {
      if (f.endsWith(".js")) out.push([`${d}/${f}`, readFileSync(join(ROOT, d, f), "utf8")]);
    }
  }
  return out;
}

describe("the portal uses the primitive API, not the migration aliases", () => {
  test("no legacy alias appears in portal markup", () => {
    const hits = [];
    for (const [name, src] of portalSources()) {
      for (const alias of ALIASES) {
        if (aliasPattern(alias).test(src)) hits.push(`${name}: ${alias}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
