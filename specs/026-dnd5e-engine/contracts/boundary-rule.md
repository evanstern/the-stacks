# Contract: the engine boundary rule (AC #10)

The engine package imports only `zod` and its own relative modules. Three layers enforce it;
the first is the CI gate the card names.

## 1. Biome rule (gated by `pnpm check:boundaries`)

A new `overrides` entry in `biome.json`, scoped to
`packages/dnd5e-engine/src/**` and `fixtures/boundary-violations/packages/dnd5e-engine/**`:

- `style/noRestrictedImports` (level `error`):
  - `paths`: `pg`, `postgres`, `drizzle-orm`, `drizzle-kit`, `ws`, `hono`,
    `@hono/node-server`, `undici`, `busboy`, `yauzl`, `parse5`, `openai`,
    `@anthropic-ai/sdk`, `@the-stacks/server`, `@the-stacks/web`, `@the-stacks/shared`.
  - `patterns`: `node:*`; the bare Node built-ins `fs`, `fs/**`, `http`, `https`, `http2`,
    `net`, `tls`, `dgram`, `dns`, `child_process`, `cluster`, `worker_threads`, `crypto`,
    `os`, `process`, `timers`, `timers/**`, `perf_hooks`, `readline`, `stream`; `drizzle-orm/**`;
    `@anthropic-ai/**`; `@ai-sdk/**`; `**/apps/**`.
  - Messages cite constitution VI: "the 5e engine is pure: no database, network, model or
    clock (constitution VI)".
- `style/noRestrictedGlobals` (level `error`, option `deniedGlobals`): `Date`, `performance`,
  `setTimeout`, `setInterval`, `setImmediate`, `fetch`, `WebSocket`, `XMLHttpRequest`,
  `process`, `crypto`, `require`.

`@the-stacks/shared` is listed because it carries web-facing helpers and a DOM lib; the engine
needs nothing from it. A future shared need is a contract change to this file.

## 2. Fixtures (prove the rule fires)

One file per category under `fixtures/boundary-violations/packages/dnd5e-engine/src/`:

| Fixture | Violation | Category |
|---|---|---|
| `bad-database.ts` | `import "pg";` | database |
| `bad-orm.ts` | `import "drizzle-orm";` | database |
| `bad-network.ts` | `import "node:http";` | network |
| `bad-fetch.ts` | `export const r = fetch("http://x");` | network (global) |
| `bad-llm.ts` | `import "@the-stacks/server";` | LLM (the gateway lives in the server, decision-0007) |
| `bad-clock.ts` | `export const t = Date.now();` | clock (global) |

`scripts/check-boundaries.mjs` runs Biome with
`--only=style/noRestrictedImports --only=style/noRestrictedGlobals` and still requires every
fixture to be flagged.

## 3. Package-level guards (tests and types)

- `packages/dnd5e-engine/tsconfig.json` sets `lib: ["ES2022"]` and `types: []`: no DOM and no
  Node types, so a Node or DOM API fails `tsc -b` even if it slips past Biome.
- `test/purity.test.ts` scans every `src/**/*.ts` file and fails when an import specifier is
  anything other than `zod` or a relative path (an allowlist, which catches packages the
  denylist does not name), or when the source contains `Math.random`, `Date`,
  `globalThis` or `new Function`.
- `package.json` `dependencies` holds `zod` only; a test asserts it.
