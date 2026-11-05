---
id: TASK-0236
title: 'Design round: MUD-inspired minimalist table UX'
status: In Progress
assignee: []
created_date: '2026-11-05 03:37'
updated_date: '2026-11-05 05:31'
labels:
  - design
  - ux
  - research
dependencies:
  - TASK-0199
priority: medium
ordinal: 222000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Research what modern MUD clients (Mudlet, web clients, MUD-adjacent text games) do well in UX, file it as a research-vault branch, then produce rounds of comparable mockups for the-stacks table view. End: operator-selected direction plus decision record; spec follows. The end goal stays a virtual table top; MUD minimalism is an input, not the target.

Selected 2026-11-04: Margin layout plus click-to-draft (docs/design/mud-ux/decision.md); built by spec 086. Prerequisite: TASK-0199 (spec 066) merges first.

Spec: specs/086-table-margin-and-mud-input
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Vault branch MUD-Client-UX passes the branch gate
- [x] #2 Vault analysis note draws VTT implications from the corpus
- [x] #3 Round-1 mockups: comparable directions over the same real table states, rendered and verified
- [x] #4 Operator selection recorded as a decision record
- [ ] #5 Spec phase: Scene fields and seed ways (US5, US6; FR-008, FR-017; R1)
- [ ] #6 Spec phase: Margin, mini-strip, status strip (US1, US2; FR-001 to FR-005; R2)
- [ ] #7 Spec phase: Stream items, roll rows, rules lines, room blocks, chips (US3, US6; FR-006 to FR-011)
- [ ] #8 Spec phase: Composer, glossary, nouns and the draft path (US4, US5; FR-012 to FR-020)
- [ ] #9 Spec phase: Contrast, contracts and wiki (FR-021, FR-022; SC-003, SC-007)
- [ ] #10 Spec phase: Verification **[orchestrator]**
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Long-running design worktree: /Users/evanstern/projects/the-stacks/.worktrees/mud-ux on branch task-0236-mud-ux. Vault branch: docs/research/MUD-Client-UX. Mockups: docs/design/mud-ux/round-N/.

Phase 2 binding constraints (every round is checked against these): no modals (slide-out panel component, inline expansion, or autocomplete dropdown only; TASK-0028 decision). Daylight palette, CSS custom properties, light and dark, WCAG AA. Chat is a view over the session event log; a VTT can drive the same events (decision-0013). Talk and actions are distinct (decision-0016) and TASK-0188 one-chat-stream rules hold: quiet ring, DM confirm row with 👍, @dm read-only answers, ai:dm never declares a player action. DM-only text never reaches a player. Library content never appears on the Table. Real copy from the greyhollow-ford-duo scenario. Self-contained HTML, no external fonts or CDNs. Mobile at 390px must work. Screen-reader use is a first-class case (MUD heritage).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5[1m]
Research embed done: fb4cba36, branch gate OK. Limitation: sources are search-result summaries, not full-page reads; gaps listed in _grounding.md.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5[1m]
Analysis done: 0e918e5f, analysis gate OK. Thesis: adopt MUD architecture (stream + server-pushed state panels), reject command grammar, map is a peer panel with text parity. Candidate directions: Scroll, Margin, Split, Board.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5[1m]
Round 1 (caa45005): docs/design/mud-ux/round-1/. Four directions on one axis (how much screen the stream owns): A Scroll (stream is the table), B Margin (stream plus slim state margin, map slide-out), C Split (docked map beside stream, click-to-draft), D Board (map and panels dominate, stream is a log; the too-far bound). Same 8 states, greyhollow-ford-duo copy, shots at 1280/390 for states 3 and 7. Known gaps: no contrast checker run (AA rests on sibling token pairs; dark map text unmeasured). Asked operator: pick a direction (or hybrid) and answer OQ1–OQ4.

Operator selection 2026-11-04: B Margin plus C's click-to-draft — 'a slide-out map + the ability to interact with it'. Decision record: docs/design/mud-ux/decision.md. OQ4 ruled (drafts into the composer); OQ1–OQ3 open with recommendations. Next: rule OQ1–OQ3, then the spec (Phase 5), split into margin+input baseline now and the slide-out map once map data exists.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5[1m] (spec authoring, per standing ruling)
Spec 086 authored (5c75d95e) and linked. Two red contract items await operator ruling: R1 SceneSchema gains optional description/ways/cast (rec. accept); R2 turn-order strip moves into the margin (rec. accept). Ten settled judgment calls are listed in spec.md 'Decision gaps settled here' (history derived from own talk rows since contract 030 forbids localStorage; /roll dropped; monster nouns show no HP/AC). Action economy is a Non-goal (engine tracks reactions only).

Operator ruling 2026-11-05: R1 (a) accept and R2 (a) accept ('Accept R1 and R2'). Recorded in spec.md and tasks.md. Spec 086 is implementation-ready once TASK-0199 (spec 066) merges.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
