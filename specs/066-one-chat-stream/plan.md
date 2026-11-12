# Implementation Plan: One chat stream — players talk, the DM confirms each Intent

**Branch**: `task-0199-quiet-ring` | **Date**: 2026-11-11 (amended; first written 2026-11-02 on
`task-0188-one-chat-stream`) | **Spec**: [spec.md](spec.md)

**Input**: spec.md with its "Amendment (2026-11, Intent contract v1.1)" section. P-04, decision-0030
(v1.1), spec 092 plan "Downstream amendments", CP-5 F2. **Authored against** `origin/main`
`9e51c948`: spec 102 plan `86d425b6` (merged), spec 104 plan `f61a0bac` (merged), Intent contract
v1.1. The 2026-11-02 plan is in git history (`3aaf8279`); this file replaces it.

## Split check (runbook "Cards needing spec amendments or splitting")

**Ruled 2026-11-11 (C-AMD, "Approve all"): split.** The amendment derived 70 tasks in 7 phases
across the server talk path and the web composer. This card (TASK-0199) is now the server half:
**53 tasks in 6 phases** (see "Phases"). The web half is TASK-0315 (spec.md "Split out to
TASK-0315"). This card ships no `apps/web` change; D4 below stays as TASK-0315's design input.

| Card | Card ACs | Hotspots |
|---|---|---|
| **TASK-0199** (server) | #1 to #7 (2026-11-11 numbering) | `gate/{plan,proposals,intents}.ts`, `catalog.ts`, `events/*.ts`, `dm/{talk-turn,jobs,enqueue}.ts` |
| **TASK-0315** (web) | Enter commits in combat; one composer verified in Brave | `play/view-model.ts`, `table-view.tsx`, `components/{composer,transcript}.tsx` |

TASK-0314 merges before this card (OQ-4). Its human-ruling resume rule lands in `dm/enqueue.ts`;
rule 8 here sits beside it.

## Summary

Every composer line becomes an Intent. Send parses the line with the v1.1 grammar and sends one
`intent` request (spec 102). In free mode the Intent is `declared`; in turn mode it is `confirmed`,
so the active player's Enter commits (TASK-0315). A pure `readablePosts(p)` in session-model picks the posts the
AI DM reads: free-mode speech and `declared` mechanical Intents, plus `ask_dm` in any mode. A
readable post moves the session's `talk` turn to the post's `ts` + 10 s. The read returns a D19
outcome, or `confirm` with Intent bodies, plus an optional `ask_dm` answer. A `confirm` ships as
`action.suggest` with `declared` Intents. A 👍 sends `action.accept`, which plans the item's Intent
as `confirmed` through `planIntent`. A human DM seat reads nothing, so the ring is off. A direct `intent` request outside a turn job
queues a coalesced `intent` turn that narrates it (card AC #7).

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest, Drizzle, React Router. `@the-stacks/intent` is already a
dependency of session-model, server and web (spec 102). **New runtime dependencies: none.**
**Storage**: Postgres event log; `jobs.input` / `jobs.result` JSON. **Migrations: none.** A new turn
trigger (`intent`, OQ-3 (b)) is a Zod enum value in `jobs.input`, not a column constraint.
**Prompt versions**: `dm.react-v3` → `dm.react-v4`. No purpose change, no hosted config change.
**Testing**: Vitest unit tests; DB tests with `REQUIRE_DATABASE=1`; the fake gateway and DM scripts
(spec 053); web markup tests under `apps/web/test/play/`; `apps/web/test/no-dialog.test.mjs`.
**Performance Goals**: P-14. A 👍 or combat Enter reaches fact rows in < 1 s p95 (no model call on
that path). A read is one `dm.narrate`-class call; a read of only declared Intents makes none.
**Constraints**: runbook hotspots — `gate/{proposals,plan}.ts` (0268 merged; 0276), `catalog.ts` and
`events/*.ts` (0247, 0276), `dm/{talk-turn,jobs,enqueue}.ts` (0272 merged; TASK-0314), web
`view-model.ts`, `table-view.tsx`, `composer.tsx`, `transcript.tsx` (0247, 0275, 0276, 0277).

## Constitution Check

Against `.specify/memory/constitution.md` **3.0.0**. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: every gesture is a gate request (`intent`, `action.suggest`,
      `action.accept`) a VTT, a script or the AI can send. The read outcome is in `jobs.result.talk`.
- [x] **II. One Intent vocabulary**: the composer sends Intents parsed by the contract grammar; the
      confirm row carries Intents; a 👍 plans through the planner. The one non-Intent path is combat
      prose (`action.declare` + `action.commit`), which spec 104 turns into Intent stages.
- [x] **III. Event-sourced, server authority**: one new event (`action.suggested`), written only via
      `gate.submit` / `gate.handle`. Ring, Thinking and staleness derive from logged rows.
- [x] **IV. Three data planes**: session plane only.
- [x] **V. Many views**: `ask_dm` rows carry the asker's user-id visibility; `canSee` filters them.
- [x] **VI. Engine owns the numbers**: model confirm bodies use the spec 104 interpret body schema
      (no `dc`); `MODEL_NUMBER` still holds at the gate.
- [x] **VII. Narration around facts**: a 👍'd check's fact rows come from the engine; narration of
      them is OQ-3 (b).
- [x] **VIII. Campaign is data**: fixtures and scripts use `greyhollow-ford-duo`.
- [x] **IX. UX quality bar**: no modals (inline dropdowns, inline strip, inline editor); 1280 px and
      390 px; keyboard and screen reader (listbox roles, `role="status"` Thinking); status words
      beside colour ("Confirmed", "Superseded"); **the quiet ring in exploration only, explicit turns
      in combat** (P-04).
- [x] **X. Citations**: no rules claim. N/A.
- [x] **XI. Operator-owned content**: no codex change. N/A.
- [x] **XII. Self-hostable**: no new purpose, service or config.
- [x] **XIII. Plan just-in-time**: every deferral is an open question with a recommended home.

**Quality gate "Intent contract tests"** (runbook Intent PRs): `ask_dm` gets a gate test per
outcome; `action.accept` gets a test per outcome of the item's Intent (`settled`, `needs_ruling`,
refusal). **Complexity Tracking**: none.

## Design

### D1 — Session model (`packages/session-model/src/`)

- `events/actions.ts`: new `ActionSuggestedV1 { suggestionId, readSeq, items: SuggestionItemV1[1..4] }`,
  `SuggestionItemV1 { itemId /^i[1-4]$/, text 1..500, intent: IntentSchema }`, refined so
  `intent.commit === "declared"` and the ids are unique. `ActionDeclaredV1` is unchanged.
- `events/presence.ts`: `PRESENCE_PURPOSES` gains `"read"`.
- `catalog.ts`: `session("action.suggested", "lifecycle", ActionSuggestedV1)` (+1 entry).
- `projections/{types,apply}.ts`: `suggestions: SuggestionView[]`; the transcript gains an
  `action.suggested` entry; `PresenceView.purpose` gains `read`. `action.withdrawn` fold unchanged.
- `read.ts` (new, pure, exported): `isDmQuestion(text)`, `readablePosts(p)` (spec FR-006 rules 1–4
  over `p.intents` joined to transcript seqs), `latestReadablePostSeq(p)`, `readWindowMs(post, p)`
  (10 000; 0 for `ask_dm` in turn mode), `READ_QUIET_MS`, `RING_BLANK_MS`, `isDmReadOutput(entry)`,
  `suggestionState(p, intentId)` (the item Intent id `<suggestionId>.<itemId>`; stale per FR-018; confirmed when `p.intents` holds that id; `missing` when no suggestion names it). `IntentView` gains `ts` (the first carrier row's `ts`) and the projection gains `suggestions: SuggestionView[]`.
- `fixtures/one-chat-stream.ts` (new) plus `fixtures/index.ts`: say posts, a declared `hide`, a
  `read` marker, `sug-1`, a stale reply, a party `attempt` suggestion, its 👍, an `ask_dm` and its
  answer, and a turn-mode segment.

### D2 — Gate (`packages/session-model/src/gate/`)

- `proposals.ts`: kinds `action.suggest { suggestion: ActionSuggestedV1 }` and
  `action.accept { suggestionId, itemId }`. `DmProposalKindSchema` excludes `action.accept`.
  Code counts: 16 → 18 kinds, 20 → 22 request literals (the contract already reads 18 / 15 / 22).
- `policy.ts`: `"action.suggest": "auto"`; `routeProposal` refuses `ai:dm` `action.accept`.
- `permissions.ts`: `action.suggest` joins the DM-kind row; `action.accept` passes humans only.
- `refusals.ts`: `SUGGESTION_STALE`, `SUGGESTION_NOT_FOUND`.
- `plan.ts`: `case "action.suggest"` (id reuse → `INVALID_PROPOSAL`; item Intent ids must be `<suggestionId>.<itemId>` (else `INVALID_PROPOSAL`); the `ai:dm`-only `readSeq` guard →
  `SUGGESTION_STALE`; item actors must be `pc` controlled by a human → `INVALID_PROPOSAL`; one
  public row). `case "action.accept"`: the FR-016 checks, then `planIntent(p, proposer,
  { ...item.intent, commit: "confirmed", source: "composer", actor }, …)`. Extract the declare
  block's `CHARACTER_UNABLE` test into `unableRefusal(p, proposer, scope, characterId)`.
- `intents.ts`: `planGateKind` serves `ask_dm` (spec FR-028; visibility = proposer user id; drop the
  `UNSERVED_OWNER.ask_dm` entry). `notYourTurn` unchanged.
- `apps/server/src/gate/gate.ts`: `recordPresence` purpose type gains `read`.
- `apps/server/test/write-boundary.test.ts`: only `dm/talk-turn.ts` builds `kind: "action.suggest"`;
  no `src/` file builds `kind: "action.accept"`.

### D3 — DM runtime (`apps/server/src/dm/`)

- `talk-triggers.ts`: `isReadable` delegates to `readablePosts`; `needsModel` per FR-010.
- `jobs.ts`: `enqueueTalkTurn(db, sessionId, triggerSeq, { postTs, windowMs })` (no max-wait cap;
  old rows with `firstPostAt` still parse). New `interruptRead(db, sessionId)` (rotate the claim
  token of a running empty-beat `talk` turn that has shipped nothing; result `interrupted`).
  `TurnTriggerSchema` gains `intent` (OQ-3 (b) only).
- `enqueue.ts`: rule 6 rewritten (interrupt, then queue or move the read; drop `talkQuietMs` and
  `talkMaxWaitMs`, add the `readWindowMs` seam). New rule 8 (spec FR-031, card AC #7): an
  `intent.recorded` row with outcome `settled` or a `stopped` refusal, in a batch that no turn job
  appended, queues a coalesced `intent` turn. Place it beside TASK-0314's resume rule and share its
  "appended by a job" test. The `intent` turn runs the pipeline with an empty beat, so narrate reads
  the row through the spec 104 window (`factsThrough`, `loadEvents`).
- `worker.ts`: purpose `read` when `job.trigger === "talk"`; an interrupted run returns through the
  fenced/aborted path.
- `nodes/schemas.ts` `ReactOutput`: outcome gains `confirm`; `confirm: { characterId | null, text,
  body: IntentBody }[0..4]` (reuse spec 104 `IntentBodySchema`); `answer: string | null`.
- `prompts/react.ts`: `dm.react-v4`. Rules: speech → `reply`; a deed with an uncertain outcome →
  `confirm`, one item per acting human character, never a companion; `answer` only for `ask_dm`
  posts. Inputs gain the human-controlled characters and the `ask_dm` posts.
- `prompts/common.ts`: player-facing tails drop `ooc` talk; render an `action.suggested` line.
- `talk-turn.ts`: cutoff after the latest `isDmReadOutput`; code items for rule-2 posts; model items
  stamped and validated (FR-011); the spec 103 narration check on item text and answer (FR-012);
  ship order answer → confirm → D19 row, each fenced, with reclaim keys `answer:` / `confirm:`;
  `SUGGESTION_STALE` records `interrupted`. `jobs.result.talk` gains `confirmItems`, `answered`.
- `intent-runner.ts`: unchanged; OQ-9's id rule keeps its declares out of the read.

### D4 — Web (`apps/web/app/play/`) — TASK-0315 design input, not built here

- `frames.ts`: `intentFrame(intent)`, `acceptFrame`, `suggestFrame`, schema-validated; remove
  `commentFrame`; keep `declareFrame` and `commitFrame` for FR-022 and the DM.
- `source.ts`, `use-live-table.ts`, `use-fixture-table.ts`, `local-log.ts`: `sendIntent`, `accept`,
  `suggest`; drop `comment`; `localAcceptEvents` for fixtures.
- `read-ring.ts` (new, pure): `readIndicator(p, viewer, nowMs)` → hidden | ring | thinking.
- `view-model.ts`: transcript items `confirm` and `aside`; `askDm` and `confirmable` flags on talk;
  `ConfirmView { suggestionId, readSeq, lines: { itemId, text, kindLabel, state, canAccept,
  waitingOn }[] }`; `ActionCardView` loses `signoff`, `suggest`, `commitsOnOwnTurn`; `ComposerView
  { speakers, mentions, mode: "free" | "turn", active: boolean, thinkingInterrupts }`.
- `signoff.ts`: delete, with `apps/web/test/play/signoff.test.mjs`.
- `components/composer.tsx`: rewrite (speaker listbox; `((` / `/ooc` flip; `@` mention listbox;
  `parse()` on Send with inline `PARSE_*` refusal text; one Send; FR-022 routing; interrupt strip).
- `components/read-ring.tsx`, `confirm-row.tsx`, `confirm-editor.tsx` (new).
- `components/transcript.tsx`: confirm, aside, "Table talk", `ask_dm` highlight, DM "Confirm as
  action…" and "Confirm".
- `components/action-card.tsx`, `commit-control.tsx`: remove the comment form, sign-off rows and the
  player's commit control; keep the DM's Commit and Withdraw.
- `table-view.tsx`: composer ref, editor key, a 1 s ticker only while the ring or Thinking shows.
- `labels.ts`: `SUGGESTION_STALE`, `SUGGESTION_NOT_FOUND`, `INTENT_EXISTS`, `NOT_YOUR_TURN` (generic).

### D5 — Mutation guard

Stub `readablePosts` to return `[]`; stub `suggestionState` never stale; stub the accept acceptor
rule to pass; stub `interruptRead` to return null; stub rule 8 to queue nothing. Each fails at least one test. Restore; `git diff` is empty.

### D6 — Script-mode server check

`specs/066-one-chat-stream/evidence/post.mjs` posts an Intent as a named player over the WS `send`
frame. `apps/server/dm-scripts/greyhollow-confirm.json` scripts: scene start, a read that confirms
Kestrel's climb, a read that answers Tamsin's `ask_dm`, then a turn-mode beat. This card checks it
on the debug routes; TASK-0315 reuses it for the Brave live check.

## Files touched (against `9e51c948`)

| File | State today | Change | Card |
|---|---|---|---|
| `packages/session-model/src/events/actions.ts` | no suggestion event | `ActionSuggestedV1`, `SuggestionItemV1` | server |
| `packages/session-model/src/events/presence.ts` | `director`, `signoff`, `floor` | + `read` | server |
| `packages/session-model/src/catalog.ts` | has `intent.recorded` | + `action.suggested` | server |
| `packages/session-model/src/projections/{types,apply}.ts` | `intents` fold exists | `suggestions`, transcript entry | server |
| `packages/session-model/src/read.ts` | absent | new | server |
| `packages/session-model/src/index.ts` | — | exports | server |
| `packages/session-model/src/fixtures/{one-chat-stream,index}.ts` | — | new fixture | server |
| `packages/session-model/src/gate/{proposals,policy,permissions,refusals,plan}.ts` | `intent` kind exists; no suggest/accept | kinds, planner | server |
| `packages/session-model/src/gate/intents.ts` | `ask_dm` → `KIND_UNSERVED` (TASK-0199) | serve `ask_dm` | server |
| `apps/server/src/gate/gate.ts` | — | `read` purpose type | server |
| `apps/server/src/dm/talk-triggers.ts` | `isReadable` reads `talk.channel` | delegate | server |
| `apps/server/src/dm/jobs.ts` | quiet 3 s + max-wait 10 s; trigger `ruling` exists | window, `interruptRead`, `intent` trigger | server |
| `apps/server/src/dm/enqueue.ts` | rule 6 talk, rule 7 ruling | rule 6 rewrite; rule 8 | server |
| `apps/server/src/dm/worker.ts` | `director` marker | `read` marker | server |
| `apps/server/src/dm/nodes/schemas.ts` | `ReactOutput` 4 outcomes; `IntentBodySchema` | `confirm`, `answer` | server |
| `apps/server/src/dm/prompts/{react,common}.ts` | `dm.react-v3` | `dm.react-v4`; tail filter | server |
| `apps/server/src/dm/talk-turn.ts` | `readPosts`, `checkNarration` | cutoff, items, answer, ship | server |
| `apps/server/dm-scripts/greyhollow-confirm.json`, `test/dm/scripts/talk-{confirm,answer}.json` | absent | new | server |
| `packages/session-model/test/{read-rule,gate-suggest,gate-ask-dm}.test.ts` | absent | new | server |
| `packages/session-model/test/{gate-schemas,gate-policy,gate-permissions,catalog,presence,fixtures}.test.ts` | — | counts, rows | server |
| `apps/server/test/dm/{talk-triggers.test,enqueue-talk.integration.test,talk-turn.integration.test,worker.integration.test,react-prompt.test,player-facing-prompts.test,dm-scripts.test}.ts` | exist | amend | server |
| `apps/server/test/{gate.intent.integration,write-boundary}.test.ts` | exist | accept over the real gate; pins | server |
| contract files in "Frozen-contract amendments" | TASK-0188 blocks present | appended blocks | server |
| `apps/server/test/dm/enqueue-intent.integration.test.ts` | absent | new (rule 8) | server |
| `docs/wiki/{dm-talk-triggers,turn-floor,proposal-gate,session-model,dm-turn-jobs,presence}.md`, `INDEX.md`, `CAPSULES.md` | — | re-ground | server |

## Frozen-contract amendments (C-GATE ruled)

**Already made by spec 102 — dropped here:** the `intent` request kind and its matrix row;
`DEFAULT_POLICIES.intent = "ask"`; `intent.recorded` and the `intents` projection; `openRulings`;
the `forbidden` codes `NOT_YOUR_ACTOR`, `DM_SEAT_REQUIRED`, `NOT_YOUR_TURN`; the 18 / 15 / 22 counts.
**Standing from TASK-0188 (2026-11-02, "All (a), amend") and unchanged here:** `action.suggest`
(policy `auto`) and `action.accept` exist; `SUGGESTION_STALE`, `SUGGESTION_NOT_FOUND`;
`presence.recorded` purpose `read`; the `signoff` client section leaves the web; `TalkV1` and the
`ws-protocol.md` frames unchanged. **Intent contract v1.1: no change** (OQ-6's visibility reading
may be recorded as a C-CON clarification note, as spec 102 OQ-10 was).

Each row below is a new appended block, headed "**Amendment (TASK-0199).**", citing P-04,
decision-0030 and the C-GATE ruling. Existing blocks are not rewritten.

**Ruled 2026-11-11 (C-GATE, "Approve all"): C-1 to C-9 adopted.** C-6, C-7 and C-9's UI line
are written by this card's Phase 4 with the rest, so the contracts change in one PR; TASK-0315
builds against them.

| # | File | Before → after |
|---|---|---|
| C-1 | `specs/029-proposal-gate/contracts/proposals.md` | `action.suggest` items `{ itemId, characterId, scope, text, check }` → `{ itemId, text, intent: IntentSchema (commit "declared") }` |
| C-2 | same | `action.withdraw` accepts a committed, unresolved action; a declare carrying `suggestionId` is `INVALID_PROPOSAL` → both withdrawn (today's withdraw and declare rules stand) |
| C-3 | `specs/029-proposal-gate/contracts/policy-and-authority.md` | `action.accept` commits `action.declared` + `action.committed` with authority `declarer` / `active-player` / `group` (D8 table first row) → `action.accept` plans the item's Intent as `confirmed` through `planIntent`; no commit-authority row; a second 👍 is `INTENT_EXISTS` (was `ACTION_EXISTS`) |
| C-4 | `specs/029-proposal-gate/contracts/proposal-events.md` (+ pointer blocks in `specs/028-session-model/contracts/{session-events,projections}.md`) | `action.declared` gains `suggestionId`; `action.withdrawn` folds a committed action → neither (`ActionDeclaredV1` and the withdraw fold unchanged); `ActionSuggestedV1` items carry Intents per C-1 |
| C-5 | `specs/029-proposal-gate/contracts/gate-api.md` | accept row "two rows `action.declared`, `action.committed`" → "the item Intent's batch: engine rows or a ruling request, then `intent.recorded`"; widened-withdraw row → removed; gate-handled kinds: `ask_dm` `KIND_UNSERVED` (owner TASK-0199) → served (`talk` `ooc` + carrier, visibility the asker's user id) |
| C-6 | `specs/030-play-route/contracts/proposal-seam.md` | `ConfirmView` lines `{ text, check }` → `{ text, kindLabel }` over an Intent item; the active player's `commitsOnOwnTurn` leaves `ActionCardView` |
| C-7 | `specs/030-play-route/contracts/{table-source,live-frames,ui-surfaces}.md` | the composer sends `talk` lines and `accept` / `suggest` → it sends `intent` requests (parsed, `declared` in free mode, `confirmed` in turn mode), `action.declare` + `action.commit` for the active player's prose, `accept`, `suggest`; no `The party` speaker |
| C-8 | `specs/031-dm-runtime/contracts/{turn-jobs,nodes,node-seam,purposes}.md` | ring window "10 s, or 5 s for the active player in turn mode", reconcile skips a withdrawn committed action, confirm items `{ characterId, scope, text, check }`, `dm.react-v2` → window "10 s in free mode; `ask_dm` 0 s in turn mode; no read otherwise", no reconcile change, confirm items carry Intent bodies, `dm.react-v4`; `TurnTriggerSchema` + `intent` (only if OQ-3 (b) is adopted) |
| C-9 | `specs/049-turn-floor/contracts/{floor-jobs,ui-floor}.md` | "an accept batch never arms a stall" → "an accept writes no action rows"; the action card keeps the active player's Commit → Enter replaces it (FR-023) |
| C-10 | `specs/035-presence/contracts/presence-marker.md`, `specs/044-group-signoff/contracts/signoff.md` | unchanged → unchanged (the TASK-0188 blocks stand) |

## Phases (one phase = one sonnet dispatch)

| Phase | Scope | Tasks |
|---|---|---|
| 1 | Session model: event, catalog, projection, `read.ts`, fixture, tests | 10 |
| 2 | Gate: suggest, accept via `planIntent`, `ask_dm`, refusals, pins, tests | 13 |
| 3 | DM runtime: window, `interruptRead`, marker, rule 8, `dm.react-v4`, talk path, scripts, tests | 18 |
| 4 | Contract amendment blocks C-1 to C-9 | 3 |
| 5 | Wiki (server share): NEEDS-REVIEW `dm-talk-triggers`, `turn-floor`, `proposal-gate`, `session-model`, `dm-turn-jobs`, `presence`, `INDEX.md`, `CAPSULES.md` | 4 |
| 6 | Verification **[orchestrator]**: DB suites, mutation guard, script-mode server check, execution-log row, spec-bridge | 5 |
| **Total** | | **53** |

Dependencies: 1 → 2 → 3 → 4 → 5 → 6. Old plan Phase 4 (web) and the web shares of the wiki and
verification phases are TASK-0315's. `play-route` and `chat-ui` are re-grounded there.

## Server check (Phase 6)

`DM_FAKE_SCRIPT=greyhollow-confirm` on the worktree stack. Post with `evidence/post.mjs`. Expected on
the debug page: a `say` Intent queues a `talk` turn at its `ts` + 10 s; a second post moves it; the
`read` marker; one `action.suggested` row with a `declared` `hide` item; `action.accept` appends the
engine rows and `intent.recorded` (`confirmed`) and queues one `intent` turn that narrates them; an
`ask_dm` draws one answer visible to the asker and the DM only; in turn mode no `talk` turn queues;
under a human seat no `talk` turn queues. The Brave live check is TASK-0315's.
