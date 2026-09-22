# Specification Quality Checklist: WebSocket gateway with event-log append and cursor replay

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-22
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

### Validation record (2026-09-22)

**Zero `[NEEDS CLARIFICATION]` markers, deliberately.** Architecture A4 settles the
model — clients subscribe from a cursor, reconnect is replay, the server validates before
appending, hidden information lives in events with a `visibility` field — and the
constraints table fixes the transport (`ws`, one Node process). Both seams this feature
consumes are already frozen contracts from merged work: spec 004's append/cursor-read and
spec 005's `validateSession`. `speckit-clarify` is skipped, with the reason recorded here.

**Three wording passes were applied during validation:**

1. An early US2 was titled "WebSocket authority" and described "the `ws` upgrade handler
   rejecting unauthenticated sockets" — naming both a library and a mechanism. Rewritten
   as "Only the server decides what happened", stated in terms of what a client can and
   cannot cause. The requirement is server authority; the transport is incidental.
2. An early FR-010 said replay is "paginated". That is a mechanism, and an ambiguous one.
   Rewritten to the property: bounded batches, never one unbounded response, so a
   reconnecting client with a long history cannot exhaust the server.
3. An early SC-003 said reconnect "works correctly". Unmeasurable. Rewritten to the
   countable claim — zero missed, zero duplicated, **including events appended during the
   replay itself**, which is the boundary case the naive implementation gets wrong.

**Four ambiguities were recorded as assumptions rather than spending clarification slots**,
because each has an answer already settled by merged work or by architecture:

- **The two meanings of "session".** A connection has a *play* session (what events belong
  to) and an *auth* session (what it authenticated with). Both are called "session" in this
  product, they are unrelated, and conflating them would be a real defect. A4 and spec 005
  settle which is which.
- **No play-session registry exists.** Spec 004 deliberately left `session_id` opaque with
  no foreign key. For M0 a client subscribes to an identifier it already knows; creating
  and joining sessions is a later milestone, not an omission here.
- **Fan-out is in-process**, because A2 specifies one Node process. A broker would be a new
  service the constraints table does not carry. The seam to add one later is the fan-out
  step, named so it is findable.
- **Visibility is minimal in M0** — everyone, or one named person. The field and the
  filtering point must exist now because an event already delivered cannot be
  un-delivered; the richer rules arrive with the features that need them.

**One edge case is recorded as explicitly out of scope rather than silently unhandled**:
a session expiring while a connection is already open does not retroactively sever that
connection in M0. New connections are refused. Left ambiguous, this would be the kind of
gap someone later discovers in production; stated, it is a known bound.
