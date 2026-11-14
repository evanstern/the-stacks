# Feature Specification: Every settled deed is narrated

**Feature Branch**: `task-0337-ruling-narration`
**Card**: TASK-0337 (milestone m-10). Dependent: TASK-0338. Serial with TASK-0336 (runbook amendment 2026-11-13, wave 1).
**Created**: 2026-11-13
**Status**: Draft
**Authored against**: `origin/main` `594dd99a`. Evidence: `docs/playtests/2026-11-13-r1-spine-test-drive.md`
findings 9–11 (branch `playtest-2026-11-13-r1-spine`). Runbook: `docs/design/r1-fast-table-runbook.md`
"Amendment 2026-11-13" (branch `r1-replan-2026-11-13`). Operator ruling: "Approved, but automate the tests".
**Clarify**: skipped. The cause is in code and the card ACs settle the behaviour. The one judgment call
left (talk turns, OQ-1) has a recommended default.

## Summary

A **deed** is an Intent that has no committed action behind it and that the gate settled or
stopped. Examples: a composer `/search #ferry-house` confirmed by 👍, a `/move #causeway`, and any
direct Intent a DM ruling answers. Deeds today reach narration only through an `intent`-trigger
turn. Three faults follow:

1. **The ruling turn ends silent (finding 10).** `answerRulings` settles the search inside the
   `ruling` job. `pipeline/runner.ts` then sees an empty beat and returns `empty-beat`, because only
   `scene-start` and `intent` are exempt. Enqueue rule 9 skips the settling row because `ai:dm`
   appended it inside a job. The same hole exists for a human DM: rules 8 and 9 coalesce into one
   `approval` turn, and `approval` is not exempt either.
2. **The narrate window cannot tell deeds apart (finding 11).** Narrate builds `directBatches` only
   for the `intent` trigger. Each entry carries a name and a batch, never the Intent. A ruling
   carrier has no `actor.id`, so it is named "The scene". A move writes `combatant.moved`, which
   `collectFacts` drops, so the move's entry is empty. The model saw only the search roll and
   narrated only the search.
3. **Nothing detects it.** The auditor's six checks passed the test-drive session.

## Where the fix belongs (decision record)

| Option | Verdict | Reason |
|---|---|---|
| A. Enqueue: a rule 9' for `ai:dm` ruling rows | Rejected | The ruling is already inside a turn job. A second job adds a hop. Worse, the new job coalesces into whatever turn is queued, and every trigger except `intent` drops the deed again. |
| B. Runner: add `ruling` to the exemption list | Rejected alone | It fixes the test-drive path. It leaves the human-DM `approval` path and every coalesced trigger broken. It also makes a ruling turn that answered a beat-stage request (already narrated in the commit job) run an extra empty pass. |
| C. Runner decides by facts, not by trigger; narrate names each deed | **Chosen** | One pure rule answers both questions: does this window hold an un-narrated deed? The runner proceeds when it does. Narrate renders every deed in the window, whatever the trigger. It works for the AI seat, the human seat, and coalesced turns. |

The deed test reuses enqueue rule 9's existing predicate (actor not `ai:`, settled with `batchId`, or
`stopped`). It adds one case: a carrier that answers a request whose asking carrier was not
`ai:`-appended. Enqueue stays unchanged.

## Acceptance criteria map

| Card AC | Requirements | Success criteria | Phase |
|---|---|---|---|
| #1 A ruling turn that settles Intents narrates their facts, with an integration test of declared → suggest → accept → needs_ruling → ruling → narration | FR-001–FR-006 | SC-001 | 1, 2 |
| #2 No AI-seat-settled Intent ends a job as `empty-beat` without narration, with a test | FR-004, FR-005 | SC-002 | 2 |
| Note AC: a window holding several settled Intents narrates each; the latest deed is never dropped | FR-002, FR-003, FR-007 | SC-003 | 1, 2 |
| #3 A deterministic auditor check fails on an unnarrated settled or stopped Intent, runs in CI through the scripted scenario, with a negative proof | FR-008–FR-012 | SC-004, SC-005 | 3, 4 |

