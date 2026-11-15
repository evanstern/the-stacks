# Combat smoke rehearsal (local, scripted DM) — 2026-11-14

- **Environment:** local stack `stacks-task-0338` (app :3338, db :15338, test-db :25338), commit `701b5c77`.
- **Script:** `runbook-b2-reed-camp` (74 calls, 24 dice). Boot line confirmed: `DM script mode: runbook-b2-reed-camp (74 calls, 24 dice)`.
- **Seed:** `greyhollow-ford-reed-camp`. Two humans: Tamsin (operator seat), Kestrel (`player2` seat). Odo is the AI companion.
- **Card under test:** TASK-0338. **Spend:** $0 (fake DM, no provider call).
- **Driving:** `local-table.mjs seed/act` plus three scratch helpers in `~/.cache/stacks-sweep/pw/` (`party-act.mjs`, `approve.mjs`, `hold.mjs`) for party-scope actions and comments.
- **Session ids:** The last clean-flow attempts used scene 1 `302cd33e-0b47-4e6a-83f3-9e75dbe93d98` and scene 2 `a2eb9bdb-0ba3-4b6a-80a9-296adddadf3e`. Both sat in a stack that the Docker hang later killed. The rehearsal did not finish.
- **Hosted run:** The hosted run (`docs/playtests/2026-11-14-combat-smoke-hosted.md`) went ahead separately.

## What did not run

The rehearsal did not finish. The Docker daemon hung (`_ping` returned HTTP 500) while the last app rebuild was in progress. A coordinator-ordered single rerun (`run0338.sh`) then hung a second time in `pnpm env:down` (a `docker compose ... test` call blocked for 10 minutes). It was killed and not retried, per the no-retry rule.

- **Metrics (`metrics.py`): did not run.** No R1 table exists for this rehearsal. Scripted timings are fake-DM numbers and would not be latency evidence anyway.
- **Auditor (`pnpm playtest audit`): did not run.**
- **`deeds-narrated`: did not run. There is no result, pass or fail.**
- **Second combat round: not reached.** The held-cast step blocked it (see below).

## Stack reset steps

1. `pnpm env:down`, then `pnpm env:up` (fresh DB).
2. Migrate the app DB: `docker build --target build -t stacks-task-0338-migrate .`, then `docker run ... scripts/migrate.ts`. Output: "Migrations applied."
3. Migrate the host-side test DB: `pnpm --filter @the-stacks/server db:migrate`. Output: "Migrations applied."
4. `.env` already held `DM_FAKE_SCRIPT=runbook-b2-reed-camp`.
5. `docker compose -p stacks-task-0338 up -d --build --force-recreate --wait app`.
6. Create the operator in the app container with a generated password. The creds file went to `~/.cache/stacks-sweep/0338-creds.json`.

The sequence was repeated about six times. Every failed attempt left jobs that consumed strict script calls, so each retry needed a full `env:down` / `env:up`.

## Scene 1 as played

| Step | Action id | Seat | Result |
|---|---|---|---|
| 1 | `act-scan` | Kestrel (`player`) | Check, Perception: severe failure (total 7 vs DC 15). Pell stays hidden. |
| 2 | `act-parley` | Tamsin (operator) | Contest, Persuasion vs goblin-3: success (16 vs DC 15). goblin-3 arrives. |

## Scene 2 as played

A second `seed` call starts scene 2.

| Step | Action id | Seat | Result |
|---|---|---|---|
| 1 | `act-rush` | Tamsin | No-effect resolve. Turn mode starts, `reed-camp` encounter, 8 dice rolled, order set. |
| 2 | `act-strike` | Tamsin | Attack on goblin-2: hit, 8 damage (10 to 2). Turn passes to Kestrel. |
| 3 | NPC turns | script | Snag hits Tamsin (6), goblin-2 hits Tamsin (6), goblin-3 misses with a flinch narration, goblin-4 hits Tamsin (5). Tamsin drops to 0 HP and goes unconscious. That is 3 NPC hits and 1 miss. |
| 4 | Odo's turn | script | Reached. The held cast then breaks (next section). |

## The `act-cast` breakage

The script expects a held party action: "Odo casts Cure Wounds on Tamsin" declared during Kestrel's turn. Every route failed:

