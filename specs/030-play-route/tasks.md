# Tasks: First Scene — play route: composer, commit control, ledger, DM approvals

**Input**: `specs/030-play-route/` — spec.md, plan.md, research.md, data-model.md, contracts/,
quickstart.md.

**Tests**: requested. The card's ACs and the runbook's gates need test proof (commit authority per
decision-0016 row, secrecy, no modals, client-only, AC #7 equivalence).

**Dispatch**: one `sonnet-implementer` dispatch per phase, re-grounded from this directory and the
branch's commits. Every dispatch prompt states: no modals (slide-out panels or autocomplete
dropdowns only); browser automation uses Brave; no backlog MCP tools (use the `backlog` CLI inside
the worktree). The orchestrator may group adjacent phases into one dispatch and records the grouping
in the runbook log.

**Format**: `- [ ] T### [P?] [US?] Description with file path`. `[P]` = different files, no open
dependency.

All paths are relative to the repository root.

---

## Phase 1: Setup — package wiring and test runner

**Purpose**: `apps/web` can import the session model and run TSX markup tests.

- [x] T001 Add `"@the-stacks/session-model": "workspace:*"` to `dependencies` and `"vitest": "^5.0.1"` to `devDependencies` in `apps/web/package.json`; set `"test": "node --test && vitest run"`; run `pnpm install` and confirm `pnpm-lock.yaml` adds no new package outside the workspace (vitest is already resolved).
- [x] T002 Add `{ "path": "../../packages/session-model" }` to `references` in `apps/web/tsconfig.json`; confirm `pnpm --filter @the-stacks/web typecheck` passes.
- [x] T003 Create `apps/web/vitest.config.ts`: include only `test/**/*.test.tsx`, resolve `~` to `app/`, automatic JSX runtime, `environment: "node"`. Confirm `node --test` in `apps/web` does not collect `.test.tsx` files.
- [x] T004 [P] Create the type-only seam modules `apps/web/app/play/source.ts` (contracts/table-source.md) and `apps/web/app/play/proposals.ts` (contracts/proposal-seam.md: `PendingProposalView`, `ProposalCommands`, `SelectPendingProposals`, and `liveProposals` returning `[]`). Erasable TypeScript only.

**Checkpoint**: `pnpm --filter @the-stacks/web typecheck` and `test` pass; a placeholder `apps/web/test/play/smoke.test.tsx` rendering `<p>ok</p>` passes under vitest (delete it in Phase 3).

---

## Phase 2: Foundational — pure view-model modules

**Purpose**: every derived value the components render, as pure, tested functions. Blocks all story
phases. Modules are erasable TypeScript; tests are `node:test` `.test.mjs` files importing the `.ts`
modules directly (sibling standard: `apps/web/test/turns.test.mjs`).

### Tests first

- [x] T005 [P] Write `apps/web/test/play/authority.test.mjs`: one case per decision-0016 row (research R6) — free-mode declarer; free-mode other player (holder = declarer); turn-mode active player on own action; turn-mode non-active player; turn-mode active player on another actor's action; DM in each mode; party-scope with the player controlling a member (`group`); committed and resolved actions (no control).
- [x] T006 [P] Write `apps/web/test/play/ledger-format.test.mjs`: `changedFields` on scalars, nested objects to depth 3, arrays as whole JSON, `null` before ("none") and `null` after; `toLedgerItems` on `freeModeAction` (one roll with reason "Ana picks the vault lock", face 13, total 18; one check outcome; the `combatant.added` changes) and `turnModeCombat` (goblin `hp.current` before and after).
- [x] T007 [P] Write `apps/web/test/play/frames.test.mjs`: each builder returns the contracts/live-frames.md frame; text is trimmed; an empty text or a bad id returns `null`; action ids match `act-` + UUID and parse with `RefIdSchema`; no frame carries `actor`, `seq` or `ts`.
- [x] T008 [P] Write `apps/web/test/play/local-log.test.mjs`: `appendLocal` assigns last seq + 1, last ts + 1 s, the given actor, `public`; never mutates its input.
- [x] T009 [P] Write `apps/web/test/play/reduce-frame.test.mjs`: `reduceFrame` appends `event` frames in arrival order, tracks the highest seq with `Math.max` across gaps, flips `caughtUp` on `replay-complete`, sets `notice` on `error`.
- [x] T010 [P] Write `apps/web/test/play/view-model.test.mjs`: for every fixture and every listed viewer, `toTableViewModel(project(events, viewer), …)` returns without throwing (SC-001); `talkOnly` as the first player has no whisper item, as the other player has one; `turnModeCombat` mode after each `table-mode.changed` (free → turn with Ana, `isViewersTurn` for the first player → turn with Bram → free); `secretTracker` as each player serializes to JSON containing no tracker id, hidden roll reason or DM journal title (SC-004); `unknownAndInvalid` `hiddenCount` is 5; a player viewer's `proposals` is `[]` even when the input holds some; `composer.actionAvailable` is false for the DM; a 1,000-event synthetic talk log projects and maps in under 50 ms.

