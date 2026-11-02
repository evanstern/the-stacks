# Per-runbook playtest scenarios (TASK-0195)

Each sweep runbook ships a playtest scenario aimed at the features that runbook built. The
operator plays it after the sweep (checkpoint "the playtest"). The scenario spares the operator
the same opening every run.

## Where a scenario lives

| Part | Path | Required |
|---|---|---|
| Seed | `apps/server/seeds/<seed-id>.json` | yes |
| Setup script (`DM_FAKE_SCRIPT`) | `apps/server/dm-scripts/<runbook>-<name>.json` | no |
| Checklist | `docs/playtests/scenarios/<runbook>-<name>.md` | yes |

- The seed starts one beat before the fight (or in it). Every party character carries `class` and `level`.
- The script sets the scene up. It never replaces a paid-model turn that tests model behavior.
- The checklist is a markdown table with the `checklist.mjs` columns: `id | item | source | status | note`.
  One row per runbook "Last step" bullet. Row ids are stable.

## How playtest-run loads it

1. Seed: `local-table.mjs seed <creds> <port> <seed-id> <character>[,<character>]`.
2. Script: `DM_FAKE_SCRIPT=<script-name>` (rehearsal only; see `.claude/skills/playtest-run/SKILL.md`).
3. Checklist: `checklist.mjs derive --scenario docs/playtests/scenarios/<file>.md ...`.

## Rule for runbook authors

Every runbook ends with a "Last step" that authors its scenario, and a rehearsal log of that
scenario under `docs/playtests/`. A runbook is not done until the rehearsal runs end to end
on a worktree stack with `DM_FAKE_SCRIPT`.

Sweep doctrine lives in the pdlc plugin, outside this repo. This file is the repo's copy of the rule.
