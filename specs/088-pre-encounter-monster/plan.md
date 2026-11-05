# Implementation Plan: An encounter monster can be acted on before its encounter starts

**Branch**: `task-0238-pre-encounter-monster` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: `specs/088-pre-encounter-monster/spec.md`. This plan assumes OQ-1 to OQ-4 (a). A
different ruling changes the design section named under that OQ. Research and design sit inline,
as in specs 075 and 078; there is no separate research.md, data-model.md or quickstart.md.

## Summary

Spec 078's Director `arrivals` field also accepts an unseen encounter monster, in free mode. Resolve
adds each monster arrival as an engine combatant before the action groups, so the plan gate accepts
its id (it joins `joining`) and the next snapshot holds it as a monster actor by combatantId
(snapshot rule 4, unchanged). The interpret prompt lists every monster id arriving this beat, the
arrivals and the encounter-start joiners, so interpret can name the id. An encounter stays runnable
until it has run, even with some monsters already added. For card AC #3, a refused action's fact
line says it did not happen, carries no follow-ups, and the narrate prompt forbids showing its
outcome.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. No new dependency.
**Storage**: Postgres event log; `jobs.result` checkpoint JSON. No shape change. No migration.
**Testing**: Vitest unit tests; DB integration tests with `REQUIRE_DATABASE=1`; the fake gateway
and DM scripts (spec 053).
**Target Platform**: the server's DM runtime (`apps/server/src/dm/`).
**Project Type**: monorepo web service.
**Performance Goals**: none new. One short prompt section each in director and interpret; no new
model call.
**Constraints**: merge spine #5. Implementation starts after TASK-0244 (`gates/plan-gate.ts`,
`nodes/resolve.ts`, `facts.ts`) and TASK-0242 (`facts.ts`, `prompts/narrate.ts`) merge. TASK-0203
edits `prompts/interpret.ts` and `prompts/director.ts`. TASK-0237 edits `nodes/resolve.ts` and
`prompts/director.ts` after this task.
**Scale/Scope**: 9 source files, 1 contract, 6 edited tests, 1 new test, 1 new DM script.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the field is produced and applied inside the DM turn job.
- [x] **II. Content contract**: no seed field added; the seed's monster `name` is read as it is.
- [x] **III. Data planes**: session plane only. SRD monster records are read as today.
- [x] **IV. Event sourcing**: a monster arrival reaches the log as a keyed `run.mech`
      `combatant.add` submission through `gate.submit`. The Director node writes nothing.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: the engine is unchanged. The opposed DC comes from
      `oppositionDc` on the monster's SRD stats (spec 084).
- [x] **VII. Structured first**: a typed field with code legality; a typed refused outcome. No
      prose parsing.
- [x] **VIII. Operator-owned content**: no new content.
- [x] **IX. Self-hostable**: no new service, container or dependency.

**Stack conformance**: no departure. **New runtime dependencies**: none (checkpoint C5 not hit).

## Research

- **R1 — Reuse spec 078's arrivals path (OQ-1).** The runbook's lane note asks to check 078 first.
  078's `arrivals` covers seed NPCs: Director legality, a Director prompt section, a keyed opening
  move in resolve, and the plan gate's `arriving` list. An encounter monster differs in one way: it
  has no actor in S0, so a presence row has nothing to flip. The matching move is a `combatant.add`,
  which `directorOpening` already writes for an encounter start. After it, snapshot rule 4 makes the
  monster an actor by combatantId on every later beat. The plan gate's `joining` list already
  accepts a combatant this beat's opening moves add (spec 045 SC-003). So `snapshot/build.ts` needs
  no change: AC #1's "snapshot actor by combatantId" holds from the beat after the arrival, and the
  arrival beat is covered by `joining` plus the interpret section (R3).
