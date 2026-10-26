# Contract: the write boundary test (AC #1)

AC #1: "No code path writes LLM output to the log except through a typed proposal; a test
enforces this." The proof is structural: only two server modules may write to the log, the
gate accepts nothing but a parsed `ProposalSchema` or `GateRequestSchema`, and neither
writing module can reach the model gateway.

A Biome rule cannot express the transitive part ("can reach"), so this is an import-graph
test, not a lint override. No `biome.json` change and no boundary-violation fixture are
needed for it.

## The test

File: `apps/server/test/write-boundary.test.ts` (no database). A helper
`apps/server/test/helpers/import-graph.ts` builds the graph with the TypeScript compiler API
already in the workspace (`ts.createSourceFile`; no new dependency).

1. **Collect** every `.ts` file under `apps/server/src/`. For each, record its static
   imports and re-exports (module specifier plus named bindings), and every dynamic
   `import()` whose argument is a string literal. A dynamic `import()` with a non-literal
   argument anywhere in `src/` fails the test (the graph could not be trusted).
2. **Resolve** relative specifiers to files (`.js` → `.ts`, directory → `index.ts`).
3. **Writers.** The log-writing bindings are:
   - from `events/log.ts`: `append`, `appendBatch`;
   - from `session/events.ts`: `appendSessionEvent`, `appendSessionEvents`,
     `appendMechanicsBatch`, `appendUncataloguedEvent`.

   A namespace import (`import * as`) of either module counts as importing every binding.
   Allowed importers:

   | Binding | Allowed importers |
   |---|---|
   | `append`, `appendBatch` | `session/events.ts` |
   | `appendSessionEvent`, `appendSessionEvents`, `appendMechanicsBatch` | `gate/**` |
   | `appendUncataloguedEvent` | `ws/gateway.ts` |

4. **No model reach.** For every allowed writer (`session/**`, `gate/**`, `ws/gateway.ts`),
   the transitive import closure inside `src/` contains no file under `ai/`.
5. **Entry parsing.** A unit test with a fake seam calls `gate.submit` and `gate.handle` with
   a raw model string, an object missing `kind`, and an object with an unknown `kind`. Each
   returns `INVALID_PROPOSAL`, and the fake seam records zero calls.

Rules 3 and 4 together mean model output (which exists only in modules that import `ai/`)
can reach the log only by calling the gate's `submit`/`handle`, which parse it into a typed
proposal first (rule 5). TASK-0046's `apps/server/src/dm/` imports `ai/` and the gate; the
test admits that, and refuses it any writer import.

## The test proves itself

A violation tree at `apps/server/test/fixtures/write-boundary/src/` mirrors the layout with
three seeded violations:

- `ai/leak.ts` imports `appendSessionEvent` from `../session/events.js`;
- `dm/raw.ts` imports `append` from `../events/log.js`;
- `gate/model.ts` imports from `../ai/gateway.js`.

The checker is a function `checkWriteBoundary(root)`. The test runs it on the real `src/`
(expects zero violations) and on the violation tree (expects exactly the three, by file and
rule).

The violation tree must stay out of the server's `tsc` project and Biome's lint, because its
relative imports point at files that do not exist there. Neither is excluded today
(`apps/server/test/tsconfig.json` includes `"."`; `biome.json` excludes only
`apps/server/test/fixtures/ddb`). Add `"exclude": ["fixtures/write-boundary"]` to the test
tsconfig and `"!apps/server/test/fixtures/write-boundary"` to `biome.json`'s top-level
`files.includes`, beside the existing `ddb` entry.
