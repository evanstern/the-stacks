# Contract: narration facts v2 and the narrate prompt v2 (v3 amendment)

Amends `specs/031-dm-runtime/contracts/nodes.md` ("narrate"). Evidence: research.md R1.1–R1.3,
R1.5, R2, R4 (F17, F81), R7.3 (E3).

## Facts additions (`apps/server/src/dm/facts.ts`)

```ts
export interface NarrationFacts {
  // unchanged fields …
  party: { characterId: string; name: string; controller: "human" | "ai-companion" }[];
  npcNames: string[];               // seed NPC names plus non-party combatant names, deduped
  events: FactEvent[];              // public ledger changes this turn, in seq order
  setting: { locationName: string; openingFraming: string };  // from the player-facing view
}

export interface FactRoll {
  // unchanged fields …
  target: string | null;            // attack target name, from attack.resolved.targetId
}

export type FactEvent =
  | { kind: "encounter-started"; combatants: string[]; first: string | null }
  | { kind: "encounter-ended" }
  | { kind: "turn-advanced"; next: string }
  | { kind: "combatant-joined"; name: string }   // outside an encounter start
  | { kind: "combatant-left"; name: string };
```

Rules:

- Build `events` from `resolve.appendedRows` with `visibility === "public"` only.
- Never build an event from `tracker.changed`. Trackers stay DM-only.
- `combatant.added` rows in the same batch as an `encounter.started` fold into that event's
  `combatants`. `first` is the first combatant of the order.
- `turn.advanced` gives `turn-advanced` with the new active combatant's name. Skip it when an
  `encounter-ended` follows in the same turn.
- `modeChange` stays as it is.
- `party` comes from `projections.party`. `npcNames` comes from the player-facing view's NPC
  names plus every engine combatant not in the party.

## `factEntries` rendering (shared by narrate and audit)

| Fact | Line |
|---|---|
| Action, `applied` | `Action <id> by <name>: "<text>" -> applied` |
| Action, `no-effect`, no clarify | `Action <id> by <name>: "<text>" -> no rules effect (nothing rolled, no game state changed; the attempt still happens in the story)` |
| Action with a clarify | `Action <id> by <name>: "<text>" -> on hold (the intent is unclear; nothing happened yet)` |
| Action, `refused` | unchanged |
| Each roll | `  roll: <reason> [target <target>] -> <outcome>` (reason marker stripped) |
| Each change | unchanged |
| NPC turn | `Monster turn: <name>`, then its roll lines and changes |
| Turn marking (amended by spec 071, TASK-0193) | In turn mode, first: `Turn: <actor> acts in this beat.` and, when the turn advanced, `Next: <next> acts after this beat and has not acted yet.` Under `Monster turn`: `  planned: <intent>; <reason>...`, `  held: the plan did not go ahead`, and `  no rules effect (nothing rolled; <name> still acts in the story)` when nothing rolled |
| Each event | `Event: a fight starts (<names>); <first> acts first`, `Event: the fight ends`, `Event: <next> acts next`, `Event: <name> joins`, `Event: <name> leaves` |
| Clarify | `Unclear intent for <id>: <question>` |

The facts section cap (`CAPS.facts`) is unchanged.

## Narrate prompt v2 (`prompts/narrate.ts`, `PROMPT_VERSION = "dm.narrate-v2"`)

