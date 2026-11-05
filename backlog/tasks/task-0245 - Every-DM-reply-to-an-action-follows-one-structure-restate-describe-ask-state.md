---
id: TASK-0245
title: >-
  Every DM reply to an action follows one structure: restate, describe, ask,
  state
status: To Do
assignee: []
created_date: '2026-11-05 04:52'
labels:
  - dm
  - narration
  - playtest
  - design
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
priority: high
ordinal: 229000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every DM reply to a declared action is built in four parts, in order, and the player always ends knowing where things stand:
1. Restate: the narrator paraphrases the declared action as attempted, in third person and in fiction ('Tamsin and the party set out along the timbers toward the reed camp'). The audit checks it matches the declaration.
2. Describe: world building, the outcome the ledger settled, NPC words and looks (today's prose).
3. Ask (optional): a clarify question, or a question an NPC puts to the party, exactly as the facts state it.
4. State: a code-rendered line after the prose, like the dice lines, from engine state: whose move it is, and what did or did not change ('Now: the party is still at the causeway's edge; nothing has happened yet; the party is choosing how to go'). Never 'What do you do?' (TASK-0204 stands).

Decision tree (to settle in the spec, per the operator's 'CERTAINLY there's a decision tree there'):
- Trigger: player action / NPC turn / talk / scene start / encounter start or end.
- Resolution: applied / clarify (nothing happened) / refused (plan gate or engine) / no-effect / partly applied (followUps parked).
- Mode: free play / turn order (whose turn next).
- Each branch states which of the four parts appear and what the State line says. Examples: clarify → restate as intended, describe the moment, Ask = the question, State = 'nothing has happened yet; <who> is choosing'. Refused → restate, describe why in fiction, no Ask, State = unchanged + whose move. NPC turn → restate the NPC's act, describe, no Ask, State = next actor.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 20). 'We move along the timber posts…' got scene description then 'Do you creep along the timbers quietly, or just move straight for the camp?', leaving it unclear whether the party had moved. Operator, proposing the structure: "[repeat the command] -- Temsin and the party decide to move out on the timbers toward the reed camp / [world building/description] -- Wenna grips her boathook tighter / [optional questions] -- Do you creep along the timbers quietly? / [lastly, the new state] -- You have not left yet, what do you do?" and "Possibly there's more structure and CERTAINLY there's a decision tree there. When we card this, at the end of this playthrough, I'd like to work this out in detail."

Operator rulings at wrap (2026-11-04, answering four questions): the State line is code-rendered (not narrator-written); the restate is a narrator paraphrase the audit checks (not a code echo); the 'What do you do?' ban stands, so the State line names whose move it is instead; card it now as a spec task (no design round).

Related: TASK-0209 (clarify holds the turn), TASK-0204 (ending ban), TASK-0207 (say lines), TASK-0214 (audit pass rate), TASK-0237 (outcomes decided by dice), TASK-0244 (turn ownership).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The spec states the decision tree: for each trigger, resolution and mode, which of restate, describe, ask and state appear and what the State line says
- [ ] #2 The narrate prompt opens every action reply with a paraphrase of the declared action as attempted, and the audit flags a restate that does not match the declaration, with tests
- [ ] #3 Code renders a State line after the prose from engine state (whose move, what changed or did not), in the shipped narration and the fallback, with a test per branch
- [ ] #4 A clarify reply shows the question as Ask and a State line saying nothing has happened yet, with a test replaying run 1 seq 15-20
- [ ] #5 No State line contains 'What do you do?', with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
