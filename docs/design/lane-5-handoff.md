# M0 Lane 5 (TASK-0016) — lane handoff (2026-09-23)

**You (the session reading this) are the ORCHESTRATOR for this lane, not its implementer.**
Dispatch implementation to `sonnet-implementer` and verify the served model from the first
dispatch's transcript before launching any sibling. Your own hands touch specs, the board,
worktree/PR plumbing, and grounding docs — never `apps/` or `packages/` source.

**Not the `.handoff/` transport.** This is a session-portable lane contract — prose one
orchestrator writes for the next.

**Lane:** 5 · **Scope:** TASK-0016, the last task in the sweep · **Runbook:**
`docs/design/m0-skeleton-sweep-runbook.md` (signed off, amended three times) · **Repo state
when written:** root on `main` at `3009838`, clean, pushed; no worktrees; no stale branches.
**All gates verified green on main from a clean checkout**: migration applies, 67/67 tests
across 10 files, typecheck, lint, build. No CI exists (TASK-0017, out of scope).

## Where the sweep stands

Six of seven tasks are **Done on the board via their own merged PRs**, status derived by
`spec-bridge:sync` every time, never hand-set:

| task | PR | what it delivered |
|---|---|---|
| TASK-0010 | #2 | monorepo, Turborepo, TS strict |
| TASK-0011 | #6 | compose stack, Postgres 17 + pgvector |
| TASK-0013 | #5 | Hono server, `/health`, one typed route |
| TASK-0012 | #8 | Drizzle, migrations, the event log |
| TASK-0014 | #9 | session auth, the `validateSession` seam |
| TASK-0015 | #10 | WebSocket gateway, append + cursor replay |

**TASK-0016 is all that remains.** Its AC#7 *is* the M0 milestone.

## What TASK-0016 actually has to build

Read the card (`backlog task view TASK-0016 --plain`), then know these two concrete facts,
which are not obvious from the card and which I verified:

1. **`apps/web` is a bare skeleton.** Its `package.json` has no React, no Vite, no TanStack —
   only a `@the-stacks/shared` dependency and a `tsc -b` build. Everything in AC#1 and AC#2
   is greenfield.
2. **The Dockerfile builds only the server.** It runs `pnpm --filter "@the-stacks/server..."
   run build` and copies `apps/server/dist` plus `packages/shared/dist`. **Nothing builds or
   copies a SPA, and nothing serves static files.** AC#1 ("served by the app container")
   therefore requires editing `Dockerfile` *and* adding a static-serving path to the Hono app
   — repo-root and server files this lane owns.

Spec numbers 001–006 are taken; **007 is free, but check `origin/main` before claiming it.**

## The two seams 0016 consumes — both merged, both verified, do not reimplement

