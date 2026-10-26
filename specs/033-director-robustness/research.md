# Research: director robustness (TASK-0102)

Code read at `60e8f89` (origin/main at claim). Evidence read on the TASK-0048 branch
(`task-0048-playtest`), `docs/design/m2-demo/`.

## R1. Where the failure record lives

**Decision**: write the record to `jobs.result.failure` (jsonb). Keep `jobs.error` (text) as the
fixed string `stopped at <node>: <kind>`.

**Rationale**:
- `routes/dm.ts` `toItem` serves `jobs.error` on the operator route and states that only fixed
  strings are stored there. dm-api.md bars prompt and model text from that route.
- `worker.integration.test.ts` and the failure notice key on the `stopped at` prefix.
- `jobs.result` is jsonb and already holds `{ checkpoint, outcome, audit, calls }` for a
  finished turn job. `finishJob` (`jobs/queue.ts`) sets it to null on failure today; the change
  is an optional `result` beside `error`.
- `jobs` is shared with ingest. Ingest calls `finishJob` with `error` only, so its behaviour
  does not change.

**Alternatives rejected**: serialising the detail into `jobs.error` (breaks the fixed-string
rule and the route contract); a new column or table (needs a migration for no gain).

**Migration**: none. Checked `apps/server/src/schema/jobs.ts`: `result jsonb` and `error text`
exist with no CHECK on their content.

## R2. Excerpt bound

**Decision**: whole text up to 8000 characters; above that, the first 6000 and the last 2000
characters joined by `\n…[<n> characters elided]…\n`.

**Rationale**: run 4's 962-token output is about 4000 characters, so a typical director output
fits whole. A 1500-token cap is about 6000 characters. The head shows prose or a fence before
the JSON; the tail shows truncation. Two attempts bound the record near 16 KB per failed job.

## R3. What the token counts suggest

| Run | Attempt 1 | Attempt 2 | Reading |
|---|---|---|---|
| 2 (cap 600) | 600 | 395 | Attempt 1 truncated. Attempt 2 is a normal size and still failed. |
| 4 (cap 1500) | 962 | 280 | Attempt 1 is about twice a normal director output (241–589 elsewhere). Attempt 2 is a normal size and still failed. |

Both attempt 2s are normal-sized and fail after the model saw the issues. That points to a
constraint the model does not satisfy from the issue text, more than to formatting. Both
failing turns are the first where the director has a real decision: run 4 after the
persuasion succeeds (a tracker or a seed beat change), run 2 when the party heads to the reed
camp (the `reed-camp` encounter trigger and a `tableMode` switch). This is a reading, not
evidence. The fix waits for the capture (FR-011, FR-012).

## R4. Candidate causes and their fixes (the cause catalog)

The full catalog with the allowed fix for each cause is in
[contracts/director-output.md](contracts/director-output.md). Summary:

| Id | Cause | Likely signal in the record | Fix kind |
|---|---|---|---|
| C1 | Prose, a reasoning block or a fence around or before the JSON | issue `not valid JSON`; excerpt head is prose or `<think>` | parse: extract the first balanced JSON object |
| C2 | Truncation at maxTokens | outputTokens = cap; excerpt tail is cut mid-JSON | prompt brevity + operator raises `maxTokens` |
| C3 | A "no change" decision emitted as null, a bare string or omitted (`"tableMode":"stay"`, `"scene":null`, no `trackers`) | issue at `beat`, `tableMode`, `scene`, `trackers`, `companionPrompts` | normalize to the legality fallback |
| C4 | Prose fields over their cap (`goalNote`, `reason`) | `Too big: expected string to have <=300 characters` | normalize: cut at a word boundary under the cap |
| C5 | Soft pacing hints in the wrong format (`spotlight` as a name, `beatId` too long) | issue at `pacing.spotlight` or `pacing.beatId` | normalize: set to null |
| C6 | Enum drift (`"tension":"medium"`, `"outcome":"success"`) | `Invalid option` | prompt: list the values; no synonym mapping |
| C7 | Nested shape drift in a payload variant (hold with no `companions`, turn with no `reason`) | issue inside `beat` or `tableMode` | prompt: a worked example per variant |
| C8 | Number drift (`"advance":"+1"`, `advance` 0, 4) | issue at `trackers.N.advance` | prompt and re-ask text only; never coerced |
| C9 | Streaming concatenation (a router repeats the full text in a final chunk, or streams reasoning as content) | excerpt holds the JSON twice, or reasoning text | gateway adapter fix with an SSE test |

## R5. Why the strict schema stays strict

`DirectorOutput` is the contract in `specs/031-dm-runtime/contracts/director.md`. Loosening it
would also change what the legality code receives. A separate normalization step keeps the
contract fixed, keeps each rule testable, and keeps the reproduction test true after the fix:
the captured output still fails the strict v1 parse, and the new pipeline accepts it.

## R6. Numbers

TASK-0042 R8: the engine owns every number. Tracker clocks are the Director's narrative state
(director.md), not engine mechanics, but `advance` is still a number the model chose. No
normalization rule coerces, defaults, clamps or drops a number. C8 is fixed by prompt and
re-ask text only. A rule that needs a number changed is an operator checkpoint, not a fix
phase choice.

## R7. Where capture and verification run

