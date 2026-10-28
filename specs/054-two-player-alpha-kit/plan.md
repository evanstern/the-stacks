# Implementation Plan: Two-player alpha kit

**Branch**: `task-0163-two-player-alpha-kit` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/054-two-player-alpha-kit/spec.md`, open
questions Q1-Q6 resolved 2026-10-28 (all defaults accepted).

## Summary

Seat two humans at one AI-DM table on hosted dev. The kit has four parts:

1. **Seed** — a new `greyhollow-ford-duo` seed (tamsin and kestrel human, odo an AI companion).
   The seed loader accepts one or more human seats. The start route refuses one user in two
   seats. A new operator route `GET /dm/seeds` lists the shipped seeds and their human seats.
2. **Two-human check** — tests on the duo seed prove scene start, the actor snapshot, the DM
   prompts, group sign-off and floor passing behave with two humans. A defect is written up
   for the orchestrator to card, not fixed here, unless it blocks the seed.
3. **Web surfaces** — an inline redeem toggle on the sign-in card, an operator "Invite a
   player" section on Settings, and an operator "Start scene" slide-out on `/play/:sessionId`.
   Each is a thin caller of an existing or new HTTP route. No modal.
4. **Runbook and alpha** — a "Run a two-player table" section in `docs/ops/dev-vm-104.md`, a
   local live run on this worktree's stack, and the orchestrator-run hosted-dev alpha (AC #4).

## Technical Context

**Language/Version**: TypeScript 5.x on Node 24 (repo toolchain, unchanged).

**Primary Dependencies**: Hono (server routes), Zod (start and seeds schemas), React Router 8
SSR (web), the repo's shadcn `Sheet` via `components/panel.tsx` (slide-out). No new
dependency.

**Storage**: Postgres, unchanged. No migration. Invitations and users tables already exist.

**Testing**: vitest (server unit and `REQUIRE_DATABASE=1` integration; web `.tsx`), `node --test`
(web `.mjs`, the SSR suite and `no-dialog.test.mjs`).

**Target Platform**: the one Node process and the web app, local compose stacks and vm-104 dev.

**Project Type**: web service plus SSR web app (pnpm monorepo).

**Performance Goals**: none beyond existing; `GET /dm/seeds` reads a handful of small JSON files.

**Constraints**: no modals; no token or password in a URL or on a command line; no provider
spend in tests or the local run (fake gateway, `DM_FAKE_SCRIPT`); frozen contracts unchanged
(`docs/wiki/ws-protocol.md` frames, `specs/029-proposal-gate/contracts/`,
`specs/030-play-route/contracts/proposal-seam.md`).

**Scale/Scope**: two to a few humans per table; one new seed; three web surfaces.

## Constitution Check

Checked against `.specify/memory/constitution.md` 2.0.0. Re-checked after Phase 1 design: no
change.

- [x] **I. Agent-operable** — every capability is an HTTP route an agent can call:
      `POST /auth/invitations`, `POST /auth/invitations/redeem`, `GET /dm/seeds` (new),
      `POST /dm/sessions/:sessionId/start`. The web surfaces only call those routes.
- [x] **II. Content contract** — the duo seed's characters carry identity, portrayal and hooks
      through the existing `SceneSeedSchema`. No new codex entity.
- [x] **III. Data planes** — no new state. Seeds are shipped files read by the session plane's
      DM runtime; accounts stay in auth tables.
- [x] **IV. Event sourcing** — scene start still writes typed events through the gate. No new
      event type. The new refusal happens before any write.
- [x] **V. Citations** — no library-derived claim. Not applicable.
- [x] **VI. 5e engine boundary** — the duo seed reuses greyhollow-ford's engine-checked numbers
      and SRD ids, cross-checked by the loader. No engine change.
- [x] **VII. Structured first** — `GET /dm/seeds` returns Zod-validated seed data only.
- [x] **VIII. Operator-owned content** — the duo seed is a copy of the original greyhollow-ford
      content under its existing license block. No book text.
- [x] **IX. Self-hostable** — the Dockerfile already copies `apps/server/seeds/` whole, so the new
      seed ships with no image change. No new container.

**Stack conformance**: within the Architecture Constraints table. No departure.

## Project Structure

### Documentation (this feature)

```text
specs/054-two-player-alpha-kit/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── dm-seeds.md          # new GET /dm/seeds
│   ├── scene-start-seats.md # start-route seat rules (one new refusal)
│   └── web-surfaces.md      # redeem toggle, invite section, Start scene slide-out
├── checklists/requirements.md
├── evidence/                # two-human-check.md, mutation-guard.md, live-run.md, shots/
└── tasks.md
```

### Source code touched

Server:

- `apps/server/seeds/greyhollow-ford-duo.json` — new seed.
- `apps/server/src/dm/seed/load.ts` — `crossCheckSeed` rule: one or more human seats; new
  `listSeeds(dir?)` that loads every `*.json` in the seed directory.
- `apps/server/src/routes/dm.ts` — `GET /seeds`; the start route's one-user-two-seats refusal.
- `apps/server/test/dm/seed.test.ts` — rule tests rewritten for at-least-one; duo load test.
- `apps/server/test/dm/routes.integration.test.ts` — `GET /dm/seeds` and the duplicate-seat
  refusal.
- `apps/server/test/dm/duo.integration.test.ts` — new: two-human scene start, sign-off and floor
  on the duo seed (database).
- `apps/server/test/dm/duo-views.test.ts` — new: snapshot views and player-facing prompts on the
  duo seed (no database).
- `apps/server/dm-scripts/greyhollow-duo-live.json` — new only if `greyhollow-live` does not fit
  the duo scene start in the live run (research R6).

Web:

- `apps/web/app/sign-in.tsx` — the inline redeem toggle and form.
- `apps/web/app/invite-section.tsx` — the operator invite section component (Phase 3).
- `apps/web/app/auth.ts` — `redeemInvitation()` and `issueInvitation()` fetch wrappers.
- `apps/web/app/routes/settings.tsx` — the operator "Invite a player" section.
- `apps/web/app/play/components/start-scene-panel.tsx` — new slide-out.
- `apps/web/app/play/start-scene.ts` — new pure helpers (seat-map validity, request body).
- `apps/web/app/play/components/table-header.tsx` and `apps/web/app/play/table-view.tsx` — the
  operator "Start scene" header control, shown while the session has no scene.
- `apps/web/app/play/use-live-table.ts` and `apps/web/app/play/source.ts` — expose the signed-in
  user's role and a `startScene` command on the live source (fixture source: absent).
- Tests: `apps/web/test/sign-in.test.tsx`, `apps/web/test/settings-invite.test.tsx`,
  `apps/web/test/play/start-scene-panel.test.tsx`, `apps/web/test/play/start-scene.test.mjs`
  (new), and a signed-out redeem-toggle case in `apps/web/test/ssr.test.mjs`.

Docs:

- `docs/ops/dev-vm-104.md` — new "Run a two-player table" section.
- `specs/031-dm-runtime/contracts/dm-api.md` — additive: `GET /dm/seeds` and the new refusal.
- `docs/design/m3-table-sweep-runbook.md` — TASK-0158 row, amendment row, TASK-0163 row.
- Wiki notes (Phase 7 of tasks.md): `dm-runtime`, `seed-npc-presence`, `debug-view`,
  `server-entrypoint-and-app`, `react-router-app`, `client-identity`, `chat-ui`, `play-route`,
  `invitations`, `hosted-dev`, plus `CAPSULES.md` and `INDEX.md`.

**Migrations**: none. **New runtime dependencies**: none.

**Structure Decision**: the existing monorepo layout. Server changes stay under
`apps/server/src/dm/seed/` and `apps/server/src/routes/dm.ts`; web changes stay under
`apps/web/app/` beside the files they extend.

## Phase sequencing

The branch is behind `origin/main` by TASK-0158 (`DM_FAKE_SCRIPT`, merge `e20030d`). Phase 1
merges `origin/main` first so the live phase can use script mode. Phases 1 and 2 are server.
Phases 3 and 4 are web and depend on Phase 1's route. Phase 5 is the runbook. Phase 6 runs the
whole kit live on this worktree's stack. Phase 7 re-grounds the wiki and the sweep runbook.
Phase 8 is the hosted-dev alpha, run by the orchestrator only after the operator's go.

## Complexity Tracking

No constitution violations.