- **R2 — Run 1 seq 73-92.** With `reed-camp` starting in the beat, `joiningCombatants` already
  lists `goblin-3`, and `checkPlan` adds `joining` to `valid`. A plan naming `goblin-3` passes
  today. The refusal therefore named another id. Interpret's prompt shows the S0 snapshot and, for
  an active encounter only, the encounter line: no section names `goblin-3` before the encounter is
  active. Interpret most likely invented `goblin-lookout` again (seq 52-58 shows that id). Phase 1
  confirms the refused id from the playtest log and a plan-gate unit test. If the refused id was
  `goblin-3`, the seam differs: stop and report.
- **R3 — Interpret cannot see arriving ids.** `buildInterpretPrompt` reads `assembled.snapshot` (S0)
  and `seedEntries`, which names an encounter only when it is active. A new "Arriving this beat"
  section closes both cases: the monster arrivals and the encounter-start joiners. It names only ids
  the Director already put on screen or the encounter start adds, so it shows no hidden monster.
  The helper is shared with resolve's `checkPlan` call, one definition, as `encounterToStart` is.
- **R4 — Runnable encounters (spec gap 7).** `runnableEncounterIds` and `legalEscalation` call an
  encounter runnable while none of its monsters is a combatant. After a monster arrival, `reed-camp`
  would never start. The new rule: an encounter has run when it is active
  (`deriveActiveEncounterId` logic) or when an `encounter.started` ledger row's `after.order` holds
  one of its monsters. Ledger change rows carry `type` and `after` (`projections/ledger.ts`). An
  encounter that has not run stays runnable. `directorOpening` already skips a monster that is a
  combatant, but it reads the assemble projections `p`. A monster added this beat is not in `p`, so
  the encounter start would add it twice. Reload projections after the arrivals group when any
  arrival landed, as 078 does for `seedPresence`, and use the fresh copy for both.
- **R5 — Free mode only (OQ-2).** In turn mode a new combatant needs an initiative entry. `pullIn`
  joins initiative for a seed NPC, and the gate's presence path joins on `arrived`. A monster
  arrival mid-fight would need the same rule plus a turn-order decision. Each greyhollow seed holds
  one encounter, so turn mode never has an unseen monster of a runnable encounter. Legality drops a
  turn-mode monster arrival with the override.
