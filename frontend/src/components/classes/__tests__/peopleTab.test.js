/**
 * Task 2 (Plan 9): the invite response's field renamed sent -> invited (the
 * old name was about to start lying, once neverThrow — backend/src/email/
 * guards.ts — sits outermost on app.mailer and swallows a driver
 * rejection). No test covered PeopleTab's invite-note sentence before this
 * file; it exists to pin the new wording and the new field it reads.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import PeopleTab from "../PeopleTab";
import { mountComponent } from "../../../test/renderHelpers";
import { useMutation } from "@tanstack/react-query";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: { members: [] }, error: null })),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("react-router-dom", () => ({ useParams: () => ({ id: "c1" }) }));
vi.mock("../ClassChrome", () => ({
  default: ({ children }) => children({ myRole: "teacher" }),
}));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function type(el, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function submit(form) {
  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("PeopleTab — invite note reads `invited`, not `sent`", () => {
  test('a successful invite renders "Invited N people"', () => {
    const mutate = vi.fn((_body, opts) => {
      opts.onSuccess({ invited: ["a@example.com", "b@example.com"], skipped: [] });
    });
    useMutation.mockReturnValue({ mutate, isPending: false });

    mounted = mountComponent(<PeopleTab />);
    const container = mounted.container;

    type(container.querySelector("textarea"), "a@example.com, b@example.com");
    submit(container.querySelector("form"));

    const note = container.querySelector("form .auth-text--dim");
    expect(note).not.toBeNull();
    expect(note.textContent).toBe("Invited 2 people");
  });

  test("skipped addresses still append onto the new sentence", () => {
    const mutate = vi.fn((_body, opts) => {
      opts.onSuccess({ invited: ["a@example.com"], skipped: ["already@example.com"] });
    });
    useMutation.mockReturnValue({ mutate, isPending: false });

    mounted = mountComponent(<PeopleTab />);
    const container = mounted.container;

    type(container.querySelector("textarea"), "a@example.com");
    submit(container.querySelector("form"));

    const note = container.querySelector("form .auth-text--dim");
    expect(note.textContent).toBe("Invited 1 people · already members: already@example.com");
  });
});
