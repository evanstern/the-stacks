# Automated combat smoke run — 2026-11-14 (hosted)

- **Environment:** hosted dev `https://vm-104.tailb3c1b6.ts.net:8443`, commit `014f1ae6` (current: origin/main is ahead only by board commits). Includes TASK-0336 and TASK-0337 fixes (PRs #180, #181).
- **Seed:** `greyhollow-ford` (solo). Tamsin Vale is the operator account; Brother Odo and Kestrel are AI companions. Session `8c7d506e-43a0-48e6-a60c-8b1f3d3493b8`.
- **Card under test:** TASK-0338, AC #1 and #2; metrics for TASK-0278. **Ceiling:** $15, "$15, same as last".
- **Driving:** fully scripted, no human input. Playwright over the debug-port Brave page (CDP 9333) sends the composer's own websocket frames (`~/.cache/stacks-sweep/pw/`). The operator signed in once.
- **Played:** scene start; `/move #causeway`, `/move #reed-marsh`, `/move #reed-camp` (each 👍 on the DM's confirm row); one call-out line started the fight (seq 66); combat rounds 1–3 in full, stopped at the start of round 4 (seq 282) to save spend.
- **Rehearsal:** `docs/playtests/2026-11-14-combat-smoke-rehearsal.md` (local stack, `DM_FAKE_SCRIPT=runbook-b2-reed-camp`).

## Metrics against R1 targets

| metric | R1 target | lane run (2026-11-10) | this run |
|---|---|---|---|
| Commit → first engine row (human Intents) | p95 < 1 s | median 43 s, p95 80 s | **0 ms** for all 10 typed Intents (3 move, 4 attack, 3 end_turn): rows land in the same write |
| Commit → first engine row (AI companion turns) | — | — | median 11.1 s, max 14.7 s (n=6; companion model call before the commit) |
| Commit → first narration token | p50 < 10 s | median 60 s (no streaming) | **firstToken p50 0.90 s** (max 1.44 s); firstProse p50 3.93 s (n=24) |
| Combat round, 7 actors | < 60 s | 404 s, 278 s | r1 104 s; r2 289 s raw, **101 s** without the 188.5 s driver stall (see F8); r3 95 s |
| Per-turn time | — | median 57 s | goblins 0.1–14 s; Kestrel 31–37 s; Odo 22–32 s; Tamsin 6–33 s (scripted) |
| Fallback narrations | 0 | 0 | **0** |
| Attempt-1 schema failures | < 1% | 0.9% (1/111) | **4.1% (2/49)**, both `dm.narrate` confirm items (F3); both passed on attempt 2 |
| Encounter ends | yes | yes | not reached (stopped after round 3 by design; Tamsin 4/13 hp, Snag and goblin-3 down) |
| Spend | ceiling $15 | $2.59 | **$1.14** |

Reading: the R1 spine meets the engine-row target for typed Intents and the first-token target. Round time is now dominated by the two AI companions (about 60 s per round between them). It no longer comes from the DM.

## Findings

| # | Time (UTC) | Seat | Class | Observation | Existing card | Card |
|---|------|------|-------|-------------|---------------|------|
| 1 | 02:03 | Tamsin | positive | Each `/move` stage was narrated after the 👍 (seq 24, 35, 46). The TASK-0337 fix holds on hosted. | TASK-0337 | evidence |
| 2 | 02:12 | all | positive | Typed `/attack` and `/end` settle in code with the engine rows in the same write (0 ms). The `ranged-attacks-in-close-combat` rule applied disadvantage while engaged. | TASK-0269, TASK-0306 | — |
| 3 | 02:10, 02:11 | DM | bug | `dm.narrate` (dm.react-v6) confirm items carry made-up `params` keys (`skill`; `ready`, `caution`) on a `move` body. Schema mismatch on attempt 1 twice; attempt 2 passed. Pushes attempt-1 failures to 4.1%. | TASK-0336 (Done; fixed targets, not params) | TASK-0347 |
| 4 | 02:04 | Tamsin | bug | The second `/move` stage (seq 26) queued no DM read. `capReached` counts DM narrations since the last human *transcript* row, and a text-less declared Intent adds none, so after two narrations the read is swallowed. Workaround: post a speech line. A player walking stage by stage stalls. | — | TASK-0348 |
| 5 | 02:12 | Tamsin | bug | Two `/attack` Intents settled in one Tamsin turn (seq 80, 85). Hosted observation of the known action-economy gap (AC #2, NO_ACTION_LEFT). | TASK-0304 | evidence |
| 6 | 02:12 | — | rough edge (driver) | A free-mode `/move` is only declared until the 👍 on the DM's confirm row (`action.accept`). An attack does not end the turn; `/end` does. The driver now does both (`accept.sh`, `loop.sh`). | — | none (driver) |
| 7 | — | — | rough edge (tooling) | No shipped DM script exercises the Intent path (`/attack`, `/move`); the rehearsal proves prose declare/commit only. b2 is two-human: Kestrel's act-scan must post from a second seat. | — | TASK-0349 |
| 8 | 02:14 | Tamsin | rough edge (driver) | Round 2: Tamsin's turn held 188.5 s after the attack narrated (seq 161, 02:14:31). `turn.sh` ran to its 180 s wait limit before the loop sent `/end` (seq 165, 02:17:41). Driver artifact, not app latency. `loop.sh` now logs `turn.sh` to a file, and round 3 ran clean (Tamsin 6.4 s). | — | none (driver) |
| 10 | 02:12, 02:19 | Tamsin | bug | `deeds-narrated` and `dice-lines` fail when a player acts while the previous NPC narration is still streaming (seq 80 vs narration 81; 239/242 vs 243). The deed is told in the next narration, so no deed goes untold, but the segment's narration names the wrong deeds and dice. Either the auditor should segment by the narration's facts window, or a deed posted mid-narration should be held. | TASK-0337 (Done) | TASK-0350 |
| 9 | — | — | rough edge (tooling) | The strict scripted DM desyncs on leftover or retried jobs; a rehearsal needs a fresh stack per run. playtest-run section 3 does not say so. `PW_ACTION_ID` is needed to match scripted action ids. | — | TASK-0349 |

## Run summary

- **Session:** `8c7d506e-43a0-48e6-a60c-8b1f3d3493b8`. **Commit:** `014f1ae6`.
- **Spend:** $1.14 of the $15 ceiling (no 50% warning reached).
- **AC #1:** met. A script-driven hosted run played three full combat rounds with no human input; the metrics table above is filled in.
- **Auditor:** `node dist/playtest/cli.js audit --session 8c7d506e-… --auditor none` in `stacks-dev-app-1` (operator go, "Go, run audit"). Verdict **fail**: 25 segments, 8 fails, 1 note. Prose-digits, life-states, roll-reasons, hidden-info and dice-language all passed. `deeds-narrated` failed 3 (seq 80, 239, 242), and `dice-lines` failed 5 (seq 81, 86, 88, 243, 252). F1 (note) is the narrate check's own fogged-zone correction at seq 15.
- **AC #2 (`deeds-narrated`):** **not met.** Every deed was told, but one narration late: deeds 80/85 → narrations 86/88, 92 → 100, 159 → 161, 165 → 174, 239/242 → 252. Each flagged deed was posted while the previous NPC turn's narration (81, 243) was still streaming. The auditor gives the deed to that in-flight narration's segment, and the dice-lines failures are the same shift. Finding 10 and TASK-0350 track it. The AC stays open until a rerun passes or the operator rules the check wrong.
- **New cards:** TASK-0347 (confirm params keys), TASK-0348 (chain cap after a declared Intent), TASK-0349 (scripted-DM rehearsal coverage), TASK-0350 (deed told one narration late). **Evidence added:** TASK-0304. Driver fixes (F6, F8) live in `~/.cache/stacks-sweep/pw/` and need no card.
