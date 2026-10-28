# Data model: Env-reachable scripted fake DM provider

No database table, migration, event type or proposal kind changes.

## DM script (unchanged)

`DmScriptSchema` v1 (`apps/server/src/dm/script/schema.ts`). This feature reads it with the
unchanged `loadDmScript` and builds it with the unchanged `createScriptedDm`.

## `DM_FAKE_SCRIPT` (new env value)

| Field | Rule |
|---|---|
| Value | A script name matching `^[a-z0-9][a-z0-9-]{0,63}$` |
| Resolves to | `apps/server/dm-scripts/<name>.json`, module-relative |
| Unset or empty | Script mode is off. Boot is exactly as today. |
| Allowed when | `STACKS_ENV` is set and is not `default`, `main` or `dev` |

## Script mode (process state)

| Part | Value in script mode | Value otherwise |
|---|---|---|
| AI config | `createScriptedDm(script).aiConfig` | `loadAiConfig(process.env)` |
| `fake` adapter | `() => scripted.provider` (strict, queues loaded) | `() => new FakeProvider()` |
| Gate RNG | one shared RNG: `script.dice`, then `seededRng(0)` | `seededRng(randomInt(...))` per plan |
| Boot log | `DM script mode: <name> (<n> calls, <d> dice)` | none |

## Usage ledger rows

Each scripted call is recorded in `dm_model_calls` as usual, with provider `scripted`, model
`scripted-chat` or `scripted-embed`, and cost null (unpriced).
