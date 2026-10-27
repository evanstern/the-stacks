# Research: Seed NPCs carry minimal scene presence

## R1. Does the recorded M2 log fold under the current catalog? (AC #3 plan risk)

- **Decision**: Yes. The AC #3 test reads `docs/design/m2-demo/demo-session/transcript.jsonl`
  in place.
- **Evidence** (2026-10-27, throwaway script outside the repo, against built `dist/` of
  `packages/session-model` and `apps/server` at 43e6d6a):
  - 333 rows, seqs 1–333 with no gap. 0 rows fail `StoredEventSchema`. `decodeEvent` returns
    `known` for 333 of 333.
  - The DM-viewer fold reports 0 for every diagnostic (`skippedUnknownType`,
    `skippedUnknownVersion`, `skippedInvalid`, `outOfOrder`, `ignoredTransitions`,
    `beforeMismatches`, `engineRejected`) and no incomplete batch.
  - With the shipped seed, `buildSnapshot` at each seq 295–301 lists Snag once (`id: "snag"`,
    `kind: "npc"`, `combatantId: "snag"`), `presence: "present"`, `lifeState: "conscious"`.
    `goblin-2` and `goblin-4` are `present` too.
  - `diffSnapshots(S298, S301)` holds initiative and stage changes (encounter end, free mode)
    and 0 `presence` entries. The log holds 0 `scene-presence.changed` rows.
- **Alternatives considered**: a hand-copied fixture of seqs 296–301. Rejected: it would not be
  the recorded evidence, and the fold needs the full prefix (Snag joins at seq 104).

## R2. Why seed rows, not a seed default in the snapshot

- **Decision**: log rows (OQ-2 (a), ruled).
- **Rationale**: the `scene-presence` planner fills `before` from `p.scenePresence` and refuses a
  no-change. A snapshot-only seed default would disagree with the planner: an `arrived` on a
  seed-absent NPC would be refused as `present` to `present`.

## R3. Where the encounter-start arrival goes

- **Decision**: after the monsters' `combatant.add`, before `initiative.roll`.
- **Rationale**: no encounter is active yet, so the planner plans no `initiative.join`; the roll
  then includes Snag once as an encounter monster. After the roll, `arrived` would plan an
  `initiative.join` for a combatant already in the order and the engine would refuse it.

## R4. Visibility shape

- **Decision**: `visibility: z.enum(["public", "dm"]).default("public")`, as on `journal`.
- **Rationale**: the event's catalog visibility is already `any`; the default keeps every U2
  caller unchanged. `facts.ts` `buildEvents` already filters to `public` rows.

## R5. Test seeds

- **Decision**: only two seed documents exist (shipped seed, spec copy; `seed.test.ts` compares
  them). Tests that build seeds clone the shipped one. `snapshot-render.test.ts` `big()`
  synthesizes NPCs on a typed object it never parses; it needs no presence map, because
  `buildSnapshot` never reads beats. Phase 1 confirms it still type-checks.
