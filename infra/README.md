# infra/ — the Cloud Run container

Every deploy step lives in [docs/DEPLOY-GCP.md](../docs/DEPLOY-GCP.md) (Task 11's runbook); this folder holds only the image definition. Local verification, from the repo root with Docker Desktop running and the local Postgres up (`npm run db:up`) — published ports, never host networking (it does not exist on Docker Desktop for Windows):

```
docker build -f infra/Dockerfile -t physics-ide-api .
docker run --rm -p 8080:8080 -e DATABASE_URL="postgres://postgres:physics@host.docker.internal:5433/physics_ide" -e TICK_SECRET=local-tick -e MAIL_WEBHOOK_SECRET=local-hook -e MAIL_DRIVER=brevo -e MAIL_FROM=noreply@example.test -e BREVO_API_KEY=local-dummy physics-ide-api
curl http://localhost:8080/api/health
```

The three secrets are local dummies satisfying the image's baked `NODE_ENV=production` (config.ts fails closed without them — deliberately, so a revision that forgets its env dies at boot instead of running the pretend inbox in production); the dummy Brevo key sends nothing because `/api/health` mails nothing. Expected answer: `{"ok":true,"service":"physics-ide-api"}`.
