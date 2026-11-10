# R1 lane playtest — 2026-11-10

- **Environment:** hosted dev `https://vm-104.tailb3c1b6.ts.net:8443`, commit `ec9fe23c` (includes TASK-0267 planner, TASK-0245 fact sheet, TASK-0274 encounter state, TASK-0271 fog, TASK-0306 engaged-only ranged).
- **Seed:** `greyhollow-ford` (solo). Tamsin Vale human (operator account), Brother Odo and Kestrel AI companions. Session `86abad65-f06b-4ff3-9b22-c9b2904e5220`.
- **Card under test:** TASK-0278 (R1 metrics). **Ceiling:** $15, "$15, I've signed in".
- **Driving:** Playwright over a debug-port Brave window; turns posted over the page's own websocket. The operator signed in once and played no turns by hand.
- **Merged since last run:** #156 TASK-0267, #157 TASK-0245, #158 TASK-0274, #159 TASK-0271, #161 TASK-0306.

## Metrics against R1 targets

| metric | R1 target | baseline (2026-11-09) | this run |
|---|---|---|---|
| Commit → first engine row | p95 < 1 s | median 20 s, p95 73 s | median 43 s, p95 80 s (n=12) |
| Commit → narration | p50 first token < 10 s | median 45 s | median 60 s, p95 179 s (no streaming) |
| Combat round, 7 actors | < 60 s | 232–417 s | 404 s, 278 s (rounds 1–2); per turn median 57 s |
| Fallback narrations | 0 | 3 | 0 |
| Attempt-1 schema failures | < 1% | 0.83% (2/240) | 0.9% (1/111, dm.companion invalid-json) |
| Encounter ends | yes | not reached | **yes** — ended at seq 195 after a negotiated trade (12 min fight) |

Latency is worse than baseline. Expected at this point: the fact sheet adds composition work and the planner is not yet in the turn path (TASK-0268, TASK-0269), and nothing streams (TASK-0298).

## Findings

| # | Time | Seat | Class | Observation | Existing card | Card |
|---|------|------|-------|-------------|---------------|------|
| 1 | every narration | all | bug | Players see raw slot labels `restate:` `describe:` `ask:`. The model writes `label:` but `parseSlots` only accepts `[label]`, so the reply lands in describe with its labels, the restate slot is empty, and the code fallback "Tamsin Vale means to: …" is prepended (the action is said twice). The ask slot still prompts the player to act on routine turns. | TASK-0245 (Done) | TASK-0307 |
| 2 | seq 1–196 | Tamsin | positive | No refusals at all. Every Tamsin action resolved; TASK-0302's fix holds. | TASK-0302 | evidence |
| 3 | seq 195–196 | all | positive | The encounter ended in code (R1 exit 6): Odo offered a trade, the Director closed the fight, and the table returned to free mode. Goblins were not all down. | TASK-0274 | evidence |
| 4 | all State lines | all | positive | No State line contains `?`; each names whose move it is (TASK-0245 AC #6). | TASK-0245 | evidence |
| 5 | seq 4, 56 | — | positive | Fog: `zone.revealed` reset at scene start and a reveal as the party reached the reed camp. Player-view secrecy not checked (operator account only). | TASK-0271 | — |
| 6 | combat | all | rules/DM quality | Combat stayed a melee pair (goblin-3, tamsin) at the end; Kestrel's ranged shots rolled normal while unengaged (TASK-0306 behaving). | TASK-0306 | evidence |

## Run summary

- **Spend:** $2.59 of the $15 ceiling.
- **Checklist:** encounter ends — pass; fallbacks — pass; schema attempt-1 — pass; latency rows — fail (expected before TASK-0268/0269/0298).
- **New cards:** TASK-0307 (slot labels). **Evidence added:** TASK-0302, TASK-0274, TASK-0245, TASK-0306.
- **Not checked:** a player-seat view of fog (needs a second, non-operator account); the auditor (needs a vm-104 DB read).
