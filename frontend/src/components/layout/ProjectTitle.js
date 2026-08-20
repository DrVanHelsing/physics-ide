import React, { useEffect, useRef, useState } from "react";

/**
 * The open project's name, in the header. Click to rename — the first place
 * in the IDE shell that has ever said which project is open.
 * Enter commits, Escape cancels, blur commits (students click away).
 */
export default function ProjectTitle({ title, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title || "");
  const inputRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(title || "");
  }, [title, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(title || "");
      return;
    }
    const next = draft.trim();
    if (next && next !== title) onRename?.(next);
    else setDraft(title || "");
  };

  if (!title) {
    return (
      <span className="project-title project-title--empty" title="No project is open">
        No project open
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="project-title"
        onClick={() => setEditing(true)}
        title="Click to rename this project"
      >
        {title}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      className="project-title-input"
      value={draft}
      maxLength={120}
      aria-label="Project name"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); inputRef.current.blur(); }
        if (e.key === "Escape") { e.preventDefault(); cancelledRef.current = true; inputRef.current.blur(); }
      }}
    />
  );
}
