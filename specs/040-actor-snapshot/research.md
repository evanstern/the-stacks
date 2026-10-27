# Research: Actor snapshot (TASK-0140)

Each entry: decision, rationale, alternatives. Code references are to `origin/main` at the
claim commit (53250a9) unless stated.

## R1. One module, three views

- **Decision**: one `buildSnapshot` and one `renderSnapshot` with views `dm`, `seat`, `fiction`.
- **Rationale**: decision-0025 §1.5 requires one snapshot for every node. Readers differ in what
  they may see: narrate, audit and chronicle write digit-free player-facing text
  (`prompts/narrate.ts` rule 3, `prompts/chronicle.ts` "never state a dice total"); the
  companion is a seat (`companion.ts:18-23`) and today sees party sheets and encounter HP but no
  monster AC (`prompts/common.ts:168-223`); the planning nodes need every number.
- **Alternatives**: one view for all (puts HP digits and monster AC into narrate and companion
  prompts, a regression); separate builders per node (the G6 problem again).

## R2. Actor ids

- **Decision**: party → characterId; seed NPC → npc id; other combatant → combatantId; each actor
  also carries `combatantId` and `characterId`.
- **Rationale**: claim checks (TASK-0143) speak of characters and NPCs; engine effects
  (TASK-0147, U6's plan gate) carry combatant ids. Carrying both keeps both lookups one hop.
- **Alternatives**: combatant id everywhere (a seed NPC with no combatant has none).

## R3. Seed NPC joined with its combatant

- **Decision**: a seed NPC whose `identity.combatant` names an engine combatant is one actor.
- **Rationale**: the shipped seed links Snag to combatant `snag`
  (`apps/server/seeds/greyhollow-ford.json`). Two actors would make every claim about Snag
  ambiguous. `npcNames` deduped by name for the same reason (`facts.ts:497-503`).
- **Alternatives**: leave the join to TASK-0142 (U8). Rejected: U1 would ship a duplicate.

## R4. Aliases from code

- **Decision**: aliases are the name, ids, given name after title words, and the engine and seed
  encounter names. The title-word rule moves from `nodes/audit.ts` (`partyNameTerms`) to
  `snapshot/aliases.ts`.
- **Rationale**: the seed has no alias field; the audit already derives party terms this way and
  its tests pin the behaviour.
- **Alternatives**: a seed alias field now (a seed schema change belongs with TASK-0142).

## R5. Cap, compression, overflow

- **Decision**: per-view caps (dm 2000, seat 1600, fiction 800), compression of dead and absent
  actors only, then `SnapshotOverflowError` mapped to `NodeError` kind `state-overflow` in the
  runner.
- **Rationale**: decision-0025 §1.6 names exactly that sequence. `capEntries` drops from the
  end (`common.ts:33-46`), which is the G6 defect, so the snapshot does not use it. A dedicated
  error kind makes the failure loud in `jobs.result` and the DM notice; `internal` would hide it
  among bugs.
- **Alternatives**: further compression of living actors (not in the decision; it would hide
  state the gates need); keep 800 (the 6-member party with sheets plus a full encounter would
  overflow at the schema maximum).

## R6. Where S1 comes from

- **Decision**: `resolve` reloads projections after its last write and builds S1 there.
- **Rationale**: decision-0025 §1.4 names `resolve`. Resolve re-runs on every reclaim
  (`pipeline/runner.ts` checkpoints only director, interpret, adjudicate), so S1 is always
  rebuilt from the log.
- **Alternatives**: build S1 in narrate (narrate already reloads, but the decision places it in
  resolve and the batch gate of TASK-0147 needs it there).

## R7. Chronicle snapshot at `throughSeq`

- **Decision**: a bounded fold (`loadProjections` with `{ throughSeq }`) for the chronicle's
  snapshot; the seed comes from `p.scene.sceneId` through `loadSeed`.
- **Rationale**: decision-0025 §4: "snapshot at throughSeq". The chronicle runs off the hot path
  and may lag; current state could contradict the transcript slice it chronicles.
- **Alternatives**: current state (cheaper, wrong after a later death); no state (the decision
  requires one).

## R8. The diff stays out of prompts in U1

- **Decision**: build, return and test the diff; render it nowhere yet.
- **Rationale**: narrate already receives this turn's changes as NarrationFacts change lines
  (`prompts/narrate.ts` `describeChange`). TASK-0146 (U7) owns rendering the diff for audit and
  its F52 regression; TASK-0143 and TASK-0147 read it in code.
- **Alternatives**: render it in narrate now (duplicate facts; changes narrate doctrine, which is
  TASK-0113 and TASK-0130 territory).
