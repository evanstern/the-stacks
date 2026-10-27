# Contract: modes and the cost guard

Module: `apps/server/src/playtest/budget.ts`. FR-019 to FR-024. Runbook checkpoint "Paid
provider runs": stop before the first real-provider run with the provider, the model list and
an estimate. The operator supplies `AI_PROVIDERS`, `AI_PURPOSES`, `AI_PRICES` and keys in the
root `.env`; implementers never see or commit a key.

## Modes

| Mode | Chosen by | Model answers | Dice | Spends money |
|---|---|---|---|---|
| `ci` | default for `run`; the Vitest suite | DM script + auditor script through a strict `FakeProvider` | the DM script's faces | never |
| `provider` | `--mode provider` only | `loadAiConfig(process.env)` | scenario faces, then `seededRng(seed)` | yes, under a ceiling |

`audit` has its own switch: `--auditor fake --audit-script <file>` (default when the run
directory is a CI run), `--auditor provider` (paid), or `--auditor none` (code checks only, free).

## Preflight (provider), in order; the first failure exits before any model call

1. `process.env.CI` is set to any non-empty value → exit 4, "provider mode is refused under CI".
2. Every `DM_PURPOSES` entry (for `run`) and `playtest.audit` (for `run` unless `--no-audit`,
   and for `audit --auditor provider`) resolves in `aiConfig.purposes` → else exit 4 naming each
   missing purpose.
3. Every used `<provider>/<model>` has an `AI_PRICES` entry → else exit 4 naming each.
4. Print the estimate (below).
5. No `--spend-ceiling-usd` → exit 3, "spend not confirmed; re-run with --spend-ceiling-usd <n>".
6. The upper-bound estimate exceeds the ceiling → exit 3, "ceiling below upper-bound estimate".

`estimate` subcommand runs steps 1 to 4 and exits 0. It never calls a model.

## The estimate

`estimate({ scenario, aiConfig, segments? })` returns per purpose: expected calls, upper-bound
calls, input tokens per call, output tokens per call (`maxTokens` from config, else the purpose
default), expected and upper-bound USD, from `AI_PRICES`. Totals follow.

Turn count: expected `T = moves.free.length + 6` (scene start, NPC turns, the close);
upper bound `T_max = limits.maxMoves * 2`.

| Purpose | Expected calls | Upper-bound calls | Input tokens per call |
|---|---|---|---|
| `dm.director` | T | T_max | 6,000 |
| `dm.interpret` | T | T_max | 5,500 |
| `dm.adjudicate` | 2 | T_max | 6,500 |
| `dm.narrate` | T | 3·T_max | 4,500 |
| `dm.audit` | T | 3·T_max | 2,500 |
| `dm.chronicle` | T | T_max | 3,500 |
| `dm.companion` | 2·T | 2·T_max | 4,500 |
| `playtest.audit` | T | 2·T_max | 5,500 |
| embed purpose (retrieval) | 2 | T_max | 200 |

Input sizes come from the caps in `specs/031-dm-runtime/contracts/nodes.md` plus the
auditor's caps (auditor.md). A unit test pins this table. The printout says the figures are an
estimate and that the ceiling, not the estimate, is enforced.

## The ceiling at run time

```ts
export function countingSink(inner: UsageSink): UsageSink & { totals(): Totals; records: UsageRecord[] };
export function budgetGateway(gateway: Gateway, sink: CountingSink, ceilingUsd: number): Gateway;
```

1. Every gateway call emits a usage record into the counting sink (the gateway already emits
   exactly one per call).
2. Before each `chat` or `embed`, `budgetGateway` compares `sink.totals().costUsd` with the
   ceiling. At or over the ceiling, `chat` yields one `{ type: "error", kind: "cancelled",
   message: "playtest spend ceiling reached" }` and `embed` throws the same; no provider call is
   made.
3. The harness checks the same total before each move and stops with outcome `budget-stopped`.
4. Overshoot is bounded by the calls already in flight when the ceiling is crossed (SC-004).

## Keys

The harness never reads an `apiKeyEnv` value itself; the gateway's adapters do. The manifest,
usage file and report hold provider names, model names, prices and token counts only.
