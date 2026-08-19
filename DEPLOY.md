# Deploying the Physics IDE

> **Restructure note (Aug 2026):** the static app now lives in `frontend/` (build output `frontend/dist/`, no longer a committed `build/` folder). Point Vercel/Cloudflare's root directory at `frontend/` with build command `npm run build` and output `dist`. Backend deployment arrives with the GCP plan (see docs/classroom-platform-stack.md §6).

> **Accounts note (Aug 2026):** the app now includes sign-in/sign-up screens that need the backend API. A static-only deploy (this document's Vercel/Cloudflare path) serves a fully working guest IDE, but the account doors will fail — there is no API behind them until the GCP step. Either deploy static builds from the pre-accounts tag, or accept dead account screens until the backend ships.

The deployed site is a static single-page React app (Vite). The repo also contains a backend (Fastify + Drizzle + Postgres) and a database, but neither is deployed yet — that arrives with the GCP plan (see docs/classroom-platform-stack.md §6). Anywhere that can serve a `dist/` directory with SPA fallback will host the current deployment. Two zero-cost paths are documented below.

> **Constraint locked in v1:** the app must run fully offline after first load. No HTTP request to a non-CDN origin during normal use. CI smoke-tests this. If you add a remote dependency, update the product contract first.

## 1. Vercel (recommended — `vercel` is already a project dependency)

`frontend/vercel.json` configures the framework, build command, output directory, SPA rewrite, and asset cache headers.

### One-time setup

```bash
npm install -g vercel
vercel login
vercel link        # link the local checkout to a Vercel project
```

### Deploy a preview

```bash
vercel             # uploads, builds on Vercel, returns a preview URL
```

### Promote to production

```bash
vercel --prod
```

The Vercel dashboard's "Connect Git" option automates the above: every push to `main` triggers a production deploy; every PR gets a preview URL.

### Free-tier notes

- Hobby plan: 100 GB bandwidth/month, unlimited builds. Plenty for classroom usage.
- Static assets cached for one year via `Cache-Control: immutable` (the `/assets/*` header rule).
- No serverless functions used in v1.

## 2. Cloudflare Pages (alternative — interchangeable with Vercel)

### One-time setup

1. Push the repo to GitHub (or GitLab/Bitbucket).
2. Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.
3. Build settings:
   - **Framework preset:** Vite
   - **Root directory:** `frontend/`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 (set as an environment variable: `NODE_VERSION=20`)
4. Save and deploy.

### SPA fallback

Add `dist/_redirects` with the line:

```
/* /index.html 200
```

Vite does not generate this by default; the simplest fix is a small `postbuild` script, or commit the file under `public/_redirects` (Vite copies `public/*` into `dist/`).

### Free-tier notes

- Unlimited bandwidth.
- 500 builds/month.
- No cold starts.

## CI smoke test (run before promoting)

```bash
npm run check:blocks   # block registry has no duplicates and covers TOOLBOX_XML
npm run test           # all workspace test suites (Vitest)
npm run build -w frontend   # production build must compile clean
```

Once `npm run build -w frontend` succeeds you can serve `frontend/dist/` locally to validate offline behaviour:

```bash
npx serve -s frontend/dist
```

Open `http://localhost:3000`, complete the project-creation wizard, run a template, then turn off the network and confirm everything still works. The first load fetches the GlowScript runtime from a CDN; after that the app is fully offline.

## What lives where on disk after a deploy

- `frontend/dist/index.html` — the SPA shell. The Vercel rewrite (or `_redirects` on Pages) sends every unknown path here so the client router (or React state) handles it.
- `frontend/dist/assets/index-*.js` — the application bundle (~455 kB gzip). Hashed filename so the long-cache header is safe.
- `frontend/dist/assets/index-*.css` — same caching story (~13 kB gzip).
- `frontend/dist/assets/*.js` — code-split chunks produced by Vite for vendor splitting.

## Before the GCP step (security checklist)

The classroom backend ships local-first. These obligations were accepted during Plans 1–2 with the explicit gate that they land before any cloud deployment. Do not deploy the backend until every box is ticked.

- [ ] Production mail driver must NOT persist raw token URLs — store redacted bodies (strip `token=` params); the clickable pretend inbox stays dev-driver-only.
- [ ] Configure Fastify `trustProxy` for the load balancer and verify X-Forwarded-For spoofing is closed; without it every user shares one rate-limit bucket.
- [ ] Set explicit argon2id parameters sized for the instance (OWASP baseline: memoryCost ≈ 19456 KiB, timeCost 2, parallelism 1) instead of library defaults (64 MiB per hash).
- [ ] `NODE_ENV=production` so the session cookie carries `Secure`.
- [ ] Make `ADMIN_PASSWORD` mandatory at seed time in production (the seed currently only warns on the dev default).
- [ ] @fastify/rate-limit's store is in-memory per instance — pin the service to max 1 instance or accept multiplied limits.
- [ ] Before real email: per-email-address throttle on `/api/auth/forgot` (mail-bomb shape) and wrap the mailer send so a mail failure cannot become a user-existence oracle.
- [ ] Throttle class-join code guessing, invite batches (50 real emails/request today), and class creation before the site is public.
- [ ] Note: member removal revokes invites for the member's registered email only — invites sent to other addresses survive (token possession admits; mitigate with teacher-visible revoke + code regenerate).

## What does NOT belong here

- No environment variables for secrets — the app has no backend to authenticate to.
- No serverless functions. If you find yourself adding one, write down the feature need first; the product contract requires it.
- No database connections. localForage in the browser is the only persistence.

## Rolling back

Vercel keeps every previous deploy. The dashboard's "Instant Rollback" promotes any prior deploy to production in seconds. Cloudflare Pages has the same behaviour under Deployments → Manage.
