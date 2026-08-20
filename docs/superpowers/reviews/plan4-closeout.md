# Plan 4 close-out — rulings & residuals (2026-08-20)

Plan 4 (cloud projects & sync + welcome screen) completed on feature/classroom-platform at 771bc1e: 11 tasks, 6 task fix rounds, 13-agent adversarial final review, 4 fix-wave rounds, controller browser pass clean. 279 tests (fe 152 / be 108 / shared 19).

## Rulings made by the controller (verbatim from the execution ledger)

- - Ruling: owner-row lock added to PUT creation branch — the plan's comment claimed a
- - Ruling: autosave dirty-check against activeManifest — opening a project must not restamp
- - Ruling: projects created while signed in auto-adopt on first save; the guest-era snapshot
- - Ruling: window.__PIDE_SIGNED_IN__ replaced by SIGNED_IN_HINT_KEY localStorage hint
- - Ruling: onProjectDeleted listener added and ProjectContext subscribes to both store
- - Ruling: restore stamps server-clock Date.now() as clientUpdatedAt — a restore IS a new
- - Ruling: student-facing history/restore screen deferred to the assignments plan (one
- Task 2: Ruling: PROJECT_ID_REGEX widened {4,60}->{3,60} by implementer — plan regex rejected its own test id p-big; real factory ids (p-uuid / p-base36-rand) match either way — costs accepting 3-char ids, no consumer harmed
- Task 2: Ruling: equal-ms tie — canonically-identical manifest stays no-op; differing content wins as "newer" with old head archived (reason overwrite) — plan text "ties count as newer" + "loser never discarded" both satisfied — costs a stable-stringify compare per tie
- Task 2: Ruling: >1MiB oversize — scoped setErrorHandler maps FST_ERR_CTP_BODY_TOO_LARGE to the byte-exact 413 sentence — costs nothing; alternative (bodyLimit raise) rejected as it just moves the cliff
- Task 2: Ruling: cap on tombstone-revive path too; tombstone rows bounded at 100/account, oldest hard-deleted beyond (cascades versions) — spec §15.7 "fatal for abuse" outranks plan's retain-until-data-requests sentence, which still governs non-abusive accounts — costs history loss only for accounts past 100 deleted projects
- Task 3: Ruling: restore of a tombstoned head at >=100 live projects refuses 403 with the cap sentence — extends the Finding-3/§15.7 ruling to the third revive path the plan missed — costs one extra count query per restore
- Task 3: Ruling: GET versions 200 for tombstoned head stands — restore-from-tombstone is unreachable otherwise; no cross-owner leak — costs a listable trash-history surface (consistent with plan's revive design)
- Task 10: Ruling: IDE stays at "/", /welcome shown to brand-new visitors only (no seen-flag + no session hint + no local projects; grandfather guests with work) — never hijack a student mid-lesson — costs new-visitor redirect depending on one IndexedDB read
- Task 10: Ruling: CTA labels "Use the IDE — no account needed" / "Create an account" / "Sign in" (user delegated workshopping); copy stays honest — assignments described as "on the way"
- Task 5: Ruling: finding is real — unattended background saves must not reject silently; fix mirrors the file's selectProject console.warn idiom — costs nothing
- Task 6: Ruling: tombstone branch guarded by recency — local.updatedAt > tombstone clientUpdatedAt pushes/revives (server supports revive), else delete — spec "nothing silently destroyed" outranks plan's unconditional tombstone-authoritative — costs a revive surprising the deleting device (their delete loses to newer edits, correct per most-recent-wins)
- Task 6: Ruling: local-delete propagation added — engine gains deleteRemoteProject(id); reconcile infers deletion from meta-present+local-absent+remote-live and DELETEs; meta cleaned when remote tombstoned+local absent; import only when NO meta — closes permanent resurrection — costs one extra decision-table branch
- Task 6: Ruling: subscriber calls individually try/caught (pushProject must never throw); per-project try/catch in reconcile w/ failure tally + console.warn; reconcile push failures enter pending; drainPending sets aggregate final status; setOnline(true) restores idle from offline; getGlobalSyncEngine caches the in-flight promise (reset on rejection) — all straightforward correctness fixes
- Task 6: Ruling: delete-inference containment REQUIRED (round 2) — skip the inference when localList is empty while metaAll is non-empty (index corruption indistinguishable from delete-all; catastrophic/annoying asymmetry favors skipping; live deletes still propagate via Task 7 wiring) — costs delete-all-offline users their tombstone propagation until a non-empty reconcile
- Task 7: Ruling: deleteProject gains opts {fromSync}; engine's tombstone-apply passes it; provider delete handler skips fromSync — mirrors preserveTimestamp provenance — costs a param threaded through 3 files
- Task 7: Ruling: guest snapshot built from PRE-reconcile listProjects (meta still read post-reconcile) — saves during the reconcile window can never be misclassified guest-era — Task 9 dispatch must add: resurrected legacy project id is explicitly added to guestIdsRef so the §3.2 offer still covers it
- Task 7: Ruling: SyncProvider handler bodies try/caught; ProjectContext listener refreshList calls catch-guarded; store loops stay sync-guard (comment); [me] dep narrowed to [me?.id] (churn + re-window reducer, promoted into round)
- Task 9: Ruling: implementer's bootstrap deviation stands (brief's literal form would regress kind to "existing/0"); all three findings ruled real, fixes per reviewer shapes
- NEXT SESSION ORDER: (1) read final-review-findings.json, adjudicate every confirmed/unverified/mustFix item with rulings; (2) amend plan Task 10 for welcome-gate v2 (guests land on /welcome each new browser session; sessionStorage pass; signed-in skip; drop grandfather+projectCount; commit amendment); (3) ONE combined fix wave (all confirmed findings + welcome-gate v2 + regression tests incl. cross-owner reconcile test); (4) scoped re-review of the wave; (5) restart npm run dev + controller browser pass (sync flows, guest import, welcome v2, chip); (6) endgame: rulings roll-up from THIS LEDGER (every Ruling: line), sweep, workspace deletion only after clean, memory update; (7) then user's IDE deep-review directive (see ledger + portal_scale_ceiling.md). GCP CONFIRMED: vpythonschroeder@gmail.com active (uwc account still credentialed; default project left untouched).
- Fix wave: Ruling: plan Task 10 illustrative v1 code blocks left as historical record (amended contract paragraph governs; task already implemented) — costs possible confusion on a future re-read
- Ruling: residual round authorized (closes breakage the wave introduced + user icon directive; NOT a second review wave) — discriminator skip-delete-unless-server-current; meta-before-local order; bounded flush + always-POST + busy state; sentence surfacing restricted to 4xx; welcome emoji -> inline SVG professional icons (ui_quality_standard); commit IDE review report to docs
- Ruling: fix = engine epoch/generation — reset() increments; every push/drain path captures its epoch at entry and bails BEFORE each api call when stale (cookie is the authority, so detached work must never dispatch post-reset); mutable currentOwnerId fallback removed, ownerId threaded explicitly everywhere — costs an integer check per push
- Ruling: clearCloudProjectsAfterSignOut sweeping ALL owned meta regardless of which user is signing out is INTENDED — shouldDropLocalCopy already protects anything unsynced/pending; sweeping provably-synced leftovers is shared-device hygiene

## Deferred minors & tickets (final review triaged; none merge-blocking)

- Task 1: minor (deferred): savedBy/reason carry no DB-level FK/CHECK — plan-mandated shape; write path enforces the union
- Task 2: minor (deferred): concurrent same-new-id create returns 500 (PK race after owner lock; retry succeeds)
- Task 2: minor (deferred): pruneVersions runs post-commit — a throw 500s a committed write
- Task 2: minor (deferred): DELETE inserts version but never prunes (21 until next PUT)
- Task 2: minor (deferred): prune ORDER/LIMIT semantics untested (>20 versions never created in tests)
- Task 2: minor (deferred): no test for unconfirmed-user sync or 401 unauthenticated
- Task 2: minor (deferred): stale push revives tombstone (plan-consistent but untested, tension w/ most-recent-wins)
- Task 2: minor (deferred): DELETE archives with reason "overwrite" (semantically "deleted"); nits: void reply, raw deleted_at IS NULL, redundant regex test, cap-test start counts tombstones
- Task 2: minor (deferred): pruneTombstones tiebreak by deleted_at (not monotonic id) — nondeterministic retention at same-ms boundary; bound itself holds
- Task 3: minor (deferred): out-of-range versionId (beyond int8/safe-integer) 500s instead of 404 — Number.isSafeInteger guard suggested
- Task 3: minor (deferred): restore `now` sampled before tx — can move head clientUpdatedAt backwards vs a PUT that won the lock race
- Task 3: minor (deferred): head clientUpdatedAt column write untested; restore-archive row contents untested; live-at-cap restore + successful revive-under-cap + 403-leaves-no-row untested; "foreign version" test name overclaims; versions-404 + non-integer versionId untested; capManifest/manifest helper duplication
- Task 4: minor (deferred): _resetAllProjectStorageForTests doesn't clear sync-meta (by design; combined tests must call both resets); getSyncMeta `v || null` loose idiom
- Task 6: minor (deferred): fake store never throws (partial-failure fidelity gap now partly covered by new tests); summary rows missing updatedAt silently skipped; redundant getSyncMeta reads + null ownerId meta on first push; adoptLocalProject stamps meta before push lands; dispose() scope narrow, no singleton test-reset; concurrent pushes interleave status; offline-detection branch untested
- Task 6: minor (deferred): F1-revive can hit the PUT cap outcome and park in pending with no backoff/user explanation (UX, final review to triage); getGlobalSyncEngine has no test-reset hook
- Task 6: minor (deferred): adjusted test lacks explicit p-stays-unaffected assertion; stale-meta cleanup under tombstone branch not gated by suspect-index guard (local-only, non-destructive — accepted)
- Task 7: minor (deferred): double list refresh per user save (persistActive + listener); early window events before engine resolves dropped (initial reconcile covers); test listener-leak hygiene via _resetAllProjectStorageForTests clearing registries
- Task 7: minor (deferred): F3 fix-report comment wording imprecise (tombstone-removed have NO meta; harmless — id deleted so unreachable); delete IIFE lacks disposed check (accepted — finishing a user-initiated delete is correct)
- Task 8: minor (deferred): SyncChip effect deps [me] (object identity churn; structural sharing mitigates — same note as provider, which narrowed to me?.id); unsanitized state in CSS class name (graceful degrade)
- Task 9: minor (deferred): no disposed check between backfill awaits (covered partly by fix 1); .admin-btn--primary defined in guest-import CSS block (belongs with .admin-btn); hardcoded shadow rgba in themed stylesheet; accept double-click relies on disabled prop; no aria-live on banner
- Task 9: minor (deferred): accept-retry iterates stale importPrompt.ids (redundant idempotent re-adopts on retry); accept/decline handlers lack post-await staleness checks (late setState from stale closure after cleanup — benign)
- Task 10: minor (deferred): vitest cannot transform JSX in imported .js files (pre-existing toolchain gap; WelcomeGate uses createElement as workaround; probe confirmed on SignUpPage.js) — follow-up ticket candidate; gate catch routes storage-error guests to welcome (plan-mandated defensive path); playground reads clientWidth per frame (accepted)
- Fix wave: minor (deferred, ticket): permanent-4xx ids re-enter pending and retry forever (no backoff / no drop) — F5 surfaces the sentence but retry policy wants its own decision
- TICKET: permanent-4xx pushes re-enter pending with no backoff/drop (retry policy decision)
- TICKET: vitest cannot transform JSX in imported .js files (blocks component tests; prerequisite for IDE-plan component-test layer)
- PARKED: session-expiry/browser-close leaves prior student's library locally readable (sign-out is the taught flow; candidate privacy pass)
- The 45 final-review minor notes live in the full findings JSON (see below)