## User scenarios

### US1 — A ruled search is narrated in the ruling turn (P1, AC #1)

**Given** the AI seat and Tamsin at the near bank, **When** Tamsin posts `/search #ferry-house`,
the code confirm row lands, she 👍s it, the carrier records `needs_ruling`, and the `ruling` turn
accepts at `easy` and rolls, **Then** that same `ruling` job ships one narration row. The row holds
the deed row `Deed: Tamsin Vale: /search #ferry-house`, the roll line, and `DM ruling: accept`.
The job outcome is `completed`, not `empty-beat`.

### US2 — The next deed is narrated, and only it (P1, note AC)

**Given** US1 has run, **When** Tamsin posts `/move #causeway` and 👍s its confirm row, **Then**
the `intent` turn's narration holds `Deed: Tamsin Vale: /move #causeway`. It holds no search deed
row. Its prompt names the move as a `Direct action` line and does not name the search.

### US3 — Two deeds in one window are both narrated (P1, note AC)

**Given** two confirmed deeds settle before any narrating turn runs (the stranded-search shape),
**When** the next turn narrates, **Then** its prompt has one `Direct action` line per deed in seq
order. Its narration has one deed row per deed in the same order. The later deed is present.

### US4 — A human DM's ruling of a deed is narrated (P2, AC #2)

**Given** a human DM seat and an open request from a deed, **When** the DM accepts, **Then** the
coalesced `approval` turn narrates the deed instead of ending `empty-beat`.

### US5 — The auditor catches a silent deed (P1, AC #3)

**Given** a transcript where a deed's segment closes with a narration that has no row for it, or
the deed sits in the tail, **When** the auditor runs, **Then** check `deeds-narrated` fails with
kind `unnarrated-deed` and cites the carrier seq. The scripted CI scenario plays a ruled search
deed and a move deed, and its audit passes.

### Edge cases

- A `ruling` turn whose requests were beat stages, already answered inside the commit job,
  still ends `empty-beat`. No deed is pending.
- A rejected ruling of a deed is a deed. It has no batch and must still be narrated (`DM ruling: reject`).
- A stopped deed renders its deed row with the stop code.
- A narrate error (spec 103 fallback) still ships the rows, so the deed rows land.
- A failed narrate advances `factsThrough` (spec 104 FR-018). Its deeds are not re-narrated.

## Requirements

- **FR-001**: A new pure module `dm/deeds.ts` MUST define the deed test for one public
  `intent.recorded` row. (a) A row with `answers` set is a deed when the carrier that asked that
  request was not `ai:`-appended. Its Intent is the answered Intent. (b) Any other row is a deed
  when its actor is not `ai:` and it settled with a `batchId` or carries `stopped`. Speech,
  `ask_dm`, declared and `needs_ruling` rows are not deeds.
- **FR-002**: `dm/deeds.ts` MUST own the narrate window `(W0, W1]` (moved out of `nodes/narrate.ts`
  unchanged) and return the window's deeds in seq order. Each deed holds the carrier seq, the
  Intent id, the actor's display name, the Intent's text form (`toText`), the batch id or null,
  and the stop code or null.
- **FR-003**: Narrate MUST pass every window deed to `buildNarrationFacts` for every trigger, not
  only `intent`. Each `direct` fact entry carries the deed text.
- **FR-004**: The runner MUST NOT return `empty-beat` for an empty beat when the window holds a
  deed. It runs the existing intent pass: code Director output, no Director call, then narrate.
  With no deed, the current rule holds (`talk` reads posts; others end `empty-beat`).
- **FR-005**: The rule in FR-004 MUST be decided by the window, not the trigger. The
  `trigger !== "intent"` exemption is replaced by it.
- **FR-006**: The fact sheet MUST render one row of new kind `deed` per direct entry, before that
  entry's roll and change rows: `Deed: <name>: <text>`. A stopped deed appends ` (stopped, <CODE>)`.
