# Implementation Plan: Intent contract package

**Branch**: `task-0266-intent-contract` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)
**Contract**: [contracts/intent-schema.md](contracts/intent-schema.md) (normative; frozen at CP-4)

The contract holds the data model, so this plan has no separate data-model.md, research.md or
quickstart.md.

## Summary

Add `packages/intent`: Zod schemas for the envelope and 57 kinds, `KIND_RULES`, a hand-written
tokenizer and per-kind grammar for `parse`, a canonical `toText`, fixtures, and tests. Add
boundary lint for the package. Record the CP-4 freeze decision. No server, web, engine or
session-model code changes in this task.

## Technical Context

**Language/Version**: TypeScript, Node 22, ES2022 target, as the repo.
**Primary Dependencies**: `zod ^4.6.5` only. **No new dependency.** Property tests use a seeded
generator written in the test file (a small mulberry32 PRNG), not `fast-check`.
**Dev dependencies**: `vitest`, `@types/node`, and `@the-stacks/dnd5e-engine` (test-only, for the
enum drift test).
**Storage**: none. **No migration. No event change. No gate change.**
**Testing**: Vitest under `packages/intent/test/`.
**Constraints**: pure; client-importable; no `node:*`, no clock, no I/O.
**Scale/Scope**: about 8 source files, 5 test files, 1 fixtures module, 1 biome override, 3 boundary fixtures.

## Package layout

```
packages/intent/
  package.json            # "@the-stacks/intent"; exports "." and "./fixtures"; deps: zod
  tsconfig.json           # extends ../../tsconfig.base.json; no references
  vitest.config.ts        # include test/**/*.test.ts
  README.md               # contract pointer, versioning rule, CHANGELOG
  src/
    index.ts              # the exports in contract §11, nothing more
    version.ts            # INTENT_SCHEMA_VERSION = 1, INTENT_SCHEMA_MINOR = 0
    scalars.ts            # Id, Body, Slug, copied engine enums (contract §1)
    refs.ts               # ActorRef, Channel, TargetRef, Source, Commit (§2–§5)
    kinds.ts              # per-kind params schemas, IntentSchema, KIND_RULES, INTENT_GROUPS (§6)
    refusals.ts           # IntentRefusalCodeSchema (§9)
    text/
      tokens.ts           # tokenizer: verbs, sigils, key=value, +flag, quotes, " -- ", ((…))
      parse.ts            # parse(text, ctx): verb table → per-kind reader
      to-text.ts          # toText(intent): per-kind writer, canonical form
    fixtures/
      index.ts            # VALID: Record<IntentKind, Intent[]>; INVALID: {code, input}[]
  test/
    schema.test.ts        # every kind: valid fixtures pass; invalid fixtures fail with their code
    round-trip.test.ts    # every fixture: parse(toText(i), ctxOf(i)) deep-equals the parsed fixture
    property.test.ts      # seeded generator: 1000 Intents per kind round-trip; toText is idempotent
    parse.test.ts         # aliases, whitespace, quoting, edge cases from spec, each refusal code
    engine-drift.test.ts  # copied enums equal the engine's
```

One `kinds.ts` file holds all 57 schemas. Splitting by group adds files with no consumer that needs
the split.

`KIND_RULES` is the one table for seats, channel, arity, mutates, resolved-by and engine status.
The schema derives channel and arity checks from it. The gate (N-03) and the action bar (N-10)
read it later.

## Boundary lint

Add one `biome.json` override for `packages/intent/**` and
`fixtures/boundary-violations/packages/intent/**`, `noRestrictedImports`:

- paths: `@the-stacks/server`, `@the-stacks/web`, `@the-stacks/dnd5e-engine`,
  `@the-stacks/session-model`, `pg`, `ws`, `hono`, `openai`, `@anthropic-ai/sdk`.
- patterns: `**/apps/**`, `node:*`, `fs`, `http`, `https`, `net`.

Add `noRestrictedGlobals` for `Date` and `fetch`, as the session-model override does.

`test/engine-drift.test.ts` imports the engine. Scope the override to `packages/intent/src/**` so
test files may import it. Add fixtures `bad-app.ts`, `bad-engine.ts`, `bad-clock.ts` under
`fixtures/boundary-violations/packages/intent/src/`. `scripts/check-boundaries.mjs` picks them up
with no edit.

## Migration (built later; recorded here so the freeze accounts for it)

This task changes no runtime code. Later cards migrate:

1. **N-03 (TASK-0268), session-model.** Add `intent` to `ProposalKindSchema` and a
   `{ kind: "intent", intent: IntentSchema }` member to `ProposalSchema`. session-model gains a
   dependency on `@the-stacks/intent` (target-architecture §8 already draws that edge). The
   `GATE_REQUEST_KINDS` count moves from 19 to 20.
