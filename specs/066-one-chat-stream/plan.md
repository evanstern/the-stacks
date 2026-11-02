# Implementation Plan: One chat stream — players talk, the DM confirms each action

**Branch**: `task-0188-one-chat-stream` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/066-one-chat-stream/spec.md` and decision-0028 (D20, accepted). The operator ruled
every open question (a) and approved the section 8 amendments: "All (a), amend" (2026-11-02). The
frozen-contract amendment blocks land with this spec set (see "Contract amendments").

## Summary

The composer becomes one Send button with a speaker chip. Every line is `talk`. A shared readable
rule in `@the-stacks/session-model` decides which posts the DM reads. A readable post moves the
session's `talk` turn to the post's `ts` + 10 s (5 s for the active player in turn mode). The
worker logs a `presence.recorded` marker with purpose `read` when it claims the turn. The talk
path returns a D19 outcome or `confirm`, plus an optional `@dm` answer. A `confirm` ships as a new
DM kind `action.suggest` (event `action.suggested`). A player's 👍 sends a new request
`action.accept`, which the planner turns into `action.declared` and `action.committed` in one
batch. `action.withdraw` widens to committed, unresolved actions. The web removes the sign-off UI
and draws the ring, Thinking, the interrupt strip and the confirm row from logged rows.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest, Drizzle, React Router 8. No new dependency.
**Storage**: Postgres event log; `jobs.input` and `jobs.result` JSON. No migration.
**Testing**: Vitest unit tests; DB integration tests with `REQUIRE_DATABASE=1`; the fake gateway and
DM scripts (spec 053); web markup tests under `apps/web/test/play/`.
**Target Platform**: `packages/session-model`, `apps/server/src/{gate,dm}`, `apps/web/app/play`.
**Project Type**: monorepo web service.
**Performance Goals**: one model call per read, as spec 065. A confirm lands about 10 s plus one
`dm.narrate`-class call after the last readable post.
**Constraints**: serial hotspots: `gate/plan.ts`, `dm/talk-turn.ts`, `dm/jobs.ts`, `dm/enqueue.ts`,
`play/view-model.ts`, `play/components/composer.tsx`. No other lane edits them while this branch is
open.
**Scale/Scope**: about 30 source files, 15 test files, 2 DM scripts, 18 contract files.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: every gesture is a gate request a VTT or script can send (D20 §5). The
      read outcome and the interrupt are in `jobs.result.talk`.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: session plane only.
- [x] **IV. Event sourcing**: one new event (`action.suggested`), written only through
      `gate.submit`/`gate.handle`. The ring, Thinking and staleness are derived from logged rows;
      none is logged or stored client-side as state.
- [x] **V. Citations**: no rules claim. N/A.
- [x] **VI. 5e engine boundary**: no mechanics change. `check` is matched against the engine's
      `SkillSchema`; it binds no roll.
- [x] **VII. Structured first**: the read output, the suggestion and the accept request are Zod
      schemas.
- [x] **VIII. Operator-owned content**: fixtures and scripts use `greyhollow-ford-duo`.
- [x] **IX. Self-hostable**: no new purpose, service or config.

**Stack conformance**: no departure.

## Binding constraints check (decision-0028, round 2 brief)

| Constraint | How this plan holds it |
|---|---|
| No modals | The speaker dropdown, the `@` autocomplete, the interrupt strip and the human DM's confirm editor are inline, in normal flow under their control. No `<dialog>`, `aria-modal` or `fixed inset-0` under `app/play/` (030 `ui-surfaces.md` "Forbidden"; the `table-view.test.tsx` no-modal assertion is extended to the new components). |
| Chat is a view over the log | Every rendered line, the confirm state and the read marker come from `project(events, viewer)`. The ring and Thinking are pure functions of logged `ts` values and the clock (`play/read-ring.ts`). |
| No client-only state shown as logged | Not quite logs nothing and shows nothing in the transcript. A 👍 renders "Confirmed" only after `action.committed` arrives (no optimistic append, 030 `table-source.md` rule 2). The draft and the open strip are UI state only. |
| `ai:dm` never declares or withdraws for a player | `ai:dm` `action.accept` is `NOT_AUTHORIZED` in `routeProposal` and `checkPermission`. `action.declare` and `action.withdraw` from `ai:dm` stay refused. A write-boundary test pins that no server file builds `action.accept`. |
| DM-only text never reaches players | Confirm wording and the `@dm` answer pass `dmOnlySeedText`, `checkClaims` and the digit check (D3). The react prompt reads the `PlayerSeedView` only (`player-facing-prompts.test.ts`). `action.suggested` is public by rule; the planner refuses any other visibility. |
| Write boundary (`apps/server/test/write-boundary.test.ts`) | No new writer import. `dm/talk-turn.ts` ships through `gate.submit` only. The interrupt is a `jobs` update in `dm/jobs.ts`, not an event write. Two pins are added (D2). |
| Only a committed action reaches the pipeline | Accept writes `action.committed` in the same batch as the declare. An unanswered suggestion has no action. |
| Frozen contracts change only on a ruling | Every amendment block cites decision-0028 §8 and the 2026-11-02 ruling. `TalkV1` and the `ws-protocol.md` frames are unchanged. |

## Research

- **R1 — Request routing.** `GATE_REQUEST_KINDS` is derived from `GateRequestSchema`, and the WS
  gateway forwards any member to `gate.handle` (029 `ws-delivery.md`). New proposal kinds need no
  gateway or frame change.
- **R2 — The planner already batches.** `plan()` returns `rows[]` appended atomically
  (`action.comment` returns three rows today). Accept follows that shape.
- **R3 — Talk isolation.** `talk-isolation.test.ts` pins that `talk` and `narration` change only
  `transcript`, `throughSeq` and `diagnostics`. Staleness is therefore derived from the transcript
  by a helper, not folded into a projection field, so that invariant holds unchanged.
- **R4 — Withdraw fold.** `applyLifecycle` ignores `action.withdrawn` on a committed action (029
  `proposal-events.md`, "Action withdrawal"). OQ-R4 (a) needs that rule widened, not only the
  planner.
- **R5 — Beats.** `toBeatItem` (`nodes/assemble.ts`) keeps only `committed`/`resolved` actions, so a
  withdrawn action leaves every later beat. A running beat froze it at assemble, so resolve needs a
  fresh status check (FR-019).
- **R6 — Reconcile.** `reconcileTurnJobs` finds committed, unresolved actions. It must skip a later
  `action.withdrawn`.
- **R7 — Floor stall.** `floorWaits` cancels a stall on `action.committed` before it arms on
  `action.declared`, and `isStallCandidate` reads fresh status. An accept batch therefore never
  arms a stall. No floor change.
- **R8 — Fencing.** Every fenced write filters on `jobs.claim_token`. Rotating the token of a
  running job makes the worker's next fence, heartbeat or save fail; the worker then aborts and
  writes nothing (`worker.ts`, the `fenced`/`aborted` early return).
- **R9 — Talk path cutoff.** `readPosts` (`dm/talk-turn.ts`) starts after the last `ai:dm`
  narration. Under D20 a confirm or an `@dm` answer is also a read output, so the cutoff widens.
- **R10 — Player-facing transcript.** `transcriptEntries` (`prompts/common.ts`) filters to public
  entries when given a roster. OOC talk passes today.
- **R11 — Skills.** `SkillSchema` (`packages/dnd5e-engine/src/schema/state.ts`) is the closed skill
  list.
- **R12 — Fixture ids.** `RefIdSchema` allows 64 characters. `sug-<uuid>` (40) plus `.i<n>` fits.

## Design

### D1 — Session model: events, catalog, projection, the readable rule

`packages/session-model/src/`:

- `events/actions.ts`:
  - `ActionDeclaredV1` gains `suggestionId: RefIdSchema.optional()`. Version stays 1; old rows
    still parse.
  - New `ActionSuggestedV1`:
    ```ts
    export const SuggestionItemV1 = z.object({
      itemId: z.string().regex(/^i[1-4]$/),
      characterId: RefIdSchema.nullable(),
      scope: z.enum(["character", "party"]),
      text: z.string().min(1).max(500),
      check: z.string().min(1).max(40).nullable(),
    }).refine((i) => i.scope === "party" || i.characterId !== null);
    export const ActionSuggestedV1 = z.object({
      suggestionId: RefIdSchema,
      readSeq: z.number().int().min(0),
      items: z.array(SuggestionItemV1).min(1).max(4),
    }).refine(unique item ids && RefIdSchema accepts `${suggestionId}.${itemId}`);
    export const suggestionActionId = (s: string, i: string) => `${s}.${i}`;
    ```
- `events/presence.ts`: `PRESENCE_PURPOSES` gains `"read"`. Update the header comment.
- `catalog.ts`: `session("action.suggested", "lifecycle", ActionSuggestedV1)`. The catalog grows
  from 37 to 38 entries (20 session entries).
- `projections/types.ts` and `apply.ts`:
  - `ActionView` gains `suggestionId: string | null`, copied from `action.declared`.
  - `SessionProjections` gains `suggestions: SuggestionView[]` (`{ suggestionId, seq, ts, actor,
    readSeq, items }`), appended by `action.suggested`; a duplicate id counts
    `ignoredTransitions`. The transcript gains `{ kind: "action.suggested", suggestionId, readSeq,
    items }`.
  - `PresenceView.purpose` gains `"read"`.
  - `action.withdrawn` also moves a `committed` action to `withdrawn` (R4). A resolve on a
    withdrawn action stays ignored (counted).
- New `read.ts` (pure, exported from the index):
  - `isDmQuestion(text)`: `/(^|[^\p{L}\p{N}_@])@dm(?![\p{L}\p{N}_])/iu`.
  - `isReadablePost(entry, p)`: FR-005 over a transcript `talk` entry (`actor`, `visibility`,
    `channel`, `text`). Humans are actors that are not `ai:*` and not `system`.
  - `readWindowMs(entry, p)`: 5000 for FR-005 rule 2, else 10000. Export `READ_QUIET_MS = 10_000`,
    `READ_QUIET_TURN_MS = 5_000`, `RING_BLANK_MS = 2_000`, `RING_BLANK_TURN_MS = 1_000`.
  - `isDmReadOutput(entry)`: an `ai:dm` `narration`, an `action.suggested` entry, or an `ai:dm`
    OOC `talk` entry.
  - `suggestionState(p, suggestionId)`: `{ stale, staleSeq, items: [{ itemId, actionId,
    accepted }] }`. Stale per FR-017, from later transcript entries; accepted when
    `p.actions` holds the derived action id.
  - `latestReadablePostSeq(p)`.
- `fixtures/one-chat-stream.ts` (new): AI seat; Tamsin and Kestrel (players), Odo (companion);
  Tamsin and Kestrel IC posts; a `read` marker; a suggestion `sug-1` (Kestrel, Stealth); a
  correction post; a reply narration (stale `sug-1`); a party suggestion `sug-2`; Kestrel's accept
  (`action.declared` with `suggestionId`, `action.committed` `group`); a withdraw of that committed
  action; an `@dm` post and its `ai:dm` OOC answer. Add it to `fixtures/index.ts` (eleven
  fixtures).

### D2 — Gate core: kinds, permission, planner, refusals

`packages/session-model/src/gate/`:

- `proposals.ts`: `ProposalKindSchema` gains `"action.suggest"` and `"action.accept"` (17 kinds).
  `DmProposalKindSchema` excludes `action.declare`, `action.withdraw` and `action.accept` (14 DM
  kinds). Schemas:
  ```ts
  z.object({ kind: z.literal("action.suggest"), ...ProposalNote, suggestion: ActionSuggestedV1 }),
  z.object({ kind: z.literal("action.accept"), ...ProposalNote,
    suggestionId: RefIdSchema, itemId: z.string().regex(/^i[1-4]$/) }),
  ```
  `GATE_REQUEST_KINDS` grows from 19 to 21.
- `policy.ts`: `DEFAULT_POLICIES["action.suggest"] = "auto"`. `routeProposal`: `ai:dm` with
  `action.accept` is `NOT_AUTHORIZED`, beside declare and withdraw.
- `permissions.ts`: `action.suggest` joins the DM-kind row (seated human DM or `ai:dm`).
  `action.accept` passes for a human proposer only; AI proposers get `NOT_AUTHORIZED`. The planner
  decides the item rule.
- `refusals.ts`: add `SUGGESTION_STALE` and `SUGGESTION_NOT_FOUND`.
- `plan.ts`:
  - `action.suggest`: refuse `INVALID_PROPOSAL` when `suggestionId` exists in `p.suggestions` or
    any derived action id exists. For `ai:dm`, refuse `SUGGESTION_STALE` when
    `latestReadablePostSeq(p) > readSeq`. Plan one public `action.suggested` row.
  - `action.accept`: in order: suggestion and item exist (`SUGGESTION_NOT_FOUND`); not stale
    (`SUGGESTION_STALE`); derived action id unused (`ACTION_EXISTS`); acceptor rule: a character
    item needs a human controller match (`NOT_AUTHORIZED`), a party item needs a human party
    member (`NOT_AUTHORIZED`); the `CHARACTER_UNABLE` check shared with declare (extract the
    existing block into `unableRefusal(p, proposer, scope, characterId)`); in turn mode a character
    item needs the active actor (`COMMIT_NOT_ALLOWED`). Plan two public rows: `action.declared`
    `{ actionId, characterId, scope, text: check ? `${text} — ${check}` : text, suggestionId }`
    and `action.committed` `{ actionId, authority }`. Authority: `group` for party, else
    `active-player` in turn mode, else `declarer`. No sign-off marker.
  - `action.declare`: refuse `INVALID_PROPOSAL` when the payload carries `suggestionId`.
  - `action.withdraw`: accept status `declared`, `discussed` or `committed`.
- `authority.ts`: unchanged. `commitAuthority` still governs direct commits (OQ-11 (a)).

`apps/server/src/gate/`:

- `gate.ts`: `recordPresence` input purpose type gains `"read"`. Nothing else: new kinds flow
  through `submit`/`handle` and `planProposal` (R1).

`apps/server/test/write-boundary.test.ts`: two pins in a new `describe("confirm write boundary
(spec 066)")`: only `dm/talk-turn.ts` builds `kind: "action.suggest"`; no file under `src/` builds
`kind: "action.accept"`.

### D3 — DM runtime: the window, the marker, the interrupt, the read

`apps/server/src/dm/`:

- `talk-triggers.ts`: `isReadable(row, p)` delegates to `isReadablePost` from session-model.
  `capReached`, `codeTriggers` and `companionOnly` stay. `needsModel(triggers, text, human)` returns
  true whenever `human` is true (spec gap 2); the companion-only rule is unchanged.
- `jobs.ts`:
  - `enqueueTalkTurn(db, sessionId, triggerSeq, { postTs, windowMs })`: insert with `notBefore =
    postTs + windowMs`; on a queued `talk` turn set `triggerSeq` and `notBefore` to the new values.
    Drop `firstPostAt` and the max-wait cap from new rows (old rows that carry it still parse).
    Any other queued turn absorbs the post, as today.
  - New `interruptRead(db, sessionId): Promise<string | null>`: one `UPDATE jobs` on the session's
    running `turn` job with `input->>'trigger' = 'talk'`, a checkpoint with an empty or null beat
    and no submissions, and `result->'checkpoint'->'narration'->>'shipped'` not `true`. It sets
    `status = 'succeeded'`, `stage = null`, `finished_at = now()`, a fresh `claim_token`, and
    merges `{ talk: { outcome: "interrupted" } }` into `result`. It returns the job id or null. The
    worker's next fenced write then fails and it aborts (R8). No migration: the status and kind
    values exist.
  - `reconcileTurnJobs`: add `NOT EXISTS` a later `action.withdrawn` for the action (R6).
- `enqueue.ts` rule 7: for each `talk` row that passes `isReadable` and not `capReached`: call
  `interruptRead`, then `enqueueTalkTurn` with the row's `ts` and `readWindowMs`. A companion-only
  post also queues the companion `prompt` job. Remove `talkQuietMs` and `talkMaxWaitMs`; add
  `readWindowMs?: (entry, p) => number` as the test seam. Update the header comment's rule list.
- `worker.ts`: `recordPresence` purpose is `"read"` when `job.trigger === "talk"`, else
  `"director"`. A run whose job `interruptRead` finished returns through the existing
  fenced/aborted path and writes nothing.
- `nodes/schemas.ts` `ReactOutput`: `outcome` gains `"confirm"`. New fields:
  ```ts
  confirm: z.array(z.object({
    characterId: RefIdSchema.nullable(),
    scope: z.enum(["character", "party"]),
    text: z.string().min(1).max(500),
    check: z.string().min(1).max(40).nullable(),
  })).max(4),
  answer: z.string().max(600).nullable(),
  ```
  `superRefine`: `confirm` needs 1 to 4 items, empty `text` and no `companionPrompts`; every other
  outcome needs an empty `confirm`.
- `prompts/react.ts`: `PROMPT_VERSION = "dm.react-v2"`, purpose `dm.narrate`. New rules: speech
  gets `reply`; a deed (a character tries something with an uncertain outcome or a cost) gets
  `confirm`, worded as "<Name> <does what>", with a check from the listed skills or `attack`; one
  item per acting character; never confirm for a companion; when a post holds `@dm`, set `answer`
  from what the characters can see, else `answer` null. The input gains the read posts flagged
  `@dm`, the human-controlled characters, the skill list and the table mode.
- `talk-turn.ts` `runTalkTurn`:
  1. `readPosts`: readable posts after the latest `isDmReadOutput` entry, up to `triggerSeq` (R9).
  2. Skip the model only when no read post is human-authored and `needsModel` is false.
  3. One `react` call, checkpointed in `TurnCheckpoint.react` as today.
  4. `confirm`: keep items per FR-010 and the turn-mode rule; normalize `check` to a
     `SkillSchema` option or `attack`, else null. No item left: outcome `none`.
  5. Code checks (`deterministicChecks`, the `dmOnlySeedText` substring check, `checkClaims` via
     the facts) run on the reply text, each confirm item's text and the answer. One regenerate; a
     second refusal ships no answer and records `none` for the outcome.
  6. Ship in order, each guarded by `ctx.deps.fence()` and recorded in `checkpoint.submissions`
     with keys `answer:` and `confirm:`: the answer as a `talk` proposal (`ai:dm`, `ooc`,
     `characterId: null`, public); then the confirm as `action.suggest` with `suggestionId =
     sug-<jobId>`, `readSeq` = the last read post's seq and items `i1`..`in`; or the D19 narration
     or escalation, as today. On a reclaim, a submission is landed when its row exists after
     `checkpoint.lastSeq` (an `action.suggested` with that id; an `ai:dm` OOC talk row).
  7. A gate refusal `SUGGESTION_STALE` records outcome `interrupted` and ships nothing more.
     The fence before each ship and this gate guard close the interrupt race for a confirm. A
     reply or an answer has no gate guard: one that passed its fence check just before the
     interrupt still lands. That window is one fence-to-append round trip; the new read then
     starts after it (its cutoff), so nothing is read twice.
  8. `jobs.result.talk` gains `confirmItems` (count) and `answered` (boolean).
- `prompts/common.ts` `transcriptEntries`: with a roster, also drop OOC talk except `@dm` posts and
  `ai:dm` answers (FR-013). `transcriptLine` renders an `action.suggested` entry as "DM asked to
  confirm: <item texts>".
- `nodes/resolve.ts`: before the action groups, load fresh projections once and skip beat items
  whose status is `withdrawn`; record them in the resolve output as `skipped: "withdrawn"` (FR-019).
- `floor.ts`, `floor-state.ts`: unchanged (R7).

### D4 — Web: composer, ring, Thinking, strip, confirm row, human DM editor

`apps/web/app/play/`:

- `source.ts`: `TableCommands` loses `declareAction` and `comment`. It gains
  `accept(input: AcceptInput): boolean` (`{ suggestionId, itemId }`) and
  `suggest(input: SuggestInput): boolean` (`{ readSeq, items }`; the frame builds `suggestionId =
  "sug-" + crypto.randomUUID()`). `commit` stays, used by the DM viewer only.
- `frames.ts`: remove `declareFrame` and `commentFrame`. Add `acceptFrame` and `suggestFrame`, each
  schema-validated with `GATE_REQUEST_VERSION`. `localEventOf` maps `action.suggest` to
  `action.suggested`; `action.accept` maps to null (fixture rows come from `local-log.ts`).
- `local-log.ts`: `localAcceptEvents(p, input, actor)` builds the two rows the planner would.
- `read-ring.ts` (new, pure): `readIndicator(p, viewer, nowMs): { kind: "hidden" } | { kind:
  "ring"; segments: number; filled: number; secondsLeft: number } | { kind: "thinking" }`. Hidden
  under a human seat or for a DM viewer. Thinking: the latest `read` marker is newer than every
  `ai:dm` row and readable post, and `nowMs` < marker `ts` + 30 s. Ring: the latest readable post
  with no later `read` marker or DM read output; elapsed = `nowMs` − post `ts`, clamped to
  `[0, window]`; hidden during the blank lead.
- `view-model.ts`:
  - `TranscriptItem` gains `{ kind: "confirm"; seq; confirm: ConfirmView }` and `{ kind: "aside";
    seq; text }` (an `ai:dm` OOC `talk`). The `talk` item gains `dmQuestion: boolean` (an `@dm`
    post; highlighted for the DM viewer) and `confirmable: boolean` (an IC line, for a human DM
    viewer). OOC talk keeps its marker, labelled "Table talk".
  - `ConfirmView`: `{ suggestionId; readSeq; lines: { itemId; text; check: string | null; state:
    "open" | "confirmed" | "superseded"; canAccept: boolean; waitingOn: string | null }[] }` from
    `suggestionState`.
  - `ActionCardView` loses `signoff`, `suggest` and `commitsOnOwnTurn`. `commit` becomes
    `ViewCommitAuthority | null`, null for every non-DM viewer. `canWithdraw`: status `declared`,
    `discussed` or `committed`, and the viewer is the declarer or the DM.
  - `ComposerView` becomes `{ speakers: { key; label; channel; characterId }[]; mentions: string[];
    thinkingInterrupts: boolean }`. Speakers: each controlled character, `The party` (IC,
    `characterId: null`) for a party member, and `You (out of character)`. Mentions: `@dm`, the
    party's names, then present combatant names (spec "smaller readings").
- `signoff.ts`: delete, with `apps/web/test/play/signoff.test.mjs`.
- `components/composer.tsx`: rewrite. A speaker chip button (`aria-haspopup="listbox"`,
  `aria-expanded`) opens an inline listbox under it. `((` or `/ooc` at the start of the draft
  selects the OOC speaker and strips the prefix. `@` at a word start opens an inline listbox of
  mentions, filtered as typed; arrow keys, Enter and Escape work. One submit button: "Send", or
  "Send — interrupts the DM" when `thinkingInterrupts` and the speaker is IC. Its first press opens
  the strip (`role="group"`, name "Interrupt the DM?") with the D20 §3.5 copy, **I'm sure** and
  **Wait**. The input takes a forwarded ref so Not quite can focus it. The notice stays inline.
- `components/read-ring.tsx` (new): an 8- or 4-segment SVG ring and the caption "The DM reads the
  table in N s. Keep talking to wait."; the Thinking chip "The DM is reading the table…" with
  `role="status"`. Segment changes carry no animation under `prefers-reduced-motion`.
- `components/confirm-row.tsx` (new): header "DM · Confirm this action", one line per item:
  "<text> — <check>. Is this right?", then 👍 Yes and Not quite (named "Yes, that's right" and
  "Not quite" for assistive tech), "Waiting on <name>", "Confirmed" or "Superseded" (struck through).
- `components/confirm-editor.tsx` (new): the human DM's inline editor under an IC line: fields
  "Confirm wording", "Check (optional)", "Who" (the line's character or The party); buttons "Send
  confirm" and "Cancel". It sends one `suggest` with `readSeq` = the line's seq.
- `components/transcript.tsx`: render `confirm`, `aside`, the "Table talk" tag, the `@dm`
  highlight and "Confirm as action…" (DM viewer only, toggles the editor in place).
- `components/action-card.tsx`: remove the comment form, the sign-off rows and the player commit
  control. Keep the comment list (read-only), the status chip, the DM's Commit and Withdraw.
- `table-view.tsx`: own the composer ref and the open-editor key; tick a `now` state once a second
  only while `readIndicator` is `ring` or `thinking`; render `ReadRing` above the composer.
- `use-live-table.ts`, `use-fixture-table.ts`: wire `accept` and `suggest`; drop declare and
  comment.
- `labels.ts` `refusalLabel`: `SUGGESTION_STALE` "The DM has read the table again. Answer the newer
  line."; `SUGGESTION_NOT_FOUND` "That confirm is gone. Say it again."; `ACTION_EXISTS` "That
  action is already confirmed."
- `authority.ts`, `proposals.ts`, `presence.ts`: unchanged.

### D5 — Fixtures, scripts and tests

- `packages/session-model/test/`: `read-rule.test.ts` (new: each FR-005 rule, `isDmQuestion`,
  windows, `isDmReadOutput`, `suggestionState` stale and accepted cases); `gate-suggest.test.ts`
  (new: suggest rows and refusals, `ai:dm` stale guard, accept authority per mode and scope, the
  two-row batch, stale and not-found, `ACTION_EXISTS` on a second 👍, `ai:dm` accept refused, a
  direct declare with `suggestionId` refused); `gate-plan.test.ts` (withdraw of a committed action;
  of a resolved one refused); `gate-schemas.test.ts`, `gate-policy.test.ts`,
  `gate-permissions.test.ts` (counts, `auto`, the matrix rows); `catalog.test.ts` (20 and 38);
  `actions.test.ts` (the withdrawn fold); `presence.test.ts` (`read`); `fixtures.test.ts` (the new
  fixture's facts); `talk-isolation.test.ts` unchanged and passing.
- `apps/server/test/dm/talk-triggers.test.ts`: `isReadable` delegation; `needsModel` with a human
  post.
- `apps/server/test/dm/enqueue-talk.integration.test.ts` (DB): `notBefore` = post `ts` + 10 s; a
  second post moves it; OOC does not; `@dm` does; turn-mode active human + 5 s; non-active does
  not; no cap after 12 posts; `interruptRead` on a running empty-beat talk turn finishes it and
  queues a fresh one; it leaves a talk turn with a beat or a shipped row alone.
- `apps/server/test/dm/talk-turn.integration.test.ts` (DB): confirm ships one `action.suggested`;
  a companion or absent item is dropped; an `@dm` answer ships first as `ai:dm` OOC talk; a DM-only
  leak in an answer is refused then dropped; a stale suggest records `interrupted`; reclaim reuses
  the react output and ships once.
- `apps/server/test/dm/worker.integration.test.ts`: a `talk` turn records the `read` marker; an
  interrupted run writes nothing after the interrupt.
- `apps/server/test/dm/resolve.integration.test.ts`: a beat action withdrawn mid-turn is skipped.
- `apps/server/test/dm/jobs.integration.test.ts`: reconcile skips a withdrawn committed action.
- `apps/server/test/gate.integration.test.ts`: suggest then accept over the real gate writes the
  batch and queues a commit turn; two concurrent accepts commit once.
- `apps/server/test/dm/react-prompt.test.ts`, `player-facing-prompts.test.ts`: `dm.react-v2`, the
  confirm and answer rules, OOC dropped from the tail.
- `apps/server/test/write-boundary.test.ts`: D2's pins.
- `apps/server/test/dm/scripts/talk-confirm.json`, `talk-answer.json` (new fixtures).
- `apps/server/dm-scripts/greyhollow-confirm.json` (new): scene start, then a read that confirms
  Kestrel's climb, then a read that answers Tamsin's `@dm` question. `dm-scripts.test.ts` proves
  the composition.
- `apps/web/test/play/`: `read-ring.test.mjs` (new: blank lead, segments, clamp, Thinking start
  and its three ends, human seat hidden); `confirm-row.test.tsx` (new: controller, other player,
  party, superseded, confirmed); `composer.test.tsx` (rewrite: chip listbox, `((`, `/ooc`, `@`
  listbox, interrupt label and strip, OOC never strips); `view-model.test.mjs`,
  `action-card.test.tsx`, `table-view.test.tsx`, `equivalence.test.tsx`, `frames.test.mjs`,
  `local-log.test.mjs`, `use-fixture-table.test.mjs`, `start-scene-panel.test.tsx` (amended for
  the removed commands and fields); a no-modal assertion over the new components.

### D6 — Mutation guard

Stub `isReadablePost` to return `false`; stub `suggestionState` to report never stale; stub the
accept acceptor rule to pass; stub `interruptRead` to return null without updating. Each fails at
least one test. Restore; `git diff` is empty.

### D7 — Script-mode live check

`specs/066-one-chat-stream/evidence/post.mjs` posts a line as a named player over the WS `send`
frame (from 065's `talk.mjs`; channel and text from arguments). The orchestrator runs
`DM_FAKE_SCRIPT=greyhollow-confirm` on the worktree stack in two Brave windows (Tamsin and
Kestrel).

## Files touched

| File | Change |
|---|---|
| `packages/session-model/src/events/actions.ts` | `ActionSuggestedV1`, `SuggestionItemV1`, `suggestionId` on declared (D1) |
| `packages/session-model/src/events/presence.ts` | purpose `read` (D1) |
| `packages/session-model/src/catalog.ts` | `action.suggested` entry (D1) |
| `packages/session-model/src/projections/types.ts`, `apply.ts` | `suggestions`, transcript entry, `ActionView.suggestionId`, withdrawn-from-committed (D1) |
| `packages/session-model/src/read.ts` | new: readable rule, windows, staleness (D1) |
| `packages/session-model/src/index.ts` | exports (D1) |
| `packages/session-model/src/fixtures/one-chat-stream.ts`, `fixtures/index.ts` | new fixture (D1) |
| `packages/session-model/src/gate/proposals.ts`, `policy.ts`, `permissions.ts`, `refusals.ts`, `plan.ts` | kinds, policy, matrix, codes, planner (D2) |
| `apps/server/src/gate/gate.ts` | `recordPresence` purpose type (D2) |
| `apps/server/src/dm/talk-triggers.ts` | delegate the read rule; `needsModel` (D3) |
| `apps/server/src/dm/jobs.ts` | window, `interruptRead`, reconcile (D3) |
| `apps/server/src/dm/enqueue.ts` | rule 7 (D3) |
| `apps/server/src/dm/worker.ts` | `read` marker (D3) |
| `apps/server/src/dm/nodes/schemas.ts` | `ReactOutput` confirm and answer (D3) |
| `apps/server/src/dm/prompts/react.ts`, `prompts/common.ts` | `dm.react-v2`; OOC tail filter; suggestion line (D3) |
| `apps/server/src/dm/talk-turn.ts` | cutoff, confirm, answer, ship order, stale handling (D3) |
| `apps/server/src/dm/nodes/resolve.ts` | skip withdrawn beat items (D3) |
| `apps/web/app/play/source.ts`, `frames.ts`, `local-log.ts`, `use-live-table.ts`, `use-fixture-table.ts`, `labels.ts` | commands and frames (D4) |
| `apps/web/app/play/read-ring.ts` | new (D4) |
| `apps/web/app/play/view-model.ts` | transcript items, `ConfirmView`, card and composer views (D4) |
| `apps/web/app/play/signoff.ts` | deleted (D4) |
| `apps/web/app/play/table-view.tsx` | wiring, ticker, focus (D4) |
| `apps/web/app/play/components/composer.tsx`, `transcript.tsx`, `action-card.tsx` | rewrite or edit (D4) |
| `apps/web/app/play/components/read-ring.tsx`, `confirm-row.tsx`, `confirm-editor.tsx` | new (D4) |
| tests and scripts in D5 | new or amended |
| `specs/066-one-chat-stream/evidence/post.mjs` | live-check post script (D7) |
| contract files in "Contract amendments" | amendment blocks (this commit) |
| `docs/wiki/play-route.md`, `proposal-gate.md`, `session-model.md`, `dm-talk-triggers.md`, `dm-turn-jobs.md`, `turn-floor.md`, `presence.md`, `CAPSULES.md`, `INDEX.md` | re-ground (Phase 6) |
| `docs/design/m3-table-sweep-runbook.md` | execution-log row (Phase 6) |

**Migrations**: none. `jobs` kinds, statuses and indexes are unchanged; the new fields live in
`jobs.input` and `jobs.result` JSON; the event log takes the new type through the catalog.
**New runtime dependencies**: none.

## Contract amendments

Each file gets one appended block headed "**Amendment (TASK-0188).**" that cites "decision-0028 §8;
operator ruling 2026-11-02: \"All (a), amend\"". Existing text is not rewritten.

| File | What the block changes |
|---|---|
| `specs/029-proposal-gate/contracts/proposals.md` | §8.1: kinds 15 → 17 (`action.suggest`, `action.accept`), DM kinds 13 → 14, `GATE_REQUEST_KINDS` 19 → 21; both schemas; matrix rows; `action.withdraw` on a committed, unresolved action; `ai:dm` never accepts; a direct declare with `suggestionId` is `INVALID_PROPOSAL` |
| `specs/029-proposal-gate/contracts/policy-and-authority.md` | §8.2: `"action.suggest": "auto"`; `routeProposal` refuses `ai:dm` accept; the accept authority rule; the D8 table's new first row; the two refusal codes |
| `specs/029-proposal-gate/contracts/proposal-events.md` | §8.3: `action.suggested`; `suggestionId` on `action.declared`; `presence.recorded` purpose `read`; the `suggestions` projection and transcript entry; `action.withdrawn` folds on a committed action; catalog 37 → 38 |
| `specs/029-proposal-gate/contracts/gate-api.md` | rows for `action.suggest`, `action.accept` and the widened `action.withdraw`; the refusal list gains the two codes (21 codes) |
| `specs/028-session-model/contracts/session-events.md`, `projections.md` | pointers to the 029 `proposal-events.md` block, as that contract requires |
| `specs/035-presence/contracts/presence-marker.md` | purpose `read`, written by the DM worker per claimed `talk` turn |
| `specs/030-play-route/contracts/proposal-seam.md` | §8.4: `ActionCardView.signoff` leaves; `ConfirmView` rides the transcript |
| `specs/030-play-route/contracts/table-source.md`, `live-frames.md`, `ui-surfaces.md` | the command, frame and surface changes of D4 (D20 §1) |
| `specs/031-dm-runtime/contracts/turn-jobs.md`, `nodes.md`, `node-seam.md`, `purposes.md` | §8.5, additive: the ring window, `interruptRead`, the `read` marker, the reconcile skip, `confirm` and the answer, `dm.react-v2` |
| `specs/044-group-signoff/contracts/signoff.md` | the client section leaves the web; the quorum stays for direct declares (OQ-11 (a)) |
| `specs/049-turn-floor/contracts/floor-jobs.md` | the stall commit covers direct party declares only; an accept batch never arms it |
| `specs/049-turn-floor/contracts/ui-floor.md` | the two action-card lines leave the player view |

`docs/wiki/ws-protocol.md` frame shapes and `TalkV1`: unchanged (§8.6).

## Phases

1. Session model: events, catalog, projection, `read.ts`, fixture (sonnet).
2. Gate: kinds, policy, permission, planner, refusals, write-boundary pins (sonnet).
3. DM runtime: window, `interruptRead`, marker, react v2, talk path, resolve and reconcile skips
   (sonnet).
4. Web: composer, ring, Thinking, strip, confirm row, editor, sign-off removal (sonnet).
5. Contract check and wiki re-ground (sonnet).
6. Verification: DB suites, mutation guard, Brave live check **[orchestrator]**.

## Live check

Phase 6 runs D7. Expected: Kestrel's IC line starts the ring in both windows; Thinking replaces it;
Kestrel sees the confirm with 👍 Yes and Not quite; Tamsin sees "Waiting on Kestrel"; Kestrel's 👍
shows "Confirmed" and a commit turn runs; Tamsin's `@dm` question draws one DM aside; no modal at
1280 and 390 px, light and dark.
