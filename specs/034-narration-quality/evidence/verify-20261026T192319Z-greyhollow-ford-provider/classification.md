# Classification: verification rerun 20261026T192319Z (TASK-0106, Phase 5b, T057)

**Run**: composite `3ae5a54` (origin/task-0048-playtest `a99ddd8` + this branch at the Phase 4b
tip). `dm.narrate` maxTokens 1500. Outcome `stalled`, `stallReason: seat-exhausted`, 11 moves,
no failed job. Spend $5.37 over 235 calls of the $25 ceiling.

**Verdict: FAIL on card AC #4 (fallback rate only).**

| Measure | Run 5 | Verify 1 | This run | Bar |
|---|---|---|---|---|
| Fallback rate, seat-fallback turns excluded | 7/14 (0.50) | 12/34 (0.35) | 4/22 (0.18) | ≤ 0.10 ✗ |
| Fallback rate, all turns | 23/39 | 13/38 | 6/27 (0.22) | reported |
| `hidden-info-leak` fails | 6 | 0 | 0 | 0 ✓ |
| `ledger-contradiction` fails (narration-caused, operator ruling) | 5 | 3 (0 narration-caused) | 0 | 0 ✓ |
| `player-agency` fails | 1 | 4 | 3 | operator ruling |

E1 is mostly fixed: 2 of 51 `dm.narrate` calls still stopped at the 1500 cap (verify 1: 17 of
79 at 500), and 10 calls used 500 or more, so the old cap would have cut them. One attempt
(seq 201, attempt 2) was empty.

## The 6 fallback turns

| Seq | Seat-only | Blocking issues on all 3 attempts | Cause |
|---|---|---|---|
| 77 | no | digits ×3 | R1 |
| 140 | no | digits ×3 | R1 |
| 162 | no | digits; player-agency + ledger-mismatch on a failed death save (Tamsin at 0 HP narrated as aware) | R1, R2 |
| 130 | no | invented-mechanics (a near-miss with no miss fact) + player-agency (heat on Tamsin's face) | R3 |
| 201 | yes | player-agency: the seat's "offer a fair trade" while Tamsin is down; the narrator says she cannot speak | R2 |
| 216 | yes | player-agency: the seat's "ready my sword" while Tamsin is down | R2 |

- **R1, digits in prose (3 of 4 non-seat fallbacks).** The deterministic check `The prose contains
  digits` failed every attempt. Its detail does not quote the match, so the source is unknown.
  Combatant names hold no digits. Fix first: the check quotes the matched text (as the
  death-word check now does). Then fix the source.
- **R2, the scripted seat acts for an unconscious hero.** After Tamsin dropped to 0 HP, the seat
  kept declaring trade and sword moves. The narrator correctly shows she cannot; the auditor calls
  that player-agency. This is a harness and engine question (should an unconscious character's
  declared action be refused before narration?), not a narration defect.
- **R3, the narrator invents a near-miss** (one turn). Narrate-v3 covers misses; this one had no
  miss fact at all.

## The 3 playtest-auditor player-agency fails

| Finding | Detail | Classification |
|---|---|---|
| F1 | Scene-start narration: "Tamsin Vale leads the way up from the bank" | Narrator moves the hero at scene start. Real. |
| F6 | "Tamsin twists just enough" on a recorded miss | An E3 breach the v3 rule did not prevent. Real. |
| F7 | "Brother Odo steps forward, weighing the line of goblins" | Odo is an AI companion; the playtest auditor treats him as a player's hero. Auditor scope question. |
