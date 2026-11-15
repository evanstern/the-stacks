# Feature Specification: dm.react confirm params parse

**Feature Branch**: `task-0347-react-params`
**Card**: TASK-0347 (milestone m-10). Wave 2b, parallel to the TASK-0350 → TASK-0348 pair.
**Created**: 2026-11-15
**Status**: Draft
**Authored against**: `origin/main` `12807fdc` (contains TASK-0336, spec 114, and TASK-0335, spec 112).
Evidence: `docs/playtests/2026-11-14-combat-smoke-hosted.md` finding 3 (session `8c7d506e-43a0-48e6-a60c-8b1f3d3493b8`).
Runbook: `docs/design/r1-fast-table-runbook.md` "Amendment 2026-11-15" (branch `r1-replan-2026-11-15`). Operator ruling (2026-11-13): "Approved, but automate the tests".
Builds on: `specs/114-react-confirm-targets` (the `normalizeReact` repair through the `callJson` `normalize` seam). This spec does not redo it.
**Clarify**: skipped. The cause is in code, the card ACs and the brief settle the behaviour, and the judgment calls are recorded below.
**Spec Kit**: authored directly in the template shape, as spec 114 was. `.specify/feature.json` is untouched.

## Summary

The hosted combat run made 49 model calls. Two `dm.react-v6` calls failed the schema on attempt 1:

| Ledger id | Job | Attempt 1 | Attempt 2 |
|---|---|---|---|
| 2184 (02:10:38 UTC) | `f57b2170-5b17-4d00-b0a0-50990dfaa478` | `schema-mismatch` | 2185 `ok` |
| 2188 (02:11:33 UTC) | `a87190c5-5316-48a0-82a8-ebb243dbd78c` | `schema-mismatch` | 2189 `ok` |

Each failing reply held a `confirm` item with a `move` body whose `params` carried keys the Intent
schema does not know: `skill` in the first; `ready` and `caution` in the second. `ConfirmItem.body` is
`IntentBodySchema` (`nodes/schemas.ts`). Each member's `params` is a strict object (`bodyParams`), and
`move` params are `{}`. Attempt 2 passed both times, so play went on. The cost is a re-ask, about 3 s
of latency and one extra call each. Attempt-1 failures rose to 4.1% (2/49) against the R1 target of
under 1% (runbook exit 5).

Two faults follow:

1. **The prompt never shows the params shape.** `prompts/react.ts` OUTPUT_SHAPE writes `"params":{}`
   and one worked `search` example with `params: { skill: "perception" }`. Nothing lists the keys each
   kind takes. The example teaches the model that `skill` is a normal key, and it copied it onto a move.
2. **Nothing removes an obviously invented key.** A key the kind's schema does not know can only fail.
   Code could drop it and keep the rest of the item.

### Replay fixtures (reconstructed)

The raw attempt-1 and attempt-2 bodies were **not captured**. `dm_model_calls` holds no prompt or
completion text by design (`schema/dm-model-calls.ts`). The `dm.call.schema-mismatch` log lines held
200-character heads and tails, but the hosted app restarted at 2026-11-15 04:51 UTC and the lines are
gone. A read of the two `jobs` rows was not permitted in this dispatch (OQ-1). The fixtures below are
**reconstructed** from finding 3. The invented keys are exact; the values, the target zone and the
wording are invented for the test. The target is `causeway`, a revealed zone in both
`greyhollow-ford` seeds, so spec 114's `knownTargets` lists it.

- **F1, attempt 1 (call 2184), reconstructed:**
  ```json
  {"outcome":"confirm","triggers":[],"speaker":null,"text":"","encounterId":null,"companionPrompts":[],"confirm":[{"characterId":"tamsin","text":"Tamsin wades out onto the causeway.","body":{"kind":"move","targets":[{"kind":"zone","id":"causeway"}],"params":{"skill":"athletics"}}}],"answer":null,"reason":"Tamsin declared a move; offer it for confirmation."}
  ```
- **F1, attempt 2 (call 2185), reconstructed:** the same object with `"params":{}`.
- **F2, attempt 1 (call 2188), reconstructed:**
  ```json
  {"outcome":"confirm","triggers":[],"speaker":null,"text":"","encounterId":null,"companionPrompts":[],"confirm":[{"characterId":"tamsin","text":"Tamsin edges along the causeway, ready for trouble.","body":{"kind":"move","targets":[{"kind":"zone","id":"causeway"}],"params":{"ready":true,"caution":"high"}}}],"answer":null,"reason":"Tamsin declared a careful move; offer it for confirmation."}
  ```
