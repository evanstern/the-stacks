# Implementation Plan: dm.react confirm params parse

**Spec**: `specs/116-react-confirm-params/spec.md` | **Card**: TASK-0347 | **Branch**: `task-0347-react-params`
**Authored against**: `origin/main` `12807fdc`.

## Summary

The react prompt shows each kind's params from `INTENT_GRAMMAR`, a "most kinds take `{}`" rule and a
worked `move` example (`dm.react-v7`). A pure `stripParams` runs in the react call's `normalize` pass
after `normalizeReact` and removes top-level `params` keys a strict kind schema does not list. Each
strip is a `params-stripped` issue on the talk job's check record, which the debug routes return. The
CI scenario plays one invented-params move confirm. No migration, no new dependency, no frame or event
change, no schema loosened.

## Constitution Check (3.0.0)

| Principle | Verdict |
|---|---|
| I Agent-operable | Pass. The scripted seat drives the new confirm move through `intent` and `action.accept`. |
| II One Intent vocabulary | Pass. `packages/intent` and `IntentBodySchema` are unchanged. The strip only removes keys the schema rejects. |
| III Event-sourced, server authority | Pass. No event type changes. The record lives in `jobs.result`, operational state. |
| IV Three data planes | Pass. No plane touched. |
| V Many views, one state | Pass. No view change. |
| VI Engine owns the numbers | Pass, strengthened. A stray `dc` is stripped; no number is added. |
| VII Narration around facts | Pass. The confirm row ships the same Intent the schema would accept. |
| VIII Campaign is data | Pass. Seeds unchanged. |
| IX UX quality bar | Pass. A slip no longer costs a re-ask (about 3 s). |
| X Grounded claims carry citations | Pass. The reconstructed fixtures cite finding 3 and are marked. |
| XI Operator-owned content | Pass. |
| XII Self-hostable | Pass. No purpose or config change. |
| XIII Plan just-in-time | Pass. Interpret and companion strips wait for evidence (spec OQ-2). |

## Design

### D1 — Prompt (`dm/prompts/react.ts`)

- `PROMPT_VERSION = "dm.react-v7"`.
- Import `INTENT_GRAMMAR` from `./interpret.js`. Build `PARAMS_LINES`: the lines of
  `INTENT_GRAMMAR.split("\n")` that start with `"- "` and sit after the `"Kinds:"` line, up to the
  first line that does not start with `"- "`. Do not copy the text.
- Export `EXAMPLE_MOVE_CONFIRM`:
  `{ characterId: "tamsin", text: "Tamsin wades out onto the causeway.", body: { kind: "move", targets: [{ kind: "zone", id: "causeway" }], params: {} } }`.
- OUTPUT_SHAPE gains, after the target-ref line: `"Body kinds, targets and params:"`, the
  `PARAMS_LINES`, then `params holds only the keys listed for its kind. Most kinds take {}. Never add another key.`,
  then `Example move confirm: ${JSON.stringify(EXAMPLE_MOVE_CONFIRM)}` after the existing example.
- The `dm.interpret` and `dm.companion` prompts are not edited. `INTENT_GRAMMAR` is read, not changed.

### D2 — Strip (`dm/react-params.ts`, new, pure)

A new module keeps the edit out of `talk-turn.ts` beyond its wiring (concurrency note).

```ts
export interface ParamsStrip { kind: "params-stripped"; item: number; bodyKind: string; key: string }
export function stripParams(json: unknown): { json: unknown; strips: ParamsStrip[] };
```

- Build once at module load: `KNOWN = Map<kind, Set<key> | null>` from `IntentBodySchema.options`.
  Each member is a `z.strictObject`; read `member.shape.kind.value` and `member.shape.params`. When
  `params` is a `ZodObject` whose `def.catchall` is a `ZodNever` (a strict object in zod 4), the
  value is `new Set(Object.keys(params.shape))`. Otherwise it is `null` (do not strip). Check the
  installed zod 4.6.5 property names before writing the guard, as spec 114 D4 did.
- `stripParams` returns `json` untouched when it is not an object with a `confirm` array. Per item
  `i`: when `body` is an object, `body.kind` is a key of `KNOWN` with a non-null set, and
  `body.params` is a plain object, drop each top-level key not in the set and push
  `{ kind: "params-stripped", item: i, bodyKind, key }`. Copy only what changes; never mutate.
- Keys are compared exactly. Values are never read.

### D3 — Wiring and record (`dm/talk-turn.ts`, `dm/nodes/check.ts`, `dm/pipeline/context.ts`, `dm/worker.ts`)

- `talk-turn.ts` `ask()`: the `normalize` becomes
  `(j) => { const r = normalizeReact(j, known); repairs = r.repairs; const s = stripParams(r.json); strips = s.strips; return s.json; }`.
  Each call overwrites `strips`, so on success it holds the parsing attempt's list. A checkpointed
  reclaim keeps `[]` (no call ran).
- `nodes/check.ts` `CheckRecord` gains `stripped?: ParamsStrip[]` (type import from `../react-params.js`).
- `talk-turn.ts` sets `record.stripped = strips` after the check step (both the prose and the
  confirm path use `record`).
- `pipeline/context.ts`: the `talk` arm of `TurnOutcome` gains `check: CheckRecord`. `done()` in
  `talk-turn.ts` passes `record` (the initial record on the early returns).
- `worker.ts`, talk branch of `finishJob`: `check: outcome.check` in place of `check: null`.
- `routes/dm.ts`, `playtest/export.ts` and `playtest/auditor/audit.ts` need no change: they read
  `result.check` already, and the auditor reads only `leak` and `contradiction`.

### D4 — Tests (fake gateway only)

