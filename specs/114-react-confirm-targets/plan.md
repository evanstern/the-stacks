# Implementation Plan: dm.react confirm targets parse

**Spec**: `specs/114-react-confirm-targets/spec.md` | **Card**: TASK-0336 | **Branch**: `task-0336-react-confirm-targets`
**Authored against**: `origin/main` `91c628e9`.

## Summary

The react prompt shows the target ref shape, an example and a `Targets` list (`dm.react-v5`). A
`normalizeReact` pass on the react call fills a missing `kind` from that same list. A failed read
appends one public DM aside. `callJson` renders a discriminator miss as a named missing field. The
harness gains `confirm` moves, and the CI scenario plays one. No migration, no new dependency, no
frame or event change.

## Constitution Check (3.0.0)

| Principle | Verdict |
|---|---|
| I Agent-operable | Pass. The scripted seat drives the confirm path through `intent` and `action.accept`, as a human does. |
| II One Intent vocabulary | Pass. `TargetRefSchema` is unchanged; the repair writes a canonical ref before the schema runs. |
| III Event-sourced, server authority | Pass. The notice is an ordinary `talk` proposal through the gate. No event type changes. |
| IV Three data planes | Pass. No plane touched. |
| V Many views, one state | Pass. The notice is a public row; the web's existing `aside` item shows it. |
| VI Engine owns the numbers | Pass. No numbers. The notice text is digit-free. |
| VII Narration around facts | Pass. The read ships the same rows; only the body parses. |
| VIII Campaign is data | Pass. Seeds unchanged. The `Targets` list reads the snapshot. |
| IX UX quality bar | Pass, strengthened. A failed read is no longer silent. The notice is an inline row, never a modal. |
| X Grounded claims carry citations | Pass. |
| XI Operator-owned content | Pass. |
| XII Self-hostable | Pass. No purpose or config change. |
| XIII Plan just-in-time | Pass. Item and entity repair waits for a registry (spec OQ-3). |

## Design

### D1 — Prompt (`dm/prompts/react.ts`)

- `PROMPT_VERSION = "dm.react-v5"`.
- OUTPUT_SHAPE confirm line: `"body":{"kind":str,"targets":[ref],"params":{},"text":str (optional)}`.
- Add after it: `Target refs: {"kind":"zone","id":id} for a place, {"kind":"actor","id":id} for a character, {"kind":"entity","id":id}, {"kind":"item","id":id}. Use only ids listed under Targets. A target is never a bare id.`
- Add `Example confirm: ${JSON.stringify(EXAMPLE_CONFIRM)}`, where `EXAMPLE_CONFIRM` is exported:
  `{"characterId":"tamsin","text":"Tamsin searches the ferry house.","body":{"kind":"search","targets":[{"kind":"zone","id":"ferry-house"}],"params":{"skill":"perception"}}}`.
- `ReactPromptInput` gains `targets: readonly KnownTarget[]`. The user prompt adds
  `section("Targets (confirm items name only these)", lines, 400, "end")` after the human list.
  Each line: `${id} (${kind}, ${name})`.

### D2 — Known targets and repair (`dm/talk-turn.ts`, pure exports)

```ts
export interface KnownTarget { kind: "zone" | "actor"; id: string; name: string }
export function knownTargets(snapshot: ActorSnapshot): KnownTarget[];
export function normalizeReact(json: unknown, known: readonly KnownTarget[]):
  { json: unknown; repairs: number };
```

- `knownTargets`: `stage.zones` with `revealed`, then actors with `presence === "present"`.
- `normalizeReact` returns `json` untouched when it is not an object with a `confirm` array. Per
  item, per `body.targets` entry: a string `s`, or an object whose keys are exactly `["id"]` with a
  string `id`, is a candidate. Match `known` by `id`, case-sensitive. Exactly one match: replace
  with `{ kind, id }` and count a repair. Zero or several matches: leave it. Any other entry:
  leave it. Never mutate the input; copy what changes.
- `ask()` builds `known` once and passes it to the prompt. It passes
  `normalize: (j) => { const r = normalizeReact(j, known); repairs = r.repairs; return r.json; }`.
  `callJson` runs `normalize` on each attempt. Each call overwrites `repairs`, so on success it holds
  the parsing attempt's count.
- `TalkResult` (`talk-triggers.ts`) gains `targetRepairs: number`, default 0. A checkpointed
  reclaim keeps 0 (no call ran).

### D3 — Read-failure notice (`nodes/resolve.ts`, `worker.ts`)

- `resolve.ts`: `export const READ_FAILURE_TEXT = "The DM could not answer your last post. Please post it again.";`
  and `submitReadFailureNotice(deps, sessionId)`: a `talk` proposal from `AI_DM`, channel `ooc`,
  `characterId: null`, visibility `public`, note `("DM read failure notice", READ_FAILURE_TEXT)`.
- `worker.ts`, in the failed branch after `await notice(...)`: when `job.input.trigger === "talk"`,
  call it inside the same try/log pattern as `notice` (`dm.notice.failed` on throw). The abandoned
  path (`onAbandoned`) is unchanged: it has no trigger in hand (spec OQ-1).
- The web needs no change: `view-model.ts` maps an `ai:dm` `ooc` talk row to `{ kind: "aside" }`.
  Add one view-model test that a public one reaches a player's transcript.

### D4 — Re-ask text (`pipeline/call.ts`)

In `parseAgainst`, map each issue:

```ts
const text = (i: z.core.$ZodIssue) =>
  "discriminator" in i && Array.isArray((i as { options?: unknown }).options)
    ? `field "${i.discriminator}" is missing or invalid; use one of: ${(i.options as unknown[]).join(", ")}`
    : i.message;
```