- **F2, attempt 2 (call 2189), reconstructed:** the same object with `"params":{}`.

The fixture file names them `RECONSTRUCTED_F1` and `RECONSTRUCTED_F2`, and a comment cites this
section. When OQ-1 recovers the real bodies, the fixtures are replaced verbatim and the tests stay.

## Where each fix belongs (decision record)

| Fault | Option | Verdict | Reason |
|---|---|---|---|
| 1 | A. One line: "most kinds take `{}`" | Rejected alone | It does not tell the model which keys `search`, `attack`, `check` and the rest take, so a correct key would be guessed too. |
| 1 | B. One line per kind, reusing `INTENT_GRAMMAR`'s kind lines from `prompts/interpret.ts` | **Chosen** | The kind lines already state targets and params for every `INTERPRET_KINDS` member, which is exactly the `IntentBodySchema` member set. Reuse keeps one source, as `prompts/companion.ts` does. Add one rule line and one worked `move` example. Bump to `dm.react-v7`. |
| 1 | C. Render the params shape from the Zod schema | Rejected | It needs a renderer for refinements and enums. The grammar lines already exist and are tested. |
| 2 | A. Loosen `bodyParams` or `IntentBodySchema` to strip or pass unknown keys | Rejected | `packages/intent` is the contract (Principle II), and `IntentBodySchema` is shared by interpret and companion. A loose schema hides the fault from every caller. |
| 2 | B. Strip after a schema pass in `talk-turn.ts` | Rejected | The schema fails first, so the strip never sees the item. Spec 114 made the same call. |
| 2 | C. Strip in the react call's `normalize` pass, before the schema, on each attempt | **Chosen** | The seam exists and spec 114 already uses it. A stripped reply costs no re-ask. |
| 2 | D. Do both 1 and 2 | **Chosen** | Card AC #1 accepts either. The prompt lowers the rate; the strip makes a slip free. The strip record shows whether the prompt fix holds. |
| Record | A. A count on `jobs.result.talk` (as `targetRepairs`) | Rejected | The brief asks for each strip as an issue, and a count names no key. |
| Record | B. A `stripped` issue list on the turn's check record, written for talk jobs | **Chosen** | The `/turns` and `/jobs` debug routes already return `result.check`. Today a talk job writes `check: null`, so the record is new for talk jobs. |
| CI | A. Add an invented key to spec 114's `confirm-search` reply | Rejected | One reply would then prove two repairs, and a failure would not say which. |
| CI | B. A second `confirm` move with a move body and invented keys | **Chosen** | It follows spec 114 Phase 3 and proves the strip alone. |

### Why a strip is safe (no key gains effect)

- The strip only removes keys. It never adds a key, never edits a value and never touches a known key.
- It removes only a key the kind's `IntentBodySchema` member `params` does not list, and only when
  that member's `params` is strict. A strict schema rejects that key outright. Without the strip the
  item could never reach the gate. So no stripped key ever had an effect to lose.
- A known key with a bad value is kept (for example `search` with `skill: "stealth"`). The schema
  fails and the re-ask runs, as today. A strip never turns a bad value into a default.
- A `dc` on `check`, `save` or `contest` is not in `bodyParams` (CR-004 removes it). It is stripped
  like any unknown key. That removes a model-chosen number, which Principle VI forbids anyway.
- An invented key cannot change the kind. `ready` and `predeclare` are kinds, not params keys, and
  neither is in `INTERPRET_KINDS`. A `move` with `params.ready` is stripped to a plain `move`. It never
  becomes a readied action.
- Nested objects are not walked. Only top-level `params` keys are stripped. `help.params.assist` is
  a strict discriminated union and fails as today on a bad inner key.
- Every kept key still passes the full `IntentSchema` in `stampIntent`, which re-runs the refinements
  (`atMostOneDc`, "at least one of skill, ability") and the `MODEL_NUMBER` rule.

Each `IntentBodySchema` kind and its known `params` keys, for the strip and the test table:

