# Contract: the playtest CLI

Module: `apps/server/src/playtest/cli.ts` (compiled to `dist/playtest/cli.js`). Scripts:
`pnpm playtest <command>` at the root, `pnpm --filter @the-stacks/server playtest <command>`.
Both build first (`tsc -b`) and load `../../.env` when present, like `bench:load`. Argv parsing
uses `node:util` `parseArgs`.

## Commands

### `run`

```
pnpm playtest run [--scenario <file>] [--mode ci|provider] [--out <dir>]
                  [--seed <int>] [--spend-ceiling-usd <n>] [--no-audit]
```

- `--scenario` default `apps/server/playtests/scenarios/greyhollow-ford.json`.
- `--mode` default `ci`.
- Recreates the `<base>_playtest` database (`PLAYTEST_DATABASE_URL` override; else
  `TEST_DATABASE_URL || DATABASE_URL` suffixed `_playtest`; loopback only; refuses a
  concurrent connection), plays the scenario, exports the run directory, then audits it unless
  `--no-audit` (CI mode: fake auditor; provider mode: `playtest.audit` under the same ceiling).
- Prints the run directory path, the outcome, the verdict, and the spend.

### `audit`

```
pnpm playtest audit (--dir <run dir> | --session <uuid> [--db-url <url>])
                    [--auditor fake|provider|none] [--audit-script <file>]
                    [--out <dir>] [--spend-ceiling-usd <n>]
```

- `--dir` re-audits saved artifacts; no database.
- `--session` exports the session from `--db-url` (default `DATABASE_URL`) read-only into a new
  run directory, then audits it. This is how the demo session is audited.
- `--auditor` default: `fake` for a CI-mode run directory, else `none`. `provider` runs the
  provider preflight (cost-guard.md) with the estimate based on the segment count.

### `estimate`

```
pnpm playtest estimate [--scenario <file>] [--segments <n>]
```

Runs the provider preflight steps 1 to 4 and prints the estimate. Makes no model call. Exits 0
when configuration is complete, 4 otherwise.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | finished; the scene ended (run) and the verdict is `pass` |
| 1 | finished; the verdict is `fail` or `incomplete` |
| 2 | finished; the run outcome is `stalled`, `failed`, `budget-stopped` or `timed-out` (artifacts saved) |
| 3 | spend not confirmed, or the ceiling is below the upper-bound estimate; nothing spent |
| 4 | refused: `CI` set in provider mode, or a purpose or price is missing |
| 64 | usage error (bad flag, unreadable or invalid scenario) |

## Output hygiene

Logs go to stderr as one JSON line per event (`{ "event": ..., ... }`), never with prompt text,
model output or keys. The final summary goes to stdout.
