<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 -> 1.0.1
Bump rationale: PATCH. Client row of the Architecture Constraints table only,
  ratified by decision-0008 / doc-0003 (2026-09-29). No principle redefined,
  no obligation changed — the row now names the client stack the operator
  ratified (React Router 8 framework mode, SSR by default) in place of the
  superseded "SPA, not SSR" choice.

Principles amended: none.

Sections amended:
  - Architecture Constraints (Client row only)

Templates requiring updates: none — no template references the superseded
  Client row text.

Deferred TODOs: none.

Provenance: doc-0003 (Frontend stack — rulings) and decision-0008, ratified
  2026-09-29.

==================
Version change: none (template placeholders) -> 1.0.0
Bump rationale: MAJOR/initial. First concrete ratification of the constitution.
  The file previously held only unfilled template tokens, so this is an initial
  adoption rather than an amendment.

Principles defined (all new):
  I.    Agent-Operable by Construction (NON-NEGOTIABLE)
  II.   Content Is a Contract
  III.  Three Data Planes
  IV.   Event-Sourced Play, Server Authority
  V.    Grounded Claims Carry Citations
  VI.   System-Agnostic Core, 5e First
  VII.  Structured Before Styled
  VIII. Operator-Owned Content (NON-NEGOTIABLE)
  IX.   Self-Hostable by Default

Sections added:
  - Architecture Constraints
  - Development Workflow and Quality Gates
  - Governance

Templates requiring updates:
  .specify/templates/plan-template.md   - updated: Constitution Check gate filled
  .specify/templates/spec-template.md   - updated: constitution alignment note
  .specify/templates/tasks-template.md  - updated: principle-driven task types
  .specify/memory/constitution.md       - updated: this file

Deferred TODOs: none.

Provenance: principles derive from the design session ratified 2026-09-21 and
recorded in backlog decision-1, plus docs/design/{vision,architecture,milestones}.md.
-->

# the-stacks Constitution

the-stacks is a self-hosted TTRPG platform that climbs from DM copilot to fully
automated DM. This constitution governs every spec, plan, and task in the repo.

## Core Principles

### I. Agent-Operable by Construction (NON-NEGOTIABLE)

Every subsystem MUST be operable by an agent as well as a human. The automated DM
is the end goal, and it is not a later port. An agent MUST reach every capability
through the same validated interface a human uses. No feature may ship a
human-only path that an agent cannot drive.

Rationale: the automaton (M7-M9) is reachable only if the table is built for an
agent to sit at from the first commit. Retrofitting agent access later means
rewriting every subsystem.

Verification: for each feature, name the interface an agent uses to drive it. A
feature with no such interface fails this gate.

### II. Content Is a Contract

Every codex entity type MUST declare a Zod schema with three sections: `identity`
(mechanical truth), `portrayal` (voice, mannerisms, appearance, motivations), and
`hooks` (typed edges to other entities, secrets, agendas).

An entity is complete when an agent, given only that entity and its linked
neighbors, can generate new in-character content. Prose blobs are not content.

Verification: portrayal-completeness runs as a lint in CI. Schemas MUST be single
source, shared by the API boundary, the agent tool definition, and the client form.

### III. Three Data Planes

Every piece of state MUST live in exactly one plane, and each plane has its own
write discipline:

- **Library** — imported books. Immutable after ingestion.
- **Codex** — campaign content. Mutable and versioned.
- **Session** — play. Append-only.

Cross-plane access MUST go through an explicit seam. A forbidden cross-plane
import is a CI failure, not a review comment.

Rationale: the planes have incompatible write rules. Blurring them corrupts the
guarantees the other principles depend on.

### IV. Event-Sourced Play, Server Authority

A game session IS its event log. Events are typed, ordered by `(session_id, seq)`,
and append-only. Nothing updates an event.

- All mutations MUST pass through the server.
- The server MUST validate against the active system module before it appends.
- Client state and agent context MUST both be projections of the log.
- Hidden information MUST live in events carrying a `visibility` field, filtered
  per viewer at projection time.
- Events MUST carry a schema version. Projections MUST tolerate unknown types.

The AI DM is just another actor: it consumes the same log and emits the same
events as any human.

Rationale: one authority and one ordered log make replay, reconnect, hidden
information, and agent participation the same mechanism rather than four.

### V. Grounded Claims Carry Citations

Any rules or lore claim drawn from the library MUST carry a source anchor: book,
section, and exact quote span. The operator MUST be able to click through to the
passage.

The system MUST NOT present an ungrounded assertion as rules truth. Where it
improvises, it MUST say so.

Verification: retrieval quality is gated by fixture-based eval suites in CI. A
retrieval regression fails the build.

### VI. System-Agnostic Core, 5e First

Game mechanics MUST live behind a system-module interface. The core MUST NOT
assume d20, hit points, or initiative order.

- `dnd5e` is the product: full depth, real implementation.
- `fate-core` is the conformance check: interface depth only, deliberately alien
  (fudge dice, aspects, stress tracks, no initiative order).

A system module declares its character sheet schema, dice and resolution
semantics, turn structure, condition model, and the event types it validates. CI
MUST run the conformance suite against both modules.

Rationale: a second d20 system would only mirror 5e's assumptions back at us. Fate
proves the interface is honestly agnostic.

