# Runbook B2 scenario rehearsal — 2026-11-05 (TASK-0250)

- **Environment:** local stack `stacks-task-0250`, `http://localhost:3250`, branch `task-0250-b2-scenario`, base `430df14e` (spine #1-#6 merged). Never vm-104. No paid model ran.
- **Seed:** `greyhollow-ford-reed-camp`, unchanged (Tamsin and Kestrel human, Odo companion, Cure Wounds and two level 1 slots already on the sheet). No seed fact was missing, so the base seed is untouched.
- **Script:** `DM_FAKE_SCRIPT=runbook-b2-reed-camp`. Boot line: `DM script mode: runbook-b2-reed-camp (84 calls, 24 dice)`. Prompt shapes: director-v10, interpret-v15, narrate-v21, audit-v16.
- **Sessions:** two scene starts. Session 1 (free mode) drives the pre-encounter rows. Session 2 drives the fight rows.
- **Driver:** `local-table.mjs seed|act`. The party-scope cast used a one-off copy of `act` with `scope` read from an env var (the repo driver declares `character` scope only; same gap as the runbook B log). No browser ran. Credentials stayed outside the repo.
- **Checklist:** `docs/playtests/scenarios/runbook-b2-reed-camp.md`.

## Turns driven

| Step | Declared | Result |
|------|----------|--------|
| Scene start (both sessions) | `seed` | Opening names Tamsin Vale, Brother Odo, Kestrel and Wenna Marsh. No player name. |
| Failed reveal (S1) | Kestrel: "I scan the reeds for anyone watching the camp." | The Director named Pell in `arrivals`. Perception check DC 15, 1d20+3 = 4+3 = 7, severe failure. No `scene-presence.changed` row for Pell. The prose shows only reeds and smoke. |
| Pre-encounter parley (S1) | Tamsin: "I call out to the lookout and try to talk him down." | Director arrival `goblin-3`. `combatant.added` goblin-3 (AC 12). Persuasion check opposed by goblin-3 (influence rule), DC 15, 17-1 = 16, success. No UNKNOWN_COMBATANT. |
| Rush the island (S2) | Tamsin: "Charge! We rush the island." | `encounter.started` (8 combatants), turn mode, Tamsin first, Kestrel second, Odo seventh. |
| Tamsin's attack (S2) | Tamsin: "I swing my longsword at the goblin in the pot-helm." | `attack.resolved` hit (17 vs AC 15), damage 8, `turn.advanced` to Kestrel. |
| Party action, off turn (S2) | Tamsin's seat, party scope, on Kestrel's turn: "Odo casts Cure Wounds on Tamsin." | `action.committed` (group sign-off). No slot spent and no healing row. The job made director and interpret calls only: no narration, no audit. The action stayed committed across the later NPC turns. |
| Kestrel's turn | automatic | Kestrel's seat is unplayed, so `turn.advanced` reason "The AI DM passes the turn of an absent player". |
| NPC turns | automatic | snag hit Tamsin (18 vs AC 16, 6 slashing, 13 to 7). goblin-2 hit Kestrel (19 vs AC 14, 6 slashing, 9 to 3). goblin-3 missed Tamsin (7 vs AC 16). goblin-4 hit Tamsin (20 vs AC 16, 5 piercing, 7 to 2). Each narration carries the roll line with the damage line and the HP change ("takes 6 slashing (13→7 HP)"). Three wounding hits. |
| Flinch | goblin-3's miss | Narration: "she flinches back and the dagger skids off her shield". The scripted audit passes it. |
| Odo's turn | automatic | The held cast resolved once: `spell-slots.changed` 0 to 1 (one slot, Odo), healing 2d8+3 = 14, Tamsin 2 to 13 HP, `turn.advanced` to round 2 (Tamsin). Odo took no second action. Narration carries the dice line and the HP change. |

Ledger totals (session 2 plus session 1): audit 11 ok, chronicle 7 ok, director 12 ok, interpret 10 ok, narrate 11 ok. Jobs: 21 succeeded, 1 queued (the floor job after the script ended; no model call is needed).

## What the rehearsal verifies

The rehearsal proves the engine and wiring path only. A scripted model writes every reading and every narration, so it cannot test model behaviour.

| Row | Rehearsal result |
|-----|------------------|
| B2-failed-reveal | pass (engine): the arrival waited for the band. A severe failure left Pell absent in the ledger. Whether the real Director leaves the reveal to the dice and whether the real narrator stays off Pell needs the real run. |
| B2-pre-encounter-monster | pass (engine): the lookout became a snapshot actor and the opposed check rolled. Not driven: a pre-encounter attack on the lookout, and whether the real interpret names `goblin-3`. |
| B2-wounding-hits | pass (engine): three NPC hits with damage and HP rows, and the damage line in every roll block. Whether the real audit passes the wound narration needs the real run. |
| B2-held-companion | pass (engine): the cast was held off turn, spent one slot on Odo's turn, and healed once. Whether the real narrator voices the waiting action without showing the cast needs the real run. |
| B2-flinch | wiring only: the scripted audit passes by construction. Whether the real audit allows a flinch needs the real run. |
| B2-offturn-verbs | not reached: no scripted narration holds an off-turn readying phrase. Needs the real run. |
| B2-parse, B2-audit-pass-rate | HOSTED ONLY. Not verifiable: scripted audits always pass and every call parses. |
| B2-revisit-0249, B2-revisit-0248 | real run only. |
| S-sneak-attack, S-spells-refused | real run only. |

## Defects found while rehearsing

- Boot recovery re-enqueues committed actions from earlier sessions in the same database, and those turns consume the script queue. A stale session from an aborted run broke the next run. The fix was to truncate `dm_model_calls`, `jobs` and `events` and restart the app. This is rehearsal-only housekeeping.
- A held party action stays in every later turn's interpret input. Each scripted NPC turn must return the held reading beside its own, or interpret fails with `readings do not match the beat`.
- A held turn makes no narrate or audit call, so the script holds a director and interpret pair only.
- Intent `cast` is invalid. The enum names `spell`.
- The scripted Kestrel seat was unplayed. The DM passed her turn as absent, so her player never declared an act. The real run has a live Kestrel.

## Open questions

- Add a `--scope party` option to `.claude/skills/playtest-run/scripts/local-table.mjs act`. The operator plays in the browser, so the real run does not need it. `.claude/` was not edited.
- The playtest-run SKILL.md section 8 names only runbook A. Add runbook B and B2 there.
