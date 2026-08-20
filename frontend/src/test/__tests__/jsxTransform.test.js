import { describe, test, expect } from "vitest";
import JsxProbe from "../jsxProbe";

describe("vitest transforms JSX inside .js files", () => {
  test("a JSX-bearing .js module imports and returns a React element", () => {
    expect(typeof JsxProbe).toBe("function");
    const el = JsxProbe({ label: "hello" });
    expect(el.type).toBe("button");
    expect(el.props.className).toBe("jsx-probe");
    expect(el.props.children).toBe("hello");
  });
});
