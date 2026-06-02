## 2026-06-01 — Production web runtime discovery

- Inspected `apps/web/Dockerfile`, `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/app/router.tsx`, and `apps/web/app/lib/api.ts` to confirm the frontend still expects local Vite dev on port `5173` and root-mounted API paths such as `/health`, `/auth/*`, `/sessions*`, `/uploads`, `/jobs/*`, and `/records/*`.
- Found an existing production runtime in `apps/web/Dockerfile.prod` that performs a build-stage `npm ci` + `npm run build`, then serves `dist/` from `nginx:1.27-alpine` on port `8423` with `nginx.prod.conf`.
- Confirmed the nginx config keeps SPA fallback for frontend routes like `/login` while proxying the root-mounted API contract to `http://api:8000` without introducing `/api/*`.
- Verified the prod runtime does **not** contain `npm run dev`, `vite --port 5173`, or `vite preview`.

## 2026-06-01 — Production compose stack

- Added `docker-compose.prod.yml` as a production-only compose file so local dev `docker-compose.yml` remains untouched and continues to expose Vite on `5173`.
- Production web builds from `apps/web/Dockerfile.prod`, passes through `VITE_API_URL=https://thestacks.ikis.ai` by default, and maps `${APP_HOST_PORT:-8423}:8423`; it does not expose `5173`.
- API and worker share the production upload mount at `/data/uploads`; Postgres persists `/var/lib/postgresql/data`; Qdrant persists `/qdrant/storage`.
- Production storage is isolated from dev via named volumes `the-stacks-prod-postgres-data`, `the-stacks-prod-qdrant-data`, and `the-stacks-prod-uploads`.
- Stable production routing/storage defaults are pinned in the compose `environment` block so a dev checkout's `.env` cannot override production CORS, secure cookies, Qdrant URL, or upload path during `docker compose -f docker-compose.prod.yml config`; secrets still belong in local-only `.env.production` or host environment before runtime.
