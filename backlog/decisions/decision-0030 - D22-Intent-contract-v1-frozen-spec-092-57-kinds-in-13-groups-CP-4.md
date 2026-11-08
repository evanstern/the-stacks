---
id: decision-0030
title: D22 Intent contract v1 frozen (spec 092; 57 kinds in 13 groups; CP-4)
date: '2026-11-08 12:12'
status: accepted
---
## Context

Constitution 3.0.0 Principle II and P-08 (decision-0029) require one typed Intent vocabulary for every
surface and both DM seats. Every R1 surface lane builds against it, so it must freeze before any lane
starts (Principle XIII; plan-of-action CP-4). Spec: `specs/092-intent-contract/`.

## Decision

The operator froze `specs/092-intent-contract/contracts/intent-schema.md` as v1 on 2026-11-08
(`INTENT_SCHEMA_VERSION = 1`, minor 0): 57 kinds in 13 groups. Rulings on the open questions, all as
recommended:

- Q1 `/help` is the SRD Help action. The composer help block moves to `/?`.
- Q2 `ooc` and `party` are two kinds on one `party` channel. The narrator and NPCs see neither.
- Q3 An `ai:dm` literal DC or fixed amount is refused as `MODEL_NUMBER`. The AI DM uses difficulty tiers. A human DM may write numbers.
- Q4 All 14 kinds without an engine path freeze in v1. The planner refuses them as `KIND_UNSERVED` until served.
- Q5 `delay` stays as a house rule, off by default per table.
- Q6 Target sigils: `@` actor, `&` entity, `$` item, `#` zone, `sq:` and `pt:` for map positions.
- Q7 No version field on the Intent envelope. The carrier records it.
- Q8 Canonical `/utilize`, alias `/use-object`. `/use` is for items.
- Q9 The schema checks shape only. The gate checks seats with one `KIND_RULES` table.

## Consequences

- Additive kinds or fields are a minor bump. A breaking change needs a new major version and a decision record.
- Spec 066 (TASK-0199) and spec 091 (TASK-0247) must be amended against this contract before their lanes start.
- R1 lanes may build against the contract in parallel (plan-of-action §4 seams).

## Amendments

- **v1.1 (2026-11-08, operator C-CON):** adopted the seven text-form gaps found by the phase-4 property tests as additive forms (contract §8.2.1): explicit speech verbs, `text=`/`reason=` keys, quoted `@"dm"`, quoted `"party"`, trailing `ability=`, and leading keys on `/rule amend`. Rationale: the contract table gave no canonical form for them, so round-trip rule 3 could not hold for those Intents. The fix adds forms only. The schema is unchanged, so this is a minor bump (`INTENT_SCHEMA_MINOR = 1`) with no upcaster.
