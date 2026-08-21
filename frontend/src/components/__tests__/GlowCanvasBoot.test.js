/**
 * Task 12 — the idle atom is the boot loader.
 *
 * The separate `.canvas-booting` spinner overlay is gone. Booting is now
 * communicated by animating the idle atom in place (a `canvas-idle--booting`
 * modifier) rather than layering a second element on top of it.
 */
import { describe, test, expect, vi } from "vitest";
import { mountComponent } from "../../test/renderHelpers";
import GlowCanvas from "../GlowCanvas";

vi.mock("../../utils/runner/glowRunner", async (orig) => ({
  ...(await orig()),
  applyRuntimeTheme: vi.fn(),
  getSceneMeta: () => ({}),
  getRuntimeScene: () => null,
}));

describe("GlowCanvas boot state", () => {
  test("booting animates the idle atom in place — no spinner overlay", async () => {
    const { container } = await mountComponent(<GlowCanvas running booting onStatus={() => {}} />);
    expect(container.querySelector(".canvas-idle--booting")).toBeTruthy();
    expect(container.querySelector(".canvas-booting")).toBeFalsy();
    expect(container.querySelector(".canvas-booting__spinner")).toBeFalsy();
    expect(container.textContent).toContain("Starting simulation");
    const status = container.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status.textContent).toContain("Starting simulation");
  });
  test("idle shows the static atom and the Run hint", async () => {
    const { container } = await mountComponent(<GlowCanvas running={false} booting={false} onStatus={() => {}} />);
    expect(container.querySelector(".canvas-idle--booting")).toBeFalsy();
    expect(container.textContent).toContain("Press");
    expect(container.querySelector('[role="status"]')).toBeFalsy();
  });
});
