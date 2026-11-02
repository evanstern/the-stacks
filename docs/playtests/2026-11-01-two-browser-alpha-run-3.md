# Two-browser alpha playtest run 3 — 2026-11-01

- **Environment:** hosted dev `https://vm-104.tailb3c1b6.ts.net:8443`, commit `84b130a0` (freshness verdict: current).
- **Seed:** `greyhollow-ford-duo`. The operator plays both seats (Tamsin and Kestrel) from two Brave windows; Brother Odo is an AI companion.
- **Card under test:** TASK-0163, AC 4. **Ceiling:** $50, "maybe cap it at $50 and if that causes any issues we can scale down" (operator, 2026-10-28, on TASK-0163).
- **Merged since last run:** #91 TASK-0181 (think-block strip), #92 TASK-0182 (plan first stage), #95 TASK-0180 (talk triggers), #84 TASK-0167, #85 TASK-0165, #89 TASK-0177, #96 TASK-0186 (this skill). Done: TASK-0052, 0165, 0167, 0176, 0177, 0180, 0182.
- **Rehearsal:** the local rehearsal on 2026-11-01 (`docs/playtests/2026-11-01-playtest-run-skill-rehearsal.md`, TASK-0186) exercised this flow at `7d9d8518` with `greyhollow-talk`. #91, #92 and #95 each had a Brave live check in their PRs. Not repeated for run 3; the operator may ask for one.

Classes: bug, rough edge, missing feature, rules/DM quality, positive.

## Checklist

| id | item | source | status | note |
|----|------|--------|--------|------|
| TASK-0163-AC4 | TASK-0163 acceptance criterion #4 | card under test | pass | Two accounts played the duo seed on hosted dev through combat to the scene goal |
| TASK-0180 | Verify what TASK-0180 changed | merged since last run | pass | Talk turn ran on Odo's line to Wenna; she replied (finding 8) |
| TASK-0182 | Verify what TASK-0182 changed | merged since last run | pass | Compound declaration cut to the talk; stealth held as followUp (finding 6) |
| TASK-0181 | Verify what TASK-0181 changed | merged since last run | pass | No invalid-json on director/interpret/narrate; 2 haiku retries recovered (finding 5) |
| TASK-0165 | Verify what TASK-0165 changed | merged since last run | not reached | No human DM seat this run |
| TASK-0167 | Verify what TASK-0167 changed | merged since last run | pass | Start scene gone once the start was queued |
| TASK-0177 | Verify what TASK-0177 changed | merged since last run | not reached | No human DM seat this run |
| base-signoff | Group sign-off | baseline | fail | Works mechanically, but sign-off has no teeth (finding 2, TASK-0188) |
| base-floor | Floor passing and absence (30 s, 120 s) | baseline | pass | 30 s absence (finding 14) and 120 s stall (finding 18) both passed |
| base-companion | Companion reacts | baseline | pass | Odo replied after each beat; one reply misnamed the addressee (finding 3) |
| base-combat | Combat: initiative, a downed hero, ending the encounter | baseline | pass | Initiative, kills, NPC turns, flight, encounter end (findings 9, 16, 17); no downed hero |
| base-dmquality | DM quality spot checks | baseline | pass | Spot-checked throughout; issues carded (findings 3, 4, 13, 15, 20) |
| base-debug-retry | Debug page and Retry | baseline | pass | Debug page read; Retry re-ran a failed turn (finding 11) |

## Findings

