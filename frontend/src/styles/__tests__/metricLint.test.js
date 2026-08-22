import { describe, test, expect } from "vitest";
import { metricViolations } from "./metricLint";

describe("metricViolations — passing fixture", () => {
  test("a stylesheet built entirely from tokens (and properties the pass never covers) reports nothing", () => {
    const css = `
.card {
  font-size: var(--fs-md);
  padding: var(--space-4, 16px);
  margin: 0 auto;
  border-radius: 50%;
  line-height: var(--lh-normal);
  transition: opacity var(--transition-slow);
}
.shape {
  width: 420px;
  border: 1px solid var(--border);
  animation-duration: 7s;
}
.orbit {
  /* metric-exempt: orbit geometry */
  line-height: 1.55;
}
`;
    expect(metricViolations(css)).toEqual([]);
  });
});

describe("metricViolations — failing fixture", () => {
  test("literal metrics on covered properties are each reported, and only those", () => {
    const css = `
.bad {
  font-size: 13px;
  line-height: 1.55;
  z-index: 4000;
  transition: opacity 0.5s ease;
  width: 420px;
  border: 1px solid var(--border);
}
`;
    const violations = metricViolations(css);
    expect(violations.length).toBe(4);
    expect(violations.some((v) => v.includes("font-size: 13px"))).toBe(true);
    expect(violations.some((v) => v.includes("line-height: 1.55"))).toBe(true);
    expect(violations.some((v) => v.includes("z-index: 4000"))).toBe(true);
    expect(violations.some((v) => v.includes("transition: opacity 0.5s ease"))).toBe(true);
  });
});

describe("metricViolations — per-declaration behaviour", () => {
  test.each([
    ["font-size: 13px;", true],
    ["font-size: var(--fs-md);", false],
    ["padding: var(--space-4, 16px);", false],
    ["margin: 0 auto;", false],
    ["border-radius: 50%;", false],
    ["line-height: 1.55;", true],
    ["line-height: var(--lh-normal);", false],
    ["z-index: 4000;", true],
    ["width: 420px;", false],
    ['border: 1px solid var(--border);', false],
    ["animation-duration: 7s;", false],
    ["transition: opacity 0.5s ease;", true],
    ["transition: opacity var(--transition-slow);", false],
  ])("%s -> flagged: %s", (decl, shouldFlag) => {
    const css = `.x {\n  ${decl}\n}`;
    expect(metricViolations(css).length > 0).toBe(shouldFlag);
  });
});

describe("metricViolations — metric-exempt escape hatch", () => {
  test("a declaration preceded by a metric-exempt comment on its own line is not flagged", () => {
    const css = `
.orbit {
  /* metric-exempt: orbit geometry */
  line-height: 1.55;
}
`;
    expect(metricViolations(css)).toEqual([]);
  });

  test("without the comment, the same declaration is flagged", () => {
    const css = `
.orbit {
  line-height: 1.55;
}
`;
    expect(metricViolations(css).length).toBeGreaterThan(0);
  });
});
