# Implementation Plan: The Table landing lists your tables

**Branch**: `task-0175-table-landing-list` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/069-table-landing-list/spec.md`. Written against OQ-1 (a). A ruling of (b) amends
this plan and tasks.md before Phase 1 dispatches.

## Summary

The server gains one read, `GET /api/tables`, in a new route file. It reads the `events` table
with one SQL query: the account's live player seats, its human DM seats, and (operator only) every
session. For each table it returns the latest visible scene title and the latest visible row time.
`/play` fetches it after hydration and renders a "Your tables" list of links under Join. Start,
Join and the fixtures link are unchanged. No migration, no new event type, no gate change.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 24.
**Primary Dependencies**: Hono, Drizzle (`sql` template, already used in `auth/invitations.ts`),
React Router 8, React. No new runtime dependency.
**Storage**: the existing `events` table, read only. No migration. No new index.
**Testing**: vitest in `apps/server` (DB integration, skips without a database; `REQUIRE_DATABASE=1`
fails it instead) and vitest in `apps/web` (`renderToStaticMarkup`, no DOM library).
**Target Platform**: the one-process server and the SSR web app.
**Project Type**: web app (monorepo: `apps/server`, `apps/web`).
**Performance Goals**: alpha scale (tens of sessions). One query per landing visit.
**Constraints**: no modals. No frozen contract change (`ws-protocol`, specs/029, specs/030
proposal seam). No provider spend: the live check uses `DM_FAKE_SCRIPT`.
**Scale/Scope**: one new server route file, one mount line, one web route edit, two test files.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable** — `GET /api/tables` is a plain authenticated HTTP read. An agent calls
      it with the same session cookie. No human-only path.
- [x] **II. Content contract** — no codex entity. N/A.
- [x] **III. Data planes** — reads the session plane only, through a server route. No write.
- [x] **IV. Event sourcing** — the list is a read over the log. Visibility is honored: title and
      activity come only from `public` rows and rows addressed to the account (FR-005). Seat
      detection reads seat rows, which name the account itself.
- [x] **V. Citations** — no library claim. N/A.
- [x] **VI. 5e engine boundary** — no mechanics. N/A.
- [x] **VII. Structured first** — the response shape is a typed contract (below); the web side
      renders it with existing tokens.
- [x] **VIII. Operator-owned content** — no rulebook text.
- [x] **IX. Self-hostable** — no new container or service.

**Stack conformance**: TypeScript, Hono, Drizzle, React Router 8. No departure.

## Research (Phase 0)

- **R1 — Where the route lives.** Decision: `GET /api/tables`, mounted in `app.ts` beside
  `/api/echo`. `/api` is already a reserved prefix in `static.ts`, so the web fallback never
  shadows it and dev mode routes it straight to Hono. Alternative: under `/dm` (rejected: every
  `/dm` route is operator-only; this one serves players).
- **R2 — No sessions table.** A table is the set of `events` rows sharing a `session_id`. The read
  derives seats from the latest `party.member.changed` row per `(session_id, characterId)` and the
  latest `dm.seat.changed` row per session, with `DISTINCT ON`. Alternative: fold each session with
  `loadProjections` (rejected: replays every session's full log per request).
- **R3 — Operator scope (OQ-1 (a)).** The operator gets every session. `createOperator` refuses a
  second operator, so every scene start is theirs. Alternative (b), `startedBy` on the job input,
  waits on the ruling.
- **R4 — Visibility.** Title and activity filter `visibility = 'public' OR visibility = <userId>`.
  The operator uses the same filter with their own id: the landing is not the DM view.
- **R5 — Fetch on the client.** `table.tsx` already is client-only after hydration. It fetches
  `/api/tables` in a `useEffect` with `credentials: "same-origin"`, as `start-scene.ts` fetches
  `/dm/seeds`. Alternative: a route loader (rejected: SSR would need to forward the cookie to its
  own API).
- **R6 — No shared type.** The response type is declared in the server route and restated in
  `table.tsx`, as `LibraryJob` was restated (plan D2 of spec 024). One consumer does not justify a
  `packages/shared` export.

## Data model (Phase 1)

No new storage. The response entity:

```ts
type TableRelation = "dm" | "player" | "started";
interface TableSummary {
  sessionId: string;            // uuid
  title: string | null;         // latest visible scene.changed with non-null after → after.title
  lastActivityAt: string | null; // ISO; max(ts) over visible rows; null when none is visible
  relation: TableRelation;      // precedence dm > player > started
}
```

## Contract (Phase 1): `GET /api/tables`

- Auth: the session cookie, through `createAuthMiddleware`. No identity → `UnauthorizedError`
  (401, the [[error-contract]] shape).
- 200 body: `{ tables: TableSummary[] }`, ordered `lastActivityAt` descending with nulls last,
  then `sessionId` ascending. At most 50 entries.
- Membership rules, evaluated per session for the signed-in user `u`:
  1. `dm` when the latest `dm.seat.changed` row has `after.kind = 'human'` and `after.userId = u`.
  2. `player` when, for any `characterId`, the latest `party.member.changed` row has
     `after.controller.kind = 'player'` and `after.controller.userId = u`. A null `after` removes
     the seat.
  3. `started` when `u` has role `operator` (OQ-1 (a)).
  4. Otherwise the session is not returned.

Query sketch (the implementer may restructure it; the rules above are binding):

```sql
WITH seats AS (
  SELECT DISTINCT ON (session_id, payload->>'characterId') session_id,
         payload->'after'->'controller' AS ctl
  FROM events WHERE type = 'party.member.changed'
  ORDER BY session_id, payload->>'characterId', seq DESC
), dm AS (
  SELECT DISTINCT ON (session_id) session_id, payload->'after' AS seat
  FROM events WHERE type = 'dm.seat.changed'
  ORDER BY session_id, seq DESC
), mine AS (
  SELECT session_id, 1 AS rank FROM dm
   WHERE seat->>'kind' = 'human' AND seat->>'userId' = ${u}
  UNION ALL
  SELECT session_id, 2 FROM seats
   WHERE ctl->>'kind' = 'player' AND ctl->>'userId' = ${u}
  UNION ALL
  SELECT DISTINCT session_id, 3 FROM events WHERE ${isOperator}
)
-- then per session: min(rank) → relation; visible max(ts); latest visible scene title
```

`ponytail:` the query scans `events` by type with no index beyond the primary key. Ceiling: a few
thousand sessions. Upgrade path: a `(type, session_id, seq)` index or a session summary table.

## Quickstart (Phase 1): the live check

1. On the worktree stack: `pnpm env:up`, migrate both databases by hand, turn script mode on with
   `DM_FAKE_SCRIPT=greyhollow-live` and recreate the app container
   (`specs/053-env-fake-dm-script/quickstart.md` steps 1-6). Create the operator with a generated
   password kept in a scratchpad outside the repo.
2. As the operator, invite `player2`; redeem it in a second Brave context.
3. Operator: Start a new table (table A); Start scene `greyhollow-ford-duo`, seating the operator
   and `player2`. Start a second table (table B) seating only the operator, with
   `greyhollow-ford` (one human seat).
4. Open `/play` in both contexts. Expect: the operator lists A and B, newest first, with scene
   titles; `player2` lists A only (marked "Player") and never B.
5. Follow an entry: expect `/play/<sessionId>` for that table.
6. Shoot `/play` for both accounts at 1280 px and 390 px, light and dark.

## Project Structure

### Documentation (this feature)

```text
specs/069-table-landing-list/
├── spec.md
├── plan.md                 # this file (research, data model, contract, quickstart inline)
├── checklists/requirements.md
├── tasks.md
└── evidence/               # Phase 3: shoot.mjs, live-run.md, db-run.md, shots/
```

### Source code touched

| File | Change | Phase |
|---|---|---|
| `apps/server/src/routes/tables.ts` | new: `createTablesRoute({ db, validateSession })`, `listTables(db, identity)`, `TableSummary` | 1 |
| `apps/server/src/app.ts` | mount `app.route("/api/tables", createTablesRoute(...))` before the web middleware | 1 |
| `apps/server/test/tables.integration.test.ts` | new: player, operator, no-seat, removed seat, DM seat, dm-only title, 401 | 1 |
| `apps/web/app/routes/table.tsx` | fetch `/api/tables` after mount; export pure `TableList`; render under Join | 2 |
| `apps/web/test/table-list.test.tsx` | new: `TableList` render cases | 2 |
| `specs/069-table-landing-list/evidence/shoot.mjs`, `live-run.md`, `db-run.md`, `shots/*.png` | new: live check and Brave screenshots | 3 |
| `docs/wiki/play-route.md`, `react-router-app.md`, `server-entrypoint-and-app.md` | re-ground (runbook list) | 4 |
| `docs/wiki/chat-ui.md` | re-ground: lists `routes/table.tsx` as a source | 4 |
| `docs/wiki/static-serving.md` | re-pin: lists `app.ts` as a source; `/api` reserved claim unchanged | 4 |
| `docs/wiki/INDEX.md`, `docs/wiki/CAPSULES.md` | upkeep | 4 |

No migration. No new runtime dependency. No change to `packages/`, the gate, the WebSocket
protocol or any frozen contract.

**Structure Decision**: the existing monorepo layout. Server routes follow `routes/dm.ts`
(factory taking `db` and `validateSession`, auth middleware, typed errors). The web landing stays
one route file, as it is today.

## Wiki notes this task touches

`play-route`, `react-router-app`, `server-entrypoint-and-app` (runbook list). The freshness gate
also flags `chat-ui` (source `routes/table.tsx`) and `static-serving` (source `app.ts`); Phase 4
reviews both. `error-contract` lists no touched source.

## Risks

- **Shared test database.** The operator sees every session in the database, including other
  tests' sessions. Operator assertions check containment and relative order, never equality.
- **Activity ties.** `ts` is `now()` per append transaction; sequential appends in a test get
  increasing times. Order assertions append the newer table later.
- **`no-dialog.test.mjs`** scans the web app. The list uses plain links only.

## Test and run notes for the orchestrator

- Phase 1 needs a database: `pnpm env:up`, migrate both databases, export only
  `TEST_DATABASE_URL` from the worktree `.env`, run with `REQUIRE_DATABASE=1`.
- Phase 3 needs script mode and Brave (playwright-core resolved from outside the repo, as
  `specs/061-trio-seed/evidence/shoot-live.mjs` does). No paid run.

## Complexity Tracking

No constitution violations. Nothing to justify.
