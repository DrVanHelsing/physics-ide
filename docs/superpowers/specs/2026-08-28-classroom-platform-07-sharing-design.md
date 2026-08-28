# Plan 7 design — peer sharing and the attribution ledger

**Spec authority:** `docs/classroom-platform.md` §8 (the honesty layer), §8.1 (the ledger
sentence), §8.3 (sharing controls), constrained by §5.4 (workspace rules), §9 (the closed
email table), §11 (privacy + erasure), §13 (exclusions), §14 (the closed screen inventory),
§12/§15 (leanness). Research ground: the Plan 7 research memo (session artifact, 2026-08-28).
Format and precedent: `2026-08-25-classroom-platform-06-assignments-design.md`.

**Provenance note (recorded honestly):** these decisions were made by the controller under
the user's standing continuous-execution order, grounded in the spec's own text and the
research memo — not in a brainstorming dialogue. The one intent-level assumption is D§1's:
sharing is a *hand-off with credit*, not a gallery. The spec's own words ("a **copy** that
arrived via sharing", the ancestor ledger's singular *recipient*, §11's "students see their
own") all point there, and D§1 is deliberately the reversible direction — widening to
class-wide later is one additive case; narrowing a gallery back to named peers is not
honestly possible on an append-only ledger.

---

## 1. What a share IS

**Decision.** A share is a **named-peer hand-off of a frozen copy, with permanent credit**:
one sharer, one recipient (fan-out = one share per recipient), both active members of one
named class. It is part of §8's anticheat design — the legitimate channel, fully recorded —
not a social feature. It is NOT: a class-wide gallery, a feed, a comment channel, a live
view, or a collaboration surface (§13 + contract exclusions all stand).

No free-text message rides a share. A share carries a project and a name — nothing else.

## 2. Copy-on-share, frozen from the server head

