# ADR 0002: Adopt the praxis process architecture (board, pinned wiki, CI gates, releases)

- **Status**: accepted
- **Date**: 2026-07-10
- **Decision maker**: operator (Evan Stern)
- **Reopens**: nothing — this extends the Development Workflow; no fixed decision (D1–D14) is touched.

## Decision

The repo adopts the process architecture proven in the praxis repo, in three parts:

1. **Kanban derived from specs.** A committed `backlog/` (Backlog.md) board, linked to
   Spec Kit spec dirs by the spec-bridge plugin (`Spec: specs/NNN-…` marker, `Spec phase:`
   acceptance criteria mirrored from `tasks.md`). Derivation is one-way — artifacts drive
   the board; a task's status must never exceed what its spec dir proves. Specs 007–009
   were retro-linked at adoption.
2. **CI as the authoritative gate suite** (`.github/workflows/ci.yml`): `pnpm verify` with
   live DB-integration suites, the ML sidecar suite, wiki freshness, the spec-bridge board
   check, the per-spec course gate, spec-artifact closure (Principle VIII), ADR format,
   and a version-bump contract on PRs. Wiki-freshness and spec-bridge run through
   praxis's **official consumption surface**: the composite GitHub Action
   (`uses: evanstern/praxis@v0.4.0`; gate names, inputs, and exit codes are praxis's
   semver'd consumer contract, its `docs/consuming-gates.md`). The course gate still
   enumerates `docs/courses/*/` through `scripts/check-courses.mjs` against a praxis
   checkout pinned by `PRAXIS_REF` — the action's course input is single-dir and this
   repo carries one course per spec plus the legacy baseline. Both pins ride the same
   tag; upgrading is a deliberate PR. Local mirrors (`.githooks/`, the Claude Stop hook
   in `.claude/settings.json`) prefer the same versioned runner
   (`scripts/run-gates.mjs`) from a local checkout and are conveniences, never the
   authority.
3. **Single repo-level semver + automatic releases** (`.github/workflows/release.yml`):
   one version in the root `package.json`; a PR touching released surface (`apps/`,
   `packages/`, `scripts/`, compose files, root manifests) must increase it; each merge to
   `main` carrying a new version is tagged `v<version>` and released with generated notes.
   Versions are never reused.

Two scoped exceptions, both temporary:

- **Course-gate legacy baseline**: the pre-gate courses (007/008/009, built on v1 chrome)
  fail the current course gate; `scripts/check-courses.mjs` downgrades exactly those three
  to warnings. Rebuilding them and emptying the baseline is tracked on the board
  (tasks 4–7).
- **No strict Done**: spec-bridge's `strictDone` (requiring a saved `analysis.md` per
  spec) stays off until the spec cycle starts persisting `/speckit-analyze` reports as
  `specs/<feature>/analysis.md`.

## Context

Through spec 009 the repo had strong conventions (constitution v2.x, `pnpm verify`,
per-spec courses, wiki, ADRs) but no CI, no kanban, and no mechanical enforcement — every
doctrine check was manual. The praxis repo runs the same doctrine mechanically: gates as
small dependency-free scripts, a Stop hook that won't let a turn end with ledgers broken,
a freshness gate over a commit-pinned wiki corpus, and "status can't exceed proven
artifacts" as the bridge between a kanban and spec artifacts. `docs/wiki/` was migrated
from an `updated:`-date convention to the praxis corpus-spec v1 code dialect
(`verified_against` + `sources` pins) so freshness is provable, not asserted.

## Consequences

- **Squash merges are prohibited on `main`.** Wiki pins and evidence reference commit
  SHAs that must stay reachable; squashing orphans them (and CI's freshness gate would
  fail on unknown pins). Merge commits only.
- Because praxis is private, CI needs two access grants: the praxis repo must allow
  **Actions access from user-owned repositories** (praxis Settings → Actions → General →
  Access) so `uses: evanstern/praxis@<tag>` resolves, and this repo needs the
  `PRAXIS_READ_TOKEN` secret (fine-grained read-only PAT) for the course-gate checkout.
- The `uses:` pin and `PRAXIS_REF` must stay on the same tag; the v0.4.0 pin requires
  praxis PR #23 (the composite action) to be merged and released first.
- Any PR touching released surface now carries a version bump, and every such merge
  produces a tagged GitHub Release — `git tag` becomes the deploy history.
- The constitution's Development Workflow section codifies these rules (v2.3.0
  amendment); AGENTS.md carries the day-to-day commands.
