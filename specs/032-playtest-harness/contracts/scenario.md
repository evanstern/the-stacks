# Contract: the scenario (scripted players)

Module: `apps/server/src/playtest/scenario.ts` (`ScenarioSchema`, `loadScenario`),
`apps/server/src/playtest/driver.ts` (`nextMove`). Data:
`apps/server/playtests/scenarios/<name>.json`. FR-001, FR-002, FR-004, FR-005, FR-006.

## Schema

```ts
const Move = z.object({
  text: z.string().min(1).max(500),
  actionId: z.string().regex(/^[a-z0-9-]{1,64}$/).optional(),   // fixed id (CI scripts name them)
});

export const ScenarioSchema = z.object({
  v: z.literal(1),
  name: z.string().regex(/^[a-z0-9-]{1,64}$/),
  seedId: z.string().regex(/^[a-z0-9-]{1,64}$/),
  seat: z.object({
    characterId: z.string().min(1),
    userId: z.string().uuid(),
  }),
  moves: z.object({
    free: z.array(Move).min(1).max(50),
    combat: z.object({
      text: z.string().min(1).max(500),
      firstActionId: z.string().regex(/^[a-z0-9-]{1,64}$/).optional(),   // id of the first combat move only
    }),
    fallback: z.array(Move.omit({ actionId: true })).min(1), // the legacy single object reads as one entry
  }),
  limits: z.object({
    maxMoves: z.number().int().min(1).max(200),
    maxWallMs: z.number().int().min(10_000).max(3_600_000),
  }),
  dice: z.object({
    faces: z.array(z.number().int().min(1).max(1000)).max(2000).default([]),
    seed: z.number().int().min(0).max(4294967295).nullable().default(null),
  }).default({ faces: [], seed: null }),
  ci: z.object({
    dmScript: z.string().min(1),      // a DM script (fake-gateway-script.md), unchanged format
    auditScript: z.string().min(1),   // an auditor script (below)
    retrieve: z.string().min(1),      // a RetrieveResult JSON returned for every query
  }).nullable(),
});
```

`loadScenario(path)` parses the file, resolves `ci.*` paths relative to the scenario file,
checks `seat.characterId` is the seed's one `seat: "human"` character (via `loadSeed`), and
throws a `ScenarioError` listing every issue.

## The auditor script

```ts
export const AuditScriptSchema = z.object({
  v: z.literal(1),
  name: z.string().min(1).max(100),
  responses: z.array(z.object({
    note: z.string().max(200).optional(),
    respond: z.discriminatedUnion("type", [
      z.object({ type: z.literal("json"), value: z.unknown() }),
      z.object({ type: z.literal("text"), value: z.string() }),
      z.object({ type: z.literal("error"), kind: ErrorKindSchema, message: z.string() }),
    ]),
    usage: z.object({ inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0) })
      .default({ inputTokens: 0, outputTokens: 0 }),
  })).max(200),
});
```

Responses are queued in order on purpose `playtest.audit`. The `respond` union mirrors the DM
script's, so one `toChatScript` shape serves both (import it if exported, else re-implement the
three cases).

## Driver: choosing the next move

`nextMove(p: SessionProjections, scenario, state: { freeIndex, moves }): Move | "wait" | "done"`
is pure.

1. `p.scene === null` and the scene had started → `"done"`.
2. `state.moves >= limits.maxMoves` → `"done"` (the harness records `stalled` unless rule 1 held).
3. Any action of the human seat is `declared` or `committed` and not `resolved` → `"wait"`.
4. `p.tableMode.mode === "turn"`:
   - the active combatant is `seat.characterId` → `moves.combat`;
   - otherwise → `"wait"`.
5. `p.tableMode.mode === "free"`: `moves.free[freeIndex]` when one remains, else
   `moves.fallback`, cycled in list order and never the same text twice in a row (a one-entry list repeats).
6. After 3 consecutive fallback moves whose turns appended no ledger `change` row (a table-mode row counts only when
   the mode changed; seat and gate-policy rows never count) → `"done"`; the harness records `stalled` with `stallReason: "seat-exhausted"` in `run.json`.

The harness loop: start the scene, drain until idle, then repeat { `nextMove`; on a move,
declare and commit it through `gate.handle`, drain until idle; on `"wait"` with an idle queue,
stop `stalled`; on `"done"`, stop }. Before each move it checks the stop conditions in
data-model.md order. A move without `actionId` gets `pt-<n>`.

## The shipped scenario (`greyhollow-ford.json`)

- `seat`: `tamsin`, user `00000000-0000-4000-8000-0000000000a1` (the DM suites' `TAMSIN_USER`).
- `moves.free`: the scene test's three free moves with ids `act-search`, `act-persuade`,
  `act-advance`, texts verbatim from `scene.integration.test.ts`.
- `moves.combat`: text "I swing my longsword at the goblin in the pot-helm.", `firstActionId`
  `act-strike` (the CI script names it). Later combat moves get `pt-<n>`.
- `moves.fallback`: five short first-person moves (ask, examine, offer, edge toward the reeds, ready the sword).
- `limits`: `maxMoves` 30, `maxWallMs` 3600000 (60 minutes; real-model turns take ~35 s).
- `dice`: `faces: []`, `seed: null` (drawn at run time in provider mode).
- `ci`: `../../test/dm/scripts/greyhollow-ford-full.json`,
  `../fixtures/greyhollow-ford.audit.json`, `../fixtures/greyhollow-ford.retrieve.json`.

The retrieval fixture holds the scene test's `PASSAGE` and anchor (`Fixture Rules`, path
`["Social"]`), original text.