- **R6 — A refused action in the narration (AC #3).** `factEntries` renders
  `refused (refused: UNKNOWN_COMBATANT)` and still prints the action's `followUps`
  ("not yet attempted: ..."), which invites the narrator to stage the attempt. The narrate system
  text has rules for no-effect and on-hold actions but none for a refused one. The fallback says
  "cannot do that here" and then appends `changeSentences(a.changes)`. A refused action has no
  changes today, so the fallback line is already honest. The fix: the fact line says it did not
  happen, `buildNarrationFacts` drops follow-ups for a refused action, the narrate system text
  forbids its outcome, and the fallback skips change sentences for it so the rule holds by
  construction. An engine refusal is covered by the same rule: it also means no step landed.
- **R7 — The replay seed.** The duo seed holds the same reed-camp encounter and the same monsters,
  and spec 078's replay drives it. The replay uses the duo seed. Tamsin declares the parleys: Odo's
  companion job is not under test, and the reading interpret returns is scripted either way.
- **R8 — The held turn.** The runner applies `holdDirector` after interpret. A cut beat (a reading
  with `followUps`) holds a `turn` decision. Then the interpret section listed the encounter's
  joiners, resolve starts no encounter, and an id only a joiner held fails `not-in-snapshot`, as
  today. Monster arrivals are not held (`arrivals` is not in the hold table), so Story 1 is
  unaffected. No change: the held case is a later beat's encounter start.

## Design

### D1 — Shared encounter helpers (FR-004, FR-005, FR-006)

`apps/server/src/dm/gates/plan-gate.ts`, beside `encounterToStart` and `joiningCombatants`:

- `encounterRan(projections, enc): boolean`: true when `projections.encounter` is non-null and its
  order holds one of `enc`'s monsters, or when a ledger row has `kind: "change"`,
  `type: "encounter.started"` and an `after.order` entry holding one of `enc`'s monsters.
- `unseenMonsters(projections, seed): { id; name; encounterId }[]`: in seed order, every encounter
  monster of an encounter with `!encounterRan`, whose `combatantId` is not in
  `projections.engine.combatants` and not a seed NPC id. `name` is the seed name, else the SRD id.
- `arrivingMonsters(seed, projections, director, trigger): { id; name }[]`: the director's
  `arrivals` that are encounter monsters, then `joiningCombatants(encounterToStart(...),
  projections.engine.combatants)`, deduped by id, each with its seed name.

### D2 — Director legality and runnable encounters (FR-001, FR-006)

`apps/server/src/dm/nodes/director.ts`:

- `runnableEncounterIds`: keep only encounters with `!encounterRan(projections, e)`.
- `legalizeDirector` arrivals block: an id is legal when it is in `offstageNpcIds` (078), or when
  `free` and it is in `unseenMonsters`. The override reason stays
  "an arrival named an NPC that is not offstage" for an NPC. For a dropped monster id it reads
  "an arrival named a monster that is not unseen, or the table is in turn mode".
  One override per drop kind, at most two.
- The node passes `unseenMonsters` to the prompt input.

`apps/server/src/dm/talk-turn.ts` `legalEscalation`: replace the "no monster is a combatant" test
with `!encounterRan(p, enc)`. Free mode and no active encounter stay required.

### D3 — The Director prompt (FR-002)

`apps/server/src/dm/prompts/director.ts`:

1. Bump `PROMPT_VERSION` one past `main`.
2. Output shape: `"arrivals":[id of an offstage NPC or an unseen encounter monster now on screen]`.
3. The SYSTEM sentence on arrivals: "Name in arrivals each offstage NPC or unseen encounter monster
   the recent transcript or the beat to resolve shows on screen: seen, heard or met. Never name one
   only mentioned or expected. Name an unseen monster only in free mode."
4. `DirectorPromptInput.unseenMonsters: string[]`; a section "Unseen encounter monsters", cap 300,
   one line each: `Monster goblin-3 (Goblin lookout, encounter reed-camp)`.

### D4 — Resolve (FR-003, FR-004, FR-007)

`apps/server/src/dm/nodes/resolve.ts` `directorOpening`, in the arrivals loop:

- A seed NPC id: unchanged (078).
- Otherwise, when the id is an encounter monster: `run.mech("director:arrival:<id>",
  { type: "combatant.add", combatant: combatantFromSrd(rec, id, m.name) },
  "<name> comes into view", null)`. A missing SRD record throws `stop("internal", ...)`, as the
  encounter start does. No presence row.
- After the loop, when any arrival landed, load projections once. Use that copy for the encounter
  start's "already a combatant" skip and for `seedPresence` (replaces 078's `arrived > 0` reload).

`resolve` `checkPlan` call: `joining` becomes
`arrivingMonsters(ctx.seed, assembled.projections, director, ctx.job.trigger).map((m) => m.id)`.
That list equals today's joiners plus the monster arrivals.

### D5 — The interpret prompt (FR-005)

`apps/server/src/dm/prompts/interpret.ts`:

1. Bump `PROMPT_VERSION` one past `main`.
2. After the State section, a section "Arriving this beat", cap 300, from `arrivingMonsters`:
   `goblin-3 "Goblin lookout" (monster; joins the scene before any step runs; name it by this id)`.

### D6 — A refused action (FR-008, FR-009)

- `apps/server/src/dm/facts.ts` `buildNarrationFacts`: a refused action gets `followUps: []`.
- `apps/server/src/dm/prompts/narrate.ts`:
  1. Bump `PROMPT_VERSION` one past `main`.
  2. `factEntries`: the refused line becomes
     `refused (refused: <code>): it did not happen; nothing was rolled and nothing changed`.
  3. One SYSTEM line after the no-effect line: "A refused action did not happen: no roll and no
     result. Never show it succeed, fail or land, and never show anyone react to its result."
