# Contract: Intent schema v1

**Status**: FROZEN 2026-11-08 at CP-4 (decision-0030). `INTENT_SCHEMA_VERSION = 1`,
`INTENT_SCHEMA_MINOR = 0`. Change only per §10 Versioning.
**Package**: `@the-stacks/intent` (`packages/intent`). Runtime dependency: `zod` only.
**Sources**: target-architecture §2, §3, §6, §8; constitution 3.0.0 II; P-04, P-08, P-09.

Notation is Zod-like. `?` marks an optional field. `= x` marks a default. Every object is
strict: an unknown key is a schema failure.

---

## 1. Shared scalars

| Name | Definition | Note |
|---|---|---|
| `Id` | `string /^[a-z0-9][a-z0-9_.:-]{0,63}$/` | Same regex as session-model `RefIdSchema` and engine `CombatantIdSchema`. |
| `IntentId` | `Id` | Minted by the producer. The gate refuses a reused id (`INTENT_EXISTS`). |
| `Body` | `string, 1..4000, trimmed` | Speech and prose payload. |
| `Note` | `string, 1..500` | Trailing flavour text on a mechanical kind. |
| `Slug` | `string /^[a-z0-9]+(-[a-z0-9]+)*$/, 1..60` | Spell ids, option ids, choice values. |
| `Label` | `string, 1..60` | An attack entry name, for example `Light Crossbow`. |
| `Dice` | `string, 1..200` | A dice expression. The engine validates it. |
| `Ability` | `"str" \| "dex" \| "con" \| "int" \| "wis" \| "cha"` | Copy of engine `AbilitySchema`. |
| `Skill` | the 18 engine skill keys | Copy of engine `SkillSchema`. |
| `Difficulty` | `"very-easy" \| "easy" \| "medium" \| "hard" \| "very-hard" \| "nearly-impossible"` | Copy of engine `DifficultySchema`. |
| `DamageType` | the 13 engine damage types | Copy of engine `DamageTypeSchema`. |
| `Condition` | the 15 engine condition keys | Copy of engine `ConditionKeySchema`, `exhaustion` included. |
| `RollMode` | `"normal" \| "advantage" \| "disadvantage"` | Copy of the engine `RollMode`. |
| `Dc` | `int 1..40` | |
| `Amount` | `{ kind: "fixed", value: int 0..10000 } \| { kind: "roll", expression: Dice }` | Copy of engine `AmountSchema`. |

The package copies engine enums by value, because it depends on `zod` only. A conformance
test (devDependency on the engine, test code only) fails when a copy drifts from the engine.

## 2. Envelope

```ts
Intent = {
  id: IntentId,
  kind: IntentKind,               // §6
  actor: ActorRef,                // §3
  channel?: Channel,              // §4; fixed by kind where §6 says so
  targets: TargetRef[] = [],      // §5; max 12; arity per kind in §6
  params: <per-kind schema> = {}, // §6
  text?: Body,                    // speech body, or the player's own words on a mechanical kind
  source: Source,
  commit: Commit,
}
Source = "composer" | "bar" | "sheet" | "map" | "tracker" | "console" | "ai" | "adapter"
Commit = "draft" | "declared" | "confirmed"
```

- `IntentSchema` is a discriminated union on `kind`. Each member fixes its own `params`,
  `targets` arity, `channel` rule and `text` rule.
- The envelope carries no version and no timestamp. The carrier (gate frame, event payload)
  carries `INTENT_SCHEMA_VERSION`. The server stamps time.
- The envelope carries no user id. The gate binds the authenticated principal to the
  Intent and checks it against `actor` (§3).
- `text` is required on speech, meta, `attempt`, `narrate`, `npc_say` and `bookmark`. It is
  optional on every other kind. There it keeps the player's words, for example
  `I shove the goblin off the ledge` on a `shove`.

## 3. ActorRef

```ts
ActorRef =
  | { kind: "pc", id: Id }         // a player character
  | { kind: "companion", id: Id }  // an AI-controlled party character (today "ai:companion:<id>")
  | { kind: "npc", id: Id }        // an NPC or monster, voiced or driven by a DM seat
  | { kind: "dm" }                 // the human DM seat
  | { kind: "ai:dm" }              // the AI DM seat
```

`actor` is the in-fiction doer or speaker. The seat is the principal the gate authenticates.

