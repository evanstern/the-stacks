# R1 baseline playtest run 1 — 2026-11-08

- **Environment:** hosted dev `https://vm-104.tailb3c1b6.ts.net:8443`, commit `25ea6bc8`.
- **Seed:** `greyhollow-ford` (solo; same reed-camp encounter). Operator plays Tamsin Vale. Brother Odo and Kestrel are AI companions (the R1 demo shape: one human plus companions).
- **Card under test:** TASK-0278 (baseline for R1 exit criteria 1-6). **Ceiling:** $25, "$25".
- **Merged since last run:** #145 TASK-0231, #146 TASK-0138, #147 TASK-0266 (no play-visible change).

Classes: bug, rough edge, missing feature, rules/DM quality, positive.

## Checklist

| id | item | source | status | note |
|----|------|--------|--------|------|
| TASK-0165 | Verify what TASK-0165 changed | merged since last run | not reached | rolled forward (was not reached) |
| TASK-0177 | Verify what TASK-0177 changed | merged since last run | not reached | rolled forward (was not reached) |
| A-noncombatant-attack | Combat: an attack on Pell is still refused | TASK-0194 | not reached | rolled forward (was not reached) |
| B-attack-before-encounter | Before the encounter starts, Kestrel types "I take aim and shoot at Snag." The attack resolves and Snag joins the order. The DM does not refuse it. | TASK-0206 | not reached | rolled forward (was not reached) |
| B2-failed-reveal | Free mode. Kestrel types "I scan the reeds for anyone watching the camp." Read the ledger for the Perception band. On a failure band, Pell stays unrevealed: the prose shows no Pell, and no scene-presence arrival row names him. On a success band, record that Pell appears and the reveal waited for the dice. | TASK-0237 | not reached | solo seed run; no Perception reveal attempted. |
| R1B-fact-latency | For each committed player action in combat, record the time from commit to the first engine ledger row (the R1 exit 1 baseline; target p95 under 1 s). | TASK-0278 | fail | baseline: commit to first engine row median 20.0 s, p95 73.1 s, min 13.1 s (n=20). Target p95 under 1 s. |
| R1B-first-narration | For each turn, record the time from commit to the narration post (no streaming exists yet, so this is time to full narration; R1 exit 2 baseline, target p50 first token under 10 s). | TASK-0278 | fail | baseline: commit to full narration median 45.4 s, p95 107.5 s (n=20). No streaming. Target p50 first token under 10 s. |
| R1B-round-time | Play at least one full combat round with every PC, companion and monster acting. Record the round's wall time (R1 exit 3 baseline, target under 60 s). | TASK-0278 | fail | baseline: 7 actors (4 goblins, 3 PCs); complete rounds 303, 414, 417, 232 s; per turn median 41 s, max 170 s. Target under 60 s. |
| R1B-fallbacks | Count audit-regenerate fallback lines in the narration (R1 exit 4 baseline, target zero). | TASK-0278 | fail | baseline: 3 fallback lines ('Tamsin Vale cannot do that here', seq 123, 278, 322), all from TASK-0302 refusals. |
| R1B-schema-attempt1 | Count attempt-1 invalid-json, schema-mismatch and truncated outcomes per purpose over the run (R1 exit 5 baseline, target under 1%). | TASK-0278 | pass | baseline: 2 of 240 attempt-1 calls not ok = 0.83% (target under 1%): 1 dm.interpret truncated at the old 4000 cap, 1 dm.audit invalid-json. |
| R1B-encounter-end | Record whether the encounter can end, and whether a fled combatant is dropped (R1 exit 6 baseline). | TASK-0278 | not reached | combat stalled in round 5: the human PC's attacks were refused (TASK-0302), so the goblins were never all down. |
| TASK-0278-AC1 | TASK-0278 acceptance criterion #1 | card under test | pending | baseline recorded; AC1 (auditor reports latency metrics) is built in R1. |
| TASK-0231 | Verify what TASK-0231 changed | merged since last run | pass | wiki-only; no play change |
| TASK-0138 | Verify what TASK-0138 changed | merged since last run | pass | test-only; no play change |
| TASK-0266 | Verify what TASK-0266 changed | merged since last run | pass | package not wired into play yet |

