import { describe, test, expect, vi } from "vitest";
import { mountComponent } from "../../test/renderHelpers";
import CodeEditor from "../CodeEditor";

vi.mock("../../utils/monaco/monacoLib", () => {
  throw new Error("simulated bundle failure");
});

describe("CodeEditor fallback", () => {
  test("renders the plain textarea when the Monaco bundle fails to load", async () => {
    const { container } = await mountComponent(
      <CodeEditor value="x = 1" onChange={() => {}} isDark />
    );
    // the dynamic import rejects -> fallback state -> textarea
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector("textarea.text-fallback")).toBeTruthy();
    expect(container.querySelector(".monaco-host")).toBeFalsy();
  });
});
