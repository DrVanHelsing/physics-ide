import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import HeaderAccount from "../HeaderAccount";
import { mountComponent, click, byText } from "../../../test/renderHelpers";
import { useMe, useSignout } from "../../../auth/useAuth";

/* HeaderAccount calls useMe()/useSignout() (TanStack Query) and useNavigate()
   (react-router-dom) directly — stub all three so this suite runs with no
   QueryClientProvider and no mounted Router, using the Task 2 harness. */
vi.mock("../../../auth/useAuth", () => ({
  useMe: vi.fn(),
  useSignout: vi.fn(),
}));

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  navigateMock.mockClear();
});

function renderAccount() {
  mounted = mountComponent(<HeaderAccount />);
  return mounted.container;
}

function openMenu(container) {
  click(container.querySelector(".tb-btn--account"));
}

describe("HeaderAccount", () => {
  test("guest render: shows Guest, no member-only items, sign-in/sign-up present", () => {
    useMe.mockReturnValue({ data: null, isLoading: false });
    useSignout.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    const container = renderAccount();
    expect(container.querySelector(".tb-btn--account").textContent).toContain("Guest");
    openMenu(container);
    expect(byText(container, "My classes")).toBeNull();
    expect(byText(container, "Profile")).toBeNull();
    expect(byText(container, "Admin console")).toBeNull();
    expect(byText(container, "Sign out")).toBeNull();
    expect(byText(container, "Sign in")).not.toBeNull();
    expect(byText(container, "Create account")).not.toBeNull();
  });

  test("member render: member items present, guest-only items absent", () => {
    useMe.mockReturnValue({
      data: { id: "1", name: "Ada", email: "ada@example.com", emailConfirmed: true, role: "member" },
      isLoading: false,
    });
    useSignout.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    const container = renderAccount();
    const trigger = container.querySelector(".tb-btn--account");
    expect(trigger.textContent).toContain("Ada");
    // No aria-label override: the accessible name must fall back to the visible
    // text ("Ada"), not the title ("Signed in as ada@example.com"), which does
    // not contain it (WCAG 2.5.3 Label in Name).
    expect(trigger.hasAttribute("aria-label")).toBe(false);
    openMenu(container);
    expect(byText(container, "My classes")).not.toBeNull();
    expect(byText(container, "Profile")).not.toBeNull();
    expect(byText(container, "Sign out")).not.toBeNull();
    expect(byText(container, "Admin console")).toBeNull();
    expect(byText(container, "Sign in")).toBeNull();
  });

  test("sign-out wiring: clicking Sign out invokes the signout mutation", () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    useMe.mockReturnValue({
      data: { id: "1", name: "Ada", email: "ada@example.com", emailConfirmed: true, role: "member" },
      isLoading: false,
    });
    useSignout.mockReturnValue({ mutateAsync, isPending: false });

    const container = renderAccount();
    openMenu(container);
    click(byText(container, "Sign out"));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });
});
