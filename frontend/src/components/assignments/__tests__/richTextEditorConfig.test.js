import { describe, test, expect } from "vitest";
import { STARTER_KIT_OPTIONS } from "../RichTextEditor";

/**
 * RichTextEditor.js is never mounted in jsdom (TipTap is lazy and heavy —
 * see assignmentEditor.test.js, which mocks it out entirely). This suite
 * imports the module for its exported config object only — no `useEditor`
 * call, no DOM — to keep the editor/renderer vocabulary contract visible
 * and locked by a test, per the Task 7 review's fix requirement: StarterKit
 * v3 bundles `blockquote`/`codeBlock`/`link`/`strike`/`underline` by
 * default, none of which InstructionsView.js (Task 6) can render without
 * losing content (blockquote/codeBlock: the renderer's `default: return
 * null` drops the entire nested subtree, not just styling; link: the href
 * disappears with no fallback; strike/underline: silently unstyled). All
 * five must stay disabled so the editor can never emit vocabulary the
 * renderer drops.
 */
describe("RichTextEditor's StarterKit configuration", () => {
  test("disables every StarterKit extension InstructionsView cannot render", () => {
    expect(STARTER_KIT_OPTIONS.blockquote).toBe(false);
    expect(STARTER_KIT_OPTIONS.codeBlock).toBe(false);
    expect(STARTER_KIT_OPTIONS.link).toBe(false);
    expect(STARTER_KIT_OPTIONS.strike).toBe(false);
    expect(STARTER_KIT_OPTIONS.underline).toBe(false);
  });

  test("still limits headings to levels 2-4 and drops the horizontal rule", () => {
    expect(STARTER_KIT_OPTIONS.heading).toEqual({ levels: [2, 3, 4] });
    expect(STARTER_KIT_OPTIONS.horizontalRule).toBe(false);
  });

  test("leaves every extension a toolbar button drives enabled", () => {
    // bold/italic/code/bulletList/orderedList back the Bold/Italic/Code/
    // List/Numbered buttons — none of them appear in STARTER_KIT_OPTIONS,
    // so StarterKit's defaults (enabled) stand.
    for (const key of ["bold", "italic", "code", "bulletList", "orderedList"]) {
      expect(STARTER_KIT_OPTIONS[key]).toBeUndefined();
    }
  });
});
