/**
 * BriefPane — spec §6.2's instructions dock, beside the work.
 *
 * Docks the active assignment's instructions to the LEFT of the editor
 * instead of behind a link a student has to remember to open — the first
 * child of `.main-layout` (see IDELayout.js), a fixed-width column that is
 * deliberately outside the `--split` arithmetic (D§5).
 *
 * Renders nothing outside assignment work (no AssignmentContext).
 *
 * Instructions come from the assignment detail query — `["assignment", id]`,
 * the same key AssignmentPage.js uses — because they are NOT part of
 * AssignmentContext's cached meta; this pane fetches them itself. The most
 * recently fetched doc is kept in `lastGoodDoc` and rendered from there
 * rather than straight off the query result, so a request that fails while
 * offline degrades to "still shows what it showed a moment ago" instead of
 * going blank. `lastGoodDoc` is updated as a render-phase state adjustment
 * (React's documented pattern for "remember the last good value of a prop
 * that can go missing") rather than an effect, so a fetch that already
 * landed is reflected in the very render that receives it — no extra tick,
 * nothing to flush in a test.
 *
 * Collapse: `matchMedia("(max-width: 1024px)")` sets the floor — small
 * enough to need the room back, so the pane starts collapsed there — but a
 * student's own choice, once made, is remembered for the rest of the
 * session (`sessionStorage["pide_brief_collapsed"]`) and overrides that
 * floor either way. Collapsing never removes the pane (spec §6.2): it swaps
 * for a labelled vertical handle in the same slot, one click restores it.
 *
 * The pop-out button reads the same doc through the one Overlay every other
 * dialog in the IDE uses, for a focused read away from the fixed-width dock.
 */
import React, { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useAssignmentContext } from "../../contexts/AssignmentContext";
import InstructionsView from "./InstructionsView";
import Overlay from "../common/Overlay";
import { FileTextIcon, ExternalLinkIcon, PanelRightCloseIcon } from "../Icons";

const STORAGE_KEY = "pide_brief_collapsed";

// Distinct from any real query result (including `undefined`, an errored or
// disabled query's own `data`), so the render-phase check below always
// treats the very first render as "new data seen" too.
const UNSEEN = Symbol("brief-pane-unseen-query-data");

function initialCollapsed() {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // sessionStorage unavailable (private mode, some embeds) — fall through
    // to the floor query below.
  }
  return window.matchMedia("(max-width: 1024px)").matches;
}

export default function BriefPane() {
  const ctx = useAssignmentContext();
  const assignmentId = ctx?.assignmentId ?? null;

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [poppedOut, setPoppedOut] = useState(false);
  const [lastGoodDoc, setLastGoodDoc] = useState(null);

  const q = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => api(`/api/assignments/${assignmentId}`),
    enabled: !!assignmentId,
  });

  // Render-phase adjustment (not an effect): a fresh successful fetch
  // updates lastGoodDoc in the same render that receives it; a failed one
  // (q.data undefined/unchanged) leaves the previous doc standing.
  const [seenData, setSeenData] = useState(UNSEEN);
  if (q.data !== seenData) {
    setSeenData(q.data);
    const doc = q.data?.assignment?.instructions;
    if (doc) setLastGoodDoc(doc);
  }

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.sessionStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Session persistence is a nicety, not a requirement.
      }
      return next;
    });
  }, []);

  if (!ctx) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        className="brief-handle"
        aria-expanded={false}
        title="Show the assignment brief"
        onClick={toggleCollapsed}
      >
        Brief
      </button>
    );
  }

  return (
    <section className="brief-pane">
      <div className="pane-header pane-header--brief">
        <span className="pane-header__title">
          <FileTextIcon size={14} /> {ctx.title}
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          title="Open the brief in a window"
          onClick={() => setPoppedOut(true)}
        >
          <ExternalLinkIcon size={14} />
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          aria-expanded={true}
          title="Collapse the brief"
          onClick={toggleCollapsed}
        >
          <PanelRightCloseIcon size={14} />
        </button>
      </div>
      <div className="brief-pane__body">
        {ctx.dueAt ? (
          <p className="assignment-row__due">due {new Date(ctx.dueAt).toLocaleString()}</p>
        ) : null}
        <InstructionsView doc={lastGoodDoc} />
      </div>
      {poppedOut ? (
        <Overlay onClose={() => setPoppedOut(false)} label={ctx.title} panelClassName="brief-pane__body">
          <InstructionsView doc={lastGoodDoc} />
        </Overlay>
      ) : null}
    </section>
  );
}