| Seat (principal) | May set `actor` to |
|---|---|
| Player | `pc` they control |
| AI companion | `companion` it is |
| Human DM | `dm`, any `npc` |
| AI DM | `ai:dm`, any `npc` |
| Adapter | what its scoped token's seat allows |

A mismatch is refused `NOT_YOUR_ACTOR`. A seat column in §6 limits each kind further.

## 4. Channel

```ts
Channel =
  | { kind: "scene" }                       // everyone in the scene; NPCs hear
  | { kind: "to", id: Id }                  // scene, addressed to one actor; that actor answers
  | { kind: "dm" }                          // the DM seat only
  | { kind: "party" }                       // players and the DM; NPCs and the narrator never hear
  | { kind: "whisper", to: Recipient[] }    // only the listed recipients; 1..8
Recipient = { kind: "pc", id: Id } | { kind: "dm" }
```

- A kind with a fixed channel (§6) MUST carry that channel or omit it. Omitted, the schema
  fills it. Any other value is refused `INTENT_CHANNEL_MISMATCH`.
- `party` and `whisper` content MUST NOT reach an NPC voice or narration prompt. The server
  enforces this filter. A prompt instruction does not count.

## 5. TargetRef

```ts
TargetRef =
  | { kind: "actor",  id: Id }             // a pc, companion, npc or monster, in an encounter or not
  | { kind: "entity", id: Id }             // a non-actor scene thing: object, feature, door, clue
  | { kind: "item",   id: Id }             // an item a character holds or the scene holds
  | { kind: "zone",   id: Id }             // a zone (room, area or feature zone; target-architecture §3)
  | { kind: "square", x: int 0..999, y: int 0..999 }       // a grid square; maps only
  | { kind: "point",  x: number 0..4995, y: number 0..4995 } // feet from the grid origin; maps only
```

The planner resolves a reference against the projection. An unknown or unseen reference
is a planner refusal (§9), never a schema failure.

## 6. Kinds

57 kinds in 13 groups. Columns:

- **Seats**: P player, C AI companion, D human DM, A AI DM. `npc` actors need D or A.
- **Ch.**: fixed channel, or `—` when the kind carries none.
- **Tgt**: target arity and allowed kinds.
- **Mut.**: mutates game state. **Res.**: resolved by.
- **Engine**: `served` (an `EngineCommand` exists), `partial`, `gap → <card>` (no command yet;
  the planner refuses `KIND_UNSERVED` until the card lands), or `n/a` (no engine path by design).

### 6.1 Speech (3)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `say` | `{}`; `text` required | P C | `scene` | 0 | No | DM runtime (react) | n/a |
| `say_to` | `{}`; `text` required | P C | `to:<target>` | 1 actor | No | DM runtime (react) | n/a |
| `emote` | `{}`; `text` required | P C | `scene` | 0 | No | DM runtime (react) | n/a |

### 6.2 Meta (4)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `ask_dm` | `{}`; `text` required | P | `dm` | 0 | Never | read-only answer | n/a |
| `ooc` | `{}`; `text` required | P D | `party` | 0 | Never | none | n/a |
| `party` | `{}`; `text` required | P C | `party` | 0 | Never | none | n/a |
| `whisper` | `{}`; `text` required | P D A | `whisper` (recipients required) | 0 | Never | none | n/a |

### 6.3 Deed (1)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `attempt` | `{ scope: "character" \| "party" = "character" }`; `text` required | P C D A | `scene` | 0..4 any | Via ruling | ruling → planner | n/a (planner) |

### 6.4 Check (3)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `check` | `{ skill?: Skill, ability?: Ability, mode: RollMode = "normal", dc?: Dc, difficulty?: Difficulty }` — at least one of `skill`, `ability`; at most one of `dc`, `difficulty` | P C D A | — | 0..1 actor/entity/zone | Yes | planner + engine; no DC → `needs_ruling` | served (`check.roll`) |
| `save` | `{ ability: Ability, mode = "normal", dc?: Dc, difficulty?: Difficulty }` — at most one of `dc`, `difficulty` | P C D A | — | 0 | Yes | planner + engine | served (`check.roll` saving-throw) |
| `contest` | `{ skill?: Skill, ability?: Ability, opposed?: Skill \| Ability, mode = "normal" }` — at least one of `skill`, `ability` | P C D A | — | 1 actor | Yes | planner + engine | partial: two opposition rules (`unarmed-strike`, `influence`); others → `needs_ruling` |

