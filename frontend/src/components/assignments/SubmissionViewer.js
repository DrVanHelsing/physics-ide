import React, { useState } from "react";
import { ReadOnlyBlockly } from "../BlocklyWorkspace";
import CodeEditor from "../CodeEditor";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * The exam script itself (spec §7.2) — a `.tabs` pair, Blocks / Code, over
 * ONE submission snapshot. Both renderers are the IDE's own real-only
 * mirrors (ReadOnlyBlockly, CodeEditor with `readOnly`), so a marker sees
 * exactly what the student's blocks/code look like — never editable here.
 *
 * Per spec §7.2's own caveat: appearance is per-VIEWER, not per-submission —
 * `useTheme()` reads the marker's own light/dark choice, "comes free" the
 * same way the IDE's editor pane already gets it (IDELayout.js). What is
 * authoritative in a dispute is the snapshot's content and its fingerprint
 * (rendered by the marking room's header, not here), never how it was
 * painted on any one screen.
 */
export default function SubmissionViewer({ workspaceXml, python }) {
  const { isDark } = useTheme();
  const [tab, setTab] = useState("blocks");

  return (
    <div className="submission-viewer">
      <div className="tabs" role="tablist">
        <button
          className={`tab${tab === "blocks" ? " tab--on" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "blocks"}
          onClick={() => setTab("blocks")}
        >
          Blocks
        </button>
        <button
          className={`tab${tab === "code" ? " tab--on" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "code"}
          onClick={() => setTab("code")}
        >
          Code
        </button>
      </div>
      <div className="submission-viewer__pane">
        {tab === "blocks" ? (
          <ReadOnlyBlockly xml={workspaceXml} isDark={isDark} />
        ) : (
          <CodeEditor value={python} isDark={isDark} readOnly onChange={() => {}} />
        )}
      </div>
    </div>
  );
}
