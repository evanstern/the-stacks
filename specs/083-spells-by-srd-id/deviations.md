# Spec 083 deviations

- T001 (orchestrator, 2026-11-03): origin/main has not moved since the spec was written against merged TASK-0104 (#123). No seam moved. TASK-0128 (spec 084) is being authored in parallel and shares schemas.ts, plan-gate.ts, resolve.ts, step-grammar.ts and the prompt versions; whichever merges second merges main in and re-bumps.
- Phase 2 (implementer, 2026-11-03): `specs/031-dm-runtime/data/greyhollow-ford.seed.json` is not on plan.md's file list, but `seed.test.ts` requires it to be a byte-for-byte copy of `apps/server/seeds/greyhollow-ford.json`. It was updated with Odo's `cure-wounds` (T023).
- Phase 2: a `spell` reading's refused-slot case (third `cure-wounds`) leaves no row at all: `run.mech` records a refused command as nothing, so T029 asserts two slot rows, two heal rows and two dice rows instead of a refusal row.
