# Automated combat smoke retest — 2026-11-15 (hosted)

- **Environment:** hosted dev `https://vm-104.tailb3c1b6.ts.net:8443`, commit `058f831c` (wave 2b: PRs #186 TASK-0350, #187 TASK-0347, #188 TASK-0348). The re-audit ran at `6141feed` (TASK-0355, PR #190).
- **Seed:** `greyhollow-ford` (solo). Tamsin Vale is the operator account; Brother Odo and Kestrel are AI companions. Session `6031b671-da08-4336-b7ab-058dcedb4939`. Started 12:30 UTC.
- **Card under test:** TASK-0338, AC #2; metrics for TASK-0278. **Ceiling:** $15, "$15, same as last".
- **Driving:** fully scripted. Playwright helpers in `~/.cache/stacks-sweep/pw/`, backed up to `pw/bak-2026-11-15/`. The helpers `0338/hr.sh`, `stage-r.sh` and `waitn-r.sh` are retest copies that point at the `0338/retest` state.
- **Played:** `/move #causeway`, `/move #reed-marsh`, `/move #reed-camp` (each 👍, seq 19–44, narrated at seq 25, 35, 44); one call-out line (seq 47) started the fight (`encounter.started`, seq 64); `loop.sh` (started with a 4-turn limit) played 3 Tamsin turns (attack Snag, then `/end`) for rounds 1–3, then timed out (F6).

## Metrics against R1 targets

| metric | R1 target | 2026-11-14 run | this run |
|---|---|---|---|
| Commit → first engine row (typed Intents) | p95 < 1 s | 0 ms | **0 ms** for 7 typed Intents (move 42, attacks 139/187/231, end_turn 150/199/240: all 0.00 s) |
| Commit → first narration token | p50 < 10 s | 0.90 s | **firstToken p50 1.05 s**; firstProse p50 4.10 s (n=562) |
| Combat round | < 60 s | 95–104 s | r1 214 s (Kestrel 40 s, Odo 25 s, goblin-3 98 s); r2 81 s; r3 70 s. Then the party was down |
| Per-turn time (r1 / r2 / r3) | — | — | Kestrel 39.9 s (r1, dead after); Odo 25.1 s (r1, unconscious after); Tamsin 27.0 / 24.5 / 11.5 s; goblin-3 98.1 / 18.8 / 20.9 s; goblin-4 10.2 / 19.1 / 19.3 s; Snag 6.4 / 11.5 / 9.7 s; goblin-2 7.3 / 6.8 / 8.5 s |
| Fallback narrations | 0 | 0 | **0** |
| Attempt-1 schema failures | < 1% | 4.1% | **0.0% (0/576)**; `check.stripped` 0. Exit 5 met: TASK-0347 holds |
| Encounter ends | yes | not reached | **no**: the party was down by round 3 and the encounter never ended (F1) |
| Spend | ceiling $15 | $1.14 | **$10.60** (576 calls); about $8 in the runaway loop |

Reading: the typed-Intent engine row and the first-token targets hold, and attempt-1 schema failures fell to 0%. Round time is still over 60 s (exit 3), so TASK-0321 is next. The run exposed a larger fault: all three PCs went down by round 3, the encounter never ended, and AI-DM monster turns ran for over an hour (F1).

## Findings

| # | Time (UTC) | Seat | Class | Observation | Existing card | Card |
|---|------|------|-------|-------------|---------------|------|
| 1 | 13:35 | all | bug (high) | All three PCs down by round 3: Odo unconscious seq 119, dead 237; Kestrel unconscious 131, dead 196; Tamsin unconscious 261, stable 328. The encounter never ended. AI-DM monster turns ran on, about one every 6 s, 500+ rounds, events to seq 2569, for over an hour. `/pause` returned `DM_SEAT_REQUIRED`, and no seat could take the DM. The operator stopped it at 13:35 with a DB update (C9): `UPDATE jobs SET status='failed' ... WHERE session_id=... AND status IN ('queued','running')`, 2 rows. | — | TASK-0354 |
| 2 | — | — | bug (high) | The export capped jobs at 500; the session had 577. The first hosted audit lost the oldest `factsThrough` windows and failed `deeds-narrated` at seq 231 and 240 (both told by the next narration). Fixed in PR #190; the re-audit passes `deeds-narrated`. | — | TASK-0355 (Done) |
| 3 | — | DM | bug | `dice-lines` fails at seq 158, 206, 248. The count matches the ledger, but the order differs (attack first, death saves after). | — | TASK-0356 |
| 4 | — | DM | bug | `life-states` 31 fails. Prose calls alive goblins dead (seq 266, 277, 292, then Snag repeatedly), mostly inside the F1 loop. The runtime narrate check did not catch them. | — | TASK-0357 |
| 5 | — | Tamsin | positive | Every `/move` stage was narrated after the 👍 (TASK-0337 and TASK-0348 hold). Typed `/attack` and `/end` settle in the same write. | TASK-0337, TASK-0348 | evidence |
| 6 | — | — | rough edge (driver) | `loop.sh` timed out waiting for Tamsin once all PCs were down (round 24). Expected given F1. | — | none (driver) |

## Run summary

- **Session:** `6031b671-da08-4336-b7ab-058dcedb4939`. **Commit:** `058f831c` (re-audit at `6141feed`).
- **Spend:** $10.60 of the $15 ceiling, 576 calls. About $8 went to the F1 loop.
- **AC #1:** met by the 2026-11-14 run. This run reached round 3 and then the party was down.
- **Auditor (both runs):**
  - First run (C9 go, operator ran it, 13:36 UTC, at `058f831c`): verdict **fail**. `deeds-narrated` 2, `dice-lines` 5, `life-states` 32, `dice-language` 4, notes 4. Report `/app/apps/server/.playtests/20261115T133559Z-session-6031b671/report.json`.
  - Re-audit (C9, operator "Go, run audit", at `6141feed`): 577/577 jobs exported. Verdict **fail**. `deeds-narrated` 0, `dice-lines` 3 (F3), `life-states` 31 (F4), `dice-language` 4 (seq 547, 582, 1977, 2012, all in the loop). 6 notes: seq 15 leak/fogged-zone, seq 25 leak/absent-actor, 4 contradiction/dice-language in the loop. Report `/app/apps/server/.playtests/20261115T213727Z-session-6031b671/report.json`.
- **AC #2 (`deeds-narrated`):** **met.** The re-audit shows 0 failures.
- **New cards:** TASK-0354, TASK-0355 (Done), TASK-0356, TASK-0357. Round time (exit 3) is still over 60 s; TASK-0321 is next.
