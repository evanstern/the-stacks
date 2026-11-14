# Contract: the node seam (TurnContext, NodeResult, the runner)

Module: `apps/server/src/dm/pipeline/`. Binding for every node in [nodes.md](nodes.md), for
the turn worker in [turn-jobs.md](turn-jobs.md), and for TASK-0054 (a `StateGraph` could wrap
these functions later; decision-0019).

## Node names

```ts
export const NODE_NAMES = [
  "assemble", "director", "interpret", "resolve", "narrate", "audit",
] as const;
export type NodeName = (typeof NODE_NAMES)[number];
```

The order above is the pipeline order (AC #2). `chronicle` and `companion` are not pipeline
nodes. Each runs as its own job kind ([turn-jobs.md](turn-jobs.md)).

## TurnContext

The context is immutable. The runner builds a new context after each node.

```ts
export interface TurnContext {
  readonly job: TurnJobRef;              // turn-jobs.md: id, sessionId, trigger, attempt, claimToken
  readonly deps: NodeDeps;               // injected services; nodes never import singletons
  readonly signal: AbortSignal;          // aborted on lease loss or shutdown
  readonly seed: SceneSeed;              // scene-seed.md, validated
  readonly checkpoint: TurnCheckpoint;   // turn-jobs.md; empty on the first attempt
  readonly results: Readonly<Partial<NodeOutputs>>;  // outputs of nodes already run
}

export interface NodeDeps {
  gateway: Pick<Gateway, "chat">;                         // ai/gateway.ts
  gate: Pick<Gate, "submit">;                             // gate/index.ts; only resolve receives a real one
  retrieve: (q: { question: string; signal?: AbortSignal }) => Promise<RetrievalResult>;
  loadProjections: (sessionId: string) => Promise<SessionProjections>;   // DM view
  srd: SrdLookup;                                          // { getById, compact } over @the-stacks/srd
  fence: () => Promise<boolean>;                           // true while this worker holds the lease
  saveCheckpoint: (c: TurnCheckpoint) => Promise<boolean>; // fenced write; false when fenced out
  newId: () => string;
  log: (line: Record<string, unknown>) => void;            // structured server log; never prompt text
  recordCall?: (call: RecordedCall) => Promise<void>;      // TASK-0116: awaited once per model attempt, after it ends
}

export interface NodeOutputs {
  assemble: AssembleOutput;
  director: DirectorOutput;
  interpret: InterpretOutput;
  resolve: ResolveOutput;
  narrate: NarrateOutput;
  audit: AuditOutput;
}
```

`NodeDeps` is narrowed per node. The runner passes a gate stub that throws to every node
except `resolve`. A unit test asserts the stub is what `narrate`, `audit`, `interpret`
and `director` receive (AC #5).

## NodeResult

```ts
export type NodeResult<N extends NodeName> =
  | { ok: true; node: N; output: NodeOutputs[N]; calls: ModelCallRecord[] }
  | { ok: false; node: N; error: NodeError; calls: ModelCallRecord[] };

export interface ModelCallRecord {
  purpose: DmPurpose;            // purposes.md; exactly one per call (AC #4)
  promptVersion: string;         // e.g. "dm.narrate-v1"
  attempt: number;               // 1, or 2 for the one JSON repair re-ask
  outcome: "ok" | "invalid-json" | "schema-mismatch" | "error"; // "schema-mismatch": TASK-0203 (reply parsed, schema failed)
  errorKind: ErrorKind | null;   // ai/types.ts
  // TASK-0116. From the gateway's usage record for the attempt; null when none arrived.
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;        // null also when the model has no configured price
  durationMs: number | null;
}

// What `recordCall` receives: one model attempt, including an aborted one.
export type RecordedCall = Omit<ModelCallRecord, "outcome"> & {
  outcome: ModelCallRecord["outcome"] | "aborted";
  httpAttempts: number | null;   // provider-level retries (UsageRecord.attempts)
};

export type NodeErrorKind =
  | "gateway"          // chat() ended with an error event
  | "invalid-output"   // the model's JSON failed its schema twice
  | "gate"             // resolve: a non-engine gate refusal after retries (CONFLICT, append)
  | "fenced"           // the lease was lost
  | "aborted"          // signal aborted for shutdown
  | "internal";        // a bug; logged with no prompt text

export interface NodeError { kind: NodeErrorKind; message: string; detail?: Record<string, unknown> }

export type Node<N extends NodeName> = (ctx: TurnContext) => Promise<NodeResult<N>>;
```

A node never throws on an expected failure. It returns `ok: false`. The runner treats a
thrown error as `internal`.

## The runner

```ts
export async function runTurn(ctx: TurnContext, nodes: { [N in NodeName]: Node<N> }): Promise<TurnOutcome>;

export type TurnOutcome =
  | { status: "completed"; results: NodeOutputs; calls: ModelCallRecord[] }
  | { status: "empty-beat" }                                    // no LLM call made
  | { status: "held"; companions: string[] }                    // director held the beat
  | { status: "failed"; node: NodeName; error: NodeError; calls: ModelCallRecord[] };
```

Steps:

1. Run `assemble`. If its beat is empty, its `npcTurn` is null, and the trigger is not
   `scene-start`: a `talk` trigger runs the talk read; any other trigger returns `empty-beat`
   unless `pendingDeeds(ctx)` is non-empty (TASK-0337, spec 111). With pending deeds the turn
   proceeds as a deed pass: code supplies the stay-put Director output, so no Director call runs.
2. For each remaining node in `NODE_NAMES` order:
   1. Check the fence with `deps.fence()`. On `false`, return `failed` with kind `fenced`.
   2. Write the job stage (fenced). On `false`, return `failed` with kind `fenced`.
   3. If the checkpoint holds this node's output, reuse it and skip the call. `resolve`,
      `narrate` and `audit` are never reused whole; they resume step by step.
   4. Run the node. On `ok: false`, return `failed`.
   5. Save the output in the checkpoint (fenced) for `director` and `interpret`.
   6. After `interpret`, once per turn (skipped when the checkpoint has `cut: true`): cut
      plans to their first stage, ask about undeclared methods, hold the Director on a cut or
      clarify, and save the checkpoint with `cut: true`.
   7. After `director`: when its beat decision is a legal `hold`, run `resolve` in
      hold mode (Director proposals only), then return `held`.
3. Return `completed`.

The pipeline has one conditional branch: the post-interpret plan cut, which runs once per
turn. Audit's bounded loop was retired by spec 103; the `adjudicate` node was retired by
TASK-0312 (spec 110). Its name stays in the `jobs.stage` CHECK for old rows only. The
pipeline has no dynamic routing and no cycle (decision-0019's trigger stays unfired).

## Model calls (shared helper)

```ts
export async function callJson<T>(
  deps: Pick<NodeDeps, "gateway">, req: {
    purpose: DmPurpose; promptVersion: string; system: string; user: string;
    schema: z.ZodType<T>; signal: AbortSignal;
  },
): Promise<{ ok: true; value: T; calls: ModelCallRecord[] } | { ok: false; error: NodeError; calls: ModelCallRecord[] }>;
```

1. Call `gateway.chat({ purpose, system, messages: [{ role: "user", content: user }], signal })`.
2. Join the text events. An `error` event returns `gateway` with the event's kind.
3. Strip one surrounding code fence, `JSON.parse`, then `schema.safeParse`.
4. On failure, re-ask once: append the model's text as `assistant` and the parse issues as
   `user`. A second failure returns `invalid-output`. An issue with a `discriminator` renders as
   `<path>: field "<discriminator>" is missing or invalid; use one of: <options>` (TASK-0336, spec 114 FR-011).

`callText` is the same without steps 3–4 (narrate's prose).

Amended by TASK-0273 (spec 093):

- `callJson` converts `schema` once per Zod schema with
  `z.toJSONSchema(schema, {target: "draft-7", io: "input", unrepresentable: "any"})`, drops `$schema`,
  and sends it as `ChatRequest.output = {name: purpose with "." → "_", schema}` on both attempts.
  `callText` sends no `output`. The gateway forwards it only to a purpose with `structured` set
  (specs/011-ai-gateway/contracts/gateway.md). Parse, normalize, Zod and the re-ask are unchanged.
  `.refine` rules are not in the sent schema; the post-parse `safeParse` still enforces them.
- A failed attempt whose usage is `truncated` logs `dm.call.truncated` with `parse` set to
  `invalid-json` or `schema-mismatch`, not `dm.call.invalid-json` or `dm.call.schema-mismatch`.
  A truncated `callText` attempt logs `dm.call.truncated` with `parse: null` and `issues: ""`.
  The payload is otherwise the TASK-0203 payload. The ledger outcome is unchanged.

Amended by specs/033-director-robustness/contracts/director-output.md.
Amended by specs/033-director-robustness/contracts/failure-record.md.
Amended by specs/063-think-block/contracts/think-strip.md.

`callJson` awaits `deps.recordCall?.(…)` after every attempt, including an aborted one. An
aborted attempt reaches `recordCall` with `outcome: "aborted"` and never reaches `calls`. The
worker binds `recordCall` to the claimed job and writes one `dm_model_calls` row per call
(specs/037-debug-api/data-model.md). A failed insert is logged and never fails the job.

## Amendment 2026-10-30 (specs/064-plan-first-step): the post-planning step

Amended by specs/064-plan-first-step.

In "The runner", step 2 gains a post-planning step. After `adjudicate` (or its skip) and before
`resolve`, when `checkpoint.cut` is not set and the beat decision is not `hold`:

1. Call `cutPlans` with the table mode, the readings and the rulings.
2. Call `holdDirector` with `cutBeat` true when any reading or ruling has `followUps`.
3. Save the cut readings, cut rulings and held Director with `cut: true` in one fenced save.
   A failed save returns `failed` with kind `fenced`.
4. Log `dm.plan.cut` with the job id and the cut counts.

`TurnCheckpoint` gains optional `cut?: boolean`. A reclaim with `cut: true` skips the step, so the
step is idempotent. The pipeline gains no branch, no cycle and no node name.

## Amendment 2026-10-30 (specs/065-talk-triggers): the talk outcome

Amended by specs/065-talk-triggers.

`TurnOutcome` gains `{ status: "talk", talk, companions, nextJob?, shipped, calls }`. The runner
returns it from `runTalkTurn` where it returned `empty-beat` for a `talk` trigger. The worker
stores `talk` (`{ posts, codeTriggers, modelTriggers, outcome, reason }`) in `jobs.result` and
finishes the job as `empty-beat` when the outcome is `none`, else `completed`. The pipeline gains
no node name and no cycle. `createDmEnqueuer` gains `talkQuietMs`, `talkMaxWaitMs` and `loadSeed`.

## Amendment 2026-11-02 (TASK-0188, specs/066-one-chat-stream): the read result

**Amendment (TASK-0188).** decision-0028 §8; operator ruling 2026-11-02: "All (a), amend". Additive (§8.5). `jobs.result.talk.outcome` gains `confirm` and
`interrupted`; `talk` gains `confirmItems` (a count) and `answered` (boolean). `createDmEnqueuer`
replaces `talkQuietMs` and `talkMaxWaitMs` with `readWindowMs`. The pipeline gains no node name.

**Amendment (TASK-0199).** Amended 2026-11-11 (spec `specs/066-one-chat-stream`, plan.md "Frozen-contract amendments", row C-8; P-04, decision-0030).

> "Approve all" (operator, C-GATE ruling, 2026-11-11: approves C-1 to C-9 as written in spec 066 plan.md)

Confirm items carry Intent bodies, `{ characterId, text, body }`, not `{ characterId, scope, text,
check }`. The worker ships a model item or a code item (a declared Intent with no model call) in one
`action.suggest` row.

Dated note, 2026-11-11 (T043): `jobs.result.talk` also carries `confirmItems` and `answered` (see the TASK-0188 block above).
