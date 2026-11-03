# Tasks: Attacks and damage may target anyone present, combatant or not

**Input**: `specs/075-attack-anyone/` (spec.md, plan.md, contracts/plan-reason-gate-amendment.md)

**Prerequisites**: the operator rules OQ-1 to OQ-3. The tasks below implement every OQ at (a). A
different ruling changes the plan.md design section named under that OQ.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Each phase ends with `pnpm ci:check` green (DB suites skip without a database) and
one commit led by `TASK-0210:`. No phase edits `dm/nodes/resolve.ts` or any `dm/prompts/*` file.

## Phase 1: The gate, its unit tests and the contract (card AC #1, #2, #3)

- [x] T001 In `apps/server/src/dm/gates/plan-gate.ts`, delete `pullable` from `NamedId`,
      `effectIds` and `stepIds` (plan D1).
- [x] T002 In `checkPlan`, change the id check to `!valid.has(id) && !npcIds.has(id)`. Keep the
      failure reasons, the absent check and the pull-id block unchanged. Update the spec 068
      comments to cite spec 075.
- [x] T003 In `apps/server/test/dm/plan-gate.test.ts`, apply every row of the plan D3
      `plan-gate.test.ts` table: two flips, three id swaps, two new cases.
- [x] T004 Apply `contracts/plan-reason-gate-amendment.md` to
      `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md`. Copy the text block
      verbatim, including the ruling quote.
- [x] T005 In `specs/068-noncombatant-targets/spec.md`, append the plan D2 reversal line under
      OQ-4 and under FR-002. Change nothing else in spec 068.
- [x] T006 Run the plan D5 mutation guard on the unit tests: restore `pullable: false` on the
      attack `targetId`, see the flipped case fail, restore.
- [x] T007 Run `pnpm ci:check`.

## Phase 2: The DB tests and the run 1 seq 45 replay (card AC #1, #2; merge condition)

- [x] T008 In `apps/server/test/dm/resolve.integration.test.ts`, apply the three plan D3 rows: move
      each refusal case to unknown id `ghoul-9` and update its expectations and comment.
- [x] T009 In `apps/server/test/dm/noncombatant-targets.integration.test.ts`, replace the attack
      control with the attack-pull case (plan D3). Add the extra-dice argument to `runFreePell`.
- [x] T010 Create `apps/server/test/dm/scripts/shoot-snag.json` (plan D4). Take the post texts from
      `docs/playtests/2026-11-02-runbook-a-playtest.md` findings 5 and 6.
- [x] T011 Create `apps/server/test/dm/attack-anyone.integration.test.ts` with the seq 45 replay
      and the absent control (plan D4). Declare Kestrel's action through Kestrel's player.
- [x] T012 Run the DB suites with `REQUIRE_DATABASE=1` on the worktree stack (dispatch rules). Run
      the plan D5 mutation guard on D4 test 1, then restore.
- [x] T013 Run `pnpm ci:check`.

## Phase 3: Wiki re-ground (card AC #3)

- [ ] T014 `docs/wiki/dm-failure-and-gates.md` (NEEDS-REVIEW): rewrite the spec 068 sentence in the
      plan-gate paragraph. Every field accepts an exact non-combatant NPC id; only an alias fails
      `not-a-combatant`. Cite spec 075, TASK-0210 and the ruling verbatim.
- [ ] T015 `docs/wiki/dm-runtime.md` (NEEDS-REVIEW): state that `pullIn` now also pulls attack
      targets, attackers and damage targets (spec 075). Cite the ruling.
- [ ] T016 `docs/wiki/turn-floor.md` (NEEDS-REVIEW): check whether any line describes who may join
      the order. Add one line if a pulled attack target can join mid-encounter and the note is
      silent. Re-pin honestly whether or not the text changes.
- [ ] T017 `docs/wiki/output-claim-gate.md` and `docs/wiki/seed-npc-presence.md`: they list
      `plan-gate.ts` as a source. Review against the diff and re-pin.
- [ ] T018 `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md`: amend the spec 068 sentence in INDEX
      to say attacks and damage pull too since spec 075. Update the `dm-failure-and-gates` capsule
      if its wording names the attack exception.
- [ ] T019 Re-pin the reviewed notes to the branch head. Run the wiki freshness gate and the
      spec-bridge gate (dispatch rules); both pass.