- `apps/server/src/dm/fallback.ts`: for a refused action, push the "cannot do that here" sentence
  and skip `changeSentences`.

### D7 — Contract (FR-011)

`specs/031-dm-runtime/contracts/director.md`: append "Amendment 2026-11-05
(specs/088-pre-encounter-monster): monster arrivals". It records the unseen-monster legality row,
the free-mode rule, the `combatant.add` opening move and its key, and the run-encounter rule for
`turn` legality.

### D8 — Unit tests

- `apps/server/test/dm/director.test.ts`: legality keeps `goblin-3` in free mode, drops it in turn
  mode, drops `goblin-9` and a combatant id, keeps `snag` on the 078 path; `runnableEncounterIds`
  keeps `reed-camp` with `goblin-3` a combatant and drops it after an `encounter.started` row.
- `apps/server/test/dm/plan-gate.test.ts`: `checkPlan` passes a check opposed by `goblin-3` with
  `goblin-3` in `joining`; refuses `goblin-lookout` `not-in-snapshot` (the seq 52-58 and seq 73-92
  shapes); `arrivingMonsters` lists arrivals then joiners once; `encounterRan` both branches.
- `apps/server/test/dm/interpret-prompt.test.ts`: version bump; the section lists `goblin-3` for an
  arrival and for a same-beat start, and is absent otherwise.
- `apps/server/test/dm/facts.test.ts`: a refused action has no follow-ups.
- `apps/server/test/dm/narrate.test.ts`: the refused fact line and the SYSTEM rule; version bump.
- `apps/server/test/dm/fallback.test.ts`: a refused action gives one sentence and no change line.
- `apps/server/test/dm/talk-turn.integration.test.ts`: `legalEscalation` stays true with `goblin-3`
  added before the encounter.

### D9 — The run 1 replays (FR-010)

New script `apps/server/test/dm/scripts/parley-lookout.json` and test
`apps/server/test/dm/pre-encounter-monster.integration.test.ts`, shaped like
`revealed-npc.integration.test.ts` (duo seed, scene start, then turns). Variants:

1. **seq 52-58**: free mode. The Director reports `arrivals: ["goblin-3"]`. Interpret returns a
   Persuasion check, `difficulty: { opposedBy: "goblin-3", rule: "influence" }`. Assert
   `combatant.added` for `goblin-3` before `check.resolved`, the opposition on `check.resolved`,
   the action `applied`, no `UNKNOWN_COMBATANT` verdict, and no `encounter.started`.
2. **seq 73-92, unseen**: the Director moves to turn mode for `reed-camp`, no arrivals. Interpret's
   request (captured by the fake gateway) holds `goblin-3` in "Arriving this beat". The coin parley
   names `goblin-3`. Assert `encounter.started`, `goblin-3` once in the order, the check resolved,
   no `UNKNOWN_COMBATANT` verdict.
3. **seq 73-92, arrived earlier**: variant 1, then a second turn that starts `reed-camp`. Assert the
   `turn` decision has no override, one `combatant.added` for `goblin-3` in the whole log, and
   `goblin-3` once in the order.
