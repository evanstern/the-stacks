# Module 1: One Command, Five Services

Write to: `modules/01-skeleton.html` — `<section class="module" id="module-1">` only.

## AUDIENCE OVERRIDE (applies to every module in this course)
The learner is a **skilled, time-poor software developer** — NOT the skill's default "vibe coder."
- Do NOT tooltip or explain CS fundamentals (API, JSON, database, container, env var…).
- DO tooltip project/doctrine terms on first use: *walking skeleton*, *seam*, *accept-then-async*,
  *append-only*, *visibility timeout*, *sealed cookie*, *pgvector*, *SKIP LOCKED*, and decision
  codes like *D12* ("Fixed technical decision #12 from the project's constitution: the queue is a
  Postgres table, not a broker").
- Metaphors are welcome but crisp and dev-flavored; never condescending, never "restaurant."
- Quizzes test architecture reasoning and debugging intuition, not definitions.

## Teaching Arc
- **Metaphor:** A walking skeleton is a *pencil sketch before the painting* — every structural line
  present and load-bearing, zero rendering. (Also introduce the classic Cockburn sense: thinnest
  end-to-end slice that exercises every architectural seam.)
- **Opening hook:** "You type one command. Ninety seconds later five services report healthy and you
  can sign in. This course is about everything that one command commits you to."
- **Key insight:** The boot order IS the architecture: postgres → api (which migrates BEFORE
  binding its port) → ml/worker/web, chained by compose `service_healthy` conditions — so "the
  stack is up" *provably means* "the schema is current and every dependency answers."
- **Why should I care?:** When you build the next feature (ingestion, retrieval, chat), every seam
  you'll rely on is already proven. And when startup breaks, the healthy-chain tells you exactly
  which link to look at.

## Course framing to open the module (1 short screen)
This is "the Stacks" v3 — a greenfield rebuild of a TTRPG research-library app (bring-your-own
rulebooks, retrieval-backed chat with real citations). Before any feature, the team shipped a
*walking skeleton*: a pnpm monorepo + five-service Docker Compose stack + one thin end-to-end probe
("skeleton check") that crosses UI → API → queue → worker → ML sidecar → pgvector and back. Spec'd
via spec-kit (specs/007-v3-skeleton/), built against a constitution with fixed decisions D1–D14.

## Screens (4)
1. Hook + what/why of a walking skeleton (tooltip the term), the one command:
   `docker compose up -d --build --wait` → five healthy services (postgres, api, ml, worker, web).
2. **HERO: Data-flow animation of the boot chain** (see Interactive Elements).
3. Code↔English: the API boot sequence (snippet A) — env fail-fast, model-role validation,
   migrate-before-listen doctrine. Callout ("aha!"): */ready is a proof, not a ping — because
   migrations run before `listen()`, a green readiness check certifies schema-currency.*
4. The two odd healthchecks (snippet B + C as a side-by-side or cards): probing with `node -e
   fetch(...)` because slim images have no curl; the worker's heartbeat-file check because it has
   no HTTP surface. End with quiz + 1-sentence handoff to Module 2 (the map of what's inside
   those containers).

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `v3/apps/api/src/main.ts` (lines 27-50)
```ts
async function main(): Promise<void> {
  assertRequiredEnv();
  // Fails fast (naming the variable) if the embedding role's env is missing/malformed.
  // The API never embeds — the worker does — but validating here surfaces a bad
  // embedding config at deploy time instead of on the first queued run.
  resolveModelRole("embedding");

  const { db, pool } = createDbClient(process.env.DATABASE_URL!);

  // Migrations apply before the port binds — /ready therefore implies
  // schema-current (research R10, FR-002).
  await runMigrations(db);

  const app = await buildApp({
    db,
    pool,
    operatorPasswordHash: process.env.OPERATOR_PASSWORD_HASH!,
    sessionSecret: process.env.SESSION_SECRET!,
    sessionCookieSecure: process.env.SESSION_COOKIE_SECURE === "true",
  });

  const port = Number.parseInt(process.env.V3_API_PORT ?? "4401", 10);
  await app.listen({ host: "0.0.0.0", port });
}
```

**Snippet B** — File: `v3/docker-compose.yml` (api service healthcheck)
```yaml
    # node -e fetch(): no curl/wget in node:22-slim, so probe with node itself.
    # /ready (not /health) so "healthy" means migrated + serving.
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://localhost:4401/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ]
```

**Snippet C** — File: `v3/docker-compose.yml` (worker service healthcheck)
```yaml
    # Worker has no HTTP surface, so health = "heartbeat file touched within the
    # last minute". The poll loop refreshes /tmp/worker-heartbeat each tick; if
    # the loop wedges, the file goes stale and the check fails.
    healthcheck:
      test: ["CMD-SHELL", "find /tmp/worker-heartbeat -mmin -1 | grep -q ."]
```

## Interactive Elements
- [x] **Data flow animation (HERO, mandatory here):** actors: `docker compose` → Postgres → API →
  (fan-out) ML Sidecar / Worker / Web. Steps: (1) compose starts postgres, waits healthy
  (pg_isready); (2) api starts, runs migrations, binds :4401, /ready green; (3) ml loads the
  embedding model into cache, /ready green; (4) worker starts only after api+ml healthy, touches
  heartbeat; (5) web starts after api, serves :4400 — stack "converges healthy". Emphasize in step
  labels that each arrow is a compose `service_healthy` gate.
- [x] **Code↔English translation** — Snippet A (line-by-line, dev register: "reports ALL missing
  vars at once, not one per restart", "the API validates a model role it never uses — deploy-time
  surfacing", "migrate-then-listen makes /ready a schema certificate").
- [x] **Cards** — the five services as 5 icon cards (Postgres+pgvector · Fastify API · ML sidecar
  (only Python, D2) · Worker · RR7 SSR Web) with one-liner responsibilities.
- [x] **Quiz** — 3 scenario questions:
  1. "Migration 0002 has a syntax error. `docker compose up --wait` — what do you observe?"
     (A: api never turns healthy → worker & web never start; the failure is pinned at the api link.)
  2. "The worker process is alive but its poll loop deadlocked. Which signal catches it?"
     (heartbeat-file staleness → container unhealthy — precisely because health isn't process-alive.)
  3. "Why validate EMBEDDING_* env in the API, which never embeds?" (fail at deploy, not at first
     queued job — a config error should stop boot, not strand a run.)

## Reference Files to Read
- `references/content-philosophy.md` (all) — but apply the AUDIENCE OVERRIDE above for tooltips.
- `references/gotchas.md` (all)
- `references/interactive-elements.md` → sections: "Message Flow / Data Flow Animation",
  "Code ↔ English Translation", "Multiple-Choice Quiz", "Callout Boxes", "Glossary Tooltips",
  "Pattern/Feature Cards" (if present).
- `references/design-system.md` → skim tokens only if needed.

## Connections
- **Previous:** none — this opens the course; open with the product framing paragraph above.
- **Next:** Module 2 "The Monorepo Map" — what's inside the containers: packages, apps, and the
  boundary rules a script enforces.
- **Tone/style:** teal accent (#2A7B9B) already set globally. Actor names everywhere in the course:
  Web, API, Postgres, Worker, Sidecar. First-person-plural engineering voice ("we gate the worker
  on api+ml") is fine.
