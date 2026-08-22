import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS = readFileSync(resolve(__dirname, "../primitives.css"), "utf8");
const PAGES = readFileSync(resolve(__dirname, "../pages.css"), "utf8");

const REQUIRED = [
  ".input", ".alert", ".alert--info", ".alert--success", ".alert--warning",
  ".alert--danger", ".badge", ".empty", ".tabs", ".tab", ".tab--on", ".range",
];

describe("primitives.css — the six components the portal was re-inventing", () => {
  test("every new primitive is declared here", () => {
    for (const sel of REQUIRED) {
      expect(CSS).toMatch(new RegExp(`(^|[,\\s])\\${sel}[\\s,{]`, "m"));
    }
  });

  test(".start-empty is promoted, not duplicated", () => {
    expect(CSS).toContain(".start-empty");     // aliased onto .empty here
    expect(PAGES).not.toContain(".start-empty"); // and gone from pages.css
  });

  test("no primitive redefines the one focus ring", () => {
    // D8: exactly one :focus rule ships, and it is the :where() block in
    // tokens.css. .input in particular must not repeat .auth-input's mistake.
    expect(CSS).not.toMatch(/:focus\b/);
  });

  test("the danger colours stay inside the reserved red band's own token", () => {
    // No portal primitive introduces a red literal; --red/--danger only.
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