### 6.5 Combat action (12)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `attack` | `{ weapon: Label \| "unarmed", mode = "normal" }` | P C D A | — | 1 actor/entity | Yes | planner + engine | served (`attack.roll` by entry); entity targets → N-06 |
| `cast` | `{ spell: Slug, slot?: int 1..9, mode = "normal" }` | P C D A | — | 0..12 actor, or 1 zone/point | Yes | planner + engine | partial: 6 SRD spells, one actor target; area → TASK-0227 |
| `dash` | `{}` | P C D A | — | 0 | Yes | planner + engine + space | gap → N-05/N-09 (movement budget) |
| `dodge` | `{}` | P C D A | — | 0 | Yes | planner + engine | gap → N-09 (no dodging state) |
| `disengage` | `{}` | P C D A | — | 0 | Yes | planner + engine | gap → N-05 (OA suppression) |
| `help` | `{ assist: { kind: "check", skill: Skill } \| { kind: "attack" } }` | P C D A | — | 1 actor (ally for check, enemy for attack) | Yes | planner + engine | served (`help.grant`) |
| `hide` | `{}` | P C D A | — | 0 | Yes | planner + engine | partial: Stealth check served; hidden state → N-06/N-26 |
| `ready` | `{ trigger: string 1..200, then: Readyable }` | P C D A | — | 0 | Yes | planner + engine | gap → N-11 (trigger state) |
| `search` | `{ skill: "perception" \| "investigation" = "perception" }` | P C D A | — | 0..1 zone/entity | Yes | planner + engine | served (`check.roll`) |
| `use_object` | `{}`; `text` describes the use | P C D A | — | 1 entity | Yes | ruling → planner | n/a (ruling) |
| `grapple` | `{}` | P C D A | — | 1 actor | Yes | planner + engine | served (`unarmed-strike` opposition + `condition.apply grappled`) |
| `shove` | `{ effect: "prone" \| "push" }` | P C D A | — | 1 actor | Yes | planner + engine | partial: `prone` served; `push` → N-05 |

`Readyable` is a nested Intent body `{ kind, targets, params }` with no envelope. Its `kind`
is one of `attack`, `cast`, `dash`, `dodge`, `disengage`, `help`, `hide`, `search`,
`use_object`, `grapple`, `shove`, `move`. A nested `ready` is refused.

### 6.6 Movement (3)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `move` | `{}` | P C D A | — | 1 zone, or 1..60 squares (a path) | Yes | planner + engine + space | gap → N-05 (`move` command) |
| `stand` | `{}` | P C D A | — | 0 | Yes | planner + engine | partial: `condition.remove prone` served; half-speed cost → N-05 |
| `drop_prone` | `{}` | P C D A | — | 0 | Yes | planner + engine | served (`condition.apply prone`) |

### 6.7 Reaction (1)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `react` | `{ promptId: Id, choice: Slug }` | P C D A | — | 0 | Yes | engine | partial: opportunity attack served (`attack.roll reaction`); prompts, Shield, Counterspell → N-11 |

### 6.8 Turn control (3)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `end_turn` | `{}` | P C D A | — | 0 | Yes | engine | served (`turn.advance`) |
| `predeclare` | `{ then: Predeclarable }` | P C | — | 0 | Yes (queues) | gate holds; engine on the actor's turn | n/a (gate) → N-10 |
| `delay` | `{}` | P C D A | — | 0 | Yes | engine | gap: not in SRD 5.2.1; house rule only (open question Q5) |

`Predeclarable` is a nested Intent body like `Readyable`. Its `kind` is any Combat action,
Movement, Resource or Check kind. A nested `predeclare` is refused.

### 6.9 Resource (7)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `use_item` | `{}` | P C D A | — | 1 item, then 0..1 actor | Yes | planner + engine | gap → N-17 (no inventory in the engine) |
| `give` | `{}` | P C D A | — | 1 item, then 1 actor | Yes | planner + engine | gap → N-17 |
| `equip` | `{ off: boolean = false }` | P C D A | — | 1 item | Yes | planner + engine | gap → N-17 |
| `drop` | `{}` | P C D A | — | 1 item | Yes | planner + engine | gap → N-17 |
| `rest_short` | `{ spend: { die: 6\|8\|10\|12, count: int 1..20 }[] = [] }` (max 4) | P C D A | — | 0 | Yes | planner + engine | served (`rest.short`) |
| `rest_long` | `{}` | P C D A | — | 0 | Yes | planner + engine | served (`rest.long`) |
| `concentration_drop` | `{}` | P C D A | — | 0 | Yes | planner + engine | gap → TASK-0227 (no concentration state) |

