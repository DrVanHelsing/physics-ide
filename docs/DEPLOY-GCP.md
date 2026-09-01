# Deploying to GCP — the runbook

> **⛔ DECISION NEEDED BEFORE STEP 9 (found in review, 2026-09-02 overnight — verified
> against Google's live docs twice).** Firebase Hosting's rewrite-to-Cloud-Run supports
> only an enumerated region list, and **`africa-south1` is not in it** — `firebase deploy`
> fails hard on the rewrite. So the shipped `frontend/firebase.json` cannot front a
> Johannesburg Cloud Run service, and one of these is chosen at the session (the user
> owns it — each trades something):
>
> 1. **Serve the SPA from the Cloud Run container itself** *(recommended, and the
>    container gained this ability overnight — see step 9B)*: single origin by
>    construction, single-cloud GCP as originally asked, data and serving in-country,
>    zero standing cost. Trade: no CDN in front of static assets (fine at the 200-user
>    ceiling), coupled frontend/backend deploys.
> 2. **Keep Vercel (already live) and add a `/api/**` proxy rewrite to the Cloud Run
>    URL**: least change, free at this scale, student data still in-country (only static
>    assets serve from Vercel's edge). Trade: not single-cloud, an edge hop on every API
>    call, Vercel egress on the proxy.
> 3. **Move Cloud Run to a supported region** (e.g. `europe-west1`): keeps
>    firebase.json as shipped. Trade: student data leaves South Africa — weakens the
>    POPIA story `classroom-platform-stack.md` and spec §11 lean on. Probably no.
>
> `frontend/firebase.json` stays in the tree either way (it becomes correct the day
> Google adds the region). The steps below are written for option 1; deltas for the
> others are marked inline.

This is the numbered, copy-pasteable path from a green local tree to a running deployment.
It is executed **with the user at the keyboard** (Plan 9 Stage E / Task 14a): it needs their
Google account, billing, domain and DNS. Nothing here is optional; the order is load-bearing
(backups before the first tick, seed immediately after migrate, secrets before deploy).

Constants used throughout — decided in Plan 9, do not improvise new ones mid-session:

| Constant | Value | Where it came from |
|---|---|---|
| Region | `africa-south1` (Johannesburg) | docs/classroom-platform-stack.md — data stays in-country (POPIA, spec §11) |
| Cloud Run service | `physics-ide-api` | `frontend/firebase.json`'s rewrite and `/api/health`'s own `service` field |
| Image | built from `infra/Dockerfile` (repo root context) | Task 10, verified locally |
| Container resources | `--memory=1Gi --cpu=1 --concurrency=20 --max-instances=1 --timeout=600s` | step 7 — sized against argon2, not guessed |

## The steps

### 1. Project, region, APIs

Create (or select) the GCP project. Enable: Cloud Run, Cloud SQL Admin, Secret Manager,
Cloud Scheduler, Artifact Registry, Firebase Hosting (via the Firebase console, same
project). Everything below happens in `africa-south1`.

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
# in another shell, with DATABASE_URL pointing through the proxy:
DATABASE_URL="postgres://USER:PASS@127.0.0.1:5432/physics_ide" npm run db:migrate -w backend
```

### 4. Seed — immediately after the migration, same proxy

```
DATABASE_URL="postgres://USER:PASS@127.0.0.1:5432/physics_ide" ADMIN_PASSWORD="<real password>" ADMIN_EMAIL="<admin email>" npm run seed -w backend
```

`seed.ts` **aborts in production without `ADMIN_PASSWORD`** (Task 6) — that is deliberate.
Skipping this step leaves no admin account, and the admin console is the only place a failed
send is visible.

### 5. Secret Manager

Create one secret per value (mapped from `backend/.env.example`):

- `DATABASE_URL` — the **unix-socket form** from step 7, not a TCP URL
- `TICK_SECRET` — long random; Cloud Scheduler will present it
- `MAIL_WEBHOOK_SECRET` — long random; Brevo's webhook will present it
- `BREVO_API_KEY` — from step 11
- `ADMIN_PASSWORD` — the step-4 value (kept for future re-seeds)

### 6. Service account

One service account for the Cloud Run service, carrying `roles/cloudsql.client` and
`roles/secretmanager.secretAccessor`. The Scheduler's caller identity gets
`roles/run.invoker` on the service.

### 7. Cloud Run deploy

Build and push the image (Artifact Registry), then deploy:

```
docker build -f infra/Dockerfile -t africa-south1-docker.pkg.dev/PROJECT/physics-ide/physics-ide-api .
docker push africa-south1-docker.pkg.dev/PROJECT/physics-ide/physics-ide-api

gcloud run deploy physics-ide-api \
  --image=africa-south1-docker.pkg.dev/PROJECT/physics-ide/physics-ide-api \
  --region=africa-south1 \
  --add-cloudsql-instances=PROJECT:africa-south1:INSTANCE \
  --service-account=<the step-6 account> \
  --memory=1Gi --cpu=1 --concurrency=20 --max-instances=1 --timeout=600s \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,TICK_SECRET=TICK_SECRET:latest,MAIL_WEBHOOK_SECRET=MAIL_WEBHOOK_SECRET:latest,BREVO_API_KEY=BREVO_API_KEY:latest \
  --set-env-vars=NODE_ENV=production,TRUST_PROXY=true,MAIL_DRIVER=brevo,MAIL_FROM=<sender>,APP_BASE_URL=<Hosting domain, step 9>
```

Two things here are load-bearing:

- **The DSN must be the unix-socket form, written with a literal `localhost` authority**:
  `postgres://USER:PASS@localhost/physics_ide?host=/cloudsql/PROJECT:africa-south1:INSTANCE`.
  A plain TCP `DATABASE_URL` cannot reach Cloud SQL from Cloud Run — and the
  empty-authority spelling (`...:PASS@/physics_ide?...`) fails `config.ts`'s
  `z.string().url()` validation before the app even starts (`new URL()` rejects it), so
  the first revision would die at boot. `pg`'s connection-string parser prefers the
  `host=` query parameter and ignores the `localhost`, so the socket is still what is
  dialled (verified against this repo's own installed `pg`).
- **The resource numbers answer to argon2, not to taste.** Task 6 set
  `memoryCost 19456` (~19 MiB RSS per concurrent hash). Cloud Run's default
  512 MiB at concurrency 80 on the single pinned instance means a class of 30
  signing in at the start of a lesson OOM-kills the container with nowhere to
  shed load. 1 GiB at concurrency 20 holds. `--max-instances=1` is ALSO the
  rate-limit store's correctness condition (in-memory per instance — DEPLOY.md
  box 6) and the tick's dedupe assumption.

### 8. Cloud Scheduler

Daily job → `POST https://<cloud-run-url>/api/tick` with header
`x-tick-secret: <TICK_SECRET>` and **`--attempt-deadline=600s`**, matched to the Cloud Run
timeout. One scheduler, one job — overlapping calls are serialized by the advisory locks,
but the deadline must not be shorter than the service's own.

### 9. Static hosting — Firebase Hosting, the same-origin step

```
npm run build -w frontend
firebase deploy --only hosting   # from frontend/, project set to the step-1 project
```

`frontend/firebase.json` already carries the rewrites (`/api/**` → Cloud Run
`physics-ide-api` in `africa-south1` FIRST, SPA catch-all LAST) and the three header rules.
Then **verify the browser sees ONE origin**: sign in on the deployed site and confirm the
session cookie is set and then sent on a subsequent `/api` call (DevTools → Network). This
is the step that proves `credentials: "same-origin"` and `SameSite=Lax` hold in production.

**`APP_BASE_URL` must be the Firebase Hosting domain, not the Cloud Run URL** — it builds
every confirm/reset/invite link; pointed at Cloud Run it would mail users links that bypass
the Hosting origin (and its cookie). Record the Hosting domain here once known: `________`.

### 10. Production wiring check

Already set in step 7, verified here: `NODE_ENV=production` (Secure cookie),
`TRUST_PROXY=true` (Fastify behind Google's front end — without it every user shares one
rate-limit bucket), `MAIL_DRIVER=brevo` (config.ts refuses to boot production without it —
the pretend inbox must be unreachable in production).

### 11. The postman — Brevo

Provider account; verify the sender identity; add the domain's SPF/DKIM records at the DNS
host; configure the delivery/bounce webhook to
`https://<hosting-domain>/api/mail/events` with the `MAIL_WEBHOOK_SECRET`. Tier: **the
lowest paid tier at ≥1,000 sends/day** — read the plan name and price off Brevo's pricing
page during this session and record them here: `________`. (D§3's arithmetic: a marks day
peaks ≈450 sends at 5 emails × 30 students fan-out; the ≈300/day free tier does not fit.
Decision settled by the user 2026-08-29.)

### 12. The /vendor header

```
curl -I https://<hosting-domain>/vendor/glowscript/glow.3.2.min.js
```

Expect `Cache-Control: public, max-age=86400` (the rule Task 10 shipped). This is the
Locked repeat-Run-offline term from `docs/product-contract.md` — not a nicety.

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
