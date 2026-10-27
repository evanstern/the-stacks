# Contract: proposals, gate requests, proposers and permissions

Package: `@the-stacks/session-model` (`packages/session-model/src/gate/`), exported from the
main entry. Binding for TASK-0046 (the DM runtime builds proposals), TASK-0047 (the play
route sends gate requests and renders proposal bodies) and this task's server gate. A change
to any kind, field, permission or visibility rule below is a contract change: update this
file in the same PR.

**Amendment (TASK-0114).** Amended by the operator ruling "W-A: add withdraw" on TASK-0114 (checkpoint W, 2026-10-26; spec 036-companion-react, FR-017 to FR-019). The kinds grew from twelve to thirteen: `action.withdraw`
is new. Every other rule below is unchanged.

**Amendment (TASK-0141).** Amended 2026-10-27 (TASK-0141, operator ruling OQ-1):

> "TASK-0141 OQ-1 (a) scene-presence.changed via a new scene-presence proposal kind including
> the frozen 029 and 028 amendments, OQ-2 (a)"

The kinds grew from thirteen to fourteen, and the DM kinds from eleven to twelve:
`scene-presence` is new. `GATE_REQUEST_KINDS` grew from 17 to 18 literals. Every other rule
below is unchanged.

**Amendment (TASK-0142).** Amended 2026-10-27 (TASK-0142, operator ruling OQ-4):

> "TASK-0142: I accept the recommended defaults OQ-1 to OQ-6 (a), including the frozen 029 and
> 031 amendments" (OQ-4 (a): the `scene-presence` proposal gains optional `visibility`, `public`
> default, or `dm`; scene-start seed rows are `dm`)

`scene-presence` gains `visibility: "public" | "dm"`, default `"public"`. The rule
"`scene-presence` is always `public`" (Visibility, below) now reads "`scene-presence` is `public`
unless the proposal says `dm`". No kind is added. Every other rule below is unchanged.

**Amendment (TASK-0050, stall override).** Amended 2026-10-27 (TASK-0050, operator ruling FT-5):

> "TASK-0050: I accept the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the
> frozen-contract amendments to 029, 031 and 044 and the one jobs migration."

`action.commit` gains the optional field `override: "stall"`. Only `ai:dm` may send it. It applies
to an open party action when the party has two or more humans; any other use is
`INVALID_PROPOSAL`. The planned rows are in gate-api.md. A commit without `override` is unchanged.

**Amendment (TASK-0050).** Amended 2026-10-27 (TASK-0050, operator ruling FT-1):

> "TASK-0050: I accept the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the
> frozen-contract amendments to 029, 031 and 044 and the one jobs migration."

The kinds grew from fourteen to fifteen, and the DM kinds from twelve to thirteen: `floor` is new
(`op: end | take | return`, `turn: { round, combatantId }`, `reason`; always `public`).
`GATE_REQUEST_KINDS` grew from 18 to 19 literals. The permission rows are in the matrix below
and the planned rows are in gate-api.md. Every other rule is unchanged.

Siblings: [policy-and-authority.md](policy-and-authority.md),
[proposal-events.md](proposal-events.md), [gate-api.md](gate-api.md),
[ws-delivery.md](ws-delivery.md), [fixtures.md](fixtures.md),
[write-boundary.md](write-boundary.md).

## Proposal kinds

Fifteen kinds, closed:

