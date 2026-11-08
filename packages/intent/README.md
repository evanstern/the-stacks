# @the-stacks/intent

The Intent vocabulary: one typed shape for everything a player, companion, DM seat or adapter
can ask to do, plus its canonical text form.

- Contract (normative, frozen at CP-4): `specs/092-intent-contract/contracts/intent-schema.md`.
- Runtime dependency: `zod` only. No server, web, engine, session-model, `node:*` or clock import.
- Exports: `.` (schemas, rules, refusal codes) and `./fixtures` (valid and invalid examples).

## Versioning

- `INTENT_SCHEMA_VERSION = 1` (major). `INTENT_SCHEMA_MINOR = 0`.
- Minor (additive): a new kind, optional param, alias, refusal code or `Source`.
  Bump `INTENT_SCHEMA_MINOR`. Add a CHANGELOG line below.
- Major (breaking): remove or rename a kind, param or verb; narrow a type; change a canonical
  text form, commit semantics or fixed channel. Bump `INTENT_SCHEMA_VERSION`, write a decision
  record, and ship an upcaster for stored Intents in session-model.
- Consumers tolerate an unknown `kind`: a projection renders `text`; the gate refuses it `INTENT_SCHEMA`.

## CHANGELOG

- 1.0 — initial contract (57 kinds, 13 groups).
