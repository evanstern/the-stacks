# Contract: the scene seed (schema, loader, SRD combatants, the shipped seed)

Modules: `apps/server/src/dm/seed/schema.ts` (Zod), `apps/server/src/dm/seed/load.ts`
(loader), `apps/server/src/dm/seed/combatants.ts` (SRD → engine combatant). Data:
`apps/server/seeds/<seedId>.json`. The shipped seed is
[`../data/greyhollow-ford.seed.json`](../data/greyhollow-ford.seed.json); the implementer
copies it to `apps/server/seeds/greyhollow-ford.json` unchanged. AC #13.

The seed is a stand-in for codex entities (decision-0009). NPCs and characters follow A5's
three sections — `identity`, `portrayal`, `hooks` — so TASK-0056's content contracts and
TASK-0060's codex loading replace the loader, not the nodes.

## Schema

```ts
const Text = (max: number) => z.string().min(1).max(max);

export const SeedNpc = z.object({
  id: RefIdSchema,
  name: Text(100),
  identity: z.object({
    role: Text(100),
    srdMonsterId: z.string().min(1).nullable(),   // must exist in @the-stacks/srd when set
    combatant: RefIdSchema.nullable(),             // the encounter combatantId it fights as; when set, equals `id`
    aliases: z.array(Text(60)).max(6).default([]), // authored alternate names (spec 050)
  }),
  portrayal: z.object({ voice: Text(300), want: Text(300), detail: Text(300), appearance: Text(300) }),
  hooks: z.object({
    knows: z.array(Text(300)).max(8),
    secrets: z.array(Text(300)).max(8),
    relationships: z.array(z.object({ to: RefIdSchema, kind: Text(60) })).max(8),
  }),
});

export const SeedCharacter = z.object({
  characterId: RefIdSchema,
  name: Text(100),
  seat: z.enum(["human", "companion"]),
  identity: z.object({
    combatant: CombatantInitSchema,                // the engine's CombatantInit; id === characterId
    abilityMods: z.record(AbilitySchema, z.number().int().min(-5).max(10)),
    proficiencyBonus: z.number().int().min(2).max(6),
    saves: z.record(AbilitySchema, z.number().int().min(-5).max(15)),
    skills: z.record(z.string().min(1).max(40), z.number().int().min(-5).max(15)),
    attacks: z.array(z.object({
      name: Text(60),
      expression: z.string().min(1).max(200),       // parsed by the engine at load (D20 term required)
      damage: z.array(z.object({ dice: z.string().min(1).max(200), damageType: DamageTypeSchema })).min(1).max(4),
    })).max(6),
    spells: z.array(z.string().min(1)).max(20),    // SRD spell ids; must exist
  }),
  portrayal: SeedNpc.shape.portrayal,
  hooks: SeedNpc.shape.hooks,
});

export const SceneSeedSchema = z.object({
  v: z.literal(1),
  seedId: z.string().regex(/^[a-z0-9-]{1,64}$/),
  title: Text(200),
  license: z.object({ kind: z.enum(["original", "original-plus-srd", "srd"]), note: Text(500) }),
  goal: z.object({ statement: Text(500), success: Text(500), failure: Text(500) }),
  location: z.object({
    id: RefIdSchema, name: Text(200),
    identity: z.object({ features: z.array(Text(300)).min(1).max(8) }),
    portrayal: z.object({ mood: Text(300), senses: z.array(Text(200)).max(4) }),
    hooks: z.object({ secrets: z.array(Text(300)).max(8) }),
  }),
  beats: z.array(z.object({
    id: RefIdSchema,
    kind: z.enum(["exploration", "social", "combat"]),
    summary: Text(600),
    clues: z.array(z.object({
      text: Text(300),
      check: z.object({ ability: AbilitySchema, skill: z.string().min(1).max(40).nullable(),
                        dc: z.number().int().min(5).max(30) }).nullable(),
    })).max(8),
    npcIds: z.array(RefIdSchema).max(8),
    presence: z.record(RefIdSchema, ScenePresenceSchema), // one value per seed NPC (spec 050)
    encounterId: RefIdSchema.nullable(),
  })).min(1).max(12),
  npcs: z.array(SeedNpc).max(20),
  characters: z.array(SeedCharacter).min(1).max(6),
  encounters: z.array(z.object({
    id: RefIdSchema, name: Text(100),
    monsters: z.array(z.object({ combatantId: CombatantIdSchema, srdMonsterId: z.string().min(1),
                                 name: Text(100).nullable() })).min(1).max(12),
    terrain: Text(500), trigger: Text(300), morale: Text(300),
  })).max(6),
  trackers: z.array(z.object({
    trackerId: RefIdSchema, name: Text(100), segments: z.number().int().min(2).max(12),
    note: Text(500), advanceWhen: Text(300),
  })).max(6),
  opening: z.object({ framing: Text(800) }),
});
```

