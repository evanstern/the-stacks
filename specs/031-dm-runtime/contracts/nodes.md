# Contract: the nodes (inputs, outputs, purposes)

Modules: `apps/server/src/dm/nodes/<node>.ts`, one file per node. Schemas:
`apps/server/src/dm/nodes/schemas.ts`. Seam: [node-seam.md](node-seam.md). Purposes:
[purposes.md](purposes.md). Doctrine: [doctrine.md](doctrine.md).

| Node | LLM purpose | Writes | Input (beyond TurnContext) | Output |
|---|---|---|---|---|
| `assemble` | none | nothing | projections, seed, checkpoint | `AssembleOutput` |
| `director` | `dm.director` | nothing | assemble | `DirectorOutput` |
| `interpret` | `dm.interpret` | nothing | assemble, director | `InterpretOutput` |
| `adjudicate` | `dm.adjudicate` | nothing | assemble, interpret, retrieval | `AdjudicateOutput` |
| `resolve` | none | **gate only** | all of the above | `ResolveOutput` |
| `narrate` | `dm.narrate` | nothing | facts from resolve, director pacing, seed portrayal | `NarrateOutput` |
| `audit` | `dm.audit` | nothing (resolve-side helper submits the result) | facts, narration | `AuditOutput` |

Narration submission happens in the runner's final step through resolve's submitter
(`submitNarration`, in `nodes/resolve.ts`), after audit decides what ships. That keeps every
gate call inside the resolve module (AC #5).

## Token budget (SC-007)

Every prompt is assembled by code under these caps, measured with `@the-stacks/srd`'s
`estimateTokens`:

| Part | Cap |
|---|---|
| Doctrine block for the node | 900 |
| Seed slice (goal, location, present NPCs, active encounter) | 1,500 |
| Transcript tail | last 20 entries, 1,500 |
| SRD compact records | at most 8 records, about 120 each |
| Projections summary (party, encounter, table mode, trackers for director only) | 800 |
| Facts (narrate, audit) | 800 |
| Retrieved passages (adjudicate only) | at most 5 passages, 2,500 |

A part over its cap is truncated by whole entries, oldest first. A test pins the caps.

## assemble (no LLM)

```ts
export interface AssembleOutput {
  projections: SessionProjections;     // DM view at assemble time
  throughSeq: number;                  // projections.throughSeq; the beat snapshot point
  beat: BeatItem[];                    // ascending commit seq; may be []
  npcTurn: { combatantId: string; srdMonsterId: string | null } | null;  // derived from state, rule 5
  presentNpcIds: string[];             // seed NPC ids in the current scene beat
  activeEncounterId: string | null;
  srdRecords: { kind: "monster" | "spell" | "condition"; id: string; compact: string }[];
  transcriptTail: TranscriptEntry[];
  priorSteps: Record<string, LedgerRow[]>;      // actionId -> ledger rows already applied for it
  rejections: Record<string, number>;           // actionId -> rejected proposal count
}

export interface BeatItem {
  actionId: string;
  committedSeq: number;
  actor: string;                       // the declarer
  characterId: string | null;
  scope: "character" | "party";
  text: string;
  status: "committed" | "resolved";   // resolved: needs narration only (FR-004)
}
```

Rules:

1. On attempt 1, freeze the beat. The beat is every action with status `committed`, plus
   every `resolved` action that no `narration` row and no pending `narration` proposal
   names. Order by `committed.seq`.
2. On a later attempt, read the beat's action ids from the checkpoint. Do not add new ones.
3. Skip an action with two or more rejected proposals (edge case "Twice-rejected action").
4. Set `npcTurn` from state, whatever the trigger: table mode is `turn`, its active actor is
   `ai:dm`, the encounter's active combatant is alive, and no beat item belongs to it. The
   `npc-turn` trigger only explains why the job exists.
5. Select SRD records: monsters in the active encounter, spells and conditions named in the
   beat text or on combatants. Use `compact`; never load a whole data file (decision-0021
   idea 7).

## director (`dm.director`)

Prompt: the Director doctrine, the seed goal and end conditions, the trackers with their
`advanceWhen` text, table mode, encounter summary, the beat, the trigger. Output schema in
[director.md](director.md) (`DirectorOutput`). The Director never sees a dice result before
it decides; it runs before resolve.

## interpret (`dm.interpret`)

```ts
export const InterpretOutput = z.object({
  readings: z.array(z.object({
    actionId: RefIdSchema.nullable(),           // null only for the NPC turn
    intent: z.enum(["talk", "move", "check", "save", "attack", "spell", "help", "rest", "other"]),
    uncertain: z.boolean(),                     // doctrine: roll only when the outcome is uncertain
    needsAdjudication: z.boolean(),
    rulesQuestion: z.string().min(1).max(500).nullable(),   // required when needsAdjudication
    clarify: z.string().min(1).max(200).nullable(),         // one short question; unclear intent
    steps: z.array(StepSchema).max(6),                      // [] when needsAdjudication or clarify
  })).max(20),
});
```

Each beat item has exactly one reading; an NPC turn has one reading with `actionId: null`. A
missing or extra reading is `invalid-output`. `priorSteps` tells interpret which steps already
applied for an action; it plans only the rest.

Amended by specs/033-director-robustness/contracts/interpret-output.md.
Amended by specs/033-director-robustness/contracts/rules-terms.md.

## Steps (mechanics inputs as data)

```ts
const Amount = /* the engine's Amount */;
const Effect = z.discriminatedUnion("effect", [
  z.object({ effect: z.literal("damage"), targetId: CombatantIdSchema,
    components: z.array(z.object({ amount: Amount, damageType: DamageTypeSchema })).min(1).max(10),
    defenses: DefenseSetSchema.nullable() }),
  z.object({ effect: z.literal("heal"), targetId: CombatantIdSchema, amount: Amount }),
  z.object({ effect: z.literal("condition"), op: z.enum(["apply", "remove"]),
    targetId: CombatantIdSchema, condition: ConditionKeySchema, source: z.string().min(1).max(100) }),
]);

export const StepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("none"), reason: Reason }),          // certain outcome; no roll
  z.object({ step: z.literal("check"), reason: Reason,
    combatantId: CombatantIdSchema.nullable(),
    kind: z.enum(["ability-check", "saving-throw"]), ability: AbilitySchema,
    skill: z.string().max(40).nullable(), expression: z.string().min(1).max(200),
    mode: RollModeSchema, dc: z.number().int().min(1).max(40),
    autoFail: z.object({ reason: Reason }).nullable(),
    onSuccess: z.array(Effect).max(4), onFailure: z.array(Effect).max(4) }),
  z.object({ step: z.literal("attack"), reason: Reason,
    attackerId: CombatantIdSchema.nullable(), targetId: CombatantIdSchema,
    expression: z.string().min(1).max(200), mode: RollModeSchema,
    targetAc: z.number().int().min(1).max(40).nullable(),
    onHit: z.array(Effect).min(1).max(4) }),
  z.object({ step: z.literal("effect"), reason: Reason, effects: z.array(Effect).min(1).max(4) }),
  z.object({ step: z.literal("roll"), reason: Reason, expression: z.string().min(1).max(200),
    mode: RollModeSchema }),
]);
```

The schema has **no field for a total, an applied amount, or a verdict** (AC #5, R8). An
`expression` carries the bonus the model chose (ability modifier, proficiency, bonus dice);
the engine parses and rolls it. A `fixed` amount is allowed only where the SRD names a fixed
value; the prompt says so, and audit does not police it.

Amended by specs/033-director-robustness/contracts/interpret-output.md.
Amended by specs/033-director-robustness/contracts/rules-terms.md.

## adjudicate (`dm.adjudicate`)

Runs once per reading with `needsAdjudication: true`, in beat order.

1. Call `deps.retrieve({ question: reading.rulesQuestion, signal })` once.
2. Keep passages that pass `isRelevant` (`library/answer.ts`) at `ASK_MIN_SIMILARITY`.
3. Number them 1..n in the prompt, add the SRD compact records, and call `dm.adjudicate`.

```ts
export const AdjudicateModelOutput = z.object({
  ruling: z.string().min(1).max(600),
  citations: z.array(z.discriminatedUnion("source", [
    z.object({ source: z.literal("library"), p: z.number().int().min(1), quote: z.string().min(1).max(500) }),
    z.object({ source: z.literal("srd"), kind: SrdKindSchema, id: z.string().min(1) }),
  ])).max(6),
  steps: z.array(StepSchema).min(1).max(6),
});

export interface Ruling {
  actionId: string;
  ruling: string;
  improvised: boolean;                    // true when no citation verified (FR-072)
  citations: VerifiedCitation[];
  dropped: number;                        // citations that failed verification
  steps: Step[];
}

export type VerifiedCitation =
  | { source: "library"; chunkId: string; book: string; path: string[]; quote: string; span: { start: number; end: number } }
  | { source: "srd"; kind: SrdKind; id: string; name: string; page: number };

export interface AdjudicateOutput { rulings: Ruling[] }
```

Verification: a library citation resolves `p` to the numbered passage and calls
`locateQuote` from `library/cite.ts` (M1 rules: exact, then normalized; minimum length). An
SRD citation must name an existing record; its page comes from the record's `source`. A
failed citation is dropped and counted.

## resolve (no LLM; the only gate caller)

Contract: [resolve.md](resolve.md).

## narrate (`dm.narrate`)

```ts
export interface NarrationFacts {
  trigger: TurnTrigger;
  actions: FactAction[];            // in beat order
  npcTurn: FactNpcTurn | null;
  director: { pacing: DirectorOutput["pacing"]; goalNote: string; sceneEnded: boolean };
  modeChange: { from: "free" | "turn"; to: "free" | "turn" } | null;
  presentNpcs: { id: string; name: string; voice: string; want: string; detail: string }[];
  rulings: { actionId: string; ruling: string; improvised: boolean }[];
  clarify: { actionId: string; question: string }[];
}

export interface FactAction {
  actionId: string; characterName: string | null; text: string;
  outcome: "applied" | "refused" | "no-effect";
  refusalCode: string | null;
  rolls: FactRoll[];                // one per dice.rolled row this action produced
  outcomes: ("hit" | "miss" | "critical-hit" | "success" | "failure")[];
  changes: FactChange[];            // hp, life state, conditions, from the ledger rows
}
```

Facts are built by code (`dm/facts.ts`) from the rows resolve appended this turn and the
ledger rows in `priorSteps`. Narrate's module imports nothing from `@the-stacks/dnd5e-engine`
except types, and nothing from `gate/` (AC #6; test in Phase 5).

Narrate calls `callText` and returns:

```ts
export interface NarrateOutput {
  prose: string;            // 1..1,200 characters; no digits (FR-034)
  diceLines: string[];      // rendered by code from FactRoll, never by the model
  text: string;             // prose + "\n\n" + diceLines.join("\n"); what ships
  actionIds: string[];      // the beat's actionIds
  attempt: number;          // 1..3
}
```

A dice line reads `<name> — <reason>: <expression> → <natural or faces> = <total> vs <AC|DC n>: <outcome>`.
Damage lines read `<target> takes <n> <type> (<before>→<after> HP)`. The renderer is a
pure function with snapshot tests.

## audit (`dm.audit`)

Contract: [audit.md](audit.md).
