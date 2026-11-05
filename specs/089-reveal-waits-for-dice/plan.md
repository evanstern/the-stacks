# Implementation Plan: Reveal waits for the dice

**Branch**: `task-0237-reveal-waits-for-dice` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: `specs/089-reveal-waits-for-dice/spec.md`. Card TASK-0237. Runbook
`docs/design/m3-runbook-b2-playtest-fixes.md`, spine #6.

## Summary

Resolve holds a Director arrival that this beat's check names in its stakes, and lands it after the
action groups only when the applied band's texts name the NPC. The Director prompt forbids a goal
note that states a dice result, and narrate withholds the goal note on a beat whose check failed.
Facts carry the unmet success text on a failed band; a pure claim check blocks prose that names an
absent NPC from it, and the audit prompt lists it for the model.

## Technical Context

- **Language**: TypeScript (Node 22), pnpm workspace. Server code under `apps/server/src/dm/`.
- **Dependencies**: none new. Zod and Vitest already installed.
- **Storage**: no schema change, no migration. Arrivals stay `scene-presence` events.
- **Testing**: Vitest. Pure tests need no DB. The worker replay test
  (`reveal-waits.integration.test.ts`) needs `pnpm env:up` and `TEST_DATABASE_URL`, read as the
  runbook says.
- **Model calls**: none paid. Every replay uses the scripted fake gateway and scripted dice.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the DM pipeline is the agent path. No human-only path.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: no new state. Dependent arrivals are per-turn, in memory.
- [x] **IV. Event sourcing**: the held arrival is the same typed `scene-presence` proposal through
      the gate, written later in the same job. A dropped arrival appends nothing.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: the engine owns the band. Resolve reads it from the landed
      `check.resolved` row.
- [x] **VII. Structured first**: `unmetSuccess` is a typed fact; the checks are pure functions.
- [x] **VIII. Operator-owned content**: the seed is read, not edited.
- [x] **IX. Self-hostable**: no new service or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — Why not move the Director after resolve.** The Director decides table mode, holds and the
  encounter start that resolve's opening moves need. Reordering the pipeline breaks
  decision-0025 §4. Holding only the dependent arrivals is the smallest change.
- **R2 — How code knows an arrival hangs on a check (OQ-1 a).** Interpret already writes each band's
  text before the dice (spec 070/080). In run 1, `stakes.success` named Pell. The snapshot carries
  every seed NPC's aliases (`snapshot/build.ts`). A whole-word alias match over the stake texts is
  deterministic and needs no model change.
- **R3 — Which texts a band delivers.** `effectsForBand` already maps band to effect lists. The
  same map over stake texts gives the band texts. `consequenceFor` returns one text per band and
  is not the same thing: a success at a cost delivers both the success and the cost.
- **R4 — Why the audit missed finding 12.** The facts show only the applied band's text, so the
  auditor never saw "She spots Pell alive". Seq 63-72 was caught only by inference. Code can block
  the actor case exactly: the unmet success names Pell, Pell is absent in S1, and the prose names
  Pell outside negation, question and quotes.
- **R5 — Goal-note withhold (OQ-2 a).** The note is written before the dice, so it cannot know the
  band. Narrate runs after resolve and sees every band. Withholding on any failed check is correct
  by construction. `withholdRefusedInputs` (spec 051, spec 085) is the home.
- **R6 — Reuse.** `claims.ts` has `Context`, `maskQuotes`, `clausesOf`, `tokenize`, `NEGATION_RE`
  and the alias regex. The new name lookup and the new check reuse them, as `offTurnActs` did.

## Design

### D1 — Name lookup (`apps/server/src/dm/claims.ts`)