4. **control**: variant 1 without `arrivals`. The action resolves `refused`, `UNKNOWN_COMBATANT`,
   `failure.reason: "not-in-snapshot"`. The narrate request's facts hold "it did not happen" for
   the action and no "not yet attempted" line for it (AC #3 end to end).

### D10 — Mutation guards

- Drop the monster arrivals from `joining` (D4): variant 1 fails `not-in-snapshot`. Restore.
- Pass `p` instead of the fresh load to the encounter start (D4): variant 3 fails with a duplicate
  combatant. Restore.
- Restore the old `runnableEncounterIds` predicate (D2): variant 3's `turn` is overridden. Restore.

### D11 — OQ handling at (a)

- OQ-1 (a): D1-D5. `snapshot/build.ts` is unchanged.
- OQ-2 (a): D2's free-mode rule.
- OQ-3 (a): D6 only. `prompts/audit.ts`, `nodes/audit.ts`, `claims.ts` unchanged.
- OQ-4 (a): no pull-in of an unseen monster. `pullIn` unchanged.

## Files touched

| File | Change |
|---|---|
| `apps/server/src/dm/gates/plan-gate.ts` | `encounterRan`, `unseenMonsters`, `arrivingMonsters` (D1) |
| `apps/server/src/dm/nodes/director.ts` | runnable rule, monster arrival legality, prompt input (D2) |
| `apps/server/src/dm/prompts/director.ts` | version bump, shape line, system sentence, Unseen section (D3) |
| `apps/server/src/dm/nodes/resolve.ts` | monster arrivals in `directorOpening`, one fresh load, `joining` (D4) |
| `apps/server/src/dm/prompts/interpret.ts` | version bump, Arriving this beat section (D5) |
| `apps/server/src/dm/talk-turn.ts` | `legalEscalation` uses `encounterRan` (D2) |
| `apps/server/src/dm/facts.ts` | no follow-ups on a refused action (D6) |
| `apps/server/src/dm/prompts/narrate.ts` | version bump, refused fact line, system rule (D6) |
| `apps/server/src/dm/fallback.ts` | refused action skips change sentences (D6) |
| `specs/031-dm-runtime/contracts/director.md` | monster arrivals amendment (D7) |
| `apps/server/test/dm/director.test.ts`, `plan-gate.test.ts`, `interpret-prompt.test.ts`, `facts.test.ts`, `narrate.test.ts`, `fallback.test.ts`, `talk-turn.integration.test.ts` | edited (D8) |
| `apps/server/test/dm/scripts/parley-lookout.json` | new (D9) |
| `apps/server/test/dm/pre-encounter-monster.integration.test.ts` | new (D9) |
| `docs/wiki/presence.md`, `seed-npc-presence.md`, `actor-snapshot.md`, `dm-failure-and-gates.md`, `dm-runtime.md`, `dm-turn-jobs.md`, `party-panel.md`, `turn-floor.md`, `output-claim-gate.md`, `dm-narration-quality.md`, `dm-talk-triggers.md`, `CAPSULES.md`, `INDEX.md` | re-ground (wiki phase) |

**Not touched** (overlap check): `dm/snapshot/build.ts` (the card's footprint named it; R1 shows
rule 4 already covers an added monster), `dm/snapshot/render.ts`, `dm/claims.ts`,
`dm/nodes/narrate.ts`, `dm/nodes/interpret.ts`, `dm/prompts/{adjudicate,step-grammar,audit,chronicle,react}.ts`,
`dm/nodes/audit.ts`, `dm/nodes/schemas.ts` (the `arrivals` shape is unchanged), `dm/seed/`,
`apps/server/seeds/*.json`, `packages/`.

**Coordination**: TASK-0244 edits `plan-gate.ts` (party-scope step actor), `resolve.ts` (hold for
the companion's turn) and `facts.ts` (off-turn list). TASK-0242 edits `facts.ts` (npcTurn roll
path) and `prompts/narrate.ts` (`rollEntry`, likely a version bump). TASK-0203 edits
`prompts/interpret.ts` and `prompts/director.ts`. D1, D4 and D6 name the only hunks here; Phase 1
re-reads those merged diffs and amends this plan if a named hunk moved. TASK-0237 edits
`resolve.ts` and `prompts/director.ts` after this task merges.

**Migrations**: none. **New runtime dependencies**: none.

## Frozen-contract impact

None. `ws-protocol.md` frame shapes, `specs/029-proposal-gate/contracts/` and
`specs/030-play-route/contracts/proposal-seam.md` are unchanged. The `mechanics` proposal and the
`combatant.add` command are used as they are. The 031 director contract is not frozen.

## Open questions

- OQ-1 to OQ-4: see spec.md. Defaults (a) are designed above.
