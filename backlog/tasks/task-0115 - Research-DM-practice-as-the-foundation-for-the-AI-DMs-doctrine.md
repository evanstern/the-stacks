---
id: TASK-0115
title: 'Research: DM practice as the foundation for the AI DM''s doctrine'
status: Done
assignee: []
created_date: '2026-10-27 01:44'
updated_date: '2026-10-27 02:34'
labels:
  - research
  - dm
  - doctrine
milestone: m-3
dependencies: []
priority: high
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the AI DM's doctrine (apps/server/src/dm/doctrine/, specs 031/033/034) is grounded in documented DM practice, not thin definitions. Why: every M2 First Scene narration-quality problem traced to thin doctrine definitions (player agency, fail-forward, 'no effect', what a roll may decide); operator ruling 2026-10-26 on TASK-0113. Method: research plugin vault in docs/research/. Branch 0 maps DM craft across sources and ranks deep-dive branches by refactor risk; branch 1 answers how a DM decides what the dice decide versus the player. Sources: operator's DMG 2014, XGtE, TCoE, VRGtR, CoS, LMoP (D&D Beyond exports, paraphrase only, never committed), SRD 5.2.1, The Alexandrian, The Angry GM, Sly Flourish, Matt Colville. No doctrine or prompt implementation in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docs/research/ holds a vault with a DM craft map branch that passes the research branch gate
- [x] #2 The map branch has an analysis note ranking deep-dive branches by refactor risk, reviewed by the operator
- [x] #3 A dice-versus-player branch passes the branch gate and has an analysis note with a recommendation
- [x] #4 A decision record is created with the backlog CLI after operator go
- [x] #5 Doctrine follow-up cards exist, and TASK-0113, TASK-0104 and TASK-0055 carry the applicable findings
- [x] #6 No DMG or other non-SRD book text is committed beyond one short attributed quote per note
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Branch 0 (DM craft map), operator-approved 2026-10-26:
1. Dispatch three sonnet gatherers in parallel; each writes cited raw extracts to the session scratchpad. A1: books (DMG 2014, XGtE, TCoE, VRGtR, CoS, LMoP) section inventory of DM-advice chapters. A2: web guides (Alexandrian, Angry GM, Sly Flourish, Matt Colville) topic inventory. A3: the-stacks doctrine, decisions and specs: AI-DM components and what doctrine covers today.
2. Dispatch one sonnet assembler: scaffold the vault in docs/research/, write the DM-Craft-Map branch (grounding, MOC, neutral notes), pass the branch gate.
3. Orchestrator (opus) reviews and writes the analysis note: competency x component x refactor risk, ranked deep-dive branches.
4. Operator check-in on the map before branch 1 (dice versus player).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Branch 0 gather (A1 books, A2 web, A3 project), 2026-10-26:
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(A1 served model verified from its transcript before A2/A3 launched; A2/A3 re-verified at completion.)

Branch 0 landed on this branch (c763ada): docs/research/DM-Craft-Map, 606 entries, branch and analysis gates green.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(assembler; served model per its transcript). Analysis written by the orchestrator (opus, judgment tier).
Findings: SRD 5.2.1 Playing the Game text is absent from packages/srd; DMG is 2014 edition; DMG Introduction absent from export; web entries mostly title-only.
Awaiting operator review of Analysis-Refactor-Risk-and-Deep-Dive-Order (AC #2) and five open questions before branch 1.

OPERATOR APPROVAL 2026-10-26, in the operator's words: 'Approve the order and the widened branch 1.' Order: (1) resolution and outcome, widened with outcome richness, DC derivation, contests/group checks/retries, out-of-character questions to the DM; (2) NPCs, social and information; (3) exploration, awareness and time; (4) table contract; (5) running combat (trigger TASK-0048); trigger-bound: encounter/adventure design (TASK-0060), world/tone/horror (non-default content), rewards/house rules (multi-session). Open questions 1-5 pending.

OPERATOR ANSWERS 2026-10-26 to the five open questions: (1) branch 1 reads the official SRD 5.2.1 PDF (CC-BY-4.0); packaging carded as TASK-0123. (2) No 2024 DMG; branch 1 uses DMG 2014 and flags divergence. (3) Full reads of key web articles; Colville dropped as a branch 1 source. (4) Widened branch 1 approved. (5) Card now.
Cards created on main (414aa07): TASK-0119 branch 2 NPCs/social/information (dep TASK-0115); TASK-0120 branch 3 exploration/awareness/time (dep 0119); TASK-0121 branch 4 table contract (dep 0120, before M3 multiplayer); TASK-0122 branch 5 combat (dep 0121 + TASK-0048); TASK-0123 SRD Playing the Game text; revisits TASK-0124 (trigger TASK-0060 Codex schema), TASK-0125 (trigger non-default content), TASK-0126 (trigger multi-session or house rule). Branches 2-5 are separate tasks, not subtasks: one-task-one-PR would otherwise hold this task's PR until branch 5.

Branch 1 gather (B1 books+SRD 5.2.1 PDF sha256 8974902d…, B2 29 web articles), 2026-10-26:
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Branch 1 landed (142af0d): docs/research/Resolution-and-Outcome, gates green.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(assembler). Orchestrator review trimmed five book paraphrases that tracked DMG/VRGtR examples or tables too closely, and corrected the analysis: SRD 5.2.1 has no contest rule (opposition is a check against a derived DC). Analysis-Dice-Versus-Player recommends seven points; awaiting operator go and three open questions before the decision record and cards.

Decision-0022 (D14) created with the backlog CLI after operator go 2026-10-26; body sections filled after creation, following the decision-0021 precedent (the CLI takes title and status only). Operator answers: outcome bands default ON; nat 20 succeeds and nat 1 fails on any d20 test, default ON; reflex thresholds confirmed; flavour intensity follows the natural die; Ask the DM carded as a design round with the M3 table work.
Cards on main (7f31dce): TASK-0127 stakes before dice, TASK-0128 opposition DC and Help, TASK-0129 Ask-the-DM design round, TASK-0130 doctrine pass. Findings appended to TASK-0113, TASK-0104, TASK-0055.
Validation: research branch and analysis gates green for DM-Craft-Map and Resolution-and-Outcome; praxisflux commit gates clear (6); book-text check: notes paraphrase by heading path, no book quotations, only SRD quotes with CC-BY-4.0 attribution; five over-close paraphrases trimmed on review.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Grounded the AI DM's resolution doctrine in documented DM practice. Added a research vault at docs/research/ with two branches: DM-Craft-Map (606 cited entries across six of the operator's books, SRD 5.2.1 and four web sources, plus an analysis ranking deep-dive branches by refactor risk) and Resolution-and-Outcome (SRD 5.2.1 PDF, DMG 2014 Ch 8-9, 29 web articles; analysis answering what the dice decide versus the player). Ratified decision-0022 (D14): the capability-not-decision agency line, stakes before dice, numbers from the sheet, table-rules settings, flavour intensity, and Ask the DM. Carded branches 2-5 (TASK-0119 to 0122), the SRD text package (TASK-0123), three revisits (TASK-0124 to 0126) and four D14 implementation cards (TASK-0127 to 0130); fed TASK-0113, 0104, 0055. No doctrine or prompt code changed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
