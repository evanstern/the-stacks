# Mutation guard (T008)

Run by the orchestrator on 2026-10-29 against d5aba097.

The mutation made `stripThink` in `apps/server/src/dm/pipeline/call.ts` return its input unchanged (`return text;`).

Mutated run, `pnpm exec vitest run test/dm/call.test.ts`: 5 failed, 21 passed (26). The failing tests:

- strips leading think blocks only
- parses a think-prefixed reply on attempt 1
- parses a fenced body after the block
- re-asks on a think-only reply with the raw text
- callText drops the think block

Reverted with `git checkout`. Second run: 26 passed (26). `git status --short` was empty.
