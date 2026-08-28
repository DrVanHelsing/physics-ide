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
 * the workspace read-only while the baton is anywhere but here, and what
 * registers the group save listener while it is here — see IDELayout. The
 * lock is on "not CONFIRMED yours", so it holds through the unread state
 * too: an unknown baton has no push path, and edits made under one would
 * never reach the group at all.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMe } from "../../auth/useAuth";
import { api } from "../../utils/api/client";
import { useAssignmentContext } from "../../contexts/AssignmentContext";
import { onGroupPushFailed, pullGroupProject } from "../../utils/assignments/groupSync";

export const BATON_POLL_MS = 20 * 1000;

/**
 * The chip's whole state machine, kept pure so the sentences are testable.
 *
 * Four states — the three of the design, plus the one before any of them:
 *   - the baton has not been read yet    → checking, and NOT held
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
 *
 * The first state is the whole truth of an unread baton: before a poll has
 * ever succeeded — the first one still in flight, or every one of them
 * refused (offline, or 403 after being removed from the group) — this member
 * genuinely does not hold the baton, and the workspace stays read-only. It
 * reports `held: null` rather than `false` so a never-read baton stays
 * distinguishable from a read one that belongs to somebody else; only a
 * CONFIRMED `true` unlocks anything.
 */
export function batonView(baton, meId, now) {
  if (!baton) return { held: null, sentence: "Checking who's editing…", canTake: false };
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
  /* Whether the reading currently on show is a HOLDING one — i.e. whether
     the group's head has already been delivered for the turn in progress.
     A ref, not state: it gates the adopt below, which must see the value
     the last adopt wrote, not the one this render closed over. */
  const holdingRef = useRef(false);
  /* The group the readings below are allowed to be about: `adopt` awaits a
     network round trip, and one that started under the last group must not
     land on this one. */
  const groupIdRef = useRef(groupId);
  /* One number per adopt, so an adopt can tell whether it is still the
     LATEST one. The group check above only catches a change of group; two
     adopts of the same group interleave just as easily — a slow take-pull
     against a poll that lands while it is in flight — and the older one must
     not re-assert a baton the newer reading has already taken away. */
  const adoptGenRef = useRef(0);

  // A different group — or none — must never keep showing the last one's
  // holder while the first poll is in flight.
  useEffect(() => {
    groupIdRef.current = groupId;
    setBaton(null);
    holdingRef.current = false;
  }, [groupId]);

  /**
   * Adopt a baton reading — but never adopt one that makes this member the
   * holder until the group's HEAD is in the local library.
   *
   * The group route is last-write-wins on the whole manifest, so a member
   * who starts editing a copy older than the head overwrites everything
   * that arrived while they watched, on their very first save. Taking the
   * baton is exactly when that copy is most likely to be stale: they have
   * been sitting read-only while somebody else worked.
   *
   * `pullGroupProject` writes the head with `preserveTimestamp`, which is
   * the existing signal the open project reloads from — useProject
   * subscribes to precisely those writes ("adopt the pulled manifest into
   * the live session") to drop any in-flight autosave and re-apply the
   * manifest to the editors. Nothing new: a takeover reloads by the same
   * path a personal sync pull already does. A head that is no newer than
   * the local copy writes nothing, so nothing reloads.
   *
   * A head that cannot be fetched leaves the reading unadopted: the
   * workspace stays locked rather than becoming editable over a copy we
   * cannot vouch for, the Take over button stays where it is, and the next
   * poll — 20 s away — tries again.
   */
  const adopt = useCallback(
    async (next) => {
      const generation = (adoptGenRef.current += 1);
      const nowHolding = batonView(next, meId, Date.now()).held === true;
      if (nowHolding && !holdingRef.current) {
        try {
          await pullGroupProject(groupId);
        } catch (err) {
          console.warn(`group sync: could not fetch the group's work — ${err.message}`);
          return;
        }
        if (groupIdRef.current !== groupId) return; // the group changed under the fetch
        if (adoptGenRef.current !== generation) return; // a newer reading already landed
      }
      holdingRef.current = nowHolding;
      setBaton(next);
    },
    [groupId, meId],
  );

  /* The poll's own read, exposed so the push-failure subscription below can
     fire the very same one. */
  const readRef = useRef(null);

  useEffect(() => {
    if (!groupId || !meId) return undefined;
    let dead = false;
    const read = async () => {
      try {
        const res = await api(`/api/groups/${groupId}/baton`);
        if (!dead) await adopt(res.baton);
      } catch {
        // Offline, or membership gone. The last known state stands rather
        // than being replaced by a guess — it is the assignment context's
        // own refresh that drops the group when a member leaves it. Before
        // any read has succeeded that state is "checking", which does not
        // hold the baton and so does not unlock anything.
      }
    };
    readRef.current = read;
    read();
    const timer = setInterval(read, BATON_POLL_MS);
    return () => {
      dead = true;
      readRef.current = null;
      clearInterval(timer);
    };
  }, [groupId, meId, adopt]);

  /* A refused or unreachable push is the server telling this member their
     turn is over, a full poll interval before the poll would. Re-read now
     so the chip — and with it the read-only lock — corrects within a
     second rather than after 20 of them. */
  useEffect(() => onGroupPushFailed(() => { readRef.current?.(); }), []);

  const view = groupId ? batonView(baton, meId, Date.now()) : null;
  // Tri-state on purpose: null means "not read yet", which is NOT held.
  // IDELayout locks on anything that is not a confirmed true.
  const held = view ? view.held : null;

  useEffect(() => {
    onBaton?.({ groupId, held });
  }, [onBaton, groupId, held]);

  const take = useCallback(async () => {
    setTaking(true);
    try {
      const res = await api(`/api/groups/${groupId}/baton/take`, { method: "POST" });
      // Through `adopt`, so the head arrives before the editors do — see
      // its comment. True of every take: a fresh baton, your own lapsed
      // lease, or a takeover from someone whose lease ran out.
      await adopt(res.baton);
    } catch {
      // 409 — someone got there first. The refusal carries the live holder,
      // but the api client keeps only its sentence, so re-read rather than
      // leaving the chip claiming a baton this member does not have.
      try {
        const res = await api(`/api/groups/${groupId}/baton`);
        await adopt(res.baton);
      } catch {
        /* offline: the last known state stands */
      }
    } finally {
      setTaking(false);
    }
  }, [adopt, groupId]);

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
