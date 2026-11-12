# Implementation Plan: One composer, one Send, Enter commits in combat (web)

**Tasks: 35 in 5 phases** (3 sonnet dispatches, 1 wiki dispatch, 1 [orchestrator] phase).

**Branch**: `task-0315-one-composer` · **Spec**: `spec.md` · **Card**: TASK-0315
**Authored against**: `origin/main` `468069b8`, which carries the upstream merge `3fe09541`
(PR #170, TASK-0199, spec 066 server half). Design input: spec 066 plan.md D4.

## Summary

Replace the Talk/Action composer with one composer and one Send. Send parses each line with
`parse()` from `@the-stacks/intent` and sends one `intent` request. In turn mode the active
player's prose goes as `action.declare` then `action.commit`, and the action card loses the
player's Commit. The client draws the ring, Thinking and the confirm row from projection helpers
that `3fe09541` already exports (`readablePosts`, `suggestionState`, `SuggestionView`).

## Technical Context

- **Language**: TypeScript, React 19, React Router (`apps/web`).
- **Dependencies used**: `@the-stacks/intent` (`parse`, `toText`, `IntentSchema`) and
  `@the-stacks/session-model` (`readablePosts`, `suggestionState`, `RING_BLANK_MS`,
  `READ_QUIET_MS`, `ProposalSchema`). Both are already `apps/web` dependencies.
- **New runtime dependencies**: none. **New dev dependencies**: none. **Migrations**: none.
- **Testing**: `node --test` (`*.test.mjs`) and `vitest` with `renderToStaticMarkup` (`*.test.tsx`).
- **Server changes**: none. Every gate rule this card relies on shipped in `3fe09541`.

## Constitution Check (3.0.0)

| Principle | Check | Result |
|---|---|---|
| I. Agent-operable | The composer emits the same `intent`, `action.accept` and `action.suggest` requests an agent sends. Kinds used: `say`, `ooc`, `ask_dm`, `attempt` and every parsed slash kind. No human-only path. | Pass |
| II. One Intent vocabulary | Typed text goes through `parse()`; no separate write path. The client never calls `planIntent` or the engine. Fixture mode appends carrier rows only (spec OQ-1). The active player's prose rides `action.declare` + `action.commit`, the frozen C-7 path that spec 066 OQ-2 ruled. | Pass, with OQ-1 |
| III. Server authority | The client sends requests; the gate decides. No optimistic world state. | Pass |
| V. One state | Ring, Thinking and confirm state derive from the projection plus the clock (FR-W2). No client store. | Pass |
| IX. UX bar | No modals: listboxes are inline autocomplete dropdowns; the interrupt strip and DM editor are inline. 1280 px and 390 px checked. Every control is keyboard-reachable; the ring and Thinking are `role="status"`. Confirm states are words, not colour. Combat uses explicit turns: no ring in turn mode. | Pass, with OQ-2 |
| XIII. Just-in-time | Builds only the split card's scope. Banner, pips and pills stay with TASK-0275 and TASK-0247. | Pass |

No violation. No complexity tracking entry.

## Design

### D1 — Frames and sources

- `intentFrame(intent)` → `{ eventType: "intent", payload: { intent } }`, validated by the
  `intent` arm of `ProposalSchema`.
- `acceptFrame({ suggestionId, itemId })` and `suggestFrame(suggestion)` follow the same `build`
  pattern.
- `TableCommands` gains `sendIntent(intent)`, `accept(input)` and `suggest(input)`, and loses
  `comment`. `sendTalk`, `declareAction` and `commit` stay (FR-022 and the DM).
- Intent ids: `int-` plus a UUID, made in `send.ts`, injectable for tests.

### D2 — Send router (`apps/web/app/play/send.ts`, new, pure)

`routeSend(text, { speaker, mode, active, actor, id })` returns one of:

- `{ kind: "intent", intent }`: free mode at `declared`; turn mode at `confirmed`. The
  out-of-character speaker forces `ooc` (FR-003).
- `{ kind: "declare-commit", declare }`: turn mode, active player, `parse` yields `say` from prose
  (FR-022). The table view sends `declareAction` then `commit` with authority `active-player`.
- `{ kind: "refused", message }`: a parse refusal; nothing is sent.

The Interrupt check (FR-026) is the composer's, not the router's.

### D3 — View model

Per C-6 and spec 066 plan D4:

- Transcript items `confirm` (`ConfirmView { suggestionId, readSeq, lines: { itemId, text,
  kindLabel, state, canAccept, waitingOn }[] }`) and `aside` (an `ai:dm` `ooc` answer).
- On `talk`: `askDm` and `confirmable` (a `say` line under a human DM viewer). An Intent line that
  is still `declared` carries `declaredIntent` for the DM's **Confirm**.
- `ComposerView { speakers, mentions, mode: "free" | "turn", active, thinking }`. Speakers are the
  viewer's characters plus "You (out of character)" — no "The party" (C-7).
- `ActionCardView` drops `signoff`, `suggest`, `comments` and `commitsOnOwnTurn`. `commit` for
  a non-DM viewer in turn mode is never `canCommit` (FR-023, C-9).
- `readIndicator(p, viewer, nowMs)` in `read-ring.ts` returns `hidden`, `{ ring, remainingS,
  segments }` or `thinking` (FR-024, FR-025).

### D4 — Components

- `composer.tsx`: rewrite. "Speaker" chip with an inline listbox; `((` / `/ooc` flips it;
  "Mention" listbox on `@`; one Send; Enter submits the form; the inline "Interrupt the DM?"
  group with **I'm sure** and **Wait**; the active-player hint "Enter commits your turn" (OQ-2);
  the parse refusal and the source notice in one `role="alert"` line.
- `read-ring.tsx`, `confirm-row.tsx`, `confirm-editor.tsx`: new.
- `transcript.tsx`: confirm, aside, "Table talk", `ask_dm` highlight, "Confirm as action…",
  "Confirm".
- `action-card.tsx`, `commit-control.tsx`: comment form, sign-off rows, "Commits on your turn" and
  the player Commit removed; the DM's Commit and every allowed Withdraw stay.
- `table-view.tsx`: composer ref for Not quite, the editor key, the ring slot above the composer,
  and a 1 s ticker that runs only while the ring or Thinking shows.

### D5 — `detailsOf` (FR-W1)

`action.suggest`: one row "Read seq", then one row per item, label `Item <n>`, value
`<text> — <kindLabel>` and a second line `toText(item.intent)`. `action.accept`: "Suggestion" and
"Item" rows, with the item's text when the suggestion is in the projection. Both `ponytail:`
comments leave.

## Files touched (against `468069b8`)

| File | Change | Phase |
|---|---|---|
| `apps/web/app/play/frames.ts` | + `intentFrame`, `acceptFrame`, `suggestFrame`; − `commentFrame` | 1 |
| `apps/web/app/play/source.ts` | + `sendIntent`, `accept`, `suggest`; − `comment`, `CommentInput` | 1 |
| `apps/web/app/play/use-live-table.ts` | wire commands | 1 |
| `apps/web/app/play/use-fixture-table.ts` | wire commands | 1 |
| `apps/web/app/play/local-log.ts` | + `localIntentEvents`, `localAcceptEvents` | 1 |
| `apps/web/app/play/labels.ts` | four refusal labels, `KIND_LABEL` | 1 |
| `apps/web/app/play/proposals.ts` | real `detailsOf` rows | 1 |
| `apps/web/app/play/send.ts` | new | 2 |
| `apps/web/app/play/read-ring.ts` | new | 2 |
| `apps/web/app/play/view-model.ts` | items, composer, action card | 2 |
| `apps/web/app/play/signoff.ts` | delete | 2 |
| `apps/web/app/play/components/composer.tsx` | rewrite | 3 |
| `apps/web/app/play/components/{read-ring,confirm-row,confirm-editor}.tsx` | new | 3 |
| `apps/web/app/play/components/transcript.tsx` | new items, DM controls | 3 |
| `apps/web/app/play/components/{action-card,commit-control}.tsx` | removals | 3 |
| `apps/web/app/play/table-view.tsx` | wiring, ticker | 3 |
| `apps/web/test/play/{send,read-ring}.test.mjs`, `confirm-row.test.tsx` | new | 2, 3 |
| `apps/web/test/play/signoff.test.mjs` | delete | 2 |
| `apps/web/test/play/{frames,local-log,use-fixture-table,proposals,view-model}.test.mjs` | amend | 1, 2 |
| `apps/web/test/play/{composer,action-card,table-view,equivalence,start-scene-panel}.test.tsx` | amend / rewrite | 3 |
| `docs/wiki/{play-route,chat-ui,turn-floor}.md`, `INDEX.md`, `CAPSULES.md` | re-ground | 4 |
| `specs/105-one-composer-web/evidence/live-check.md` | new | 5 |

`margin.tsx` and `turn-order.tsx` are read, not changed: TASK-0275 owns the banner and pips.
Hotspot note (runbook): `view-model.ts`, `table-view.tsx`, `composer.tsx` and `transcript.tsx` are
shared with 0247, 0275, 0276 and 0277. One open PR at a time on these files.

## Test plan

- **Pure (`node --test`)**: `send.test.mjs` (every route of D2; card AC #1), `read-ring.test.mjs`
  (blank, segments, clamp, every hide rule, Thinking end; card AC #1), `view-model.test.mjs`
  (confirm states, waiting labels, speakers, no player Commit in turn mode), `frames.test.mjs`,
  `local-log.test.mjs`, `proposals.test.mjs`.
- **Markup (`vitest`, `renderToStaticMarkup`)**: `composer.test.tsx` (one Send, Speaker and Mention
  listboxes, interrupt strip, hint, refusal), `confirm-row.test.tsx`, `action-card.test.tsx` (no
  comment form, sign-off or player Commit; DM Commit stays), `table-view.test.tsx` (SC-005 names
  absent; card AC #2).
- **Mutation guard**: stub `routeSend`'s active branch to return `intent`, and `readIndicator` to
  ignore turn mode. Each fails at least one test. Restore; `git diff` is empty. The Phase 2
  dispatch runs it and reports.
- **Gates**: `pnpm ci:check`; wiki freshness; spec-bridge.

## UI gates

- **No modals.** Speaker and Mention are inline autocomplete dropdowns. The interrupt strip and
  the DM confirm editor are inline. No slide-out is added.
- `apps/web/test/no-dialog.test.mjs` green.
- Renders at **1280 px** and **390 px**.
- **Accessibility check.** The repo ships no axe or pa11y tool; `apps/web/test/contrast.test.mjs`
  covers tokens only. The orchestrator reads the Brave accessibility tree and runs a keyboard-only
  pass (spec OQ-5).
- **Live check in Brave** (orchestrator, script mode `greyhollow-confirm`, two windows). It must
  show: one composer and one Send; a free-mode post entering the ring; the confirm row's 👍 for
  Kestrel and "Waiting on Kestrel" for Tamsin; the line turning "Confirmed"; and, in turn mode,
  no ring and the active player's Enter committing.

## Phases (one phase = one dispatch)

| Phase | Scope | Tasks | Tier |
|---|---|---|---|
| 1 | Frames, sources, labels, `detailsOf` | 8 | sonnet |
| 2 | Send router, ring, view model, sign-off removal | 9 | sonnet |
| 3 | Components and wiring | 9 | sonnet |
| 4 | Wiki, web share | 4 | sonnet |
| 5 | Verification **[orchestrator]** | 5 | — |
| **Total** | | **35** | |

## Frozen-contract check

No conflict found. C-6, C-7 and C-9 allow every request and view this plan uses. Two readings to
confirm, neither a change:

- The active-player hint (OQ-2) is new copy; `ui-surfaces.md` does not forbid it.
- Fixture mode's carrier-only rows (OQ-1) touch no contract; fixtures are not a contract surface.
