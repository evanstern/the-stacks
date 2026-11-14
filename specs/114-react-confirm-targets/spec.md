# Feature Specification: dm.react confirm targets parse

**Feature Branch**: `task-0336-react-confirm-targets`
**Card**: TASK-0336 (milestone m-10). Dependent: TASK-0338. Serial after TASK-0337 (runbook amendment 2026-11-13, wave 1).
**Created**: 2026-11-14
**Status**: Draft
**Authored against**: `origin/main` `91c628e9` (contains TASK-0337, spec 111, merge `068762ae`).
Evidence: `docs/playtests/2026-11-13-r1-spine-test-drive.md` finding 8 (session `0106e608`, job `fc1f6c10`, seq 36).
Runbook: `docs/design/r1-fast-table-runbook.md` "Amendment 2026-11-13". Operator ruling: "Approved, but automate the tests".
**Clarify**: skipped. The cause is in code, and the card ACs settle the behaviour. Three judgment
calls have recommended defaults (Open questions).
**Spec Kit**: authored directly in the template shape, as spec 111 was. The skills were not run, so
`.specify/feature.json` is untouched.

## Summary

A player wrote "I search the ferry house" in free mode. The read (`talk` turn) asked `dm.react-v4`.
The model answered `confirm` with a search body, but each attempt wrote the target without its
`kind`:

- attempt 1: `targets: ["ferry-house"]`
- attempt 2: `targets: [{ "id": "ferry-house" }]`

`ConfirmItem.body` is `IntentBodySchema`, whose targets are `TargetRefSchema`: a strict
discriminated union on `kind` (`actor|entity|item|zone|square|point`). Both attempts failed the
schema, so `callJson` returned `invalid-output`. The job stopped at `narrate: invalid-output`. The
only notice is the `dm`-visibility failure row, so the player saw nothing.

Four faults follow:

1. **The prompt never shows the shape.** `prompts/react.ts` OUTPUT_SHAPE writes `"targets":[]` with
   no ref form and no example. The user prompt lists place names (fiction view), never ids.
2. **Nothing repairs an obvious miss.** The id named exactly one revealed zone. Code could have
   supplied `kind: "zone"`.
3. **A failed read is silent to the player.** `submitFailureNotice` writes `visibility: "dm"`.
4. **CI never plays this path.** The scripted scenario's prose moves go through declare and commit
   (`dm.interpret`); its slash moves are direct Intents. No move reaches `dm.react` confirm.

The re-ask also reads poorly. Attempt 1's issue is `expected object, received string`; attempt 2's
is `Invalid discriminator value`. Neither says "the field `kind` is missing".

## Where each fix belongs (decision record)

| Fault | Option | Verdict | Reason |
|---|---|---|---|
| 2 | A. Loosen `TargetRefSchema` or `ConfirmItem` | Rejected | `TargetRefSchema` is the Intent contract (Principle II). A loose schema lets bad refs reach the gate. |
| 2 | B. Repair after a schema pass in `talk-turn.ts` | Rejected | The schema fails first, so the repair never sees the item. |
| 2 | C. A `normalize` pass on the `callJson` request | **Chosen** | The seam exists (`normalizeDirector`, `normalizeChronicle`). It runs before the schema on both attempts, so a repaired reply costs no re-ask. |
| 3 | A. Make the existing failure notice public | Rejected | That row names the node and error kind. It is operator text, and every trigger uses it. |
| 3 | B. A new frame or row kind | Rejected | The existing carrier fits, and the ws frames are frozen. |
| 3 | C. A second notice: a public `ooc` `talk` row from `ai:dm` for a failed `talk` turn | **Chosen** | The web already renders an `ai:dm` `ooc` talk row as an inline `aside` row in the Table stream (`view-model.ts`). No modal, no new kind. `isDmReadOutput` counts it, so the next read does not re-read the failed post. |
| 5 | A. Change only the prompt | Rejected | The re-ask text comes from `callJson`, not the prompt. |
| 5 | B. Custom messages on `TargetRefSchema` | Rejected | It edits the shared Intent package for one caller's wording. |
| 5 | C. Render discriminator issues in `callJson` | **Chosen** | One code change in `parseAgainst`. Every JSON call benefits (interpret targets too). Zod 4 gives the issue's `discriminator` and `options`. |

Fix 5 needs code: zod's default text never says "missing". The repair (fix 2) makes the re-ask rarer,
because only an unknown or ambiguous id reaches it. That is the case where a clear message matters most.

