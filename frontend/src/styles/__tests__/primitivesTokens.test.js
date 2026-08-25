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

  test("the portal migration aliases are retired — the selectors are the API (Task 13)", () => {
    // .admin-tab also covers .admin-tabs/.admin-tab--on; .welcome-btn covers
    // --primary/--small; a bare substring match is the point: not even a
    // comment may carry these names forward.
    const RETIRED = [
      ".admin-btn", ".welcome-btn", ".account-chip-btn", ".auth-submit",
      ".auth-input", ".auth-error", ".auth-card", ".class-card",
      ".welcome-card", ".classes-newform", ".account-chip-badge",
      ".class-archived-badge", ".admin-tab",
    ];
    for (const name of RETIRED) expect(CSS).not.toContain(name);
  });

  test("the IDE aliases this plan deliberately keeps are still declared", () => {
    // The portal migrated; the IDE did not. The file should say which is which.
    const KEPT = [
      ".vdialog-btn", ".vdialog-btn--ok", ".pane-header", ".vdialog-header",
      ".start-card", ".start-empty",
    ];
    for (const sel of KEPT) {
      expect(CSS).toMatch(new RegExp(`(^|[,\\s])\\${sel}[\\s,{]`, "m"));
    }
  });
});
