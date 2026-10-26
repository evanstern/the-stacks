# Contract: session-model boundary rule

The package must stay importable by the web client and deterministic. A Biome override in
`biome.json` enforces it, and `pnpm check:boundaries` proves the override fires.

## Rule

Override `includes`: `packages/session-model/src/**` and
`fixtures/boundary-violations/packages/session-model/**`.

`style/noRestrictedImports` denies:

- paths: `@the-stacks/server`, `@the-stacks/web`, `pg`, `postgres`, `drizzle-orm`,
  `drizzle-kit`, `ws`, `hono`, `@hono/node-server`, `undici`, `openai`,
  `@anthropic-ai/sdk`;
- patterns: `node:*`, `**/apps/**`, `drizzle-orm/**`, `@anthropic-ai/**`, `@ai-sdk/**`, and
  the Node built-ins the engine rule lists (`fs`, `http`, `net`, `crypto`, `os`, `process`,
  `timers`, …).

Message: `the session model is pure and client-importable: no server, web, database, network, model or clock (constitution III, IV).`

`style/noRestrictedGlobals` denies `Date`, `performance`, `setTimeout`, `setInterval`,
`setImmediate`, `fetch`, `WebSocket`, `XMLHttpRequest`, `process`, `crypto`, `require` with
the same message.

Allowed: `zod`, `@the-stacks/dnd5e-engine`.

The engine's existing override gains `@the-stacks/session-model` in its denied paths, so the
dependency points one way (session model → engine).

## Violating fixtures (same PR)

- `fixtures/boundary-violations/packages/session-model/src/bad-server.ts` — imports
  `@the-stacks/server`.
- `fixtures/boundary-violations/packages/session-model/src/bad-clock.ts` — reads `Date.now()`.
- `fixtures/boundary-violations/packages/session-model/src/bad-database.ts` — imports
  `drizzle-orm`.
- `fixtures/boundary-violations/packages/dnd5e-engine/src/bad-session-model.ts` — imports
  `@the-stacks/session-model`.

`pnpm check:boundaries` must report every fixture flagged; removing the override makes it
fail.
