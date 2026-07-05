# 07 — Development Experience & Working Agreements

## Greenfield-in-repo strategy (D1)

v3 is built fresh in this repository, alongside v2, which stays intact and runnable as the
reference implementation until v3 reaches parity on the ported scope. Practical
implications for the first spec:

- v3 gets its own app directories and its own compose files; nothing in v3 imports v2 code.
- Porting means re-reading v2 (and its specs/wiki) and re-expressing the design — the
  inventory in doc 02 says what's worth carrying.
- v2 is retired (directories archived or deleted) in a deliberate, final step once parity
  is verified — not left to rot half-referenced.

## Worktree operating model (design constraint 2)

The bare-repo + worktrees model from `docs/worktree-operating-model.md` continues, but v3
adds **tooling** so it stops being manual discipline. Required behaviors, to be specified
as a small CLI/script suite:

- **Create**: a new worktree clones `.env` from the main worktree, then applies overrides —
  most importantly a unique port block and a unique compose project name, so two worktrees
  can run side by side without collisions.
- **Ports as env, everywhere**: every published port in every compose file is an env
  variable with a default; no literal host ports in compose. A worktree's identity (name
  or index) derives its port block deterministically.
- **Isolation**: per-worktree compose project names mean per-worktree containers, networks,
  and volumes by construction.
- **Teardown**: a single command stops the worktree's stack, removes its containers,
  networks, **and volumes**, then removes the worktree. Leaving no running processes or
  orphaned Docker volumes behind is an acceptance criterion, not a courtesy. A doctor/list
  command that shows every worktree's stack status (and flags orphans) keeps this honest.

## Deployability

`docker compose up` from a fresh clone plus a populated `.env` brings up the entire v3
system (constraint 1). Anything that requires more hands than that (model downloads for
the sidecar, migrations) happens inside the compose lifecycle, not as documented manual
steps. The prod variant follows v2's shape: internal-only databases, one published port,
pinned model configuration.

## Process: SpecKit + Backlog.md

- **SpecKit drives features.** This grounding package is the shared context every
  `/specify` run starts from. Doc 08 lists the candidate spec seams. v2's spec packages
  (001–006) remain as precedent for depth and format.
- **Backlog.md is the kanban surface.** Work items reference their spec by id/name in the
  description; the board tracks execution state while specs own the "what and why."
  (Backlog.md is not the spec system — SpecKit is; the board just points at it.)

## Durable artifacts ("learn as we go")

The unreasonable demand, made concrete:

- **ADRs**: any decision that changes a D-number, a default (embedding model, chunking
  params, retrieval strategy), or a doctrine in this package gets an ADR in a dedicated
  directory. The D-numbers in doc 08 are ADR-0 seeds.
- **Eval reports**: every experiment in the doc-06 program files a written report;
  defaults only change with a report + ADR pair behind them.
- **Wiki continuity**: the `docs/wiki` architecture-notes habit continues for v3
  subsystems (the v2 notes were repeatedly load-bearing during this grounding effort).
- **Teaching artifacts**: the "Inside The Stacks" course pattern (HTML modules/slides)
  worked as both documentation and forcing-function for clarity. Milestone-level artifacts
  (e.g., "how v3 conversations work") are encouraged deliverables at phase boundaries,
  using available skills for slides/courses.

## Testing posture

- The TS core gets a real unit/integration test suite from the start (v2's 35 pytest
  modules set the bar; the v2 frontend's "verify scripts only" gap is not repeated —
  the v3 web app gets a proper test runner).
- The smoke-test tradition continues: one command that exercises upload → ingest →
  retrieve → answer against a running stack, plus the eval harness's deterministic
  provider for CI-safe regression checks.
- Contract tests pin the API boundary (error-mapping conventions per doc 03) and the
  plugin contract (a conformance suite any ingester must pass — doc 05's "small task"
  promise depends on it).
