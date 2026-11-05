---
id: TASK-0203
title: Haiku dm.audit and dm.chronicle return invalid-json on the first attempt
status: In Progress
assignee: []
created_date: '2026-11-02 19:42'
updated_date: '2026-11-05 05:32'
labels:
  - dm
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
ordinal: 189000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: dm.audit and dm.chronicle parse on their first attempt, so a turn does not pay for a repair re-ask.

Why: runbook A playtest run 1 (2026-11-02, session 9296c653, scene start): dm.audit-v4 and dm.chronicle-v3 (cc/claude-haiku-4-5) both returned invalid-json on attempt 1 and recovered on attempt 2. Alpha run 3 (2026-11-01) showed the same two purposes failing once each. The ledger holds no text, so the shape of the bad reply is unknown.

Where: apps/server/src/dm/pipeline/call.ts (callJson), the haiku purposes' prompts, and the 9router cc/ haiku route. Candidates: a think block stripThink misses, prose around the JSON, or a code fence.

Spec: specs/086-schema-outcome-coercions
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The cause of first-attempt invalid-json on the haiku purposes is identified and recorded
- [ ] #2 A hosted run of 10+ turns shows no invalid-json on dm.audit or dm.chronicle attempt 1
- [ ] #3 The model-call ledger records a schema mismatch as its own outcome, distinct from invalid-json, with a test
- [ ] #4 Safe schema coercions (audit unknown kind to other, detail clipped to its cap, actor nullable, chronicle ids as strings) accept the run 1 reply shapes on attempt 1, with a test per shape from the vm-104 log
- [ ] #5 Spec phase: The schema-mismatch outcome (US1; FR-001 to FR-004; card AC #3)
- [ ] #6 Spec phase: Safe coercions (US2, US3; FR-005 to FR-009, FR-011; card AC #4)
- [ ] #7 Spec phase: Prompts state the failed fields (US4; FR-010)
- [ ] #8 Spec phase: Wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 1 again (seq 31-32): dm.chronicle-v3 invalid-json on attempt 1, ok on attempt 2. 3 of 3 chronicle/audit job starts so far had a first-attempt failure.

Run 1 seq 59: dm.companion-v6 invalid-json on attempt 1 (460 output tokens), ok on attempt 2. So the first-attempt failure is not haiku-only.

Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0203, branch task-0203-haiku-parse, cut from origin/main b756b68f. No spec dir: signed escape line covers this task. Escape E1 (card ACs drive).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (E1 implementation)

AC #1 cause (2f9b45c4): confirmed from code, the parser accepted only a bare object or a whole-reply fence; prose around the object, a fence wrapped in prose, or an unclosed think block (stripThink skips those by spec 063 contract) threw. Which shape the 9router haiku route sends is inferred, not confirmed (no reply text in the ledger). Fix: strict parse, then the single top-level object by a string-aware scan; ambiguous output still rejected. Each unparsable attempt now logs dm.call.invalid-json with a bounded head/tail excerpt, so the next hosted run shows the real shape. AC #2 waits for runbook B's playtest.

Playtest ceiling (runbook B playtest, 2026-11-03), operator's words: "Play it, ceiling $100".

Runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 28): dm.chronicle-v4 invalid-json on attempt 1 again (194 tokens), ok on attempt 2. The 2f9b45c4 parser change did not cover this reply shape. The server log line dm.call.invalid-json (head/tail excerpt) on vm-104 now shows the shape; reading it needs a vm-104 command. AC #2 not met so far.

Run 1 seq 40: dm.audit-v12 invalid-json on attempt 1 (139 tokens), ok on attempt 2. 2 of 8 first-attempt audit/chronicle calls failed to parse so far.

Run 1 seq 96-124: three more dm.audit invalid-json on attempt 1, all recovered on attempt 2.

Run 1 seq 133-170: dm.audit and dm.companion invalid-json on attempt 1, both recovered. Total so far: 8 first-attempt parse failures.

Run 1 through seq 313: 10 first-attempt invalid-json (dm.audit 7, dm.chronicle 2, dm.companion 1), all recovered on attempt 2. AC #2 NOT met.

AC #2 NOT met at runbook B playtest run 1 (37 turns): 17 of 224 calls returned invalid-json on attempt 1 (dm.audit 12/51, dm.interpret 2/34, dm.chronicle 1/19, dm.companion 1/7, dm.director 1/35; narrate 0/61), all recovered on attempt 2. Not haiku-only. The 2f9b45c4 parser change did not cover the real shape; the dm.call.invalid-json log lines on vm-104 hold head/tail excerpts and are the next evidence (reading them needs a vm-104 command). Card stays In Progress.

ROOT CAUSE CONFIRMED (runbook B playtest run 1, vm-104 log lines dm.call.invalid-json, 2026-11-04, with the operator's go). The replies parse as JSON (fenced or after an empty <think></think>); they fail the Zod schema, and callJson labels that 'invalid-json'. Of the 17 attempt-1 failures: dm.audit 'kind' not in the enum (model invents 'turn-mode', 8x, since TASK-0214's off-turn rule); dm.audit 'detail' over 300 chars (3x); dm.audit 'actor' null (1x); dm.companion missing 'comment'; dm.director 'goalNote' missing (written inside 'pacing'); dm.interpret NPC attack step missing 'attack' (TASK-0104) and stakes.severe null (TASK-0127); dm.chronicle sourceActionIds as numbers. The repair re-ask fixes each. Fix shape: name the schema outcome separately from invalid-json; make safe coercions (audit unknown kind → other, detail clipped, actor nullable, chronicle ids to strings); and state the enums and required fields in the prompts that produce them.

Claimed 2026-11-05 by M3 runbook B2 (docs/design/m3-runbook-b2-playtest-fixes.md, PR #132). Worktree .worktrees/task-0203, branch task-0203-schema-outcome, cut from origin/main 8128fb3a. Spec number 086 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 086 authoring, C1)

Spec 086 (1de87cbf). Coerced on attempt 1: audit unknown kind → other, detail clipped, actor nullable, chronicle numeric ids → strings. Still re-asked, now logged schema-mismatch: companion comment, director goalNote, interpret attack, stakes.severe null. Defaults taken: OQ-1 AC #2 counts schema-mismatch too; OQ-2 unknown kind → other (detail keeps a [turn-mode] prefix); OQ-3 stringify ids; OQ-4 two log events. Phase 1 (call.ts, schema, migration 0009) develops ahead; phases 2-3 wait for TASK-0240.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
