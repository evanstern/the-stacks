# Data Model: SRD 5.2.1 baseline records

All shapes are Zod schemas in `packages/srd/src/schema/`. The TypeScript types are
`z.infer` of those schemas; there is no hand-written duplicate type. `contracts/records.md`
is the normative field list; this file explains the model and its rules.

## Shared pieces

### `SrdKind`

`"monster" | "spell" | "class" | "equipment" | "condition"`.

### `RecordId`

Kebab-case slug of the record's SRD name: lower case, ASCII letters and digits, single
hyphens, regex `^[a-z0-9]+(-[a-z0-9]+)*$`. Unique within its kind. Stable: an id never
changes once shipped, because prompts, events and imported-record layers (TASK-0064) refer
to it. Derivation: NFKD-normalize, drop diacritics, drop apostrophes, replace every other
non-alphanumeric run with one hyphen, trim hyphens. Collisions inside a kind fail conversion.

### `SourceRef` (AC #6)

| Field | Type | Rule |
|---|---|---|
| `document` | literal `"SRD 5.2.1"` | Always this value. |
| `section` | string, non-empty | The SRD heading the record sits under: `"Monsters A–Z"`, `"Animals"`, `"Spell Descriptions"`, a class name, `"Weapons"`, `"Armor"`, `"Adventuring Gear"`, `"Tools"`, `"Mounts and Vehicles"`, `"Rules Glossary"`, or for an embedded stat block the containing entry (for example `"Figurine of Wondrous Power"`). |
| `page` | integer 1–364 | The PDF page that holds the record's heading. |

### Page ranges per kind (AC #7)

| Kind | Pages | Note |
|---|---|---|
| monster | 254–364 | Plus 204–253 only for embedded stat blocks the index marks `embedded`. |
| spell | 107–175 | Spell Descriptions. |
| class | 28–82 | Classes chapter. |
| equipment | 89–103 | Equipment chapter. |
| condition | 176–191 | Rules Glossary. |

### `Text`

SRD prose kept as a string with paragraph breaks as `\n\n` and list items as lines starting
`- `. No HTML, no Markdown emphasis. Hyphenation artefacts from PDF line breaks are removed.

## Kinds

### Monster

One record per SRD stat block. Lycanthropes and the Vampire stay one record each; form
differences stay in their trait and action text.

- Identity: `id`, `name`, `size` (one or more of Tiny…Gargantuan; "Medium or Small" keeps
  both), `type` (Aberration…Undead), `tags` (for example `["Goblinoid"]`), `alignment` text.
- Defense: `ac` (number) with optional `acNote` (for example "natural armor"), `hp`
  `{ average, formula }` (`formula` is a dice expression such as `3d6` or `10d10 + 30`),
  `damageVulnerabilities`, `damageResistances`, `damageImmunities`, `conditionImmunities`
  (arrays of strings; qualified entries keep their qualifier text).
- Movement and senses: `speed` `{ walk, burrow?, climb?, fly?, swim?, hover? }` in feet,
  `senses` `{ blindsight?, darkvision?, tremorsense?, truesight?, passivePerception }`,
  `languages` text.
- Abilities: `abilities` `{ str, dex, con, int, wis, cha }`, each `{ score, mod, save }`. The
  2024 stat block prints the modifier and the save, so they are data, not computed.
- `initiative` `{ mod, score }`; `skills` (map skill → bonus); `gear` (names, optional).
- `cr` `{ rating: "0" | "1/8" | "1/4" | "1/2" | "1"…"30", xp, xpInLair? }`; `pb` (number).
- Blocks: `traits`, `actions`, `bonusActions`, `reactions` (arrays of `MonsterFeature`);
  `legendaryActions` `{ uses, usesInLair?, text, actions: MonsterFeature[] }` optional.
- `MonsterFeature`: `{ name, text, usage?, attack?, save? }`.
  - `usage` text such as "Recharge 5–6", "3/Day".
  - `attack` `{ type: "melee" | "ranged" | "melee-or-ranged", bonus, reach?, range?
    { normal, long? }, hit: DamagePart[] , hitText? }`.
  - `DamagePart`: `{ average, dice?, type, condition? }`. `dice` is null for flat damage
    ("1 Piercing"). `condition` holds the clause verbatim, for example "if the attack roll
    had Advantage".
  - `save` `{ ability, dc, onFail?, onSuccess? }` parsed from "Dexterity Saving Throw: DC 13".