| # | Time | Seat | Class | Observation | Existing card | Card |
|---|------|------|-------|-------------|---------------|------|
| 1 | scene start | operator | rough edge | On a wide window the transcript runs edge to edge (about 2200 px of text) and is hard to read. The operator mocked a fix in devtools: constrain the text column to 1024 px and center it. Session `e8e8326d-0344-4fac-a4d4-3e4bcd82e2d5`. Opening narration arrived and reads well; it introduces the PCs and the ford (compare run 1 item 4). | None found | TASK-0187 (new, medium, m-3) |
| 2 | seq 16–25 | both | missing feature / rough edge | Group sign-off has no teeth. The declarer can commit at once; Approve and Object stay disabled until a comment is typed; an objection does not block Commit. Tested on act-4c4727e0 (approve, object, approve, object, then withdrawn). Operator proposes one chat stream: in character is an action, out of character is table talk, `@dm` flags the DM; chat stays a view over the event log so a VTT can drive the same events. Also: every IC line this run was posted as an Action, so TASK-0180's talk path never ran. | TASK-0131, TASK-0129 (Ask the DM), TASK-0072 (VTT) | TASK-0188 (new, high, m-3; design round) |
| 3 | seq 31–36 | Tamsin | rules/DM quality | Tamsin: "Odo, are you here?" Odo answered "I'm here, Wenna, …" (dm.companion-v5), addressing the NPC in the loft instead of the PC who asked. His earlier line (seq 27) named Tamsin correctly. | TASK-0144, TASK-0172 (nearby) | TASK-0189 (new, medium, m-3) |
| 4 | seq 39 | both | rough edge | NPC dialogue inside narration is hard to pick out: one italic, muted paragraph. Wanted: set spoken lines apart (font, color, size, or novel/script layout). | TASK-0133 (nearby) | TASK-0190 (new, medium, m-3) |
| 5 | through seq 41 | — (ledger) | positive / evidence | 21 calls, $0.33 of $50. Every turn succeeded on its first job attempt. 2 of 21 calls returned invalid-json on attempt 1 (dm.chronicle-v3, dm.audit-v3, both haiku) and recovered on attempt 2. Director, interpret and narrate were clean. Wenna's answer (seq 39) gave a real lead: something small and clawed took the clapper; Pell followed and has not returned. | TASK-0181 | Evidence added to TASK-0181 |
| 6 | seq 42–48 | Tamsin | positive | TASK-0182 worked. "I will talk to Wenna … and then we will use stealth to scout ahead" was cut to its first stage: interpret kept the talk, recorded the stealth as a followUp ("The party moves stealthily along the causeway …"), and the Director held a tracker advance ("held: the plan was cut to its first stage"). Wenna answered with directions (rotten third timber, keep left, mud island, a lookout) and handed the scouting back to the players. Hard to see from the table, though: nothing tells the player the stealth part is still pending (outcome reads "no-effect"). | TASK-0182, TASK-0132 | Evidence; visibility folded into finding 7 |
| 7 | seq 47 | both | rough edge | Every resolved action card reads "Outcome: no-effect", even when the beat produced a reply, a lead or a held follow-up. Players can't tell what an action did. | TASK-0132 (progress), TASK-0188 (chat redesign) | Evidence added to TASK-0188 |
| 8 | seq 49–52 | — (DM) | positive | TASK-0180's talk path ran for the first time on hosted dev: Odo's IC line to Wenna (seq 49) queued a `talk` turn; code and model both found `addressed: wenna`; Wenna replied (seq 52) with three brass rings and a warning. One model call. | TASK-0180 | Evidence |
| 9 | seq 70–117 | both | positive | Stealth roll (nat 1, total 6 vs DC 13) failed; the lookout raised the alarm; initiative rolled for 8, encounter started, table moved to turn mode. Kestrel's charge hit (23 vs AC 12) and killed the lookout; the turn passed to Tamsin. Combat entry works end to end with a real model. | — | Evidence |
| 10 | combat | operator | rough edge | Once the chat grows, the header scrolls away, so the turn order is not visible during combat. | TASK-0187, TASK-0164 (nearby) | TASK-0191 (new, high, m-3) |
| 11 | ~04:18Z seq 118–123 | Tamsin | bug, blocker | "I run to Pell and attempt to free him" failed at interpret on every attempt ("The DM runtime stopped at interpret: invalid-output"). Each failed call returned exactly 1200 output tokens, the dm.interpret maxTokens: hidden thinking spends the whole budget on harder (combat) prompts and no JSON is emitted. Free-mode interpret calls used ~200 tokens. | TASK-0181 | Evidence added to TASK-0181 (AC #1 cause) |
| 12 | ~04:20–04:27Z seq 124–137 | — (floor) | positive / evidence | While interpret was failing, the absence/floor path ran: Tamsin's turn passed (floor marker, seq 126–128) to the goblins; after the operator's fix (dm.interpret maxTokens 1200 → 4000, redeploy b481e308) the next turn job ran. Goblin-2 attacked Tamsin (14 vs AC 16, miss) and the turn advanced to Odo. Floor passing and NPC turns work with a real model. | TASK-0181 | TASK-0192 (new, high: maxTokens headroom + a distinct truncated outcome) |
| 13 | seq 133 | Tamsin | rules/DM quality | "I run to Pell and attempt to free him" resolved **refused, UNKNOWN_COMBATANT**: the plan named Pell, a captive NPC who is not a combatant, so the plan gate refused the whole action. The narration still describes Tamsin reaching the post. Freeing a captive should be a legal non-combat step during an encounter. | dm-failure-and-gates (plan gate) | TASK-0194 (new, high, m-3) |
| 14 | 04:28:56–04:29:27Z seq 161–163 | Kestrel (window closed) | positive | 30 s absence test passed. Kestrel's window closed on Kestrel's turn (round 2); the absence floor job armed at 04:28:56 and ran at 04:29:27, the floor marker shows only Tamsin's player present, and the turn passed to Tamsin. Working as designed; the operator read it as a skipped turn because nothing on screen says why the turn moved. | TASK-0191 (turn order visible), TASK-0188 | Evidence; "why the turn passed" folded into TASK-0193's notes |
| 15 | seq 148–158 | — (DM) | rules/DM quality | Two NPC turns shipped code fallbacks after the audit refused prose that narrated ahead of the turn: "Odo offers Snag silver … Goblin by the fire moves next." (raw roll line repeated) and "Snag makes a move. Kestrel moves next." Snag's turn had no mechanical step at all, so the line says nothing. Odo's Persuasion (20+3 = 23 vs DC 17) did succeed and the fire-goblin hesitated. | dm-narration-quality fallback | TASK-0193 (new, high, m-3) |
| 16 | 04:46–04:48Z seq 164–194 | Tamsin, Odo | positive | Tamsin broke the parley and killed Snag (15 vs AC 15, 11 damage). The pot-helm goblin fled; Odo's companion turn reacted in character ("my oath broke in that mud"), then persuaded the last goblin (19+3 = 22 vs DC 15) and it fled too. Morale and flight resolve as presence changes. | — | Evidence |
| 17 | 04:50:16–04:50:52Z seq 196–204 | both (party) | rules/DM quality | Group sign-off ran for real (Kestrel declared a party action, Tamsin approved, authority group). The action then resolved **refused, REASON_CONTRADICTS_STATE** while the encounter ended the same turn (both goblins gone); the narration covered it ("a beat too late"). Encounter end and the return to free mode work. | TASK-0188 | Evidence |
| 18 | 04:51:25–04:53:25Z seq 207–209 | both (party) | positive | 120 s stall test passed: party action "We all go to help Pell" left uncommitted; the stall job committed it at exactly 120 s (authority dm, signoff marker with both present). | — | Evidence |
| 19 | seq 207–218 | both + Odo | positive | Pell freed: Odo cut the ropes and took the clapper-strap (free mode). The scene's goal is reached. Operator widened TASK-0194: acting on anything outside the order should pull it into the order with its own initiative. | TASK-0194 | TASK-0194 widened (operator ruling recorded) |
| 20 | seq 195, 220 | — (chronicle) | rules/DM quality | The chronicle called Snag "the ferryman" (he is the goblin leader). | TASK-0109 | Evidence added to TASK-0109 |

## Run summary

- **Session:** `e8e8326d-0344-4fac-a4d4-3e4bcd82e2d5`, 2026-11-02 about 03:55–04:55 UTC. Hosted dev at `84b130a0`, then `b481e308` after the mid-run redeploy (a board-only change on top of `84b130a0`, plus vm-104's `dm.interpret` maxTokens raised from 1200 to 4000).
- **Spend:** $2.55 of the $50 ceiling, over 130 calls. 16 calls were not ok: 8 were the interpret truncation, and the rest recovered on retry.
- **Auditor:** deterministic, no model. Verdict **pass**: 220 rows, 21 narrations, 15 rolls, 0 fail, 0 warn, 8 notes. The report is `/tmp/audit-run3/report.json` in `stacks-dev-app-1`.
- **Checklist:** 10 pass, 1 fail (group sign-off, by design, TASK-0188), 2 not reached (TASK-0165 and TASK-0177 need a human DM seat), 0 pending. "A downed hero" was not reached inside `base-combat` and rolls forward.
- **Played through:** the scene opening, talk with Wenna, a compound plan cut to its first stage, a failed stealth roll, an encounter, a kill on each side's leader, an absence pass, a stall commit, persuasion, flight, encounter end, and Pell freed. The scene goal was reached.
- **Blocker found and fixed in-run:** interpret truncated at 1200 output tokens on combat prompts. Hidden thinking spent the whole budget (TASK-0181 AC #1 cause). The operator raised the limit on vm-104, and the stalled turn then resolved.
- **New cards:**
  - TASK-0187: transcript width.
  - TASK-0188: one chat stream, design round in progress.
  - TASK-0189: a companion misnames who spoke to it.
  - TASK-0190: dialogue styling.
  - TASK-0191: the header and turn order stay visible.
  - TASK-0192: maxTokens headroom and a truncated outcome.
  - TASK-0193: NPC-turn fallback lines and an unexplained floor pass.
  - TASK-0194: acting on anything outside the turn order pulls it in, widened by the operator.
- **Evidence added:** TASK-0180, TASK-0181, TASK-0182, TASK-0188, TASK-0109.
- **Roll forward to run 4:** a downed hero (death saves); TASK-0165 and TASK-0177 with a human DM seat.
