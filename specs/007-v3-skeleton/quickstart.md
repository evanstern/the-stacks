# Quickstart: v3 Walking Skeleton Validation

Runnable scenarios proving the feature end-to-end. Contracts:
[api.md](./contracts/api.md), [ml-sidecar.md](./contracts/ml-sidecar.md),
[environment.md](./contracts/environment.md). Data shapes:
[data-model.md](./data-model.md).

## Prerequisites

- Docker Desktop (or engine + compose v2) running
- Node.js 22 + pnpm 10 (only for scenario 5's verification command)
- The v2 stack may be running — it must not matter (scenario 6)

## Setup

```bash
cd v3
cp .env.example .env
# Set the two required secrets (generation commands are documented in .env.example):
#   OPERATOR_PASSWORD_HASH  (bcrypt hash of your chosen password)
#   SESSION_SECRET          (>= 32 random chars)
```

## Scenario 1 — One-command startup and sign-in (User Story 1, SC-001)

```bash
docker compose up -d --build --wait
```

**Expected**: exits 0 with all five services healthy; first run < 15 min (one-time
model download), later runs < 3 min. No manual steps between clone and ready.

```bash
curl -s localhost:4400/          # web up (redirects to sign-in)
curl -s localhost:4401/ready     # {"status":"ready",...} — migrations applied
curl -s localhost:4402/ready     # {"status":"ready","model":...} — model loaded
```

Browser: `http://localhost:4400` → sign-in page → correct password → authenticated
home surface. Wrong password → "Sign-in failed." with no session cookie set
(acceptance 1.3). Restart (`docker compose restart`) → ready noticeably faster, data
intact (acceptance 1.4).

## Scenario 2 — Skeleton check crosses every seam (User Story 2, SC-002)

From the authenticated home, trigger **Run skeleton check**.

**Expected**:
- Immediate acceptance with a run id; UI shows `accepted → running → succeeded`
  without blocking (acceptance 2.1); total < 60 s.
- Run detail view shows the append-only trail with all six events — `queued`,
  `claimed`, `inference`, `vector_write`, `vector_readback`, `completed` — each with
  timing (acceptance 2.2).
- The vector block shows provider/model/dimensions matching your `.env`'s embedding
  role (acceptance 2.3, FR-014).

API equivalent (dev-published port; cookie from your browser session):

```bash
curl -s -X POST localhost:4401/api/skeleton-checks -H "cookie: stacks_v3_session=..."   # 202 {run:{id,...}}
curl -s localhost:4401/api/skeleton-checks/<id>   -H "cookie: stacks_v3_session=..."   # status + events
```

## Scenario 3 — Legible failure and recovery (SC-003)

```bash
docker compose stop ml
# trigger a check from the UI
```

**Expected**: run fails in < 30 s with `outcome: {class: "dependency_down", seam:
"inference"}` — not a hang, not a generic error; the event trail ends at the
`inference` seam with `ok: false` (acceptance 2.4).

```bash
docker compose start ml   # wait for /ready
# trigger a new check
```

**Expected**: new run succeeds with no manual cleanup.

## Scenario 4 — Idempotent re-runs (SC-007)

Trigger the check twice; open both run records.

**Expected**: both succeed and reference the **same** vector id (deterministic,
input+model-derived); the second run's `vector_write` event shows
`deduplicated: true`; the vectors table gains no duplicate row.

## Scenario 5 — Developer verification (User Story 3, SC-005)

```bash
cd v3
pnpm install
pnpm verify
```

**Expected**: type checks + core/db/worker/api tests (including the four error-class
contract tests, FR-018) + web tests all pass, < 10 min on fresh checkout.

Migration check (acceptance 3.2): add a trivial migration under
`packages/db/migrations/` (e.g. a comment-only table alteration via
`pnpm --filter @stacks/db generate`), then `docker compose up -d` — the API applies it
on boot and records it in the migrations journal before reporting ready.

## Scenario 6 — v2 coexistence (SC-004)

With v2 running from the repo root (`docker compose up -d` there):

```bash
docker compose -p the-stacks-v3 ps            # v3 services healthy
docker ps --format '{{.Names}}\t{{.Ports}}'   # no shared ports: v2 on 5433/6334/5050/8001/5174, v3 on 4400-4402/5442
docker volume ls | grep -E 'the-stacks-v3|rag-retrieval'  # disjoint volume sets
```

**Expected**: both stacks up simultaneously, zero port/name/volume collisions; v2's
documented smoke checks still pass.

## Scenario 7 — No secrets, no hardcoded models (SC-006)

```bash
grep -rn "sentence-transformers" v3/apps v3/packages --include='*.ts' --include='*.tsx' --include='*.py'  # no hits — model ids live in env contract only
git -C v3 grep -iE 'sk-[a-zA-Z0-9]|password.*=.*[^example]' -- ':!*.example' || echo "clean"
```

**Expected**: model identifiers appear only in `.env.example`/compose defaults
(configuration), never in product code; no secrets in the repo.
