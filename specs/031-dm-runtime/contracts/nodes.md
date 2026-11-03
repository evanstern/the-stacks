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
Amended by specs/057-human-dm-roll-resume/contracts/turn-resume.md.

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
    skill: z.string().max(40).nullable(),
    difficulty: DifficultySchema, circumstance: Circumstance,     // Amended by specs/082-engine-derived-numbers
    autoFail: z.object({ reason: Reason }).nullable(),
    onSuccess: z.array(Effect).max(4), onFailure: z.array(Effect).max(4),
    stakes: StakesSchema, onCost: z.array(Effect).max(4).default([]),     // Amended by specs/070-stakes-before-dice
    onSevere: z.array(Effect).max(4).default([]), newRisk: z.string().min(1).max(200).nullable().default(null) }),
  z.object({ step: z.literal("attack"), reason: Reason,
    attackerId: CombatantIdSchema, targetId: CombatantIdSchema,       // Amended by specs/082-engine-derived-numbers
    attack: z.string().min(1).max(60), circumstance: Circumstance,
    onHit: z.array(Effect).max(4) }),   // no damage effect: the engine applies the attack entry's damage
  z.object({ step: z.literal("effect"), reason: Reason, effects: z.array(Effect).min(1).max(4) }),
  z.object({ step: z.literal("roll"), reason: Reason, expression: z.string().min(1).max(200),
    mode: RollModeSchema }),
]);
```

The schema has **no field for a total, an applied amount, or a verdict** (AC #5, R8). Amended
by specs/082-engine-derived-numbers: the check and attack steps are strict objects and carry no
`expression`, `dc`, `targetAc` or `mode`. `difficulty` is a tier (`very-easy` 5 to
`nearly-impossible` 30); `attack` names a seed or SRD attack entry; `circumstance` is `null` or
`{ mode, reason }`. The engine derives the modifier, DC, AC, damage and roll mode from the
combatant's stats and conditions. The `roll` step keeps its `expression`. A `fixed` amount is allowed only where the SRD names a fixed
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

Amended by specs/034-narration-quality/contracts/narration-facts.md.

## audit (`dm.audit`)

Contract: [audit.md](audit.md).

## Amendment 2026-10-30 (specs/064-plan-first-step): `followUps` and the first-stage cut

Amended by specs/064-plan-first-step.

- Each interpret reading gains `followUps: z.array(z.string().min(1).max(200)).max(6).default([])`.
  The model lists each later step that depends on the first stage; it plans no step for it.
- `Ruling` (`nodes/adjudicate.ts`) gains `followUps: string[]`. The node sets `[]`; only the cut
  fills it.
- `dm/first-stage.ts` holds the pure rule. `firstStage(steps)` keeps steps up to the end of the
  first run of like `check` steps (same `kind`, `ability`, `skill`). No check cuts nothing.
  `cutPlans` applies it in `free` mode only, to each reading and ruling with an `actionId`.
  A cut step's `reason` joins `followUps`, deduplicated, capped at 6.
- Prompt versions: `dm.interpret-v5`, `dm.director-v4`, `dm.narrate-v6`.

## Amendment 2026-10-30 (specs/065-talk-triggers): the talk path and `react`

Amended by specs/065-talk-triggers.

- A `talk` turn with an empty beat and no NPC turn skips the node order. `runTalkTurn`
  (`dm/talk-turn.ts`) reads the readable posts since the last `ai:dm` narration, runs
  `codeTriggers`, calls `react` once (twice after a code refusal), checks the text in code and
  ships one narration row through `submitNarration` with no action ids. A talk turn with a
  non-empty beat runs the full pipeline.
- `ReactOutput` (`nodes/schemas.ts`): `outcome` (`none`, `reply`, `scene`, `escalate`),
  `triggers` (max 8), `speaker`, `text` (max 1200), `encounterId`, `companionPrompts` (max 2),
  `reason`. `reply` needs `speaker`, `escalate` needs `encounterId`, `none` needs empty `text`.
- Model skip: `needsModel` is false when no trigger names a non-party NPC and no post holds `?`.
- Code checks: `deterministicChecks` with `trigger: "talk"` and empty actions, plus a DM-only seed
  text substring check and a present-speaker check. A second refusal records `none`.
- `escalate` runs resolve's opening move with a synthetic Director output when `legalEscalation`
  holds (free mode, no running encounter, an unstarted encounter). Otherwise it ships as `scene`.
- The output is checkpointed in `TurnCheckpoint.react`. A reclaim reuses it and reads the posts
  as free mode once an opening move landed.

## Amendment 2026-11-02 (TASK-0188, specs/066-one-chat-stream): `confirm` and the `@dm` answer

**Amendment (TASK-0188).** decision-0028 §8; operator ruling 2026-11-02: "All (a), amend". Additive (§8.5).

- `ReactOutput.outcome` gains `confirm`. New fields: `confirm` (0 to 4 items `{ characterId,
  scope, text, check }`; 1 to 4 when the outcome is `confirm`, else empty) and `answer` (text or
  null).
- The talk path reads the readable posts after the latest DM read output (an `ai:dm` narration,
  an `action.suggested` row, or an `ai:dm` OOC talk row). It calls the model whenever a read post
  is human-authored.
- Code keeps a confirm item only for a present, conscious, human-controlled party character (in
  turn mode, the active one) or for `party`. `check` is kept only as a `SkillSchema` value or
  `attack`.
- Every shipped text (reply, confirm item, answer) passes the D19 code checks. One regenerate.
- Ship order: the answer as `talk` (`ai:dm`, `ooc`, public), then the confirm as `action.suggest`
  (`suggestionId` `sug-<jobId>`), or the D19 row. A `SUGGESTION_STALE` refusal records
  `interrupted`.
- A confirm row and an answer do not count toward the chain cap. A confirm prompts no companion.
- Resolve skips a beat action withdrawn before its group runs.

## Amendment 2026-11-02 (specs/077-no-undeclared-method): the undeclared-method ask

Amended by spec 077 (TASK-0205).

- The runner's post-planning step calls `askUndeclared` (`gates/plan-gate.ts`) after `cutPlans`
  and before `clarifyHolds`. `cutBeat`, `clarifyHolds`, the stored checkpoint and `ctx.results`
  read its output. The `dm.plan.cut` log line gains `asked` (a count).
- It visits each beat item with `status: "committed"` whose id is not a resumed plan. The group's
  steps are its ruling's steps when a ruling names the action, else its reading's. A reading with
  `clarify` set and the NPC reading (`actionId: null`) are skipped.
- It walks the steps in order. On each step it tests the manner rule, then the other-player rule.
  The first failure asks and stops the walk.
- Manner rule (skipped when `actor` starts with `ai:`): a `check` step with `kind: "ability-check"`
  whose `skill` is a `MANNER_SKILLS` row (stealth, deception, intimidation) fails when the row's
  cue pattern does not match the item's `text`.
- Other-player rule (skipped when `scope` is `party`): a `check` with `kind: "ability-check"`
  (`combatantId`) or an `attack` (`attackerId`) fails when the id names a party actor whose
  controller is a `player` with a `userId` other than the item's `actor`. A null id passes.
- On a failure the reading becomes `{ ...reading, steps: [], followUps: [], clarify: question }`
  and the ruling for that action id is removed. Any other reading or ruling is returned unchanged.
- No prompt version changes.

## Amendment 2026-11-02 (specs/070-stakes-before-dice, TASK-0127): stakes before dice

Amended by specs/070-stakes-before-dice. A `check` step declares `stakes` before the roll:
`{ success: str|null, cost: str|null, failure: str, severe: str|null }`, each at most 200 characters.
An ability check needs `cost` and `severe` (the schema refines both in interpret and adjudicate output);
a saving throw sets them null. `onCost` and `onSevere` hold the effects of those bands. `newRisk` is a
new danger; null means a repeat is a free retry. The plan gate runs `checkClaims` on every stake text,
`newRisk`, and the `onCost`/`onSevere` effect texts, and counts those effects in the planned diff.
`SceneSeed.tableRules` is `{ outcomeBands: true, naturals: true, groupChecks: false }` by default.
Prompts: `dm.interpret-v8`, `dm.adjudicate-v6`, `dm.narrate-v11`, `dm.audit-v7`. `Submission` gains
`band` and `stakes` (checkpointed, never in a public row).

## Amendment 2026-11-03 (specs/080-declared-outcome, TASK-0170): the declared outcome

Amended by specs/080-declared-outcome. `stakes.success` is now required on every `check` step
(`str`, at most 200 characters, never null): the concrete outcome of the attempt on a success. A
`check` step gains `reveals: "<beatId>#<n>" | null` (default null; `n` is 1 to 8): the one listed
clue of the current beat that a success shows. Interpret's prompt gains a `Discoverable clues`
section (`clueEntries`, no DC). Prompts: `dm.interpret-v9`, `dm.adjudicate-v7`. No node signature
changes.

## Amendment 2026-11-03 (specs/081-talk-fallback-line, TASK-0207): the monster's spoken line

Amended by specs/081-talk-fallback-line. An interpret reading gains `say: str|null` (optional, 1 to
200 characters): the words a monster speaks this beat. The prompt rule: on a monster turn put the
spoken words in `say`, no quote marks; otherwise null; never put speech in `followUps`; write each
reason as what the actor does, with no rules note. `say` is not a step: the engine never sees it.
Prompt: `dm.interpret-v10`. No node signature changes.

## Amended by specs/083-spells-by-srd-id (TASK-0105)

A strict `spell` step joins the step union: `{ step: "spell", reason, casterId, spellId, slotLevel:
1..9|null, targetId }`. `spellId` follows the SRD id grammar. The step has no field for a DC,
expression, damage, effect or amount: the engine derives every spell number. The grammar line and
a rule sentence ("spell numbers come from the engine; never rebuild a spell from check, attack or
effect steps") enter `STEP_GRAMMAR`. Prompts: `dm.interpret-v12`, `dm.adjudicate-v9`. The actor
sheet line lists the caster's spell ids. No node signature changes.

## Amended by specs/084-opposition-and-help (TASK-0128)

The `check` step's `difficulty` is a tier string or `{ opposedBy: id, rule: "unarmed-strike" | "influence" }`
(strict). `opposedBy` equal to the check's `combatantId` fails at `difficulty.opposedBy`; a rule that does not
cover the check's kind, ability and skill fails at `difficulty.rule`. A new strict `help` step:
`{ step: "help", reason, helperId, assist: { kind: "ability-check", allyId, skill } | { kind: "attack", targetId } }`.
An ally or target equal to `helperId` fails at `assist`. Prompt versions: `dm.interpret-v13`, `dm.adjudicate-v10`.
