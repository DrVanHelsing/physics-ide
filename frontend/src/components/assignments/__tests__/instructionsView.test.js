import { describe, test, expect, afterEach } from "vitest";
import React from "react";
import InstructionsView from "../InstructionsView";
import { mountComponent } from "../../../test/renderHelpers";

let mounted = null;
afterEach(() => { mounted?.unmount(); mounted = null; });

describe("InstructionsView", () => {
  test("renders paragraphs, headings, marks, and lists", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Overview" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Plain " },
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and " },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
            { type: "text", text: " and " },
            { type: "text", text: "code", marks: [{ type: "code" }] },
            { type: "text", text: "." },
          ],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }] },
          ],
        },
        {
          type: "orderedList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Step one" }] }] },
          ],
        },
      ],
    };
    mounted = mountComponent(<InstructionsView doc={doc} />);
    const { container } = mounted;

    // attrs.level 2 renders <h3> — the page's own <h2> owns the top level.
    const heading = container.querySelector("h3");
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe("Overview");

    const p = container.querySelector("p");
    expect(p.querySelector("strong").textContent).toBe("bold");
    expect(p.querySelector("em").textContent).toBe("italic");
    expect(p.querySelector("code").textContent).toBe("code");
    expect(p.textContent).toBe("Plain bold and italic and code.");

    const bulletItems = container.querySelectorAll("ul > li");
    expect(bulletItems.length).toBe(2);
    expect(bulletItems[0].textContent).toBe("First");
    expect(bulletItems[1].textContent).toBe("Second");

    const orderedItems = container.querySelectorAll("ol > li");
    expect(orderedItems.length).toBe(1);
    expect(orderedItems[0].textContent).toBe("Step one");
  });

  test("renders an image node as a lazy-loaded <img> with the data-URI src and alt", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "data:image/png;base64,AAAA", alt: "A free-body diagram" },
        },
      ],
    };
    mounted = mountComponent(<InstructionsView doc={doc} />);
    const img = mounted.container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("data:image/png;base64,AAAA");
    expect(img.getAttribute("alt")).toBe("A free-body diagram");
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  test("an image node whose src is not the schema's data-URI shape renders nothing", () => {
    // InstructionsDocSchema enforces this shape at write time; the renderer
    // re-checks it defensively so a future write path (migration, admin
    // tooling) that skipped the schema can't smuggle an external src through.
    const doc = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "https://evil.example.com/tracker.png", alt: "x" } }],
    };
    mounted = mountComponent(<InstructionsView doc={doc} />);
    expect(mounted.container.querySelector("img")).toBeNull();
  });

  test("renders an allow-listed youtube/vimeo source as a sandboxed iframe, everything else as a link", () => {
    const allowed = {
      type: "doc",
      content: [{ type: "youtube", attrs: { src: "https://www.youtube.com/embed/dQw4w9WgXcQ" } }],
    };
    mounted = mountComponent(<InstructionsView doc={allowed} />);
    const iframe = mounted.container.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");
    expect(iframe.getAttribute("title")).toBe("Embedded video");
    mounted.unmount();

    const vimeo = {
      type: "doc",
      content: [{ type: "youtube", attrs: { src: "https://player.vimeo.com/video/12345" } }],
    };
    mounted = mountComponent(<InstructionsView doc={vimeo} />);
    expect(mounted.container.querySelector("iframe")).toBeTruthy();
    mounted.unmount();

    const disallowed = {
      type: "doc",
      content: [{ type: "youtube", attrs: { src: "https://evil.example.com/embed/xyz" } }],
    };
    mounted = mountComponent(<InstructionsView doc={disallowed} />);
    expect(mounted.container.querySelector("iframe")).toBeNull();
    const link = mounted.container.querySelector("a");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("https://evil.example.com/embed/xyz");
  });

  test("a javascript: youtube src never becomes a clickable href — inert text only", () => {
    // attrs.src on a youtube node is NOT constrained by InstructionsDocSchema
    // (only image srcs are validated at write time), so the fallback link
    // path must defend itself against a non-http(s) scheme smuggled past
    // the EMBED_ALLOW regexes.
    const doc = {
      type: "doc",
      content: [{ type: "youtube", attrs: { src: "javascript:alert(document.cookie)" } }],
    };
    mounted = mountComponent(<InstructionsView doc={doc} />);
    const { container } = mounted;
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain("javascript:alert(document.cookie)");
  });

  test("renders a math node's LaTeX source synchronously, before KaTeX has a chance to upgrade it", () => {
    const doc = {
      type: "doc",
      content: [{ type: "math", attrs: { latex: "E = mc^2" } }],
    };
    mounted = mountComponent(<InstructionsView doc={doc} />);
    const math = mounted.container.querySelector("code.instructions-math");
    expect(math).toBeTruthy();
    expect(math.textContent).toBe("E = mc^2");
  });

  test("an unknown node type renders nothing and does not throw", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before" }] },
        { type: "somethingFromTheFuture", content: [{ type: "text", text: "should not appear" }] },
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
    };
    expect(() => {
      mounted = mountComponent(<InstructionsView doc={doc} />);
    }).not.toThrow();
    const { container } = mounted;
    expect(container.textContent).not.toContain("should not appear");
    expect(container.textContent).toContain("Before");
    expect(container.textContent).toContain("After");
  });
});
