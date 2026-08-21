import { describe, test, expect, afterEach } from "vitest";
import React from "react";
import { useRunErrorBanner } from "../useRunErrorBanner";
import { mountComponent, click } from "../../test/renderHelpers";

/**
 * A small focused component test rather than an IDELayout mount: IDELayout
 * composes BlocklyWorkspace, GlowCanvas, DataPanel and half a dozen hooks —
 * mounting the real thing would mean mocking all of that just to exercise
 * one piece of state logic. This harness calls the actual production hook
 * (no reimplemented logic) and exposes just enough DOM to assert on.
 */
function Harness({ status, running, sessionKey }) {
  const [bannerText, dismiss] = useRunErrorBanner(status, running, sessionKey);
  return (
    <div>
      <p className="banner-text">{bannerText ?? ""}</p>
      <button type="button" onClick={dismiss}>Dismiss</button>
    </div>
  );
}

let mounted = null;
afterEach(() => { mounted?.unmount(); mounted = null; });

describe("useRunErrorBanner", () => {
  test("latches an error and survives a later unrelated status write", () => {
    mounted = mountComponent(<Harness status={{ type: "error", text: "Boom" }} running={false} />);
    expect(mounted.container.querySelector(".banner-text").textContent).toBe("Boom");

    // A later, unrelated status write — export success, mode switch, workspace
    // clear, debug entry, ... — must not overwrite the latched banner.
    mounted.rerender(<Harness status={{ type: "success", text: "Exported code.py" }} running={false} />);
    expect(mounted.container.querySelector(".banner-text").textContent).toBe("Boom");
  });

  test("clears on explicit dismiss", () => {
    mounted = mountComponent(<Harness status={{ type: "error", text: "Boom" }} running={false} />);
    click(mounted.container.querySelector("button"));
    expect(mounted.container.querySelector(".banner-text").textContent).toBe("");
  });

  test("clears when a new run starts", () => {
    mounted = mountComponent(<Harness status={{ type: "error", text: "Boom" }} running={false} />);
    expect(mounted.container.querySelector(".banner-text").textContent).toBe("Boom");

    // handleRun sets status to {type: "", text: "Running..."} and running to
    // true in the same tick — the stale error must not overlay the new run.
    mounted.rerender(<Harness status={{ type: "", text: "Running..." }} running={true} />);
    expect(mounted.container.querySelector(".banner-text").textContent).toBe("");
  });

  test("a newer error replaces the latched one", () => {
    mounted = mountComponent(<Harness status={{ type: "error", text: "First error" }} running={false} />);
    mounted.rerender(<Harness status={{ type: "error", text: "Second error" }} running={false} />);
    expect(mounted.container.querySelector(".banner-text").textContent).toBe("Second error");
  });

  test("clears when the session key changes — an error belongs to one project's run", () => {
    mounted = mountComponent(
      <Harness status={{ type: "error", text: "Boom" }} running={false} sessionKey="project-a" />,
    );
    expect(mounted.container.querySelector(".banner-text").textContent).toBe("Boom");

    // Navigating to a different project (or back to the start menu and into
    // another one) must not carry the previous project's error along.
    mounted.rerender(
      <Harness status={{ type: "error", text: "Boom" }} running={false} sessionKey="project-b" />,
    );
    expect(mounted.container.querySelector(".banner-text").textContent).toBe("");
  });
});