The playtest harness (`apps/server/src/playtest/`) is on `task-0048-playtest`, not on `main`.
The capture needs Phase 1's diagnostics and the harness together. The orchestrator builds a
local composite worktree: TASK-0048's pushed tip with this branch merged in, detached, never
pushed. The harness writes `jobs.json` from the route shape, which omits the failure record
(R1), so the orchestrator reads the record from the database with SQL
([quickstart.md](quickstart.md)).

The host CLI cannot reach `host.docker.internal` provider URLs. The orchestrator sets
`AI_PROVIDERS` for the one command with `localhost` base URLs. The TASK-0048 CLI's own rewrite
does the same when its branch carries it.

## R8. Prompt version

The director prompt version is `dm.director-v1`. A prompt change bumps it to `dm.director-v2`.
`assemble.test.ts`, `routes.integration.test.ts` and `call.test.ts` name the version; they move
with it. The fake gateway scripts queue by purpose, not by version
(`contracts/fake-gateway-script.md` in 031), so the scripted run does not depend on it.

## R9. Dependencies

None. JSON extraction is a string-aware brace scan in `call.ts`. No vendor SDK
(decision-0007).

## R10. The interpret evidence (amendment, 2026-10-26)

R7 already names where the runs happen, so the interpret reading takes the next free number.

**Run**: `evidence/verify-20261026T152743Z-greyhollow-ford-provider/` (Phase 4). No turn job
failed at the director. 4 moves committed. The run stopped at **interpret** on an `npc-turn`
job (triggerSeq 61, `act-kestrel-1` in the beat plus the goblin turn). Spend $1.00 over 51
calls, under the $22 ceiling. Fixture:
`apps/server/test/dm/fixtures/interpret-capture-20261026T152743Z-greyhollow-ford-provider.json`.
Model `cc/claude-sonnet-5`, `dm.interpret` maxTokens 1200, prompt `dm.interpret-v1`.

| Attempt | outputTokens | chars | Issue | Reading |
|---|---|---|---|---|
| 1 | 1200 (= cap) | 331 | `not valid JSON: Unexpected token '`'` | Opened a ```` ```json ```` fence, then was cut mid-step. `stripFence` needs a closing fence, so the open fence is the first bad token. Catalog row I2. |
| 2 | 718 | 1014 | `readings.0.steps.0.onSuccess.0.condition: Invalid option` | Valid JSON. A Perception check's `onSuccess` applied the condition `spotted-lookout` to Kestrel. The model used a condition to record a narrative outcome. Catalog row I1. |

**Reading on tokens.** Attempt 1 reported 1200 output tokens for 331 visible characters (about
90 tokens of text). Attempt 2 reported 718 tokens for 1014 characters (about 250 tokens). The
director capture shows the same gap (783 tokens for 584 characters). The provider counts tokens
the excerpt does not show, most likely hidden reasoning, against `maxTokens`. Prompt brevity
alone therefore cannot prevent I2. The `maxTokens` raise is the load-bearing lever. The
successful `dm.interpret` calls in the same run reported 155, 671, 857, 664 and 718 output
tokens. The orchestrator proposes the new value from these numbers at the Phase 4b checkpoint
(T035). This is a reading, not a fix: no finish-reason passthrough and no code cap (ruling 3).

**Decision**: interpret stays strict (`contracts/interpret-output.md` invariants). The fix is
prompt v2 (I1, I2), the `maxTokens` checkpoint (I2) and the skill gate (I3, by the operator
requirement). A normalizer that drops or rewrites `spotted-lookout` is rejected: it would let a
model-invented rules term pass a gate silently, which the operator requirement forbids.

**Alternatives rejected**: mapping an unknown condition to narration (silent rewrite of a
mechanic); dropping an invalid effect (changes what the engine is asked to do); adding
`spotted-lookout`-style free conditions (an ungated rules term).

## R11. Rules-term gate audit and the skill key list

The audit table, the skill key list, where the enum lives, and every file whose skill value
changes are in [contracts/rules-terms.md](contracts/rules-terms.md).

**Decisions**:

- **Keys**: the 18 SRD 5.2.1 skills in lowercase kebab-case (`animal-handling`,
  `sleight-of-hand`). The shipped seed already uses lowercase single-word keys. Real model output
  in both paid runs already used lowercase (`medicine`, `perception`, `persuasion`).
- **Source**: one `z.enum` in the engine (`schema/state.ts`, beside `ConditionKeySchema`),
  used by `check.roll`. The server derives it from the `check.roll` command shape, as it derives
  `AbilitySchema`.
- **Events stay wide**: `check.resolved.skill` stays `z.string().nullable()`. Stored events with
  title-case skills exist in local stacks and tracked evidence. Narrowing needs an event version
  bump (constitution IV). New events carry a valid key because the command gate runs first.
- **Seed**: the seed's character `skills` keys and clue `check.skill` use the same enum. A seed
  with an unknown skill fails to load.
- **Prompts render the lists**: conditions, skills and damage types are rendered into
  `STEP_GRAMMAR` from the enums. `STEP_GRAMMAR` is shared with adjudicate, which emits the same
  `StepSchema`. Both prompt versions bump. Without the list in the adjudicate prompt, the new
  skill gate would add an adjudicate failure mode.
- **Not gated, carded**: spells (TASK-0105) and model-chosen modifiers and DCs (TASK-0104).
  Operator ruling 2026-10-26: both are m-3 and do not block the M2 demo.

**Dependencies**: none new. **Migration**: none. The skill gate changes Zod schemas only; no
table or column changes, and no stored row is rewritten.
