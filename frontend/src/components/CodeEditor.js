import React, { useEffect, useRef, useState } from "react";
import { registerPhysicsThemes, physicsThemeName } from "../utils/monaco/monacoThemes";

function CodeEditor({
  value,
  onChange,
  isDark,
  readOnly = false,
  /* Debug-mode props (optional) */
  breakpointLines,         /* Set<number> — lines that have a breakpoint */
  onToggleLineBreakpoint,  /* (lineNumber: number) => void */
  executingLine,           /* number | null — current execution line highlight */
  breakableLines,          /* Set<number> | undefined — lines a breakpoint can
                               actually pause on. Undefined means "not known
                               yet / not wired" and is treated permissively
                               (no line is refused) so callers that have not
                               been updated to pass it keep working exactly
                               as before. */
}) {
  const hostRef    = useRef(null);
  const editorRef  = useRef(null);
  const monacoRef  = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef    = useRef(value);
  const readOnlyRef = useRef(readOnly);
  const isDarkRef   = useRef(isDark);
  const onToggleBpRef = useRef(onToggleLineBreakpoint);
  const breakableLinesRef = useRef(breakableLines);
  const [fallback, setFallback] = useState(false);
  const suppressRef = useRef(false);

  /* Decoration ID arrays (for deltaDecorations cleanup) */
  const bpDecoIds  = useRef([]);
  const exDecoIds  = useRef([]);
  const breakableDecoIds = useRef([]);

  // Keep latest callback/value in refs
  onChangeRef.current     = onChange;
  valueRef.current        = value;
  readOnlyRef.current     = readOnly;
  isDarkRef.current       = isDark;
  onToggleBpRef.current   = onToggleLineBreakpoint;
  breakableLinesRef.current = breakableLines;

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
          /* Enable glyph margin when breakpoint support is active */
          glyphMargin: !!onToggleBpRef.current,
        });

        editorRef.current = editor;

        editor.onDidChangeModelContent(() => {
          if (suppressRef.current) return;
          onChangeRef.current(editor.getValue());
        });

        /* ── Glyph-margin / line-number click → toggle breakpoint ──
           Only an instrumentable line can ever pause — clicking any other
           line used to happily accept a breakpoint that would never fire. */
        if (onToggleBpRef.current) {
          editor.onMouseDown((e) => {
            const tgt = e.target;
            /* MouseTargetType: GUTTER_GLYPH_MARGIN = 2, GUTTER_LINE_NUMBERS = 3 */
            if ((tgt.type === 2 || tgt.type === 3) && tgt.position) {
              const line = tgt.position.lineNumber;
              const breakable = breakableLinesRef.current;
              if (breakable && !breakable.has(line)) return;
              onToggleBpRef.current(line);
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

  /* ── Breakable-line hollow glyph ─────────────────────────── */
  /* A quiet affordance, not a state: shows every line that COULD hold a
     breakpoint (and does not already have one) so a student can see the
     difference between "no breakpoint here" and "can't pause here". */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monacoRef.current) return;
    const bpSet = breakpointLines || new Set();
    const decos = breakableLines
      ? Array.from(breakableLines)
          .filter((line) => !bpSet.has(line))
          .map((line) => ({
            range: new monacoRef.current.Range(line, 1, line, 1),
            options: {
              glyphMarginClassName: "dbg-glyph-breakable",
              glyphMarginHoverMessage: { value: "Breakpoint can be set here" },
            },
          }))
      : [];
    breakableDecoIds.current = editor.deltaDecorations(breakableDecoIds.current, decos);
  }, [breakableLines, breakpointLines]);

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
