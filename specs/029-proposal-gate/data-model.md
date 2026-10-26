# Data Model: First Scene — proposal gate

No table, column or migration. Every entity below is either a payload in the existing
`events` table (028 data model) or a derived projection. Schemas are in `contracts/`.

## Stored entities (event payloads)

| Event type | Payload | Visibility | Written by |
|---|---|---|---|
| `proposal.created` | `proposalId`, `policy` (`ask`/`suggest`), `proposal` | `dm` only | gate, for an `ai:dm` proposal under a human seat |
| `proposal.approved` | `proposalId`, `batchId` | `dm` only | gate, on the seated DM's approval, atomically with the effects |
| `proposal.rejected` | `proposalId`, `reason` | `dm` only | gate, on the seated DM's rejection |
| `dm.seat.changed` | `reason`, `before`, `after` (`DmSeat`) | public | gate, on an operator's `dm.seat` request |
| `gate.policy.changed` | `reason`, `proposalKind`, `before`, `after` (`Policy`) | public | gate, on a `gate.policy` request |
| mechanics envelope (existing) | `proposalId` now defined | per proposal | gate |

## Request entities (never stored as-is)

- **Proposal** — twelve kinds (contracts/proposals.md). Stored only inside
  `proposal.created`, or as the rows it plans into.
- **Gate request** — a proposal or `proposal.approve`, `proposal.reject`, `dm.seat`,
  `gate.policy`.
- **Proposer** — `human` (user id, role) or `ai` (`ai:dm`, `ai:companion:<id>`).

## Validation rules

- Every request is parsed with `GateRequestSchema` (or `ProposalSchema` for `submit`) before
  anything else.
- Every planned row is validated against its catalog schema by the planner and again by the
  session seam.
- `proposal.*` rows must carry `dm` visibility (seam refusal `VISIBILITY_NOT_ALLOWED`).
- `mechanics.command` is validated only by the engine.

## State transitions

### Proposal

```
                 approve (ask only, seated DM, re-plan ok)
 created ──▶ pending ───────────────────────────────▶ approved
                │
                └── reject (seated DM) ─────────────▶ rejected
```

- A `suggest` proposal is `pending` until rejected; approving it is refused.
- An approval whose re-plan refuses leaves the proposal `pending` and writes nothing.
- No transition out of `approved` or `rejected`.

### DM seat

`{ kind: "ai" }` initially; any `dm.seat.changed` sets `after`. Pending proposals are
unaffected by seat changes.

### Policy override

Absent (default) until a `gate.policy.changed` for the kind; then its `after`.

## Projection entities (derived, never stored)

- `gate: GateView` — `seat`, `policyOverrides`.
- `proposals: ProposalView[]` — DM viewer only; `[]` for a player.

## Viewers

| Viewer | Who | Sees `dm` rows |
|---|---|---|
| DM | the seated human DM's connection; the gate's server-side fold | yes |
| Player | every other connection | no |

With an AI seat, only the server's fold is a DM viewer.
