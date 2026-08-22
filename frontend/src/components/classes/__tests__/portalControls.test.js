import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "../../..");   // frontend/src

// Lane W is rewriting welcome/ concurrently on its own branch and still uses
// a legacy `welcome-btn` alias there — including it here would fail this
// lane's test against work that hasn't merged yet. Task 11 (Lane W) retires
// welcome-btn on its own files; Task 13 widens this list to include welcome/
// once both lanes have merged and asserts the final combined state.
const DIRS = ["components/auth", "components/classes", "components/admin", "sync"];
const ALIASES = ["admin-btn", "auth-submit", "account-chip-btn"];

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
  test("no legacy button alias appears in portal markup", () => {
    const hits = [];
    for (const [name, src] of portalSources()) {
      for (const alias of ALIASES) {
        if (src.includes(`"${alias}`) || src.includes(` ${alias}`)) hits.push(`${name}: ${alias}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