- **FR-007**: The narrate prompt MUST render each direct entry as `Direct action: <name>: <text>`.
  It MUST tell the model to describe every `Direct action` line, in order. Bump to `dm.narrate-v25`.
- **FR-008**: The auditor's `splitNarration` and the web's `narrationRows` MUST accept `Deed: `
  lines as code-block lines. The auditor excludes them from compared dice lines. The web keeps
  them in its rules list, as it keeps `why` rows.
- **FR-009**: A new auditor code check `deeds-narrated` MUST fail when a deed carrier (FR-001
  test, run over the transcript) lies in a tail segment, or when its segment's closing narration
  has no `Deed: ` line containing `: <text>`. Kind `unnarrated-deed`, severity `fail`.
- **FR-010**: The check MUST live in one self-contained block in `auditor/checks.ts`: one
  `CHECK_IDS` entry appended last, one function, one call at the end of `runChecks`. TASK-0335
  edits the same file.
- **FR-011**: A scenario move MAY be an Intent: `intent: true` sends `text` as a confirmed direct
  Intent (`parse`, then gate `kind: "intent"`) instead of declare and commit.
- **FR-012**: The shipped CI scenario MUST play `/search #ferry-house` (ruled by the AI seat) and
  `/move #causeway` as Intent moves. Its audit MUST pass with `deeds-narrated` run on both.

## Success criteria

- **SC-001**: The US1 DB integration test passes on the fake gateway: the ruling job is
  `completed` and its narration holds the search deed row, the roll line and the ruling row.
- **SC-002**: Runner unit tests: an empty beat with a pending deed proceeds for `ruling`,
  `approval` and `commit`. An empty beat with no deed returns `empty-beat`. The US4 test passes.
- **SC-003**: The US2 and US3 tests pass. US3 asserts both deed rows and both `Direct action`
  lines, in seq order.
- **SC-004**: Negative proof: a unit test builds the test-drive shape (search and move carriers,
  narration with only the search deed row) and gets exactly one `deeds-narrated` finding citing
  the move carrier. The fixed shape gets none. A tail-segment deed fails too.
- **SC-005**: `playtest.integration.test.ts` runs the CI scenario with the two Intent moves. The
  report passes, and its segment checks list `deeds-narrated`.

## Scope

- **In**: deed test, window move, runner empty-beat rule, deed rows and prompt lines, auditor
  check, scenario Intent moves, contract amendments (below), wiki.
- **Out**: the code confirm row and `dm.react` targets (TASK-0336; its AC #4 adds the
  declared → confirm deed to the CI scenario after this card). Quoted-dialogue leaks (TASK-0335).
  A `position` change fact for `combatant.moved` (the deed row tells the move; no card needed
  unless the narration quality review asks for one). Beat-stage Intents: they are narrated through
  their action, and the `dice-lines` check covers their rows.

## Contracts amended (none frozen)

- `specs/031-dm-runtime/contracts/node-seam.md` "Steps" 1: the empty-beat rule reads the window.
- `specs/098-fact-sheet/contracts/fact-sheet.md` §2 and §3: row kind `deed` (additive, minor).
- `specs/032-playtest-harness/contracts/auditor.md` "Code checks": `deeds-narrated`.
- `specs/032-playtest-harness/contracts/audit-report-schema.md`: kind `unnarrated-deed`.
- `specs/032-playtest-harness/contracts/scenario.md`: `Move.intent`.

## Open questions

- **OQ-1 (talk turns)**: a `talk` turn with an empty beat still reads posts, even with a deed in
  the window. The deed stays in the window and the next narrating turn tells it. It is late, not
  dropped. This needs a race: a talk turn that answers a ruling. Rule 7 converts a queued talk turn
  into a `ruling` turn, so the race is narrow. Default: leave it. The auditor check fails the run
  if it happens. Operator may instead rule that the talk turn narrates deeds first.
