import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import ProfilePage from "../ProfilePage";
import { mountComponent } from "../../../test/renderHelpers";
import { useMe } from "../../../auth/useAuth";
import { useTheme } from "../../../contexts/ThemeContext";

/**
 * F2 / N2 (2026-08-28 UI audit) — `/profile` was a navigational dead end:
 * AuthLayout put a lone theme toggle in an otherwise empty header, so a user
 * who reached Profile & settings from the account menu had no in-app way out.
 * The fix is the SAME affordance every other stranded page got — one
 * `.back-link`, naming its real destination — not a browser-history "back".
 *
 * Same stub idiom as HeaderAccount.test.js: react-router-dom, useMe() and
 * useTheme() are stubbed so this mounts with no Router, no QueryClient and no
 * ThemeProvider.
 */
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ setQueryData: vi.fn() }) }));
vi.mock("../../../auth/useAuth", () => ({ useMe: vi.fn(), ME_KEY: ["me"] }));
vi.mock("../../../contexts/ThemeContext", () => ({ useTheme: vi.fn() }));
vi.mock("react-router-dom", () => ({
  Navigate: () => null,
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

const ME = { id: "u1", email: "teacher@example.test", name: "Tee", role: "member", isTeacher: true, emailConfirmed: true };

let mounted = null;

beforeEach(() => {
  useMe.mockReturnValue({ data: ME, isLoading: false });
  useTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

describe("ProfilePage — the way out", () => {
  test("renders one .back-link to /classes, named for where it actually goes", () => {
    mounted = mountComponent(<ProfilePage />);
    const back = mounted.container.querySelector(".back-link");
    expect(back).not.toBeNull();
    expect(back.getAttribute("href")).toBe("/classes");
    expect(back.textContent.replace(/\s+/g, " ").trim()).toBe("Back to my classes");
  });
});