### VII. Structured Before Styled

Generated artifacts MUST be data before they are pixels. A map is a Zod-validated
`MapPlan` (rooms, walls, doors, terrain, grid dimensions) that a deterministic
renderer draws. Grid alignment, walls, and fog MUST be correct by construction,
never inferred from an image.

Styling is a pass over correct structure, never a substitute for it.

Every generated asset MUST store its prompt, provider, and seed. Regenerability is
part of the contract.

### VIII. Operator-Owned Content (NON-NEGOTIABLE)

the-stacks ships no rulebook content. The operator imports their own lawfully
obtained books.

- The project MUST NOT bundle, scrape, or redistribute proprietary content.
- Imported content MUST stay in the operator's own database volume.
- Generated output MUST NOT reproduce book text beyond quoted citations shown to
  the operator who supplied that book.

This principle outranks any feature. A feature that cannot be built within it does
not get built.

### IX. Self-Hostable by Default

`docker compose up` from a clean clone MUST produce a working install. The target
is two containers and a volume, single-tenant.

- Model access is bring-your-own cloud API key.
- All model calls MUST pass through one gateway seam; all image generation through
  one image-provider seam.
- A local model MUST arrive as a config entry behind an existing seam, never as a
  feature rewrite.

Rationale: the audience is public self-hosters. A setup that only the author can
reproduce has not shipped.

## Architecture Constraints

These bind until amended. They are ratified decisions, not defaults.

| Concern | Binding choice |
|---|---|
| Language | TypeScript end to end. No Python service in V1. |
| Topology | One Node process: REST, WebSocket, worker loop, agent runtime. |
| Server | Node 22, Hono, `ws` |
| Client | React 19, React Router 8 framework mode (SSR by default; realtime and canvas routes client-only), Tailwind v4, shadcn/ui. Supersedes "SPA, not SSR": doc-0003 / decision-0008 (2026-09-29). |
| Tabletop | PixiJS v8 (WebGL), DOM overlays for UI |
| Datastore | Postgres 17 with pgvector: relational, vectors, job queue, event log |
| ORM | Drizzle, with versioned migrations |
| Validation | Zod, as the single source for content contracts |
| Auth | Self-rolled session auth. Operator plus invited players. No external IdP. |

Deferred by decision, with the seam that admits them later:

- Splitting the worker into its own container — allowed when ingestion or image
  jobs measurably starve the event loop, proven by load, not by anticipation.
- Local embeddings, local diffusion, ComfyUI — enter as an optional sidecar behind
  the model or image seam.
- Runtime-pluggable third-party system modules — when someone outside the project
  writes one.

Adding a service, a language, or a datastore requires a Complexity Tracking entry
in the plan and an amendment if it contradicts the table above.

## Development Workflow and Quality Gates

- **Specs drive the work.** A feature is specified under `specs/NNN-<feature>/`
  before it is built. The spec directory is the source of truth for its feature.
- **One TASK, one PR.** A top-level task maps to one branch and one PR. Subtasks
  ride the parent's branch. A PR MUST carry a stated reason for a human to approve.
- **The root checkout is read-only.** Author every change in a worktree under
  `.worktrees/`. Land it by merge. Never rebase.
- **A status never exceeds its artifacts.** Produce the missing artifact rather
  than arguing with a gate or hand-editing derived state.
- **Implementation is dispatched.** Work runs at the tier declared in
  `.claude/model-tiers.json`. Record `Dispatch: tier=<t> pinned=<id> served=<id>` on
  the task. Verify the served model; never infer it.
- **Grounding stays fresh.** Changes touching files pinned by `docs/wiki/` are not
  done until the wiki is re-pinned.
- **CI is the gate.** Lint, typecheck, test, build, and the cross-plane boundary
  check MUST pass. Retrieval evals (Principle V) and system-module conformance
  (Principle VI) join CI at the milestone that introduces them.
- **Definition of Done.** All checks green, and every acceptance criterion met or
  explicitly bypassed with a recorded note.

## Governance

This constitution supersedes other practice. Where it conflicts with a habit, the
constitution wins. Where it conflicts with `CLAUDE.md`, raise the conflict as an
amendment rather than choosing silently.

**Amendment procedure.** Propose the change as a decision record on the board.
State the principle affected, the rationale, and the migration for work already
built against the old rule. An amendment takes effect when the operator ratifies
that record and this file is updated in the same change.

**Versioning.** Semantic versioning applies to governance:

- MAJOR — a principle is removed or redefined incompatibly.
- MINOR — a principle or section is added, or guidance materially expands.
- PATCH — clarification and wording that does not change obligations.

**Compliance review.** Every plan runs the Constitution Check gate before Phase 0
and again after Phase 1 design. Every PR verifies compliance. A violation that is
genuinely warranted goes in the plan's Complexity Tracking table with the simpler
alternative and why it was rejected. An unjustified violation blocks the merge.

**Provenance.** These principles were ratified in the design session of
2026-09-21, recorded in backlog `decision-1`, and expand on
`docs/design/vision.md`, `docs/design/architecture.md`, and
`docs/design/milestones.md`. Those documents remain the reasoning; this file is
the obligation.

**Version**: 1.0.1 | **Ratified**: 2026-09-22 | **Last Amended**: 2026-09-30