Amended by specs/033-director-robustness/contracts/rules-terms.md.

### Amended by specs/050-seed-npc-presence

Amended 2026-10-27 (TASK-0142, operator ruling OQ-1): "I accept the recommended defaults OQ-1
to OQ-6 (a), including the frozen 029 and 031 amendments". OQ-1 (a): a required
`beats[].presence` map per beat covers every seed NPC; `npcIds` stays and is cross-checked;
seed `v` stays 1. `beats[0]` is the opening beat: its `presence` is each NPC's value at scene
start.

Amended 2026-10-27 (TASK-0142, operator ruling OQ-5): OQ-5 (a): `identity.combatant`, when
set, equals the NPC `id` and names an encounter monster.

Amended 2026-10-27 (TASK-0142, operator ruling OQ-6): OQ-6 (a): optional `identity.aliases`,
at most 6 strings of 1-60 characters. Greyhollow: Wenna "the keeper", Pell "the boy", Snag
"the goblin leader".

Amended by specs/034-narration-quality/contracts/player-facing-context.md.

## Loader

```ts
export function loadSeed(seedId: string, dir?: string): SceneSeed;   // throws SeedError
export class SeedError extends Error { readonly issues: string[]; }
```

1. Resolve `<dir>/<seedId>.json`. The default `dir` is `apps/server/seeds`, resolved
   relative to the module (not the working directory).
2. Parse with `SceneSeedSchema`.
3. Cross-check, collecting every issue before throwing:
   - ids are unique within each list;
   - every `srdMonsterId` and spell id exists in `@the-stacks/srd`;
   - every beat's `npcIds` and `encounterId`, and every relationship `to`, resolve;
   - every character's `combatant.id` equals its `characterId`;
   - every attack `expression` parses with the engine's `parseDiceExpression` and has a
     plain d20 term; every damage `dice` parses;
   - exactly one character has `seat: "human"` (M2 seats one human, decision-0014);
   - every beat's `presence` keys equal the seed's NPC ids, and no `npcIds` entry is
     `absent` in the same beat's `presence`;
   - every NPC's `identity.combatant`, when set, equals the NPC `id` and names an encounter
     monster `combatantId`.
4. A failure throws `SeedError` listing every issue. The start route returns `400
   validation` with them.

## SRD combatants (code, no LLM)

`combatantFromSrd(monster: Monster, combatantId: string, name: string | null): CombatantInit`:

| CombatantInit field | From |
|---|---|
| `id` | `combatantId` |
| `name` | `name ?? monster.name` |
| `hp.max` | `monster.hp.average` |
| `zeroHpRule` | `"dies"` |
| `initiativeBonus` | `monster.initiative.mod` |
| `conModifier` | `monster.abilities.con.mod` |
| `ac` | `monster.ac` |
| `defenses` | `damageResistances`, `damageVulnerabilities`, `damageImmunities`, lower-cased and filtered to the engine's 13 damage types |

A snapshot test pins the mapping for `goblin-warrior` and `goblin-minion`.

## The shipped seed: "The Bell at Greyhollow Ford"

Original content plus SRD 5.2.1 monsters and spells (constitution VIII). Outline:

- **Goal.** Find who silenced the ferry bell and get the ferry crossing before full dark.
- **Location.** A ferry-house on stilts over a fast river, a cut bell rope, a reed marsh
  downriver.
