# Contract: `DM_FAKE_SCRIPT` and script mode

Module: `apps/server/src/dm/script/env.ts`. Caller: `apps/server/src/index.ts`. Card AC #1.
Ruled by the operator on 2026-10-28 (spec.md, Q1 to Q8).

## API

```ts
export const DM_SCRIPT_ENV = "DM_FAKE_SCRIPT";
export const DENIED_STACKS_ENVS: readonly string[]; // ["default", "main", "dev"]

export interface AiRuntime {
  aiConfig: AiConfig;
  adapters?: Record<string, AdapterFactory>; // { fake: () => scripted.provider } in script mode
  gateRng?: () => Rng;                        // shared faces-then-seed RNG in script mode
  scriptName: string | null;                  // null when script mode is off
}

/** Reads the env. Throws DmScriptEnvError on a refused or bad value. */
export function createAiRuntime(
  env: NodeJS.ProcessEnv,
  opts?: { scriptDir?: string },             // default: apps/server/dm-scripts, module-relative
): AiRuntime;

/** Script dice in order, then seededRng(seed). A face outside 1..sides throws. */
export function facesThenSeed(faces: readonly number[], seed?: number): Rng;
```

## Rules

1. `DM_FAKE_SCRIPT` unset or empty: return `{ aiConfig: loadAiConfig(env), scriptName: null }`.
   `adapters` and `gateRng` are undefined.
2. Set, and `STACKS_ENV` unset, empty, or in `DENIED_STACKS_ENVS`: throw. The message names
   `DM_FAKE_SCRIPT`, the `STACKS_ENV` value, and says script mode runs only on a worktree stack.
3. Set, and the name fails `^[a-z0-9][a-z0-9-]{0,63}$`: throw, naming the value.
4. Set, and `<scriptDir>/<name>.json` is missing: throw, naming the value and listing the
   available names.
5. Set, and the file is not JSON or fails `DmScriptSchema`: throw, naming the file and the
   first schema issue.
6. Otherwise: `loadAiConfig` is not called. Return `createScriptedDm(script).aiConfig`,
   `adapters: { fake: () => scripted.provider }`, `gateRng: () => rng` with
   `rng = facesThenSeed(script.dice, 0)`, and `scriptName: name`.

## Wiring in `index.ts`

- `const runtime = createAiRuntime(process.env)` replaces `const aiConfig = loadAiConfig(...)`.
- `createAiGateway({ config: runtime.aiConfig, sink: logSink, adapters: runtime.adapters })`.
- `createGate({ db, presence: presence.reader, rng: runtime.gateRng })`.
- When `runtime.scriptName` is set, log one line: `DM script mode: <name> (<n> calls, <d> dice)`.

## Unchanged

`DmScriptSchema`, `loadDmScript`, `createScriptedDm`, `FakeProvider`, the gateway contract,
`AI_*` parsing, `ws-protocol` frames, and the 029 and 030 contracts.
