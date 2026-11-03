# Implementation Plan: An NPC the DM reveals is present in the state

**Branch**: `task-0206-revealed-npc-present` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/078-revealed-npc-present/spec.md`. This plan assumes OQ-1 to OQ-4 (a). A
different ruling changes the design section named under that OQ. Research and design sit inline,
as in specs 068 and 075; there is no separate research.md, data-model.md or quickstart.md.

## Summary

The Director gains an optional `arrivals` field: the offstage seed NPCs the recent transcript or
the beat puts on screen. Code checks it against logged presence and drops anything illegal.
Resolve logs one public `arrived` row per legal arrival as the first Director opening move. The
plan gate counts those ids as arriving and stops treating an arriving id as absent, which also
closes the same-beat encounter-start gap. The encounter-start seed-presence group reads fresh
projections so it never re-proposes an arrival. The chronicle prompt drops offstage actors from
its state and forbids a departure the transcript does not tell. No code starts an encounter.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. No new dependency.
**Storage**: Postgres event log; `jobs.result` checkpoint JSON. No shape change. No migration.
**Testing**: Vitest unit tests; DB integration tests with `REQUIRE_DATABASE=1`; the fake gateway
and DM scripts (spec 053).
**Target Platform**: the server's DM runtime (`apps/server/src/dm/`).
**Project Type**: monorepo web service.
**Performance Goals**: none new. One more short prompt section; no new model call.
**Constraints**: merge spine #6, after TASK-0210 (merged #112) and after TASK-0113 (spine #3,
edits `prompts/director.ts`). TASK-0208 and TASK-0127 edit `nodes/resolve.ts` later.
**Scale/Scope**: 6 source files, 2 contracts, 4 edited tests, 2 new tests, 1 new DM script.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the field is produced and applied inside the DM turn job.
- [x] **II. Content contract**: no codex entity. The seed is unchanged. N/A.
- [x] **III. Data planes**: session plane only.
- [x] **IV. Event sourcing**: arrivals reach the log as keyed `run.submit` `scene-presence`
      proposals through `gate.submit`. The Director node writes nothing.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: the engine is unchanged. An arrival with an active encounter
      and an existing combatant joins initiative through the existing planner rule (spec 048).
- [x] **VII. Structured first**: the reveal is a typed field with code legality. No prose parsing.
- [x] **VIII. Operator-owned content**: no new content.
- [x] **IX. Self-hostable**: no new service, container or dependency.

**Stack conformance**: no departure. **New runtime dependencies**: none (checkpoint C5 not hit).

## Research

- **R1 — Why the Director (OQ-1).** The Director already reads the seed, the recent transcript
  and the beat (`prompts/director.ts`). It is the node that owns structure (decision-0025 §4),
  and its decisions already pass a legality table (`legalizeDirector`). A narration scan would
  parse prose, fire on a mention ("where is Snag?"), and need alias matching on shipped text. The
  cost of (a) is one turn of lag: a reveal produced by this beat's roll lands at the next
  Director call. Run 1's attack came on the next turn (seq 45 after seq 40), so (a) covers it.
- **R2 — What spec 075 delivers.** `checkPlan` passes an attack on a present non-combatant NPC
  and lists it in `pull`; `pullIn` adds the combatant and, with an encounter active, joins
  initiative. Spec 075's replay script writes a `presence` `arrived` effect in turn 1; run 1's
  interpret did not. So 075 covers AC #2 once AC #1 holds, except gap R3.
- **R3 — The same-beat encounter-start gap.** `arrivingNpcs` feeds only `plannedDiff` (the
  claim check). The id check builds `absentIds` from S0 and refuses `absent` for any named id in
  it, except a `presence` `arrived` effect target. So a Director `turn` to `reed-camp` plus an
  attack on Snag in one beat refuses `absent` today, although `directorOpening` marks Snag
  `arrived` before the action groups run. Excluding arriving ids from `absentIds` closes it.
- **R4 — Encounter-start double write.** `seedPresence(..., "encounter-start", ...)` reads `p`,
  the assemble projections. If the arrivals group logged Snag `arrived` first, `p` still reads
  `absent`, the group proposes a second `arrived`, the planner refuses `INVALID_PROPOSAL` ("a
  presence change changes the value"), and `run.submit` stops the turn (a non-engine refusal).
  Reloading projections before the encounter-start group avoids it.
- **R5 — Chronicle "departed".** `buildChroniclePrompt` renders S at `throughSeq` in the
  `fiction` view, where an absent actor reads "gone" (`render.ts` `fictionLine`). The chronicle
  turned "gone" into "have since departed". Omitting absent actors from the chronicle's copy of
  the snapshot leaves the transcript as the only source for presence. The renderer is shared;
  changing "gone" there would touch every prompt, so the filter lives in the chronicle prompt.
- **R6 — Optional field.** `arrivals` is `.optional()` so the 20-odd `DirectorOutput` literals in
  tests and `talk-turn.ts` stay valid. `legalizeDirector` always sets it, so downstream reads
  `director.arrivals ?? []` only where the type is the raw schema.
- **R7 — Seed choice for the replay.** The duo seed has the same Snag and Pell presence map as
  reed-camp and is the seed spec 075's replay and harness already drive. The replay uses it. The
  reed-camp seed adds an AI companion seat whose jobs the test would also have to script.
- **R8 — Narrate.** `narrate.ts` filters the beat's NPCs against S1, so an arrival this turn shows
  in the narration facts when `pacing.beatId` matches a beat. The `presentNpcIds` fallback reads
  S0. Narrate is not touched (OQ-4 (a)); the next turn's S0 has the NPC.

## Design

### D1 — The Director field and its legality (FR-001, FR-002)

`apps/server/src/dm/nodes/schemas.ts`, `DirectorOutput`: add
`arrivals: z.array(RefIdSchema).max(4).optional()` after `companionPrompts`.

`apps/server/src/dm/nodes/director.ts`:

- `DirectorOverrideKind` gains `"arrivals"`.
- New export `offstageNpcIds(projections, seed): string[]`: seed NPC ids in seed order whose
  `projections.scenePresence[id]?.presence` is `absent`.
- `legalizeDirector`: copy `model.arrivals ?? []` to `out.arrivals`. In the scene-start branch,
  set `out.arrivals = []` and push an `arrivals` override when it was non-empty ("scene start
  logs only the seed declaration"). After the companion-prompts block, keep only ids in
  `offstageNpcIds`, first occurrence only; when anything was dropped push `{ decision:
  "arrivals", reason: "an arrival named an NPC that is not offstage" }`.
- `normalizeDirector`: no change (schema failure on more than 4 retries, as for other lists).

### D2 — The Director prompt (FR-003)

`apps/server/src/dm/prompts/director.ts`. Hunks, against `main` after TASK-0113 merges:

1. `PROMPT_VERSION`: bump one past `main` (`dm.director-v5` → `dm.director-v6`).
2. `OUTPUT_SHAPE`: the `companionPrompts` line loses its closing `}` and a new last line follows:
   `' "arrivals":[seed NPC id of an offstage NPC now on screen]}'`.
3. `SYSTEM`, the "Hold a beat only…" paragraph: append one sentence: "Name in arrivals each
   offstage NPC the recent transcript or the beat to resolve shows on screen: seen, heard or met.
   Never name one only mentioned or expected."
4. `DirectorPromptInput` gains `offstageNpcs: string[]`; `buildDirectorPrompt` adds
   `section("Offstage NPCs", input.offstageNpcs, 300, "end")` after "Encounters you may start".
   Each entry is `NPC <id> (<name>, <role>)`, built in the node.

`director.ts` (node) passes `offstageNpcs` from `offstageNpcIds` mapped through the seed. Other
callers of `buildDirectorPrompt` (tests) pass `offstageNpcs: []`.

### D3 — The arrivals group in resolve (FR-004, FR-007)

`apps/server/src/dm/nodes/resolve.ts`, `directorOpening` only:

- After the `if (ctx.job.trigger === "scene-start") { … return; }` block and before
  `// table mode`, for each id in `director.arrivals ?? []`: `run.submit(
  \`director:arrival:${id}\`, "scene-presence", () => ({ kind: "scene-presence", ...note(
  \`${npc.name} arrives\`, "The Director reports the NPC on screen."), actorId: id, reason:
  "arrived", actionId: null, visibility: "public" }))`. Skip an id with no seed NPC.
