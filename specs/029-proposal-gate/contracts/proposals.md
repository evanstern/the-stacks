# Contract: proposals, gate requests, proposers and permissions

Package: `@the-stacks/session-model` (`packages/session-model/src/gate/`), exported from the
main entry. Binding for TASK-0046 (the DM runtime builds proposals), TASK-0047 (the play
route sends gate requests and renders proposal bodies) and this task's server gate. A change
to any kind, field, permission or visibility rule below is a contract change: update this
file in the same PR.

Siblings: [policy-and-authority.md](policy-and-authority.md),
[proposal-events.md](proposal-events.md), [gate-api.md](gate-api.md),
[ws-delivery.md](ws-delivery.md), [fixtures.md](fixtures.md),
[write-boundary.md](write-boundary.md).

## Proposal kinds

Twelve kinds, closed:

```ts
export const ProposalKindSchema = z.enum([
  "talk", "action.declare", "action.comment", "action.commit", "action.resolve",
  "mechanics", "narration", "table-mode", "scene", "party", "tracker", "journal",
]);
export type ProposalKind = z.infer<typeof ProposalKindSchema>;

/** The eleven kinds the AI DM may propose; the policy table is total over these. */
export const DmProposalKindSchema = ProposalKindSchema.exclude(["action.declare"]);
export type DmProposalKind = z.infer<typeof DmProposalKindSchema>;
```

## Schemas

Every proposal carries two optional fields for the DM's approval panel:

```ts
const ProposalNote = {
  summary: z.string().min(1).max(200).nullable().default(null),     // one line, e.g. "Ana: DC 15 lockpick"
  rationale: z.string().min(1).max(2000).nullable().default(null),  // the model's reason, shown to the DM
};
```

`VisibilitySchema`, `RefIdSchema`, `ReasonSchema` and every `*V1` / `*Schema` named below are
the session-model exports from `specs/028-session-model/contracts/session-events.md`.

```ts
export const ProposalSchema = z.discriminatedUnion("kind", [
  // ── table-side (players, companions, DM) ──
  z.object({ kind: z.literal("talk"), ...ProposalNote,
    talk: TalkV1, visibility: VisibilitySchema.default("public") }),
  z.object({ kind: z.literal("action.declare"), ...ProposalNote,
    action: ActionDeclaredV1 }),
  z.object({ kind: z.literal("action.comment"), ...ProposalNote,
    comment: ActionCommentedV1 }),
  z.object({ kind: z.literal("action.commit"), ...ProposalNote,
    actionId: RefIdSchema }),                       // authority is derived by the gate, never supplied

  // ── DM-side ──
  z.object({ kind: z.literal("action.resolve"), ...ProposalNote,
    resolution: ActionResolvedV1 }),
  z.object({ kind: z.literal("mechanics"), ...ProposalNote,
    command: z.unknown(),                           // validated by the engine's execute (INVALID_COMMAND)
    actionId: RefIdSchema.nullable().default(null),
    visibility: z.enum(["public", "dm"]).default("public") }),   // "dm": a hidden roll
  z.object({ kind: z.literal("narration"), ...ProposalNote,
    narration: NarrationV1, visibility: VisibilitySchema.default("public") }),
  z.object({ kind: z.literal("table-mode"), ...ProposalNote,
    reason: ReasonSchema, after: TableModeSchema }),            // the gate fills `before`
  z.object({ kind: z.literal("scene"), ...ProposalNote,
    reason: ReasonSchema, after: SceneSchema.nullable() }),
  z.object({ kind: z.literal("party"), ...ProposalNote,
    reason: ReasonSchema, characterId: RefIdSchema, after: PartyMemberSchema.nullable() }),
  z.object({ kind: z.literal("tracker"), ...ProposalNote,
    reason: ReasonSchema, trackerId: RefIdSchema, after: TrackerSchema.nullable() }),
  z.object({ kind: z.literal("journal"), ...ProposalNote,
    entry: JournalEntryAddedV1, visibility: z.enum(["public", "dm"]).default("public") }),
]);
export type Proposal = z.infer<typeof ProposalSchema>;

/** Typed builder for producers; the wire schema keeps `command: unknown` so the engine is the one validator. */
export function mechanicsProposal(
  command: EngineCommand,
  opts?: { actionId?: string | null; visibility?: "public" | "dm"; summary?: string; rationale?: string },
): Proposal;
```

Rules:

- **The gate fills `before`.** `table-mode`, `scene`, `party` and `tracker` carry only
  `after`. The gate reads `before` from the DM projection at plan time, so a stale `before`
  can never be written.
