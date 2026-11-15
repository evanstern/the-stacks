# Contract: gateway purposes for the DM runtime

Source of truth in code: `apps/server/src/dm/purposes.ts`. Config: `AI_PURPOSES`
(`apps/server/src/ai/config.ts`, unchanged). Decision-0007: no vendor name in source.

```ts
export const DM_PURPOSES = [
  "dm.director", "dm.interpret", "dm.adjudicate", "dm.narrate",
  "dm.audit", "dm.chronicle", "dm.companion",
] as const;
export type DmPurpose = (typeof DM_PURPOSES)[number];

/** The one purpose each caller may name (AC #4, FR-021). */
export const PURPOSE_OF = {
  director: "dm.director", interpret: "dm.interpret", adjudicate: "dm.adjudicate",
  narrate: "dm.narrate", audit: "dm.audit", chronicle: "dm.chronicle", companion: "dm.companion",
} as const;
```

The purpose names are code constants, like `answering` (research R3 of spec 018). Model
choice per purpose stays in `AI_PURPOSES`. Every purpose is `op: "chat"`.

## Config

`.env.example` gains a commented `AI_PURPOSES` example with all seven entries pointing at
operator-named providers. The runtime checks at boot which `dm.*` purposes are configured
and logs the missing ones by name (never a key). A missing purpose fails only the node that
calls it (FR-012). The server still boots.

## Model and cost notes (plan-level guidance, not enforced)

| Purpose | Calls per turn | Strength | Suggested tier | Output cap (`maxTokens`) |
|---|---|---|---|---|
| `dm.director` | 1 | judgment, pacing | strong | 600 |
| `dm.interpret` | 1 | structured reading | mid | 800 |
| `dm.adjudicate` | 0–1 per adjudicated action | rules reasoning with citations | strong | 800 |
| `dm.narrate` | 1–3 | prose and voice | strong | 500 |
| `dm.audit` | 1–3 | comparison | cheap | 300 |
| `dm.chronicle` | 0–1 per turn, off the hot path | summary | cheap | 600 |
| `dm.companion` | 1 per companion act | voice and choice | mid | 400 |

A typical free-mode turn makes four to six calls (SC-007). Each prompt stays inside the
caps in [nodes.md](nodes.md). Usage and cost flow through the gateway's `UsageSink` per call
(spec 011), so a playtest's cost is the sum of its usage records.

Real-provider runs are an operator checkpoint (runbook: provider, model list, estimate).
Implementers never set or commit a key.

## Amendment 2026-10-30 (specs/065-talk-triggers): `dm.react-v1`

Amended by specs/065-talk-triggers.

The talk path's `react` call uses purpose `dm.narrate` with prompt version `dm.react-v1`
(`dm/prompts/react.ts`). It adds no purpose, no `AI_PURPOSES` entry and no output cap: the
`dm.narrate` cap (500) applies. A talk turn adds one `dm.narrate`-class call, or two after a
code refusal.

## Amendment 2026-11-02 (TASK-0188, specs/066-one-chat-stream): `dm.react-v2`

**Amendment (TASK-0188).** decision-0028 §8; operator ruling 2026-11-02: "All (a), amend". Additive (§8.5). The read's call uses purpose `dm.narrate` with
prompt version `dm.react-v2`. No purpose, `AI_PURPOSES` entry or output cap is added.

**Amendment (TASK-0199).** Amended 2026-11-11 (spec `specs/066-one-chat-stream`, plan.md "Frozen-contract amendments", row C-8; P-04, decision-0030).

> "Approve all" (operator, C-GATE ruling, 2026-11-11: approves C-1 to C-9 as written in spec 066 plan.md)

The read's call uses prompt version `dm.react-v4`, not `dm.react-v2`. The purpose stays `dm.narrate`.
No purpose, `AI_PURPOSES` entry or output cap is added.

## Amendment 2026-11-14 (TASK-0336, specs/114-react-confirm-targets): `dm.react-v5`

**Amendment (TASK-0336).** Spec `specs/114-react-confirm-targets`, plan D1 and D2. Additive. Operator ruling: "Approved, but automate the tests" (runbook amendment 2026-11-13).

The read's call uses prompt version `dm.react-v5`, not `dm.react-v4`. The purpose stays `dm.narrate`.
No purpose, `AI_PURPOSES` entry or output cap is added.

- The system prompt shows the target ref forms and one worked `search` confirm example.
- The user prompt adds a `Targets` section: revealed zones and present actors, one `<id> (<kind>, <name>)` line each.
- The read call passes a `normalize` function to `callJson`. It fills a missing `kind` on a confirm target that is a bare id, or an object with only `id`, when the id names exactly one listed target. Unknown or ambiguous ids stay unchanged.
- `jobs.result.talk.targetRepairs` counts the repaired targets.

## Amendment 2026-11-15 (TASK-0347, specs/116-react-confirm-params): `dm.react-v7`

**Amendment (TASK-0347).** Spec `specs/116-react-confirm-params`, plan D1 to D3. Additive.

The read's call uses prompt version `dm.react-v7`, not `dm.react-v6`. The purpose stays `dm.narrate`.
No purpose, `AI_PURPOSES` entry or output cap is added.

- The system prompt adds the per-kind target and params lines from `INTENT_GRAMMAR`, the rule `params holds only the keys listed for its kind. Most kinds take {}. Never add another key.`, and one worked `move` confirm example.
- The read call's `normalize` runs `stripParams` after `normalizeReact`. It removes top-level `params` keys the kind's strict schema does not list. It never edits a value or a known key.