Export `namedActorIds(snapshot: ActorSnapshot, text: string): string[]`. It builds a `Context`
(diff `null`), runs `occurrences` over the text, and returns the ids of unique occurrences in
order, deduplicated. `ponytail:` comment: unique aliases only; a description with no alias ("a
small figure") names no one; upgrade to an interpret field (spec OQ-1 b) when a playtest shows a
descriptive reveal slipping through.

### D2 — Band texts (`apps/server/src/dm/stakes.ts`)

Export `bandTexts(stakes: Stakes | null | undefined, band: string | null): string[]`, per the spec
term: `success` → `[success]`; `success-at-cost` → `[success, cost]`; `failure` → `[failure]`;
`severe-failure` → `[failure, severe ?? failure]` deduplicated; else `[]`. Null entries drop.

### D3 — Dependent arrivals (`apps/server/src/dm/nodes/resolve.ts`)

1. Export a pure `splitArrivals(arrivals, steps, snapshot)` returning
   `{ unconditional: string[]; dependent: string[] }`. `steps` is every `check` step in this
   beat's readings and rulings. An arrival is dependent when `namedActorIds` over any check's
   four stake texts contains it.
2. In the resolve node, compute the split once, beside `startingEncounter`, from
   `ctx.results.interpret?.readings`, `ctx.results.adjudicate?.rulings` and `assembled.snapshot`.
   A hold beat has no readings, so every arrival is unconditional.
3. The plan gate's `arriving` input takes `unconditional` in place of `director.arrivals`.
4. `directorOpening` loops over `unconditional` in place of `director.arrivals`. Pass it as a
   parameter. The `arrived` count follows.
5. After the NPC group and before `directorClosing`, call a new `landHeldArrivals(run, seed,
   dependent, snapshot)`. For each dependent id, it scans the run's submissions for a `check`
   submission with `stakes` and a `band`. It lands the arrival when `namedActorIds` over
   `bandTexts(stakes, band)` contains the id. The proposal is spec 078's, same key
   `director:arrival:<npcId>`, same `note(...)` and visibility. Otherwise it logs
   `{ event: "dm.arrival.held", jobId, npcId }` (OQ-5 a).
6. A refused or awaiting check has no band, so its arrival is held. A free retry lands `success`.
7. Known consequence: an action that targets the dependent NPC in the same beat meets the plan gate
   with that NPC absent. The NPC was not yet revealed, so the refusal is correct.

### D4 — Director prompt (`apps/server/src/dm/prompts/director.ts`)

- `goalNote` shape text: append "; it states no result a roll this beat could decide: no thing
  found, person reached or fact learned".
- SYSTEM arrivals sentence: append "When the beat to resolve is a search, a scan or a look that a
  roll decides, a reveal it would make is the roll's, not yours: code lands it only on a band that
  delivers it."
- Bump `PROMPT_VERSION` to one past main's at Phase 1.

### D5 — Goal-note withhold (`apps/server/src/dm/nodes/narrate.ts`)

In `withholdRefusedInputs`, after the count check: when the note survives and any roll in
`facts.actions[].rolls` has band `failure` or `severe-failure`, withhold it and push
`{ kind: "doctrine", detail: "Withheld goalNote: a check this beat failed, and the note was written before the dice." }`.

### D6 — Unmet success fact (`apps/server/src/dm/facts.ts`)

Add `unmetSuccess?: string | null` to `FactRoll`. Set it in both `collectFacts` sites beside
`consequence`: `stakes.success` when the band is `failure` or `severe-failure`, else null. Not
rendered by `rollEntry` (OQ-3 a).

### D7 — Unmet reveal check (`apps/server/src/dm/claims.ts`)

1. Add `"reveal"` to `ClaimKind`.
2. Export `unmetReveals(state, text, rolls: readonly { unmet: string; applied: readonly string[] }[]): ClaimIssue[]`.
   For each roll, the candidates are the actors `namedActorIds(unmet)` names, minus those any
   applied text names, kept only when S1 shows them `absent`. For each candidate, walk
   `clausesOf(maskQuotes(text))`. Report when a unique occurrence of the candidate falls in a
   clause that has no `NEGATION_RE` match before it, that has no "no sign of", "nothing of" or
   "no trace of" before it, and whose text up to the next sentence end has no `?`.
3. Detail: `<Name> is absent and the prose shows them, a success outcome the <band> did not deliver ("<matched>").`
4. `ponytail:` comment naming the ceiling: actors only, alias match only; a clue reveal is left to
   the model audit (D8).

### D8 — Audit (`apps/server/src/dm/nodes/audit.ts`, `apps/server/src/dm/prompts/audit.ts`)

- `deterministicChecks`: after the off-turn block, collect every roll in `facts.actions`,
  `facts.npcTurn` and `facts.pulled` with `unmetSuccess`. Its applied texts are `[consequence]`.
  Call `unmetReveals` and add each as `ledger-mismatch` `Reveal: <detail>`.
- `buildAuditPrompt`: when any roll has `unmetSuccess`, add a section
  `Success outcomes that did not happen` with `<roller>: <unmetSuccess>` lines.
- Rule 7: append "A success outcome listed as one that did not happen must not appear: showing it
  is `ledger-mismatch`."
- Bump `PROMPT_VERSION` to one past main's at Phase 1.

## Replays

| Seq | Fixture | Assertion |
|---|---|---|
| 43-51 | `test/dm/scripts/reveal-pell.json` (new): duo seed, scene start then Kestrel's scan; Director `arrivals: ["pell"]`, goal note as run 1; interpret one Perception check, stakes as run 1 (`success` "She spots Pell alive at the post", `failure` "The reeds and dusk give up nothing clear", plus cost and severe). d20 face 3 (severe) or 15 (success). | Severe: no Pell `scene-presence` row; S1 Pell absent; one `dm.arrival.held` log. Success: one public `arrived` row after `check.resolved`. Prose "…the lookout turns. Yet the reeds give one mercy first: Pell, alive at the post." blocks deterministically. |
| 63-72 | pure facts: Kestrel's Perception `severe-failure` with `stakes.success` naming the leader clue; goal note "Give them who holds command here". | Narrate inputs carry `goalNote: ""` and the doctrine advisory. Audit prompt carries the unmet success section and the new rule 7 sentence. |

## Contracts

- `specs/031-dm-runtime/contracts/director.md`: amendment, dependent arrivals and the `goalNote`
  rule.
- `specs/031-dm-runtime/contracts/resolve.md`: amendment, held arrivals land after the NPC group.
- `specs/031-dm-runtime/contracts/audit.md`: amendment, the `reveal` claim and the unmet section.

## Files

| File | Change | Phase |
|---|---|---|
| `apps/server/src/dm/claims.ts` | `namedActorIds`; later `unmetReveals`, `"reveal"` kind | 2, 4 |
| `apps/server/src/dm/stakes.ts` | `bandTexts` | 2 |
| `apps/server/src/dm/nodes/resolve.ts` | `splitArrivals`, opening loop, plan-gate `arriving`, `landHeldArrivals` | 2 |
| `apps/server/src/dm/prompts/director.ts` | goal note and arrivals rule, version bump | 3 |
| `apps/server/src/dm/nodes/narrate.ts` | goal-note withhold on a failed check | 3 |
| `apps/server/src/dm/facts.ts` | `FactRoll.unmetSuccess` | 4 |
| `apps/server/src/dm/nodes/audit.ts` | `unmetReveals` in `deterministicChecks` | 4 |
| `apps/server/src/dm/prompts/audit.ts` | unmet section, rule 7, version bump | 4 |
| `apps/server/test/dm/stakes.test.ts` | `bandTexts` cases | 2 |
| `apps/server/test/dm/claims.test.ts` | `namedActorIds`, `unmetReveals` cases | 2, 4 |
| `apps/server/test/dm/reveal-waits.test.ts` (new) | `splitArrivals`; seq 63-72 and seq 43-51 pure replays | 2, 3, 4 |
| `apps/server/test/dm/scripts/reveal-pell.json` (new) | scripted calls and dice for seq 43-51 | 2 |
| `apps/server/test/dm/reveal-waits.integration.test.ts` (new) | worker replay seq 43-51, both bands | 2 |
| `apps/server/test/dm/assemble.test.ts` | director version pin | 3 |
| `apps/server/test/dm/director.test.ts` | prompt text assertions, if it pins them | 3 |
| `apps/server/test/dm/narrate.test.ts` | audit version pin, rule 7 string | 4 |
| `apps/server/test/dm/facts.test.ts` | `unmetSuccess` per band | 4 |
| `apps/server/test/dm/audit.test.ts` | the `reveal` block skips `dm.audit` | 4 |
| `specs/031-dm-runtime/contracts/{director,resolve,audit}.md` | amendments | 2, 3, 4 |
| `docs/wiki/*` | re-pin | 5 |

No migration. No new runtime dependency. No change to `fallback.ts`, `prompts/interpret.ts`,
`prompts/narrate.ts`, `gates/plan-gate.ts` or the engine.

## Overlap

Runbook B2 runs 0237 last of the fixes. Every file above except `stakes.ts` and the new tests is
edited by an earlier spine task: `nodes/resolve.ts` (0244, 0238), `prompts/director.ts` (0203),
`prompts/audit.ts` and `nodes/audit.ts` (0240, 0203), `claims.ts` (0246), `facts.ts` (0242, 0244,
0238), `nodes/narrate.ts` (0214 merged). Phase 1 re-reads those merged diffs.

## Seam check log

Phase 1 appends one row per moved seam here: the merged task, the seam, and the amendment made.

| Merged task | Seam | Amendment |
|---|---|---|
| TASK-0238 (OQ-4) | Encounter monsters ride `director.arrivals`. Resolve's arrivals loop adds an unseen monster by `combatant.add` (key `director:arrival:<id>`); `arrivingMonsters` reads `director.arrivals` for the plan gate's `joining`. | OQ-4 (a): the same dependent rule covers every arrival id. D3 amended: the loop body becomes `arriveOne` (NPC or monster), shared by the opening and `landHeldArrivals`. `splitArrivals` takes the seed; a monster is named by its seed `name` (a monster has no snapshot actor while unseen). The plan gate's `arrivingMonsters` call and `arriving` input both take `unconditional`. |
| TASK-0244 | `directorOpening` gained no parameter; the plan-gate `arriving` input is unchanged in shape. | None. D3 adds the `unconditional` parameter as planned. |
| TASK-0203 / TASK-0240 | `dm.director` is `dm.director-v9`; `dm.audit` is `dm.audit-v15`. Audit rule 7 is still rule 7. `deterministicChecks` exists in `nodes/audit.ts` and calls `offTurnActs`. | Next versions: `dm.director-v10`, `dm.audit-v16`. D4 and D8 unchanged. `dm.interpret` is v15 and `dm.narrate` is v21 (untouched). |
| TASK-0246 | `offTurnActs` landed in `claims.ts` as D7 assumed. | None. |
| TASK-0242 / 0244 / 0238 | `FactRoll` carries `consequence` and `revealed`; `collectFacts` has two roll sites. | None. D6 adds `unmetSuccess` beside `consequence`. |
| TASK-0214 | `withholdRefusedInputs` already withholds the goal note on a count claim. | None. D5 adds a second withhold. |
