# Contract: the DM script (fake gateway scripting format)

Modules: `apps/server/src/ai/adapters/fake.ts` (additive: purpose-keyed queues),
`apps/server/src/dm/script/` (`DmScriptSchema`, `loadDmScript`, `createScriptedDm`). AC #15.
**Binding for TASK-0048**: its harness's CI case reuses this format and loader unchanged.

## Fake adapter addition

```ts
export class FakeProvider implements Provider {
  // existing: scriptChat(...scripts) — the global FIFO, unchanged
  /** Queue scripts for one purpose. A call whose request.purpose has a non-empty queue
   *  consumes from it before the global FIFO. */
  scriptChatFor(purpose: string, ...scripts: ChatScript[]): this;
  /** When true, an unscripted call yields { type: "error", kind: "config",
   *  message: "unscripted call for <purpose>" } instead of the safe default. */
  strict: boolean;   // default false (existing tests unchanged)
}
```

`ChatRequest.purpose` already reaches the provider, so no gateway change is needed.

## The script document (JSON)

```ts
export const DmScriptSchema = z.object({
  v: z.literal(1),
  name: z.string().min(1).max(100),
  dice: z.array(z.number().int().min(1).max(1000)).max(2000),   // faces, in draw order
  calls: z.array(z.object({
    purpose: z.enum(DM_PURPOSES),
    note: z.string().max(200).optional(),                      // for humans reading the script
    respond: z.discriminatedUnion("type", [
      z.object({ type: z.literal("json"), value: z.unknown() }),      // serialized to text
      z.object({ type: z.literal("text"), value: z.string() }),       // prose (narrate)
      z.object({ type: z.literal("error"), kind: ErrorKindSchema, message: z.string() }),
    ]),
    usage: z.object({ inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0) })
      .default({ inputTokens: 0, outputTokens: 0 }),
  })).max(2000),
  embed: z.literal("hash").default("hash"),   // retrieval embeds with the fake's hash vectors
});
```

Semantics:

1. Calls are grouped by `purpose` and queued per purpose in document order. Order across
   purposes does not matter, so concurrent jobs (chronicle beside a turn) cannot consume
   each other's responses.
2. A `json` response becomes one `text` event holding `JSON.stringify(value)`, then `done`
   with the usage.
3. A `text` response becomes one `text` event, then `done`.
4. An `error` response becomes one `error` event.
5. The provider runs `strict: true`. An unscripted call fails loudly with kind `config`.
6. `dice` feed one shared `scriptedRng` used for every gate plan in the run. The gate's
   throwaway legality RNG (human seat) does not consume them.

## Loader and wiring

```ts
export function loadDmScript(json: unknown): DmScript;       // throws on schema failure

export interface ScriptedDm {
  provider: FakeProvider;                    // strict, purpose queues loaded
  aiConfig: AiConfig;                        // one fake provider; all seven purposes + an embed purpose
  rng: ScriptedRng;                          // over script.dice
  gateRng: () => Rng;                        // () => rng, for createGate({ rng })
  remaining(): { calls: Record<DmPurpose, number>; dice: number };
}
export function createScriptedDm(script: DmScript): ScriptedDm;
```

`createGateway({ config: scripted.aiConfig, sink, adapters: { fake: () => scripted.provider } })`
gives a gateway that answers from the script. A full-turn test asserts `remaining()` is all
zeros at the end, so an unused response is a test failure too.

## Fixture scripts

`apps/server/test/dm/scripts/` holds the scripts the tests use, as JSON:

| File | Covers |
|---|---|
| `scene-start.json` | the scene-start turn |
| `exploration-check.json` | one free-mode check turn (the merge-condition turn) |
| `social-adjudicated.json` | a persuasion turn with adjudicate and a cited ruling |
| `fight-round.json` | entering turn mode, a hit with damage, an NPC turn, a companion turn |
| `audit-regenerate.json` | a contradicting narration, then a passing one |
| `audit-fallback.json` | three failing narrations |
| `greyhollow-ford-full.json` | the whole scene to its end; TASK-0048's CI case starts from it |
