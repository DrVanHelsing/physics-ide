import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import Overlay from "../Overlay";
import { mountComponent, keyDown, mouseDown } from "../../../test/renderHelpers";

let mounted = null;
afterEach(() => { mounted?.unmount(); mounted = null; });

describe("Overlay", () => {
  test("carries dialog semantics", () => {
    mounted = mountComponent(<Overlay onClose={vi.fn()} label="Save run"><p>body</p></Overlay>);
    const el = mounted.container.querySelector('[role="dialog"]');
    expect(el.getAttribute("aria-modal")).toBe("true");
    expect(el.getAttribute("aria-label")).toBe("Save run");
  });

  test("Escape closes", () => {
    const onClose = vi.fn();
    mounted = mountComponent(<Overlay onClose={onClose} label="X"><p>body</p></Overlay>);
    keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a backdrop click closes but a click inside does not", () => {
    const onClose = vi.fn();
    mounted = mountComponent(
      <Overlay onClose={onClose} label="X"><button type="button" id="inner">ok</button></Overlay>,
    );
    mouseDown(mounted.container.querySelector("#inner"));
    expect(onClose).not.toHaveBeenCalled();
    mouseDown(mounted.container.querySelector(".overlay-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("dismissOnBackdrop={false} keeps the backdrop inert", () => {
    const onClose = vi.fn();
    mounted = mountComponent(
      <Overlay onClose={onClose} label="X" dismissOnBackdrop={false}><p>body</p></Overlay>,
    );
    mouseDown(mounted.container.querySelector(".overlay-backdrop"));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("focus moves in on mount and returns on unmount", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    mounted = mountComponent(
      <Overlay onClose={vi.fn()} label="X"><button type="button" id="first">ok</button></Overlay>,
    );
    expect(mounted.container.querySelector(".overlay-panel").contains(document.activeElement)).toBe(true);

    mounted.unmount();
    mounted = null;
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
