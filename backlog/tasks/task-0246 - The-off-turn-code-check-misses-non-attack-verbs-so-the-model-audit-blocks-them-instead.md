---
id: TASK-0246
title: >-
  The off-turn code check misses non-attack verbs, so the model audit blocks
  them instead
status: Done
assignee: []
created_date: '2026-11-05 05:12'
updated_date: '2026-11-07 03:09'
labels:
  - dm
  - narration
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
priority: high
ordinal: 230000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an off-turn actor shown making a non-attack turn move (turning its head, shifting its grip, drawing back for another try) is caught by the deterministic off-turn check before the model audit, so the regenerate is targeted and costs no audit call; and a passive verb that is not a turn action (watches, waits) is not blocked at all.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 96-124 and later; recorded on TASK-0214). The off-turn check (claims.ts, TURN_ACT_VERBS in audit-words.ts, TASK-0214 / spec 085) knows only strike/shoot/cast-class verbs. 'turning its head', 'draws back for another try' and 'shifts its grip' slipped past it, and the model audit then refused those narrations, burning attempts. Carded as amendment A1 of docs/design/m3-runbook-b2-playtest-fixes.md (operator sign-off 2026-11-05: 'Signed off, start').

Related: TASK-0214 (spec 085), TASK-0240 (reflex list, same file).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The off-turn check blocks an off-turn actor shown readying or repositioning for its next action (e.g. 'draws back for another try', 'shifts its grip'), with a test per run 1 phrase
- [x] #2 A passive or perceptual verb (watches, waits, turns its head toward the noise) on an off-turn actor is allowed by the code check and the audit prompt states it is not a turn action, with a test
- [x] #3 A replay of the run 1 refusals that named these phrases passes or regenerates without a model-audit call, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-05 by M3 runbook B2 (docs/design/m3-runbook-b2-playtest-fixes.md, spine #2b, amendment A1). Worktree .worktrees/task-0246, branch task-0246-off-turn-verbs, cut from origin/main 9ead3268. No spec dir: signed escape line E4 covers this task.

Off-turn check now catches readying phrases (TURN_READY_PHRASE), perceptual verbs pass, audit-v14, wiki re-pinned; code sha bc16aab5 + format

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (E4 implementation, plus one orchestrator-requested fix: rule 6 text)

Runbook B2 playtest run 1 (2026-11-06, session bb4952dc, seq 103-107): Kestrel's 'I stand firm' beat shipped the fallback after 3 refusals for the off-turn pot-helm goblin: 'shifts weight and chooses its moment', 'grip tightens on its blade' (both missed by TURN_READY_PHRASE, which knows only 'shifts its/his grip/stance/weight' and 'draws back'), then 'studying Kestrel and fixing its eyes on her' (a model-audit false positive: audit rule 6 says looking is not a turn action). Widen the phrase list (shift weight, grip tightens, choose its moment) and add a code downgrade for a perceptual-only off-turn issue, like TASK-0240's reflex downgrade.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR #135 (a377997e), runbook B2 spine #2b (A1), escape E4. The off-turn code check catches readying for a next action (TURN_READY_PHRASE: draws back, shifts its grip, raises ... again) before the model audit; audit-v14 rule 6 names readying as invented-mechanics and says watching, waiting and turning toward a noise are not turn actions.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
