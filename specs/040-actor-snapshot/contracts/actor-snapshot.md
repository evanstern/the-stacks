# Contract: the actor snapshot

- **Card:** TASK-0140 (decision-0025 card U1).
- **Binding rules:** decision-0025 §1.1–§1.6 (the actor-state contract) and the §4 pipeline
  order. `docs/design/actor-state-gate.md` §4.1 item 1 and §5.3 U1.
- **Status:** binding for every Track C card that reads actor state: TASK-0141 (U2),
  TASK-0142 (U8), TASK-0143 (U3), TASK-0144 (U4), TASK-0145 (U5), TASK-0146 (U7),
  TASK-0147 (U9), and TASK-0112's plan gate (U6 criterion 3). A later card extends this
  contract by amending this file in its own PR. It never forks a second state view.
- **Module:** `apps/server/src/dm/snapshot/` (plan.md names the files).

## 1. Terms

- **Actor:** an entry in `ActorSnapshot.actors`. In U1 that is a party member, an engine
  combatant, or a seed NPC (decision-0025 "Terms").
- **S0:** the snapshot `assemble` builds before any model runs.
- **S1:** the snapshot `resolve` builds after its last gate write.
- **Diff:** the typed S0-to-S1 change list `resolve` returns beside S1.
- **View:** one rendering of a snapshot for one kind of reader: `dm`, `seat` or `fiction`.
- **Compressed line:** the one-line form of a dead or absent actor (§6).
- **Scene presence:** `present`, `yielded` or `absent` (decision-0025 "Terms"). It is not the
  player connection presence of decision-0024 (D16). That presence never enters this type.

## 2. The type

TypeScript, exported from `apps/server/src/dm/snapshot/types.ts`. The module imports types
only from `@the-stacks/dnd5e-engine` and `@the-stacks/session-model`, never a value. Narrate's
import closure includes it, and the narrate import-graph test forbids engine values and `gate/`.

```ts
export const SNAPSHOT_VERSION = 1;

export type ActorKind = "party" | "monster" | "npc";
export type ScenePresence = "present" | "yielded" | "absent";
export type LifeState = "conscious" | "unconscious" | "stable" | "dead";

export type ActorController =
  | { kind: "player"; userId: string }        // a human seat
  | { kind: "ai-companion"; actor: string }   // "ai:companion:<characterId>"
  | { kind: "dm" };                           // every monster and seed NPC

export interface ActorCondition {
  /** The engine condition instance id. The diff (§5) matches instances by it. */
  instanceId: string;
  condition: string;              // an engine ConditionKey
  level: number | null;           // exhaustion level, else null
  source: string;
  expiresAt: { round: number; combatantId: string; boundary: "turn-start" | "turn-end" } | null;
}

export interface ActorResources {
  deathSaves: { successes: number; failures: number };
  hitDice: { die: 6 | 8 | 10 | 12; total: number; remaining: number }[];
  spellSlots: { level: number; max: number; expended: number; pact: boolean }[];
}

/** The party sheet numbers the prompts carry today (seed `identity`). Null for non-party actors in U1. */
export interface ActorSheet {
  abilityMods: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>;
  proficiencyBonus: number;
  saves: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>;
  skills: Partial<Record<string, number>>;   // engine SkillSchema keys
  attacks: { name: string; expression: string; damage: { dice: string; damageType: string }[] }[];
  spells: string[];
}

export interface SnapshotActor {
  /** Stable actor id. Party: characterId. Seed NPC: the seed npc id. Other combatant: combatantId. */
  id: string;
  /** The engine combatant this actor is, or null when it has no tracked combatant. */
  combatantId: string | null;
  /** The party characterId, or null. */
  characterId: string | null;
  /** Display name: party name, seed NPC name, else the engine combatant name. */
  name: string;
  /** Code-derived match terms (§4). Always holds `name`. Deduped, case kept. */
  aliases: string[];
  kind: ActorKind;
  controller: ActorController;
  /** Null when combatantId is null. */
  hp: { current: number; max: number; temp: number } | null;
  /** Null when combatantId is null. */
  lifeState: LifeState | null;
  /** [] when combatantId is null. */
  conditions: ActorCondition[];
  ac: number | null;
  /** The encounter order total, or null outside the encounter order. */
  initiative: number | null;
  /** Null when combatantId is null. */
  resources: ActorResources | null;
  sheet: ActorSheet | null;
  /** U1: always "present". TASK-0141 (U2) reads it from the log; TASK-0142 (U8) seeds it per beat. */
  presence: ScenePresence;
}

export interface SnapshotStage {
  tableMode:
    | { mode: "free" }
    | {
        mode: "turn";
        /** The table-mode actor id as logged ("ai:dm", "ai:companion:<id>", a user id). */
        activeActor: string;
        /** The actor whose turn it is, resolved per §3 rule 6; null when none resolves. */
        activeActorId: string | null;
      };
  encounter: {
    round: number;
    activeCombatantId: string;
    /** The actor id of the active combatant, or null when it maps to no actor. */
    activeActorId: string | null;
    /** Actor ids in initiative order. */
    order: string[];
  } | null;
  scene: { sceneId: string; title: string; location: string | null } | null;
  /** DM state. The `fiction` and `seat` views never render it. */
  trackers: { trackerId: string; name: string; filled: number; segments: number }[];
}

export interface ActorSnapshot {
  v: typeof SNAPSHOT_VERSION;
  /** The projections' throughSeq the snapshot was built from. */
  throughSeq: number;
  /** The seed it was joined with, or null when built without one (§3 rule 8). */
  seedId: string | null;
  actors: SnapshotActor[];
  stage: SnapshotStage;
}
```