2. **N-03, the declare envelope.** `action.declare {text, scope, characterId}` maps to
   `{ kind: "attempt", actor: pc:<characterId>, text, params: { scope }, commit: "declared",
   source: "composer" }`. `actionId` becomes the Intent `id`. A party-scope declare with a null
   character maps to the declaring user's `pc`. Old clients keep sending `action.declare`; the gate
   wraps it. The stored `action.declared` event keeps its v1 shape.
3. **N-03, talk.** `talk {channel: "ic"}` maps to `say`. `talk {channel: "ooc"}` maps to `ooc`, or
   to `ask_dm` when the text holds the `@dm` token. `TalkV1` stays as the stored event.
4. **N-03, mechanics.** DM `mechanics` proposals keep working. The console and AI DM move to DM
   control Intents over time; `mechanics` retires in a later major of the gate request union.
5. **N-04 (TASK-0269).** `interpret` returns `Intent[]` validated by `IntentSchema`. Slash text
   skips the model through `parse`.

## Downstream amendments (specs 066 and 091)

**Spec 066 (TASK-0199, rewrite per P-04):**

- The confirm row becomes a `declared` → `confirmed` transition on an Intent. `action.suggest`
  carries `Intent` bodies (kind `attempt` or a typed kind), not wording plus a check string.
- `action.accept` confirms an Intent id. The appended `action.declared` + `action.committed` pair
  becomes one `confirmed` Intent through the planner.
- The ring applies in exploration only. Combat commits on Enter (contract §7 rule 4).
- The `((`, `/ooc` and `@dm` rules map to `ooc` and `ask_dm`. FR-005's readable-post rule reads
  Intent kinds, not `talk.channel`.
- FR-031 ("no change to `TalkV1`") holds; the Intent wraps it.

**Spec 091 (TASK-0247, rewrite to emit Intent pills):**

- FR-014's closed command set grows to the contract's verbs. `/help` becomes the SRD Help action;
  the help block moves to `/?` (open question Q1).
- FR-014 "unknown `/words` are sent as typed" flips: an unknown verb is refused
  `PARSE_UNKNOWN_VERB` inline (contract §8.3 rule 12).
- FR-019 `draft(text)` becomes `draft(intent)`. The pill renders `toText(intent)`; a way on's
  `draft` string is parsed once into an Intent.
- FR-016's single listbox completes verbs from `INTENT_KINDS` and targets through `ctx.resolve`.
- FR-024 ("no new gate request") no longer holds once N-03 lands; 091 sends `intent` requests.

Each amendment is its own task under the owning card. This task records them only.

## Test strategy

- **Fixture per kind.** `VALID` has at least one fixture per kind, two where params branch (for
  example `check` with `dc` and with `difficulty`). `INVALID` has one input per parse and schema
  refusal code.
- **Round trip.** For every valid fixture, `parse(toText(i), ctxOf(i))` deep-equals
  `IntentSchema.parse(i)`.
- **Property.** A seeded generator builds 1000 schema-valid Intents per kind from `KIND_RULES` and
  the params schemas. It asserts round trip and `toText` idempotence. Seeds are logged on failure.
- **Totality.** 10 000 random strings (seeded; sigils, quotes and parens weighted) never make
  `parse` throw.
- **Drift.** The copied enums equal the engine's.
- **Count.** `INTENT_KINDS.length === 57`, and every kind appears in `KIND_RULES` and `VALID`.
- **Latency.** One test times 1000 parses of a 200-character line and asserts p95 under 1 ms.

## Constitution Check

Against `.specify/memory/constitution.md` 3.0.0.

- [x] **I. Agent-operable**: AI DM and companions use the same kinds and text form.
- [x] **II. One Intent vocabulary**: this is the shared `intent` package; every kind round-trips.
- [x] **III. Server authority**: the package validates shape only; the gate authorises.
- [x] **IV. Three planes**: no plane is touched; the package is plane-neutral data.
- [x] **V. Many views**: channels let the server filter per viewer; no client state is added.
- [x] **VI. Engine owns the numbers**: `MODEL_NUMBER` keeps model-chosen numbers out.
- [x] **IX. UX**: pure synchronous parse; a text form for every action.
- VII, VIII, X, XI, XII, XIII: not applicable.

**Quality gate "Intent contract tests"**: this task ships the schema and round-trip tests. Planner
tests per outcome belong to N-02.

**Stack conformance**: Zod is the single validation source. **Complexity Tracking**: none.