Add a `## Party (player characters)` section: one line per party member, `<name> (human
player)` or `<name> (AI companion)`. Add a `## Other characters (the world)` section with
`npcNames`. Keep "Present characters" (the view's NPC portrayal) under that name.

RULES changes:

1. Replace the player-character rule with: "The party members are player characters, AI
   companions included. Never decide what one says, feels or chooses. You may show a party
   member carrying out the action they declared, in plain words, and nothing more. Never
   invent a companion's speech or state; companions speak for themselves."
2. Add: "Every other character is part of the world. Give them words, moves and reactions."
3. Add: "No rules effect means nothing was rolled. The attempt still happens; show what the
   world does with it. Never grant a hit, a wound, a condition, a death or a hidden discovery
   without a fact."
4. Add: "When an intent is unclear, describe the moment, then end with one short open question
   in your own words that asks what that character does. Never offer options."
   Amended by spec 073 (TASK-0209), `dm.narrate-v8`: "When an intent is unclear, describe the
   moment, then end with the Unclear intent question exactly as written." The closing rule adds
   ", except the Unclear intent question".
5. Add: "Cover every Event line."
6. Keep every other rule.

The regenerate block lists only blocking issues (contracts/audit-criteria.md).

## Tests

- `facts.test.ts`: events from a fixture of run-5 rows 39–58 (encounter start, turn advances,
  mode change); no event from `tracker.changed`; `target` and `reason` from rows 60–61; `party`
  marks `odo` and `kestrel` as `ai-companion`.
- `narrate.test.ts`: the v2 prompt holds the party section, the world section, the
  no-rules-effect line, the on-hold line, the open-question rule and each event line. The
  roll line for Goblin-3 holds "jabs at Tamsin with its dagger".

## Narrate prompt v3 (E3, amendment 2026-10-26)

Evidence: research.md R7.3. In the verification run the narrator gave Tamsin a wound with no
damage fact ("sways on her knees, blood dark along her side") after a goblin's lunge failed. It
also moved her on a failed grab ("wrenches away before the grip can set"). `dm.audit` flagged
these as `invented-mechanics` 14 times. The playtest auditor failed four turns as
`player-agency` (F19, F24, F37, F47).

Set `PROMPT_VERSION = "dm.narrate-v3"` in `prompts/narrate.ts`.

RULES change: add this rule directly after the "No rules effect" rule. Keep every other rule
and its order.

> "When a foe's attack misses, its grab fails, or a party member succeeds on a save against
> it, describe only what the foe did. The party member stays unchanged and unmoved: no wound,
> no dodge, no twisting free. Never show a wound on a party member unless a fact records damage
> to them."

**When the rule applies, in fact terms.** The model reads the rule as prose. Code adds no
detection. For tests and review, the case is one of these:

- A roll line in a `Monster turn` block whose `target` is a party member and whose outcome is
  `miss` or `failure`.
- A save roll by a party member in a `Monster turn` block whose outcome is `success`.

"A party member" means every `facts.party` entry, AI companions included.

**What does not change.**

- `NarrationFacts`, `factEntries` and the facts cap do not change.
- A foe's hit still lands. A recorded damage change is still narrated.
- A party member's own declared action is still shown (narrate v2 rule 1).
- The `dm.audit` prompt does not change. Audit v2 statement 2 already names "a wound" with no
  fact as `invented-mechanics`. `PROMPT_VERSION` stays `dm.audit-v2`. Bump it only if a later
  amendment changes its text.

### Tests for narrate v3

- `narrate.test.ts`: `NARRATE_VERSION` is `dm.narrate-v3`. Update the v2 assertion.
- `narrate.test.ts`: the system prompt holds the v3 rule verbatim, directly after the "No rules
  effect" rule.
- `narrate.test.ts`: an inline snapshot (`toMatchInlineSnapshot`) of the full `RULES` text, as
  `interpret-prompt.test.ts` does for its grammar.
- `narrate.test.ts`: for facts with a `Monster turn` whose roll targets Tamsin with outcome
  `miss` and no change line, the user prompt holds that roll line and no damage change.

## Amendment 2026-10-30 (specs/064-plan-first-step): follow-ups and narrate v6

Amended by specs/064-plan-first-step.

- `FactAction` gains `followUps: string[]`. `BuildFactsInput` gains optional
  `followUps?: Record<string, string[]>`, keyed by action id. The ruling's list wins over the
  reading's.
- `factEntries` renders each follow-up as `  not yet attempted: <text>` under its action.
- `withholdRefusedInputs` refuses each follow-up the same way as other model text and drops it.
- `PROMPT_VERSION = "dm.narrate-v6"`. RULES gain, before the closing rule: "A not-yet-attempted
  step has not happened. Stop before it; never show it start."

## Amendment 2026-11-02 (specs/074-player-agency, TASK-0113): reflexes, band and narrate v9

- `NarrationFacts.involuntary?: FactInvoluntary[]` (`name`, `trigger`, `detail`), always set by
  `buildNarrationFacts` from this turn's action, NPC-turn and settle rows, via the pure
  `deriveInvoluntary`. Five reflex triggers on a party member, in seq order, deduped by
  `name|trigger`:
  - `stagger`: a critical hit on the member.
  - `heavy-hit`: damage of half the member's maximum HP or more.
  - `flinch`: a failed saving throw (a failed death save yields none).
  - `avoid`: a foe's miss on the member (OQ-1 ruling, "Yes, allow a flinch").
- `FactRoll.band?: FactBand | null` is reserved for TASK-0127; this card never sets it.
- `factEntries` renders `Reflex: <name> may <stagger|reel from a heavy hit|flinch|flinch as it
  misses> (<detail>)` for each.
- `PROMPT_VERSION = "dm.narrate-v9"`. The party rule line is `agencyRule("narrate")`. The miss line
  allows a flinch on a listed miss and bars a chosen defence. The scene-start prompt adds: "The
  opening shows the place and what the party finds. It never moves, leads or voices a party
  member." The v8 clarify lines are unchanged.

## Amendment 2026-11-02 (specs/079-engine-opportunity-attack, TASK-0208): the reaction flag

Amended by spec 079 (TASK-0208). `FactRoll.reaction?: boolean` is `true` when the linked
`attack.resolved` outcome has `reaction === true`; otherwise it is absent. Narrate renders such a
roll as `  reaction: <name> strikes at <target> as they pull away -> <outcome>`. Narrate is
`dm.narrate-v10` and audit is `dm.audit-v6`. The deterministic opposite-outcome check reads the
character's own rolls only.

## Amendment 2026-11-02 (specs/079-engine-opportunity-attack, TASK-0208): open followUps

Amended by spec 079 (TASK-0208). `NarrationFacts.openFollowUps?: { name: string; text: string }[]`
holds a party member's followUps from the latest resolved action of an earlier turn, until that
member declares again. Narrate renders each as `Earlier beat, not yet attempted: <name>: <text>`.
The narrate rule reads: a not-yet-attempted step has not happened, in this beat or an earlier
one; never show it start or done. `withholdRefusedInputs` filters them like this turn's followUps.
