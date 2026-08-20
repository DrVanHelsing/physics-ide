import React, { useState } from "react";
import { AlertTriangleIcon, CopyIcon, XIcon } from "../Icons";

/**
 * Runtime and compile errors used to land in the 22px status strip, sharing it
 * with success messages and being overwritten by the next status string. A
 * student who looked away missed it entirely. This banner persists until it is
 * dismissed and can hand the text to a teacher.
 */
export default function RunErrorBanner({ text, onDismiss }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <div className="run-error-banner" role="alert">
      <AlertTriangleIcon size={14} />
      <span className="run-error-banner__text">{text}</span>
      <button
        type="button"
        className="tb-btn tb-btn--subtle"
        title="Copy this error to the clipboard"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        <CopyIcon size={12} />
        <span className="tb-btn-label">{copied ? "Copied" : "Copy error"}</span>
      </button>
      <button type="button" className="tb-btn tb-btn--icon" onClick={onDismiss} aria-label="Dismiss error">
        <XIcon size={12} />
      </button>
    </div>
  );
}
