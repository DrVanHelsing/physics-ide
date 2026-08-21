import React, { useEffect, useRef, useState } from "react";

function CodeEditor({
  value,
  onChange,
  isDark,
  readOnly = false,
  /* Debug-mode props (optional) */
  breakpointLines,         /* Set<number> — lines that have a breakpoint */
  onToggleLineBreakpoint,  /* (lineNumber: number) => void */
  executingLine,           /* number | null — current execution line highlight */
}) {
  const hostRef    = useRef(null);
  const editorRef  = useRef(null);
  const monacoRef  = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef    = useRef(value);
  const readOnlyRef = useRef(readOnly);
  const isDarkRef   = useRef(isDark);
  const onToggleBpRef = useRef(onToggleLineBreakpoint);
  const [fallback, setFallback] = useState(false);
  const suppressRef = useRef(false);

  /* Decoration ID arrays (for deltaDecorations cleanup) */
  const bpDecoIds  = useRef([]);
  const exDecoIds  = useRef([]);

  // Keep latest callback/value in refs
  onChangeRef.current     = onChange;
  valueRef.current        = value;
  readOnlyRef.current     = readOnly;
  isDarkRef.current       = isDark;
  onToggleBpRef.current   = onToggleLineBreakpoint;

  /* ── One-time Monaco bootstrap ───────────────────────────── */
  useEffect(() => {
    let disposed = false;

    import("../utils/monaco/monacoLib")
      .then(({ default: monaco }) => {
        if (disposed || !hostRef.current) return;
        monacoRef.current = monaco;

        const editor = monaco.editor.create(hostRef.current, {
          value: valueRef.current,
          language: "python",
          theme: isDarkRef.current ? "vs-dark" : "vs",
          minimap: { enabled: false },
          lineNumbers: "on",
          wordWrap: "on",
          automaticLayout: true,
          fontSize: 14,
          readOnly: readOnlyRef.current,
          domReadOnly: readOnlyRef.current,
          /* Enable glyph margin when breakpoint support is active */
          glyphMargin: !!onToggleBpRef.current,
        });

        editorRef.current = editor;

        editor.onDidChangeModelContent(() => {
          if (suppressRef.current) return;
          onChangeRef.current(editor.getValue());
        });

        /* ── Glyph-margin / line-number click → toggle breakpoint ── */
        if (onToggleBpRef.current) {
          editor.onMouseDown((e) => {
            const tgt = e.target;
            /* MouseTargetType: GUTTER_GLYPH_MARGIN = 2, GUTTER_LINE_NUMBERS = 3 */
            if ((tgt.type === 2 || tgt.type === 3) && tgt.position) {
              onToggleBpRef.current(tgt.position.lineNumber);
            }
          });
        }
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
      monacoRef.current.editor.setTheme(isDark ? "vs-dark" : "vs");
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

  /* ── Breakpoint glyph-margin decorations ─────────────────── */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monacoRef.current) return;
    const decos = breakpointLines
      ? Array.from(breakpointLines).map((line) => ({
          range: new monacoRef.current.Range(line, 1, line, 1),
          options: {
            glyphMarginClassName: "dbg-glyph-bp",
            glyphMarginHoverMessage: { value: "Breakpoint — click to remove" },
          },
        }))
      : [];
    bpDecoIds.current = editor.deltaDecorations(bpDecoIds.current, decos);
  }, [breakpointLines]);

  /* ── Executing-line highlight decoration ──────────────────── */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monacoRef.current) return;
    const decos = executingLine
      ? [{
          range: new monacoRef.current.Range(executingLine, 1, executingLine, 1),
          options: {
            isWholeLine: true,
            className: "dbg-executing-line",
            glyphMarginClassName: "dbg-glyph-executing",
          },
        }]
      : [];
    exDecoIds.current = editor.deltaDecorations(exDecoIds.current, decos);
  }, [executingLine]);

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
