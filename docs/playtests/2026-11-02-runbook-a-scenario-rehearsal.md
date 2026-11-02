# Runbook A scenario rehearsal — 2026-11-02 (TASK-0195)

- **Environment:** local stack `stacks-task-0195`, `http://localhost:3195`, branch `task-0195-runbook-a-scenario`, base `6306abfb`. Never vm-104. No paid model ran.
- **Seed:** `greyhollow-ford-reed-camp` (Tamsin and Kestrel human, Odo companion; every character has class and level).
- **Script:** `DM_FAKE_SCRIPT=runbook-a-reed-camp`. Boot line: `DM script mode: runbook-a-reed-camp (62 calls, 14 dice)`.
- **Session:** `99ab3446-ffef-46b1-b30f-8f9e8d455494`. Seats: operator holds Tamsin, `player2` holds Kestrel. Credentials stayed outside the repo.
- **Driver:** `local-table.mjs seed|talk|act`. No browser ran in this rehearsal.
- **Checklist:** `docs/playtests/scenarios/runbook-a-reed-camp.md`.

## Turns driven

| Step | Command | Result |
|------|---------|--------|
| Scene start | `seed ... greyhollow-ford-reed-camp tamsin,kestrel` | Opening narration at the causeway; Wenna present, Pell and Snag absent. |
| PC addresses the companion | `talk` "Brother Odo, what do you make of that smoke?" | Odo answered in character (seq 15); Wenna reacted in a narration (seq 17). |
| Enter the camp | `act` Tamsin `act-advance` | Initiative rolled for 7 combatants (Snag first); Pell and Snag arrived; table mode `turn`. |
| NPC turn, no mechanical step | automatic (`npc-turn` job) | Snag's parley shipped as a described action (seq 41). |
| Free the captive | `act` Tamsin `act-free-pell` | `action.resolved` applied; Pell added to the order (seq 45 to 50). |
| Companion turn | automatic | Odo's mace attack applied (seq 61). |
| Second human | `act` Kestrel `act-kestrel-1` (player2) | Applied (seq 72). |
| NPC turns | automatic (5 `npc-turn` jobs) | goblin-2 attack (a miss); goblin-3, goblin-4 and Pell with no mechanical step; Snag's bargain ended the scene. |
| Scene end | automatic | `table-mode.changed` to `free`, `scene.changed` to null (seq 96 to 97). |

## Checklist outcome

| id | status | note |
|----|--------|------|
| A-npc-nomech | pass | 4 NPC turns with no step shipped a described action. |
| A-npc-two | pass | 6 NPC turns ran; the turn advanced after each. |
| A-free-captive | pass | scripted reading; applied. |
| A-noncombatant-attack | not reached | covered by the spec 068 control test, not by this script. |
| A-companion-addressed | pass | scripted (the model's choice stays a paid-run item). |
| A-scroll | not reached | needs the browser; operator plays it. |
| A-party-slideout | not reached | needs the browser. |
| A-return-to-table | not reached | needs the browser. |
| A-truncated | pass | `dm_model_calls`: 51 calls, all `ok`, 0 `truncated` (scripted calls, so only the ledger path is proved). |

## Ledger (session)

Jobs: 20, all `succeeded` (7 `turn`, 6 `npc-turn`, 5 `chronicle`, 2 `companion`, 1 `floor`... see `jobs`). Model calls by purpose: audit 11, chronicle 5, companion 2, director 11, interpret 10, narrate 12; all `outcome=ok`.

## Defects found while rehearsing

- The playtest-run `local-table.mjs` could seat one character only and had no action driver. Added a comma list for `seed` and an `act` command.
- The app image bakes in `apps/server/dm-scripts/`: a script edit needs `up -d --build --force-recreate`, not a bare recreate. Documented in SKILL.md.
- A reply with `companionPrompts: ["odo"]` queues a companion job that consumes Odo's next scripted call; the script keeps `companionPrompts: []`.
