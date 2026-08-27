/**
 * BatonChip — spec §5.5's baton, in the status bar.
 *
 * "The project passes like a baton: while one member has it open for
 * editing, the others see it read-only with a note ('Thabo is working on it
 * now') and a Take over button for when the baton-holder forgets to close
 * it."
 *
 * The baton is a POLLED lease (stack §sync, backend `BATON_TTL_MS` = 90s):
 * holder + expiry on the group row, no live connection anywhere. This chip
 * re-reads `GET /api/groups/:gid/baton` every 20 seconds while the assignment
 * context carries a group — cheap by design, and at most 20 seconds behind a
 * lease that ran out. It deliberately does NOT renew by polling: a lease that
 * never expires while a tab is open would make "Take over" unreachable, which
 * is the one escape hatch the spec asks for.
 *
 * Mounted right after `<RulesChip />` (IDELayout.js), sharing the `.sync-chip`
 * pill shape — the same treatment RulesChip got in Task 11.
 *
 * It reports `{ groupId, held }` upward on every change. That is what makes
 * the workspace read-only while the baton is elsewhere, and what registers
 * the group save listener while it is here — see IDELayout.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useMe } from "../../auth/useAuth";
import { api } from "../../utils/api/client";
import { useAssignmentContext } from "../../contexts/AssignmentContext";

export const BATON_POLL_MS = 20 * 1000;

/**
 * The chip's whole state machine, kept pure so the sentences are testable.
 *
 * Three states, per the design:
 *   - the lease is live and yours        → editing, nothing to press
 *   - the lease is live and someone else's → read-only, named, no takeover
 *   - the lease is not live              → read-only, takeable
 *
 * The last one carries two honest sentences rather than one, because there
 * are two different truths behind it. When someone else's lease has merely
 * run out, they are still the person you are taking over FROM, so the note
 * keeps naming them (this is exactly the "forgot to close it" case the spec
 * describes, and why the server reports an expired lease verbatim). When
 * there is nobody to name — the baton has never been picked up, or the lease
 * that lapsed was your own — the chip says so instead of telling Ada that
 * Ada is editing.
 */
export function batonView(baton, meId, now) {
  const mine = !!baton.holderId && baton.holderId === meId;
  const live = !!baton.holderId && baton.expiresAt != null && baton.expiresAt > now;
  if (live && mine) return { held: true, sentence: "Editing — baton yours", canTake: false };
  if (live) return { held: false, sentence: `Read-only — ${baton.holderName} is editing`, canTake: false };
  const lapsedHolder = !mine && baton.holderName ? baton.holderName : null;
  return {
    held: false,
    sentence: lapsedHolder
      ? `Read-only — ${lapsedHolder} is editing`
      : "Read-only — nobody has the baton",
    canTake: true,
  };
}

export default function BatonChip({ onBaton }) {
  const ctx = useAssignmentContext();
  const groupId = ctx?.groupId ?? null;
  const { data: me } = useMe();
  const meId = me?.id ?? null;
  const [baton, setBaton] = useState(null);
  const [taking, setTaking] = useState(false);

  // A different group — or none — must never keep showing the last one's
  // holder while the first poll is in flight.
  useEffect(() => {
    setBaton(null);
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !meId) return undefined;
    let dead = false;
    const read = async () => {
      try {
        const res = await api(`/api/groups/${groupId}/baton`);
        if (!dead) setBaton(res.baton);
      } catch {
        // Offline, or membership gone. The last known state stands rather
        // than being replaced by a guess — it is the assignment context's
        // own refresh that drops the group when a member leaves it.
      }
    };
    read();
    const timer = setInterval(read, BATON_POLL_MS);
    return () => {
      dead = true;
      clearInterval(timer);
    };
  }, [groupId, meId]);

  const view = groupId && baton ? batonView(baton, meId, Date.now()) : null;
  // Tri-state on purpose: null means "not read yet". IDELayout must not lock
  // the workspace on a state it has not confirmed, or every open of group
  // work would flash the read-only editors before the first poll lands.
  const held = view ? view.held : null;

  useEffect(() => {
    onBaton?.({ groupId, held });
  }, [onBaton, groupId, held]);

  const take = useCallback(async () => {
    setTaking(true);
    try {
      const res = await api(`/api/groups/${groupId}/baton/take`, { method: "POST" });
      setBaton(res.baton);
    } catch {
      // 409 — someone got there first. The refusal carries the live holder,
      // but the api client keeps only its sentence, so re-read rather than
      // leaving the chip claiming a baton this member does not have.
      try {
        const res = await api(`/api/groups/${groupId}/baton`);
        setBaton(res.baton);
      } catch {
        /* offline: the last known state stands */
      }
    } finally {
      setTaking(false);
    }
  }, [groupId]);

  if (!view) return null;

  return (
    <span
      className={`sync-chip baton-chip${view.held ? " baton-chip--held" : ""}`}
      role="status"
      aria-live="polite"
      title={view.sentence}
    >
      <span className="baton-chip__text">{view.sentence}</span>
      {view.canTake ? (
        <button className="btn btn--sm" type="button" disabled={taking} onClick={take}>
          Take over
        </button>
      ) : null}
    </span>
  );
}