- `test/dm/react-prompt.test.ts` (extend): SC-001. Update the version assertion.
- `test/dm/react-params.test.ts` (new, unit): SC-002, using `RECONSTRUCTED_F1` and `RECONSTRUCTED_F2`.
- `test/dm/fixtures/react-params-hosted.ts` (new): the four spec fixtures, exported as
  `RECONSTRUCTED_F1`, `RECONSTRUCTED_F1_RETRY`, `RECONSTRUCTED_F2`, `RECONSTRUCTED_F2_RETRY`, with a
  comment citing spec 116 "Replay fixtures (reconstructed)".
- `test/dm/talk-turn.integration.test.ts` (extend, DB): SC-003–SC-005. Post `say` "I wade out onto
  the causeway" as Tamsin, script each fixture as the react reply, drain. Assert one
  `action.suggested` row, a `move` Intent to `causeway` with `params: {}`, one `dm.narrate` call, and
  `jobs.result.check.stripped`.
- `test/playtest/playtest.integration.test.ts` (extend): FR-014, segment count.

### D5 — CI scenario (`playtest/` data only)

- `playtests/scenarios/greyhollow-ford.json`: insert
  `{ "text": "I wade back to the near bank.", "actionId": "confirm-move", "confirm": true }` after `deed-move`.
- `test/dm/scripts/greyhollow-ford-deeds.json`: add, at its consumption position, one `dm.narrate`
  JSON reply (`outcome: "confirm"`, one `tamsin` item, body
  `{"kind":"move","targets":[{"kind":"zone","id":"near-bank"}],"params":{"ready":true,"caution":"high"}}`),
  then whatever the ruling turn consumes (a move needs no roll; expect a `dm.narrate` text only).
  Find the order by running the scenario; keep `scriptRemaining` at zero.
- `playtests/fixtures/greyhollow-ford.audit.json`: one `playtest.audit` pass response per new segment.
- Negative proof: with `stripParams` stubbed to identity, the run fails (the react reply fails twice,
  the scripted retry finds no reply or the wrong one). Record the result in the commit message; do
  not commit the stub.
- The harness code (`scenario.ts`, `driver.ts`, `harness.ts`) already supports `confirm` moves
  (spec 114) and is not edited.

## Files

| File | Change |
|---|---|
| `apps/server/src/dm/prompts/react.ts` | `PARAMS_LINES`, rule line, `EXAMPLE_MOVE_CONFIRM`, `dm.react-v7` |
| `apps/server/src/dm/react-params.ts` (new) | `ParamsStrip`, `stripParams` |
| `apps/server/src/dm/talk-turn.ts` | normalize wiring, `record.stripped`, `check` on the talk outcome |
| `apps/server/src/dm/nodes/check.ts` | `CheckRecord.stripped?` |
| `apps/server/src/dm/pipeline/context.ts` | `TurnOutcome` talk arm gains `check` |
| `apps/server/src/dm/worker.ts` | talk `result.check` from the outcome (one line) |
| `apps/server/playtests/scenarios/greyhollow-ford.json` | `confirm-move` |
| `apps/server/test/dm/scripts/greyhollow-ford-deeds.json` | react reply with invented keys, ruling narration |
| `apps/server/playtests/fixtures/greyhollow-ford.audit.json` | audit responses for new segments |
| `apps/server/test/dm/react-prompt.test.ts`, `react-params.test.ts` (new), `fixtures/react-params-hosted.ts` (new), `talk-turn.integration.test.ts`, `test/playtest/playtest.integration.test.ts` | D4 |
| contracts | `031/purposes.md` (`dm.react-v7` amendment: params lines, strip), `031/node-seam.md` (talk result `check` with `stripped`), `032/scenario.md` (the shipped `confirm-move`) |
| wiki | Phase 3 |

Not edited: `packages/intent`, `nodes/schemas.ts`, `prompts/interpret.ts`, `prompts/companion.ts`,
`nodes/narrate.ts`, `prompts/narrate.ts`, `nodes/resolve.ts`, `dm/enqueue.ts`, `dm/deeds.ts`,
`pipeline/runner.ts`, `pipeline/call.ts`, `playtest/harness.ts`, `routes/dm.ts`, the gate and the web.

## Concurrency

TASK-0350 and TASK-0348 edit the talk and narrate path (`nodes/narrate.ts`, `talk-turn.ts`) in a
sibling session. This card's `talk-turn.ts` edit is limited to `ask()`'s normalize, the `record`
line after the check step, and `done()`'s `check` field. `worker.ts` is one line in the talk branch.
The deeds script and the scenario JSON are shared with any card that adds scripted calls: merge
`origin/main` before Phase 2 and before the PR, and re-run the scenario after each merge.

## Migrations, prompts, dependencies

- Migrations: none.
- Prompts: `dm.react-v6` → `dm.react-v7`.
- Dependencies: none. `zod` and `@the-stacks/intent` are installed server dependencies.

## Flags

- A talk job now writes `result.check` with its `leak` and `contradiction` lists. The playtest
  auditor turns those into `note` findings (`dm-audit-flag`), so a talk turn's leak drop can now add
  a note. Notes never fail an audit. If `playtest.integration.test.ts` counts notes, update the count
  and say so in the commit message.
- The deeds script is a strict per-purpose queue. The react reply is a `dm.narrate` JSON entry and
  must sit at its consumption position among the `dm.narrate` text entries.
- `IntentBodySchema.options` exposes the members only through zod internals. If the member shapes
  are not reachable as D2 says, build `KNOWN` from `INTERPRET_KINDS` and `paramsSchemaOf(kind).shape`
  minus `dc` (the same rule `bodyParams` applies), and say so in the commit message.
