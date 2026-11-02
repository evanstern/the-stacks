# Feature Specification: The Table landing lists your tables

**Feature Branch**: `task-0175-table-landing-list`

**Created**: 2026-11-02

**Status**: Draft. OQ-1 is resolved: (a).

**Input**: TASK-0175, "The Table landing lists the tables you play at". Outcome: `/play` lists the
tables the signed-in account has a seat at (as a player or the DM), newest activity first, each
with its scene title and a link. The operator also sees the tables they started. Start fresh and
Join by link stay. Why: two-browser alpha playtest 2026-10-28, item 8
(`docs/playtests/2026-10-28-two-browser-alpha.md`). After a reboot the operator could not find the
table again; the only way back was browser history.

`speckit-clarify` was skipped. The code settles every question but one (OQ-1, who "started" a
table), and that one has a safe default recorded below.

## Background: what exists today (survey of `origin/main` at 7e252840)

- `/play` is `apps/web/app/routes/table.tsx`: "Start a new table" (a random UUID), "Join a table"
  (paste a link or id), and an operator-only "Preview fixtures" link. It reads no server data.
- A table is a play session: the rows of `events` sharing one `session_id`. No sessions table
  exists. Each row carries `type`, `payload`, `visibility` and a database `ts`.
- A player seat is a `party.member.changed` row whose `after.controller` is
  `{ kind: "player", userId }`. Resolve writes one per human character at scene start
  (`apps/server/src/dm/nodes/resolve.ts`). An `after: null` row removes the member.
- The DM seat is the latest `dm.seat.changed` row; `after` is `{ kind: "ai" }` or
  `{ kind: "human", userId }` (`loadDmSeat`, `apps/server/src/session/events.ts`).
- The scene title is the latest `scene.changed` row's `after.title` (null `after` ends the scene).
- `POST /dm/sessions/:sessionId/start` is operator-only and does not record which operator called
  it. The job input (`TurnJobInput.start`) holds `seedId` and `seats` only.
- `createOperator` refuses a second operator (`apps/server/src/auth/provisioning.ts`);
  invitations create players only. A real install has exactly one operator.

## Open questions

- **OQ-1 (RESOLVED 2026-11-02) — What "the tables they started" means for the operator.** Operator ruling: "Every table (Recommended)". The operator sees every table; no `startedBy` field. Nothing records who started a
  table. (a) **Default:** the operator sees every table in the log. On a one-operator install
  every scene start is theirs, so this equals "the tables they started" with no new record.
  (b) Record `startedBy` on the scene-start job and list only those. This adds a field to
  `TurnJobInput` and leaves tables started before the change unlisted. The spec, plan and tasks
  implement (a). A ruling of (b) amends the plan before Phase 1 dispatches.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A player finds their table again (Priority: P1)

A player who sat at a table closes the browser. Later they open `/play` and see that table in a
list, with its scene title, and open it with one click.

**Why this priority**: this is the playtest failure. Without it, a lost tab loses the table.

**Independent Test**: seat a player at a started scene, sign in as that player, open `/play`,
and follow the listed link to `/play/<sessionId>`.

**Acceptance Scenarios**:

1. **Given** a player holds a seat at two tables, **When** they open `/play`, **Then** both tables
   are listed, the one with the newest activity first, each showing its scene title.
2. **Given** a listed table, **When** the player activates its entry, **Then** the browser goes to
   `/play/<sessionId>` for that table.
3. **Given** a table at which the player holds no seat, **When** they open `/play`, **Then** that
   table is not listed.
4. **Given** a player whose seat was removed, **When** they open `/play`, **Then** that table is
   not listed.

### User Story 2 - The operator finds every table they run (Priority: P1)

The operator opens `/play` and sees the tables they started, including tables where they hold no
seat, newest activity first.

**Why this priority**: the operator lost the table in the playtest.

**Independent Test**: as the operator, start a scene that seats a player, then open `/play`.

**Acceptance Scenarios**:

1. **Given** the operator started a table seating only a player, **When** the operator opens
   `/play`, **Then** the table is listed and marked as one they started.
2. **Given** the operator holds the human DM seat at a table, **When** they open `/play`, **Then**
   the entry is marked "DM".

### User Story 3 - Start and Join still work (Priority: P2)

"Start a new table" and "Join a table" keep their behavior and place.

**Acceptance Scenarios**:

1. **Given** the landing, **When** the account has no tables, **Then** the list shows an empty
   message and Start and Join work as before.

### Edge Cases

- A table whose scene has not started (no `scene.changed` row) is listed as "Untitled table" with
  a short id.
- A table whose scene ended (`after: null`) shows the last title it had.
- The list request fails: the landing shows an error line; Start and Join still work.
- The account is signed out: the read refuses with 401; the landing already requires sign-in.
- DM-only rows never set a player's last-activity time or title.
- More tables than the list cap: only the newest 50 show.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The server MUST offer one authenticated read that returns the signed-in account's
  tables (card AC #1).
- **FR-002**: For a player, a table is listed only when the latest `party.member.changed` row for
  some character at it seats that player, or the latest `dm.seat.changed` row seats them as the
  human DM (card AC #1, AC #3).
- **FR-003**: For the operator, every table in the log is listed (OQ-1 (a)) (card AC #1).
- **FR-004**: Each entry MUST carry the session id, the scene title or null, the last-activity
  time, and the account's relation to it: `player`, `dm` or `started` (card AC #1).
- **FR-005**: Title and last-activity time MUST be read only from rows the account may see as a
  player: `public` rows and rows addressed to the account (card AC #3).
- **FR-006**: Entries MUST be ordered newest last-activity first, capped at 50 (card AC #2).
- **FR-007**: `/play` MUST list the entries, each linking to `/play/<sessionId>`, readable in light
  and dark mode (card AC #2).
- **FR-008**: `/play` MUST keep "Start a new table" and "Join a table" unchanged (card outcome).
- **FR-009**: The landing MUST NOT use a modal (product rule).
- **FR-010**: An integration test MUST cover a player and the operator, and a test MUST show a
  player never sees a table without their seat (card AC #1, AC #3).

### Key Entities

- **Table summary**: one play session as seen by one account. Session id, scene title (nullable),
  last-activity time, relation (`player` | `dm` | `started`).

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 read route, scene title, last activity, test for a player and the operator | FR-001 to FR-004, FR-010; US1, US2 |
| #2 `/play` lists newest first, links to `play/:sessionId`, light and dark | FR-006, FR-007; US1 #1, #2 |
| #3 a player never sees a table without a seat, with a test | FR-002, FR-005, FR-010; US1 #3, #4 |

## Success Criteria *(mandatory)*

- **SC-001**: A seated player reaches their table from `/play` in one click after closing every
  tab.
- **SC-002**: In tests, a player sees zero tables at which they hold no seat.
- **SC-003**: The operator sees every table they started, newest first.
- **SC-004**: Screenshots at 1280 px and 390 px, light and dark, show the list legible in both
  schemes.

## Assumptions

- One operator per install (provisioning refuses a second). OQ-1 (a) depends on it.
- 50 entries cover alpha use. Paging is not needed yet.
- A table with no events does not exist to the server and is not listed.
