# Phase 1 — Data model: the session event log

One table. Architecture A4 names its columns; constitution IV names its semantics. The
shape below adds nothing A4 does not call for.

## `events`

| Column | Type | Null | Notes |
|---|---|---|---|
| `session_id` | `uuid` | no | The play session this event belongs to. Opaque in M0 — no foreign key (see Assumptions in spec.md). |
| `seq` | `bigint` | no | Position within this session, origin 1, increment 1, gapless. Assigned by the append path (research D1), never by a sequence or identity column. |
| `actor` | `text` | no | Who or what caused the event. Not a foreign key: the AI DM is an actor and is not a user row (A4). |
| `type` | `text` | no | Event kind (`narration`, `chat`, `roll`, …). Opaque to the log (research D4). |
| `payload` | `jsonb` | no | Event details. Opaque to the log; validated by the system module at the server in M3, not here. |
| `payload_version` | `integer` | no | Schema version of `payload`. Separate from the payload so it is queryable without parsing (research D4). Constitution IV requires it. |
| `visibility` | `text` | no | Who may see this event. Defaults to the public marker so no event carries an absent visibility (FR-013). |
| `ts` | `timestamptz` | no | When the event was recorded. Server clock, defaulted at insert. |

### Keys and constraints

- **Primary key `(session_id, seq)`** — A4's identity for an event, and the backstop that
  makes a duplicate position impossible even if the append path were wrong (research D1).
- **`seq > 0`** — check constraint. The origin is 1, so a zero or negative position is
  malformed, and the check keeps that from being expressible.
- **`payload_version > 0`** — check constraint, same reasoning.
- **No `updated_at`, no soft-delete column.** The log is append-only (FR-004); a column
  implying mutation would invite it.

### Indexes

- The primary key `(session_id, seq)` already serves the only read the feature performs —
  "events for this session after this cursor, in order" — as a range scan. **No additional
  index is added**: a redundant index costs write throughput on the hottest write path in
  the system and buys nothing measurable.

### Append-only enforcement

FR-004 requires that a recorded event cannot be altered or removed. Two layers:

1. **No code path updates or deletes.** The data-access surface this feature exposes offers
   append and read. There is no update or delete function to call.
2. **A database-level guard** — a trigger rejecting `UPDATE` and `DELETE` on the table.
   This is the layer that matters: layer 1 protects against this application's own mistakes,
   layer 2 protects against every other client of the database, including a future migration,
   an ORM convenience method, and an operator at a `psql` prompt. Constitution IV states
   "nothing updates an event" as a property of the system, not a convention of one module.

## State transitions

An event has exactly one state: recorded. There is no lifecycle, no draft, no retraction.
A correction is a new event that refers to an earlier one — never an edit, because an edit
would change history a client has already replayed.

## Validation rules

Drawn from the spec's functional requirements:

- Session identifier, actor, type, payload, and payload version are required on append
  (FR-001, FR-005).
- Visibility is optional on append and defaults to the public marker (FR-013).
- `seq` is never supplied by a caller. It is computed by the append path, so a caller cannot
  create a gap or overwrite a position (FR-002).
- `ts` is never supplied by a caller. A client-supplied timestamp is a client-controlled
  ordering signal, and ordering here is the server's authority (constitution IV).
- A read takes a cursor (default: origin) and a maximum result size (FR-007), and returns
  events strictly after the cursor in ascending order (FR-006).