## R1 metrics (baseline)

| metric | R1 target | baseline | source |
|---|---|---|---|
| Commit → first engine row | p95 < 1 s | median 20.0 s, p95 73.1 s, min 13.1 s (n=20) | events ts |
| Commit → narration | p50 first token < 10 s | full narration median 45.4 s, p95 107.5 s (no streaming) | events ts |
| Combat round, 7 actors | < 60 s | 303, 414, 417, 232 s (rounds 1-4); per turn median 41 s, max 170 s | turn.advanced ts |
| Fallback narrations | 0 | 3 (all TASK-0302) | narration text |
| Attempt-1 schema failures | < 1% | 2 / 240 = 0.83% | calls ledger |
| Encounter ends / fled dropped | yes | not reached (combat stalled, TASK-0302) | — |

## Findings

| # | Time | Seat | Class | Observation | Existing card | Card |
|---|------|------|-------|-------------|---------------|------|
| 1 | seq 45-51 | Tamsin | rough edge | Shooting the lookout before the camp was revealed was refused UNKNOWN_COMBATANT; the narration carried on without the shot. The monster joined combat later (seq 69). | TASK-0238 (Done) | — |
| 2 | seq 117-124 | Tamsin | bug | On her own turn, 'I shoot the wounded goblin lookout' was refused STEP_ACTOR_MISMATCH: interpret set attackerId to the player's user id, not 'tamsin'. Her turn was spent and a fallback line shipped. Recurred at seq 216, 271, 316 (4 of 5 combat actions). Combat stalled. | — | TASK-0302 |
| 3 | seq 64-85 | Tamsin | positive | Opening shot pulled all four goblins into an encounter and rolled initiative in one batch; the ledger was correct. | — | — |
| 4 | rounds 1-4 | all | rules/DM quality | AI turns are the bulk of round time: 13-55 s each, mostly model calls; the DM and companions acted legally and the audit passed them. | TASK-0299 | evidence |

## Run summary

- **Session:** `3406d9ae-8604-4063-81a7-8cbd6d636cec`. **Commit:** `25ea6bc8`. **Spend:** $5.25 of the $25 ceiling ("$25").
- **Checklist:** pass 4, fail 4, not reached 6, pending 1.
- **Blockers:** TASK-0302 (new): the human PC's attacks are refused, so solo combat cannot finish.
- **New cards:** TASK-0302. **Evidence added:** TASK-0302 recurrence; TASK-0278 baseline numbers.
- **Driving:** Playwright over a debug-port Brave window (operator signed in once); turns posted over the page's own websocket. Operator played no turns by hand.
- **Auditor:** not run — the hosted audit needs the vm-104 database (C9); deferred to CP-7 with the R1 scenario.

## Verification run — TASK-0302 (2026-11-09, after #152 and #153 deployed)

- **Session:** `b9898b7f-28d7-4223-ba2e-6cb5b528e294`, vm-104 at `a0049104` (includes TASK-0302 fix `aec294a4`). Solo seed `greyhollow-ford`, Tamsin human, Odo and Kestrel AI. Driven by Playwright.
- **Result:** 0 of 4 Tamsin combat actions refused `STEP_ACTOR_MISMATCH` (baseline: 4 of 5). Tamsin's attacks resolved at seq 55, 72, 102, 113, 163. One combat action (`act-d5156758`, "I shoot the nearest goblin") resolved `no-effect` with a clarify question ("which goblin is nearest?") because two goblins were plausible. That is a legitimate clarification, not the bug.
- **Normalizer:** the vm-104 app log shows no `dm.interpret.seat-actor` line, so the prompt-label fix alone kept user ids out of the model's output.
- **Attempt-1:** 1 of 97 calls not ok (a `dm.interpret` schema-mismatch). **Spend:** $2.08 this run; $7.33 of the $25 ceiling in total.
