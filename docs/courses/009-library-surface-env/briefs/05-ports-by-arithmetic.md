# Module 5: Ports by Arithmetic

Write to: `modules/05-ports-by-arithmetic.html` — a single `<section class="module" id="module-5">` only.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use:
`worktree` ("a second checkout of the same repo sharing one Git store — the-stacks runs
bare + main/ + one sibling per feature — constitution Development Workflow"),
`compose project` ("the namespace docker compose prefixes containers/networks/volumes
with — the isolation boundary"), `port block` ("a worktree's four published ports,
derived together"), `port-coupled value` ("an env var that must move when a port moves —
API_INTERNAL_URL tracks V3_API_PORT — contract §4").
Crisp developer metaphors only.

## Teaching Arc
- **Metaphor:** Street addresses, not parking spots. A parking lot needs an attendant, a
  registry, and arguments about who took spot 14. Street addresses need arithmetic:
  house NNN is at `base + 10×NNN`, forever, no attendant. Determinism replaces
  registration.
- **Opening hook:** "The operator's own instance historically ran web on 4500. Where is
  that recorded? Before 009: nowhere. It was folklore."
- **Key insight:** A worktree's whole environment derives from its DIRECTORY NAME:
  `NNN-slug` ⇒ ports `default + 10×NNN`, project `the-stacks-<dirname>`, and the
  port-coupled values move with it. Uniqueness is inherited from spec-kit's feature
  numbering — no registry exists because none is needed; the mint tool merely VERIFIES
  the invariant (and refuses loudly when a human broke it by hand).
- **Why should I care?:** Every future cycle's worktree pivot is now one command; and
  the 4500 cautionary tale (it's exactly feature 010's derived web port) explains the
  "manual overrides ≥ 10000" rule.

## Canonical vocabulary
`derive` → `mint` → `refuse (exists / collision)` → `--check (drift)` → `teardown (--volumes)`

## Screens (5)
1. Hook + HERO: the derivation animation — type a worktree name, watch the arithmetic:
   `009-library-surface-env` → NNN=9 → offset 90 → 4490/4491/4492/5532 +
   `the-stacks-009-library-surface-env`. Toggle to `main` → the fixed point (offset 0,
   `the-stacks-v3`).
2. The tool as enforcement: mint refuses an existing .env without --force; refuses
   sibling collisions BY NAME at mint time. Real transcript from evidence.md:
   `✖ port 4492 is already published by ../scratch-collision/.env`. Snippet: deriveProfile
   with the "determinism replaces registration" header lines.
3. Port-coupled values — the retired footgun: API_INTERNAL_URL must track V3_API_PORT
   (the api container binds it INSIDE the container) while EMBEDDING_ENDPOINT and
   DATABASE_URL never move. This warning used to live as a compose comment; now it's
   derivation + a --check finding. Snippet: mintEnv's replacements block. Real drift
   transcript: removing WORKER_POLL_MS → exit 2 naming it.
4. The live proof (SC-004): both stacks at once — 10 containers, disjoint everything
   (the real `docker ps` capture), then `down --volumes` on main → zero the-stacks-v3
   volumes while 009 kept serving /library. Lifecycle table callout: down keeps volumes;
   teardown precedes `git worktree remove`.
5. Quiz + handoff to Module 6 (the bug ledger).

## Code Snippets (verbatim — do not modify)
- `scripts/worktree-env-lib.mjs` — `deriveProfile` (whole function incl. the main/
  fixed-point comment and the underivable-dirname refusal).
- `scripts/worktree-env-lib.mjs` — the `replacements` block in `mintEnv` (the
  port-coupled derivation comment).
- `docker ps` capture + mint/collision/drift transcripts from evidence.md (real output,
  presented as terminal blocks).

## Interactive Elements
- [x] HERO: name→arithmetic→profile derivation animation with main/ toggle
- [x] Terminal-transcript blocks (real refusal, real drift, real docker ps)
- [x] Code↔English on deriveProfile
- [x] Quiz (1): "Two worktrees collide on a port. Which is possible?" → correct: "One of
  them carries a MANUAL override — derived blocks can't collide because feature numbers
  are unique; that's why manual ports go ≥ 10000" (options: spec-kit reused a number /
  a manual override landed in a derived block / the stride is too small).
- [x] Glossary tooltips: worktree, compose project, port block, port-coupled value

## Connections
- Previous: Module 4. Next: Module 6 (bug ledger).
- Accent: violet. Real data: 4490/4491/4492/5532, scratch-collision:4492,
  WORKER_POLL_MS, the 10-container docker ps.