The snapshot is plain data: no functions, no class instances, JSON-serializable, and frozen
by convention (no consumer mutates it). It carries **no seed text except names**. No
portrayal, hook, secret, `advanceWhen`, trigger, morale or beat summary enters it, so a
player-facing prompt that renders it cannot leak a DM-only seed string
(`specs/034-narration-quality/contracts/player-facing-context.md`).

## 3. Build rules: `buildSnapshot(projections, seed)`

Signature: `buildSnapshot(projections: SessionProjections, seed: SceneSeed | null): ActorSnapshot`.
It is pure and deterministic: the same inputs give a deep-equal output. The projections are
the DM view.

1. **Party actors.** One actor per `projections.party` member, in party order. `id` and
   `characterId` are the characterId. `combatantId` is the member's combatantId. `controller`
   copies the member's controller. `sheet` copies the seed character's `identity` numbers
   (`abilityMods`, `proficiencyBonus`, `saves`, `skills`, `attacks`, `spells`) when the seed
   has that characterId, else null.
2. **Combatant state.** For an actor with a combatantId present in `projections.engine.combatants`:
   `hp`, `lifeState`, `conditions`, `ac`, `resources` (death saves, hit dice, spell slots with
   standard levels ascending and the pact slot last) copy the engine combatant. `initiative`
   copies the encounter order total, or null. A combatantId absent from engine state leaves
   every tracked field null (or `[]`).
3. **Seed NPCs.** One actor per seed NPC, in seed order, after the combatant actors. `id` is
   the npc id. `kind` is `npc`. `controller` is `{ kind: "dm" }`. When the NPC's
   `identity.combatant` names a combatant in engine state, the NPC and that combatant are
   **one actor**: the NPC id, `combatantId` set, state per rule 2. Its `name` is the NPC
   name; the engine name joins `aliases`.
4. **Other combatants.** Every engine combatant not claimed by rule 1 or rule 3 is one actor:
   `id` and `combatantId` are the combatant id, `kind` is `monster`, `controller` is
   `{ kind: "dm" }`, `name` is the engine name. A seed encounter monster's seed `name`, when
   set and different, joins `aliases`.
