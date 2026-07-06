# Data Model: v3 Walking Skeleton

**Branch**: `007-v3-skeleton` | **Date**: 2026-07-05

Schema source of truth: `v3/packages/db/src/schema/` (Drizzle, TypeScript), realized as
versioned SQL migrations in `v3/packages/db/migrations/` (see research R2, R10).
Migration 0001 enables the `vector` extension and creates the tables below.

## Entity overview

| Entity (spec) | Realization |
|---|---|
| Operator Session | Sealed cookie — **no table** (research R5) |
| Skeleton Check Run | `skeleton_check_runs` table |
| Check Event | `skeleton_check_events` table (append-only) |
| Model Role Configuration | Env-derived value object in `@stacks/core` — **no table** |
| Stored Vector | `skeleton_vectors` table |
| (supporting) Job | `jobs` table — the Postgres queue (D12) |

## Tables

### `jobs`

The queue. Generic by design — the skeleton check is its first `kind`; ingestion adds
more later without schema change.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | trackable identity |
| `kind` | `text` | NOT NULL | e.g. `skeleton_check` |
| `payload` | `jsonb` | NOT NULL, default `{}` | kind-specific input |
| `status` | `text` | NOT NULL, CHECK in (`queued`,`claimed`,`succeeded`,`failed`), default `queued` | |
| `attempts` | `integer` | NOT NULL, default 0 | incremented on claim |
| `max_attempts` | `integer` | NOT NULL, default 3 | |
| `run_at` | `timestamptz` | NOT NULL, default `now()` | backoff scheduling |
| `claimed_by` | `text` | NULL | worker instance id |
| `claimed_at` | `timestamptz` | NULL | visibility-timeout base |
| `last_error` | `jsonb` | NULL | `{code, seam?, message}` typed by cause |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

Indexes: `(status, run_at)` for claim scans.

**State machine**: `queued → claimed → succeeded | failed`; `claimed → queued` on
retryable failure with attempts left (backoff via `run_at`) or on visibility-timeout
reclaim (`claimed_at` older than `WORKER_VISIBILITY_TIMEOUT_MS`); `claimed/queued →
failed` when attempts exhaust. Claim uses `FOR UPDATE SKIP LOCKED` (research R6).

### `skeleton_check_runs`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | returned to UI on accept |
| `job_id` | `uuid` | NOT NULL, FK → `jobs.id` | queue linkage |
| `status` | `text` | NOT NULL, CHECK in (`accepted`,`running`,`succeeded`,`failed`), default `accepted` | |
| `input_text` | `text` | NOT NULL | small fixed synthetic fixture |
| `outcome` | `jsonb` | NULL | on failure: `{class: 'dependency_down'\|'internal_fault', seam, message}` (FR-011) |
| `vector_id` | `text` | NULL, FK → `skeleton_vectors.id` | set on success |
| `readback_distance` | `double precision` | NULL | cosine distance of similarity read-back |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `started_at` | `timestamptz` | NULL | worker claim time |
| `completed_at` | `timestamptz` | NULL | |

**State machine**: `accepted → running → succeeded | failed`. A failed run is terminal;
recovery is a **new** run (FR-011's "succeed on a later run"), keeping history honest.
Status transitions mirror the job's but are the operator-facing lifecycle (FR-009).

**Validation rules**: `outcome` NOT NULL iff `status='failed'`; `vector_id` and
`readback_distance` NOT NULL iff `status='succeeded'` (enforced in domain code, pinned
by tests).

### `skeleton_check_events`

Append-only (Principle IV, FR-010). No UPDATE/DELETE path exists in code; the table
grants could revoke them in prod shape, but skeleton enforcement is by construction —
`@stacks/db` exposes only an insert helper.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `bigint` | PK, generated always as identity | insertion order |
| `run_id` | `uuid` | NOT NULL, FK → `skeleton_check_runs.id` | |
| `seam` | `text` | NOT NULL, CHECK in (`queued`,`claimed`,`inference`,`vector_write`,`vector_readback`,`completed`) | one per seam crossed (FR-010) |
| `ok` | `boolean` | NOT NULL, default true | false on the failing seam |
| `detail` | `jsonb` | NOT NULL, default `{}` | e.g. model identity, distance, error class |
| `duration_ms` | `integer` | NULL | timing per seam (FR-010) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

Index: `(run_id, id)`.

A successful run therefore shows exactly six events (`queued`, `claimed`, `inference`,
`vector_write`, `vector_readback`, `completed`) — the SC-002 inspection criterion. A
failed run shows the trail up to and including the failing seam with `ok=false`.

### `skeleton_vectors`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `text` | PK | **deterministic**: `sha256(input_text + '\n' + provider + '/' + model + '/' + dimensions)` — idempotent re-runs (FR-012) |
| `content` | `text` | NOT NULL | the embedded text |
| `embedding` | `vector` | NOT NULL | un-dimensioned (research R8) |
| `embedding_provider` | `text` | NOT NULL | stamp (FR-014) |
| `embedding_model` | `text` | NOT NULL | stamp (FR-014) |
| `embedding_dimensions` | `integer` | NOT NULL | stamp (FR-014) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

Write is `INSERT ... ON CONFLICT (id) DO NOTHING` — re-running the check with identical
input and configuration produces zero duplicates (SC-007). Read-back:
`SELECT id, embedding <=> $query AS distance FROM skeleton_vectors WHERE
embedding_model = $model AND embedding_provider = $provider AND
embedding_dimensions = $dims ORDER BY distance LIMIT 1` — the model-identity filter is
what makes a changed embedding role a *detectable mismatch* (no rows for the new
identity) rather than a silent cross-space comparison (spec edge case, Principle VII).

## Value objects (no tables)

### Operator Session (sealed cookie)

`{ operator: true, issuedAt: epoch-ms }`, encrypted+authenticated by
`@fastify/secure-session` with a key derived from `SESSION_SECRET`; HTTP-only,
`SameSite=Lax`, maxAge 30 days. Absent/expired/tampered cookies all decrypt to
no-session → 401 on API surfaces, redirect-to-login in web routes (spec edge case).

### Model Role Configuration (`@stacks/core`)

Resolved once at process start from env (contract in
[contracts/environment.md](./contracts/environment.md)):

```ts
type ModelRoleConfig = {
  role: 'embedding'            // skeleton scope; later roles: chat, quick-ask, judge, reranker
  provider: 'local-sidecar'    // skeleton scope; later: anthropic | openai | openai-compatible
  endpoint: string             // e.g. http://ml:4402
  modelId: string              // e.g. sentence-transformers/all-MiniLM-L6-v2 (from env only)
  dimensions: number
}
```

Referenced by name in product logic (`resolveModelRole('embedding')`); missing or
malformed env fails startup fast, naming the variable (spec edge case, FR-013/D14).

### Typed domain errors (`@stacks/core`)

```ts
type ErrorClass = 'unknown_thing' | 'unsupported_type' | 'dependency_down' | 'internal_fault'
```

Carried on a `DomainError { class, seam?, message, cause? }`; mapped to transport codes
only at the API boundary (contracts/api.md) and stored in `jobs.last_error` /
`skeleton_check_runs.outcome` (FR-011, FR-018).

## Relationships

```text
jobs 1 ──── 1 skeleton_check_runs        (job_id; queue linkage)
skeleton_check_runs 1 ──── * skeleton_check_events   (run_id; append-only trail)
skeleton_check_runs * ──── 0..1 skeleton_vectors     (vector_id; many runs may share
                                                      one deterministic vector — that
                                                      sharing IS the idempotency proof)
```