- **Beat 1 — exploration (`ferry-house`).** Clawed tracks (Perception DC 12), a gnawed then
  cut rope with the clapper missing (Investigation DC 13), someone in the loft (Perception
  DC 14).
- **Beat 2 — social (`the-keeper`).** Wenna Marsh, the ferry keeper: clipped river talk,
  wants her ferry and her grandson back, counts in threes. Persuasion DC 12 gets the safe
  path; Insight DC 11 reveals her fear for Pell.
- **Beat 3 — fight (`reed-camp`).** Snag and one more Goblin Warrior, two Goblin Minions, on
  a mud island; Pell tied to a post. Morale: Snag bargains when two goblins fall.
- **Characters.** Tamsin Vale (the human's pregenerated fighter), Brother Odo (AI
  companion; warm, wants to bargain, argues with Kestrel), Kestrel (AI companion; dry,
  hates water, impatient).
- **Trackers (DM only).** `dusk` (4): full dark falls; `alarm` (3): the camp is alerted.

TASK-0048's demo plays this seed. Its scripted CI case scripts the same three beats.

Amended by specs/034-narration-quality/contracts/player-facing-context.md.

### Amended by specs/034-narration-quality

`contracts/player-facing-context.md` amends the shipped seed text. A player-facing field never
states a DM-only fact.

- `location.hooks.secrets[0]`: "The bell's ring drives off the river-things the goblins fear;
  they want the clapper for their own camp."
- `npcs[snag].portrayal.want`: "To keep the clapper and make the big-feet pay to cross his
  reeds."
- `npcs[snag].hooks.secrets`: append "He keeps the clapper because its ring keeps the
  river-things off his camp."
- `characters[odo].hooks.knows[0]`: "Goblins will bargain for anything that rings or shines."

### Amended by spec 072 (TASK-0164)

`characters[].identity` gains required `class` (1..40 chars) and `level` (1..20).

## Amended by specs/082-engine-derived-numbers (TASK-0104)

**Stats sources.** The engine combatant carries `stats` (the engine's `CombatantStats`), built by
code at `combatant.add`: a seed PC from its sheet (`statsFromCharacter`: `abilityMods`,
`proficiencyBonus`, `saves`, `skills` copied; each attack's `toHit` parsed from `1d20+N`, `range`
from the SRD weapon of the same name, damage dice as roll amounts; `spellcastingAbility` from the
SRD class record), a monster or pulled-in NPC from its SRD record (`statsFromSrd`; attack parts with
a `condition` are skipped; `spellcastingAbility` is null). The seed gains no field.

**Loader checks (FR-011).** `crossCheckSeed` also refuses: a character attack expression that is not
`1d20` plus or minus a number; a character attack whose name is no SRD weapon; a character
`identity.combatant` that already carries `stats`.

**Amended by spec 076 (TASK-0171).** `opening.premise` (1..500 chars) is required: why the party is
here. A seed without it fails `parseSeed` with an issue at `opening.premise`.

## Amended by specs/084-opposition-and-help (TASK-0128)

`statsFromSrd` also fills `stats.abilityScores` (all six, from the SRD monster record). `statsFromCharacter`
sets none: a seed sheet carries no scores, so an `influence` opposition against a PC refuses `STAT_UNDEFINED`.
`tableRules.groupChecks` has no behaviour yet: SRD 5.2.1 has no group-check rule (TASK-0232).

**Amendment (TASK-0247).** Amended 2026-11-13 (spec `specs/091-mud-stream-and-composer`, plan.md "Contract amendments"). Additive.

> "Approve all" (operator, C-AMD ruling, 2026-11-13: applies OQ-A1 to OQ-A15 of spec 091; OQ-A8 re-confirms R1 (a), ruled 2026-11-05, as the C-GATE ruling for the `SceneSchema` optional fields)

`location` gains `ways`: an array of `{ label, draft }`, max 6, default `[]`. Each `draft` parses as an Intent and refuses a hidden zone at seed load. `PlayerSeedView.location` gains `ways`.
