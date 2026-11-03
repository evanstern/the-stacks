# Contract: doctrine prompts and their attribution

Modules: `apps/server/src/dm/doctrine/doctrine.ts` (the pairs and the notice constant),
`apps/server/src/dm/doctrine/NOTICE.md` (the full MIT notice), `apps/server/src/dm/prompts/`
(one prompt builder per purpose). AC #14, decision-0021 idea 5.

## Source

tabletop-dm, <https://github.com/bradbushSFAI/tabletop-dm>, commit `fe2c29b`, files
`skills/tabletop-dm/SKILL.md` and `skills/tabletop-dm/reference/dm-style.md`. License: MIT.
Copyright line: `Copyright (c) 2026 Brad Bush`. The pairs below are adapted (reworded and
re-targeted at a pipeline of nodes), not copied. The notice applies anyway, because the
selection and structure are derived from the source.

## Attribution text

`doctrine.ts` exports, and its file header repeats:

```ts
export const DOCTRINE_NOTICE =
  "DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, " +
  "commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. " +
  "See apps/server/src/dm/doctrine/NOTICE.md.";
```

`NOTICE.md` holds that sentence, then the complete MIT License text with the copyright line
`Copyright (c) 2026 Brad Bush`, exactly as the source's `LICENSE` file states it at
`fe2c29b`.

Guard test (`test/dm/doctrine.test.ts`):

1. `NOTICE.md` exists, names tabletop-dm, the commit, `Copyright (c) 2026 Brad Bush`, and
   holds the MIT permission paragraph and warranty disclaimer.
2. `doctrine.ts` exports `DOCTRINE_NOTICE` with the text above, and its source header holds
   the same sentence.
3. Every module under `dm/prompts/` that imports a doctrine pair also holds the notice
   sentence in its header comment.
4. The container image ships `dist`, so `DOCTRINE_NOTICE` ships as a string constant with the
   code; `NOTICE.md` is copied beside `dist/dm/doctrine/` by the build (plan: Dockerfile).

The notice is not sent to models. It costs no prompt tokens.

## Pair format

```ts
export interface DoctrinePair {
  id: string;                       // stable, e.g. "end-on-demand"
  topic: string;
  rule: string;                     // one sentence
  wrong: string;                    // a short wrong example
  right: string;                    // a short right example
  nodes: ("director" | "narrate" | "audit" | "interpret" | "companion" | "chronicle")[];
}
export const DOCTRINE: readonly DoctrinePair[];
```

A prompt builder renders the pairs for its node as `Rule / Wrong / Right` lines, under the
token cap in [nodes.md](nodes.md).

## The pairs (adapted)

| id | Rule | Wrong | Right | Nodes |
|---|---|---|---|---|
| `short-turns` | Keep each turn near one hundred words; never past one hundred fifty. | A long block that narrates three things at once. | One clear moment, trimmed. | narrate, audit |
| `end-on-demand` | End on something that demands a response. | "The hall is quiet. What do you do?" | "Above you, the rope creaks — someone is climbing down." | narrate, audit |
| `no-menus` | Never hand the player a list or an either-or. | "Do you fight, or flee?" | Leave the choice unwritten; let the player phrase it. | narrate, audit, companion |
| `stop-at-choice` | Stop where the player must decide. | Narrating the hero through the door and into the room. | Describe what the door reveals, then stop. | narrate, audit |
| `plain-prose` | Keep the story in plain prose; numbers live on their own lines. | Headings, bullets or bold inside the story. | Prose, then the dice lines the code writes. | narrate, audit |
| `hero-is-theirs` | Never decide the hero's words, choices or chosen feelings; the dice may decide a reflex. | "You nod and step back, afraid." | "The club catches you square; you stagger back a step." | narrate, audit, companion |
| `world-not-hero` | Narrate what the world did to the attempt, not the hero's inner state. | "You panic and lose your grip." | "A link in the chain gives, and the floor rushes up." | narrate, audit |
| `blame-the-situation` | A failed roll is the world's doing, not the hero's incompetence. | "You fumble like a fool." | "The ledge crumbles under your boot." | narrate |
| `roll-when-uncertain` | Roll only when the outcome is uncertain and failure is interesting. | Calling for a check to open an unlocked door. | Narrate the certain outcome; save rolls for risk. | interpret, director |
| `fail-forward` | A failure creates a new problem; it never stalls the scene. | "You fail. Nothing happens." | "The lock holds, and the guard's lantern swings your way." | narrate, interpret |
| `trying-costs` | Trying costs something: time, noise, a tracker segment. | Free retries until success. | Each retry advances a clock. | director, interpret |
| `ask-when-unclear` | When intent is unclear, ask one short question. | Guessing and running with it. | "Over the wall, or through the gate?" — then stop. | interpret |
| `yes-and` | Treat a creative plan as an opportunity; set a DC rather than refuse. | A flat "no". | "Possible — Strength (Athletics), and the rope is wet." | interpret, director |
| `npc-voice` | Every named NPC has a voice, a want and one concrete detail. | Interchangeable townsfolk. | A ferry keeper who counts everything in threes. | narrate, companion |
| `companion-opinions` | Companions hold opinions and sometimes disagree, about once per scene. | Companions who only hand out hints. | "We should not trust her, and I'll say it twice." | companion |
| `villains-believe` | Antagonists have reasons and believe them. | Evil for its own sake. | The goblins want the bell because its ring scares off river things. | director, narrate |
| `one-sense` | Give one vivid detail beyond sight per scene. | Piled-on adjectives. | The tang of wet iron. | narrate |
| `world-moves` | The world moves on its own; show consequences. | A frozen world between beats. | Dusk thickens; the river rises a hand's width. | director |
| `dice-stand` | Never change a result; soften hard outcomes through the story, at a cost. | A stranger appears to save the hero for free. | An existing thread offers rescue, with a price. | director, narrate |
| `warn-before-lethal` | Signal danger before a deadly choice. | Sudden death from nowhere. | Bones and a warning carved in the post. | director, narrate |
| `numbers-from-state` | Every number comes from the game state, never from memory. | Recalling HP from earlier chat. | Read the facts; write no digits in prose. | narrate, audit |
| `one-clue` | Reveal the hidden truth slowly. | Explaining the whole mystery at once. | At most one real clue per beat. | director |
| `content-pg13` | Default content level: adventure violence, brief gore, no sexual content, no detailed cruelty. | Lingering on gore or cruelty. | Keep injury brief and move on. | narrate, audit, companion |
| `brief-rulings` | Rule in one line, then return to the scene. | A rules lecture inside the story. | One-line ruling in the journal; the story continues. | narrate, interpret |

Amended by specs/034-narration-quality/contracts/player-facing-context.md.

The table is the content of `DOCTRINE`; the implementer may tighten wording but keeps every
`id`, rule and node mapping. A changed pair is a reviewed diff to this table and the code
together.

## The agency rule (spec 074)

`doctrine.ts` also exports `AGENCY_RULE` (four shared lines) and `agencyRule(node)` (the shared
lines plus one node line, for `director`, `interpret`, `narrate`, `audit`, `auditor`). Each node
renders it outside the doctrine cap, so a cap never drops it. The `hero-is-theirs` row above covers
every party member, AI companions included.
