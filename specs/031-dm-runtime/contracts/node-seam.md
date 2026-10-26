# Contract: the node seam (TurnContext, NodeResult, the runner)

Module: `apps/server/src/dm/pipeline/`. Binding for every node in [nodes.md](nodes.md), for
the turn worker in [turn-jobs.md](turn-jobs.md), and for TASK-0054 (a `StateGraph` could wrap
these functions later; decision-0019).

## Node names

```ts
export const NODE_NAMES = [
  "assemble", "director", "interpret", "adjudicate", "resolve", "narrate", "audit",
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
}

export interface NodeOutputs {
  assemble: AssembleOutput;
  director: DirectorOutput;
  interpret: InterpretOutput;
  adjudicate: AdjudicateOutput;     // { rulings: [] } when skipped
  resolve: ResolveOutput;
  narrate: NarrateOutput;
  audit: AuditOutput;
}
```

`NodeDeps` is narrowed per node. The runner passes a gate stub that throws to every node
except `resolve`. A unit test asserts the stub is what `narrate`, `audit`, `interpret`,
`adjudicate` and `director` receive (AC #5).

## NodeResult

```ts
export type NodeResult<N extends NodeName> =
  | { ok: true; node: N; output: NodeOutputs[N]; calls: ModelCallRecord[] }
  | { ok: false; node: N; error: NodeError; calls: ModelCallRecord[] };

export interface ModelCallRecord {
  purpose: DmPurpose;            // purposes.md; exactly one per call (AC #4)
  promptVersion: string;         // e.g. "dm.narrate-v1"
  attempt: number;               // 1, or 2 for the one JSON repair re-ask
  outcome: "ok" | "invalid-json" | "error";
  errorKind: ErrorKind | null;   // ai/types.ts
}

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
   `scene-start`, return `empty-beat`.
2. For each remaining node in `NODE_NAMES` order:
   1. Check the fence with `deps.fence()`. On `false`, return `failed` with kind `fenced`.
   2. Write the job stage (fenced). On `false`, return `failed` with kind `fenced`.
   3. If the checkpoint holds this node's output, reuse it and skip the call. `resolve`,
      `narrate` and `audit` are never reused whole; they resume step by step.
   4. Skip `adjudicate` when no interpret reading has `needsAdjudication: true`; its
      output is `{ rulings: [] }`.
   5. Run the node. On `ok: false`, return `failed`.
   6. Save the output in the checkpoint (fenced) for `director`, `interpret` and
      `adjudicate`.
   7. After `director`: when its beat decision is a legal `hold`, run `resolve` in
      hold mode (Director proposals only), then return `held`.
3. Return `completed`.

The pipeline has exactly two conditional branches: adjudicate or not, and audit's bounded
regenerate loop inside `narrate`/`audit` ([audit.md](audit.md)). It has no dynamic routing
and no cycle (decision-0019's trigger stays unfired).

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
   `user`. A second failure returns `invalid-output`.

`callText` is the same without steps 3–4 (narrate's prose).
