# Contract: the factual fallback v2

Amends `specs/031-dm-runtime/contracts/audit.md` ("The factual summary (fallback)"). Evidence:
research.md R2, R4 (F23). Card AC #2.

## Invariants

1. `factualSummary(facts): string` keeps its signature. It is pure and deterministic. It makes no model call.
2. It writes plain in-fiction prose. It holds no system word (list below) and no digit.
3. It writes one sentence for every action, roll, change and event in the facts.
4. It states no number. The dice lines still follow, rendered by code.
5. It passes `deterministicChecks` by construction. A property test asserts it.
6. It never names a tracker or any DM-only fact.

**System words** (case-insensitive, whole word): `action`, `actions`, `description`,
`clarify`, `clearer`, `roll`, `rolls`, `rolled`, `dice`, `check`, `turn`, `round`,
`initiative`, `scene`, `acts`, `nothing changes`. A character name is exempt.

**Speakable names**: replace each digit with its word and each `-` before a digit with a space
("Goblin-3" → "Goblin three").

## Sentence per fact (in this order)

| Fact | Sentence |
|---|---|
| `trigger: "scene-start"` | `facts.setting.openingFraming`, verbatim |
| Action `applied`, per roll | `<reason>.` then the outcome sentence (below). Use the reason only when the pair passes the checks and holds no system word; otherwise the outcome sentence alone. |
| Action `applied`, no roll | `<Name> goes ahead with it.` |
| Action `no-effect`, no clarify | `<Name> goes ahead with it.` |
| Action `refused` | `<Name> cannot do that here.` |
| Action with a clarify | no sentence here; a question closes the prose (last row) |
| Change `hp` damage / heal | `<Target> is wounded.` / `<Target> is healed.` |
| Change life state dead / unconscious | `<Target> is dead.` / `<Target> falls unconscious.` |
| Change condition applied / removed | `<Target> is <condition>.` / `<Target> is no longer <condition>.` |
| NPC turn, per roll | as an applied action's roll |
| NPC turn, no roll | Amended by spec 081 (TASK-0207): a speakable `say` line first, as `<Name> calls out, "<line>."` (quote marks stripped, digits spelled; refused for a digit, system word, dice word, death word, `?` or refuted claim). Amended by spec 071 (TASK-0193): otherwise the first speakable planned reason as a sentence; else `<Name> speaks up.` (talk), `<Name> shifts ground.` (move), `<Name> lends a hand.` (help); else, or when the plan was held, `<Name> holds back, watching.` Never `makes a move`. |
| Event `encounter-started` | `A fight breaks out.` then `<A>, <B> and <C> join the fight.` then `<first> moves first.` |
| Event `turn-advanced` | `<next> moves next.` |
| Event `combatant-joined` / `combatant-left` | `<Name> joins them.` / `<Name> is gone.` |
| Event `encounter-ended`, or `modeChange` to free | `The fighting stops.` (once) |
| `modeChange` to turn with no `encounter-started` event | `A fight breaks out.` |
| `director.sceneEnded` | `That is the end of it at <facts.setting.locationName>.` |
| Each clarify (last) | the question itself with digits spelled, when speakable; else `What does <Name> do?` (`the party` for a party action). Amended by spec 073 (TASK-0209). |
| Nothing at all | `The moment holds.` |

Outcome sentences: success `<Name> pulls it off.`; failure `<Name> comes up short.`; hit
`<Name> strikes home.`; critical hit `<Name> strikes home, hard.`; miss `<Name> misses.`. For an
NPC roll aimed at a target, the subject is the NPC.

## Deterministic check this depends on

The new clarify check (contracts/audit-criteria.md) requires a closing `?` when the facts carry
a clarify. The fallback satisfies it by the last row.

## Tests (`apps/server/test/dm/fallback.test.ts`)

1. One case per row above, exact string.
2. Run-5 replays: seq 88 facts (Kestrel no-effect, `encounter-ended`, mode to free) give
   "Kestrel goes ahead with it. The fighting stops." Seq 53 facts (`pt-4` clarify, encounter
   start with Snag, Goblin-2, Goblin-3, Goblin-4) state the fight, the joiners, the first mover
   and end with "What does Tamsin Vale do?".
3. Property test over generated facts: no system word, no digit, `deterministicChecks` passes,
   and every action, change and event yields its sentence.
4. No output contains a tracker name or note from the fixture facts' projections.

## Amendment 2026-11-02 (specs/079-engine-opportunity-attack, TASK-0208): the roller is the subject

Amended by spec 079 (TASK-0208). In an applied action's roll sentences, the subject is the roll's
own `name`, not the action's character. A roll whose `name` is empty or `The scene` keeps the
action's name. A check rolled by the action's own character still names that character. The
outcome sentence's signature `(name, outcome)` is unchanged. Only `rollSentences` changed.