- In the `tm.to === "turn"` branch, replace the `p` argument of the encounter-start
  `seedPresence` call with `await deps.loadProjections(ctx.job.sessionId)` when any arrival was
  submitted, else `p`.

Hunks touched in `resolve.ts`: `directorOpening` (one insert after the scene-start block, one
argument change in the encounter-start `seedPresence` call) and the `resolve` node's `checkPlan`
call (`arriving:` argument, D4). Not touched: `seedPresence`, `pullIn`, `resolveAction`,
`runSteps`, `directorClosing`, the NPC group and the turn-advance group (TASK-0208 and TASK-0127
edit those).

### D4 — The plan gate (FR-005, FR-006)

`apps/server/src/dm/nodes/resolve.ts`, the `checkPlan` call: `arriving: [...new Set([
...arrivingNpcs(...), ...(director.arrivals ?? [])])]`.

`apps/server/src/dm/gates/plan-gate.ts`, `checkPlan`: build `const arriving = new
Set(input.arriving)` and skip an actor in the `absentIds` loop when `arriving.has(a.id)`. The
`PlanInput.arriving` doc comment names both sources. No other change.

### D5 — The chronicle (FR-009)

`apps/server/src/dm/prompts/chronicle.ts`:

- `PROMPT_VERSION` `dm.chronicle-v3` → `dm.chronicle-v4`.
- `SYSTEM`, second paragraph: append "Write that someone left only when the transcript tells it.
  Someone missing from the state may still be on the scene."
