# Data Model: CI pipeline with boundary check

No persistent data.

- **Check set** — ordered list in root `package.json` `ci:check`: lint (includes the
  boundary rules), typecheck, build, test, check:boundaries, check:hooks. Any nonzero
  exit stops the chain and fails the run.
- **Boundary zone** — a glob of source files plus the import specifiers it may not use.
  Zones: `apps/web`, `packages/shared`, and three planned plane zones under
  `apps/server/src/{library,codex,session}`.
