# The container runs tsx; it does NOT compile to dist (design D§8, fiat 14 —
# decided, do not "improve" it back). backend/tsconfig.json is noEmit with no
# outDir and includes the test files, and shared/package.json's main points at
# raw TypeScript with no build script — a tsc build story means two
# tsconfig.build.json files, build scripts in both workspaces, and a
# conditional exports map whose failure mode is the module resolution of all
# eleven backend suites. Cost accepted instead: ~10 MB of tsx in the image and
# a sub-second cold-start transpile, once a morning at one pinned instance.
#
# Build context is the REPO ROOT: docker build -f infra/Dockerfile .
# (BuildKit reads infra/Dockerfile.dockerignore for this file.)

# ── Stage 1: dependencies ──────────────────────────────────────────────────
# argon2's install script compiles from source on this base (node-gyp-build
# falls through to a gyp build rather than using a prebuilt binary), so the
# deps stage carries python3/make/g++. They never reach the runtime layer.
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Manifests only, so the dependency layer caches across source edits. The
# frontend manifest is copied so npm's workspace resolution sees every
# workspace the root manifest names — no frontend source enters the image.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY shared/package.json shared/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev --workspace backend --workspace shared && npm cache clean --force

# ── Stage 2: runtime ───────────────────────────────────────────────────────
FROM node:20-slim

# Safe by default: a revision that forgets NODE_ENV must fail closed (config.ts
# requires TICK_SECRET / MAIL_DRIVER=brevo / MAIL_WEBHOOK_SECRET in production)
# rather than boot into the pretend inbox with a dev tick secret.
ENV NODE_ENV=production
# Cloud Run injects PORT; this default just makes local runs match it.
ENV PORT=8080

WORKDIR /app
# The whole deps-stage /app (root node_modules plus any nested workspace
# node_modules npm chose not to hoist), then the two shipped workspaces.
COPY --from=deps /app /app
COPY shared ./shared
COPY backend ./backend

# node:20-slim ships the unprivileged `node` user; a root API process buys
# nothing.
USER node

EXPOSE 8080
CMD ["node_modules/.bin/tsx", "backend/src/server.ts"]
