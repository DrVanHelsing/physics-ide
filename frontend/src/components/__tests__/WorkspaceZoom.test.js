import { describe, test, expect, vi } from "vitest";
import { act } from "react";
import { mountComponent, click } from "../../test/renderHelpers";
import WorkspaceZoom from "../WorkspaceZoom";

describe("WorkspaceZoom", () => {
  test("steps, clamps, and fits", async () => {
    const onZoomChange = vi.fn();
    const ws = { zoomToFit: vi.fn(), getScale: () => 1.23 };
    const { container } = await mountComponent(
      <WorkspaceZoom zoom={195} onZoomChange={onZoomChange} workspaceRef={{ current: ws }} />
    );
    expect(container.textContent).toContain("195%");
    await act(() => click(container.querySelector('[title="Zoom in"]')));
    expect(onZoomChange).toHaveBeenCalledWith(200); // clamped to ZOOM_MAX
    await act(() => click(container.querySelector('[title="Zoom out"]')));
    expect(onZoomChange).toHaveBeenCalledWith(185);
    await act(() => click(container.querySelector('[title="Fit blocks to view"]')));
    expect(ws.zoomToFit).toHaveBeenCalled();
    expect(onZoomChange).toHaveBeenLastCalledWith(123); // read back after fit
  });
});