Path prefix and the 8-issue cap are unchanged. Probe on zod 4.6.5: attempt 2's shape gives path
`targets.0.kind` with `discriminator: "kind"` and `options`. Attempt 1's shape (a bare string) gives
`expected object, received string` with no discriminator; the repair handles that one, and an
unknown bare id keeps today's text. Check the exact issue property names against the installed zod
before writing the guard.

### D5 — Harness `confirm` moves (`playtest/scenario.ts`, `driver.ts`, `harness.ts`)

- `Move` gains `confirm: z.literal(true).optional()`. Refine: `intent` and `confirm` never both set.
- `nextMove` returns `{ text, actionId, ...(free.confirm ? { confirm: true } : {}) }`. It also passes
  `intent` (OQ-4 ruling (a), 2026-11-14).
- `createDmEnqueuer` in `runPlaytest` gets `readWindowMs: () => 0`.
- `harness.ts`, before the `move.intent` branch: when `move.confirm`, `parse(move.text, { id:
  move.actionId, actor: { kind: "pc", id: seat }, source: "composer", commit: "declared" })`, submit
  `{ kind: "intent", intent }`, settle, `drainIdle`. Load projections. For each suggestion with live
  items whose `intent.actor.id` is the seat character, submit `{ kind: "action.accept",
  suggestionId, itemId }`, settle, `drainIdle`. With none, push refusal `NO_CONFIRM`. Count one
  committed move.
- `greyhollow-ford.json`: insert `{ "text": "I search the ferry house.", "actionId": "confirm-search", "confirm": true }`
  after `act-search`.
- `test/dm/scripts/greyhollow-ford-deeds.json`: add, in the order the run consumes them, one
  `dm.narrate` JSON reply (`outcome: "confirm"`, one item for `tamsin`, body
  `{"kind":"search","targets":["ferry-house"],"params":{"skill":"perception"}}`), then the ruling
  turn's `dm.adjudicate` and its `dm.narrate` text. Add a die if the search rolls. Find the order by
  running the scenario; keep `scriptRemaining` at zero.
- `playtests/fixtures/greyhollow-ford.audit.json`: one `playtest.audit` pass response per new segment.
- `playtest.integration.test.ts`: update the segment count; assert FR-015.

### D6 — Tests (fake gateway only)

- `test/dm/react-prompt.test.ts` (extend): SC-001.
- `test/dm/react-normalize.test.ts` (new, unit): SC-003 cases over a `greyhollowDuo` snapshot.
- `test/dm/talk-turn.integration.test.ts` (extend, DB): the replay. Post `say` "I search the ferry
  house" as Tamsin, script the react reply with attempt 1's body, drain; then again with attempt 2's
  body. Each: one `action.suggested`, zone target, one `dm.narrate` call, `targetRepairs: 1`. Then
  the failure case: two replies with an unknown id `"mill"`; the job fails; the player projection
  (`role: "player"`) holds the FR-008 row; the DM projection holds both notices.
- `test/dm/call.test.ts` (extend): SC-005.
- `apps/web/test/play/view-model.test.mjs` (extend): a public `ai:dm` `ooc` talk row is an `aside`
  in a player's model.
- `test/playtest/driver.test.ts`, `scenario.test.ts`: the new move and `confirm` pass-through.
- `test/playtest/playtest.integration.test.ts`: FR-015.

## Files

| File | Change |
|---|---|
| `apps/server/src/dm/prompts/react.ts` | ref line, example, `Targets` section, `dm.react-v5` |
| `apps/server/src/dm/talk-turn.ts` | `KnownTarget`, `knownTargets`, `normalizeReact`, normalize wiring, `targetRepairs` |
| `apps/server/src/dm/talk-triggers.ts` | `TalkResult.targetRepairs` |
| `apps/server/src/dm/nodes/resolve.ts` | `READ_FAILURE_TEXT`, `submitReadFailureNotice` |
| `apps/server/src/dm/worker.ts` | public notice on a failed `talk` turn |
| `apps/server/src/dm/pipeline/call.ts` | discriminator issue text |
| `apps/server/src/playtest/scenario.ts`, `driver.ts`, `harness.ts` | `Move.confirm`; pass-through; zero read window; confirm submit and accept |
| `apps/server/playtests/scenarios/greyhollow-ford.json` | one `confirm` move |
| `apps/server/test/dm/scripts/greyhollow-ford-deeds.json` | react reply, ruling calls, die |
| `apps/server/playtests/fixtures/greyhollow-ford.audit.json` | audit responses for new segments |
| tests | D6 list |
| contracts | `031/purposes.md` (`dm.react-v5`), `031/resolve.md` and `031/turn-jobs.md` (the public read-failure notice), `031/node-seam.md` (re-ask issue text), `032/scenario.md` (`Move.confirm`, zero read window, the shipped move) |
| wiki | Phase 4 |

`nodes/schemas.ts`, `packages/intent`, `dm/enqueue.ts`, `dm/deeds.ts`, `pipeline/runner.ts`,
`nodes/narrate.ts` and the gate are not edited.

## Migrations, prompts, dependencies

- Migrations: none.
- Prompts: `dm.react-v4` → `dm.react-v5`.
- Dependencies: none. `zod` and `@the-stacks/intent` are installed server dependencies.

## Flags

- The confirm move adds a `talk` row, so the auditor closes a segment on it. Expect the segment
  count to move; `deeds-narrated` must pass on the ruled search deed (spec 111 rule (a)).
- The deeds script is a strict per-purpose queue. The react reply is a `dm.narrate` JSON entry and
  must sit at its consumption position among the `dm.narrate` text entries.
- `talk-turn.integration.test.ts` uses `talkQuietMs: 0` already; the harness change mirrors it.
