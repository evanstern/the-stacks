# Specification Quality Checklist: Session auth for operator and invited players

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

**Zero `[NEEDS CLARIFICATION]` markers, deliberately.** The constitution's Architecture
Constraints table settles the approach outright — "Self-rolled session auth. Operator plus
invited players. No external IdP." — and architecture A1 fixes the stack. The remaining
questions (which hash, what lifetime, what cookie flags) are *design* decisions belonging
in `plan.md`'s research, not spec clarifications: a stakeholder cannot answer "argon2id or
scrypt," and the spec states the property (irreversible, bounded, unreadable by scripts)
that any correct choice must satisfy. `speckit-clarify` is therefore skipped, as the
runbook's per-task gate permits when architecture already settles direction.

**Three wording passes were applied during validation:**

1. An early FR-001 said passwords are "hashed with argon2id". That names an
   implementation, failing "No implementation details". Rewritten to the observable
   property — the stored form cannot be reversed — leaving the algorithm to the plan.
2. An early SC-003 read "wrong passwords are rejected". That is not measurable and, worse,
   understates the requirement: the security property is *indistinguishability* between a
   wrong password and a nonexistent account. Rewritten to state that, including the timing
   channel, because a response that differs only in latency still leaks.
3. An early US2 was titled "WebSocket authentication", naming a transport. Retitled to
   "One identity, recognized on every channel" and rewritten in terms of channels, since
   the requirement is that one validation serves both — not that a particular protocol is
   used.

**Two ambiguities were recorded as assumptions rather than spending clarification slots**,
because each has an unambiguous correct answer already available:

- **The "session" collision.** This product now has two: spec 004's `session_id` is a
  *play* session; this feature's sessions are sign-in state. Both are real, both are
  called "session", and conflating them in the schema would be a genuine defect. A4
  settles which is which, so it is an assumption, not a question.
- **Invitation delivery.** No mail infrastructure exists in M0 and adding one would be a
  dependency the Architecture Constraints table does not carry, so the operator delivers
  the invitation by hand. That follows from the constraints table rather than needing a
  decision.

**One scope omission is recorded rather than silently dropped**: rate limiting and lockout
are out of scope for M0. A single-tenant self-hosted install is not exposed to credential
stuffing the way a public service is, and naming the seam (the sign-in path) is more
honest than leaving a reader to wonder whether it was considered.
