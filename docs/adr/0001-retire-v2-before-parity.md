# ADR 0001: Retire v2 before feature parity; promote v3 to the repo root

- **Status**: accepted
- **Date**: 2026-07-06
- **Decision maker**: operator (Evan), directed explicitly
- **Reopens**: constitution Fixed Technical Decision **D1**, which stated "v2 stays a
  runnable reference until parity, then is retired deliberately."

## Decision

Retire the v2 application now — before v3 reaches feature parity — and promote the v3
monorepo from `v3/` to the repository root. v2's code, compose files, env templates,
Makefile, scripts, and test fixtures are deleted from the working tree; git history is
the archive (last full v2 state is the parent of merge `cd9ed68` on `main`).

## Context

D1 assumed v2 would be needed as a runnable reference while v3 grew toward parity. In
practice, once the walking skeleton (spec 007) landed:

- Every seam future specs rely on is proven end-to-end in v3 with live evidence
  (`specs/007-v3-skeleton/evidence.md`), so v2 is no longer the reference for "how it
  should behave" — the specs, contracts, wiki, and courses are.
- v2's knowledge is preserved in more durable, more useful forms than runnable code:
  the grounding docs (`docs/grounding/`), a full v2 inventory
  (`.v2/grounding/02-v2-inventory.md`), the historical wiki pages (`.v2/wiki/`), and the
  v2 interactive course (`.v2/courses/inside-the-stacks-v2/`). These preserved artifacts,
  plus the v2-era specs 001–006, were later staged under `.v2/` pending eventual deletion.
- Keeping two stacks doubles the surface an operator/agent can accidentally touch and
  keeps the repo root describing an app that is no longer the product's direction.

## Consequences

- The "deliberate retirement" D1 required is this ADR plus the removal commit; the
  "until parity" clause is superseded by operator direction.
- v2's documented runtime contracts (ports 5433/6334/5050/8001/5174, `make smoke`, the
  corpus workflow) are void. Anything that needs them must check out history.
- The coexistence machinery v3 carried (the 44xx/5442 port block, distinct compose
  project name `the-stacks-v3`, disjoint volume names) is retained — it is harmless,
  already deployed on operator machines, and still useful for parallel worktrees.
- `scripts/check-boundaries.mjs` rule 2 ("no v3 → v2 imports") is repurposed as a
  general no-imports-escaping-the-source-roots tripwire.
- Restoring v2, if ever needed: `git checkout cd9ed68^ -- apps docker-compose.yml ...`
  or browse the tag/merge history on `main`.
