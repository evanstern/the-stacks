# Implementation Plan: Output claim gate — actor-aware checks over shipped narration

**Branch**: `task-0143-output-claim-gate` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/051-output-claim-gate/spec.md`, with the operator rulings of 2026-10-27 (OQ-1 to
OQ-6, all (a); card commit b7be35d). Governing record: decision-0025 (D17) §3.4.

## Summary

Add one pure claim checker, `checkClaims(state, text)`, in a new module
`apps/server/src/dm/claims.ts`. It reads snapshot S1 and the S0-to-S1 diff and refuses three kinds
of claim:

- a dead, downed or absent actor shown acting or speaking;
- a death or drop named on the wrong actor;
- a count or quantifier that disagrees with the snapshot.

The audit node runs it on every narration attempt inside `deterministicChecks`, so a refusal
uses the existing blocking path: `dm.audit` is skipped, the narration regenerates, and the code
fallback ships after three attempts. The narrate node runs it once on the ruling texts and the
`goalNote` and withholds a refused text (OQ-2). It replaces the four actor-anonymous death and
drop checks (OQ-6). The fallback stops voicing a refused roll reason. The narrate prompt goes to
`dm.narrate-v5` (OQ-3). Roll reasons on dice lines stay out of scope (TASK-0161).

## Technical Context

**Language/Version**: TypeScript (Node 22, ESM), the existing `apps/server` package.

**Primary Dependencies**: none new. Zod is not needed: the checker takes typed in-process data.

**Storage**: none. No migration, no event, no column.

**Testing**: Vitest. Unit tests are pure. Evidence tests fold the recorded JSONL logs with
`applyEvent` and `emptyProjections` from `@the-stacks/session-model`. That pattern already exists
in `apps/server/test/dm/seed-npc-presence.test.ts`. The fake-gateway turn test is a DB integration
suite (`test/dm/world.ts`).

**Target Platform**: the one Node server process.

**Project Type**: web service; change is internal to the DM runtime (`apps/server/src/dm/`).

**Performance Goals**: the checker runs in well under 1 ms per narration (at most 1,200 prose
characters, at most 38 actors). No model call, no I/O.

**Constraints**: deterministic and pure. It must stay inside narrate's import closure:
snapshot types only, no engine value (`test/dm/boundary.test.ts`, `pnpm check:boundaries`).

**Scale/Scope**: about 6 source files changed, 1 new source file, 1 new contract, 2 contract
amendments, 1 new fake-gateway script, about 7 test files changed or added.

## Constitution Check

*Checked against `.specify/memory/constitution.md` 2.0.0. Re-checked after Phase 1: unchanged.*

- [x] **I. Agent-operable** — `checkClaims` is a plain exported function with typed input and
      output. An agent, the playtest auditor or TASK-0144 calls it over any snapshot and text.
      No human-only path.
- [x] **II. Content contract** — no new codex entity.
- [x] **III. Data planes** — no new state. The checker reads the session plane only through the
      snapshot that `resolve` already builds.
- [x] **IV. Event sourcing** — no event is added or changed. A withheld ruling stays logged as
      the `dm`-visibility journal row `resolve` wrote; only the narrate prompt input changes.
      Shipped narration still goes through `submitNarration` and the gate.
- [x] **V. Citations** — no library-derived claim. Adjudicate's citation check is unchanged.
- [x] **VI. 5e engine boundary** — no engine change. The checker computes no game number. It
      compares counts of actors by state, which is reading state, not mechanics.
- [x] **VII. Structured first** — claim issues are typed records (`ClaimIssue`) before they
      become audit issue details.
- [x] **VIII. Operator-owned content** — lexicons and fixtures are original text or quotes from
      this project's own recorded runs.
- [x] **IX. Self-hostable** — no new container, dependency or seam.

**Stack conformance**: within the Architecture Constraints table. No departure.

## Design

### D1. The checker — new `apps/server/src/dm/claims.ts` (FR-001 to FR-007, FR-004a)

- Export `checkClaims(state: ClaimState, text: string): ClaimResult` and the types in
  `data-model.md`. Binding behaviour: `contracts/claim-gate.md`.
- **References.** Build terms from each actor's `aliases` (already deduped by `nameTerms`). Match
  with the party-name-filter pattern (`specs/034-narration-quality/contracts/audit-criteria.md`):
  whole word, `iu`, possessive-aware. A term held by exactly one actor is a **unique term**. A
  term held by two or more actors is a **group term**.
- **Group nouns.** For each actor, take each word of its name and aliases, lowercased. Drop
  articles, prepositions and `TITLE_WORDS`. Add a plural with a trailing `s`. A noun held by any
  actor maps to the set of actors that hold it.
- **Clauses.** Split the text at `.`, `!`, `?`, `;`, `:`, an em dash, and a newline. Quoted
  speech is its own clause, attributed to the nearest unique term within six words after the
  closing quote ("…," it shrieks → no unique term → unattributed) or before the opening quote.
- **Acts (FR-004).** In a clause, a unique term followed within four words by an `ACT_VERBS`
  or `SPEECH_VERBS` form, with no `NEGATIONS` entry between them, is an act claim. A quote
  attributed to a unique term is a speech claim. Refuse when the actor's `lifeState` is `dead`,
  `unconscious` or `stable`, or its `presence` is `absent`.
- **FR-004a exemptions.** Skip an actor with a `life-state` or `presence` change in the diff.
  Skip a match of `TURN_ORDER_PHRASE` (`<term> (acts|moves) next`).
- **Deaths and drops (FR-005).** A unique term within four words of a `DEATH_ATTRIBUTION` or
  `DOWN_ATTRIBUTION` match, in either order, in the same clause, is attributed. Refuse a death on
  an actor that is not `dead`. Refuse a drop on an actor that is not `unconscious`, `stable` or
  `dead`. `DOWN_ATTRIBUTION` holds only unambiguous forms ("unconscious", "knocked out",
  "passes out", "blacks out", "collapses", "crumples", "goes down"), never "drops" or "falls",
  which also mean "drops the clapper" or "falls back".
- **Unattributed deaths and drops (FR-013).** A death or drop word with no unique term in range
  passes when S1 holds at least one actor in that state. Otherwise it is refused.
- **Omission (FR-006).** For each diff `life-state` change to `dead` this turn, some clause must
  hold a reference to that actor (unique or group term, or a group noun of it) and a
  `DEATH_RECORDED` match. For a change to `unconscious` or `stable`, the same with
  `UNCONSCIOUS_RECORDED`. These are today's recorded-word lists, so today's omission behaviour is
  the floor.
- **Counts (FR-007).** Match `COUNT_PATTERNS` (data-model.md). Compute the expected value from S1:
  - "N down" with a noun: actors of that noun's set that are `dead`, `unconscious` or `stable`.
  - "N down" without a noun: two sides, non-party and party. Pass if either side's count equals N.
  - "no or none X left": X actors not `dead` and not `absent` must be zero.
  - "last, only or lone X": the same count must be one.
  - "both": N = 2; "all X down": every X actor is down or dead.

### D2. Lexicons — `apps/server/src/dm/audit-words.ts` (FR-014)

Add `ACT_VERBS`, `SPEECH_VERBS`, `INVOLUNTARY_VERBS`, `NEGATIONS`, `DEATH_ATTRIBUTION`,
`DOWN_ATTRIBUTION`, `NUMBER_WORDS`, `TURN_ORDER_PHRASE` and `COUNT_PATTERNS`. Keep the existing
exports (`DEATH_WORDS`, `UNCONSCIOUS_WORDS`, `DEATH_RECORDED`, `UNCONSCIOUS_RECORDED`,
`DICE_LANGUAGE`, outcome lists, `namePairsWith`). `fallback.ts` and
`playtest/auditor/checks.ts` keep importing them. `INVOLUNTARY_VERBS` and `ACT_VERBS` are
disjoint; a test pins that.

### D3. Audit wiring — `apps/server/src/dm/nodes/audit.ts` (FR-008, FR-010, FR-012, FR-016)

- `deterministicChecks(facts, narration, state: ClaimState)`: the third argument is required.
- Delete the four anonymous checks: "says a character dies", "says a character is unconscious",
  "a recorded death omitted" and "a recorded drop omitted". Delete `lifeStateFacts`, which only
  they use.
- Append `checkClaims(state, prose).issues` as `ledger-mismatch` issues with the detail
  `Actor state: <detail>`. Every claim issue blocks.
- The node passes `{ snapshot: resolved.snapshot, diff: resolved.diff }`.
- Attempt 1 also records the withheld-input issues from narrate (D4) with `blocking: false`.
  `det.pass` counts blocking issues only. The fallback journal line prefixes them `[advisory]`.
  They never reach regeneration.
- `AuditRecord`, `AuditAttempt`, `RecordedIssue`, `AuditModelOutput` and `MAX_NARRATION_ATTEMPTS`
  do not change.

### D4. Ruling and `goalNote` — `apps/server/src/dm/nodes/narrate.ts` (FR-009, OQ-2)

- After `buildNarrationFacts`, run `checkClaims` once on each `facts.rulings[i].ruling` and on
  `facts.director.goalNote`, against S1 and the diff.
- A refused ruling is removed from `facts.rulings`. A refused `goalNote` becomes `""`.
- Each refusal becomes a `withheld` entry: `{ kind: "ledger-mismatch", detail: "Actor state:
  withheld <ruling for a1 | goalNote>: <detail>" }`.
- `NarrateOutput` gains `withheld: AuditIssue[]`, always present and empty when nothing is
  withheld. The filtered facts feed narrate, regeneration, the audit prompt and the fallback.
- The `dm`-visibility ruling journal row that `resolve` already wrote is untouched.

### D5. Fallback — `apps/server/src/dm/fallback.ts` (FR-011)

- `factualSummary(facts, state?: ClaimState)`. When `state` is given, `reasonUsable` also
  requires `checkClaims(state, reason).pass`. Without `state`, behaviour is unchanged.
  Existing callers stay valid: `test/playtest/checks.test.ts`, `test/dm/facts.test.ts` and
  `test/dm/narration-quality-repro.test.ts`.
- The audit node's `fallback()` passes the state.
- A property test asserts the fallback passes the checker. It extends the 400-iteration loop in
  `test/dm/fallback.test.ts` with a snapshot and diff derived from each random fact set.

### D6. Narrate prompt — `apps/server/src/dm/prompts/narrate.ts` (FR-020, OQ-3)

- `PROMPT_VERSION = "dm.narrate-v5"`.
- Replace the `RULES` line "Name a character as dead or unconscious only when a fact says so;
  when a fact says so, say so." with "Name a character as dead or unconscious only when a fact or
  the state sections say so; when a fact says so, say so."
- Add after it: "A dead, unconscious, stable or absent character does not act or speak. Count
  only what the state sections show."
- No other builder change. `characterSections` already renders S1.

**Every consumer of the narrate prompt version.** There is no central prompt registry: each
prompt module exports its own `PROMPT_VERSION`, and `callText` records it per call.

| Consumer | Change |
|---|---|
| `apps/server/src/dm/prompts/narrate.ts:23` (`PROMPT_VERSION`) | `dm.narrate-v4` → `dm.narrate-v5` |
| `apps/server/test/dm/narrate.test.ts:310` (`expect(NARRATE_VERSION).toBe("dm.narrate-v4")`) | expect `dm.narrate-v5`; add assertions for the two rule lines |
| `apps/server/src/dm/nodes/narrate.ts` (`callText` `promptVersion`) | none; it reads the constant |
| `apps/server/src/playtest/export.ts` (copies `promptVersion` from job calls) | none |
| Fake-gateway scripts `apps/server/test/dm/scripts/*.json` | none; they match by `purpose`, not by version (checked: no script holds `promptVersion`) |
| Recorded fixtures `apps/server/test/playtest/fixtures/doctored/jobs.json` (`dm.narrate-v1`) | none; recorded data stays as recorded |
| Recorded evidence `docs/design/m2-demo/**`, `specs/034-narration-quality/evidence/**` | none; recorded |
| `docs/wiki/dm-narration-quality.md:81` ("Prompt versions") | updated and re-pinned in the wiki phase (`docs/wiki/dm-runtime.md` names no narrate version; it is re-pinned because it lists the narrate and audit sources) |
| `specs/031-dm-runtime/contracts/node-seam.md:70` (example `"dm.narrate-v1"`) | none; an example |

### D7. Contracts (FR-017)

- New: `specs/051-output-claim-gate/contracts/claim-gate.md` (binding).
- Amend `specs/034-narration-quality/contracts/audit-criteria.md`: add a "Deterministic checks
  (amendment, spec 051)" section that lists the retired checks, the claim checks and the
  withheld-input record.
- Amend `specs/040-actor-snapshot/contracts/actor-snapshot.md`: under consumers, add that
  `checkClaims` reads `aliases`, `lifeState`, `presence`, `kind` and the diff.
- No frozen contract is touched.

### D8. Tests that assert on the four replaced checks (FR-012)

| File | What asserts on them today | Change |
|---|---|---|
| `apps/server/test/dm/audit.test.ts:96-113` | "fails on an unrecorded death and on an omitted one" (`/omits it/`) | rewrite against a snapshot: an attributed death on a living actor fails; the omission of a diff death fails; an earlier death passes |
| `apps/server/test/dm/audit.test.ts:115-128` | "fails on an unrecorded or omitted unconscious state" | rewrite the same way for drops |
| `apps/server/test/dm/audit.test.ts:170-174` | the exact detail `'The prose says a character dies ("dies"), and no fact records a death.'` | replace with the `Actor state:` detail of FR-013 |
| `apps/server/test/dm/audit.test.ts` `check()` helper (line 74) | two-argument call | pass a `ClaimState` |
| `apps/server/test/dm/fallback.test.ts:486` | 400-iteration loop: fallback passes `deterministicChecks` | pass a derived `ClaimState`; also assert `checkClaims` passes |
| `apps/server/test/dm/narration-quality-repro.test.ts:366` | two-argument call (A3, option menu) | pass an empty-diff `ClaimState` |
| `apps/server/test/dm/fixtures/run5-narration-quality.json:1199` | holds the old detail text inside a recorded journal body | none; recorded data, read as input by `fallback.test.ts` and `player-facing-prompts.test.ts`, never matched against the check |
| `apps/server/test/playtest/checks.test.ts` | imports `DEATH_WORDS` and `UNCONSCIOUS_WORDS` through `playtest/auditor/checks.ts` | none; the lexicons stay exported |

### D9. Evidence fixtures — new `apps/server/test/dm/claim-fixtures.ts` (FR-018)

- Move `loadLog` and `foldThrough` out of `test/dm/seed-npc-presence.test.ts` into this helper,
  with a path argument. That test imports them back.
- Export `m2At(seq)`, `run192319At(seq)` and `claimState(s0Seq, s1Seq, log)`. They build
  projections, then `buildSnapshot(projections, greyhollowSeed)` and `diffSnapshots`.
- Export `withPresence(state, rows)` for the F52 "absent" variant. It applies synthetic
  `scene-presence.changed` rows to the projections before the build.
- Export the shipped prose for M2 seq 220, 225 and 307, read from the log at test time, not
  copied. Export the rebuilt row 162 sentences as named constants with a comment citing
  `jobs.json` job `ab5ba4ae…` attempts 2 and 3.

### D10. Fake-gateway turn — new script `apps/server/test/dm/scripts/audit-claim-fallback.json`

- Three `dm.narrate` responses that each break the claim checker. Use a downed party member
  shown acting, in the `audit-fallback.json` shape.
- A new case in `apps/server/test/dm/audit.integration.test.ts` asserts the outcome:
  - three attempts, each with a blocking `ledger-mismatch` issue whose detail starts with
    "Actor state:";
  - `llm: { skipped: true }` on every attempt;
  - `final: "fallback"` and the fallback journal flag;
  - the shipped fallback passes `checkClaims`.
- A second case scripts a refused `goalNote`. It asserts that the narrate prompt carries
  "Private note: " with an empty note, and that the attempt-1 record holds the withheld issue
  with `blocking: false`.

## Files touched

| File | Kind |
|---|---|
| `apps/server/src/dm/claims.ts` | new |
| `apps/server/src/dm/audit-words.ts` | edit (lexicons) |
| `apps/server/src/dm/nodes/audit.ts` | edit |
| `apps/server/src/dm/nodes/narrate.ts` | edit |
| `apps/server/src/dm/fallback.ts` | edit |
| `apps/server/src/dm/prompts/narrate.ts` | edit (v5) |
| `apps/server/test/dm/claims.test.ts` | new |
| `apps/server/test/dm/claim-evidence.test.ts` | new |
| `apps/server/test/dm/claim-fixtures.ts` | new |
| `apps/server/test/dm/seed-npc-presence.test.ts` | edit (import the moved helpers) |
| `apps/server/test/dm/audit.test.ts` | edit |
| `apps/server/test/dm/fallback.test.ts` | edit |
| `apps/server/test/dm/narration-quality-repro.test.ts` | edit |
| `apps/server/test/dm/narrate.test.ts` | edit |
| `apps/server/test/dm/audit.integration.test.ts` | edit |
| `apps/server/test/dm/scripts/audit-claim-fallback.json` | new |
| `specs/051-output-claim-gate/contracts/claim-gate.md` | new |
| `specs/034-narration-quality/contracts/audit-criteria.md` | amend |
| `specs/040-actor-snapshot/contracts/actor-snapshot.md` | amend |
| `docs/wiki/dm-narration-quality.md`, `docs/wiki/dm-runtime.md`, `docs/wiki/actor-snapshot.md`, `docs/wiki/seed-npc-presence.md` (lists `nodes/narrate.ts`), `docs/wiki/INDEX.md`, `docs/wiki/CAPSULES.md` | re-ground |

**Migrations**: none. **New runtime dependencies**: none. **New event types, versions, proposal
kinds, refusal codes, ws frames**: none.

## Concurrency

- TASK-0146 (U7) edits `apps/server/src/dm/prompts/audit.ts`. This card does not touch it.
  Both touch `docs/wiki/dm-narration-quality.md`; the later merge re-pins it.
- TASK-0144 (U4) consumes `checkClaims` after this card merges.
- TASK-0161 adds a plan-gate check on step reasons. It may reuse `checkClaims` against S0.

## Project Structure

### Documentation (this feature)

```text
specs/051-output-claim-gate/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/claim-gate.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
apps/server/src/dm/
├── claims.ts            # new: checkClaims
├── audit-words.ts       # lexicons
├── fallback.ts          # reasonUsable reads the checker
├── nodes/audit.ts       # deterministicChecks wiring
├── nodes/narrate.ts     # ruling and goalNote check
└── prompts/narrate.ts   # dm.narrate-v5
apps/server/test/dm/
├── claims.test.ts, claim-evidence.test.ts, claim-fixtures.ts
└── scripts/audit-claim-fallback.json
```

## Complexity Tracking

None. Every gate passes.
