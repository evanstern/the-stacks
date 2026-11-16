---
name: intent-contract
description: The Intent contract package (packages/intent, spec 092, TASK-0266) - one pure zod vocabulary of 57 kinds in 13 groups, the KIND_RULES seat table, refusal codes, and the canonical text form (parse and toText, contract v1.1). Read before adding an Intent kind, a verb, or a text form, or before a producer emits or a gate checks an Intent.
kind: component
sources:
  - packages/intent/package.json
  - packages/intent/src/index.ts
  - packages/intent/src/kinds.ts
  - packages/intent/src/refs.ts
  - packages/intent/src/refusals.ts
  - packages/intent/src/version.ts
  - packages/intent/src/text/parse.ts
  - packages/intent/src/text/to-text.ts
  - packages/intent/src/text/tokens.ts
verified_against: f8e3e370c2e06c447129da10e8e316a30d53531a
---

# Intent contract

`@the-stacks/intent` is constitution II (One Intent Vocabulary) as code: one typed shape for everything a player, companion, DM seat or adapter can ask to do. The normative contract is `specs/092-intent-contract/contracts/intent-schema.md` (decision-0030). It is frozen at v1.1: `INTENT_SCHEMA_VERSION = 1`, `INTENT_SCHEMA_MINOR = 1`.

- **Pure.** Runtime dependency is `zod` only. A biome override on `packages/intent/src/**` forbids node modules, workspace packages, clock and network globals ([[monorepo-and-toolchain]]; fixture-backed by [[ci-pipeline]]).
- **Shape.** `IntentSchema` is a discriminated union over `kind` (57 kinds, 13 groups, `INTENT_KINDS`/`INTENT_GROUPS`). The envelope carries `id`, `actor`, `source`, `commit` and channel; every object is strict. The schema checks shape only; seats are checked by the gate through the single `KIND_RULES` table.
- **Producers.** The DM interpret node (spec 104, TASK-0269) emits 18 of the kinds (`INTERPRET_KINDS` in `apps/server/src/dm/nodes/schemas.ts`) as a body with no id, actor, source, commit or `dc` (`IntentBodySchema`, built from `KIND_RULES` and `paramsSchemaOf`); server code stamps the envelope and re-validates it with `IntentSchema`. A slash item is parsed with `parse`; `toText` renders the reason on each submission. See [[dm-runtime]].
- **Refusals.** `IntentRefusalCodeSchema` lists the closed refusal codes (for example `INTENT_SCHEMA` for an unknown kind, `PARSE_UNKNOWN_VERB`, `PARSE_BAD_TARGET`). A consumer that meets an unknown `kind` renders its `text` and the gate refuses it.
- **Text form.** `toText(intent)` is total and emits only canonical forms; `parse(text, ctx)` is total up to 4000 characters and returns a refusal, never a throw, with no model call and no I/O. `parse(toText(i), ctxOf(i))` deep-equals the schema-parsed `i`, and `toText` is idempotent (seeded property tests in `packages/intent/test`). Sigils: `@` actor, `&` entity, `$` item, `#` zone, `sq:`, `pt:`.
- **v1.1 additions** (contract 8.2.1): explicit speech verbs `/say /to /ask /ooc /npc`; `text="…"` and `reason="…"` keys; quoted `@"dm"` is the literal id, bare `@dm` the seat; bare `party` in `/reveal to=` is the keyword, quoted `"party"` a pc id; trailing `ability=`; leading `dc= diff= text= reason=` keys on `/rule amend`.
- **Versioning.** A minor bump adds a kind, optional param, alias, refusal code or source and needs a README changelog line. A major bump needs a decision record and a session-model upcaster ([[session-model]]). The carrier stores the major beside each stored Intent. The proposal seam ([[proposal-gate]]) does not yet consume Intents.

The planner ([[planner]], TASK-0267) raises the planner-side refusal codes `KIND_UNSERVED`, `TARGET_NOT_PRESENT`, `TARGET_UNSEEN`, `OUT_OF_REACH`, `OUT_OF_RANGE`, `NO_MOVEMENT_LEFT`, `REQUEST_NOT_OPEN` and `DM_SEAT_REQUIRED`. Since spec 117 (TASK-0304) the planner also raises `NO_ACTION_LEFT` and `NO_BONUS_ACTION_LEFT`, and `dodge` is engine-served (`engine("served", "dodge")` in `KIND_RULES`, no longer a gap). The gate raises the seat and turn codes.