### 6.10 Roll answer (2)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `roll` | `{ requestId: Id }` | P C D A | — | 0 | Only if requested | engine | served (`check.roll`, `death-save.roll`, `initiative.join`) |
| `roll_free` | `{ expression: Dice, reason?: Note }` | P C D A | `scene` or `dm` | 0 | No | engine | served (`roll`) |

### 6.11 Advancement (1)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `level_choice` | `{ choiceId: Id, option: Slug }` | P D | — | 0 | Yes (sheet) | engine + codex | gap → N-18 |

### 6.12 DM control (14)

All DM control kinds require seat D or A. A player emitting one is refused `DM_SEAT_REQUIRED`.

| Kind | Params | Ch. | Tgt | Res. | Engine |
|---|---|---|---|---|---|
| `narrate` | `{}`; `text` required | `scene` | 0 | gate (prose row) | n/a |
| `npc_say` | `{}`; `text` required; `actor` MUST be `npc` | `scene` or `to:<target>` | 0..1 actor (addressee) | gate (talk row) | n/a |
| `request_roll` | `{ roll: RollAsk, mode = "normal", dc?: Dc, difficulty?: Difficulty, secret: boolean = false }` | — | 1..8 actor | gate (roll-request row) → `roll` | gap → N-11 (request event) |
| `set_dc` | `{ for: Id, dc?: Dc, difficulty?: Difficulty }` — exactly one of `dc`, `difficulty` | — | 0 | gate → planner rerun | n/a (ruling input) |
| `apply_damage` | `{ amount: Amount, damageType: DamageType, critical: boolean = false }` | — | 1..8 actor | engine | served (`damage.apply`) |
| `apply_heal` | `{ amount: Amount, temp: boolean = false }` | — | 1..8 actor | engine | served (`healing.apply`, `temp-hp.grant`) |
| `apply_condition` | `{ op: "add" \| "remove", condition: Condition, until?: { round: int ≥1, actor: Id, boundary: "turn-start" \| "turn-end" } }` | — | 1..8 actor | engine | served (`condition.apply/remove`; `exhaustion` → `exhaustion.adjust ±1`) |
| `start_combat` | `{}` | — | 0..20 actor (none = everyone present) | engine | served (`initiative.roll`) |
| `end_combat` | `{}` | — | 0 | engine | served (`encounter.end`) |
| `add_combatant` | `{ from: Id, count: int 1..12 = 1 }` (`from` is `srd:<monster>` or an entity id) | — | 0..1 zone | planner + engine | partial: `combatant.add` served; stat-block lookup from `from` → N-02; zone → N-05 |
| `move_token` | `{}` | — | 1 actor, then 1 zone or 1..60 squares | planner + engine + space | gap → N-05 |
| `reveal` | `{ to: "party" \| Id[] (pc ids, 1..8), block?: Id, field?: Slug }` | — | 1 entity/zone/item | gate (`info.revealed`) | n/a → N-23 (event) |
| `ruling` | `{ requestId: Id, decision: "accept" \| "reject" \| "amend", dc?: Dc, difficulty?: Difficulty, amend?: IntentBody, reason?: Note }` — `amend` iff decision `amend` | — | 0 | gate → planner rerun | n/a |
| `pause` | `{ state: "on" \| "off" = "on" }` | — | 0 | gate (table state) | n/a |

`RollAsk = { kind: "check", skill?: Skill, ability?: Ability } | { kind: "save", ability: Ability } | { kind: "death-save" } | { kind: "initiative" }`.
`IntentBody` is a nested `{ kind, targets, params, text? }` with no envelope. Its `kind` MAY be any kind except `ruling` (no nested rulings) and `whisper` (a body has no channel). *Clarified 2026-11-08 at C-CON (operator); v1.0 unchanged.*

