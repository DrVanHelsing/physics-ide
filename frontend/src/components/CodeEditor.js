import React, { useEffect, useRef, useState } from "react";
import { registerPhysicsThemes, physicsThemeName } from "../utils/monaco/monacoThemes";

/**
 * The text-mode editor: bundled Monaco, with a plain <textarea> fallback if
 * the dynamic import ever fails.
 *
 * No breakpoint gutter. It carried one — a glyph margin, a click handler and
 * three decoration effects — but nothing ever passed the props that switched
 * it on, and the two chains behind it were never built either: `breakableIds`
 * is only ever populated by `syncFromBlocks` (which text mode skips) and is
 * read from the BLOCK trace registry, which knows nothing about the
 * instrumentor's code-mode entries. So the gutter could only have offered
 * breakpoints that never fired. Breakpoints are a block-editor feature, which
 * is what the Help page has always told students; wiring code-mode
 * breakpoints properly is new design work, not a loose end.
 */
function CodeEditor({ value, onChange, isDark, readOnly = false }) {
  const hostRef    = useRef(null);
  const editorRef  = useRef(null);
  const monacoRef  = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef    = useRef(value);
  const readOnlyRef = useRef(readOnly);
  const isDarkRef   = useRef(isDark);
  const [fallback, setFallback] = useState(false);
  const suppressRef = useRef(false);

  // Keep latest callback/value in refs
  onChangeRef.current     = onChange;
  valueRef.current        = value;
  readOnlyRef.current     = readOnly;
  isDarkRef.current       = isDark;

  /* ── One-time Monaco bootstrap ───────────────────────────── */
  useEffect(() => {
    let disposed = false;

    import("../utils/monaco/monacoLib")
      .then(async ({ default: monaco }) => {
        if (disposed || !hostRef.current) return;
        monacoRef.current = monaco;

        await registerPhysicsThemes(monaco);
        if (disposed || !hostRef.current) return;

        const editor = monaco.editor.create(hostRef.current, {
          value: valueRef.current,
          language: "python",
          theme: physicsThemeName(isDarkRef.current),
          minimap: { enabled: false },
          lineNumbers: "on",
          wordWrap: "on",
          automaticLayout: true,
          fontSize: 14,
          readOnly: readOnlyRef.current,
          domReadOnly: readOnlyRef.current,
        });

        editorRef.current = editor;

        editor.onDidChangeModelContent(() => {
          if (suppressRef.current) return;
          onChangeRef.current(editor.getValue());
        });
      })
      .catch(() => {
        if (!disposed) setFallback(true);
      });

    return () => {
      disposed = true;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []); // run once

  /* ── React to theme changes ──────────────────────────────── */
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      monacoRef.current.editor.setTheme(physicsThemeName(isDark));
    }
  }, [isDark]);

  /* ── React to readOnly changes ───────────────────────────── */
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly, domReadOnly: readOnly });
    }
  }, [readOnly]);

  /* ── Sync external value into Monaco ─────────────────────── */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== value) {
      suppressRef.current = true;
      editor.setValue(value);
      suppressRef.current = false;
    }
  }, [value]);

  if (fallback) {
    return (
      <textarea
        className="text-fallback"
        value={value}
        readOnly={readOnly}
        onChange={(e) => !readOnly && onChange(e.target.value)}
      />
    );
  }

  return <div ref={hostRef} className="monaco-host" />;
}

export default CodeEditor;
