# Feature Specification: A deed posted mid-narration is audited against the narration that tells it

**Feature Branch**: `task-0350-deed-mid-narration`
**Card**: TASK-0350 (milestone m-10). Runbook: `docs/design/r1-fast-table-runbook.md`.
**Created**: 2026-11-15
**Status**: Draft
**Authored against**: `origin/main` `3525683f`. Evidence: `docs/playtests/2026-11-14-combat-smoke-hosted.md`
finding 10 and the "Run summary" AC #2 bullet (session `8c7d506e`). Upstream: spec 111 (deed rule,
`deeds-narrated`, its OQ-1), spec 108 (narration streaming, AC #4), spec 104 (narrate window,
`factsThrough`). Operator ruling binding all fixes: "Approved, but automate the tests".
**Clarify**: skipped. The code and the hosted job records settle the design call (below). No
question is left that needs the operator before planning.

## Summary

In session `8c7d506e` the auditor failed `deeds-narrated` at seq 80, 239 and 242, and `dice-lines`
at 81, 86, 88, 243 and 252. Each flagged deed was posted while the previous NPC-turn narration
was streaming. The next narration told it. No deed went untold.

The runtime already does the right thing. The auditor measures the wrong thing:

1. **The narration's facts window is fixed before the stream starts.** The NPC-turn job's narrate
   reads projections at `throughSeq` 77 (spec 104 FR-018), then streams for about a second. The
   rows part leaves before the model call (spec 108 D3). Tamsin's `/attack` lands at 78–80 during
   that call. Narration 81 cannot tell it.
2. **The runtime queues the follow-up at once.** Enqueue rule 9 queued an `intent` turn at
   02:12:27, triggered by seq 80, while the NPC turn ran. That job read through 82 and shipped
   narration 86 with `Deed: Tamsin Vale: /attack @snag with "Light crossbow"`. This is the
   earliest narration that could tell the deed without holding the player's Intent.
3. **The auditor segments by transcript position.** `segments.ts` gives every row up to a
   narration to that narration. Rows 78–80 fall before 81, so the auditor expects 81 to tell the
   deed and its dice. It then expects 86 to tell the second attack (83–85), which 88 told. One
   race shifts every later segment by one deed.
4. **The job records already hold the true window.** Each turn job's checkpoint stores
   `factsThrough` (the `W1` its narrate read) and `narration.seqs` (the rows it shipped). In the
   hosted run: job `4630b9e7` shipped 81 with `factsThrough` 77; job `5a20ea37` shipped 86 with 82;
   job `4b58a2ca` shipped 88 with 87; job `712fd049` shipped 243 with 233; job `88a34438` shipped
   252 with 251. Segmenting by these windows puts deeds 80 → 86, 85 → 88, and 239, 242 → 252. Each
   segment's narration holds the matching `Deed:` line.

## Design call (decision record)

| Option | Verdict | Reason |
|---|---|---|
| (a) The in-flight narration absorbs the deed | Rejected | Narrate fixes its window and sheet before the model call. The `rows` stream part has already left (spec 108 D3). Absorbing the deed means re-reading projections, re-sending rows and re-prompting mid-call. That changes the narration-stream frame sequence in `docs/wiki/ws-protocol.md`, a frozen contract, and it makes the stream lie about what it is narrating. |
| (b) Hold the deed, or queue a follow-up narration for it | Rejected as a change; already true | Holding the deed until the stream ends blocks the next Intent, which spec 108 AC #4 forbids. Queuing a follow-up is what enqueue rule 9 already does: the hosted run told every deed in the very next narration. No runtime change is needed. |
| (c) The auditor segments by each narration's facts window | **Chosen** | It matches how the code already works, and the window is already recorded on the job (`factsThrough`, `narration.seqs`). It is an auditor and export change only. The check stays strict: a deed inside a narration's window that the narration does not tell still fails. |

A deed is told by the first narration whose facts window covers it. The auditor assigns the deed to
that narration's segment. That is AC #1.

## Acceptance criteria map

| Card AC | Requirements | Success criteria | Phase |
|---|---|---|---|
| #1 A deed posted while a narration is streaming is told by a narration whose segment the auditor assigns it to | FR-001–FR-006 | SC-001, SC-002 | 1 |
| #2 The 8c7d506e pattern (deed during an in-flight NPC narration) has a test that passes deeds-narrated and dice-lines | FR-007, FR-008 | SC-003 | 2 |

## User scenarios

### US1 — The auditor reads the window, not the position (P1, AC #1)

**Given** a transcript where an NPC narration at seq N read facts through `F < N − 1`, and a deed
carrier sits at a seq in `(F, N)`, **When** the auditor runs with the session's job records,
**Then** the deed and its ledger rows belong to the segment of the next narration whose window
covers them. `deeds-narrated` and `dice-lines` pass on every segment.

### US2 — The replay of 8c7d506e passes (P1, AC #2)

**Given** turn mode with a monster turn whose `dm.narrate` call is paused mid-stream, **When** the
floor holder posts a confirmed `/attack` Intent and the gate accepts it, then the stream is
released and the worker drains, **Then** the transcript has the race shape: the deed carrier's seq
is below the NPC narration's seq, the NPC narration has no `Deed:` line, and a later narration
does. The code-only audit of the exported session passes `deeds-narrated` and `dice-lines` on
every segment.

