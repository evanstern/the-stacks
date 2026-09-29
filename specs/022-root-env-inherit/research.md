# Research — 022 root .env inheritance

Decisions made against `scripts/env.mjs` and `scripts/env-lib.mjs` at the branch point.
The root `.env` was inspected by key name only (`cut -d= -f1`): `NINEROUTER_API_KEY`,
`AI_PROVIDERS`, `AI_PURPOSES`, plus two comment lines. No continuation lines.

## R1 — Precedence: derived > root > existing worktree > example default

- **Decision**: per key, the first layer that has it wins, in that order.
- **Why**: derived keys are identity; a stale or foreign port must never survive (spec 010
  R5). Root is the operator's single source for shared keys, so it beats a worktree's
  older copy; otherwise a rotated key never reaches existing worktrees. The worktree's own
  `.env` still beats the example, so a key set only in the worktree survives as today.
- **Alternative rejected**: *existing worktree > root* (root only fills gaps). A rotated
  secret or changed `AI_PURPOSES` would then never propagate to a worktree that already
  has the key. That is the copy-goes-stale defect the request exists to remove.

## R2 — Per-worktree override of a shared key: not built

- **Decision**: root wins, with no override. The operator asked for this.
- **Consequence**: a worktree hand-edit of a shared key is overwritten on the next
  `env:up`. The inherited-key line `env:up` prints names what it overwrote.
- **Upgrade path, if ever needed**: add a git-ignored `.env.local` per worktree, read as a
  layer between derived and root. It holds only deliberate overrides, so `env:up` never
  rewrites it. No flag or marker syntax is needed. `ponytail:` comment on the merge names
  this ceiling.

## R3 — Finding the root checkout

- **Decision**: reuse `rootToplevel(cwd)`: `path.dirname(git rev-parse
  --path-format=absolute --git-common-dir)`. The shared file is `<root>/.env`.
- **Why**: already used by `deriveIdentity` and `env:main`; it resolves the same from any
  worktree, including `.worktrees/env-main`. `env:up` from root is still refused by
  `deriveIdentity`, so `env.mjs` never writes root's `.env`.

## R4 — `env:main` inherits

- **Decision**: `.worktrees/env-main` inherits the shared layer, like any worktree.
- **Why**: `env:main` exists for ad-hoc local runs of `origin/main`. Without the AI keys its
  model features are dead, and the operator hand-copies secrets into a worktree whose
  `git clean -fdx -e .env` keeps that copy forever, stale. Inheriting is the same fix
  applied to the one worktree most likely to need it. Identity is unchanged: env `main`,
  3000/5432, no test stack.
- **Reading of AC #3**: "env:main behaves as before" is read as its identity, ports,
  refusals, and stack shape. Its `.env` gains shared keys. Operator checkpoint in plan.md.
- **Mechanism**: `writeEnvFile` is shared by `up` and `main`, so inheritance lands in both
  with no branch.

## R5 — Derived-key exclusion is a fixed set

- **Decision**: export `DERIVED_KEYS = ["APP_PORT", "DB_PORT", "STACKS_ENV",
  "TEST_DB_PORT", "TEST_DATABASE_URL"]` from `env-lib.mjs`. The shared layer drops these
  keys always, not only the keys the current verb derives.
- **Why**: `env:main` derives no `TEST_*` keys. Excluding by `Object.keys(derived)` would
  let root's `TEST_DATABASE_URL` reach env-main and aim host-run tests at root's database.

## R6 — Parsing: reuse `parseEnvKeys`; values verbatim

- **Decision**: parse the root file with the existing `parseEnvKeys`. It matches
  `^KEY=(.*)$` per line and keeps the rest of the line, so `=`, braces, colons, and quotes
  in JSON values survive. Values are written back verbatim.
- **Why**: every consumer (compose `env_file`, Node `--env-file`) reads the worktree file
  with the same dialect it would read root's, so verbatim is correct and quote handling
  is not needed.
- **Ceiling**: multi-line quoted values and `export KEY=` lines are not parsed. Root has
  neither today. `ponytail:` comment names it; upgrade by extending `parseEnvKeys`.

## R7 — Secrets never printed

- **Decision**: `env:up` prints one line: `inherited from <root>/.env: KEY, KEY` (names
  only, derived keys excluded), or nothing when there is no root `.env`. `status`/`prune`
  never read `.env`. The e2e test asserts names only; it never reads root values. Unit
  tests use synthetic fixtures.

## R8 — Existing Postgres volumes and `POSTGRES_PASSWORD`

- **Finding**: if root's `.env` sets `POSTGRES_PASSWORD`/`DATABASE_URL`, a worktree whose
  volume predates the change keeps the old password; Postgres reads it only at volume
  init. Root's current `.env` sets neither.
- **Decision**: document the remedy (`env:down` then `env:up`; `down -v` drops the volume).
  No code.