### Implementation

- [x] T011 [P] Implement `apps/web/app/play/labels.ts` (`actorLabel`, `characterLabel`: party lookup; `ai:dm` → "DM"; the viewer's own actor → "You"; unknown → the raw id).
- [x] T012 [P] Implement `apps/web/app/play/authority.ts` (`commitAuthorityFor`, `CommitAuthority`) per research R6.
- [x] T013 [P] Implement `apps/web/app/play/ledger-format.ts` (`changedFields`, `toLedgerItems`, `LedgerItem`) per research R7 and data-model.md.
- [x] T014 [P] Implement `apps/web/app/play/frames.ts` (`talkFrame`, `declareFrame`, `commentFrame`, `commitFrame`), parsing each payload with `TalkV1`, `ActionDeclaredV1`, `ActionCommentedV1`, `ActionCommittedV1` and versions from `currentVersion`.
- [x] T015 [P] Implement `apps/web/app/play/local-log.ts` (`appendLocal`) per research R13.
- [x] T016 [P] Implement `apps/web/app/play/reduce-frame.ts` (`reduceFrame(state, frame)` over `{ events, highestSeq, caughtUp, notice }`).
- [x] T017 Implement `apps/web/app/play/view-model.ts` (`toTableViewModel` and its types per data-model.md), using T011–T013.

**Checkpoint**: `pnpm --filter @the-stacks/web test` green; every T005–T010 case passes.

---

## Phase 3: User Stories 1, 2, 3 (P1) — composer, action cards and commit, table mode; fixture harness (US6)

**Goal**: the table renders from any fixture as any viewer; a player sends talk, declares,
comments and commits; the mode badge shows the active player.

**Independent test**: quickstart §2 rows "Composer and card", "Other player", "Turn mode", "Step".

### Tests first

- [x] T018 [P] [US1] Write `apps/web/test/play/composer.test.tsx` (vitest): the "Message type" radio group with Talk and Action; Talk shows the "Channel" group; Action shows the character choice and the "Scope" group; Action is disabled with a hint when `actionAvailable` is false; the send button reads "Send" or "Declare".
- [x] T019 [P] [US2] Write `apps/web/test/play/action-card.test.tsx`: an open card shows comments with stance and the comment form; `CommitControl` renders "Commit" when `canCommit` and "Waiting for <holder> to commit" otherwise; a committed card shows no form and no control; a resolved refused card shows the refusal code.
- [x] T020 [P] [US3] Write `apps/web/test/play/mode-badge.test.tsx`: "Free mode"; "Turn mode · Ana's turn"; "Turn mode · Your turn".
- [x] T021 [P] [US6] Write `apps/web/test/play/table-view.test.tsx`: `TableView` with a fixture-built source renders for every fixture and viewer; the markup contains no `<dialog` and no `aria-modal` (AC #6); a player's markup for `freeModeAction` has no "Pending proposals" trigger; the DM's has one.

### Implementation

- [x] T022 [P] [US3] Implement `apps/web/app/play/components/mode-badge.tsx`.
- [x] T023 [P] [US2] Implement `apps/web/app/play/components/commit-control.tsx` and `apps/web/app/play/components/action-card.tsx` (inline comment form with stances Comment, Approve, Object).
- [x] T024 [P] [US1] Implement `apps/web/app/play/components/composer.tsx` (radio groups per contracts/ui-surfaces.md; keeps the draft on type switch; clears it only when the command returns `true`; shows `notice` inline).
- [x] T025 [US1] Implement `apps/web/app/play/components/transcript.tsx` (talk with IC/OOC/whisper markers, narration, action cards) and `apps/web/app/play/components/table-header.tsx` (scene, `ModeBadge`, status, panel triggers styled like the Sources button with `aria-expanded`/`aria-controls`; the approvals trigger only for the DM; icons added to `apps/web/app/components/icons.tsx`).
- [x] T026 [US1] Implement `apps/web/app/play/table-view.tsx` (`TableView({ source })`: memoised `project` + `toTableViewModel`; wires composer, cards and header to `source.commands`; "N entries not shown" notice; panel triggers toggle state only — panels arrive in Phase 4).
- [x] T027 [US6] Implement `apps/web/app/play/use-fixture-table.ts` (contracts/table-source.md; `local` and decided proposals reset when `viewerKey` or `through` changes) and `apps/web/app/play/fixtures/proposals.ts` (at least two original example proposals each for `free-mode-action` and `turn-mode-combat`).
- [x] T028 [US6] Implement `apps/web/app/play/components/fixture-toolbar.tsx` (fixture name, "View as" segmented control over `fixture.viewers`, ◂ seq n/N ▸ stepper, "Fixture — changes are local").
- [x] T029 [US6] Add `route("play/fixtures", "routes/play-fixtures.tsx")` and `route("play/fixtures/:fixtureName", "routes/play-fixture.tsx")` to `apps/web/app/routes.ts`; implement both routes client-only (`clientLoader` + `HydrateFallback`, no `loader`), the fixture module imported dynamically in `clientLoader` (research R12), `OperatorOnly` for non-operators, "No such fixture" with a link back; viewer and step read from the `as` and `through` query parameters.
- [x] T030 [US6] Add an operator-only "Preview fixtures" link to `apps/web/app/routes/table.tsx`; delete `apps/web/test/play/smoke.test.tsx`.

**Checkpoint**: `pnpm --filter @the-stacks/web test` green; quickstart §2 composer, card, mode and
step rows pass in Brave against `pnpm dev`.

---

## Phase 4: User Stories 4 and 5 (P2) — ledger panel and DM approval panel

**Goal**: the ledger lists every roll with its reason and every change with before and after; the DM
approves or rejects each pending proposal.

**Independent test**: quickstart §2 rows "Ledger", "Before/after", "Secrecy", "Approvals", "Player has
no approvals".

### Tests first

- [x] T031 [P] [US4] Write `apps/web/test/play/ledger-list.test.tsx`: `LedgerList` for `freeModeAction` shows the roll's reason, expression `1d20+5`, face 13, total 18 and the check outcome; for `turnModeCombat` shows the goblin's `hp.current` before → after; `secretTracker` as a player has no hidden roll, as the DM shows it marked DM-only; a creation shows "none" before.
- [x] T032 [P] [US5] Write `apps/web/test/play/proposal-list.test.tsx`: each proposal shows summary, kind, proposer label, action and details; Approve calls `onApprove(id)`; Reject expands an inline reason field and its confirm calls `onReject(id, reason | null)`; empty list shows "No pending proposals". Interaction is tested by calling the exported handlers' wiring through a small pure helper or by asserting rendered button names; no DOM library.
- [x] T033 [P] [US5] Add to `apps/web/test/play/use-fixture-table.test.mjs` (node:test, against the pure reducer the hook uses): approve and reject remove the proposal; a player viewer receives `[]`.

### Implementation

- [x] T034 [P] [US4] Implement `apps/web/app/play/components/ledger-list.tsx` (roll, outcome and change rows; struck-through dropped faces; DM-only marker; newest last).
- [x] T035 [P] [US5] Implement `apps/web/app/play/components/proposal-list.tsx` (inline reject reason and confirm; no confirmation modal).
- [x] T036 [US4] Mount both lists in `apps/web/app/play/table-view.tsx` inside the shared `Panel` (`apps/web/app/components/panel.tsx`), titles "Ledger" and "Pending proposals", ids matching the triggers' `aria-controls`; the proposals panel and trigger only for the DM; the count on the trigger; panels stay open across new events.

**Checkpoint**: `pnpm --filter @the-stacks/web test` green; quickstart §2 ledger and approvals rows
pass in Brave, desktop and 390 px (bottom sheets).

---

## Phase 5: User Story 7 (P1) — the live table, AC #7 proof, gates and fixture evidence

**Goal**: the live route renders through the same `TableView`; equivalence, client-only and no-modal
gates are tests; fixture screenshots are taken.

**Independent test**: quickstart §3 and §5 `--mode fixtures`.

### Tests first

- [x] T037 [P] [US7] Write `apps/web/test/play/equivalence.test.tsx` (vitest): for every fixture and viewer, events fed one frame at a time through `reduceFrame` and handed to a live-shaped source produce the same `toTableViewModel` output and the same `TableView` markup (status text excepted) as the fixture source (SC-002).
- [x] T038 [P] [US7] Write `apps/web/test/play-surfaces.test.mjs` (node:test, file reads and grep): only `app/components/panel.tsx` imports `components/ui/sheet`; no `fixed inset-0`, `localStorage` or `sessionStorage` under `app/play/`; `routes/play.tsx`, `routes/play-fixtures.tsx` and `routes/play-fixture.tsx` export `clientLoader` and `HydrateFallback` and no `loader`; `routes/play.tsx` and `routes/play-fixture.tsx` render `TableView` and import no module from `app/play/components/` except `fixture-toolbar` (fixture route only).
- [x] T039 [P] [US7] Extend `apps/web/test/ssr.test.mjs`: `/play/<uuid>`, `/play/fixtures` and `/play/fixtures/free-mode-action` return the `HydrateFallback` text and contain no "Message type" markup (SC-007).

### Implementation

- [x] T040 [US7] Refactor `apps/web/app/ws/useSession.ts`: route every inbound frame through `reduceFrame` (T016); replace `send(text)` with `sendEvent(frame)` per contracts/live-frames.md; expose `notice`. Keep the `/auth/me` preflight, retry and cleanup unchanged.
- [x] T041 [US7] Implement `apps/web/app/play/use-live-table.ts` (viewer from the root user per research R4; commands via `play/frames.ts` and `sendEvent`; proposals from `liveProposals`; approve and reject return `false`).
- [x] T042 [US7] Rewrite `apps/web/app/routes/play.tsx`: `clientLoader` + `HydrateFallback` kept; the component renders `<TableView source={useLiveTable(sessionId, user)} />` and nothing else from `app/play/`.
- [x] T043 [US7] Write `specs/030-play-route/evidence/seed-live.mjs`: copies one fixture's rows into a fresh session on the worktree stack's database (the log's `append`/`appendBatch` seam via `--experimental-strip-types`, as `check:host-scripts` imports server modules), mapping `fixtureIds.playerUserId` to a given real user id; prints the session URL. Run it only against the worktree stack.
- [x] T044 [US7] Write `specs/030-play-route/evidence/shoot.mjs`: out-of-tree `playwright-core` (never in any `package.json`) launching **Brave** by `executablePath`; `--mode fixtures` captures 1280 px and 390 px in light and dark for: free-mode as the player with an open action, turn-mode at Ana's turn, the ledger panel, the approvals panel as the DM; `--mode live` signs in both accounts and captures the same surfaces on a live table after driving talk, declare, comment and commit through the UI. Output to `specs/030-play-route/evidence/shots/`.
- [x] T045 [US7] Run quickstart §3 by hand in two Brave windows on the worktree stack (`pnpm env:up`; migrate per TASK-0098) and record the outcome in `specs/030-play-route/evidence/live-check.md`.
- [x] T046 Run `node specs/030-play-route/evidence/shoot.mjs --mode fixtures`; commit the PNGs; confirm the text in each meets WCAG AA (`apps/web/test/contrast.test.mjs` passes for any new token).
- [x] T047 Run `pnpm ci:check` in the worktree; save its tail to `specs/030-play-route/ci-evidence.txt`; `pnpm env:down`.

**Checkpoint**: everything except the live proposal path is done. The orchestrator opens the PR as
**draft** (runbook: held until TASK-0045 merges).

---

## Phase 6: Proposal wiring — GATED on TASK-0045's merge

**Gate**: do not dispatch this phase until `gh api repos/evanstern/the-stacks/pulls/<TASK-0045 PR> --jq .merged` prints `true`. Then read TASK-0045's `specs/NNN-*/contracts/` on `origin/main` for its proposal events, projection (if any), approve/reject interface, player-action write path and authority rule. Change only the modules contracts/proposal-seam.md names; a needed change to a component prop or a seam type is a spec amendment, not an implementer decision — STOP and report.

- [x] T048 [US5] Merge `origin/main` into `task-0047-play-route` (a merge commit; never rebase); resolve conflicts in `apps/web/app/routes.ts`, `apps/web/app/routes/play.tsx` and `pnpm-lock.yaml` by keeping both sides' intent; re-run `pnpm install`.
- [x] T049 [P] [US5] Write `apps/web/test/play/proposals.test.mjs`: `selectPendingProposals` maps TASK-0045's proposal events (or projection) to `PendingProposalView` — pending ones listed oldest first, decided ones absent, `[]` for every player viewer — using TASK-0045's fixtures or events built from its schemas.
- [x] T050 [US5] Implement `selectPendingProposals` in `apps/web/app/play/proposals.ts` against TASK-0045's types; replace `liveProposals` with it in `apps/web/app/play/use-live-table.ts`.
- [x] T051 [US5] Wire live `approve` and `reject` in `apps/web/app/play/use-live-table.ts` (and builders in `apps/web/app/play/frames.ts`) to TASK-0045's documented interface; update `specs/030-play-route/contracts/live-frames.md` with the new rows.
- [x] T052 [US7] If TASK-0045 binds a different write path for player actions or commits, change `apps/web/app/play/frames.ts` and `apps/web/app/play/use-live-table.ts` to use it; T007 and T037 stay green.
- [x] T053 [US2] If TASK-0045 exports its commit-authority rule from a client-importable package, make `apps/web/app/play/authority.ts` call it; keep T005 green or amend it with a note citing TASK-0045's table.
- [x] T054 [US5] If TASK-0045 ships proposal event fixtures, derive fixture-mode proposals through `selectPendingProposals` in `apps/web/app/play/use-fixture-table.ts` and delete `apps/web/app/play/fixtures/proposals.ts`; otherwise keep it and say so in the PR body.
- [x] T055 [US7] On the worktree stack, raise an `ask` proposal through TASK-0045's path, confirm it appears only in the operator's Pending proposals panel (two DM windows if possible) and never in the player's, approve one and reject one, and append the outcome to `specs/030-play-route/evidence/live-check.md`.
- [x] T056 [US7] Run `node specs/030-play-route/evidence/shoot.mjs --mode live` (Brave; light and dark; 1280 and 390 px; including the approval panel with a live pending proposal); re-run `--mode fixtures` if any fixture-mode surface changed; commit the PNGs.
- [x] T057 Run `pnpm ci:check` green in the worktree; refresh `specs/030-play-route/ci-evidence.txt`; walk quickstart.md end to end and tick every task here; `pnpm env:down`.

**Checkpoint**: `pnpm ci:check` green; fixture and live screenshots (Brave, light and dark) ready to
attach to the PR (runbook merge condition). The orchestrator runs the wiki re-ground
(`chat-ui`, `react-router-app`, `client-session-hook`, new `play-route` note) and the spec-bridge
sync, then marks the PR ready.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6, one dispatch each.
- Phases 1–5 need only TASK-0044 (merged). **Phase 6 needs TASK-0045 merged** and is the only phase
  that may read TASK-0045's artifacts.
- Phase 3 needs Phase 2's view model. Phase 4 needs Phase 3's `TableView`. Phase 5 needs both
  panels (its screenshots show them).
- Within a phase, `[P]` tasks touch different files; test tasks precede their implementation.

### Parallel examples

- Phase 2: T005–T010 are separate test files; T011–T016 are separate modules; T017 joins them.
- Phase 3: T018–T021 separate test files; T022–T024 separate components.
- Phase 4: T031–T033 and T034–T035.

## Implementation Strategy

MVP is Phases 1–3: a fixture-fed table where a player talks, declares and commits, with the mode
badge (AC #1, #2, #3, #6, #8 on fixtures). Phase 4 adds AC #4 and AC #5 on fixtures. Phase 5 makes the
live route use the same components and proves AC #7, leaving the PR in draft. Phase 6 completes
AC #5 and AC #7 on the live log once TASK-0045 has merged.

## Notes

- No new runtime dependency; one dev dependency (`vitest`, already in the lockfile). Any other
  package need is an operator checkpoint: STOP and report.
- No "for now": every deferral names its card — group sign-off TASK-0049, floor passing TASK-0050,
  presence TASK-0051, narrator chime-in TASK-0052, maps M6 (decision-0013), proposal wiring this
  task's Phase 6.
- Fresh worktree stacks come up unmigrated (TASK-0098): run the server's `db:migrate` after
  `pnpm env:up`.

## Deviations

- Phase 2: pure modules import each other with explicit `.ts` extensions (for example
  `./labels.ts`), because `node --test` cannot resolve extensionless relative imports. Added
  `"allowImportingTsExtensions": true` to `apps/web/tsconfig.json` (`noEmit` is already set).
  Type-only imports in other modules keep the sibling style.
- Phase 2: `commitAuthorityFor` returns `holder` as an actor id (or `null`); `toTableViewModel`
  maps it to `holderLabel` for `CommitAuthority` in the view model. `toTableViewModel` takes
  `(projections, { actor, proposals })`.
- Phase 2: `frames.ts` types its schemas with a local `safeParse` interface, because `zod` is not
  a direct dependency of `apps/web`.
- Phase 3: `Composer` takes an optional `initialType` prop (default `"talk"`), a test seam so
  markup tests can render the Action state; no component props from the contract changed.
- Phase 3: the DM commit button reads "Commit as DM"; other authorities read "Commit"
  (contracts/ui-surfaces.md). `useFixtureTable` takes a fourth argument `dmActor`, supplied by the
  fixture route's `clientLoader`, so the hook stays out of the fixtures chunk.
- Phase 3: the toolbar's View-as and Step groups are `<fieldset>`s (biome `useSemanticElements`).
- Phase 5: `seed-live.mjs` imports the built server (`apps/server/dist`) and the built fixtures,
  not `--experimental-strip-types` on source, because source imports carry `.js` suffixes that
  Node's type stripping cannot resolve. It targets the app database (`DATABASE_URL`, host port
  `DB_PORT`), not `TEST_DATABASE_URL`. It also maps `fixtureIds.dmActor` to an optional operator id.
- Phase 5: `shoot.mjs --mode live` drives a table seeded by `seed-live.mjs` (`--live-url`), because a
  fresh table has no party member and the player could not declare an action. The two-window live
  check in `evidence/live-check.md` was driven by that script in two Brave contexts, not by hand;
  reload and stop/start reconnect were not exercised there.
- Phase 5: `playwright-core` is loaded from outside the repo via `PLAYWRIGHT_CORE`
  (a path beside its `node_modules`); it is in no `package.json`.
- Phase 5: `useSession` now exposes `sendEvent`/`notice` and maps inbound frames through
  `reduceFrame`; live `approve`/`reject` return `false` until Phase 6.
- Phase 6: T052 changed the live wire. TASK-0045's gate refuses any catalog type sent directly
  (`CATALOG_TYPE_REQUIRES_GATE`), so `frames.ts` now sends gate requests (`talk`, `action.declare`,
  `action.comment`, `action.commit`, `proposal.approve`, `proposal.reject`; contracts/live-frames.md).
  `frames.test.mjs` (T007) payload expectations changed to the request shape; `localEventOf` maps
  a request frame back to a catalog event so fixture mode still appends locally.
- Phase 6: `reduceFrame` and `ErrorFrame` carry the optional `code`; the notice reads
  "message (CODE)".
- Phase 6: T053 calls `commitAuthority` for player viewers only (over a minimal projection stub of
  `actions`, `party`, `tableMode`, `gate`); the DM branch stays local because a viewer role does
  not say who holds the DM seat. T005 stays green. A party action with several human players now
  shows no commit control (`GROUP_SIGNOFF_REQUIRED`, TASK-0049).
- Phase 6: T054 deleted `fixtures/proposals.ts`. Fixture proposals come from the `dm-approvals`
  fixture (3 pending); `free-mode-action` and `turn-mode-combat` now show none. The approvals
  screenshot uses `dm-approvals`. Tests that counted proposals now use `dm-approvals`.
- Phase 6: a `suggest` proposal (for example `scene`) stays in the pending list; Approve on it
  returns `PROPOSAL_NOT_APPROVABLE`, shown in the notice. Reject works. The component props are
  unchanged.
- Phase 6: `seed-live.mjs dm-approvals` seats the operator as DM (maps `dmUserId`) and raises one
  `ask` narration proposal through `gate.submit` as `ai:dm`.
