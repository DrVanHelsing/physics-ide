import React from "react";
import { BlocksIcon, CodeIcon } from "./Icons";

function ModeToggle({ mode, onChange, lockedMode, codeLabel = "Code" }) {
  // lockedMode: "blocks" | "text" | null — which mode the user cannot switch to
  return (
    <div className="mode-toggle">
      <button
        type="button"
        className={`${mode === "blocks" ? "active" : ""}${lockedMode === "blocks" ? " mode-toggle--disabled" : ""}`}
        onClick={() => lockedMode !== "blocks" && onChange("blocks")}
        disabled={lockedMode === "blocks"}
        title={lockedMode === "blocks" ? "Blocks mode unavailable for this template" : "Switch to blocks"}
      >
        <BlocksIcon size={13} /> Blocks
      </button>
      <button
        type="button"
        className={`${mode === "text" ? "active" : ""}${lockedMode === "text" ? " mode-toggle--disabled" : ""}`}
        onClick={() => lockedMode !== "text" && onChange("text")}
        disabled={lockedMode === "text"}
        title={lockedMode === "text" ? "Code mode unavailable for this template" : "Switch to code"}
      >
        <CodeIcon size={13} /> {codeLabel}
      </button>
    </div>
  );
}

export default ModeToggle;
