import React, { useEffect, useRef, useState } from "react";
import { EditorContent, Node, mergeAttributes, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { MAX_INSTRUCTIONS_IMAGE_BYTES } from "@physics-ide/shared";

/**
 * The TipTap wrapper behind AssignmentEditorPage's lazy boundary — this
 * module (and every package it imports) is teacher-only weight; nothing
 * here may be imported eagerly by any student-facing screen.
 *
 * Its node vocabulary is a strict contract with InstructionsView.js
 * (Task 6, the read-only renderer): `youtube` emits exactly
 * `{type:"youtube", attrs:{src}}` and `math` emits exactly
 * `{type:"math", attrs:{latex}}`, the same shapes that renderer's switch
 * matches on. StarterKit + `@tiptap/extension-image` cover every other
 * node/mark InstructionsView knows (paragraph, heading, lists, bold,
 * italic, code, image) — the renderer tolerates any node it doesn't
 * recognise (own doc comment: "Unknown node types render nothing rather
 * than throwing"), so StarterKit's few extras (blockquote, links, ...)
 * degrade gracefully there rather than needing to be pared down here.
 */

const IMAGE_TOO_LARGE = "That image is too large (200 KB max).";
const IMAGE_BAD_TYPE = "Images must be PNG, JPEG, or WebP.";
const VIDEO_REFUSED = "That isn't a YouTube or Vimeo link this editor can embed.";
const ALLOWED_IMAGE_MIME = /^image\/(png|jpeg|webp)$/;
const VIDEO_ID = /^[\w-]{6,64}$/;

/** An atom block node: `{type:"youtube", attrs:{src}}`. `src` is always
 *  produced by `toEmbedSrc` below, so it always matches InstructionsView's
 *  EMBED_ALLOW list — the editor never round-trips an arbitrary src. */
const YoutubeNode = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: "div[data-youtube]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-youtube": "", class: "rte-embed" }),
      ["span", {}, node.attrs.src ?? ""],
    ];
  },
});

/** An atom inline node: `{type:"math", attrs:{latex}}`, rendered in the
 *  editor as its raw LaTeX in a <code> — the same synchronous fallback
 *  InstructionsView shows before KaTeX has a chance to upgrade it. */
const MathNode = Node.create({
  name: "math",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { latex: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "code[data-math]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["code", mergeAttributes(HTMLAttributes, { "data-math": "", class: "instructions-math" }), node.attrs.latex ?? ""];
  },
});

/**
 * Rewrites a pasted YouTube/Vimeo watch/share URL to the exact embed form
 * InstructionsView's EMBED_ALLOW regexes accept
 * (https://www.youtube.com/embed/<id> or https://player.vimeo.com/video/<id>).
 * Returns null for anything it cannot rewrite — the caller refuses those
 * inline rather than inserting an unembeddable or unsafe src.
 */
export function toEmbedSrc(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtube.com") {
    if (url.pathname === "/watch") {
      const v = url.searchParams.get("v");
      return v && VIDEO_ID.test(v) ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (url.pathname.startsWith("/embed/")) {
      const v = url.pathname.slice("/embed/".length);
      return VIDEO_ID.test(v) ? `https://www.youtube.com/embed/${v}` : null;
    }
    return null;
  }
  if (host === "youtu.be") {
    const v = url.pathname.slice(1);
    return VIDEO_ID.test(v) ? `https://www.youtube.com/embed/${v}` : null;
  }
  if (host === "vimeo.com") {
    const v = url.pathname.split("/").filter(Boolean)[0];
    return v && /^\d+$/.test(v) ? `https://player.vimeo.com/video/${v}` : null;
  }
  if (host === "player.vimeo.com") {
    const m = url.pathname.match(/^\/video\/(\d+)$/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  }
  return null;
}

export default function RichTextEditor({ value, onChange }) {
  const [toolbarError, setToolbarError] = useState(null);
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // The renderer steps headings down one level (attrs.level 2 -> <h3>,
        // spec: the page's own <h2> owns the top of the hierarchy) and has
        // no <hr> presentation at all.
        heading: { levels: [2, 3, 4] },
        horizontalRule: false,
      }),
      Image.configure({ allowBase64: true }),
      YoutubeNode,
      MathNode,
    ],
    content: value,
    onUpdate: ({ editor: ed }) => onChange(ed.getJSON()),
  });

  // If `value` changes from outside after the editor has mounted (e.g. an
  // edit-mode GET seeding the form once the network response lands after
  // the lazy chunk already resolved), push it into the editor.
  useEffect(() => {
    if (!editor) return undefined;
    const incoming = JSON.stringify(value ?? {});
    const current = JSON.stringify(editor.getJSON());
    if (incoming !== current) editor.commands.setContent(value, false);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  if (!editor) return null;

  function insertVideo() {
    const raw = window.prompt("Paste a YouTube or Vimeo URL");
    if (raw == null || raw.trim() === "") return;
    const src = toEmbedSrc(raw);
    if (!src) {
      setToolbarError(VIDEO_REFUSED);
      return;
    }
    setToolbarError(null);
    editor.chain().focus().insertContent({ type: "youtube", attrs: { src } }).run();
  }

  function insertMath() {
    const latex = window.prompt("Enter LaTeX");
    if (latex == null || latex.trim() === "") return;
    setToolbarError(null);
    editor.chain().focus().insertContent({ type: "math", attrs: { latex } }).run();
  }

  function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_INSTRUCTIONS_IMAGE_BYTES) {
      setToolbarError(IMAGE_TOO_LARGE);
      return;
    }
    if (!ALLOWED_IMAGE_MIME.test(file.type)) {
      setToolbarError(IMAGE_BAD_TYPE);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setToolbarError(null);
      editor.chain().focus().setImage({ src: String(reader.result) }).run();
    };
    reader.onerror = () => setToolbarError("Couldn't read that image file.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="rich-text-editor">
      <div className="assignments-actions" role="toolbar" aria-label="Formatting">
        <button type="button" className="btn btn--sm" onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </button>
        <button type="button" className="btn btn--sm" onClick={() => editor.chain().focus().toggleItalic().run()}>
          Italic
        </button>
        <button type="button" className="btn btn--sm" onClick={() => editor.chain().focus().toggleCode().run()}>
          Code
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>
        <button type="button" className="btn btn--sm" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          List
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          Numbered
        </button>
        <button type="button" className="btn btn--sm" onClick={() => fileInputRef.current?.click()}>
          Image
        </button>
        <button type="button" className="btn btn--sm" onClick={insertVideo}>
          Video
        </button>
        <button type="button" className="btn btn--sm" onClick={insertMath}>
          Math
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFileChosen}
          style={{ display: "none" }}
        />
      </div>
      {toolbarError ? (
        <div className="alert alert--warning" role="alert">
          {toolbarError}
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
