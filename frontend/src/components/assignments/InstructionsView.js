import React, { useEffect, useState } from "react";

/**
 * Read-only renderer for the instructions doc `InstructionsDocSchema`
 * (shared/src/assignments.ts) validates: a `{type:"doc", content:[...]}`
 * tree of paragraph / heading / bulletList / orderedList / listItem / text
 * (bold, italic, code marks) / image / youtube / callout / math nodes.
 *
 * Pure and dependency-free — no TipTap in the student bundle (that lives in
 * the teacher-only editor, Task 7). KaTeX is the one exception, and even it
 * loads lazily: `math` nodes render their LaTeX source as plain text the
 * instant the doc mounts, and only if the doc actually contains a `math`
 * node does a `useEffect` reach for `import("katex")` to upgrade them.
 * Students whose assignments carry no formulas never pay for the library.
 *
 * Unknown node types render nothing rather than throwing — the schema
 * deliberately does not enumerate every node type (see its own comment),
 * so a doc written by a newer editor must still degrade gracefully here.
 */

const EMBED_ALLOW = [
  /^https:\/\/www\.youtube\.com\/embed\//,
  /^https:\/\/player\.vimeo\.com\//,
];

// Mirrors InstructionsDocSchema's image.attrs.src shape (shared/src/assignments.ts)
// — duplicated rather than imported so this stays a pure, dependency-free
// renderer. If the schema's shape ever changes, this constant needs the
// same edit. The renderer re-checks it defensively: the schema only runs
// at write time, and a future write path (a migration, admin tooling) that
// skipped it should not be able to smuggle an external or otherwise
// unexpected src through to the DOM.
const IMAGE_SRC = /^data:image\/(png|jpeg|webp);base64,/;

/**
 * True only for an absolute http(s) URL. `attrs.src` on a youtube node is
 * NOT constrained by InstructionsDocSchema (only image srcs are validated
 * at write time) — the fallback link below renders arbitrary doc content
 * as a clickable href, so it must never do that for a `javascript:` or
 * other non-http(s) scheme. Anything that fails to parse, or parses to a
 * scheme other than http/https, is rejected.
 */
function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function collectMathNodes(node, out) {
  if (!node || typeof node !== "object") return out;
  if (node.type === "math") out.push(node);
  for (const child of node.content ?? []) collectMathNodes(child, out);
  return out;
}

export default function InstructionsView({ doc }) {
  // Map<mathNode, renderedHtml> once KaTeX has upgraded them; null until then
  // (or forever, for a doc with no math nodes at all).
  const [mathHtml, setMathHtml] = useState(null);

  useEffect(() => {
    let disposed = false;
    const mathNodes = collectMathNodes(doc, []);
    if (mathNodes.length === 0) return undefined;

    import("katex")
      .then(async (mod) => {
        if (disposed) return;
        await import("katex/dist/katex.min.css");
        if (disposed) return;
        const katex = mod.default ?? mod;
        const next = new Map();
        for (const node of mathNodes) {
          next.set(node, katex.renderToString(node.attrs?.latex ?? "", { throwOnError: false }));
        }
        setMathHtml(next);
      })
      .catch(() => {
        // Bundle failed to load — the synchronous <code> fallback stands.
      });

    return () => {
      disposed = true;
    };
  }, [doc]);

  return <div className="instructions">{renderChildren(doc?.content, mathHtml)}</div>;
}

function renderChildren(content, mathHtml) {
  return (content ?? []).map((node, i) => renderNode(node, i, mathHtml));
}

function renderNode(node, key, mathHtml) {
  if (!node || typeof node !== "object") return null;

  switch (node.type) {
    case "paragraph":
      return <p key={key}>{renderChildren(node.content, mathHtml)}</p>;

    case "heading": {
      // The page's own <h2> owns the top of the hierarchy, so an
      // instructions doc's headings step down one level: attrs.level 2-4
      // renders as h3-h5.
      const level = node.attrs?.level ?? 2;
      const Tag = `h${level + 1}`;
      return <Tag key={key}>{renderChildren(node.content, mathHtml)}</Tag>;
    }

    case "bulletList":
      return <ul key={key}>{renderChildren(node.content, mathHtml)}</ul>;

    case "orderedList":
      return <ol key={key}>{renderChildren(node.content, mathHtml)}</ol>;

    case "listItem":
      return <li key={key}>{renderChildren(node.content, mathHtml)}</li>;

    case "image": {
      const attrs = node.attrs ?? {};
      if (!IMAGE_SRC.test(attrs.src ?? "")) return null;
      return <img key={key} src={attrs.src} alt={attrs.alt ?? ""} loading="lazy" />;
    }

    case "youtube": {
      const src = node.attrs?.src ?? "";
      if (EMBED_ALLOW.some((re) => re.test(src))) {
        return (
          <iframe
            key={key}
            src={src}
            sandbox="allow-scripts allow-same-origin"
            title="Embedded video"
          />
        );
      }
      // Not on the allow-list — a plain link, but only for a genuine
      // http(s) URL. Anything else (javascript:, data:, a malformed
      // string) renders as inert text, never a clickable href.
      if (isHttpUrl(src)) {
        return (
          <a key={key} href={src} target="_blank" rel="noreferrer noopener">
            {src}
          </a>
        );
      }
      return src;
    }

    case "callout":
      return (
        <div key={key} className="instructions-callout">
          {renderChildren(node.content, mathHtml)}
        </div>
      );

    case "math": {
      const latex = node.attrs?.latex ?? "";
      const html = mathHtml?.get(node);
      if (html) {
        // KaTeX's own output, generated from the latex string above — not
        // raw user HTML.
        return (
          <code key={key} className="instructions-math" dangerouslySetInnerHTML={{ __html: html }} />
        );
      }
      return (
        <code key={key} className="instructions-math">
          {latex}
        </code>
      );
    }

    case "text":
      return renderText(node, key);

    default:
      return null;
  }
}

function renderText(node, key) {
  let el = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") el = <strong key={key}>{el}</strong>;
    else if (mark.type === "italic") el = <em key={key}>{el}</em>;
    else if (mark.type === "code") el = <code key={key}>{el}</code>;
  }
  return el;
}