**Model numbers (constitution VI).** An `ai:dm` Intent MUST NOT carry a literal number the
model chose. The schema refuses, with `MODEL_NUMBER`, an `ai:dm` actor on: `set_dc` or
`ruling` with `dc`; `apply_damage` or `apply_heal` with `amount.kind = "fixed"`;
`request_roll` with `dc`. The AI DM uses `difficulty` tiers and dice expressions from stat
entries. A human DM may write any number.

### 6.13 Session (3)

| Kind | Params | Seats | Ch. | Tgt | Mut. | Res. | Engine |
|---|---|---|---|---|---|---|---|
| `bookmark` | `{}`; `text` is the label | P D | — | 0 | No | DM runtime | n/a |
| `recap` | `{}` | P D | — | 0 | No | DM runtime | n/a |
| `retry_narration` | `{ narrationId?: Id }` | P (solo table only) | — | 0 | No | DM runtime (flavour only; never re-rolls) | n/a |

## 7. Commit states

```
          send (exploration)           confirm (👍, or DM confirms)
 draft ─────────────────────▶ declared ─────────────────────────▶ confirmed ──▶ planner
   │  send (combat, active actor, Enter)                                    ▲
   └────────────────────────────────────────────────────────────────────────┘
 draft ──▶ (discarded; never leaves the client)
 declared ──▶ withdrawn (by the declarer or a DM seat; a carrier event, not a commit value)
```

1. `draft` exists only in the client. The gate refuses a `draft` with `DRAFT_NOT_ACCEPTED`.
2. A producer sends `declared` or `confirmed`.
3. In exploration and social play, a mechanical kind is sent `declared`. The DM may ask for a 👍
   (P-04). A confirm request moves it to `confirmed`.
4. In combat, the active actor's Enter sends `confirmed` directly (P-04).
5. Speech, meta, and session kinds skip the ring. The gate treats `declared` and `confirmed`
   the same for them.
6. DM control kinds are sent `confirmed`.
7. A `confirmed` Intent is final. A change is a new Intent with a new id.
8. Outcomes (applied, refused, needs ruling, withdrawn) live in carrier events. They are not
   commit values.

## 8. Text form

Every Intent has one canonical text. `toText(intent) → string`.
`parse(text, ctx) → { ok: true, intent } | { ok: false, refusal: ParseRefusal }`.

```ts
ParseContext = {
  id: IntentId, actor: ActorRef, source: Source, commit: Commit,
  resolve?: (name: string) => TargetRef | null   // optional name → ref lookup; pure
}
```

### 8.1 Tokens

