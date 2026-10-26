# Contract: player-facing context — what DM-only means and who gets what

Amends `specs/031-dm-runtime/contracts/scene-seed.md` (field classes, shipped seed text),
`nodes.md` ("narrate" inputs), `companions.md` (companion and chronicle inputs) and
`doctrine.md` (`villains-believe` example). Evidence: research.md R3, R4 (F76).

## Terms

- **Player-facing generator**: a model call whose output ships to players. These are
  `dm.narrate`, `dm.companion` and `dm.chronicle`. A chronicle `public` entry is player-facing.
- **DM-side generator**: `dm.director`, `dm.interpret`, `dm.adjudicate`, `dm.audit`. Their output
  never ships as prose.
- **DM-only seed fact**: the text of any field in the DM-only class below.

## Seed field classes

The schema does not change. Each field belongs to exactly one class.

| Field | Class |
|---|---|
| `title`, `goal.statement` | player-facing |
| `goal.success`, `goal.failure` | DM-only |
| `location.name`, `location.identity.features`, `location.portrayal.mood`, `location.portrayal.senses` | player-facing |
| `location.hooks.secrets` | DM-only |
| `opening.framing` | player-facing |
| `npcs[].name`, `identity.role`, `portrayal.voice`, `portrayal.want`, `portrayal.detail`, `portrayal.appearance` | player-facing |
| `npcs[].identity.srdMonsterId`, `identity.combatant` | DM-only (not prose) |
| `npcs[].hooks.knows`, `hooks.secrets`, `hooks.relationships` | DM-only |
| `characters[]` name, seat, `identity`, `portrayal`, `hooks.knows`, `hooks.relationships` | player-facing (the party's own sheets) |
| `characters[].hooks.secrets` | DM-only |
| `beats[]` (all fields), `encounters[]` (all fields), `trackers[]` (all fields) | DM-only |

**Authoring rule.** A player-facing field never states or implies a DM-only fact. An NPC's
`want` is the want the NPC shows through behaviour. The reason behind it, when hidden, lives in
`hooks.secrets`.

## The player-facing seed view

Add `apps/server/src/dm/seed/views.ts`:

```ts
export interface PlayerSeedView {
  seedId: string;
  title: string;
  goalStatement: string;
  location: { name: string; features: string[]; mood: string; senses: string[] };
  openingFraming: string;
  npcs: { id: string; name: string; role: string; voice: string; want: string;
          detail: string; appearance: string }[];
  characters: { characterId: string; name: string; seat: "human" | "companion";
                identity: SeedCharacterT["identity"];
                portrayal: SeedCharacterT["portrayal"];
                knows: string[]; relationships: { to: string; kind: string }[] }[];
}
export function playerFacingSeed(seed: SceneSeed): PlayerSeedView;
/** Every DM-only string in the seed, for tests. Non-empty strings only. */
export function dmOnlySeedText(seed: SceneSeed): string[];
```

`playerFacingSeed` copies only player-facing fields. It is pure.

## Who gets what

| Generator | Seed input | Transcript input |
|---|---|---|
| `dm.narrate` | `PlayerSeedView` only. `buildNarratePrompt` and `buildNarrationFacts` (`presentNpcs`) take the view, never `SceneSeed`. | Public entries, named (below) |
| `dm.companion` | `PlayerSeedView` only. Its own character's `knows` and `relationships`. Never another character's `knows`. | Public entries, named |
| `dm.chronicle` | Goal statement and tracker names (unchanged) | Public entries, named |
| `dm.director` | Full `SceneSeed` (unchanged) | Unchanged |
| `dm.interpret`, `dm.adjudicate` | Unchanged | Unchanged |
| `dm.audit` | No seed field. The facts' party roster and NPC names only. | None |

`projectionEntries` takes a structural type with `characters` (and `trackers` when
`withTrackers`), so the companion passes the view's characters.

The Director keeps the full seed. Its `goalNote` still reaches narrate (model text, not a seed
fact). Neither DM-side node gains secrets.

## Named, public transcript lines

`transcriptEntries(tail, roster?)` in `prompts/common.ts`:

- With a roster, it drops every entry whose `visibility` is not `public`.
- With a roster, it names the speaker. `action.declared` and `talk` use the party name for
  `characterId`. `action.commented` uses the party name for an `ai:companion:<id>` actor.
  `ai:dm` reads `the DM`. Any other actor reads `a player`. A user id never appears.
- Without a roster, the output is byte-identical to today (director and interpret).

The roster is `{ characterId, name, actor }[]`, built from `projections.party`.

Narrate, companion and chronicle pass the roster.

## Shipped seed edits (`apps/server/seeds/greyhollow-ford.json`)

| Field | Old | New |
|---|---|---|
| `location.hooks.secrets[0]` | "Goblins from the reed-camp took the bell's clapper; the bell's ring drives off the river-things they fear, and they want it for their own camp." | "The bell's ring drives off the river-things the goblins fear; they want the clapper for their own camp." |
| `npcs[snag].portrayal.want` | "To keep the clapper, because its ring keeps the river-things off his camp." | "To keep the clapper and make the big-feet pay to cross his reeds." |
| `npcs[snag].hooks.secrets` | `["He will trade the clapper for safe passage if two goblins fall."]` | Append "He keeps the clapper because its ring keeps the river-things off his camp." |
| `characters[odo].hooks.knows[0]` | "Goblins value noise-makers as wards." | "Goblins will bargain for anything that rings or shines." |

Update `scene-seed.md`'s shipped-seed section with "Amended by" and the same text.

## Doctrine example edit

In `apps/server/src/dm/doctrine/doctrine.ts`, set `villains-believe` `right` to
"The bandits hold the bridge because the lord's toll would starve their village." No doctrine
example names a person, place or fact of a shipped seed.

## Tests (card AC #1)

`apps/server/test/dm/player-facing-prompts.test.ts`, over the Greyhollow Ford seed:

1. Build every narrate prompt variant: scene start; a free-mode action beat on `the-keeper`; a
   `reed-camp` beat with an NPC turn; a clarify beat; a regenerate prompt with prior issues.
2. Build the companion prompt for `odo` and `kestrel`, active and not active.
3. Give the projections' transcript one `dm`-visibility talk entry holding a marker string.
4. Assert no prompt (system plus user) contains any string of `dmOnlySeedText(seed)`.
5. Assert no prompt matches `/river[- ]things?/i` or `/\bwards?\b/i`.
6. Assert no prompt contains the marker string or the seat's user id.
7. Assert each companion prompt holds its own `knows` and not the other companion's.

`apps/server/test/dm/seed.test.ts` adds: no player-facing field of the shipped seed matches
`/river[- ]things?/i` or `/\bwards?\b/i`.
