# Runbook B scenario rehearsal — 2026-11-03 (TASK-0234)

- **Environment:** local stack `stacks-task-0234`, `http://localhost:3234`, branch `task-0234-runbook-b-scenario`, base `08cdf8eb`. Never vm-104. No paid model ran.
- **Seed:** `greyhollow-ford-reed-camp`, unchanged (Tamsin and Kestrel human, Odo companion). Odo already carries `cure-wounds` and two level 1 slots. Snag and Pell start absent. Goblin-2 stands in the encounter for the opportunity attack. No seed fact was missing, so the base seed is untouched.
- **Script:** `DM_FAKE_SCRIPT=runbook-b-reed-camp`. Boot line: `DM script mode: runbook-b-reed-camp (113 calls, 29 dice)`.
- **Sessions:** two scene starts, because the reed-camp encounter runs once per session. Session 1 (free mode) drives the pre-encounter rows. Session 2 drives the fight rows. Credentials stayed outside the repo.
- **Driver:** `local-table.mjs seed|act`. The party-scope Odo casts used a one-off copy of `act` with `scope: "party"` (the repo driver declares `character` scope only; see Open questions). No browser ran.
- **Checklist:** `docs/playtests/scenarios/runbook-b-reed-camp.md`.

## Turns driven

| Step | Declared | Result |
|------|----------|--------|
| Scene start (both sessions) | `seed` | Opening names Tamsin Vale, Brother Odo, Kestrel and Wenna Marsh, no player, no "What do you do?" ending. |
| Undeclared method | Tamsin: "We move along the timber posts toward the reed camp." | `action.resolved` no-effect, plain narration, no check row. |
| Revealed NPC | Kestrel: "I look and listen across the reeds..." | Perception check DC 15 (medium tier), 14+3 = 17, success. `scene-presence.changed` arrived for Snag and Pell. |
| Attack before the encounter | Kestrel: "I take aim and shoot at Snag." | Snag added as a combatant, `attack.resolved` against AC 15 (from the record), a miss. No refusal. |
| Help | Kestrel: "I steady Tamsin..." | `assist.granted` (acrobatics, helper Kestrel). |
| Help used | Tamsin: "I vault the sunk log..." | Two d20 (6, 17), advantage, total 19 vs DC 15, `assist.ended` cause `used`. |
| Opposition | Tamsin: "I shove Snag back from the post." | DC 9 from Snag's stats (no model DC), 11+5 = 16, success. |
| Spell slots | Party scope x3: "Odo, cast Cure Wounds on Tamsin." | Casts 1 and 2: `spell-slots.changed` expended 0 to 1, then 1 to 2; 2d8+3 healing from the SRD record. Cast 3: `refused`, `NO_SLOT_AVAILABLE`; prose does not claim a spent slot. |
| Enter the camp (session 2) | Tamsin: "Charge! We rush the island." | `encounter.started` (8 combatants), turn mode, Tamsin first. |
| Clarify | Tamsin: "I attack Pell." | `no-effect`, no `turn.advanced`, narration shows the question. |
| Captive attack | Tamsin: "I swing my longsword at Pell." | Pell added to the order, `attack.resolved` against AC 10, a miss; `turn.advanced` once. |
| Opportunity attack | Kestrel: "I run to Pell and attempt to free him." | One reaction `attack.resolved` by goblin-2 (`reaction: true`), named as the goblin's in the prose; Kestrel's action is `applied`. The parked followUp is "Kestrel cuts Pell's bonds". |
| Odo and NPC turns | automatic | Odo's mace hit goblin-3; five NPC turns each shipped a described action; the order wrapped to round 2. |
| Later beat | Tamsin: "I hold my ground..." | Narration says Pell is still tied; the followUp stayed undone. |

## What the rehearsal verifies

The rehearsal proves the engine and wiring path only. A scripted model writes every reading, so it cannot test model behaviour.

| Row | Rehearsal result |
|-----|------------------|
| B-scene-start | wiring only: the scripted opening names the party and Wenna; the real model's opening is the real test. |
| B-undeclared-method | wiring only: the plain resolution path works; whether the model adds a Stealth check needs the real run. |
| B-revealed-npc | pass (engine): arrivals log before the pull. |
| B-attack-before-encounter | pass (engine): the plan gate passes and pulls Snag in. |
| B-stakes-outcome | wiring only: band and prose line shown; the model's declared outcomes need the real run. |
| B-engine-numbers | pass (engine): modifier and DC derived (17 = 14+3 vs DC 15). |
| B-opposition-help | pass (engine): DC 9, advantage, assist used. |
| B-spell-slot | pass (engine): two casts spend slots, the third is refused. |
| B-clarify | pass (engine): the turn holds. |
| B-captive-attack | pass (engine): Pell is pulled in. |
| B-opportunity-attack | pass (engine): one engine reaction on the goblin's side. |
| B-followup-undone | wiring only: the scripted prose says undone; whether a real narration shows it as done needs the real run. |
| B-fallback-voices | not reached: no scripted narration hit the fallback. Needs the real run. |
| B-narration-ending, B-audit-pass-rate, B-parse | HOSTED ONLY. Not verifiable: scripted audits always pass and every call parses. |
| B-revisit-0216, B-revisit-0221, B-revisit-0233 | real run only. |
| S-sneak-attack, S-spells-refused | real run only. |

## Ledger (session 2 plus session 1)

Model calls by purpose and outcome: audit 22 ok, chronicle 16 ok, companion 2 ok, director 22 ok and 1 error, interpret 20 ok, narrate 22 ok. Jobs: 41 succeeded, 1 failed. The failed job was Odo's round 2 act after `act-hold`: the director queue was exhausted (`stopped at director: gateway`), as expected at the end of a script.

## Defects found while rehearsing

- The repo `local-table.mjs act` declares `scope: "character"` only. A spell cast by Odo needs a party-scope action (spec 079 D5). The rehearsal used a local copy with the scope as a variable. See Open questions.
- Each encounter runs once per session. A script that touches Snag in free mode (the pull) must use a second scene start for the fight rows.
- A scripted call is consumed per turn in order. Overlapping drivers consume the queue out of order and fail with `invalid-output` at interpret. Run one driver at a time.
- A human who does not act when the order reaches them is passed as absent; the next scripted call then runs for the companion. The script holds one extra `dm.companion` call for Odo's second-round turn.

## Open questions

- Add a `--scope party` option to `.claude/skills/playtest-run/scripts/local-table.mjs act`, so the operator can declare the Odo spell rows. The operator plays in the browser (the Party control), so the real run does not need it. `.claude/` was not edited.
- The playtest-run SKILL.md section 8 names only runbook A. Add runbook B's seed, script and checklist there.
