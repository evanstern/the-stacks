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
