---
name: migrations
description: drizzle-kit generate writes committed SQL to apps/server/drizzle/; the db:migrate script runs on the HOST via Node's native TypeScript stripping, and prefers TEST_DATABASE_URL over DATABASE_URL for exactly that reason. Generated SQL sometimes needs a hand-added statement drizzle-kit can't emit — an extension, a trigger.
kind: pipeline
sources:
  - apps/server/scripts/migrate.ts
  - apps/server/drizzle.config.ts
  - apps/server/package.json
  - apps/server/drizzle/0004_glamorous_warlock.sql
  - apps/server/drizzle/0005_unknown_lizard.sql
  - apps/server/drizzle/0006_fearless_jamie_braddock.sql
verified_against: 2b58684eba93e597b951465770a9fa11cc5d4a24
---

# Migrations

Schema changes flow: edit `apps/server/src/schema/*.ts` → `pnpm db:generate` (`drizzle-kit
generate`, config in `apps/server/drizzle.config.ts`) writes a new SQL file into
`apps/server/drizzle/`, which is **committed** — this project never uses drizzle-kit's `push`.
Applying that SQL to a running database is a separate step: `pnpm db:migrate`.

## How it works

`drizzle.config.ts` points `drizzle-kit generate` at `schema: "./src/schema"`,
`out: "./drizzle"`, `dialect: "postgresql"`, reading `DATABASE_URL` for the connection it
introspects against. `db:generate` is a build-time tool run by a developer; it never runs in
the container.

`db:migrate` (in `apps/server/package.json`) is:

```
node --env-file-if-exists=../../.env --experimental-strip-types scripts/migrate.ts
```

Two things about that command matter. First, `--env-file-if-exists=../../.env` loads the
repo-root `.env` if present, but doesn't fail if it's absent — the command works whether or
not local overrides exist. Second, `--experimental-strip-types` runs `scripts/migrate.ts`
directly as TypeScript via Node's native type-stripping, **not** compiled by `tsc` — which is
why the script must be invoked with an explicit `.ts` extension and, per its own comment,
cannot use the `.js`-suffixed imports the rest of `src/` uses for its bundler-resolved build
(a raw-executed file resolving a `.js` import would fail one level deeper).

`scripts/migrate.ts` itself resolves the database URL as
`process.env.TEST_DATABASE_URL || config.databaseUrl` (where `config.databaseUrl` comes from
`DATABASE_URL` via `loadConfig`) — **`TEST_DATABASE_URL` first**. This script runs on the
**host** (the documented quickstart command is
`pnpm --filter @the-stacks/server db:migrate`, invoked from a developer's shell), but
`DATABASE_URL` names the address the **app container** uses (`@db:5432`, a compose service
name) — a name the host's DNS cannot resolve. Without this precedence the documented command
fails on every fresh setup with `Failed query: CREATE SCHEMA IF NOT EXISTS drizzle`.
`TEST_DATABASE_URL` names the same database from the host's perspective
(`@localhost:<DB_PORT>`). Inside the container `TEST_DATABASE_URL` is unset, so
`DATABASE_URL` applies and container-run migration is unaffected. Once resolved, the script
calls `drizzle-orm/node-postgres/migrator`'s `migrate(db, { migrationsFolder: "./drizzle" })`,
logs success or failure, and always closes the pool (`db.$client.end()`) in a `finally`.

**Migration history.** `0000` (events, append-only trigger), `0001` (auth tables), `0002` (the
`vector` extension and the library plane), `0003` (the `jobs` table), and `0004_glamorous_warlock.sql`
(TASK-0046: the DM runtime's job kinds — `book` nullable, `session_id`, new kind/stage CHECKs, four
partial unique indexes; see [[database-schema]] and [[dm-turn-jobs]]), and `0005_unknown_lizard.sql`
(TASK-0116: the `dm_model_calls` usage ledger — table, three CHECKs, a cascade FK to `jobs`, two
indexes; generated, no hand-added SQL; see [[debug-view]]), and `0006_fearless_jamie_braddock.sql`
(TASK-0114: the partial unique index `jobs_companion_react_queued_key`; regenerated after
TASK-0116's 0005 merged first, which is the collision rule below at work). Drizzle names each file with a random
suffix; the committed SQL is the source of truth.

**Collision rule.** Two branches that each generate the next migration produce the same number
with different names, and `meta/_journal.json` conflicts. Never hand-edit the journal. On a
collision, take the merged-first branch's files, delete your generated `NNNN_*.sql`,
`meta/NNNN_snapshot.json` and journal entry, and re-run `db:generate` so the file takes the next
number with a snapshot that chains from the merged one.

## Connections

Applies the schema declared for [[database-schema]], via the pool wiring in
[[database-access]]. The host-vs-container URL split is the general rule documented in
[[configuration]]; [[operator-provisioning]]'s `create-operator` script resolves its database
URL the identical way, for the identical reason.

## Operational notes

Generated migration files are committed and reviewed like any other source change — including
hand-added SQL `drizzle-kit generate` cannot produce, and which a later `generate` run will
not remove (it only appends new files, never edits existing ones). Two kinds have shown up so
far: the append-only trigger described in [[database-schema]], and, in
`apps/server/drizzle/0002_tiny_odin.sql` ([[library-schema]]), a leading
`CREATE EXTENSION IF NOT EXISTS vector;` (pgvector isn't enabled by drizzle-kit, so it's
added by hand as the migration's first statement) plus that table set's own
`library_immutable` trigger. `0003_dazzling_cargill.sql` (`jobs`, TASK-0024, [[ingestion]])
needed no hand-added SQL at all — its CHECK constraints and partial unique index are both
expressible directly in the Drizzle schema (`schema/jobs.ts`), unlike `0002`'s extension and
trigger.
