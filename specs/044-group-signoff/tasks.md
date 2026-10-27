---
description: "Tasks for group sign-off on party-scope actions (TASK-0049)"
---

# Tasks: Group sign-off for party-scope actions

**Input**: `specs/044-group-signoff/` — spec.md (rulings of 2026-10-27), plan.md,
data-model.md, contracts/signoff.md, quickstart.md.

**Tests**: Required. AC #6 asks for gate tests with several players; the runbook merge
condition asks for a DB test with two human seats on the task's own stack.

**Dispatch**: one phase is one implementer dispatch (sonnet tier). Each phase ends with
`pnpm ci:check` green and a commit led by `TASK-0049:`. DB phases run with
`REQUIRE_DATABASE=1` on the worktree's own stack, exporting only `TEST_DATABASE_URL`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an open task).
- **[Story]**: US1 approval, US2 objection, US3 DM override, US4 play route.

---

## Phase 1: The sign-off rule and commit authority (pure core)

**Goal**: one pure rule decides the quorum; `commitAuthority` uses it (ruling FT-1 A).
Covers US1, US2 and US3 at the rule level.

**Independent test**: `pnpm --filter @the-stacks/session-model test` green, with the new
`gate-signoff` suite and the extended `gate-authority` suite.

- [ ] T001 [US1] Create `packages/session-model/src/gate/signoff.ts` with `signoffState`, `SignoffRow`, `SignoffState`, `SignoffStance` exactly as in `specs/044-group-signoff/contracts/signoff.md` ("The rule"): party humans from `p.party`, latest `approve`/`object` stance per user from `action.comments`, declarer defaults to `approve`, `actingUserId` added to the present set and counted as approving, `null` for an unknown or character-scope action.
- [ ] T002 [US1] Change `commitAuthority` in `packages/session-model/src/gate/authority.ts` to take `present?: readonly string[]` and return `GROUP_SIGNOFF_REQUIRED` with `waiting` and `objecting`, per the contract's "Commit authority" section. Keep steps 1–3 and 5 unchanged. Keep the one-human `group` branch unchanged.
- [ ] T003 Export `signoffState` and its types from `packages/session-model/src/index.ts`; add them to the list in `packages/session-model/test/exports.test.ts`.
- [ ] T004 [P] [US1] Write `packages/session-model/test/gate-signoff.test.ts`: two and three humans; all approve → `met`; one waiting → not met with `waiting`; an absent human excluded; the acting human counted; a `comment` stance ignored; latest stance wins (object then approve); a companion's comment ignored; a character-scope action → `null`.
- [ ] T005 [P] [US2] Extend `packages/session-model/test/gate-authority.test.ts`: with `present`, an objector yields `GROUP_SIGNOFF_REQUIRED` with `objecting: [id]`; without `present`, more than one human yields `GROUP_SIGNOFF_REQUIRED` with every other human in `waiting`; existing cases unchanged.
- [ ] T006 [P] [US3] Extend `packages/session-model/test/gate-authority.test.ts`: the seated human DM and `ai:dm` get `dm` on an open party action with an outstanding objection, with and without `present`.
- [ ] T007 Amend `specs/029-proposal-gate/contracts/policy-and-authority.md`: add an "Amendment (TASK-0049)" paragraph citing the 2026-10-27 ruling; rewrite step 4 to the contract's text; replace "Objections recorded as `object` comments are advisory in M2" with the blocking rule; update the `CommitDecision` type block.

**Checkpoint**: the rule is pure, tested and exported. Nothing else calls `present` yet.

---

## Phase 2: The planner, the marker rows and the fixture

**Goal**: the planner writes the `signoff` marker with every multi-human `group` commit and
auto-commits on the completing approval (rulings FT-2 A, FT-3, FT-4, Q3 C).

**Independent test**: `pnpm --filter @the-stacks/session-model test` green, with SC-006
replaying the new `group-signoff` fixture.

