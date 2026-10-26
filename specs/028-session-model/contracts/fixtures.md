# Contract: fixture event streams

Binding for TASK-0047 (renders every fixture through the same components as the live log,
its AC #7) and TASK-0045 (builds gate tests on these streams). A fixture's events, viewers and
listed facts are the contract; changing them is a contract change. Adding a fixture is not.

## Where fixtures live

- Source: `packages/session-model/src/fixtures/`, one module per fixture, plus `index.ts`.
- Import: `import { fixtures, talkOnly } from "@the-stacks/session-model/fixtures";`
  (a `package.json` `exports` subpath; the main entry does not re-export fixtures).
- Recipes: `packages/session-model/src/fixtures/recipes.ts` (engine commands and scripted
  faces per mechanics batch), exported from the same subpath for tests.
- Tests: `packages/session-model/test/fixtures.test.ts`.

## Shape

```ts
export interface SessionFixture {
  name: string;                                  // kebab-case, unique
  description: string;                           // one paragraph: what it exercises
  sessionId: string;                             // fixed UUID, distinct per fixture
  viewers: { dm: Viewer; players: Viewer[] };    // the viewers its facts are stated for
  events: readonly StoredEvent[];                // seq 1..n, ascending; fixed ts values
}

export interface MechanicsRecipe {
  fixture: string;                               // fixture name
  batchId: string;
  command: EngineCommand;                        // engine command, as TASK-0045 would send it
  faces: number[];                               // scripted dice, consumed exactly
}

export const fixtures: readonly SessionFixture[];
export const recipes: readonly MechanicsRecipe[];
```

Fixed identities shared by all fixtures (exported as `fixtureIds`):

| Name | Value | Role |
|---|---|---|
| `playerUserId` | `00000000-0000-4000-8000-000000000001` | the human player (Ana's controller) |
| `otherPlayerUserId` | `00000000-0000-4000-8000-000000000002` | a second player, for whisper and secrecy tests |
| `dmActor` | `ai:dm` | the AI DM |
| `companionActor` | `ai:companion:bram` | Bram, an AI companion |

Timestamps start at `2026-10-26T18:00:00.000Z` and step by one second per `seq`.
Characters are original (Ana, Bram); monsters are SRD-named generics (goblin). No book text.

## The fixtures

| Name | Exercises | Facts a test asserts |
|---|---|---|
| `talk-only` | IC and OOC talk from the player and a companion, a narrator chime-in as talk, one whisper to `otherPlayerUserId` | transcript lengths per viewer (the player sees no whisper; the other player and the DM do); every other projection equals `emptyProjections` (AC #2) |
| `free-mode-action` | `scene.changed`; party joins for Ana and Bram; `combatant.add` batches; Ana declares picking a lock; Bram comments; Ana commits (`declarer`); one `check.roll` batch; `action.resolved` (`applied`); narration; `journal.entry.added` | action status sequence declared → discussed → committed → resolved; ledger has one `roll`, one `outcome` and the `combatant.added` changes; scene, party (with HP) and journal content (AC #1, AC #4, AC #6) |
| `turn-mode-combat` | `initiative.roll` batch; `table-mode.changed` free → turn (active: player); Ana declares and commits an attack (`active-player`); `attack.roll` hit then `damage.apply` batch on a goblin; `turn.advance` batch; `table-mode.changed` turn → turn (active: `ai:companion:bram`); a companion attack that the engine refuses (`action.resolved` `refused` with a refusal code); `encounter.end` batch; `table-mode.changed` turn → free | table mode after each mode event; encounter order, round and active combatant; goblin HP before and after in the ledger; the refused action's code (AC #3, AC #4, AC #6) |
| `secret-tracker` | a public scene; `tracker.changed` create and two advances (`dm`); one DM-only `dice.rolled` batch (a hidden stealth roll); one `journal.entry.added` with `dm` visibility; public talk | DM viewer: one tracker, filled 2 of 6, the hidden roll in the ledger, the DM journal entry; each player viewer: `trackers` is `[]`, and the serialized projections contain no tracker id, name or note, no hidden roll and no DM journal entry (AC #5) |
| `unknown-and-invalid` | valid talk; `weather.changed` (unknown type); `talk` at version 99; `talk` with an empty `text`; `hp.changed` whose `type` column disagrees with its envelope; a duplicate of an earlier `seq`; a `proposal.created` row (a future TASK-0045 type) | the fold returns; `skippedUnknownType` 2, `skippedUnknownVersion` 1, `skippedInvalid` 2, `outOfOrder` 1; the transcript holds only the valid talk (AC #8) |

The `unknown-and-invalid` fixture is the only one with invalid rows; `fixtures.test.ts` skips
the "every event validates" check for it and asserts the counters instead.

## Guarantees (each one has a test)

1. Every event in every fixture except `unknown-and-invalid` decodes as `known`.
2. Every fixture's `seq` values are strictly ascending from 1, except the deliberate duplicate
   in `unknown-and-invalid`.
3. For every recipe, running the engine's `execute` on the DM fold's `engine` state just
   before the batch, with `scriptedRng(faces)`, returns `ok: true`, consumes every face, and
   returns exactly the batch's engine events in order. A refused recipe (the companion attack)
   returns `ok: false` with the code the fixture's `action.resolved` records.
4. Every fact in the table above holds for the viewers listed.
5. Fixtures are plain data: importing them runs no engine call, reads no clock and needs no
   server.

> Extended by specs/029-proposal-gate/contracts/fixtures.md: the `dmUserId` identity, the `dm-approvals` and `commit-authority` fixtures, `proposalExamples`, and the retyped last row of `unknown-and-invalid`.
