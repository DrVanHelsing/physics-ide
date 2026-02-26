import React, { useEffect, useRef, useState } from "react";
import { registerDialogService } from "../utils/dialogService";

/**
 * VariableDialog
 *
 * A VS Code–styled modal that replaces the browser's native prompt/alert/confirm.
 * Handles three modes:
 *   "prompt"  — text input + OK / Cancel
 *   "alert"   — message + OK
 *   "confirm" — message + OK / Cancel
 *
 * Mount once at the App root; it is invisible until Blockly (or any other caller)
 * triggers a dialog via dialogService.
 */
function VariableDialog() {
  const [state, setState] = useState(null);
  // state = { type: "prompt"|"alert"|"confirm", msg: string, defaultVal: string, resolve: fn }

  const inputRef = useRef(null);
  const okRef    = useRef(null);

  /* ── Register with the service on mount ─────────────────── */
  useEffect(() => {
    registerDialogService({
      prompt:  (msg, def) => new Promise(resolve => setState({ type: "prompt",  msg, defaultVal: def ?? "", resolve })),
      alert:   (msg)      => new Promise(resolve => setState({ type: "alert",   msg, resolve })),
      confirm: (msg)      => new Promise(resolve => setState({ type: "confirm", msg, resolve })),
    });
  }, []);

  /* ── Focus the input (or OK button) when dialog opens ───── */
  useEffect(() => {
    if (!state) return;
    if (state.type === "prompt" && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    } else if (okRef.current) {
      okRef.current.focus();
    }
  }, [state]);

  if (!state) return null;

  const handleOk = () => {
    const val = state.type === "prompt"
      ? (inputRef.current?.value ?? "")
      : true;
    state.resolve(val);
    setState(null);
  };

  const handleCancel = () => {
    state.resolve(state.type === "confirm" ? false : null);
    setState(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter")  handleOk();
    if (e.key === "Escape") handleCancel();
  };

  /* ── Derive a clean title from the Blockly message ───────── */
  const title = state.type === "prompt"
    ? (state.msg || "Enter a value")
    : state.type === "confirm"
    ? "Confirm"
    : "Notice";

  return (
    <div
      className="vdialog-overlay"
      onMouseDown={state.type !== "alert" ? handleCancel : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="vdialog"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="vdialog-header">
          <span className="vdialog-title">{title}</span>
        </div>

        {/* Body */}
        <div className="vdialog-body">
          {state.type !== "prompt" && (
            <p className="vdialog-msg">{state.msg}</p>
          )}

          {state.type === "prompt" && (
            <input
              ref={inputRef}
              className="vdialog-input"
              type="text"
              defaultValue={state.defaultVal}
              placeholder="Variable name…"
              spellCheck={false}
              autoComplete="off"
            />
          )}
        </div>

        {/* Footer */}
        <div className="vdialog-footer">
          {state.type !== "alert" && (
            <button
              type="button"
              className="vdialog-btn vdialog-btn--cancel"
              onClick={handleCancel}
            >
              Cancel
            </button>
          )}
          <button
            ref={okRef}
            type="button"
            className="vdialog-btn vdialog-btn--ok"
            onClick={handleOk}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default VariableDialog;
