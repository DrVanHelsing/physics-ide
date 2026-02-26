import React, { useEffect, useRef, useState } from "react";

function CodeEditor({ value, onChange, isDark, readOnly = false }) {
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const readOnlyRef = useRef(readOnly);
  const [fallback, setFallback] = useState(false);
  const suppressRef = useRef(false); // prevent echo on setValue

  // Keep latest callback/value in refs
  onChangeRef.current = onChange;
  valueRef.current = value;
  readOnlyRef.current = readOnly;

  /* ── One-time Monaco bootstrap ───────────────────────────── */
  useEffect(() => {
    if (!window.require) {
      setFallback(true);
      return undefined;
    }

    window.require.config({
      paths: {
        vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs",
      },
    });

    let disposed = false;

    window.require(["vs/editor/editor.main"], () => {
      if (disposed) return;
      const monaco = window.monaco;
      if (!monaco || !hostRef.current) {
        setFallback(true);
        return;
      }

      const editor = monaco.editor.create(hostRef.current, {
        value: valueRef.current,
        language: "python",
        theme: "vs-dark",
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
    if (editorRef.current && window.monaco) {
      window.monaco.editor.setTheme(isDark ? "vs-dark" : "vs");
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
