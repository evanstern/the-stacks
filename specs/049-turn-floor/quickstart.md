# Quickstart: validate turn-mode floor passing (spec 049)

## Prerequisites

1. Run `pnpm install --frozen-lockfile` in the worktree.
2. Run `pnpm env:up`.
3. Migrate both databases by hand (fresh stacks come up unmigrated, TASK-0098). Migration
   0007 must apply.
4. Restart the app.
5. Export only `TEST_DATABASE_URL` from the worktree `.env`. Never `source` the whole file.

## Gates

- `pnpm ci:check` is green.
- `REQUIRE_DATABASE=1 pnpm --filter server test` is green. Re-run a WebSocket gateway test or
  a 5 s-timeout DB scene test once if it fails and the phase did not touch it; report it.
- Wiki freshness and spec-bridge gates print `OK` / exit 0 (runbook "Per-PR gates").

## Expected outcomes

| Scenario | Proof | Contract |
|---|---|---|
| Ana (active) ends her turn | one append: mechanics batch with `turn.advance`, then `table-mode.changed` naming Bram | `contracts/floor-request.md` Rows |
| Bram ends Ana's turn | `FLOOR_NOT_HELD`, log unchanged | Checks 3 |
| A stale `turn` | `TURN_MOVED`, log unchanged | Checks 2 |
| The next combatant is dying | the same append holds `death-save.roll`, then `turn.advance` unless a natural 20 | Rows, settling |
| The seated DM takes, then returns, the floor | two `table-mode.changed` rows; `encounter.round` and active combatant unchanged; a player commit between them is `COMMIT_NOT_ALLOWED` | Rows |
| End turn while a turn job resolves the same action | one `turn.advance` for that turn in the log | `contracts/floor-jobs.md` Resolve |
| Full round, two humans and Pip | `table-mode.changed` holders: Ana, Bram, Pip, `ai:dm`, Ana; round 2 | spec FR-024 |
| AI seat, Bram absent on his turn, 30 s wait (injected) | `floor` job outcome `passed`; batch starts with a `floor` marker that omits Bram | `contracts/floor-jobs.md` Run |
| AI seat, a silent present quorum member, 120 s window (injected) | `floor` job outcome `committed`; batch `[signoff marker, action.committed(dm)]` | `contracts/floor-request.md` Stall override |
| AI seat, a quorum member objects | `floor` job outcome `noop` or `refused`; nothing committed | Stall override |
| Human seat | every `floor` job finishes `skipped` | Run 1 |
| Play route `play/fixtures` → `turn-floor` | badge, order strip, End turn or DM controls, transcript floor lines; no dialog element | `contracts/ui-floor.md` |