### US3 — A run directory without windows audits as before (P2)

**Given** a run directory whose `jobs.json` lacks the new fields (older runs, the committed CI
evidence and the clean and doctored fixtures), **When** the auditor runs, **Then** every segment is
the same as today, and every existing expectation holds.

### Edge cases

- A narration with no job record, or a job with no `factsThrough` (a `talk` turn, a scene start
  before spec 104), keeps the position rule: its window ends at `N − 1`.
- A window must not reach back past the previous segment's end, nor reach the narration's own seq.
  The cut is clamped to `[previous cut, N − 1]`, so segments stay disjoint and ordered.
- A clamped cut can still misassign a deed in spec 111's OQ-1 race (a `talk` narration that ships
  between an older window and its narration). The check then fails loudly, as it does today.
- A reclaimed job keeps one checkpoint. A failed narrate sets `factsThrough` but ships no narration
  row, so it maps to no narration and is ignored.
- Rows between a cut and its narration (78–80 before 81) join the next segment. A tail holds the
  rows after the last cut. It closes on `talk` or a deed carrier, as today.

## Requirements

- **FR-001**: The playtest export MUST add two fields to each turn `JobItem`: `factsThrough`
  (the checkpoint's `factsThrough`, else null) and `narrationSeqs` (the checkpoint's
  `narration.seqs`, else `[]`). Both are integers from the job record. No prompt text is added.
- **FR-002**: The fields MUST be optional when a run directory is read. A `jobs.json` without them
  stays valid.
- **FR-003**: `segments.ts` MUST export a pure `narrationCuts(jobs)` that maps each shipped
  narration seq to its job's `factsThrough`. It imports nothing from DB code.
- **FR-004**: `segment(transcript, ledger, cuts?)` MUST cut each DM narration's segment at its
  window: segment k holds the non-narration rows with seq in `(cut[k−1], cut[k]]`, plus narration
  k. `cut[k]` is `cuts.get(N)` clamped to `[cut[k−1], N − 1]`, or `N − 1` without an entry. A
  segment's ledger is the ledger rows whose seq is in the segment's rows.
- **FR-005**: With no cuts, `segment` MUST return exactly today's segments.
- **FR-006**: `runAudit` MUST pass `narrationCuts(input.jobs)` to `segment`. The CLI's segment
  count for the provider preflight MUST pass the same cuts.
- **FR-007**: A DB integration test MUST replay the 8c7d506e pattern on the fake gateway with no
  paid model run: a monster turn's `dm.narrate` paused mid-stream, the floor holder's confirmed
  `/attack` Intent accepted by the gate, then release and drain. It asserts the race shape (US2),
  then runs `exportSession` and `runAudit` with no gateway. `deeds-narrated` and `dice-lines` pass
  on every segment.
- **FR-008**: The same test MUST prove it exercises the race: the audit with `factsThrough`
  removed from every job fails `deeds-narrated` and cites the deed carrier.
- **FR-009**: The runtime MUST NOT change. `dm/enqueue.ts`, `dm/deeds.ts`, `dm/nodes/narrate.ts`,
  `dm/pipeline/runner.ts`, the gate and the stream are not edited.

## Success criteria

- **SC-001**: A unit test builds the 8c7d506e shape from plain rows: an NPC batch and narration
  read through 77, a deed carrier and its attack rows at 78–80, narration 81, a second deed at
  83–85, narrations 86 and 88 with their `Deed:` lines and dice lines. Without cuts it fails
  `deeds-narrated` at 80 and `dice-lines` at 81. With cuts `{81: 77, 86: 82, 88: 87}` every
  segment passes both checks.
- **SC-002**: The clean and doctored fixture tests and `audit.test.ts` pass unchanged. A unit test
  shows `segment(t, l)` equals `segment(t, l, new Map())`.
- **SC-003**: The FR-007 integration test passes, including the FR-008 control.
- **SC-004** (orchestrator evidence, not a gate): re-auditing session 8c7d506e after merge reports
  no `deeds-narrated` or `dice-lines` failure.

## Scope

- **In**: the two export fields, cut-aware segmentation, the audit and CLI wiring, the unit and
  integration tests, contract amendments, wiki.
- **Out**: any runtime change (FR-009). Recording a window on `talk` turns (OQ-1). The `/dm` turns
  route item (`routes/dm.ts`) keeps its shape. The narration event payload is not changed.
- **Not touched**: `apps/server/src/dm/prompts/react.ts` and `apps/server/src/dm/nodes/schemas.ts`
  (TASK-0347 is editing them).

## Contracts amended (none frozen)

- `specs/032-playtest-harness/contracts/auditor.md` "Segments": the window cut.
- `specs/032-playtest-harness/contracts/run-directory.md` `jobs.json`: the two optional fields.

No C-GATE item. The chosen option changes no frame shape in `docs/wiki/ws-protocol.md` and no
contract under `specs/029-proposal-gate/contracts/` or `specs/030-play-route/contracts/proposal-seam.md`.

## Open questions

- **OQ-1 (talk-turn windows)**: a `talk` turn's narration records no `factsThrough`, so the
  auditor uses its position. The runtime's next narrate also skips it when choosing `W0`. The two
  rules agree except in spec 111's OQ-1 race. Default: leave it; the check fails loudly if it
  happens. Card it only if a run shows it.