```ts
export const ProposalKindSchema = z.enum([
  "talk", "action.declare", "action.comment", "action.commit", "action.withdraw",
  "action.resolve", "mechanics", "narration", "table-mode", "scene", "party", "tracker",
  "scene-presence", "journal", "floor",
]);
export type ProposalKind = z.infer<typeof ProposalKindSchema>;

/** The thirteen kinds the AI DM may propose; the policy table is total over these. */
export const DmProposalKindSchema = ProposalKindSchema.exclude(["action.declare", "action.withdraw"]);
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
    actionId: RefIdSchema,                          // authority is derived by the gate, never supplied
    override: z.literal("stall").optional() }),     // `ai:dm` only; spec 049 stall override
  z.object({ kind: z.literal("action.withdraw"), ...ProposalNote,
    actionId: RefIdSchema }),                       // closes an open action; TASK-0114 amendment

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
  z.object({ kind: z.literal("scene-presence"), ...ProposalNote,
    actorId: RefIdSchema, reason: PresenceReasonSchema, actionId: RefIdSchema.nullable().default(null),
    visibility: z.enum(["public", "dm"]).default("public") }),
  z.object({ kind: z.literal("journal"), ...ProposalNote,
    entry: JournalEntryAddedV1, visibility: z.enum(["public", "dm"]).default("public") }),
  z.object({ kind: z.literal("floor"), ...ProposalNote,           // TASK-0050 amendment, FT-1
    op: z.enum(["end", "take", "return"]),
    turn: z.object({ round: z.number().int().min(1), combatantId: CombatantIdSchema }),
    reason: ReasonSchema }),
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
- **The gate fills `before` and `after` for `scene-presence`.** The proposal carries `actorId`,
  `reason` and `actionId`. The gate reads `before` from the `scenePresence` projection (`present`
  when there is no entry) and derives `after` from the reason (`REASON_TO_PRESENCE`).
- **`mechanics.command` is `unknown` on the wire.** The engine's `execute` parses it
  (engine-api.md: "a gate that forwards an LLM proposal cannot skip validation"). A bad
  command refuses with the engine's `INVALID_COMMAND`, source `engine`.
- **Visibility.** `talk` and `narration` accept any visibility (`public`, `dm`, a user id).
  `mechanics` and `journal` accept `public` or `dm`. Actions, `table-mode`, `scene` and
  `party` are always `public`. `tracker` is always `dm`. `scene-presence` is `public` unless the proposal says `dm`. Proposal lifecycle events are always
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

export const GATE_REQUEST_KINDS: readonly string[];   // the 19 `kind` literals above
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
| `action.withdraw` | yes | no | for an action it declared | for an action it declared |
| `action.resolve`, `mechanics`, `narration`, `table-mode`, `scene`, `party`, `tracker`, `scene-presence`, `journal` | yes, applied directly | yes (policy) | no | no |
| `floor` `end` | yes (Pass); `ai:dm` only for an absent active human, else `NOT_AUTHORIZED` | yes (policy) | the active actor; another party member gets `FLOOR_NOT_HELD` at plan time | same as companion |
| `floor` `take`, `return` | yes | no (`NOT_AUTHORIZED`) | no (`NOT_DM` for a party member) | no (`NOT_DM` for a party member; `NOT_AUTHORIZED` otherwise) |
| `proposal.approve`, `proposal.reject` | yes | no | no | no |
| `gate.policy` | yes | no | no | operator only |
| `dm.seat` | operator only | no | no | operator only |

Further checks inside a permitted kind:

- `talk` with `channel: "ic"` and a non-null `characterId` requires controlling that
  character, unless the proposer is a DM (an NPC voice uses `characterId: null`).
- `action.commit` runs commit authority (policy-and-authority.md).
- `action.withdraw` is permitted for the action's declarer (the row `actor` of its
  `action.declared`) and for the seated human DM. An unknown action passes the matrix and is
  refused by the planner with `UNKNOWN_ACTION`. `ai:dm` is `NOT_AUTHORIZED`, as for
  `action.declare`, so `action.withdraw` has no policy entry. The planner refuses an action
  that is not open (`declared` or `discussed`) with `ACTION_NOT_OPEN`, before writing.
- A human DM's and an operator's `dm.seat` may seat any user id or the AI DM.

"Applied directly" is AC #7: a seated human DM's submission of a DM kind skips the policy
and applies through the same planner an approved proposal uses.