- Rule: every feature whose text contains "Attack Roll:" has a parsed `attack`. Every feature
  whose text contains "Saving Throw: DC" has a parsed `save`. A test enforces both.
- Spellcasting monsters keep spell names as text inside the action; resolving them is the
  caller's job through the spell loader.

### Spell

- `id`, `name`, `level` (0–9; 0 is a cantrip), `school` (Abjuration…Transmutation),
  `classes` (class ids from the header line), `castingTime` text, `ritual` boolean,
  `reactionTrigger?` text, `range` text, `components` `{ v, s, m, material? }`,
  `concentration` boolean, `duration` text, `text`, `higherLevels?` text (the "Using a
  Higher-Level Spell Slot" or "Cantrip Upgrade" paragraph).

### Class

- `id`, `name`, `hitDie` (`d6`…`d12`), `primaryAbility` text, `savingThrows` (two ability
  keys), `skillChoices` `{ count, from: string[] }`, `weaponProficiencies`, `armorTraining`,
  `toolProficiencies` (arrays of text), `startingEquipment` text, `spellcastingAbility?`.
- `levels`: 20 rows `{ level, proficiencyBonus, features: string[], columns: Record<string,
  string> }`. `columns` holds the class-specific table columns verbatim (for example
  `"Rages": "2"`, `"Cantrips": "3"`, slot columns `"1": "2"`).
- `features`: `{ name, level, text }[]`.
- `subclass`: `{ id, name, text, features: { name, level, text }[] }` — the one SRD subclass.
- Option lists the SRD prints inside a class (Metamagic, Eldritch Invocations, the class
  spell list) are kept as features with their text; the class spell list is also derivable
  from `Spell.classes`.

### Equipment

Discriminated union on `category`:

- `weapon`: `weaponCategory` (`simple` | `martial`), `rangeType` (`melee` | `ranged`),
  `damage` `{ dice, type }` (flat damage keeps `dice: null` with `average`), `properties`
  (names, with `versatile?` dice, `range?` `{ normal, long }`, `thrown?`, `ammunition?` type),
  `mastery` (property name), `weight`, `cost`.
- `armor`: `armorCategory` (`light` | `medium` | `heavy` | `shield`), `ac` `{ base,
  addDex, dexMax? }` (shield: `{ bonus: 2 }`), `strength?`, `stealthDisadvantage`, `weight`,
  `cost`, `don` and `doff` text.
- `adventuring-gear` (includes ammunition, arcane/druidic/holy focuses and packs):
  `weight?`, `cost`, `text`.
- `tool`: `toolCategory` (`artisan` | `other` | `gaming-set` | `musical-instrument`),
  `ability`, `utilize` text, `craft?` names, `weight`, `cost`.
- `mount-or-vehicle`: `vehicleType` (`mount` | `tack` | `drawn` | `waterborne` |
  `airborne`), `cost`, `speed?`, `carryingCapacity?`, plus vehicle stats where printed.
- Common: `id`, `name`, `category`, `source`. `cost` `{ amount, unit: "cp" | "sp" | "ep" |
  "gp" | "pp" }`; `weight` in pounds (number) or null for "—".

### Condition

- `id`, `name`, `text` (the lead sentence), `effects`: `{ name, text }[]` — for example
  `{ name: "Can't See", text: "You can't see and automatically fail…" }`. Exhaustion keeps its
  level rule in its effect text.

## The SRD 5.2.1 index (provenance)

`packages/srd/provenance/srd-5.2.1-index.json`:

```json
{
  "document": "SRD 5.2.1",
  "pdfSha256": "8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87",
  "pdfUrl": "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf",
  "extractedAt": "<ISO date>",
  "kinds": {
    "monster": [{ "name": "Aboleth", "page": 258 }, { "name": "Giant Fly", "page": 0, "embedded": "Figurine of Wondrous Power" }],
    "spell": [], "class": [], "equipment": [], "condition": []
  }
}
```

(`page: 0` above is a placeholder in this example only; the shipped index holds real pages.)

## Provenance of the conversion

`packages/srd/provenance/source.json` records the upstream dataset (repository URL, commit
SHA, directory, license as declared), the converter version, and the conversion date. If
checkpoint C1 picks Candidate A, it records the PDF instead and names no dataset.

## State and lifecycle

Records are immutable package data. Nothing writes them at runtime. They change only by
re-running conversion and verification in a PR. The loader validates on first read per kind
and caches the parsed arrays plus two maps (`id → record`, normalized name → record).