- `buildChroniclePrompt`: pass `{ ...input.snapshot, actors: input.snapshot.actors.filter((a) =>
  a.presence !== "absent") }` to `snapshotSection`.

`apps/server/src/dm/chronicle.ts` is unchanged.

### D6 — Contracts (FR-011)

- `specs/031-dm-runtime/contracts/director.md`: append "## Amendment 2026-11-02
  (specs/078-revealed-npc-present): arrivals" with the field, the legality row (an arrival is
  legal when it names an offstage seed NPC and the trigger is not `scene-start`; otherwise
  dropped and recorded) and the proposal row (one public `scene-presence` `arrived`, key
  `director:arrival:<npcId>`, first opening move after scene start).
- `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md`: append to the `arriving`
  rule: "Amended by spec 078: `arriving` also holds the Director's legal arrivals, and the id
  check does not treat an arriving id as absent."

### D7 — Tests

| File | Change |
|---|---|
| `apps/server/test/dm/director.test.ts` | new cases: legal arrival kept; present, yielded, unknown and duplicate ids dropped with one `arrivals` override; scene start drops all; omitted field reads `[]` |
| `apps/server/test/dm/assemble.test.ts` | the `DIRECTOR_VERSION` assertion moves to the bumped version; the two `buildDirectorPrompt` calls pass `offstageNpcs: []`; one new case: the prompt lists an offstage NPC under "Offstage NPCs" and the system text holds the arrivals sentence |
| `apps/server/test/dm/trio-views.test.ts` | its `buildDirectorPrompt` call passes `offstageNpcs: []` |
| `apps/server/test/dm/plan-gate.test.ts` | new case: an attack on absent `snag` passes when `arriving: ["snag"]`, with `pull: ["snag"]` |
| `apps/server/test/dm/chronicle-prompt.test.ts` | new: Story 3 scenarios 1–3 |
| `apps/server/test/dm/scripts/reveal-snag.json` | new DM script (D8) |
| `apps/server/test/dm/revealed-npc.integration.test.ts` | new DB test (D8) |

### D8 — The merge-condition test: run 1 seq 40–45 (FR-010)

Script `reveal-snag.json`, built from `shoot-snag.json` (spec 075) with two differences: turn 1's
interpret `check` step has `onSuccess: []` (run 1 wrote no presence effect), and turn 2's
Director reply holds `"arrivals": ["snag", "pell"]`. Turn 1's narration text states the reveal
("a goblin perched on a mud bank … Snag", "lashed to the post … Pell", finding 6).

DB test `revealed-npc.integration.test.ts` (pattern `attack-anyone.integration.test.ts`, seed
`greyhollow-ford-duo`):

1. **seq 40–45, free mode**: after turn 2, `scene-presence.changed` public rows with reason
   `arrived` for `snag` and `pell`, each before `combatant.added` for `snag`; that row before
   `attack.resolved` with `targetId: "snag"`; the action resolves `applied`; `planGate` is
   `[{ actionId, ok: true, pull: ["snag"] }]`; no `encounter.started`.
