# Deploying to GCP — the runbook

> **⛔ ONE DECISION BEFORE STEP 8 — the hosting/origin model (the user owns it).**
> Firebase Hosting's rewrite-to-Cloud-Run supports an enumerated region list and
> **`africa-south1` is not in it** (verified against Google's live docs twice, 2026-09-02) —
> `firebase deploy` fails hard on the shipped `frontend/firebase.json` rewrite. The options:
>
> 1. **The container serves the SPA** *(recommended — built and verified 2026-09-02,
>    commit b184d88)*: the image bakes the built frontend and `STATIC_DIR`; the API serves
>    it same-origin with the hosting headers (assets immutable, `/vendor` + `/blockly-media`
>    a day, COOP/COEP) and SPA fallback. Single origin by construction, single-cloud GCP,
>    data AND serving in-country, zero standing cost, no third party. Trades: no CDN in
>    front of static files (fine at the 200-user ceiling), coupled deploys.
>    **Contract note:** the Locked Hosting row does not yet name this shape — amend it at
>    the session through the change protocol before deploying. Pre-drafted row text:
>    *"…; amended (Plan 9 Stage E): the Cloud Run container itself serves the built SPA
>    same-origin (`STATIC_DIR`), because Firebase Hosting rewrites do not support
>    africa-south1."*
> 2. **Keep Vercel (already live) + a `/api/**` proxy rewrite to the Cloud Run URL**:
>    least change, free at this scale, student data still in-country (only static files
>    serve from Vercel's edge). Trades: not single-cloud, an edge hop per API call.
> 3. **Move Cloud Run to a supported region** (e.g. `europe-west1`): keeps firebase.json
>    as shipped, but student data leaves South Africa — weakens the POPIA story spec §11
>    and the stack doc lean on. Probably no.
>
> `frontend/firebase.json` stays in the tree either way (it becomes correct the day Google
> adds the region). **The steps below are written for option 1**; the deltas for option 2
> are marked where they differ (steps 8 and 9).

This is the numbered, copy-pasteable path from a green local tree to a running deployment.
It is executed **with the user at the keyboard** (Plan 9 Stage E / Task 14a): it needs their
Google account, billing, domain and DNS. The order is load-bearing — backups before the
first tick, seed immediately after migrate, the mail provider before the secrets that hold
its key, the service URL before the values derived from it.

**Shell note:** the `VAR=value command` spellings below are bash — run them in **Git Bash**
on this machine (PowerShell needs `$env:VAR="value"` instead).

Constants used throughout — decided in Plan 9, do not improvise new ones mid-session:

| Constant | Value | Where it came from |
|---|---|---|
| Region | `africa-south1` (Johannesburg) | stack doc — data stays in-country (POPIA, spec §11) |
| Cloud Run service | `physics-ide-api` | `/api/health`'s own `service` field |
| Container resources | `--memory=1Gi --cpu=1 --concurrency=20 --max-instances=1 --timeout=600s` | step 8 — sized against argon2, not guessed |
| Proxy trust | `TRUST_PROXY=1` (a hop count, not `true`) | step 8 — the spoof-proof setting, see there |

## The steps

### 1. Project, region, APIs

Create (or select) the GCP project. Enable: Cloud Run, Cloud SQL Admin, Secret Manager,
Cloud Scheduler, Artifact Registry. Everything below happens in `africa-south1`.

### 2. Cloud SQL Postgres — WITH backups and PITR, before anything else

Smallest tier Postgres instance. **Enable automated backups AND point-in-time recovery at
creation time.** This step must precede the first daily tick after deploy: the retention
sweep (Task 9) is an irreversible mass delete, and without PITR there is nothing to restore
from if a mis-set retention period ever fires. Create the database (`physics_ide`) and a
dedicated DB user.

### 3. Migrate through the Auth Proxy

From the maintainer's machine (no migrate-on-boot, no CI — recorded decision):

```
cloud-sql-proxy PROJECT:africa-south1:INSTANCE --port 5432
# in another shell (Git Bash):
DATABASE_URL="postgres://USER:PASS@127.0.0.1:5432/physics_ide" npm run db:migrate -w backend
```

### 4. Seed — immediately after the migration, same proxy, IN PRODUCTION MODE

```
NODE_ENV=production DATABASE_URL="postgres://USER:PASS@127.0.0.1:5432/physics_ide" ADMIN_PASSWORD="<real password>" ADMIN_EMAIL="<admin email>" npm run seed -w backend
```

**`NODE_ENV=production` is load-bearing here, not decoration**: the abort-without-
`ADMIN_PASSWORD` guard (Task 6) is conditioned on it. Without it, a dropped
`ADMIN_PASSWORD` falls back to the committed dev default with only a warning — a
production admin account with a password that is in the repo. With it, the seed refuses.
Skipping this step entirely leaves no admin account, and the admin console is the only
place a failed send is visible.

### 5. The postman — Brevo, BEFORE the secrets that hold its key

Provider account; verify the sender identity; add the domain's SPF/DKIM records at the DNS
host. Tier: **the lowest paid tier at ≥1,000 sends/day** — read the plan name and price off
Brevo's pricing page now and record them here: `________`. (D§3's arithmetic: a marks day
peaks ≈450 sends at 5 emails × 30 students fan-out; the ≈300/day free tier does not fit.
Decision settled by the user 2026-08-29.) The webhook itself is configured in step 11,
once the public origin exists.

### 6. Secret Manager

One secret per value (names mapped from `backend/.env.example` / `config.ts`, exactly):

- `DATABASE_URL` — the **unix-socket form with a literal `localhost` authority**:
  `postgres://USER:PASS@localhost/physics_ide?host=/cloudsql/PROJECT:africa-south1:INSTANCE`.
  A plain TCP URL cannot reach Cloud SQL from Cloud Run — and the empty-authority spelling
  (`...:PASS@/physics_ide?...`) fails `config.ts`'s `z.string().url()` at boot
  (`new URL()` rejects it). `pg` prefers the `host=` parameter and ignores the `localhost`,
  so the socket is still what is dialled (verified against this repo's own `pg`).
- `TICK_SECRET` — long random; Cloud Scheduler will present it
- `MAIL_WEBHOOK_SECRET` — long random; Brevo's webhook will present it (step 11)
- `BREVO_API_KEY` — from step 5
- `ADMIN_PASSWORD` — the step-4 value (kept for future re-seeds)

### 7. Service account

One service account for the Cloud Run service, carrying `roles/cloudsql.client` and
`roles/secretmanager.secretAccessor`. The Scheduler's caller identity gets
`roles/run.invoker` on the service.

### 8. Cloud Run deploy

Build the SPA, then the image (the Dockerfile copies `frontend/dist`), then deploy:

```
npm run build -w frontend
docker build -f infra/Dockerfile -t africa-south1-docker.pkg.dev/PROJECT/physics-ide/physics-ide-api .
docker push africa-south1-docker.pkg.dev/PROJECT/physics-ide/physics-ide-api

gcloud run deploy physics-ide-api \
  --image=africa-south1-docker.pkg.dev/PROJECT/physics-ide/physics-ide-api \
  --region=africa-south1 \
  --allow-unauthenticated --ingress=all \
  --add-cloudsql-instances=PROJECT:africa-south1:INSTANCE \
  --service-account=<the step-7 account> \
  --memory=1Gi --cpu=1 --concurrency=20 --max-instances=1 --timeout=600s \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,TICK_SECRET=TICK_SECRET:latest,MAIL_WEBHOOK_SECRET=MAIL_WEBHOOK_SECRET:latest,BREVO_API_KEY=BREVO_API_KEY:latest \
  --set-env-vars=NODE_ENV=production,TRUST_PROXY=1,MAIL_DRIVER=brevo,MAIL_FROM=<the step-5 sender>,APP_BASE_URL=https://placeholder.invalid
```

Four things here are load-bearing:

- **`--allow-unauthenticated --ingress=all` is a recorded decision, not an oversight**
  (the ledger's Task 11 carry): this API is public BY DESIGN — browsers and Brevo's
  webhook must reach it directly, and every sensitive door has its own guard (sessions,
  the tick secret, the webhook secret, the rate limiters). The exposure that decision
  creates is what the next line closes.
- **`TRUST_PROXY=1`, never `true`.** `true` trusts every hop, which makes Fastify read
  the LEFTMOST `X-Forwarded-For` — a value the CLIENT controls on a directly-reachable
  service, letting anyone spoof their IP and defeat every per-IP limiter (the forgot-door
  mail-bomb throttle included). Cloud Run's front end APPENDS the real client IP, so
  trusting exactly **1** hop reads the rightmost, unspoofable value. (`config.ts` accepts
  hop counts — commit b184d88.)
- **The resource numbers answer to argon2, not to taste.** Task 6 set `memoryCost 19456`
  (~19 MiB RSS per concurrent hash); the default 512 MiB at concurrency 80 on the single
  pinned instance means a class of 30 signing in at once OOM-kills the container. 1 GiB at
  concurrency 20 holds. `--max-instances=1` is ALSO the rate-limit store's correctness
  condition (in-memory per instance) and the tick's dedupe assumption.
- **`APP_BASE_URL` starts as a placeholder and is fixed in step 9** — it builds every
  confirm/reset/invite link, and its true value (the public origin) does not exist until
  this deploy returns the service URL. Do not skip step 9's re-deploy.

*Option 2 delta:* same command, but the SPA is not the origin — skip step 9's option-1
half and use the Vercel domain wherever "public origin" appears below.

### 9. The origin, settled — and APP_BASE_URL made true

**Option 1:** the service URL from step 8 (or the custom domain you map to it) IS the
public origin. Open it: the IDE loads from `/`, and `/api/*` is the same origin by
construction. Then fix the placeholder:

```
gcloud run services update physics-ide-api --region=africa-south1 --update-env-vars=APP_BASE_URL=https://<the public origin>
```

**Verify the origin model**: sign in on the deployed site and confirm the session cookie
is set and then sent on a subsequent `/api` call (DevTools → Network). This proves
`credentials: "same-origin"` and `SameSite=Lax` hold in production. Record the origin
here: `________`.

*Option 2 delta:* add the `/api/**` proxy rewrite to `frontend/vercel.json` pointing at
the Cloud Run URL, deploy to Vercel, verify the same cookie round-trip against the Vercel
domain, and set `APP_BASE_URL` to the Vercel domain instead.

### 10. Cloud Scheduler

Daily job → `POST https://<public origin>/api/tick` with header
`x-tick-secret: <TICK_SECRET>` and **`--attempt-deadline=600s`**, matched to the Cloud Run
timeout. One scheduler, one job — overlapping calls are serialized by the advisory locks,
but the deadline must not be shorter than the service's own.

### 11. The webhook

In Brevo: configure the delivery/bounce webhook to
`https://<public origin>/api/mail/events` presenting `MAIL_WEBHOOK_SECRET` in the
`x-mail-secret` header.

### 12. Production wiring check

Already set in step 8, verified here: `NODE_ENV=production` (Secure cookie, seed guard,
brevo-required), `TRUST_PROXY=1`, `MAIL_DRIVER=brevo`, real `MAIL_FROM`, true
`APP_BASE_URL` (step 9). `curl https://<public origin>/api/health` answers
`{"ok":true,"service":"physics-ide-api"}`.

### 13. The /vendor header

```
curl -I https://<public origin>/vendor/glowscript/glow.3.2.min.js
```

Expect `Cache-Control: public, max-age=86400` (served by the container under option 1 —
verified locally already; by Vercel's rule under option 2). This is the Locked
repeat-Run-offline term from `docs/product-contract.md` — not a nicety.

## The smoke — the REDUCED list, deliberately

Signup → confirm **via real mail** → sign in → trigger one tick (temporary Scheduler "run
now"). That is the whole production smoke.

**Do not run the golden e2e flow against production.** It mints its own class, assignments,
student accounts and throwaway each run — and against production those rows are permanent:
the signup cap counts EVERY `users` row, no route hard-deletes a user, and the erase route
only scrubs in place, so an erased test account still occupies one of the 200 seats forever.
If the full flow is ever run against production anyway, its rows must be deleted via SQL
through the Auth Proxy afterwards — the admin console cannot do it.

## After this runbook

- The pre-GCP security checklist in `DEPLOY.md` is annotated box-by-box (which commit
  closed each in code, and which boxes are steps above).
- Whether to retire the Vercel static deployment is the user's call, surfaced at the end of
  the session — `frontend/vercel.json` remains valid either way.