| Kinds | Known `params` keys |
|---|---|
| `hide`, `dash`, `dodge`, `disengage`, `stand`, `drop_prone`, `grapple`, `use_object`, `move` | none |
| `attempt` | `scope` |
| `check` | `skill`, `ability`, `mode`, `difficulty` |
| `save` | `ability`, `mode`, `difficulty` |
| `contest` | `skill`, `ability`, `opposed`, `mode` |
| `attack` | `weapon`, `mode` |
| `cast` | `spell`, `slot`, `mode` |
| `help` | `assist` |
| `search` | `skill` |
| `shove` | `effect` |

The code reads the keys from the schema at runtime, never from this table.

## Acceptance criteria map

| Card AC | Requirements | Success criteria | Phase |
|---|---|---|---|
| #1 A confirm item whose params hold unknown keys is repaired or stripped in code before validation, or the prompt schema states the allowed params per kind | FR-001–FR-003 (prompt), FR-004–FR-008 (strip) | SC-001, SC-002, SC-003 | 1 |
| #2 A test covers a move confirm item with an invented params key | FR-009, FR-012–FR-014 | SC-003, SC-004, SC-006 | 1, 2 |
| Brief: each strip is an issue on the check record, shown by the debug routes | FR-010, FR-011 | SC-005 | 2 |
| Brief: a scripted CI scenario deed replays an invented-params confirm, with a negative proof | FR-012–FR-014 | SC-006 | 2 |
| Operator ruling: a test replays both failing hosted outputs | FR-009 | SC-003 | 1 |

## User scenarios

### US1 — A move confirm with an invented key ships (P1, AC #1, #2)

Tamsin posts "I wade out onto the causeway" in free mode. The model replies with F1 or F2. Code
drops `skill`, or `ready` and `caution`. One `action.suggested` row ships with a declared `move`
Intent to `{ kind: "zone", id: "causeway" }` and `params: {}`. The model was called once.

### US2 — A bad value on a known key is not hidden (P1, AC #1)

The model writes a `search` body with `params: { skill: "stealth" }`. Code keeps `skill`. The schema
fails, and the re-ask runs as today.

### US3 — The operator sees what was stripped (P2, brief)

The operator opens the debug routes for the session. The talk job's `check` record lists each
stripped key with its confirm item index and body kind.

### US4 — CI plays an invented-params confirm (P1, AC #2)

The CI scenario posts a prose move as a `confirm` move. The scripted react reply carries `ready` and
`caution` on a `move` body. The seat accepts the item, and the move resolves. Breaking the strip
makes the run fail.

## Requirements

### Prompt (AC #1)

- **FR-001**: The react system prompt MUST hold the `INTENT_GRAMMAR` kind lines: every line that
  starts with `- ` between `Kinds:` and the next non-kind line. Import `INTENT_GRAMMAR` from
  `prompts/interpret.ts`; never copy its text.
- **FR-002**: A rule line MUST follow the kind lines: `params holds only the keys listed for its kind. Most kinds take {}. Never add another key.`
- **FR-003**: The system prompt MUST hold a second worked example, a `move` with `params: {}`:
  `{"characterId":"tamsin","text":"Tamsin wades out onto the causeway.","body":{"kind":"move","targets":[{"kind":"zone","id":"causeway"}],"params":{}}}`.
  Bump `PROMPT_VERSION` to `dm.react-v7`.

### Strip (AC #1)

- **FR-004**: A pure `stripParams(json)` MUST run in the react call's `normalize` pass after
  `normalizeReact`, on each attempt.
- **FR-005**: For each `confirm[]` item whose `body.kind` names an `IntentBodySchema` member and
  whose `body.params` is a plain object, it MUST remove each top-level key the member's `params`
  shape does not list. It acts only when that `params` schema is strict.
- **FR-006**: It MUST leave unchanged: a non-object reply, a reply with no `confirm` array, an item
  with no body, an unknown body kind, a non-object `params`, every known key, and every nested value.
- **FR-007**: It MUST never mutate its input. It copies what changes.
- **FR-008**: It MUST return the strips: one `{ item, bodyKind, key }` per removed key, `item` being
  the zero-based index in `confirm`.
- **FR-009**: Tests MUST replay F1 and F2 attempt 1 through the real read: each ships one
  `action.suggested` row with a `move` Intent to `causeway` and `params: {}`, after one `dm.narrate`
  call. Tests MUST replay F1 and F2 attempt 2 too: each ships the same row with no strip.

### Record (brief)

- **FR-010**: `CheckRecord` MUST gain an optional `stripped` list of
  `{ kind: "params-stripped", item, bodyKind, key }`. A talk turn MUST fill it from the parsing
  attempt's strips. Rows stored before this change lack the field.