**Auth (spec 005).** HTTP endpoints in `contracts/http-auth.md`: `POST /auth/sign-in`,
`POST /auth/sign-out`, `GET /auth/me`, `POST /auth/invitations`,
`POST /auth/invitations/redeem`. The session cookie is `HttpOnly` — **the SPA cannot read it
and must not try**. `GET /auth/me` is how the SPA learns who it is on load (AC#3's "persists
across reload" is exactly this call, not client-side storage).

**WebSocket (spec 006).** The frame shapes are fixed in
`specs/006-ws-gateway/contracts/ws-protocol.md`, and **that contract is binding on TASK-0016**
— it says so in its own header. Client→server: `subscribe` (with `afterSeq`), `send`.
Server→client: `event`, `replay-complete`, `error`. Connect to `/ws`; the cookie rides the
upgrade automatically.

**Two protocol details the SPA will get wrong if nobody says so:**

- **`seq` may have gaps** for a viewer filtered out of some events. That is correct, not a
  missed event. The client tracks **the highest `seq` it was delivered** and passes that as
  `afterSeq` on reconnect. A client that assumes contiguity will re-request forever.
- **A `send` is not acknowledged.** Confirmation is the resulting `event` frame arriving —
  which every subscriber including the sender receives. Do not build a separate ack path.

## Already proven — do not re-derive

- **The whole server half works, verified live by the orchestrator, not from test reports.**
  Unauthenticated and bogus-token upgrades are refused `401` (the socket never opens); a
  client claiming `actor`/`seq`/`ts` gets the connection's identity and the server's values;
  fan-out reaches every subscriber including the sender; session isolation holds; a
  subscriber killed mid-broadcast does not stop delivery to survivors; a malformed frame
  returns an error, keeps the connection open, and appends nothing.
- **Visibility filtering is correct on both paths.** Alice whispers in a 3-event session:
  Alice `[1,2,3]`, Bob `[1,3]` live **and** `[1,3]` on replay.
- **The event log is race-safe and measured.** 50 concurrent appends → 50 stored, 0 lost,
  gapless (without the advisory lock it was 21–23 lost per run).
- **Invitations are single-use under concurrency.** 20 simultaneous redemptions → exactly one
  account, three runs.
- **Spec Kit skills work inside a sweep worktree**; `setup-plan.sh`/`setup-tasks.sh` resolve
  by spec-dir basename. Run them; never hand-author (amendment A1).
- **`backlog` has `auto_commit: true`** — every CLI edit self-commits, so a claim needs
  `git reset --soft <base>` to fold the auto-commits and the spec stub into one atomic claim
  commit. This bites on every single claim.

## Environment traps this sweep already paid for

- **`DATABASE_URL` vs `TEST_DATABASE_URL`.** `DATABASE_URL` is the *container's* address
  (`@db:5432`, a compose service name). Host-run tests and `db:migrate` need
  `TEST_DATABASE_URL` (`@localhost:<DB_PORT>`). Both are documented in `.env.example`.
  Compose explicitly blanks `TEST_DATABASE_URL` inside the app container, and the code uses
  `||` not `??` so the blank falls through.
- **`pnpm test` does NOT auto-load `.env`.** Run `set -a && . ./.env; set +a` first, or the
  integration suites **loud-skip** and the run goes green having proven nothing. Only
  `db:migrate` auto-loads it (via `--env-file-if-exists`).
- **Pick a free `DB_PORT`.** 5432–5435 are taken by leftover containers (see Housekeeping).
- **`.env` is gitignored and must never be committed.** Constitution VIII adjacent: no
  credential ships.

## Gates and execution rules that already bit this sweep

- **Rebases and force-pushes are forbidden repo-wide** by the root-guard hook. Branches
  freshen by `git merge origin/main`. Root is read-only except commits scoped **entirely** to
  `backlog/`.
- **Stage `backlog/` paths in a separate Bash call from the commit** — the hook inspects
  staged state before the command runs.
- **Dispatch from a neutral cwd** (repo root), never from inside a worktree (amendment A2).
  Every dispatch prompt opens with a location check naming the branch the agent must see.
- **Verify implementer claims; do not accept reports.** This lane's orchestrator found:
  `db:migrate` broken from the host, `create-operator` prompting before its existence check
  (hanging non-interactive runs), an invitation race test that passed against a deliberately
  broken implementation, and a replay-boundary test that was only ~1-in-7 effective. Every
  one was found by running things, not by reading reports.
- **A regression test must be proven to fail without its fix** — and if it *passes* against
  the broken version, say so; that is a finding, not a failure.
- **Gates before PR, in order:** `pnpm install && pnpm typecheck && pnpm lint && pnpm test &&
  pnpm build`, run **in the worktree**, literal output pasted into the PR body. That output
  is the standing evidence for the CI TASK-0017 has not built.
- **Re-run all gates after merging `main` in**, unconditionally.

## Merging — read this before you plan around it

**You cannot merge your own PR.** The auto-mode classifier refuses `gh pr merge` on a PR the
session authored ("Merge Without Review"), *separately* from the `Bash(gh pr merge:*)`
permission the runbook records as granted. That permission is real and in
`.claude/settings.json`; the classifier objects anyway, correctly — an agent merging its own
unreviewed work is the pattern regardless of who asked.

**Plan for it:** open the PR, report it to the operator with the evidence, and wait. Both #9
and #10 merged this way within one turn of asking. Do not try to work around the denial; it
also blocks read-only `gh pr view` once it has fired, so record state via git instead.

## Done means

- TASK-0016 **Done on the board via its own merged PR**, status derived by `spec-bridge:sync`.
- It carries its `Spec:` marker, a real `spec.md` + `plan.md` + `tasks.md`, and a
  `Dispatch: tier=… pinned=… served=…` line with a real served model ID read from a transcript.
- **The M0 demo actually runs**: `docker compose up` from a clean clone, two browsers signed
  in as different users, a message from one appearing in the other via the event log, and
  reload replaying prior events. **Verify by running it**, not by trusting tests — that is
  the lesson the T016 finding paid for, and it is the one check this sweep has never been
  able to perform (every dispatch so far was shell-only with no browser).
- All gates green on `main`; `git worktree list` shows nothing stale.
- **`/grounding-wiki:wiki-build` run after the final merge.** No `docs/wiki/` exists yet; the
  whole codebase is new, so the corpus is built fresh rather than updated. This is owed by
  the sweep, not by TASK-0016.
- The runbook's execution log complete and its status flipped to `done`.

Anything short of that gets reported as **exactly what remains**, not rounded up.

## Known open, not blocking

- **Spec 001's format inconsistency** — hand-authored before amendment A1, deliberately left,
  operator-declined. Do not silently normalize it.
- **`apps/server/tsconfig.json` scopes `include` to `["src"]`, so `test/` is never
  typechecked.** Real gap, belongs to **TASK-0017** (CI), out of this sweep. Two destructuring
  bugs in test files reached a dispatch because of it.
- **Send-call order is not commit order.** Concurrent `send` frames from one socket race for
  the event log's advisory lock. Not a spec violation — FR-007 promises one order *for every
  subscriber*, not the sender's call order — but it bit two test drafts. Use a
  confirm-then-proceed barrier (await the previous send's own echo) when a test needs
  deterministic ordering from one socket.
- **T022 (the end-to-end replay-boundary test) is probabilistic**, ~1-in-7. That is
  documented in its own comment and is fine: `apps/server/test/ws.subscribe.test.ts` is the
  deterministic guard (5/5 failures against a broken ordering), and both are kept.
- **TASK-0017 (CI) and TASK-0018 (root-guard non-ASCII fix)** are on the board and **NOT in
  this sweep**. Do not start them.

## Housekeeping the next session can clear

Four orphaned Postgres containers from finished lanes are still running and holding ports:

```
task-0015-db-1  127.0.0.1:5435->5432/tcp
task-0014-db-1  127.0.0.1:5434->5432/tcp
task-0012-db-1  127.0.0.1:5433->5432/tcp
the-stacks-db-1 5432/tcp (unpublished, pre-amendment-A3)
```

Their tasks are all merged and their worktrees are gone. Removing them
(`docker compose -p <name> down -v`) is safe but was **blocked by the permission classifier**
for this session after a subagent flagged one as unknown-origin. Ask the operator, or pick a
`DB_PORT` above 5435 and leave them alone.