5. **Order.** Party actors; then the encounter-order actors not yet listed, in initiative
   order; then the remaining combatant actors by id ascending; then the seed NPC actors with no
   combatant, in seed order. Each actor appears exactly once.
6. **Stage.** `tableMode` copies the projection. Its `activeActorId` is the actor whose
   `characterId` equals `activeCharacterId`; else, when `activeActor` is `ai:dm` and an
   encounter runs, the actor of the encounter's active combatant; else the companion actor
   for `ai:companion:<id>`; else null. `encounter` maps the projection's order to actor ids.
   `scene` copies sceneId, title and location. `trackers` copies id, name, filled and
   segments, and nothing else.
7. **Presence.** Every actor's `presence` is `present` in U1.
   *Amended 2026-10-27 (TASK-0141, operator ruling OQ-4: "reuse UNKNOWN_COMBATANT with reason absent"):* `presence` comes from the
   `scenePresence` projection, keyed by actor `id` (party: character id; NPC: NPC id; monster:
   combatant id). An actor with no entry is `present`. An entry that matches no actor is ignored.
8. **No seed.** With `seed` null, rule 3 adds nothing, every `sheet` is null, and `seedId` is
   null. The chronicle builds this way when its seed fails to load.
9. **Id collision.** Two different actors with the same `id` throw
   `SnapshotBuildError` (code `ACTOR_ID_COLLISION`). The build never merges or drops one.

## 4. Aliases

`aliases` holds, deduped and in this order: the display name; the actor id when it differs
from the name; the combatant id when set and different; the given name for a multi-word name
(the first word after leading title words such as "Brother", "Sister", "Lord", using the same
title list as `partyNameTerms` in `nodes/audit.ts`); the engine name and the seed encounter
name per rules 3 and 4. The title list moves to `snapshot/aliases.ts`, and `partyNameTerms`
calls it. `partyNameTerms` output stays byte-identical, which the existing audit tests prove.

TASK-0142 (U8) may add seed-declared aliases. TASK-0143 (U3) matches prose against `aliases`.

## 5. The diff: `diffSnapshots(s0, s1)`

Signature: `diffSnapshots(s0: ActorSnapshot, s1: ActorSnapshot): SnapshotDiff`. Pure. Actors
are matched by `id`.

```ts
export type ActorChange =
  | { kind: "joined"; actorId: string }                       // in S1, not in S0
  | { kind: "left"; actorId: string; name: string }           // in S0, not in S1
  | { kind: "hp"; actorId: string; before: { current: number; temp: number }; after: { current: number; temp: number } }
  | { kind: "life-state"; actorId: string; before: LifeState | null; after: LifeState | null }
  | { kind: "condition"; actorId: string; op: "applied" | "removed"; condition: string }
  | { kind: "presence"; actorId: string; before: ScenePresence; after: ScenePresence }
  | { kind: "initiative"; actorId: string; before: number | null; after: number | null }
  | { kind: "resources"; actorId: string; before: ActorResources | null; after: ActorResources | null };

export type StageChange =
  | { kind: "table-mode"; before: "free" | "turn"; after: "free" | "turn" }
  | { kind: "active-actor"; before: string | null; after: string | null }
  | { kind: "encounter-started" }
  | { kind: "encounter-ended" }
  | { kind: "round"; before: number; after: number }
  | { kind: "tracker"; trackerId: string; before: number | null; after: number | null }
  | { kind: "scene"; before: string | null; after: string | null };   // sceneId

export interface SnapshotDiff {
  fromSeq: number;   // s0.throughSeq
  toSeq: number;     // s1.throughSeq
  actors: ActorChange[];   // actor order of S1, then left actors in S0 order
  stage: StageChange[];    // the order of the StageChange union above
}
```

- A condition change compares condition instances by `instanceId`. One applied and one
  removed instance of the same key give two entries.
- `hp` appears only when `current` or `temp` differs. A max-HP change alone gives no entry.
- `resources` appears when any resource field differs; it carries both whole values.
- Two identical snapshots give empty lists. `diffSnapshots(s, s)` is always empty.
- The diff is derived state. It is never logged and never sent to a client.