| Token | Meaning | Example |
|---|---|---|
| `/verb` | kind verb; case-insensitive | `/attack` |
| `@id` | `actor` target | `@goblin-2` |
| `&id` | `entity` target | `&lever` |
| `$id` | `item` target | `$potion-of-healing` |
| `#id` | `zone` target | `#ledge` |
| `sq:x,y` | `square` target | `sq:12,7` |
| `pt:x,y` | `point` target | `pt:62.5,35` |
| `key=value` | named param | `dc=15`, `slot=2`, `diff=hard` |
| `+flag` | boolean param, or a roll mode | `+adv`, `+dis`, `+crit`, `+temp`, `+off`, `+secret`, `+party` |
| `"…"` | quoted value; `\"` and `\\` escape | `with "light crossbow"` |
| ` -- ` | the rest is `text` (the player's words) | `/shove @goblin-1 prone -- off the ledge` |
| `/as @id ` | actor prefix; DM seats only; sets `actor` to `npc` | `/as @goblin-2 /attack @thorin with scimitar` |

### 8.2 Grammar per kind (canonical form first; aliases parse but are never emitted)

| Kind | Canonical text | Aliases |
|---|---|---|
| `say` | `<text>` (plain); `/say <text>` when the text starts with `/ @ & $ # ( * "` | `"<text>"` |
| `say_to` | `@<id> <text>` | — |
| `emote` | `/me <text>` | `*<text>*` |
| `ask_dm` | `@dm <text>` | — |
| `ooc` | `((<text>))` | `/ooc <text>` |
| `party` | `/p <text>` | — |
| `whisper` | `/w @<id>[,@<id>…] <text>`; the DM recipient is `@dm` | — |
| `attempt` | `/do <text>`; `/do +party <text>` for party scope | — |
| `check` | `/check <skill\|ability> [<target>] [dc=N\|diff=T] [+adv\|+dis] [ability=A]` | — |
| `save` | `/save <ability> [dc=N\|diff=T] [+adv\|+dis]` | — |
| `contest` | `/contest <skill\|ability> @<id> [vs <skill\|ability>] [+adv\|+dis]` | — |
| `attack` | `/attack <target> with <weapon> [+adv\|+dis]` | `/attack <weapon> <target>` |
| `cast` | `/cast <spell> [<targets…>] [slot=N] [+adv\|+dis]` | — |
| `dash` `dodge` `disengage` `hide` | `/dash` `/dodge` `/disengage` `/hide` | — |
| `help` | `/help @<ally> <skill>` (check); `/help attack @<enemy>` | — |
| `ready` | `/ready "<trigger>" <Readyable text>` | — |
| `search` | `/search [<target>] [investigation]` | — |
| `use_object` | `/utilize &<id>` | `/use-object &<id>` |
| `grapple` | `/grapple @<id>` | — |
| `shove` | `/shove @<id> prone\|push` | — |
| `move` | `/move #<zone>` or `/move sq:x,y [sq:x,y…]` | — |
| `stand` `drop_prone` | `/stand` `/prone` | — |
| `react` | `/react <promptId> <choice>` | — |
| `end_turn` | `/end` | `/end-turn` |
| `predeclare` | `/next <Predeclarable text>` | `/predeclare …` |
| `delay` | `/delay` | — |
| `use_item` | `/use $<item> [@<id>]` | — |
| `give` | `/give $<item> @<id>` | — |
| `equip` | `/equip $<item> [+off]` | — |
| `drop` | `/drop $<item>` | — |
| `rest_short` | `/rest short [spend=<n>d<die>[,<n>d<die>…]]` | — |
| `rest_long` | `/rest long` | — |
| `concentration_drop` | `/drop-concentration` | — |
| `roll` | `/roll <requestId>` | — |
| `roll_free` | `/r <dice> [-- <reason>]`; `/gr <dice> [-- <reason>]` for channel `dm` | — |
| `level_choice` | `/level <choiceId> <option>` | — |
| `narrate` | `/desc <text>` | — |
| `npc_say` | `/as @<npc> <text>`; `/as @<npc> @<to> <text>` when addressed | — |
| `request_roll` | `/request <targets…> check <skill\|ability>\|save <ability>\|death-save\|initiative [dc=N\|diff=T] [+adv\|+dis] [+secret]` | — |
| `set_dc` | `/dc <id> <N\|tier>` | — |
| `apply_damage` | `/damage <targets…> <N\|dice> <type> [+crit]` | — |
| `apply_heal` | `/heal <targets…> <N\|dice> [+temp]` | — |
| `apply_condition` | `/condition <targets…> add\|remove <condition> [until=r<round>.<actor>.start\|end]` | — |
| `start_combat` | `/combat start [<targets…>]` | — |
| `end_combat` | `/combat end` | — |
| `add_combatant` | `/add <from> [x<count>] [#<zone>]` | — |
| `move_token` | `/place @<id> #<zone>` or `/place @<id> sq:x,y [sq:x,y…]` | — |
| `reveal` | `/reveal <target> to=party\|<pc>[,<pc>…] [block=<id>] [field=<slug>]` | — |
| `ruling` | `/rule <requestId> accept\|reject [dc=N\|diff=T] [-- <reason>]`; `/rule <requestId> amend <IntentBody text>` | — |
| `pause` | `/pause` and `/pause off` | `/resume` (= `/pause off`) |
| `bookmark` | `/bookmark <label>` | — |
| `recap` | `/recap` | — |
| `retry_narration` | `/retry [<narrationId>]` | — |

Mechanical kinds may end with ` -- <text>`. Speech and prose kinds take the body directly.

### 8.3 Round-trip rules

1. `toText` is total over every schema-valid Intent. It never throws.
2. `parse` is total over every string up to 4000 characters. It returns a refusal; it never throws.
3. `ctxOf(i) = { id, actor, source, commit }` of `i`. `parse(toText(i), ctxOf(i))` MUST deep-equal
   `IntentSchema.parse(i)` (Zod defaults applied).
4. `toText` is a canonicaliser: `toText(parse(s).intent) === toText(parse(toText(parse(s).intent)).intent)`.
5. Aliases parse. `toText` emits only canonical forms.
6. Outside quotes, runs of whitespace collapse to one space. Leading and trailing space is trimmed.
   Inside a body (`<text>`) whitespace is kept verbatim.
7. A token that holds a space or a reserved character is quoted. Ids never need quotes.
8. Verbs, flags and keys are case-insensitive on parse and lowercase on emit.
9. Target order in canonical text follows the kind's arity order in §6. Flags follow params in
   the order the grammar lists them.
10. `parse` makes no model call and no I/O. Names are resolved only through `ctx.resolve`. Without
    a resolver, a bare name that is not an id is refused `PARSE_BAD_TARGET`.
11. Plain text with no prefix parses to `say`. Turning free text into a deed is `interpret`'s job
    (N-04). It is never the grammar's.
12. An unknown `/verb` is refused `PARSE_UNKNOWN_VERB`. It is never sent as speech.

## 9. Refusal codes

`IntentRefusalCodeSchema` is one enum, so every surface renders the same reasons.

**Parse and schema (raised by this package):**

| Code | When |
|---|---|
| `PARSE_UNKNOWN_VERB` | `/word` is not a verb or alias. |
| `PARSE_MISSING_ARGUMENT` | A required target, param or body is absent. |
| `PARSE_UNEXPECTED_TOKEN` | A token the kind's grammar does not take. |
| `PARSE_BAD_TARGET` | A sigil token is malformed, or a name does not resolve. |
| `PARSE_BAD_VALUE` | A param value is outside its enum or range. |
| `PARSE_UNCLOSED` | A quote or `((` is not closed. |
| `INTENT_SCHEMA` | The object fails `IntentSchema`. `details.issues` carries the Zod issues. |
| `INTENT_CHANNEL_MISMATCH` | `channel` disagrees with the kind's fixed channel. |
| `MODEL_NUMBER` | An `ai:dm` Intent carries a model-chosen number (§6.12). |

**Gate and planner (reserved here; raised by N-02 and N-03):**

`DRAFT_NOT_ACCEPTED`, `INTENT_EXISTS`, `INTENT_NOT_DECLARED`, `NOT_YOUR_ACTOR`,
`DM_SEAT_REQUIRED`, `KIND_UNSERVED`, `NOT_YOUR_TURN`, `NO_ACTION_LEFT`, `NO_BONUS_ACTION_LEFT`,
`NO_REACTION_LEFT`, `NO_MOVEMENT_LEFT`, `OUT_OF_REACH`, `OUT_OF_RANGE`, `TARGET_NOT_PRESENT`,
`TARGET_UNSEEN`, `PROMPT_NOT_OPEN`, `REQUEST_NOT_OPEN`, `SOLO_ONLY`.

Engine `RefusalCode` values pass through unchanged, tagged `source: "engine"`. They are not
copied into this enum.

## 10. Versioning

- `INTENT_SCHEMA_VERSION = 1` (major). `INTENT_SCHEMA_MINOR = 0`.
- **Minor (additive):** a new kind, a new optional param, a new alias, a new refusal code, a new
  `Source`. Bump `INTENT_SCHEMA_MINOR`. No decision record is needed. The CHANGELOG line in the
  package README is required.
- **Major (breaking):** removing or renaming a kind, param or verb; narrowing a type; changing a
  canonical text form; changing commit semantics or a fixed channel. Bump
  `INTENT_SCHEMA_VERSION`, write a decision record, and ship an upcaster for stored Intents in
  session-model.
- Every consumer MUST tolerate an unknown `kind`: a projection renders `text` or the raw text
  form; the gate refuses it `INTENT_SCHEMA`.
- A carrier stores the major version beside each stored Intent.

## 11. Exports

```ts
INTENT_SCHEMA_VERSION, INTENT_SCHEMA_MINOR
IntentSchema, IntentKindSchema, INTENT_KINDS, INTENT_GROUPS   // kind → group
ActorRefSchema, ChannelSchema, TargetRefSchema, SourceSchema, CommitSchema
paramsSchemaOf(kind), KIND_RULES                              // seats, channel, arity, mutates, engine status
IntentRefusalCodeSchema
toText(intent): string
parse(text, ctx): ParseResult
type Intent, IntentKind, IntentOf<K>, ActorRef, Channel, TargetRef, ParseContext, ParseResult
```

`@the-stacks/intent/fixtures` exports one or more valid fixtures per kind, plus invalid fixtures
per refusal code.