| Attempt | Result |
|---|---|
| Character-scope, `characterId: odo`, operator seat | `NOT_AUTHORIZED`: a declaration needs control of the character. |
| Character-scope, `characterId: tamsin`, operator seat | Declared, then `COMMIT_NOT_ALLOWED`. Withdrawn. |
| Party-scope, `characterId: null`, both seats approve, commit | Commits (authority `group`), then the turn fails at interpret: `invalid-output`, `path: actor`. A party action with no character has no actor. |
| Party-scope, `characterId: odo`, both seats approve, commit | Commits (authority `group`), then the turn fails at interpret: `invalid-output`, `expected ["act-cast"], got ["act-cast", null]`. The script's interpret reading carries a second, null-actor stage (the `[null, attack]` pair), which does not match a lone party item. |
| Character-scope declare as Tamsin after goblin-4 hit | `CHARACTER_UNABLE`: the character cannot act: not conscious. |

The held-companion row (B2-held-companion, TASK-0244) cannot complete with this script and seed under these routes.

## Second-seat effect on `act-rush`

With the `player` seat's websocket subscribed while `act-rush` was committed, interpret failed with `invalid-output` and the encounter never started. The same step worked when only the operator's websocket was connected, and the flow worked again when the second seat connected only after `act-rush`. A second connected seat changes the presence set, which changes the beat the planner assembles, so the strict script no longer matches.

## `dm.companion` config error

During scene 2 the `dm.companion` job succeeded but its call logged `outcome: error, errorKind: config`. The script has no `dm.companion` entry shaped for the companion call.

## Findings

| # | Time | Seat | Class | Observation | Existing card | Card |
|---|------|------|-------|-------------|---------------|------|
| 1 | scene 2 | all | gap | No shipped DM script exercises the Intent path with slash commands (`/attack`, `/move`). The rehearsal proves prose declare/commit only. b2 is two-human, so Kestrel's turns post from a second seat. | none found | would-be card below |
| 2 | every retry | all | doc gap | A strict scripted DM desyncs on leftover or retried jobs. Each rehearsal needs a fresh DB. `playtest-run` SKILL section 3 does not say so. | none found | would-be card below |
| 3 | driver | all | tooling | Scripted action ids need `PW_ACTION_ID` to match. `local-table.mjs act` cannot post party-scope declares or comments. | none found | would-be card below |
| 4 | scene 2, odo turn | Tamsin | bug / script | Party-scope `act-cast` commits but fails at interpret (`path: actor`, or reading mismatch). Held-companion rehearsal is unreachable. | TASK-0244 (Done), TASK-0248 | would-be card below |
| 5 | scene 2, `act-rush` | Kestrel | bug / script | A second connected seat makes `act-rush` fail at interpret. Presence-dependent beats make the strict script brittle. | none found | would-be card below |
| 6 | scene 2 | odo | bug / script | `dm.companion` call returns `errorKind: config` under the script. | none found | would-be card below |
| 7 | scene 2 | Tamsin | positive | 3 NPC hits dealt damage, one miss carried a flinch narration. B2-wounding-hits and B2-flinch evidence. | TASK-0242, TASK-0240 | evidence |
| 8 | env | all | infra | Docker daemon hung (`_ping` HTTP 500) during the final rebuild. Metrics, auditor and `deeds-narrated` did not run. | none | none |

## Would-be cards (not created)

```
backlog task create "Script covering Intent path (/attack, /move) for rehearsals" -d "No shipped DM script exercises intent frames; rehearsal proves prose only (TASK-0338 finding 1)." -l playtest
backlog task create "playtest-run skill: strict scripted DM needs a fresh DB per rehearsal" -d "Leftover/retried jobs consume strict script calls (TASK-0338 finding 2)." -l playtest
backlog task create "local-table.mjs: party-scope declare and comment support" -d "act cannot post party-scope actions or approve comments (TASK-0338 finding 3)." -l playtest
backlog task create "runbook-b2-reed-camp: held party act-cast fails at interpret" -d "Party-scope cast commits then interpret invalid-output; see TASK-0338 rehearsal log." -l playtest
backlog task create "Strict script brittle when a second seat is connected" -d "act-rush fails at interpret with two seats subscribed (TASK-0338 finding 5)." -l playtest
backlog task create "dm.companion config error under DM_FAKE_SCRIPT" -d "Script has no companion-shaped entry; call logs errorKind config (TASK-0338 finding 6)." -l playtest
```
