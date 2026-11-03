---
id: TASK-0113
title: >-
  Narration player-agency residue: scene-start hero moves, v3 dodge breach,
  companion scope
status: In Progress
assignee: []
created_date: '2026-10-26 20:08'
updated_date: '2026-11-03 00:33'
labels:
  - dm
  - narration
milestone: m-3
dependencies: []
priority: low
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: real-model narration does not move the human player's hero at scene start or on a foe's miss, and the playtest auditor treats AI companions according to a stated rule.

Evidence: TASK-0106 rerun 20261026T192319Z (specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/ classification.md). F1: scene-start narration 'Tamsin Vale leads the way up from the bank'. F6: 'Tamsin twists just enough' on a recorded miss, a breach the narrate-v3 rule did not prevent. F7: the playtest auditor treats companion Brother Odo as a player's hero. Seq 130: an invented near-miss with no miss fact. Operator ruling 2026-10-26: card the residue in m-3.

Spec: specs/074-player-agency
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A narrate rule or check covers the hero at scene start, with a test over the opening framing
- [ ] #2 The v3 miss rule's adherence is measured on a captured run, and a fix with a test follows if it is below a stated rate
- [ ] #3 The playtest auditor's hero-is-theirs check states whether companions count, with a test
- [ ] #4 The Director's goal notes state no volitional act, method or skill for a PC that its player did not declare, with a prompt test
- [ ] #5 Interpret steps carry no volitional act for a PC that its player did not declare, with a test
- [ ] #6 Spec phase: Rule source, Director, interpret, playtest auditor (card AC #3, #4, #5; US1, US4)
- [ ] #7 Spec phase: Facts, narrate, audit (card AC #1, #2; US2, US3)
- [ ] #8 Spec phase: Wiki (re-ground)
<!-- AC:END -->







## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
OPERATOR RULING 2026-10-26 (during the M2 demo), in the operator's words: 'It makes perfect sense for the DM to narrate the reaction of a character in combat *after* being hit, or missing, etc. As long as that description is not something that takes away *choices* from the player. Saying "You get hit by a big club and it staggers you back a step" is fine if the roll makes sense (critical hit, for example) -- the player has no agency there, it happened, they got staggered back a step. Or even "You are surprised by this and it shows on your face" -- that's another one that a roll could decide, it's reflexive. But, you don't want "You see your long long love and run to meet her" -- that's a decision for the player and it is not something a DM roll could account for. ... Actions occur -> Evaluate for potential roll-able side-effects (reactions, reflexes, etc) -> Narration suggestion -> Evaluation (do not take away agency) -> loop until accepted'.
Consequences, stated by the orchestrator: (1) TASK-0106's narrate-v3 rule E3 ('unchanged and unmoved: no wound, no dodge') and audit-v2's player-agency definition are stricter than the ruling and must be revised. (2) Proposed shape: code derives the allowed involuntary effects from the ledger (critical hit, damage share of max HP, a failed save's effect) as facts for both the narrator and the auditor. player-agency blocks only volitional acts (movement with intent, speech, decisions, chosen emotional responses). The existing narrate, audit and regenerate loop (3 attempts) stays. (3) Scope this card as a spec (doctrine change), not a patch.

RESEARCH FINDINGS 2026-10-26 (TASK-0115 branch Resolution-and-Outcome; decision-0022 D14 point 1). The operator's ruling matches the rules' own model: every SRD 5.2.1 condition limits what a character can do, never what it chooses (Frightened bars willing movement toward the source but orders no flight; Charmed imposes no obedience). Only named control effects compel behaviour (Command, Suggestion, Dominate Person, possession, fear and stress). Shape for this card's spec:
(a) Code derives an involuntary-effects list from the ledger; narrator and auditor read the same list.
(b) Reflex triggers, operator-confirmed 2026-10-26: a critical hit allows a stagger; damage of about half the character's HP or more allows a heavy-hit reaction (DMG 2014 massive-damage threshold as reference); a failed save allows a flinch matched to the effect; surprise allows startlement.
(c) Small displacement inside a reflex is colour ('staggers back a step'); any position change that matters needs an engine fact.
(d) Control effects compel only through a recorded fact naming the effect.
(e) player-agency blocks volitional acts only: intent, speech, purposeful movement, choices, chosen emotions.
Reserve an outcome-band field in NarrationFacts: TASK-0127 (stakes before dice) extends this card's facts shape and depends on it. The flavour-intensity rule goes to TASK-0130.

WIDENED 2026-11-02 (operator ruling, relayed by the orchestrator for M3 runbook B, docs/design/m3-runbook-b-resolution-quality.md lane B1): scope covers the Director's goal notes and interpret, not only the narrator. Evidence: runbook A playtest run 1 (docs/playtests/2026-11-02-runbook-a-playtest.md) findings 4, 14, 19, where the Director prescribed Stealth and a reaction swing and interpret followed. ACs #4 and #5 added. This card sets the shared rule; TASK-0205 and TASK-0208 apply it.

Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0113, branch task-0113-player-agency, cut from origin/main b756b68f. Spec number 074 claimed with a stub. Spine #3.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 074 authoring, C1)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