## Acceptance criteria map

| Card AC | Requirements | Success criteria | Phase |
|---|---|---|---|
| #1 The prompt shows the target shape with a worked example; a scripted test replays both failing outputs | FR-001–FR-003 | SC-001, SC-002 | 1 |
| #2 A confirm item whose target lacks only `kind` is repaired when the id names exactly one known zone, actor or item, with a test | FR-004–FR-007 | SC-002, SC-003 | 1 |
| #3 A failed react turn tells the player the DM could not answer | FR-008–FR-010 | SC-004 | 2 |
| #4 The scripted CI scenario includes a free-mode targeted deed through `dm.react` confirm | FR-012–FR-015 | SC-006 | 3 |
| Brief item 5: the schema-repair re-ask names the missing field | FR-011 | SC-005 | 2 |

## User scenarios

### US1 — A prose search becomes a confirm row (P1, AC #1, #2)

Tamsin posts "I search the ferry house" in free mode. The read runs. The model replies with either
failing shape from the test drive. Code supplies `kind: "zone"`. One `action.suggested` row ships
with a declared `search` Intent targeting `{ kind: "zone", id: "ferry-house" }`. The model was
called once.

### US2 — An unknown or ambiguous id is not guessed (P1, AC #2)

The model writes a target id that names no listed target, or names a zone and an actor at once.
Code leaves the target unchanged. The schema fails, and the re-ask names the missing `kind` field
and its allowed values.

### US3 — A failed read tells the player (P1, AC #3)

The model fails the schema twice. The job fails as today, with its `dm` failure notice. Tamsin also
sees one inline DM aside: the DM could not answer her last post.

### US4 — CI plays the confirm path (P1, AC #4)

The CI scenario posts a prose search as a `say` Intent, waits for the read, and accepts the confirm
row. The AI seat rules it, and the ruling turn narrates it (spec 111). A confirm-schema regression
fails the job, so the harness outcome is `failed` and CI fails.

## Requirements

### Prompt (AC #1)

- **FR-001**: The react OUTPUT_SHAPE MUST write a confirm body as `"targets":[ref]`. A new line MUST
  state the ref forms: `{"kind":"zone","id":id}`, `{"kind":"actor","id":id}`,
  `{"kind":"entity","id":id}`, `{"kind":"item","id":id}`. It MUST say a target is never a bare id.
- **FR-002**: The system prompt MUST hold one worked confirm example: a `search` item for a human
  character, with `targets:[{"kind":"zone","id":"ferry-house"}]`.
- **FR-003**: The user prompt MUST hold a `Targets` section with one line per listed target:
  `<id> (<kind>, <name>)`. It lists revealed zones and present actors only (FR-005). Bump the
  prompt to `dm.react-v5`.

### Repair (AC #2)

- **FR-004**: The react call MUST pass a `normalize` function to `callJson`. It edits only
  `confirm[].body.targets[]` entries that are a bare string, or an object whose only key is `id`.
- **FR-005**: The known targets MUST come from the assembled snapshot. Zones: `stage.zones` with
  `revealed: true`. Actors: snapshot actors with `presence === "present"`, by `id`. Items: none.
  No item or entity registry exists in the snapshot or seed, so no id resolves to those kinds.
- **FR-006**: A target id that matches exactly one known target MUST become `{ kind, id }`. An id
  that matches no known target (unknown), or matches targets of two kinds (ambiguous), MUST stay
  unchanged. The schema then fails, and the existing re-ask runs.
- **FR-007**: The talk result MUST record the count of repaired targets as `targetRepairs` in
  `jobs.result.talk`. This shows whether the prompt fix or the repair carries the hosted model.

### Failure path (AC #3, brief item 5)

- **FR-008**: When a `talk`-trigger turn fails (not fenced, not aborted), the worker MUST append a
  second notice after the `dm` notice: a `talk` row from `ai:dm`, channel `ooc`, visibility
  `public`. Its text is fixed and digit-free: `The DM could not answer your last post. Please post it again.`
- **FR-009**: The notice MUST be submitted from `nodes/resolve.ts`, beside `submitFailureNotice`, so
  every gate call stays in that module.
