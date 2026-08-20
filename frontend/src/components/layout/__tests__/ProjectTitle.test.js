import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import ProjectTitle from "../ProjectTitle";
import { mountComponent, click } from "../../../test/renderHelpers";
import { act } from "react";

let mounted = null;
afterEach(() => { mounted?.unmount(); mounted = null; });

function type(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function key(input, k) {
  act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));
}

describe("ProjectTitle", () => {
  test("renders the title as a button until it is clicked", () => {
    const onRename = vi.fn();
    mounted = mountComponent(<ProjectTitle title="Orbits" onRename={onRename} />);
    const btn = mounted.container.querySelector(".project-title");
    expect(btn.textContent).toBe("Orbits");
    expect(mounted.container.querySelector("input")).toBeNull();
    click(btn);
    expect(mounted.container.querySelector("input").value).toBe("Orbits");
  });

  test("Enter commits the new title", () => {
    const onRename = vi.fn();
    mounted = mountComponent(<ProjectTitle title="Orbits" onRename={onRename} />);
    click(mounted.container.querySelector(".project-title"));
    const input = mounted.container.querySelector("input");
    type(input, "Two-body orbits");
    key(input, "Enter");
    expect(onRename).toHaveBeenCalledWith("Two-body orbits");
    expect(mounted.container.querySelector("input")).toBeNull();
  });

  test("Escape cancels without renaming", () => {
    const onRename = vi.fn();
    mounted = mountComponent(<ProjectTitle title="Orbits" onRename={onRename} />);
    click(mounted.container.querySelector(".project-title"));
    const input = mounted.container.querySelector("input");
    type(input, "discard me");
    key(input, "Escape");
    expect(onRename).not.toHaveBeenCalled();
    expect(mounted.container.querySelector(".project-title").textContent).toBe("Orbits");
  });

  test("an untitled or absent project renders a placeholder and is not editable", () => {
    mounted = mountComponent(<ProjectTitle title="" onRename={vi.fn()} />);
    expect(mounted.container.querySelector(".project-title--empty").textContent).toBe("No project open");
    click(mounted.container.querySelector(".project-title"));
    expect(mounted.container.querySelector("input")).toBeNull();
  });
});
