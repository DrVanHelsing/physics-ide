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
 *
 * Submit (Task 14, design's client order): push the CURRENT local copy of
 * the linked project FIRST — `engine.pushProject`, so the server head is
 * exactly what the student sees before the server ever snapshots it — then
 * POST the submit. `assertPushSucceeded` (startWork.js's own guard) turns a
 * silent push failure into an honest refusal instead of a misleading 404
 * from the submit route. Group work (Task 23) skips that push entirely —
 * see handleSubmit. The footer only ever renders while `myWork` +
 * phase (both off the SAME `["assignment", id]` query as the doc above)
 * say a submission would be accepted — never promising a button the server
 * will refuse a moment later, same posture as AssignmentPage's Start gate.
 */
import React, { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import { getGlobalSyncEngine } from "../../utils/sync/syncEngine";
import { assertPushSucceeded } from "../../utils/assignments/startWork";
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
  const { data: me } = useMe();

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [poppedOut, setPoppedOut] = useState(false);
  const [lastGoodDoc, setLastGoodDoc] = useState(null);
  const [submitState, setSubmitState] = useState({ status: "idle" });

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

  // Submit is gated on the SAME query's myWork/phase, not on lastGoodDoc —
  // a stale "last good" instructions doc is fine to keep showing offline,
  // but the button must never promise a submission the server would refuse.
  const assignment = q.data?.assignment ?? null;
  const myWorkProjectId = assignment?.myWork?.projectId ?? null;
  const phase = assignment?.phase ?? null;
  const isGroupWork = !!assignment?.myGroup;
  const canSubmit = !!myWorkProjectId && (phase === "open" || phase === "late_window");

  const handleSubmit = useCallback(async () => {
    if (!myWorkProjectId || !me || !assignmentId) return;
    setSubmitState({ status: "pending" });
    try {
      // Group work (Task 23): myWork.projectId names the FOUNDING member's
      // project, which this member's own engine does not own — pushing it
      // would plant a copy of someone else's work under their account, and a
      // member without the baton could not push it to the group either. The
      // group's head is already current: while the baton is held, every local
      // save goes straight through the group route as it happens (groupSync's
      // listener), which is the same "last saved copy" the personal push
      // sends. So there is nothing left to push here.
      if (!isGroupWork) {
        const engine = await getGlobalSyncEngine();
        await engine.pushProject(myWorkProjectId, me.id); // push FIRST — the snapshot must be what the student sees
        assertPushSucceeded(engine);
      }
      const res = await api(`/api/assignments/${assignmentId}/submit`, { method: "POST" });
      setSubmitState({
        status: "success",
        attempt: res.submission.attempt,
        fingerprint: res.submission.fingerprint,
      });
    } catch (err) {
      setSubmitState({ status: "error", message: err.message });
    }
  }, [assignmentId, myWorkProjectId, me, isGroupWork]);

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
      {canSubmit ? (
        <div className="brief-pane__footer">
          {phase === "late_window" ? (
            <p className="auth-text auth-text--dim" role="status">
              The due date has passed — this submission will carry a permanent late label.
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn--primary"
            disabled={submitState.status === "pending"}
            onClick={handleSubmit}
          >
            Submit
          </button>
          {submitState.status === "success" ? (
            <div className="alert alert--success" role="status">
              Submitted — attempt {submitState.attempt}. Fingerprint{" "}
              <code>{submitState.fingerprint.slice(0, 8)}</code>.
            </div>
          ) : null}
          {submitState.status === "error" ? (
            <div className="alert alert--danger" role="alert">
              {submitState.message}
            </div>
          ) : null}
        </div>
      ) : null}
      {poppedOut ? (
        <Overlay onClose={() => setPoppedOut(false)} label={ctx.title} panelClassName="brief-pane__body">
          <InstructionsView doc={lastGoodDoc} />
        </Overlay>
      ) : null}
    </section>
  );
}