## 6. Rendering, the cap and compression

`renderSnapshot(snapshot, opts)` is total: it returns `{ ok: true; lines: string[] }` or
`{ ok: false; detail }` with the `SnapshotOverflowError` detail. `snapshotSection(label,
snapshot, opts)` returns the labelled prompt section (`## <label>\n<lines>`), or throws
`SnapshotOverflowError` on `ok: false`.

```ts
export type SnapshotView = "dm" | "seat" | "fiction";
export interface RenderOptions {
  view: SnapshotView;
  cap: number;                                 // estimateTokens budget for the whole section
  /** dm view only: tracker lines, each with its advance-when text from the full seed. */
  trackers?: { advanceWhen: ReadonlyMap<string, string> } | false;
  /** seat view only: the companion's own actor id (gets the full party line). */
  self?: string;
}
export class SnapshotOverflowError extends Error {
  readonly code = "SNAPSHOT_OVERFLOW";
  constructor(readonly detail: { view: SnapshotView; tokens: number; cap: number; actors: number; compressed: number });
}
```

### 6.1 Views and their readers

| View | Readers | What a full actor line carries |
|---|---|---|
| `dm` | `dm.director`, `dm.interpret`, `dm.adjudicate` | id, combatant id, name, kind, controller, HP (current/max, temp when not 0), AC, life state, conditions, initiative, death saves when not 0/0, hit dice, spell slots, sheet mods, proficiency, saves, skills, attacks; presence when not `present` |
| `seat` | `dm.companion` | Party actors: as `dm`. Other actors: id, name, kind, HP, life state, conditions, initiative. No AC, no resources, no sheet (parity with today's companion state) |
| `fiction` | `dm.narrate`, `dm.audit`, `dm.chronicle` | name, kind, controller for party ("human player" or "AI companion"), life state, conditions, presence. **No digit and no id.** |

Every view starts with stage lines: the table mode and active actor name; the encounter round,
active actor and order (the `fiction` view states only "a fight is on" and whose turn it is,
by name). Tracker lines exist only in the `dm` view and only when `trackers` is passed (the
Director). A `fiction` render of a snapshot whose names hold no digit holds no digit.

### 6.2 The cap (decision-0025 §1.6)

1. Render the stage lines and every actor's full line.
2. If the total exceeds `cap`, replace the line of every actor whose `lifeState` is `dead` or
   whose `presence` is `absent` with its compressed line:
   `dm`/`seat`: `<id> "<name>" (<kind>): dead` (or `absent`, or `dead, absent`);
   `fiction`: `<name> (<kind>): dead` (or `gone`).
3. If the total still exceeds `cap`, throw `SnapshotOverflowError`. Never drop a line. Never
   cut a line short. Stage lines are never compressed.
4. Every actor in the snapshot has exactly one line in the output, full or compressed.

Caps (in `prompts/common.ts` `CAPS`): `snapshotDm: 2000`, `snapshotSeat: 2000`,
`snapshotFiction: 800`. They replace `CAPS.projections` (800). The schema-maximum seed shape
(6 party members, 12 monsters in one encounter, 20 seed NPCs, all alive) MUST fit every view
uncompressed. Phase 1 measured the schema maximum: `dm` 1740 tokens, `seat` 1716 tokens,
`fiction` 448 tokens. The `seat` cap rose from 1600 to 2000 because 1716 exceeds 1600.

### 6.3 Failing loudly

- A turn node: `SnapshotOverflowError` propagates out of the prompt builder. The runner's
  `safeRun` maps it to `NodeError { kind: "state-overflow", message, detail }` with the error's
  detail and the node name, and logs `dm.node.state-overflow`. The turn fails through the
  existing failure path: `jobs.result` `TurnFailureResult`, and the DM failure notice.
  `NodeErrorKind` gains `"state-overflow"`.
- `dm.companion`: the play records `status: "error"` and logs `dm.companion.state-overflow`
  with the detail. No model call is made for that companion.
- `dm.chronicle`: the job writes nothing, returns `entries: 0`, and logs
  `dm.chronicle.failed` with `kind: "state-overflow"` and the detail.
- In no case does a model receive a snapshot section with a line missing.

## 7. Where each snapshot comes from

| Reader | Snapshot | Built by |
|---|---|---|
| director, interpret, adjudicate | S0 | `assemble` (`AssembleOutput.snapshot`) |
| narrate, audit (incl. audit's regenerate) | S1 | `resolve` (`ResolveOutput.snapshot`, `ResolveOutput.diff`) |
| companion | current state | the companion job, per companion, from the projections it already loads and the full seed |
| chronicle | state at the job's `throughSeq` | the chronicle job, from projections folded through `throughSeq` and the scene's seed |

`resolve` builds S1 from projections read after its last gate write, every run, including a
reclaim. On a reclaim, `assemble` rebuilds S0 from the log as it stands, so S0 already holds
rows the earlier attempt landed and the diff omits them. That is accepted in U1: NarrationFacts
still carries this turn's changes from the ledger rows.

## 8. What U1 renders where (replaces `projectionEntries` and `npcNames`)

| Prompt | Before | After (U1) |
|---|---|---|
| `dm.director` | `## State`: `projectionEntries(…, true)` | `## State`: S0, `dm` view, trackers with advance-when |
| `dm.interpret` | `## State`: `projectionEntries(…, false)` | `## State`: S0, `dm` view |
| `dm.adjudicate` | `## State`: `projectionEntries(…, false)` | `## State`: S0, `dm` view |
| `dm.narrate` | `## Party (player characters)` + `## Other characters (the world)` from `facts.party` / `facts.npcNames` | the same two headings, rendered from S1, `fiction` view: party actors, then every other actor |
| `dm.audit` | the same two sections | the same two sections from S1, `fiction` view |
| `dm.companion` | `## State`: `projectionEntries(…, false)` | `## State`: current snapshot, `seat` view |
| `dm.chronicle` | no state | `## State at the end of this transcript`: snapshot at `throughSeq`, `fiction` view |

`projectionEntries` and `NarrationFacts.npcNames` are deleted. `NarrationFacts.party` stays:
the audit's party-name blocking filter and the fallback read it, unchanged.

U1 renders no diff in any prompt. The diff is built, returned and tested here; TASK-0146 (U7)
renders it for `dm.audit`, and TASK-0143 (U3) and TASK-0147 (U9) read it in code.

## 9. Extension points for later cards

| Card | Extends |
|---|---|
| TASK-0141 (U2) | **Built** (spec 048, 2026-10-27): `presence` read from the logged presence event; `left`/`presence` diff entries from real changes |
| TASK-0142 (U8) | seed NPC initial presence per beat; seed-declared aliases; one identity across NPC and combatant (rule 3 is the U1 join) |
| TASK-0104 | monster stats on `sheet` (or a sibling field) so modifiers derive from the snapshot |
| TASK-0112 (U6) | **Built** (spec 046, 2026-10-27): the plan gate checks step actor and target ids against S0 actors' `combatantId`. TASK-0141 adds the `absent` reason (presence). **Built** (spec 048): `PlanFailureReason` gains `absent`; the verdict code stays `UNKNOWN_COMBATANT`. *Amended 2026-10-27 (TASK-0141, operator ruling OQ-4).* |
| TASK-0143 (U3), TASK-0144 (U4) | the claim checker keyed to `aliases`, reading S1 and the diff |
| TASK-0145 (U5) | `legalizeDirector` reads S0 actors (hostile = `kind` monster or a seed NPC in the active encounter) |
| TASK-0146 (U7) | the audit prompt renders the diff |
| TASK-0147 (U9) | the batch gate maps effect target ids to actors through `combatantId` |

Each extension amends this file. A new field is additive and keeps `SNAPSHOT_VERSION` at 1
unless a field changes meaning.
