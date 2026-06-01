# Task 3 - Web Shell, Theme, and Auth UI

Implemented against `main/` worktree.

Created/modified web shell foundation:
- Added React Router v7 data-router wiring for `/login`, authenticated `/`, `/chat/:sessionId`, `/upload`, `/records`, and POST `/logout` under `apps/web/app/`.
- Added API client helpers for Task 2's `/auth/me`, `/auth/login`, `/auth/logout`, `/sessions/latest`, `/sessions`, and `/sessions/{id}` contract with `credentials: "include"` for the `thestacks_session` HttpOnly cookie.
- Added authenticated shell composition under `app/components/app/` with sparse sticky top nav exposing Chat, Upload, Records, and Logout.
- Added shadcn-style primitives under `app/components/ui/` (`Button`, `Input`, `Card`) and preserved app-specific composition outside the ui folder.
- Added warm minimal Fabrique-inspired tokens in `src/styles.css`: cream/card surfaces, charcoal text, clay/amber accents, mono IDs, uppercase micro-labels, restrained borders and shadows.
- Preserved the Dockerized frontend contract on host/container port `5174` in package scripts, Vite config, Dockerfile, and Compose wiring.

Behavior notes:
- Unauthenticated `/` is protected and redirects to `/login`.
- Successful login calls the API, then resolves the latest chat session or creates a new one, and redirects to `/chat/<sessionId>`.
- Authenticated `/` resolves to `/chat/<sessionId>` through the same latest-or-new session flow.
- Upload and Records are shell-only placeholder routes; upload/records logic, retrieval, and chat generation were intentionally not implemented.

Verification evidence:
- `lsp_diagnostics` reported no diagnostics for `apps/web/app`, `src/main.tsx`, `src/styles.css`, `vite.config.ts`, and `index.html` after implementation.
- `cd apps/web && npm run typecheck` passed.
- `cd apps/web && npm run build` passed. Vite emitted Tailwind v4 minifier warnings for upstream `@theme`/`@tailwind` at-rules, but exited successfully.
- Docker Compose web/API verification used host port `5174` and API port `8000`; API login succeeded with the disposable test hash/password from Task 2 tests and set `thestacks_session`.
- Playwright MCP verified the real browser flow on `http://localhost:5174`: Logout redirected to `/login`, unauthenticated login UI rendered, password submit redirected to `/chat/ac87b047-7e8d-4749-b474-3ca9cfe3b395`, and authenticated `/` resolved back to `/chat/ac87b047-7e8d-4749-b474-3ca9cfe3b395` with Chat/Upload/Records/Logout visible.

## Verification update - 2026-05-31

- `lsp_diagnostics` on `apps/web/app` reported 9 TS/TSX files scanned, 0 files with errors, 0 diagnostics.
- `lsp_diagnostics` on `apps/web/src` reported 2 TS files scanned, 0 files with errors, 0 diagnostics.
- `cd apps/web && npm run typecheck` passed.
- `cd apps/web && npm run build` passed; Vite emitted non-fatal Lightning CSS warnings for Tailwind-generated `@theme`/`@tailwind` at-rules, but exited successfully.
- Dockerized web verification initially exposed a stale container image still serving the original scaffold page on `5174`; rebuilding/recreating the `web` service fixed the running target while preserving `5174:5174`.
- Recreating services can drop disposable auth env overrides because `.env.example` intentionally leaves `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` blank. For browser verification only, API was restarted with the test bcrypt hash for `admin-password` and `SESSION_SECRET=playwright-session-secret`; no secrets were written to repo files.
- API probe after env restart returned `200 {"authenticated":true}` from `POST /auth/login` with `admin-password`.
- Playwright on `http://localhost:5174/` confirmed unauthenticated users land on `/login`, the login page displays the warm minimal archive UI, submitting `admin-password` redirects to `/chat/ac87b047-7e8d-4749-b474-3ca9cfe3b395`, and the authenticated shell shows Chat, Upload, Records, and Logout.
