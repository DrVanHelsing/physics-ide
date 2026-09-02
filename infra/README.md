# infra/ — the Cloud Run container

Every deploy step lives in [docs/DEPLOY-GCP.md](../docs/DEPLOY-GCP.md) (Task 11's runbook); this folder holds only the image definition. The image serves the whole product from one origin: the API, and — via the baked `STATIC_DIR` — the built SPA with the hosting headers and SPA fallback (Task 10b; Firebase Hosting's rewrite cannot reach `africa-south1`).

Local verification, from the repo root with Docker Desktop running and the local Postgres up (`npm run db:up`) — published ports, never host networking (it does not exist on Docker Desktop for Windows). **Build the SPA first**; the image COPYs `frontend/dist` and fails loudly without it:

```
npm run build -w frontend
docker build -f infra/Dockerfile -t physics-ide-api .
docker run --rm -p 8080:8080 -e DATABASE_URL="postgres://postgres:physics@host.docker.internal:5433/physics_ide" -e TICK_SECRET=local-tick -e MAIL_WEBHOOK_SECRET=local-hook -e MAIL_DRIVER=brevo -e MAIL_FROM=noreply@example.test -e BREVO_API_KEY=local-dummy -e TRUST_PROXY=1 physics-ide-api
curl http://localhost:8080/api/health
curl -I http://localhost:8080/vendor/glowscript/glow.3.2.min.js
```

Expected: `{"ok":true,"service":"physics-ide-api"}`, then `Cache-Control: public, max-age=86400` — and `http://localhost:8080/` serves the IDE itself. The three secrets are local dummies satisfying the baked `NODE_ENV=production` (config.ts fails closed without them — deliberately, so a revision that forgets its env dies at boot instead of running the pretend inbox in production); the dummy Brevo key sends nothing because nothing here mails.