- [ ] T008 [US1] Add `PlanContext` and the trailing optional `context?: PlanContext` parameter to `planProposal` in `packages/session-model/src/gate/plan.ts`; export `PlanContext` from `src/index.ts`.
- [ ] T009 [US1] In `plan.ts`, `action.commit`: call `commitAuthority(p, proposer, actionId, context?.present)`; for authority `group` with more than one party human, plan `[presence.recorded, action.committed]` with the marker built per the contract (actor `system`, visibility `public`, `present` = sorted unique `context.present` ∪ {committer}, `purpose: "signoff"`, `actionId`).
- [ ] T010 [US1] In `plan.ts`, `action.comment`: when the contract's auto-commit condition holds (stance `approve`, proposer a party human, more than one party human, open party action, quorum met after folding the comment), plan `[action.commented, presence.recorded, action.committed]` with authority `group` and actor the proposer. Otherwise plan the single row as today.
- [ ] T011 [US2] In `plan.ts`, copy `waiting` and `objecting` into `GateRefusal.details` on `GROUP_SIGNOFF_REQUIRED`.
- [ ] T012 [P] [US1] Extend `packages/session-model/test/gate-plan.test.ts`: rows for a two-human explicit group commit; rows for the completing approval; a single-human party plans exactly today's rows for commit and approve (FR-014); an approve that leaves the quorum unmet plans one row; an `object` never commits; refusal `details` on an objection.
- [ ] T013 [US1] Create `packages/session-model/src/fixtures/group-signoff.ts` and register it in `src/fixtures/index.ts`: two players (Ana, Cleo) and one companion in the party, AI seat; Ana declares party action P1; Cleo objects; Cleo approves; the batch `[action.commented, presence.recorded(signoff, [Ana, Cleo]), action.committed(group)]`; Ana declares party action P2; Cleo objects; `ai:dm` commits P2 with `dm`. Original text only.
- [ ] T014 [US1] Amend the SC-006 test in `packages/session-model/test/gate-authority.test.ts` to pass `present` from the latest `presence.recorded` row with purpose `signoff` and the same `actionId` before each commit, when one exists.
- [ ] T015 [P] [US1] Add `group-signoff` facts to `packages/session-model/test/fixtures.test.ts` (clean diagnostics, P1 committed `group`, P2 committed `dm`, the marker's `present`) and update the fixture-name list.
- [ ] T016 Amend `specs/029-proposal-gate/contracts/gate-api.md` (§1 signature and the `action.comment`/`action.commit` rows, §2 `details`, §3 step 2 fills the context) and `specs/029-proposal-gate/contracts/fixtures.md` (the `group-signoff` row and its facts; check 4 wording), each with an "Amendment (TASK-0049)" paragraph.

**Checkpoint**: the pure gate core implements the whole feature; fixtures replay.

---

## Phase 3: Server gate wiring and the two-seat DB test (merge condition)

**Goal**: the live gate feeds the present set to the planner; a real-Postgres test with two
human seats proves approval, objection and DM override (AC #2, #3, #4, #6).

**Independent test**: `REQUIRE_DATABASE=1` run of `apps/server/test/gate.signoff.integration.test.ts` on the worktree stack, green.

- [ ] T017 [US1] In `apps/server/src/gate/gate.ts`, pass `{ present: presence.presentUsers(sessionId).map((e) => e.userId) }` as the context to every `planProposal` call (direct/auto, the ask/suggest legality check, and `proposal.approve`). Keep `submit`, `handle` and `recordPresence` signatures unchanged.
- [ ] T018 [US1] Create `apps/server/test/gate.signoff.integration.test.ts`, modelled on `gate.presence.integration.test.ts` (loud skip, throw under `REQUIRE_DATABASE=1`, fresh session id per test, injected `PresenceReader`). Seat two human players in the party: approval by the second auto-commits; the stored batch holds the `signoff` marker naming both, then `action.committed` `group`; `onAppended` gets the three rows in order.
- [ ] T019 [US2] In the same file: the second player objects; the first's explicit commit refuses `GROUP_SIGNOFF_REQUIRED` with `details.objecting` naming the objector; the log is unchanged; a later approve commits.
- [ ] T020 [US1] In the same file: three humans, one absent from the reader; both present approve → commits; the marker omits the absent one.
- [ ] T021 [US3] In the same file: a seated human DM commits over an objection (`dm`, no marker); with the AI seat, `gate.submit` as `ai:dm` commits with `dm`; the seated DM withdraws an open party action and a later approval refuses `ACTION_NOT_OPEN`.
- [ ] T022 [US1] Add a case to `apps/server/test/dm/companion-react.integration.test.ts`: a companion-declared party action auto-committed by human approvals queues one `commit` turn and no `react` job (plan D8). Change `apps/server/src/dm/enqueue.ts` only if this case fails.

**Checkpoint**: merge condition met. Record the passing run in the phase commit message.

---

## Phase 4: The play route shows sign-off (US4)

**Goal**: per-player sign-off rows and own-row Approve/Object on every open party-scope
action card (AC #5). No modal (FR-010). Browser automation uses Brave.

**Independent test**: `pnpm --filter @the-stacks/web test` green, including
`no-dialog.test.mjs`; Brave screenshot of `play/fixtures` on `group-signoff`.

- [ ] T023 [US4] Create `apps/web/app/play/signoff.ts`: `signoffRows(action, party, present, viewer, label)` mapping `signoffState` to `{ userId, label, state: "approved" | "objects" | "waiting" | "absent", isViewer }`; `present === null` shows every party human as present (plan D9).
- [ ] T024 [US4] Add a `present: readonly string[] | null` argument to `commitAuthorityFor` in `apps/web/app/play/authority.ts` and pass it to `commitAuthority`, so a player sees the commit control once the quorum is met. When `present` is null, pass nothing (today's behaviour).
- [ ] T025 [US4] In `apps/web/app/play/view-model.ts`, add `signoff: SignoffRowView[] | null` to the action card view (null for character scope and closed actions), fed by the present ids; thread the ids from `table-view.tsx` (`source.presence`) and `use-fixture-table.ts` (`fixturePresence`).
- [ ] T026 [US4] In `apps/web/app/play/components/action-card.tsx`, render a "Sign-off" list inside the card under the comments: one row per entry with label and state; the viewer's own row carries Approve and Object buttons that call the existing `onComment` with that stance. No `<dialog>`, no overlay.
- [ ] T027 [P] [US4] Write `apps/web/test/play/signoff.test.mjs`; extend `authority.test.mjs`, `view-model.test.mjs` and `action-card.test.tsx` (rows render; Approve sends stance `approve`; absent row marked; character-scope card has no rows).
- [ ] T028 [US4] Amend `specs/030-play-route/contracts/proposal-seam.md` with one "Amendment (TASK-0049)" line: the sign-off props on the action card are additive (ruling Q4); `CommitAuthority` is unchanged.
- [ ] T029 [US4] Capture Brave screenshots (light and dark) of `play/fixtures` on `group-signoff` with one row approved and one waiting; save them under `specs/044-group-signoff/evidence/`.

**Checkpoint**: all four stories demonstrable.

---

## Phase 5: Wiki re-ground

**Goal**: the grounding wiki describes the merged behaviour, re-pinned honestly.

- [ ] T030 Review and amend `docs/wiki/proposal-gate.md` (NEEDS-REVIEW): commit authority quorum, `PlanContext`, the three-row auto-commit batch, refusal details, the `signoff` purpose now written.
- [ ] T031 [P] Review and amend `docs/wiki/session-model.md` (NEEDS-REVIEW): `signoffState`, the `group-signoff` fixture, the SC-006 amendment.
- [ ] T032 [P] Review and amend `docs/wiki/play-route.md` (NEEDS-REVIEW): `signoff.ts`, the sign-off rows, `commitAuthorityFor`'s present argument.
- [ ] T033 [P] Update `docs/wiki/presence.md`: `signoff` is written by the gate in the commit batch; only `floor` stays reserved (TASK-0050).
- [ ] T034 Update the state paragraph in `docs/wiki/INDEX.md`; regenerate `docs/wiki/CAPSULES.md` if any `description:` changed; classify each staled pin as RE-PIN-ONLY or NEEDS-REVIEW against `git diff <old-pin>..HEAD -- <sources>` and re-pin.
- [ ] T035 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` (prints `OK`) and `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` (exits 0).

---

## Dependencies & execution order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5, strictly serial (each phase builds on
  the previous one's exports).
- Phase 4 depends on Phases 1–2 only and could start after Phase 2, but runs after Phase 3
  so the live path is proven before the UI is.
- Within a phase, [P] tasks touch different files and may run together.

## Implementation strategy

MVP is Phases 1–3: the gate enforces sign-off and the merge condition is met. Phase 4 makes
it visible (AC #5). Phase 5 re-grounds. One PR for the whole task.

## Out of scope

- The AI DM's policy for overriding a stalled sign-off: TASK-0050 (ruling Q5).
- A DM rescope event (ruling Q1 option C, not chosen).