**Decision.** The recipient receives a **copy frozen at share time from the sharer's
current SERVER head** (`projects` row — never the sharer's browser state). On accept it is
minted as an **ordinary project the recipient owns**, with a fresh client-minted `p-…` id
(never the source id). No live references, no read-only library states, no third
`SyncProvider` guard — an accepted copy adopts, syncs, and counts against the recipient's
100-project cap exactly like any project they made.

The spec's own noun is "copy" (§8.1). A live reference would be the excluded feature
(§13 live view; contract "Collaboration" exclusion), would break offline (local-first), and
would need read-only machinery the IDE only has for the baton.

## 3. The ledger and the attribution — split, because they are different things

**Decision.**
- **The ledger lives in the `events` table** — the approved stack doc's own answer ("a
  share … cannot happen without its event"; its table list has no `shares` table). One row
  per share action, written **inside the same transaction**: `project.shared`,
  `project.share_accepted`, `project.share_revoked`, `project.share_lapsed`. Payload
  carries the ancestor spec's five fields denormalised:
  `{ sourceOwnerId, sourceProjectId, sourceClientUpdatedAt, recipientId, classId }` plus
  `copyProjectId` on accept, plus the source's own attribution if it has one (D§10 chains).
  Events are append-only; nothing ever deletes or updates them.
- **The attribution lives on the copy, outside the manifest**: a nullable
  `projects.attribution` jsonb `{ sharerId, shareId }` written at accept, mirrored
  client-side in a sidecar store (the `assignmentMeta.js` precedent) so the label renders
  offline. **The sharer's NAME is never denormalised** — it is resolved at read time from
  `sharerId`, so §11 erasure has exactly one place to act and an erased sharer renders as
  **"Removed student"**.
- **The manifest is never touched.** The contract's D§2 clause governs: no feature may tag
  the manifest. `SCHEMA_VERSION` stays 2; the sync engine is untouched; an export bundle
  cannot carry attribution.
- **No FK in the share/attribution path cascades on project delete.** A ledger a sharer
  could erase by deleting the source project is not §8's ledger. Denormalised ids in the
  event payload are the permanent record; FKs are `set null`/no-action.

## 4. Delivery state — a small `shares` table, accept-on-open

**Decision.** Delivery (not the ledger) gets a small **`shares`** table in migration 0006:
`id, classId, sharerId, recipientId, sourceOwnerId, sourceProjectId, frozenManifest jsonb,
sourceClientUpdatedAt, status ∈ pending|accepted|revoked|lapsed, createdAt, resolvedAt,
copyProjectId nullable`. The invites idiom (`pending/accepted/revoked`) is the established
vocabulary.

A share is **pending until the recipient accepts** ("Add to my projects"). Reasons: the
recipient's 100-project cap is theirs to spend (§15); §9 provides no notification channel,
so discovery is pull-based anyway; and pending-ness gives revocation a meaningful window.
The frozen manifest is stored on the share row (≤ `MAX_MANIFEST_BYTES`, the existing cap)
so accept works even if the sharer later deletes or rewrites the source.

Accept follows `startWork.js`'s documented order: server returns the frozen manifest →
fresh local mint → `saveProject(manifest, { preserveTimestamp: true })` (a pull is not an
edit) → sidecar attribution write → `engine.pushProject` + `assertPushSucceeded` →
`requestProjectOpen(id)`. A cap-hit gets its own honest sentence — not the generic
"your limit" sentence surfacing on someone else's action.

## 5. The gate — who may share what

**Decision.** One server-side gate function, one place, every refusal a named sentence
const:

1. The class's **`peer_sharing` switch is on** (`classes.peer_sharing boolean NOT NULL
   DEFAULT false` — §8.3's class switch, off by default per spec; home: Class → Settings,
   `UpdateClassSettingsInputSchema` gains the key; `class.updated` event as today).
2. The **sharer owns the source project** and both sharer and recipient are **active
   members of the named class** (any role may share and receive — but see 5.4 below).
3. If the source project is **assignment work** (has an `assignment_work` linkage): the
   assignment's **individual-work flag is off** (§8.3's override — this task makes the
   currently-inert flag real, including its student-visible stamp and its true editor
   label) **and** the assignment's workspace rules have **`exportAndCopy` on** — a share of
   assessment work is a copy-out, and §5.4 did not carve share out the way it carved out
   submit. **No new `share` rule key is added** (no schema ripple through saved rule_sets,
   built-ins, picker, chip); if "export off but sharing on" ever needs to be expressible,
   a seventh rule is an additive change recorded for the future.
4. The source is **not a group project** (server-enforced on the project row's identity via
   `groups.projectId`, not on the actor — a member's pulled local copy must not launder
   one out). Group visibility is already §8.3's third bullet, shipped; a group project's
   "sharer" would be an ownership accident and §5.5's per-member honesty forbids crediting
   one member with the group's work. A member sharing their own personal project stays
   normal.

Everything fails closed: switch off, flag on, rule off, group row, inactive member — each
refusal server-side with its own sentence, matching the file's sentence-const idiom.

## 6. Surfaces — no new screens; §14 stands

**Decision.** §14's inventory ("if a screen is not on this list, it does not exist") gains
no rows. Both surfaces live inside existing screens:

- **Send:** a **"Share…"** item in the IDE's File menu — the surface that already owns
  export/copy and already lives behind the one `visibleControls.fileMenu` key, so the D§5
  gate lands beside its siblings and disappears entirely when refused (§5.4's
  no-greyed-out-temptations). It opens the product's one overlay idiom with a class-roster
  recipient picker served by a names-only `GET /api/shares/roster/:classId` (the
  `groupShape` names-only precedent — the existing members read is staff-only and the
  class read returns no roster, verified at 930edcf; plan Self-review 4 records this).
  Present in the 1120px overflow under the same gate.
- **Receive:** a **"Shared with you"** section on the class page (the Assignments tab —
  students' default landing), listing pending shares with "Add to my projects" and the
  sharer's name; it renders **nothing when empty**. Not a sixth tab: §4 says "five tabs"
  in prose and table, a students-only tab would be the model's first asymmetric tab, and a
  mostly-empty destination is a section, not a tab.
- **After accept:** the copy is an ordinary StartMenu library entry carrying the D§7 label.
  No StartMenu structural change.

The wrap task records a one-line §14 clarification (the send affordance is part of the IDE
workspace screen; the receive section is part of the Class page screen) in the spec's own
change-log manner.

## 7. The attribution label

**Decision.** The copy shows **"Based on work shared by [name]"** — §8.1's own sentence —
wherever the copy is identified: the StartMenu library row and the IDE's project identity
surface. Rendered from the sidecar (offline-correct), resolved to a live name at read time
when online (server shape includes the resolved name; erased sharer → "Removed student").
Colour is never the only channel; no emoji; History/checkpoint vocabulary rules apply to
any adjacent copy.

**Fiat:** attribution is a property of a project **in the library**, not of a bundle on
disk. An exported bundle carries no attribution (the manifest is never tagged), and an
imported bundle is a fresh unattributed project. Honest, stated, and contract-compliant.

## 8. Revocation and the switch

**Decision.** Revocation revokes **delivery, never the copy, never the ledger**. A sharer
or the class teacher may revoke a **pending** share (it leaves the recipient's list;
`project.share_revoked` logged). An **accepted** copy is the recipient's own project
forever — the share overlay says so at the point of use ("Once they add it, it's theirs —
you can't take it back."). Turning the class switch off stops new shares, hides the
controls, and **lapses** pending shares (`project.share_lapsed`); accepted copies and their
labels stand — §8's record is incorruptible, and the ledger keeps every row.

## 9. Re-shares

**Decision.** A recipient may share their accepted copy onward (it is their project). The
**label names the immediate sharer**; the **ledger records the chain** — each
`project.shared` event carries the source project's own attribution, if any. One person on
the label, the whole provenance in the record: §8.1's sentence stays literally true and the
audit trail stays complete.

## 10. Notifications

**Decision.** None. §9's table is closed ("every email the system will ever send") and has
no share row; the bell is Plan 8's. Discovery is pull-based on the class page. When the
bell lands in Plan 8, share events join it — recorded here as Plan 8's carry-forward, not
built now.

## 11. Shape — the stages

| Stage | Delivers | Depends on |
|---|---|---|
| 0 — debt + spine | backend helper extraction (`pgErrorCode`/`isStaffRole`/`toEpoch` homes, `requireClassStaff` collapsing the eight inlined staff checks; `guideVisibleToStudent` rename), the product-contract Plan 7 amendment (contract before code), `shared/src/sharing.ts` contracts, migration 0006 (`shares` + `classes.peer_sharing` + `projects.attribution`, all in one), test-net extensions | — |
| A — the switches | `classes.peer_sharing` end-to-end (PATCH + Settings section), the individual-work flag made real (stamp, override, true label) | 0 |
| B — the share (server) | the D§5 gate; POST /api/shares; GET /api/shares/incoming; accept/revoke/lapse; the events; the backend suite incl. the gate matrix, cap interaction, group refusal, erasure resolution | A |
| C — the client | File-menu Share overlay behind the gate; "Shared with you" section + accept flow; sidecar attribution; the label surfaces; frontend suites incl. offline | B |
| D — wrap | the authority-matrix refusal test (owed before Plan 8; ~47 existing + Plan 7's rows, one file, refusal-matrix shape), honesty copy (the four ban edits, the label fixes, projectStore header, README/DEPLOY debt), spec §14 clarification, golden-flow e2e extension (share → accept → attribution), browser-pass checklist | C |

Roughly 16–18 tasks. Worktree-lane parallelism only where files are disjoint; implementers
strictly serialized per tree (Plan 6's standing lesson).

## 12. Deliberately NOT in Plan 7

Class-wide galleries or publish-to-class; share messages, comments, or any feed; outward
sharing of group projects; live/read-only references; a `share` workspace-rule key; the
notification bell and share emails (§9 closed; Plan 8); a ledger-viewing screen (the record
exists in `events`; a surface for it is future work); admin data requests, rubric marking,
real email delivery, BlobStore, the GCP port, websockets (all still excluded); any change
to sync mechanics or `SCHEMA_VERSION`.

## 13. Design-system and test obligations

Tokens only; Plan 5 primitives + the overlay idiom; 30px portal controls; one focus ring;
colour never the only channel; **no emoji anywhere**; 1024px floor hides nothing
load-bearing; `portalControls.test.js` DIRS gains any new directory in the task that
creates it; a metric-lint conformance test for any new stylesheet; new tables join
`truncateAuthTables` in the migration task; every route body with more than one field
validates via a shared zod schema (the standing convention); every mutation writes
`logEvent` inside its transaction; refusal sentences are file-level consts asserted
verbatim by tests.

## 14. Open points resolved by fiat (recorded so the plan can cite them)

1. **Named peers, not a gallery** — the reversible direction; widening later is one
   additive `recipient = whole class` case (D§1).
2. **The frozen manifest lives on the share row**, so accept survives source deletion and
   the "version identifier" is a server-known value (D§4).
3. **Attribution never survives export/import** — a bundle is a new artifact (D§7).
4. **The label names the immediate sharer; the ledger records the chain** (D§9).
5. **Pending shares lapse when the class switch goes off**; accepted copies stand (D§8).
6. **A share of assignment work requires `exportAndCopy` on** — share is a copy-out and
   §5.4 carved out submit, not share (D§5.3).
7. **Group projects cannot be shared outward**, enforced on the row identity server-side
   (D§5.4).
8. **The cap refusal at accept gets its own sentence** — the recipient must never see the
   generic own-limit sentence on someone else's action (D§4).
9. **No notification of any kind in Plan 7** — pull-based discovery is the §9-compliant
   shape (D§10).
10. **`visibleToStudent` is two predicates, not one** — the guides one is renamed, never
    merged (Stage 0).
