# Plan 9 design — the postman, the port, and the retention clock

**Spec authority:** `docs/classroom-platform.md` §9 (the email table and the pretend-inbox
sentence: "Real email delivery gets connected during the cloud step at the end. Nothing
about the design changes; only the postman does."), §10 (Health: "email log (what was
sent, what bounced)", "storage used"), §11 (retention: "kept for a set period (proposal:
3 years) then deleted automatically"), §12/§15 (leanness; assumption 10's sequencing:
cloud move sized for 200, real email connected at that point), §18 (design contract).
Constrained by `docs/classroom-platform-stack.md` (§3 "one process, no queues, no Redis,
no background workers"; §6 the GCP mapping, region `africa-south1`, "Email — provider
chosen then (e.g., Brevo free tier ≈ 300 emails/day)") and `DEPLOY.md`'s "Before the GCP
step (security checklist)" — ten boxes accepted during Plans 1–2 with the explicit gate
that they land before any cloud deployment.

**Research ground:** the Plan 9 research map + critic gaps (durable at
`.superpowers/sdd/2026-08-29-classroom-platform-09-postman-retention/research/`), produced
2026-08-29 by a five-reader sweep + one adversarial critic over the tree at Plan 8's close.

**Verification pass (2026-08-29):** four independent checkers read this design and its plan
against the actual tree; a triage editor verified each report and produced 42 findings (6
BLOCKER, 25 IMPORTANT, 11 MINOR) at `research/doc-verify-findings.md`. Every one is applied
here. Where a finding overturned a sentence this document had already written, the
replacement is stated plainly rather than softened — six of them were behavioural defects,
not wording.

**Provenance note (recorded honestly):** these decisions were made by the controller under
the user's standing continuous-execution order ("when done with plan 8, proceed with
creating and implementing plan 9"), grounded in the spec's own text, the stack briefing's
embedded decisions, and the research map — not in a brainstorming dialogue. Each fiat is
recorded with reasons and cost, and each is reversible in the direction chosen.

**The frame:** Plans 1–8 delivered everything the spec builds "on your machine first".
Plan 9 is the spec's own last step: the cloud move — and the postman that the spec ties to
it. The user's directive is the explicit trigger assumption 10 was waiting for. One hard
boundary shapes the whole plan: **provisioning real cloud resources and a sending identity
requires the user's hands** (Google account, billing, domain, provider signup, DNS). So
every task is built and TESTED LOCALLY, the port lands as runbook + artifacts, and the
final provisioning session is explicitly user-gated. Nothing stalls waiting for the cloud:
the postman is proven against a fake provider locally, and the switch is config.

---

## 1. Scope — what Plan 9 IS

1. **The real mail driver** (the postman) behind the existing one-seam `Mailer` interface,
   selected by explicit config, with the dev pretend inbox UNTOUCHED for dev/test.
2. **The send-failure posture** — the single biggest behavioral decision (research OQ #8),
   ruled in §4 below: never-throw, record-on-the-row, no queues, no retries, one deadline.
3. **The erasure↔postman collision closed** (research MISSING #4), in BOTH directions: a
   seam-level suppression of future sends to the erasure sentinel domain, and the erase
   transaction gaining the `emails` delete it never had (§5).
4. **Bounce ingestion, minimal** — the spec's Health promise "what bounced" (§10) via one
   secret-gated webhook route updating `emails.status`; the EmailsTab status column and
   Health "storage used" land with it.
5. **The code-side pre-GCP checklist boxes** (`DEPLOY.md:100-109`), named individually so
   the two documents agree on which ones Plan 9 owns:
   - box 1 (`:100`) redacted production bodies — Task 3;
   - box 2 (`:101`) `trustProxy` wired from config — Tasks 2/6;
   - box 3 (`:102`) explicit argon2id parameters — Task 6;
   - box 4 (`:103`) `NODE_ENV=production` so the session cookie carries `Secure` — Task 6;
   - box 5 (`:104`) `ADMIN_PASSWORD` mandatory at seed in production — Task 6;
   - box 7 (`:106`) the forgot-route per-address throttle AND the mail-failure oracle
     closure — Tasks 5 and 2 (never-throw is what closes the second half);
   - box 8 (`:107`) join-code, invite-batch and class-creation throttles — Task 7;
   - box 10 (`:109`) the `/vendor/**` cache header — which is a FILE CHANGE, not an
     inspection: `frontend/vercel.json` today has exactly two header rules (`/assets/(.*)`
     immutable and a COOP/COEP rule on `/(.*)`) and no `/vendor` rule at all, so the
     vendored GlowScript runtime gets the host default. Task 10 adds the rule; the runbook
     step is `curl -I`, verification, not the fix.
   Box 6 (`:105`, the 1-instance pin) is a deploy flag and belongs to the runbook. The
   note at `:108` (member removal revokes invites for the registered address only) is a
   recorded residual risk with no action to take; its mitigation already shipped
   (`invites.ts`'s revoke route, `classes.ts`'s regenerate-code route) and Task 11
   annotates it as accepted rather than pretending it is work.
6. **Retention machinery** riding the existing daily tick: `classes.archivedAt` (migration
   + a backfill sourced from the events ledger), the sweep behind an admin-visible setting
   defaulting to the spec's 3-year proposal, and the honesty passes (PrivacyPage's "not yet
   a running promise" sentence changes ONLY when the sweep genuinely ships).
7. **The port artifacts**: `infra/` (Dockerfile, .dockerignore), the deploy runbook
   (gcloud step by step, Cloud SQL + Auth Proxy migration story, Secret Manager wiring,
   Cloud Scheduler → /api/tick, 1-instance pin), and the provisioning session itself —
   the ONE user-gated stage, last.
8. **Contract + copy honesty**: the amendment lifting "real email delivery" and "the GCP
   port" from the exclusion sentence (contract-before-code, Plan 8's pattern) WITH an
   explicit supersession clause for the notifications amendment's locked "Real email
   delivery remains excluded" row at `product-contract.md:185`; the privacy-page
   sub-processor sentence and the transborder ruling (POPIA — §10 fiat 12); and the
   wrap-stage copy pass with its meta-test discipline.

## 2. Deliberately NOT in Plan 9

CI/CD (no .github today — research MISSING #6; one maintainer runs npm scripts; recorded,
not built); List-Unsubscribe/RFC 8058 one-click (the five switchable templates get a plain
footer line pointing at /profile's switches — signed one-click URLs are machinery with no
spec demand; recorded). **That footer lives in `backend/src/email/templates.ts`, so BOTH
drivers emit it** — spec §9 promises the pretend inbox shows "every email it *would* have
sent, exactly as it would look", and a footer the dev inbox cannot show would make the
preview a lie and make that lie a tested requirement. The byte-identity constraint the
suites actually depend on is narrower than "no change to any body": the ~20 protected
assertions match `token=([A-Za-z0-9_-]+)` inside the persisted body, and the five
switchable templates carry no token at all (confirm, reset and the two invite templates —
the token-bearing ones — are all Always rows, never switchable). So the constraint is
re-scoped, once, to **"no change to token URLs or to the persisted-body shape the token
regexes read"**.

Also not in Plan 9: provider webhook signature crypto beyond the shared-secret gate; HTML
email (spec §9: short, plain); a second provider/fallback; email open/click tracking
(never — §9 "nobody is ever emailed for marketing"); Firestore revisits; websockets/queues
(stack ban, permanent); rubric marking; Plan 10's two workstreams (mobile audit + gate,
runner visual defaults — user-ordered, post-Plan-9); events-table indexes (nothing new
reads the ledger; the tick's seq scan stays fine at 200 users — note the retention backfill
READS the ledger once, which the constraint permits: it bans indexes, columns and deletes
on `events`, not reads); migrate-on-boot machinery (the runbook's manual Auth-Proxy
migration is the honest one-maintainer story).

**BlobStore, declined with its trigger fired.** `product-contract.md:159` reads "No
BlobStore until **the cloud plan**", and `classroom-platform-stack.md:115` maps Files to a
Cloud Storage bucket as part of the port this plan executes — so the deferral's trigger has
passed and declining it silently would leave a dead clause. Plan 9 declines it deliberately:
instruction images are capped inline data-URIs (≤200KB per image, ≤1MB per document,
enforced in the shared zod schema), submissions are frozen manifests in `jsonb`, and
nothing in the product currently exceeds those caps or asks to. Task 1 re-pins the contract
clause to a new trigger — **"No BlobStore until a feature exceeds the §7 data-URI caps"** —
so the clause names a condition that can actually fire.

## 3. The driver matrix (D§3) — the pretend inbox is load-bearing test infrastructure

Research finding: NO test injects `deps.mailer`; ~20 assertions across 11 backend suites
regex live tokens out of persisted `emails.bodyText`, and both e2e scripts confirm signups
through the pretend inbox. The dev driver is therefore a CONTRACT, not a stub.

**Decision.** Selection by explicit `MAIL_DRIVER` env (zod enum `dev | brevo`, default
`dev`) — never NODE_ENV magic. `dev` keeps `createDevMailer` byte-identical: full bodies,
clickable tokens, status `dev`. `brevo` is the postman: the provider's HTTP API (the stack
doc's own example; plain `fetch`, ZERO new npm dependencies) — and it writes its OWN
`emails` row per send with a REDACTED body (`token=` params stripped, DEPLOY.md box 1) and
a real status. The `Mailer` interface and `MailMessage` shape do NOT change (research
wrong-claim #2 resolved differently than the critic feared: the provider message-id never
crosses the interface — the driver that owns the send also owns the row, so correlation is
internal to it).

**The seam wraps the injected dep, not around it.** `app.ts:36` today reads
`deps.mailer ?? withPreferences(deps.db, createDevMailer(deps.db))`, so an injected mailer
would replace the whole chain and no integration test could ever exercise a wrapper. The
injected dep becomes the DRIVER, inside the wrappers:
`app.decorate("mailer", neverThrow(app.log, withPreferences(deps.db, suppressErased(deps.mailer ?? selectMailDriver(config, deps.db)))))`.
No suite in the tree injects `deps.mailer` today (`grep -rn "mailer:" backend/src` returns
only the type declaration at `app.ts:28`), so this changes zero existing behaviour — and it
is what lets Task 5 prove the oracle closure with a real failing driver instead of an
eyeball.

**Provider wire details are fetched, not remembered.** Nothing in this repo or in the
research map records the provider's endpoint path, request field names, event vocabulary,
or whether the webhook's message-id is byte-identical to the send response's (it is
commonly angle-bracketed). The research map's five Brevo mentions are all quotes of
`classroom-platform-stack.md:50` ("a provider like Brevo or Mailgun") and `:118` ("Brevo
free tier ≈ 300 emails/day") — no wire detail at all. **Rule: before the fake is written,
the implementer fetches the provider's current transactional-send and webhook
documentation and records the URL + retrieval date in `brevoMailer.ts`'s docblock.** The
request payload, the event vocabulary and the correlation key are copied from there. If the
webhook's id differs in form from the send response's, it is normalised at write time with
a comment saying so. A fake built from remembered strings passes its own tests whatever the
truth is, and the only step that would discover the mismatch is the user-gated session.

**The volume arithmetic, done against this product's own fan-out.** Every send site is
per-recipient. Five classes of 30 sharing one due date send 150 `due-tomorrow` reminders
from a single tick; the submissions that follow send up to 150 receipts; a marks release
sends up to 150 more — **a peak of roughly 450 sends on a marks day**, and the first day of
term (invite batches of 50 addresses each, one row and one send per address, plus a confirm
per signup) crosses 300 before lunch. So the provider's ≈300/day free tier does NOT fit;
the deployment needs the provider's lowest paid tier, sized at **≥1,000 sends/day**. The
exact plan name and price are read off the provider's current pricing page at the
provisioning session and recorded in the runbook — this document does not name a plan from
memory. Over the cap the provider rejects; under §4's no-retry ruling that rejection
becomes a `failed` row and nothing else, visible only on the admin's once-a-week glance —
which is why the tier is sized above the peak rather than at it.

**THIS IS A USER DECISION, NOT A CONTROLLER FIAT — and it is the one open question this
document deliberately does not close.** A paid mail tier is a NEW RECURRING COST on a
project whose standing constraint is minimal-resource operation, and whose only accepted
standing cost to date is the ~R250/month database (`classroom-platform-stack.md` §4/§6,
which budgeted email at "R0 at this scale" on the free tier — an estimate this
document's own arithmetic now contradicts). The controller has no mandate to commit the
user to a recurring bill. Three honest options, to be put to the user before Stage E and
ideally before Stage A commits to a provider:
(a) **pay the lowest tier** (~1,000 sends/day) and accept a second standing line item;
(b) **cut the volume to fit the free tier** — the fan-out is dominated by per-recipient
    sends on marks days, so a per-class daily digest for the three switchable
    assignment mails would collapse 450 into tens; this is a PRODUCT change (§9's table
    promises per-event mail) and would need its own spec amendment;
(c) **ship the postman anyway and let peak days drop mail** into `failed` rows — cheapest,
    and dishonest against §9's promise that these emails are sent; recorded only for
    completeness, not recommended.
The plan proceeds on (a) as its working assumption because it is the only option that
keeps §9's promises without a spec change; every task before Stage E is provider-agnostic
behind the seam, so switching to (b) costs the design doc and one task, not the build.

## 4. The send-failure posture (D§4) — never throw, record on the row, no retries

**Decision.** All thirteen call sites keep their exact shape. The seam gains TWO wrappers
around the driver, in ONE fixed order:

```
neverThrow(app.log, withPreferences(deps.db, suppressErased(driver)))
```

**Never-throw is OUTERMOST, and the order is behaviourally load-bearing.** No send site in
the tree has a try/catch, so the outermost layer is the only thing standing between a
rejection and thirteen request handlers — that is the whole reason never-throw exists, and
it is only true if nothing sits outside it. Put it inside instead and `withPreferences`'
`notification_prefs` SELECT (`withPreferences.ts:20-23`) sits OUTSIDE the catch, so a
pref-lookup DB error still rejects into every call site and this section's promise is false
for exactly the five switchable templates. There is no competing reason: a switched-off
send returns normally under any order (`withPreferences.ts:24`), and `neverThrow` counts
nothing, so "a switched-off email must never be counted a failure" is not an argument for
any ordering at all.

A send that rejects is caught, logged once via the app logger, and recorded — the brevo
driver has already written its row and marks it `failed` (the dev driver cannot fail).

**One deadline, named here.** Node's `fetch` has no useful default timeout, so a
black-holed connection or a stalling provider never rejects and never-throw never fires —
and all thirteen sites `await` the send inside the request handler, so one stalled provider
would hang signup, forgot-password and every invite until Cloud Run's request timeout, with
`--max-instances=1` leaving nowhere to shed load. The driver therefore calls
`fetch(url, { signal: AbortSignal.timeout(10_000), … })`. Ten seconds is the whole budget a
send is allowed to cost a user's request.

No queues, no retry machinery, no tick-driven resend (stack §3/§7 ban; the tick's "sent at
most once" contract stands — its dedupe rows still commit first, and its response counter is
renamed honestly in Plan 9's Task 9 so `{ sent }` no longer counts intentions).
Consequences the rulings accept: a failed send is visible in the admin email log (status
column) and is NOT automatically retried — at 200 users the admin's once-a-week glance
(§10's own framing) is the recovery path, and the alternative is a queue in all but name.

**The invite loop, stated accurately.** Never-throw removes the 500 that a dead provider
would otherwise throw mid-batch: every recipient's invite row and token now land, and every
send that fails lands its own `failed` row. It does NOT add a per-recipient result channel
— research MISSING #8's actual point. `invites.ts:48-75` pushes each address into `sent`
immediately after the awaited send and returns `{ sent, skipped }`, so once rejections are
swallowed, `sent` would list all 50 addresses no matter how many rows landed `failed`: the
teacher's screen would say the invites went out while thirty students never heard.
**Decision: the response field is renamed `invited`** — which is what the loop actually
records, an invite row and a token created — and `PeopleTab.js`'s sentence becomes
"Invited N people". Delivery is a separate fact, and the admin email log is where it lives.
The rename lands in the SAME commit as never-throw (Task 2), because that commit is what
makes the old name false.

## 5. The erasure collision (D§5) — both halves

**Decision, first half (future sends).** `suppressErased` refuses any `to` ending
`@erased.invalid` (the scrub's sentinel domain, `admin.ts:190`) before the driver sees it —
no roster query changes at any of the send sites, no reputation-burning hard bounces, no
processing of an erased person's address. Suppressed sends write NO row (delivery state for
a person who does not exist). It sits innermost, immediately around the driver, so it is
the last thing that runs before the wire.

**Decision, second half (past sends).** Seam-level suppression closes future sends and
nothing else. The erase transaction (`admin.ts:168-255`) deletes sessions, email_tokens,
notifications, notificationPrefs, shares and non-group projects — it never touches `emails`,
and `emails.toUserId` carries no FK (`schema.ts:66`), so nothing cascades. After an erasure
the log still holds the person's real address in `to_email` plus, verbatim in `body_text`,
their marks and their teacher's comments (`templates.ts`'s `marksReleased` and
`workReturned` both interpolate the score and the comment into the body today) — none of
which the `token=` redaction touches — and the export still returns those rows in the shell
account's data. Fiat 12 stops `marksReleased` accruing new ones, but `workReturned` still
carries the teacher's comment and every row written before that edit still holds both, so
minimisation reduces the exposure and does not close it. By fiat 7 below the log is
operational, not a record, so those rows have no
claim to survive an erasure; and Plan 9 is precisely what turns them from pretend-inbox
artefacts into real delivery records. **The erase transaction therefore gains one line —
`await tx.delete(emails).where(eq(emails.toUserId, u.id));`** — landing in the same task
that ships the postman, with an assertion in the existing erase test.

## 6. Bounce ingestion (D§6) — the smallest honest version of "what bounced"

**Decision.** One route: `POST /api/mail/events`, gated by a shared secret header
(`MAIL_WEBHOOK_SECRET`, the TICK_SECRET idiom — same posture, same test pattern, and
therefore the same code: **403 with a file-level `FORBIDDEN` const**, matching
`tick.ts:14`/`:103`, not 401; a wrong secret and a missing one look identical to the
caller). Body validated to the provider's webhook shape (fetched from live documentation
per §3, not written from memory), updating the matching `emails` row (by the provider
message-id the brevo driver stored) to `bounced`/`delivered`. Unknown ids are 200-and-drop
(webhooks retry; a 404 loop helps nobody). No signature crypto beyond the secret (recorded
bound).

Three things the smallest version still has to get right:

- **It is throttled.** It is the only public door Plan 9 opens, and Task 7 throttles
  everything else. It registers inside a plugin scope with
  `config: { rateLimit: { max: 120, timeWindow: "1 minute" } }` — a route registered
  directly on the root instance has a silently inert limit (`app.ts:41-44`'s own note).
- **It gets its indexes.** Every event UPDATEs on `emails.provider_id`, a brand-new column,
  and `emails` has no index of any kind in migrations 0000–0008 — not `created_at`, not
  `status`. Migration 0009 creates `emails(provider_id)` and `emails(created_at)`; the
  second is what the 180-day prune reads. (This is `emails`, not `events` — the ledger's
  no-index constraint is untouched.)
- **The row exists before the provider answers.** The driver INSERTs its row with status
  `sending` FIRST, then UPDATEs it with the `providerId` and the outcome. Writing the row
  after the call returns loses two ways: a `delivered` event arriving in the same second
  hits the 200-and-drop path and the status never updates, and a crash between the provider
  accepting the mail and the insert leaves a real send with no row at all — which makes
  "what was sent" a lie.

EmailsTab gains the status column (When/To/Subject/Status — the spec's §10 row). Per D13
(`classroom-platform.md:546`, repeated for this console at `:339`) the status resolves
through the semantic tokens **and** carries the word: `bounced`/`failed` danger,
`delivered`/`sent` success, `dev` neutral — colour is never the only channel, and the word
alone is not the whole requirement either. Health gains "storage used" (a
`pg_database_size` read — §10's other promised line) in the same task, closing both §10
promises the research found dead in the UI.

## 7. Retention (D§7) — the clock starts when the machinery lands

**Migration.** `classes.archivedAt timestamptz`, set by the archive route from now on and
CLEARED on unarchive.

**Backfill, from the ledger.** Already-archived classes need a start for their clock, and
one already exists: `classes.ts:197-199` logs `class.archived` with `{ classId: id }`
inside the archive transaction, so `events` has carried a dated row per archived class since
Plan 5. The earlier reading — "no historical archive timestamp exists, so start every clock
at now()" — was simply wrong, and starting real 2026 archives at 2026 would over-retain by
up to a year for no reason. The backfill is one idempotent `UPDATE` appended to the
generated migration after a `--> statement-breakpoint`: this repo's migrations are plain SQL
with breakpoint separators (`0006_lazy_aqueduct.sql`, `0008_material_magus.sql`), so a data
statement there is the ordinary supported pattern, not a hand-edit of something drizzle
owns. It sources the timestamp from `MAX(created_at) WHERE type='class.archived' AND
payload->>'classId' = id`, falling back to `now()` only where no such event exists, and is
guarded by `archived_at IS NULL` so a second run is a no-op. The ledger is READ, never
written to and never indexed — which the Global Constraint permits.

There is deliberately no one-off script. `backend/scripts/` is not a directory in this
tree, root `db:migrate` (`package.json:17`) runs the dev AND test databases together, and
nothing in the runbook would have run a script — so a test fixture seeded as
already-archived would silently carry `archivedAt = NULL` and never be swept, and
production's already-archived classes would keep it NULL forever, which is exactly the rows
retention was built for.

**Where the sweep runs.** In its OWN transaction with its own advisory-lock key, **BEFORE**
the reminder transaction, one class per transaction, capped at **N = 5 classes per tick** so
a backlog drains over days instead of in one long statement. Both halves of that matter.
Ordering: `tick.ts:120-155` fills `toSend` inside the reminder transaction and `:161-169`
mails it after commit, and `assignmentsDueTomorrow` (`tick.ts:32-45`) filters on
status/dueAt/closedAt only — it never excludes archived classes — so a class swept later in
the same transaction could already have a reminder queued, and with a real postman attached
that reminder would be mailed for a class that no longer exists. Isolation: the reminder
dedupe rows (`logEvent` + `notify`, `tick.ts:145-151`) commit in that same transaction, so
any sweep failure — a statement timeout on a large class, a lock conflict, Cloud Scheduler's
attempt deadline cutting the connection — would roll the reminder rows back with it;
Scheduler retries, hits the same class, fails again, and due-tomorrow reminders stop
indefinitely with the only signal a Scheduler error nobody watches. Two transactions, two
lock keys, sweep first.

**What the sweep deletes.** Three facts, in this order:

1. Delete the class's `notifications`. `notifications` has no FK to `classes`
   (`schema.ts:439-444` keys it on `users.id` and `events.id` only) and carries a
   denormalised `classId` in its payload, written by `tick.ts:148-151` and the assignment
   routes — so without this step every swept class leaves live bell rows linking to 404s.
   This is the same "delivery state, not history" category the erase route deletes
   explicitly at `admin.ts:208`.
2. Then `DELETE FROM classes` for the class, and let the FK cascade carry the rest:
   `class_members` (`schema.ts:98`), `invites` (`:114`), `assignments` (`:186`), `guides`
   (`:363`), `shares` (`:391`), and transitively `submissions` (`:250`), `marks` (`:280`),
   `groups` (`:314`), `group_members` (`:332`), `assignment_work` (`:223`). An enumerated
   list of manual deletes would be redundant with the schema and would drift from it —
   cascades from `classes.id` are everywhere in this tree, and the erase route is the only
   *manual*-delete precedent, not "the only cascade precedent".
3. Each swept class writes ONE `class.retention_deleted` event (payload: classId, name,
   counts) — in the sweep's own transaction. `events` rows are never deleted.

**What the sweep does NOT touch: `projects`.** See fiat 11 — it is a ruling with reasons,
not an omission.

**The period** is a `settings` row (`retentionYears`, default 3 — the spec's proposal
becomes the shipped, admin-adjustable default; §11's own wording "a set period (proposal: 3
years)" is satisfied without locking the number in the contract). Because this setting is
the trigger of an irreversible mass delete, it is not simply the cap's control copied: it
validates through its own `RetentionSchema` (`z.number().int().min(1).max(50)`), it is read
back through a `typeof … === "number" ? … : 3` guard in the sweep (`getSetting` returns
`unknown`, `settings.ts:8` — a row holding `0`, `null` or `"3"` would otherwise go straight
into interval arithmetic; the signup cap already defends itself exactly this way at
`auth.ts:81`), and the admin control carries a confirm step showing **how many classes the
new value would delete** before it saves. The tree's own destructive precedent makes an
admin retype the subject's email verbatim (`admin.ts:176-179`); a bare number input with one
Save button, where typing 1 instead of 10 destroys every class archived more than a year ago
at the next tick, is below that bar.

**The copy.** The PrivacyPage retention sentence (research wrong-claim #5 — live copy at
`PrivacyPage.js`'s "How long things are kept") is EDITED in the same task the sweep ships:
the "not yet a running promise" honesty clause leaves only when it becomes true, and the
replacement is worded to cover what the sweep actually does — **the class, its work and its
marks go; the students' own project libraries are theirs and stay** — plus the fact that the
period is admin-adjustable. That sentence gains a verbatim lock in
`welcomeSubpages.test.js`'s PrivacyPage pinned-statements test, beside the six already
there; the section has no lock today and can drift silently.

**Email-log hygiene** joins the same sweep: `emails` rows older than 180 days are deleted
(the log is an operational surface, §10's "once-a-week glance", not a §11 record — and
§11's "What we store" list never names it; research MISSING #7 weighed and closed in the
direction of deleting).

## 8. The port (D§8) — artifacts and runbook now, hands-on provisioning gated

**Decision.** `infra/Dockerfile`, `infra/.dockerignore`, and `docs/DEPLOY-GCP.md`.

**How the container runs the backend (fiat 14).** The image installs the workspace and runs
`tsx backend/src/server.ts`, with `tsx` moved from `backend`'s devDependencies to its
dependencies. It does NOT compile to `backend/dist`. "Add a `build` script `tsc -p backend`"
does not work in this tree and would not have been discovered until the container failed to
boot: `backend/tsconfig.json:8` is `"noEmit": true` with no `outDir`/`rootDir` and its
`include` is `["src", "drizzle.config.ts"]`, so once `noEmit` flips the inferred rootDir is
`backend/`, putting the entry at `backend/dist/src/server.js` and compiling every
`*.test.ts` into the image; and `shared/package.json:6` is `"main": "src/index.ts"` — raw
TypeScript with no build script — which compiled backend JS imports in production modules
(`email/withPreferences.ts:2` and the auth/classes/members/invites/groups/guides/assignments
routes), so plain Node 20 dies with ERR_UNKNOWN_FILE_EXTENSION on the first import. Making
that work means two `tsconfig.build.json` files, build scripts in both workspaces, and
repointing `shared`'s `main`/`exports` at `dist/index.js` behind a `development` condition
so tsx and vitest still resolve `src` — a change whose failure mode is the module resolution
of all eleven backend suites. Cost of the choice made instead: the image carries tsx and
esbuild (~10 MB) and pays a sub-second transpile at cold start, which at one pinned instance
and school-hours traffic is a once-a-morning cost. Reversible: if a future measurement shows
the cold start matters, the compiled path is the named upgrade, and the shared-workspace
export change is the whole of its risk.

**Two things the container needs regardless.** `backend/src/server.ts:7` binds
`host: "127.0.0.1"`; Cloud Run requires `0.0.0.0:$PORT` or the revision never starts, and a
`docker run -p` publish cannot reach a loopback-bound process either. It becomes
`host: process.env.HOST ?? "0.0.0.0"`. And local verification uses PUBLISHED PORTS
(`docker run -p 8080:8080`), never host networking, which does not exist on Docker Desktop
for Windows.

**The runbook** is numbered and copy-pasteable: project + region (`africa-south1`); Cloud
SQL Postgres smallest tier with **automated backups and point-in-time recovery enabled
before the first tick after the sweep ships** (an irreversible mass delete with nothing to
restore from is not a deployment, it is a hazard); the Auth Proxy migration flow (manual
`npm run db:migrate` from the maintainer's machine through the proxy — no migrate-on-boot,
no CI, recorded) followed immediately by the **seed** step through the same proxy (Task 6
makes `seed.ts` ABORT in production without `ADMIN_PASSWORD`, so without this step there is
no admin account and the admin console — the only place a failed send is visible — is
unreachable); Cloud Run deploy with `--add-cloudsql-instances` and the unix-socket DSN form
(a plain `DATABASE_URL` cannot reach Cloud SQL), a service account carrying
`roles/cloudsql.client` and `roles/secretmanager.secretAccessor`, and sizing chosen in the
same breath as the argon2 numbers: `--memory=1Gi --cpu=1 --concurrency=20
--max-instances=1 --timeout=600s` (Task 6 sets argon2 `memoryCost 19456`, ~19 MiB RSS per
concurrent hash, against a 512 MiB default at concurrency 80 on a single pinned instance — a
class of 30 signing in at the start of a lesson OOM-kills that container with nowhere to shed
load); Secret Manager (DATABASE_URL, TICK_SECRET, MAIL_WEBHOOK_SECRET, BREVO_API_KEY,
ADMIN_PASSWORD); Cloud Scheduler → `POST /api/tick` daily with `--attempt-deadline=600s`
matched to the Cloud Run timeout; static hosting (the existing Vercel path — see the ruling
below); `trustProxy` and `NODE_ENV=production` wiring; DNS/SPF/DKIM for the sending domain;
and the provider account + sender-identity steps.

**~~Firebase Hosting leaves the runbook~~ — REVERSED 2026-08-29 by the user, on evidence.
The static site moves to Firebase Hosting with a rewrite to Cloud Run.**

The original ruling said: the Locked Hosting row names Vercel, the site is already deployed
there, and a second host config would carry the same three rules for zero delivered
capability — "never pre-build infrastructure ahead of an explicit trigger", applied
literally. **That reasoning was wrong, and it was wrong because it never checked the origin
model.** A second host was not buying "zero capability"; it was buying the only origin model
this product can actually run under.

**The defect the reversal fixes.** This frontend is architecturally same-origin, verified
in the tree:
- `frontend/src/utils/api/client.js:14` sends `credentials: "same-origin"`, and its own
  docblock reads "Cookies ride along (same-origin)". Cross-origin, the browser sends **no
  session cookie at all**.
- Every call is a RELATIVE path (`fetch(path)` over `/api/...`) — there is no API base URL,
  no `VITE_API_*`, no absolute origin anywhere in `frontend/src`. Requests go to whatever
  origin served the page.
- The session cookie is `sameSite: "lax"` (`auth.ts:235`), which is not sent on cross-site
  requests.
- There is **no CORS plugin** — `cors` appears nowhere in `app.ts` or `backend/package.json`.

So the runbook's planned split — static on Vercel, API on Cloud Run, two origins — would not
have degraded gracefully. Every authenticated request would have failed: the relative `/api`
path would hit the static host, and even with CORS bolted on, `credentials: "same-origin"`
plus `SameSite=Lax` means no cookie crosses. The first person to discover it would have been
the user, mid-provisioning, in the one stage that cannot be rehearsed locally.

**The decision (user, 2026-08-29): Firebase Hosting + rewrite to Cloud Run.** Static assets
serve from Firebase Hosting's CDN; a `rewrites` rule sends `/api/**` to the Cloud Run
service in `africa-south1`. The browser sees ONE origin, so:
- **No backend code changes.** `credentials: "same-origin"` keeps working, `SameSite=Lax`
  stays (strictly safer than the `SameSite=None` a two-origin split would have forced), and
  no CORS plugin is ever needed. The same-origin assumption the client was built on becomes
  true in production instead of accidentally false.
- `/vendor/**` keeps real CDN caching, which `product-contract.md:106` makes a Locked term
  conditional on the hosting layer.
- No standing load-balancer cost, which the LB-and-bucket alternative would have added
  against the minimal-resource constraint.

Two options were declined, recorded so the choice is legible: serving the SPA from the Cloud
Run container itself (same-origin by construction and one artifact, but a new dependency,
coupled deploys, and every asset served by the single pinned instance that also hashes
passwords — no CDN, which makes the `/vendor` offline promise harder); and keeping Vercel
with a proxy rewrite to Cloud Run (fixes the auth defect with the least change, but adds an
edge hop plus Vercel egress and delivers none of the single-cloud coordination asked for).

**Consequences carried into the plan:** the Locked Hosting row at `product-contract.md:25`
IS amended (Task 10a, contract-before-code); `frontend/firebase.json` ships; the runbook's
static-hosting step becomes Firebase, including `APP_BASE_URL` pointing at the Hosting
domain rather than the Cloud Run URL, since that value builds every confirm/reset/invite
link. `frontend/vercel.json` stays in the repo and keeps its `/vendor` rule — it is the
currently-live deployment and correcting it costs nothing — but the runbook deploys Firebase.
Whether to retire Vercel afterwards is a user decision surfaced at Stage E, not assumed here.
**Cost if wrong:** one config file and one runbook step to unwind, and the backend is
untouched either way.

**The final stage is the provisioning session and is explicitly USER-GATED**: it needs their
Google/provider accounts, billing, domain and DNS — the plan text says the controller stops
there and asks. Everything before it is verified locally: the container builds and boots
against local Postgres over published ports; the brevo driver is tested against a fake; the
checklist boxes are code + tests.

## 9. Config (D§9)

`config.ts` gains:

- `MAIL_DRIVER` (`z.enum(["dev","brevo"]).default("dev")`) — **and a superRefine clause
  beside the existing TICK_SECRET one (`config.ts:19-27`): when `NODE_ENV === "production"`,
  `MAIL_DRIVER` must be `brevo`, or boot fails.** Without it a revision deployed without the
  var — a typo, a forgotten `--set-env-vars`, a rolled-back revision — boots happily and
  writes every message to the pretend inbox: `createDevMailer` persists the FULL body with
  the live token. Zero mail leaves the building, the Emails tab looks healthy (every row a
  successful-looking `dev`), and the production database fills with raw `?token=`
  confirm/reset/invite URLs — exactly what DEPLOY.md box 1 forbids and what Task 11 would
  tick `[x]` as closed.
- `MAIL_FROM` and `BREVO_API_KEY` — required when `mailDriver === "brevo"` via superRefine,
  the TICK_SECRET pattern.
- `MAIL_WEBHOOK_SECRET` — **NOT tied to the driver.** It follows the TICK_SECRET idiom in
  full, which is two halves, not one: the superRefine requires the env var when
  `NODE_ENV === "production"`, AND the exported field carries a non-optional fallback beside
  `tickSecret` at `config.ts:36` — `mailWebhookSecret: env.MAIL_WEBHOOK_SECRET ?? "dev-mail-hook"`.
  The fallback is what makes the guard safe, and it is the half that is easy to drop: with an
  `undefined` secret under the default `MAIL_DRIVER=dev`, a request carrying no
  `x-mail-secret` header yields `req.headers["x-mail-secret"] === undefined`, and
  `undefined !== undefined` is false — the door OPENS, and any unauthenticated caller can
  rewrite `emails.status` rows in dev, in test, and in every non-production deploy. The
  webhook's test suite therefore pins the header-LESS request as refused, not only the
  wrong-header one.
- `TRUST_PROXY` — `z.enum(["true","false"]).default("false")`, mapped to
  `trustProxy: env.TRUST_PROXY === "true"`, pinned by a config test. `config.ts` has no
  boolean env precedent and the obvious `z.coerce.boolean().default(false)` is a trap:
  `Boolean("false")` is `true`, so `TRUST_PROXY=false` in an env file would silently enable
  proxy trust — the exact X-Forwarded-For spoofing hole DEPLOY.md box 2 exists to close.

`.env.example` documents each with one comment line — **and gains the four pre-existing keys
it never documented** (`TICK_SECRET`, `ADMIN_PASSWORD`, `APP_BASE_URL`, `NODE_ENV`). It is
two lines today (`PORT`, `DATABASE_URL`), so two of the five secrets the runbook says to map
"from .env.example" are not in it. No secret ever lands in the repo; the runbook maps each
name to Secret Manager.

## 10. Fiat ledger (the open questions, ruled)

1. **Plan 9 includes the GCP port** — the spec bundles the postman with the cloud step
   twice (§9, §15.10); the user's directive is the trigger; provisioning is user-gated.
   Cost if wrong: port tasks idle if the user defers the session; every code task stands alone.
2. **Brevo, by HTTP API, zero new dependencies** — the stack doc's own example; `fetch` is in
   Node 20. The free tier does NOT fit this product's per-recipient fan-out (§3: peak ≈ 450
   sends on a marks day at 5×30), so the deployment buys the lowest paid tier at ≥1,000
   sends/day, priced at the provisioning session. Cost: a real monthly line, and a provider
   swap is one driver file behind the seam.
3. **Never-throw outermost, no retries, one 10-second send deadline** (§4). Cost: a transient
   provider outage drops sends, visibly, recoverable by hand — accepted over a queue.
4. **Bounce via one secret-gated webhook; no signature crypto; 403 like the tick** (§6). Cost:
   header-secret posture equals the tick's, already accepted product-wide.
5. **Erased-sentinel suppression at the seam, not at the 13 sites** (§5) — plus the erase
   transaction's new `emails` delete, which is the half suppression cannot reach.
6. **Retention ships as machinery + adjustable setting, the clock backfilled from the events
   ledger** (§7), by a data statement in the generated migration rather than a script nothing
   would have run. Cost: one read of an unindexed ledger, once, at migration time.
7. **The emails log self-prunes at 180 days** (§7). Cost: old dev-inbox rows vanish — the log
   is operational, not a record; the events ledger is untouched, forever.
8. **No CI in Plan 9** — recorded absence, not an accident (research MISSING #6).
9. **Redacted production bodies; the clickable pretend inbox stays dev-only** (DEPLOY.md box
   1, verbatim). Dev/test behavior is byte-identical to today, where byte-identity means
   §2's re-scoped version: token URLs and the persisted-body shape the token regexes read.
10. **The §9 email table is ten rows — five Always, five switchable** (research wrong-claim
    #1 corrected); the five switchable keys are `SWITCHABLE_EMAIL_KEYS`, already enforced at
    the seam since Plan 8. Plan 9 builds no new template; it appends one footer line to the
    five, in `templates.ts`, for both drivers.
11. **The retention sweep deletes the class and its class-scoped tables and touches NO
    `projects` row.** The earlier draft ruled the opposite — that group-linked projects "GO"
    — and that ruling was wrong three times over. (a) It inverts the tree's only precedent:
    `admin.ts:217-235` builds a `keep` list of `groups.projectId` rows *precisely* so
    "erasing one member must not destroy" the group's shared workspace. (b) It does not
    stick: unlike an erased user, a group project's founding member is LIVE and still holds
    the project locally with owned sync meta, so `syncEngine.js`'s "push locals the server
    doesn't know, if already adopted by this account" pushes it straight back and
    `PUT /api/projects/:id` re-creates it on the next reconcile — and tombstoning does not
    help, because the engine revives a tombstone whose local copy is newer. The backend suite
    would stay green, the "idempotent second tick" test would pass, and /privacy would have
    been changed to promise a deletion that undoes itself. (c) It is internally asymmetric:
    an individual assignment project is equally class work and was always kept. Cost of the
    ruling made: a swept class's shared group workspaces survive in their founders' project
    libraries, unlinked from any class — which is the same thing that already happens to
    individual assignment work, and which /privacy now states plainly.
12. **The transborder mail question, ruled.** Every send exports a school-aged user's name
    and address — and, for `marksReleased`, their score and their teacher's comment — to a
    transactional email provider outside South Africa (Brevo is French; Mailgun is
    US-based), while `classroom-platform-stack.md:120` justifies `africa-south1` as "keeping
    student data in-country, which strengthens the POPIA story from spec §11". §11
    (`classroom-platform.md:351`) says "the plan phase will check the details properly", and
    Plan 9 is that phase, so the ruling is recorded here rather than left to a sentence in a
    task. **The transfer is accepted**, on three conditions that are Plan 9 work, not
    intentions: (a) `/privacy` gains a plain sub-processor sentence naming the provider and
    saying mail leaves the country, landing BEFORE the first real send to anyone but the
    maintainer; (b) `classroom-platform-stack.md:120` is amended in the same pass to say
    that mail — and only mail — leaves the region, so the in-country claim stays true as
    written; (c) **what the mail may carry is minimised**: `templates.ts`'s `marksReleased`
    drops the score line and the teacher's comment and reads "your marks for X are ready —
    sign in to see them", which costs one template edit and removes the most sensitive
    payload from the transfer entirely. That edit is UNCONDITIONAL — both drivers, in
    `templates.ts`, for the same reason the footer lives there (§2): a template that says one
    thing to the provider and another to the pretend inbox makes the preview a lie. It lands
    in the task that ships the postman, not in the live session, and it updates the three
    existing assertions that pin the old body (`assignments.test.ts:2829-2830`,
    `groups.test.ts:1461`) — those assertions pin exactly the thing this fiat removes, so
    updating them is the ruling's consequence, not a weakened test. The mark and the comment
    stay fully visible where they belong: the marking screen, the bell, and the data export.
    The name, the address and the class/assignment title still cross the border; that is the
    residual, and it is the minimum a postman can carry.
13. **The forgot route's residual timing channel is accepted, and named.** Plan 9 closes the
    error-shaped oracle (a mail failure can no longer 500 the request) and opens a sharper
    one: `auth.ts:271-287` awaits the mailer inside the handler and only for an existing
    active account, so behind a real provider a known address costs a network round-trip
    while an unknown address returns after one indexed SELECT — trivially measurable, and
    invisible to a body-shape test. It is NOT closed by dropping the await: Cloud Run
    throttles CPU after the response, so a fire-and-forget send would simply not happen.
    Closing it properly means padding the handler to a fixed floor, which costs every user a
    deliberate delay on a rarely-used door. Accepted as-is at 200 users, recorded so the next
    reader does not think the oracle is closed "end to end".
14. **The container runs TypeScript under `tsx`; it does not compile to `dist`** (§8), with
    the compiled path named as the reversible upgrade and its risk (the `shared` workspace's
    export conditions) stated. Cost: ~10 MB of image and a sub-second cold-start transpile.