- **FR-011**: A finished talk job MUST write its check record to `jobs.result.check` in place of
  `null`. The talk `TurnOutcome` carries it. The `/turns` and `/jobs` debug routes then return it
  with no route change. The playtest auditor reads only `leak` and `contradiction`, so a strip
  raises no audit finding.

### CI scenario (AC #2, brief)

- **FR-012**: The shipped CI scenario `greyhollow-ford.json` MUST play one more `confirm` move:
  `{ "text": "I wade back to the near bank.", "actionId": "confirm-move", "confirm": true }`, after
  `deed-move`.
- **FR-013**: Its scripted react reply in `greyhollow-ford-deeds.json` MUST carry a `move` body to
  `{"kind":"zone","id":"near-bank"}` with `params: {"ready":true,"caution":"high"}` (F2's keys).
- **FR-014**: `playtest.integration.test.ts` MUST assert: no refusals; one `action.suggested` row
  holds a `move` Intent to `near-bank` with `params: {}`; `deeds-narrated` still passes on every
  segment; the talk job's check record lists two strips.

## Success criteria

- **SC-001**: `react-prompt.test.ts` asserts `dm.react-v7`, each `INTERPRET_KINDS` kind line, the
  FR-002 rule line and the FR-003 move example.
- **SC-002**: `react-params.test.ts` (unit) covers: F1 and F2 strip to `{}`; a `search` keeps `skill`
  and drops `caution`; a `search` with `skill: "stealth"` keeps it; a `check` drops `dc`; `help` keeps
  a nested `assist` unchanged; an unknown kind, a non-object `params`, a non-confirm reply and a
  missing body pass through; the input is not mutated; the strips list item, kind and key. One case
  asserts every `IntentBodySchema` member's `params` is strict, so FR-005 holds for all kinds today.
- **SC-003**: A DB integration test replays F1 and F2 attempt 1 and attempt 2 through a `say` post
  (FR-009). The provider saw one `dm.narrate` call each.
- **SC-004**: The same test asserts the shipped Intent's `params` equal `{}` and its target is
  `{ kind: "zone", id: "causeway" }`.
- **SC-005**: The same test asserts `jobs.result.check.stripped` lists `skill` (F1) and `ready`,
  `caution` (F2), and the attempt-2 replays write an empty or absent `stripped` list.
- **SC-006**: The CI scenario run ends `ended`, its audit passes, `scriptRemaining` is zero, and
  FR-014 holds. With `stripParams` stubbed to identity, the run fails.

## Scope

- **In**: the react prompt (grammar lines, rule line, move example, `dm.react-v7`), `stripParams`, its
  wiring, `CheckRecord.stripped`, the talk job's `result.check`, the CI `confirm-move`, contract
  amendments, wiki.
- **Out**: interpret and companion params strips (OQ-2). Debug page rendering of `stripped` (OQ-3).
  Loosening any schema. The talk and narrate path changes of TASK-0350 and TASK-0348.

## Open questions

- **OQ-1**: The real attempt-1 bodies. The hosted `jobs` rows `f57b2170-5b17-4d00-b0a0-50990dfaa478`
  and `a87190c5-5316-48a0-82a8-ebb243dbd78c` hold `result.checkpoint.react`: the parsed attempt-2 value,
  not attempt 1. Attempt-1 text survives nowhere. Default: keep the reconstructed fixtures. Recommend
  no card: the strip record (FR-010) keeps the key names of every future strip.
- **OQ-2**: `IntentBodySchema` is shared. A `dm.interpret` stage or a `dm.companion` turn body can
  carry an invented key too, and fail the same way. Default: not in this card, which names the react
  confirm. Recommend the orchestrator card it, with a trigger: the first ledger `schema-mismatch` on
  `dm.interpret` or `dm.companion` whose issue names an unrecognized key.
- **OQ-3**: The web debug page reads `checkpoint.narration.check`, which a confirm-only read never
  writes. It will not show `stripped`; the routes will. Default: routes only, as the brief says.
  Recommend a card if the operator wants it on the page.
- **OQ-4**: A stripped attempt now counts as `ok` in the ledger, so the attempt-1 failure rate no
  longer sees invented keys. The `stripped` record carries that signal. Default: accept. The R1
  exit-5 reading should count strips beside ledger failures; recommend a note on TASK-0338's retest.
