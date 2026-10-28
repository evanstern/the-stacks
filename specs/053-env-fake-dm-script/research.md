# Research: Env-reachable scripted fake DM provider

Each decision follows the operator ruling of 2026-10-28 (spec.md "Open questions", Q1 to Q8).
The items below record the code facts each decision rests on.

## R1 — Why the env-configured fake returned empty bodies

- **Decision**: In script mode, pass the scripted provider to the gateway as the `fake` adapter.
- **Rationale**: `createGateway`'s default registry maps `fake` to `() => new FakeProvider()`
  (`apps/server/src/ai/gateway.ts`). That provider is non-strict and empty, so it yields one
  `done` event and no text (`apps/server/src/ai/adapters/fake.ts`). `createGateway` already
  accepts `adapters`, which tests use. No gateway change is needed.
- **Alternatives**: Teach the `fake` kind to read a script from `ProviderConfig`. That changes
  the `AI_PROVIDERS` schema and the gateway contract. Rejected.

## R2 — Where live scripts live (Q1)

- **Decision**: A new tracked directory `apps/server/dm-scripts/`. The Dockerfile copies it to
  the runtime image beside `apps/server/seeds`. The env value is a name; the app reads
  `<dir>/<name>.json`, with the directory resolved module-relative, as `loadSeed` does.
- **Rationale**: The runtime image ships `dist` and `seeds` only. `apps/server/test/` is absent.
- **Alternatives**: Bind-mount a path (more than one value); inline JSON. Rejected by Q1.

## R3 — Purpose scope (Q3)

- **Decision**: In script mode, `index.ts` skips `loadAiConfig(process.env)` and uses
  `createScriptedDm(script).aiConfig` as the whole AI config: seven `dm.*` chat purposes and
  `embedding` (hash vectors), all on provider `scripted`, with no prices.
- **Rationale**: `adjudicate` calls `retrieve` (`apps/server/src/dm/nodes/adjudicate.ts`), which
  embeds the question through the retrieval embed purpose. Any real route left in place can make
  a paid call. Skipping `loadAiConfig` also avoids its `apiKeyEnv` check, so a worktree whose
  inherited root `.env` names a key variable it lacks still boots.
- **Effect**: `answering` is unconfigured, so `/library/ask` returns its config error. The ingest
  worker embeds with hash vectors. Both are acceptable on a worktree live-check stack.

## R4 — Exhaustion (Q4)

- **Decision**: Keep the provider strict, as `createScriptedDm` builds it. An empty queue yields
  `{ type: "error", kind: "config", message: "unscripted call for <purpose>" }`.
- **Rationale**: This is semantic 5 of `specs/031-dm-runtime/contracts/fake-gateway-script.md`.
  The failed-turn record and the debug page already show it.

## R5 — Production guard (Q5)

- **Decision**: When `DM_FAKE_SCRIPT` is set, boot throws unless `STACKS_ENV` is set and is not
  `default`, `main` or `dev`.
- **Rationale**: The Dockerfile sets `NODE_ENV=production` for every container. `STACKS_ENV` is
  `task-<n>` (or a sanitized worktree name) from `pnpm env:up`, `main` from `pnpm env:main`,
  `dev` on vm-104 (`scripts/deploy-lib.mjs`), and `default` from `.env.example` for a plain
  `docker compose up`.
- **Note**: A worktree `.env` key the root `.env` lacks survives `pnpm env:up` (env-cli layer
  3). A root `.env` that holds `DM_FAKE_SCRIPT` reaches every stack, including `env:main` and
  vm-104, and the guard then refuses those boots. That is the guard working.

## R6 — Dice (Q7)

- **Decision**: In script mode, `createGate` receives `rng: () => rng`, where `rng` is one
  process-wide RNG that serves `script.dice` in order and then continues from `seededRng(0)`.
- **Rationale**: `createGate`'s `rng` option already exists (`apps/server/src/gate/gate.ts`,
  default `seededRng(randomInt(0, 2**32))`). The engine's `scriptedRng` throws when it runs out,
  which would fail every later roll, so the tail matters. The playtest harness's `scenarioRng`
  (`apps/server/src/playtest/dice.ts`) has the same shape, but `playtest/` imports `dm/`, so
  `dm/script/` does not import it back. The new module builds the same faces-then-seed RNG
  from the engine's `seededRng`, with a validated face per draw.
- **Alternative**: Move `scenarioRng` to the engine package. That is a wider change than this
  card needs. Rejected.

## R7 — Player-action turns (Q6)

- **Decision**: The live script names the fixed action id `act-search`. An evidence helper
  sends the declare and commit for `act-search` over the WebSocket, as the client's `sendEvent`
  does, with the operator's session cookie.
- **Rationale**: The interpret node compares reading ids to beat ids
  (`apps/server/src/dm/nodes/interpret.ts`). The composer mints `act-<uuid>`
  (`apps/web/app/play/frames.ts`). The client chooses `actionId`, so a fixed id is a valid
  request.

## R8 — The live script

- **Decision**: One shipped script, `apps/server/dm-scripts/greyhollow-live.json`. It is the
  calls of `apps/server/test/dm/scripts/scene-start.json` followed by those of
  `exploration-check.json`, with `dice: [14]`. A test asserts it equals that concatenation, so
  the two never drift.
- **Rationale**: Queues are per purpose, so the scene-start director answer is consumed first
  and the exploration answer second. The exploration turn may close a beat and queue a
  chronicle job; Phase 4 runs it live and adds a `dm.chronicle` call if the run shows one is
  needed, in both the test and the live script.
