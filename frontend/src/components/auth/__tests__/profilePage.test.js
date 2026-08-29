import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import ProfilePage from "../ProfilePage";
import { mountComponent, click } from "../../../test/renderHelpers";
import { useMe } from "../../../auth/useAuth";
import { useTheme } from "../../../contexts/ThemeContext";
import { api } from "../../../utils/api/client";
import { SWITCHABLE_EMAIL_KEYS } from "@physics-ide/shared";

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
const { setQueryData } = vi.hoisted(() => ({ setQueryData: vi.fn() }));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ setQueryData }) }));
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

const PREFS_ALL_ON = Object.fromEntries(SWITCHABLE_EMAIL_KEYS.map((k) => [k, true]));
const ME_WITH_PREFS = { ...ME, notificationPrefs: PREFS_ALL_ON };

/** Find the `.pref-row` <label> whose visible text exactly matches, and
 *  return its checkbox — the same idiom as rulesPicker.test.js's inputFor. */
function prefCheckbox(container, labelText) {
  const row = [...container.querySelectorAll(".pref-row")].find(
    (el) => el.textContent.replace(/\s+/g, " ").trim() === labelText,
  );
  return row ? row.querySelector("input[type='checkbox']") : null;
}

/** Dispatch a bubbling submit event and flush the async handler's microtasks
 *  — same pattern as TraceTable.test.js's submit() + rulesPicker.test.js's
 *  flush(), combined since savePrefs awaits `api()` before settling. */
async function submitAndFlush(form) {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

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

/**
 * Plan 8 Task 8 — the five Profile switches riding PATCH /api/auth/me.
 * SWITCHABLE_EMAIL_KEYS stays the one source of the key set; this suite only
 * checks the UI renders and wires it, not the label copy.
 */
describe("ProfilePage — notification prefs", () => {
  test("renders five labelled checkboxes seeded from me.notificationPrefs, and the honesty hint verbatim", () => {
    useMe.mockReturnValue({ data: ME_WITH_PREFS, isLoading: false });
    mounted = mountComponent(<ProfilePage />);

    const checkboxes = mounted.container.querySelectorAll(".pref-row input[type='checkbox']");
    expect(checkboxes).toHaveLength(5);
    checkboxes.forEach((cb) => expect(cb.checked).toBe(true));

    const hint = mounted.container.querySelector(".auth-hint");
    expect(hint).not.toBeNull();
    expect(hint.textContent).toBe(
      "These switch the emails off. The bell in the header always shows everything.",
    );
  });

  test("seeds from a false value too — not every row defaults on", () => {
    useMe.mockReturnValue({
      data: { ...ME_WITH_PREFS, notificationPrefs: { ...PREFS_ALL_ON, "due-tomorrow": false } },
      isLoading: false,
    });
    mounted = mountComponent(<ProfilePage />);

    expect(prefCheckbox(mounted.container, "Due-tomorrow reminders").checked).toBe(false);
    expect(prefCheckbox(mounted.container, "Marks released").checked).toBe(true);
  });

  test("toggling a switch and submitting PATCHes the full map and writes the reply into the ME cache", async () => {
    useMe.mockReturnValue({ data: ME_WITH_PREFS, isLoading: false });
    const freshUser = {
      ...ME_WITH_PREFS,
      notificationPrefs: { ...PREFS_ALL_ON, "due-tomorrow": false },
    };
    api.mockResolvedValueOnce({ user: freshUser });
    mounted = mountComponent(<ProfilePage />);

    const checkbox = prefCheckbox(mounted.container, "Due-tomorrow reminders");
    expect(checkbox.checked).toBe(true);
    click(checkbox);
    expect(checkbox.checked).toBe(false);

    const form = checkbox.closest("form");
    await submitAndFlush(form);

    expect(api).toHaveBeenCalledWith("/api/auth/me", {
      method: "PATCH",
      body: { notificationPrefs: { ...PREFS_ALL_ON, "due-tomorrow": false } },
    });
    expect(setQueryData).toHaveBeenCalledWith(["me"], freshUser);
  });
});
