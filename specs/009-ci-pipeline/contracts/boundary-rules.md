# Contract: boundary rules

| Zone (files) | Must not import |
|---|---|
| `apps/web/**` | `@the-stacks/server`, `**/apps/server/**` |
| `packages/shared/**` | `@the-stacks/server`, `@the-stacks/web`, `**/apps/**` |
| `apps/server/src/library/**` | `**/codex/**`, `**/session/**` |
| `apps/server/src/codex/**` | `**/library/**`, `**/session/**` |
| `apps/server/src/session/**` | `**/library/**`, `**/codex/**` |

A cross-plane need goes through a declared seam module (constitution III); the seam is
exempted by name when the first one is written — not in this task.

Every row has one fixture file under `fixtures/boundary-violations/` mirroring the zone
path. `pnpm check:boundaries` fails unless every fixture is flagged.
