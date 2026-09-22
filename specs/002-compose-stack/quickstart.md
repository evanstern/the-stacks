# Quickstart — validating this feature

**This file is also the deliverable.** SC-001 requires a stranger to reach a working
install in at most three documented steps, so these instructions are what the README must
carry — an undocumented working stack fails FR-001.

## Prerequisites

Docker with Compose. **Nothing else** — no Node, no pnpm, no Postgres on the host. If a
validation step requires installing anything beyond Docker, this feature has not met its
requirement.

## The three steps (SC-001)

```
git clone <repo> && cd the-stacks
cp .env.example .env          # then edit: set a real POSTGRES_PASSWORD
docker compose up -d
```

## Validation

### 1. Both services reach healthy (US1, SC-002)

```
docker compose ps
```

Expect both services `healthy` within 2 minutes of a cold start including image build.
`running` is not sufficient — the application's health must come from its own `/health`
endpoint, not from "the process has not exited" (FR-007).

### 2. Health is honest about the database (US1, contracts/healthcheck.md)

```
docker compose stop db
docker compose ps
```

The application container must become **unhealthy**, even though `GET /health` still
returns `200`. If it stays healthy, the healthcheck is reading the status code instead of
the body — the exact defect research D1 exists to prevent.

```
docker compose start db
```

It must return to healthy without a manual restart (FR-008).

### 3. Data survives a full restart (US2, SC-003)

```
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "create table if not exists _persist_check (id int); insert into _persist_check values (1);"
docker compose down            # NOT `down -v`
docker compose up -d
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "select count(*) from _persist_check;"
```

Expect `1`. Then drop the check table.

### 4. Data survives an application image rebuild (US2)

```
docker compose build app && docker compose up -d
```

Database contents unaffected.

### 5. The database is what the project will need (US3)

```
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select version();"
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "select * from pg_available_extensions where name = 'vector';"
```

Expect major version 17, and `vector` present as available. It need not be *enabled* —
enabling is a migration (TASK-0012).

### 6. Missing configuration fails by name (FR-010, edge case)

Move `.env` aside and start the stack. The failure must name the missing configuration
rather than surfacing an opaque connection error.

### 7. Deliberate teardown works, and only deliberately (FR-009, US2 scenario 3)

```
docker compose down -v
```

Removes the volume. The contrast with step 3's plain `down` is the point: the destructive
form is explicit and documented.

## What "done" looks like

All seven validations behave as described — especially **step 2**, which is the one a
passing-looking implementation can silently fail. The terminal output goes in the PR body;
it stands in for the CI that TASK-0017 has not built yet.
