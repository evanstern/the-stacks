# Phase 1 — Data model

**This feature creates no schema.** No table, no migration, no row. Those are TASK-0012.
What it establishes is the *container* for all future data and the rules governing its
lifetime — which is a data concern even though it defines no fields.

## Persisted data volume

The operator's durable storage: a named Docker volume holding the entire Postgres data
directory.

| Property | Value | Why it matters |
|---|---|---|
| Kind | Named volume (not a bind mount, not anonymous) | An anonymous volume is discarded on recreate — silent data loss. A bind mount imports host path and permission problems |
| Lifetime | Survives container stop, start, and application image rebuild | FR-004, User Story 2 |
| Removal | Only by an explicit documented teardown | FR-009 — deletion possible, never accidental |
| Contents | Everything the operator owns: campaigns, imported books, session history | Principle VIII — it stays on their machine |

**The load-bearing rule**: ordinary lifecycle operations never destroy it. An operator who
stops the stack, upgrades the app image, or reboots the host still has their data. Only a
command whose documented purpose is removal removes it.

## Stack configuration

The environment-variable set the install requires. Fully specified in
[contracts/configuration.md](contracts/configuration.md).

| Property | Rule |
|---|---|
| Authoritative list | The committed example file — not source, not prose (SC-004) |
| Secrets | Placeholders only in the committed file; the operator's copy is git-ignored (FR-006, SC-005) |
| Missing values | Fail by name at startup, never as an opaque connection error (FR-010) |

## Database capabilities established here

Not data, but decided here and expensive to change once operators hold real content
(User Story 3).

| Capability | Requirement |
|---|---|
| Major version | Postgres 17 (FR-003) |
| Vector extension | Available for later use. This feature does not enable it in any database — that is a migration, TASK-0012 |