- **FR-010**: Other triggers keep today's `dm`-only notice (Open question OQ-1).
- **FR-011**: `parseAgainst` in `pipeline/call.ts` MUST render an issue that has a `discriminator`
  as `<path>: field "<discriminator>" is missing or invalid; use one of: <options joined by ", ">`.
  Other issues render as today. The ledger, log line and `invalid-output` detail carry the new text.

### CI scenario (AC #4)

- **FR-012**: A scenario `Move` MAY set `confirm: true`. The harness then parses `text` as a declared
  composer Intent (plain prose parses to `say`), submits it through the gate, and drains. It then
  accepts each live suggestion item whose Intent actor is the seat's character, through
  `action.accept`. With no such item, it records a refusal with code `NO_CONFIRM`.
- **FR-012a**: `nextMove` MUST carry `confirm` from the scenario move into the `DriverMove` it
  returns. It MUST NOT start carrying `intent` (OQ-4).
- **FR-013**: The harness enqueuer MUST use a zero read window. The scripted seat has no one to wait
  for, and a 10 s window leaves the read unclaimed when `drainIdle` returns.
- **FR-014**: The shipped CI scenario MUST play `I search the ferry house.` as a `confirm` move,
  right after `act-search`. Its scripted react reply MUST use the attempt 1 shape
  (`targets: ["ferry-house"]`), so CI also exercises the repair.
- **FR-015**: `playtest.integration.test.ts` MUST assert that the run has no refusals, that one
  `action.suggested` row holds a `search` Intent with a zone target, and that `deeds-narrated` still
  passes on every segment.

## Success criteria

- **SC-001**: `react-prompt.test.ts` asserts `dm.react-v5`, the ref line, the worked example, and a
  `Targets` section that lists `ferry-house (zone, …)` and omits a hidden zone and an absent NPC.
- **SC-002**: A DB integration test replays each test-drive output through the real gate and read.
  Each ships one `action.suggested` row with `{ kind: "zone", id: "ferry-house" }`. The provider saw
  one `dm.narrate` call. `targetRepairs` is 1.
- **SC-003**: Unit tests of the repair: bare string, `{id}`, unknown id, ambiguous id, an object
  with extra keys, an already-valid ref, and a non-confirm reply all behave per FR-004–FR-006.
- **SC-004**: A DB integration test: two schema failures fail the talk job. The player's projection
  holds one public `ai:dm` `ooc` talk row with the FR-008 text. The `dm` notice is still there.
- **SC-005**: `call.test.ts`: a discriminator miss puts `field "kind" is missing or invalid; use one of:`
  and the options in the re-ask message.
- **SC-006**: The CI scenario run ends `ended`, its audit passes, `scriptRemaining` is zero, and
  FR-015 holds. Breaking `normalizeReact` makes the run fail.

## Scope

- **In**: react prompt and `Targets` section, react normalize, `targetRepairs`, public read-failure
  notice, re-ask issue rendering, harness `confirm` moves and zero read window, the CI scenario
  move, contract amendments, wiki.
- **Out**: interpret-path target repair (interpret already shows refs and an example). An item or
  entity registry. Public notices for non-`talk` triggers (OQ-1). The quoted-dialogue leak (TASK-0335).

## Open questions

- **OQ-1**: Should a failed `commit`, `intent` or `ruling` turn also tell the player? It leaves the
  player equally silent. Default: no, AC #3 names the react turn. Recommend the orchestrator card it.
- **OQ-2**: A hidden zone id is not a known target, so the model cannot confirm a deed on it. A
  player who names a place they have not found gets the re-ask, then the FR-008 notice. Default:
  keep it. A hidden zone in a confirm body would leak the zone to the confirm row.
- **OQ-3**: Item and entity targets never repair, because nothing lists them. That is not a deferral:
  the repair reads the same list the prompt shows. When an item or entity registry lands, its card
  adds those ids to the `Targets` list.
- **OQ-4 (needs a ruling)**: `nextMove` (`playtest/driver.ts` L129–130) returns
  `{ text, actionId }` only, so it drops `Move.intent`. The spec 111 moves `/search #ferry-house` and
  `/move #causeway` therefore run as declare and commit (interpret parses the slash line with no
  model call), not as direct Intents. The `deeds-narrated` check still passes on them. Fixing the
  pass-through changes the call order of `greyhollow-ford-deeds.json` (no Director call on an
  `intent` turn). Default: this card passes only `confirm` through and leaves spec 111's path alone.
  Recommend the orchestrator card the `intent` pass-through as its own fix.
