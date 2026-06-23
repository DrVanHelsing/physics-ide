# Deploying the Physics IDE

This is a static single-page React app (Create React App). There is no backend, no database, no auth. Anywhere that can serve a `build/` directory with SPA fallback will host it. Two zero-cost paths are documented below.

> **Constraint locked in v1:** the app must run fully offline after first load. No HTTP request to a non-CDN origin during normal use. CI smoke-tests this. If you add a remote dependency, update the product contract first.

## 1. Vercel (recommended — `vercel` is already a project dependency)

`vercel.json` at the repo root configures the framework, build command, output directory, SPA rewrite, and asset cache headers.

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
- Static assets cached for one year via `Cache-Control: immutable` (the `/static/*` header rule).
- No serverless functions used in v1.

## 2. Cloudflare Pages (alternative — interchangeable with Vercel)

### One-time setup

1. Push the repo to GitHub (or GitLab/Bitbucket).
2. Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.
3. Build settings:
   - **Framework preset:** Create React App
   - **Build command:** `npm run build`
   - **Build output directory:** `build`
   - **Node version:** 20 (set as an environment variable: `NODE_VERSION=20`)
4. Save and deploy.

### SPA fallback

Add `build/_redirects` with the line:

```
/* /index.html 200
```

CRA does not generate this by default; the simplest fix is a small `postbuild` script, or commit the file under `public/_redirects` (CRA copies `public/*` into `build/`).

### Free-tier notes

- Unlimited bandwidth.
- 500 builds/month.
- No cold starts.

## CI smoke test (run before promoting)

```bash
npm run check:blocks   # block registry has no duplicates and covers TOOLBOX_XML
CI=true npm test       # full Jest suite (manifest, project store, block registry)
npm run build          # production build must compile clean
```

Once `npm run build` succeeds you can serve `build/` locally to validate offline behaviour:

```bash
npx serve -s build
```

Open `http://localhost:3000`, complete the project-creation wizard, run a template, then turn off the network and confirm everything still works. The first load fetches the GlowScript runtime from a CDN; after that the app is fully offline.

## What lives where on disk after a deploy

- `build/index.html` — the SPA shell. The Vercel rewrite (or `_redirects` on Pages) sends every unknown path here so the client router (or React state) handles it.
- `build/static/js/main.*.js` — the application bundle (~455 kB gzip). Hashed filename so the long-cache header is safe.
- `build/static/css/main.*.css` — same caching story (~13 kB gzip).
- `build/static/js/*.chunk.js` — code-split chunks produced by CRA for vendor splitting.

## What does NOT belong here

- No environment variables for secrets — the app has no backend to authenticate to.
- No serverless functions. If you find yourself adding one, write down the feature need first; the product contract requires it.
- No database connections. localForage in the browser is the only persistence.

## Rolling back

Vercel keeps every previous deploy. The dashboard's "Instant Rollback" promotes any prior deploy to production in seconds. Cloudflare Pages has the same behaviour under Deployments → Manage.