- **`mechanics.command` is `unknown` on the wire.** The engine's `execute` parses it
  (engine-api.md: "a gate that forwards an LLM proposal cannot skip validation"). A bad
  command refuses with the engine's `INVALID_COMMAND`, source `engine`.
- **Visibility.** `talk` and `narration` accept any visibility (`public`, `dm`, a user id).
  `mechanics` and `journal` accept `public` or `dm`. Actions, `table-mode`, `scene` and
  `party` are always `public`. `tracker` is always `dm`. Proposal lifecycle events are always
  `dm` (proposal-events.md).

## Gate requests

A gate request is a proposal or one of four supervision requests. The WebSocket `send`
frame's `eventType` names the request kind (ws-delivery.md).

```ts
export const PolicySchema = z.enum(["auto", "ask", "suggest"]);

export const DmSeatSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ai") }),
  z.object({ kind: z.literal("human"), userId: z.uuid() }),
]);
export type DmSeat = z.infer<typeof DmSeatSchema>;

export const GateRequestSchema = z.discriminatedUnion("kind", [
  ...ProposalSchema.options,
  z.object({ kind: z.literal("proposal.approve"), proposalId: RefIdSchema }),
  z.object({ kind: z.literal("proposal.reject"), proposalId: RefIdSchema,
    reason: z.string().min(1).max(500).nullable().default(null) }),
  z.object({ kind: z.literal("dm.seat"), reason: ReasonSchema, after: DmSeatSchema }),
  z.object({ kind: z.literal("gate.policy"), reason: ReasonSchema,
    proposalKind: DmProposalKindSchema, policy: PolicySchema }),
]);
export type GateRequest = z.infer<typeof GateRequestSchema>;

export const GATE_REQUEST_KINDS: readonly string[];   // the 16 `kind` literals above
export const GATE_REQUEST_VERSION = 1;                 // the send frame's payloadVersion
```

## Proposers

```ts
export type Proposer =
  | { kind: "human"; userId: string; role: "operator" | "player" }
  | { kind: "ai"; actor: "ai:dm" }
  | { kind: "ai"; actor: `ai:companion:${string}` };

/** The row actor the gate writes: the user id, or the AI actor string. */
export function actorOf(p: Proposer): string;
```

The WebSocket gateway builds a `human` proposer from the connection's authenticated
identity. Only in-process server code (TASK-0046) can construct an `ai` proposer; no client
input can name one.

Derived roles, read from the DM projection (proposal-events.md, "Projection additions"):

| Role | Holds when |
|---|---|
| **seated human DM** | `gate.seat` is `{ kind: "human", userId }` and the proposer is that human |
| **AI DM** | the proposer is `ai:dm` (whatever the seat) |
| **operator** | a human proposer with role `operator` |
| **controller of C** | the party member `C`'s controller is `{ kind: "player", userId }` matching a human proposer, or `{ kind: "ai-companion", actor }` matching an AI proposer |
| **party member** | the proposer controls at least one party member |
| **table human** | any human proposer (seated or not) |

## Permission matrix

A proposer may submit a request when **any** role it holds allows it. Otherwise the gate
refuses with `NOT_AUTHORIZED` (source `gate`), before planning.

| Request | Seated human DM | AI DM (`ai:dm`) | AI companion | Human player |
|---|---|---|---|---|
| `talk` | yes | yes (policy) | yes | yes |
| `action.declare` | as controller only | no | for a character it controls; party scope if a party member | same as companion |
| `action.comment` | yes | yes (policy) | if a party member | if a party member |
| `action.commit` | yes (authority `dm`) | yes (policy; authority `dm`) | per commit authority | per commit authority |
| `action.resolve`, `mechanics`, `narration`, `table-mode`, `scene`, `party`, `tracker`, `journal` | yes, applied directly | yes (policy) | no | no |
| `proposal.approve`, `proposal.reject` | yes | no | no | no |
| `gate.policy` | yes | no | no | operator only |
| `dm.seat` | operator only | no | no | operator only |

Further checks inside a permitted kind:

- `talk` with `channel: "ic"` and a non-null `characterId` requires controlling that
  character, unless the proposer is a DM (an NPC voice uses `characterId: null`).
- `action.commit` runs commit authority (policy-and-authority.md).
- A human DM's and an operator's `dm.seat` may seat any user id or the AI DM.

"Applied directly" is AC #7: a seated human DM's submission of a DM kind skips the policy
and applies through the same planner an approved proposal uses.
