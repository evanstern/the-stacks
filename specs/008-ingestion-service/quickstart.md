# Quickstart: Validating the Ingestion Service

Runnable scenarios proving the spec's success criteria against a live stack. Contracts:
[api.md](contracts/api.md), [events.md](contracts/events.md); schema:
[data-model.md](data-model.md). Fixtures referenced here are the synthetic ones shipped
in `packages/ingestion-plugins/fixtures/` (Principle I — no proprietary content).

## Prerequisites

```bash
cp .env.example .env        # set the two documented secrets
docker compose up -d --build --wait   # five services; ml readiness gates on model load
# login once; cookie jar for subsequent calls
curl -c /tmp/stacks.jar -d '{"password":"<operator password>"}' \
  -H 'content-type: application/json' http://localhost:4401/v1/auth/login
```

`pnpm verify` must pass before any scenario (boundaries incl. the new plugin rules,
tsc, vitest incl. conformance suites — SC-010). DB-gated integration suites:
`RUN_DB_INTEGRATION_TESTS=1 DATABASE_URL=postgresql://stacks_v3:stacks_v3@localhost:5442/stacks_v3 pnpm test`.

## Scenario 1 — DDB happy path via the web surface (SC-001, SC-002; US1)

1. Open `http://localhost:4400/library/upload`, submit
   `fixtures/ddb/goblin-page.html`.
2. Browser lands on `/library/uploads/source/<id>`; the page self-refreshes until
   status `ingested`.
3. **Expect**: acceptance was immediate (ticket visible < 2 s — SC-002); final view
   shows plugin `ddb-saved-html` with confidence, section/chunk counts, and the full
   stage trail intake→…→commit (SC-001).
4. Traceability (SC-001's 100% claim), via psql:

   ```sql
   SELECT count(*) FROM chunks c JOIN sources s ON s.id = c.source_id
   WHERE s.id = '<id>' AND c.generation = s.current_generation
     AND (c.anchor->>'artifactId') IS NULL;   -- expect 0
   ```

## Scenario 2 — status visibility incl. failure (SC-006; US2)

1. Upload `fixtures/malformed/truncated.html` (declares HTML, broken content).
2. **Expect**: job retries then fails; ticket page shows status `failed`, the failing
   stage, a scrubbed cause-typed reason; the event trail retains every attempt's
   events (append-only — re-fetch later, unchanged).

## Scenario 3 — honest front door (SC-003, SC-005; US3)

```bash
# 415, no residue (SC-005): unsupported type
curl -b /tmp/stacks.jar -F file=@fixtures/rejects/sample.pdf http://localhost:4401/v1/uploads   # expect 415
# 415: over the cap
head -c 30000000 /dev/urandom > /tmp/big.html
curl -b /tmp/stacks.jar -F file=@/tmp/big.html http://localhost:4401/v1/uploads                 # expect 415
# duplicate (SC-003): second POST of the same bytes
curl -b /tmp/stacks.jar -F file=@fixtures/markdown/notes.md http://localhost:4401/v1/uploads    # 201
curl -b /tmp/stacks.jar -F file=@fixtures/markdown/notes.md http://localhost:4401/v1/uploads    # 200, duplicate:true, same ticket
```

Residue check after the two 415s: `SELECT count(*) FROM sources; SELECT count(*) FROM
jobs WHERE kind LIKE 'ingest%';` — counts unchanged from before.

## Scenario 4 — ZIP batch with mixed entries (US1 AC-4, US3 AC-4)

1. Upload `fixtures/ddb/export-mixed.zip` (2 DDB pages, 1 markdown, 1 `.dat`).
2. **Expect**: batch ticket; final `entryReport` shows 3 ingested + 1
   skipped-with-reason; each ingested entry is its own source with its own trail.

## Scenario 5 — retry idempotency (SC-004; spec edge case)

Integration test (in `@stacks/ingestion` DB-gated suite), not manual: run
`ingest_source` to completion; snapshot chunk ids; force-kill a second run of the same
payload after `chunk`; let the queue retry to completion.
**Expect**: final chunk-id set and row contents identical to the snapshot
(deterministic IDs + ON CONFLICT + embed skip-existing).

## Scenario 6 — fallback detection (US4)

Upload `fixtures/html/plain-article.html` (non-DDB HTML) and
`fixtures/markdown/notes.md`.
**Expect**: sources record `generic-html` / `markdown` as owning plugins; the DDB
plugin's confidence for the article appears in the `detect` event's `candidates` map
as ~0.

## Scenario 7 — new plugin without core changes (SC-007; US5)

Covered by the conformance-demo test: `packages/ingestion-plugins` contains a synthetic
`demo-format` plugin used only in tests. Verification is reviewable, not manual:

```bash
git log --oneline -- packages/ingestion/src   # the commit adding demo-format touches nothing here
pnpm --filter @stacks/ingestion-plugins test  # its conformance run passes (SC-010)
```

## Scenario 8 — re-ingestion after plugin change (SC-008; US5 AC-3)

Integration test: ingest a fixture at plugin version X; bump the demo plugin's version;
enumerate candidates (`SELECT id FROM sources WHERE plugin_name='demo-format' AND
plugin_version='X'`); re-ingest; **expect** generation flipped to N+1, old-generation
rows swept, archive row byte-identical, no duplicate chunks under the current
generation.

## Scenario 9 — structure-aware chunking (SC-009)

Assertion inside the DDB plugin's pipeline test: for every fixture, no chunk's
`section_ids` splits a `stat_block`/`table`/`spell_entry` section across two chunks
(query: atomic section id appearing in >1 chunk of the same generation ⇒ fail).

## Scenario 10 — embedding provenance (FR-020)

```sql
SELECT count(*) FROM chunks WHERE embedding IS NOT NULL
  AND (embedding_provider IS NULL OR embedding_model IS NULL
       OR embedding_dimensions IS NULL);   -- expect 0 (also a table CHECK)
```

## Success-criteria coverage map

| SC | Scenario | SC | Scenario |
|---|---|---|---|
| SC-001 | 1 | SC-006 | 2 |
| SC-002 | 1 | SC-007 | 7 |
| SC-003 | 3 | SC-008 | 8 |
| SC-004 | 5 | SC-009 | 9 |
| SC-005 | 3 | SC-010 | prerequisites (`pnpm verify`) |
