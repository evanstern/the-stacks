# Quickstart: validate the play route (TASK-0047)

Run every command from the worktree `.worktrees/task-0047`. Browser checks use **Brave**.

## 1. Gates

```sh
pnpm ci:check
```

Expected: green. `apps/web` runs `node --test` (pure modules, SSR, no-dialog, play-surfaces) and
`vitest run` (component markup).

## 2. Fixture table (no database needed for the views; the app still needs a stack to sign in)

```sh
pnpm env:up
pnpm --filter @the-stacks/server db:migrate   # TASK-0098: fresh stacks come up unmigrated
pnpm dev                                      # or the stack's app URL from env:up
```

Sign in as the operator, open `/play`, follow "Preview fixtures".

| Check | URL | Expected |
|---|---|---|
| Fixture list | `/play/fixtures` | five fixtures with descriptions |
| Composer and card | `/play/fixtures/free-mode-action?as=00000000-0000-4000-8000-000000000001&through=<seq of action.declared>` | Ana's card "declared", commit control shown, "Free mode" |
| Other player | same, `as=00000000-0000-4000-8000-000000000002` | no commit control; "Waiting for … to commit" |
| Turn mode | `/play/fixtures/turn-mode-combat?as=…0001&through=<seq of first table-mode.changed>` | "Turn mode · Your turn" |
| Ledger | free-mode, open Ledger | roll "Ana picks the vault lock" 1d20+5, face 13, total 18; check success |
| Before/after | turn-mode, open Ledger | goblin `hp.current` before → after |
| Secrecy | `/play/fixtures/secret-tracker?as=…0001`, open Ledger | no hidden roll; as `dm`, the hidden roll is present and marked DM-only |
| Approvals | free-mode as `dm`, open Pending proposals | example proposals; Approve and Reject each remove one |
| Player has no approvals | free-mode as a player | no "Pending proposals" trigger |
| Tolerance | `/play/fixtures/unknown-and-invalid` | "5 entries not shown"; valid talk shown |
| Step | use ◂ ▸ | the table shows the state as of that seq |
| Narrow | resize to 390 px | panels are bottom sheets; no sideways scroll |

Sign in as a player and open `/play/fixtures/free-mode-action`: "available to the operator only".

## 3. Live table

Open one live table (`/play` → Start a new table) as the operator in one Brave window and as a
player in another (join by link).

- Player: send talk (IC and OOC); both windows show it after the server records it.
- Player: declare an action; both windows show the card. Operator: comment; card is "discussed".
- Player: commit; both windows show "committed". The other window never shows "committed" first.
- Reload either window: the same view rebuilds. Stop and start the app: the status shows
  reconnecting, then resumes with no duplicates.

Seed a ledger: `node specs/030-play-route/evidence/seed-live.mjs <fixture> <playerUserId>` prints a
session URL holding a copy of the fixture's rows; open it as both viewers and check the ledger.

## 4. Gated on TASK-0045 (final phase only)

After TASK-0045 merges and `origin/main` is merged in: raise an `ask` proposal through the gate (per
TASK-0045's quickstart), confirm it appears in the operator's Pending proposals panel only, approve
one and reject one, and confirm both leave the list in every DM window.

## 5. Evidence

```sh
node specs/030-play-route/evidence/shoot.mjs --mode fixtures   # before the gate
node specs/030-play-route/evidence/shoot.mjs --mode live       # gated phase
```

Expected: PNGs under `specs/030-play-route/evidence/shots/`, light and dark, 1280 and 390 px,
attached to the PR.

## 6. Teardown

```sh
pnpm env:down
```
