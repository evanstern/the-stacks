---
id: TASK-0143
title: 'Actor-state gate: Output claim gate: actor-aware checks over shipped narration'
status: Done
assignee: []
created_date: '2026-10-27 03:54'
updated_date: '2026-10-28 03:02'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0140
  - TASK-0141
  - TASK-0142
priority: high
ordinal: 130000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a deterministic checker keyed to snapshot aliases refuses shipped text that contradicts actor state.

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U3). Dependencies as stated there: U1, U2, U8.. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.

Spec: specs/051-output-claim-gate
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The checker refuses a dead, downed or absent actor shown acting or speaking, with tests over M2 seq 225 and run 192319Z row 162.
- [ ] #2 It refuses a death or drop named on the wrong actor.
- [ ] #3 It refuses a count or quantifier that disagrees with the snapshot ("two down", "no goblins left"), with a test over M2 seq 225 and F52.
- [ ] #4 It runs on narrate prose and on the ruling and `goalNote` text that reach narrate.
- [ ] #5 A refusal feeds the existing regenerate loop and code fallback.
- [ ] #6 The actor-anonymous word checks in `audit-words.ts` are replaced or keyed to actors.
- [x] #7 Spec phase: Evidence fixtures and failing evidence tests (card AC #1, #3, #6 evidence)
- [x] #8 Spec phase: The claim checker (card AC #1, #2, #3)
- [x] #9 Spec phase: Audit wiring; the anonymous checks replaced; the fallback passes (card AC #2, #5, #6)
- [x] #10 Spec phase: Ruling and `goalNote`; the regenerate loop end to end (card AC #4, #5)
- [x] #11 Spec phase: Narrate prompt v5 and the contracts (card AC #1, #2, #3, #6; OQ-3; FR-017, FR-020)
- [x] #12 Spec phase: Wiki re-ground
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-27 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0143, branch task-0143-output-claim-gate, cut from origin/main 8d24c60. Spec number 051 claimed with a stub. Track C. Depends on TASK-0142 (PR #75, open): spec now, plan after #75 merges.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(Spec author: spec.md and the checklist at 48fb076. It stopped before plan.md with OQ-1..OQ-6.)
Evidence locations:
- M2 seq 225 and F52 are in docs/design/m2-demo/demo-session/transcript.jsonl and docs/design/m2-demo.md:245.
- Run 192319Z row 162 is in specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/. Only the sha256 of that prose was recorded, so the test rebuilds it from the quoted fragments.
Recommended defaults:
- OQ-1 (a): model-written roll reasons stay out of U3, and the fallback stops voicing a refused reason. A follow-up card checks reasons at the plan gate.
- OQ-2 (a): a refused ruling or goalNote is checked once before narrate, then withheld or blanked, with an advisory issue.
- OQ-3 (a): bump to dm.narrate-v5, which allows state sections as grounds and adds the line "does not act or speak; count only what the state shows".
- OQ-4 (a): reuse ledger-mismatch with an "Actor state:" prefix.
- OQ-5 (a): only a unique reference triggers an act or wrong-actor refusal. Group nouns count toward counts and omission. Pronouns and descriptions pass. A bare "N down" passes if either side matches. yielded counts as present.
- OQ-6 (a): replace all four anonymous checks with keyed ones.

Operator ruling 2026-10-27 (verbatim): "TASK-0143: I accept the recommended defaults OQ-1 to OQ-6 (a), including the dm.narrate-v5 prompt bump and a follow-up card for checking roll reasons at the plan gate."

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(Resumed spec author for plan.md, design artifacts and tasks.md: 5393f72, e9014b0. The follow-up is TASK-0161.) Orchestrator ruling, applying OQ-5 (a); the operator may overturn it. FR-004a adds two exemptions to the act-and-speech rule, so that the fallback still passes the checker (FR-011):
- It skips an actor whose life state or presence changed this turn, for example "Snag flees.", or a last act before a death.
- It skips the phrase "<name> acts/moves next".
No evidence case depends on either one.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 1, T001-T007: 1b3d00b. Five refusal cases are it.fails; each failed as plain it against the stub at expect(r.pass).toBe(false). Controls pass. Both logs fold clean: M2 333 rows, run 192319Z 222 rows. ci:check without a DB: only the 5 expected adjudicate.integration failures.) Main is merged in, so the branch card copy of TASK-0142 matches Done.

spec-bridge sync: Evidence fixtures and failing evidence tests (card AC #1, #3, #6 evidence): 7/7 · The claim checker (card AC #1, #2, #3): 0/7 · Audit wiring; the anonymous checks replaced; the fallback passes (card AC #2, #5, #6): 0/8 · Ruling and `goalNote`; the regenerate loop end to end (card AC #4, #5): 0/7 · Narrate prompt v5 and the contracts (card AC #1, #2, #3, #6; OQ-3; FR-017, FR-020): 0/6 · Wiki re-ground: 0/7

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 2, T008-T014: d5e6a23, 2a594e6. claims and claim-evidence 76 pass; all five evidence cases refuse with the expected kind and quote; controls pass. FR-004a mutation check: each exemption has a failing test without it. ci:check without a DB: only the 5 expected adjudicate.integration failures.)
OPEN FOR OPERATOR: OQ-5 (a) said pronouns pass. Row 162 ("Tamsin hand twitches toward her sword, her fingers curling") has no act verb near the name, so the implementer added a narrow carry-over rule. A pronoun + body part + act verb later in the same sentence binds to the last uniquely named actor, if no other name comes between. Without the rule, AC #1 row 162 is not refused. The operator either keeps the rule or drops it and accepts that row 162 passes.
Other matcher choices are listed in the Phase 2 report: comma stops the act scan, objects after prepositions, a passive is needed for killed and slain, quote interiors are skipped for act and speech, and Snag is in the "goblin" group via his alias.