2. **encounter start in the same beat**: the turn 2 Director reply also holds `tableMode: { to:
   "turn", encounterId: "reed-camp", reason: … }`; initiative dice are added to the script's
   dice before the attack's. Assert one `arrived` row each for `snag` and `pell` (none from the
   encounter-start group), `encounter.started`, `snag` once in the order, and the action
   `applied`. This is the R3 and R4 regression.
3. **control**: turn 2's Director reply with `arrivals` removed. The action resolves `refused`,
   `UNKNOWN_COMBATANT`, `failure.reason: "absent"` (spec 075 control, run 1's live state).

### D9 — Mutation guards

- Remove the `absentIds` arriving skip (D4): D8.2 fails `absent`. Restore.
- Pass `p` instead of the fresh load to the encounter-start `seedPresence` (D3): D8.2 fails at
  the gate. Restore.

### D10 — OQ handling at (a)

- OQ-1 (a): D1–D3. No narration scan.
- OQ-2 (a): no code starts an encounter. D8.1 asserts no `encounter.started`.
- OQ-3 (a): `talk-turn.ts` is unchanged; its literals omit `arrivals`.
- OQ-4 (a): `narrate.ts` and `prompts/narrate.ts` are unchanged.

## Files touched

| File | Change |
|---|---|
| `apps/server/src/dm/nodes/schemas.ts` | `DirectorOutput.arrivals` (D1) |
| `apps/server/src/dm/nodes/director.ts` | `offstageNpcIds`, `arrivals` legality and override kind, prompt input (D1, D2) |
| `apps/server/src/dm/prompts/director.ts` | version bump, output shape line, one system sentence, Offstage NPCs section (D2) |
| `apps/server/src/dm/nodes/resolve.ts` | arrivals group and fresh load in `directorOpening`; `arriving` in the `checkPlan` call (D3, D4) |
| `apps/server/src/dm/gates/plan-gate.ts` | arriving ids are not absent (D4) |
| `apps/server/src/dm/prompts/chronicle.ts` | version bump, one system sentence, offstage filter (D5) |
| `specs/031-dm-runtime/contracts/director.md` | arrivals amendment (D6) |
| `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md` | arriving amendment (D6) |
| `apps/server/test/dm/director.test.ts`, `assemble.test.ts`, `trio-views.test.ts`, `plan-gate.test.ts` | edited (D7) |
| `apps/server/test/dm/chronicle-prompt.test.ts` | new (D7) |
| `apps/server/test/dm/scripts/reveal-snag.json` | new (D8) |
| `apps/server/test/dm/revealed-npc.integration.test.ts` | new (D8) |
| `docs/wiki/presence.md`, `seed-npc-presence.md`, `dm-runtime.md`, `dm-failure-and-gates.md`, `output-claim-gate.md`, `dm-turn-jobs.md`, `party-panel.md`, `turn-floor.md`, `dm-talk-triggers.md`, `srd-data.md`, `CAPSULES.md`, `INDEX.md` | re-ground (wiki phase); the last seven list a touched source and re-pin |

**Not touched** (overlap check): `dm/snapshot/build.ts` and `render.ts` (the card's footprint
named `build.ts`; presence already reads the log there), `dm/facts.ts` (the presence fact already
renders `arrived` rows), `dm/chronicle.ts`, `dm/talk-turn.ts`, `dm/nodes/narrate.ts`,
`dm/prompts/{interpret,adjudicate,step-grammar,narrate,react}.ts`, `dm/fallback.ts`,
`dm/seed/`, `apps/server/seeds/*.json`, `packages/`.

**Coordination**: TASK-0113 changes `prompts/director.ts` lines 1–37 (import, version, goalNote
line, a SYSTEM line). D2's hunks 1–3 touch the same region, so implementation starts only after
TASK-0113 merges; Phase 1 merges `origin/main` first. TASK-0208 and TASK-0127 later edit
`resolve.ts`; D3 and D4 name the only hunks here.

**Migrations**: none. **New runtime dependencies**: none.

## Frozen-contract impact

None. `ws-protocol.md` frame shapes, `specs/029-proposal-gate/contracts/` and
`specs/030-play-route/contracts/proposal-seam.md` are unchanged. The `scene-presence` proposal
and event are used as they are. The 031 director contract and the 058 contract are not frozen.

## Open questions

- OQ-1 to OQ-4: see spec.md. Defaults (a) are designed above.