spec-bridge sync: Evidence fixtures and failing evidence tests (card AC #1, #3, #6 evidence): 7/7 · The claim checker (card AC #1, #2, #3): 7/7 · Audit wiring; the anonymous checks replaced; the fallback passes (card AC #2, #5, #6): 0/8 · Ruling and `goalNote`; the regenerate loop end to end (card AC #4, #5): 0/7 · Narrate prompt v5 and the contracts (card AC #1, #2, #3, #6; OQ-3; FR-017, FR-020): 0/6 · Wiki re-ground: 0/7

Operator ruling 2026-10-27 (verbatim): "TASK-0143: keep the same-sentence pronoun carry-over rule (a pronoun + body part + act verb binds to the last uniquely named actor, with no other name between), as a narrow exception to OQ-5 (a), so AC #1 row 162 is refused."

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 3, T015-T022: 551182e red tests, 9721e8f source. The four anonymous checks are replaced; seq 216 no longer refuses Tamsin. The fallback 400-iteration loop passes checkClaims. ci:check without a DB: only the 5 expected adjudicate.integration failures.)
Matcher gap found: "Goblin three is dead" reads as the count claim "3 down". Phase 3 changed the fallback to say "<numbered target> dies." Model prose naming a numbered goblin would still be refused falsely. Phase 4 fixes the matcher: a number word right after a group noun is part of a name, not a count.

spec-bridge sync: Evidence fixtures and failing evidence tests (card AC #1, #3, #6 evidence): 7/7 · The claim checker (card AC #1, #2, #3): 7/7 · Audit wiring; the anonymous checks replaced; the fallback passes (card AC #2, #5, #6): 8/8 · Ruling and `goalNote`; the regenerate loop end to end (card AC #4, #5): 0/7 · Narrate prompt v5 and the contracts (card AC #1, #2, #3, #6; OQ-3; FR-017, FR-020): 0/6 · Wiki re-ground: 0/7

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 4, T023-T029: 153572c; matcher fix b17efac. REQUIRE_DATABASE=1 ci:check exit 0: server 1215 pass; no flakes. Both retry paths pass end to end on the fake gateway: passed-after-regenerate, and fallback after three refusals. "Goblin three is dead" no longer reads as a count.)
Orchestrator rulings, applying OQ-2 (a) and OQ-5 (a):
- The ruling and goalNote input check ignores omission claims. Narration still owes omissions.
- "rally" joins ACT_VERBS.
Known limit: ACT_VERBS coverage. Verbs outside it ("braces", "heaves") are not refused, which is a miss, not a false refusal; the model audit is the backstop.

spec-bridge sync: Evidence fixtures and failing evidence tests (card AC #1, #3, #6 evidence): 7/7 · The claim checker (card AC #1, #2, #3): 7/7 · Audit wiring; the anonymous checks replaced; the fallback passes (card AC #2, #5, #6): 8/8 · Ruling and `goalNote`; the regenerate loop end to end (card AC #4, #5): 7/7 · Narrate prompt v5 and the contracts (card AC #1, #2, #3, #6; OQ-3; FR-017, FR-020): 0/6 · Wiki re-ground: 0/7

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 5, T030-T035: 5604155, 0a12433. dm.narrate-v5; the 034 and 040 contracts amended. REQUIRE_DATABASE=1 ci:check exit 0; no flakes. CI playtest: on both the branch and origin/main 88194c8, ended, verdict pass, 8 audited turns, 0 fallbacks.) Limit: the CI playtest is scripted, so the comparison shows no regression on the scripted narration only. It says nothing about live-model fallback rates.

spec-bridge sync: Evidence fixtures and failing evidence tests (card AC #1, #3, #6 evidence): 7/7 · The claim checker (card AC #1, #2, #3): 7/7 · Audit wiring; the anonymous checks replaced; the fallback passes (card AC #2, #5, #6): 8/8 · Ruling and `goalNote`; the regenerate loop end to end (card AC #4, #5): 7/7 · Narrate prompt v5 and the contracts (card AC #1, #2, #3, #6; OQ-3; FR-017, FR-020): 6/6 · Wiki re-ground: 0/7

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 6, T036-T042: 19fe197 wiki, 217508e runbook rows. Freshness OK: 54 notes; spec-bridge check exit 0.) New note docs/wiki/output-claim-gate.md. The implementer did not read the claims.ts matcher internals. The orchestrator checked the note against claims.ts and audit-words.ts: the count patterns, stable, the pronoun carry-over and possessives match. The note omits the "acts/moves next" exemption, a gap but not an error. The final Done sync runs on main after the merge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Evidence fixtures and failing evidence tests (card AC #1, #3, #6 evidence): 7/7 · The claim checker (card AC #1, #2, #3): 7/7 · Audit wiring; the anonymous checks replaced; the fallback passes (card AC #2, #5, #6): 8/8 · Ruling and `goalNote`; the regenerate loop end to end (card AC #4, #5): 7/7 · Narrate prompt v5 and the contracts (card AC #1, #2, #3, #6; OQ-3; FR-017, FR-020): 6/6 · Wiki re-ground: 7/7). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
