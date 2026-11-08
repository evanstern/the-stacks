<!--
SYNC IMPACT REPORT
==================
Version change: 2.0.0 -> 3.0.0 (ratified 2026-11-07 at CP-2)
Status: ratified. The operator approved P-01…P-21 at CP-1 and this text at
  CP-2 on 2026-11-07 (docs/design/replan-2026-11/plan-of-action.md §7).
Bump rationale: MAJOR. Principles are renumbered, two are redefined
  incompatibly (old II, old VII folded into new VIII), and five are new. The
  product goals changed (brief.md, 2026-11-06): four co-equal goals, UX
  first-class, campaign creation co-authored by human and AI.

Principle map (old -> new):
  I.    Agent-Operable by Construction (NN)  -> I.    same; interface is now
                                                       Intents + the gate (P-08)
  —     (new)                                 -> II.   One Intent Vocabulary (P-08)
  IV.   Event-Sourced Play, Server Authority  -> III.  same; planner added (P-08)
  III.  Three Data Planes                     -> IV.   same; reveal seam named
  —     (new)                                 -> V.    Many Views, One State
                                                       (P-02, P-03, P-09)
  VI.   5e Only, Behind an Engine Boundary    -> VI.   5e Only; the Engine Owns
                                                       the Numbers (+ positions, P-09)
  —     (new)                                 -> VII.  Narration Around Facts (P-12)
  II.   Content Is a Contract                 -> VIII. Campaign Is Data, Co-Authored
  VII.  Structured Before Styled              ->       (both folded; P-10, P-11, P-17)
  —     (new)                                 -> IX.   UX Is a Quality Bar (P-03, P-04, P-14)
  V.    Grounded Claims Carry Citations       -> X.    same; rulings carry a "why"
  VIII. Operator-Owned Content (NN)           -> XI.   unchanged
  IX.   Self-Hostable by Default              -> XII.  same; structured output per purpose
  —     (new)                                 -> XIII. Plan Just-in-Time (P-16, decision-0020)

Redefinitions (incompatible):
  - Old II "portrayal-completeness lint in CI" -> new VIII readiness lint that
    gates "ready for play", never saving. AI-authored content lands as drafts.
  - Old IV "LLM output reaches the log only as a typed proposal" -> new III/VII:
    mechanics reach the log only through the deterministic planner; the model
    reaches it only on a needs_ruling path or as prose slots.
  - Post-hoc narration audit (regenerate -> fallback) is no longer a defense of
    record (P-12).

Sections amended:
  - Architecture Constraints: client row narrowed (SSR shell and notebook;
    play and board routes client-only); PixiJS scoped to the board; package
    seams row added; structured output row added; deferred list gains the
    adapter repo (P-07) and engine publishing (P-15). Stack otherwise kept (P-19).
  - Development Workflow and Quality Gates: adds the latency gate, Intent
    contract tests, projection parity tests, the accessibility and responsive
    gate, the no-modal lint, the fact-sheet test, and milestone playtest gates.
  - Governance: proposed-status rule; old->new numbering for historical specs.

Sections removed: none.

Templates requiring updates:
  .specify/templates/plan-template.md   - updated: Constitution Check renumbered
                                          to I-XIII; new gates for II, V, VII,
                                          VIII, IX, XIII
  .specify/templates/spec-template.md   - updated: CR-001..CR-009 renumbered and
                                          extended
  .specify/templates/tasks-template.md  - updated: compliance tasks renumbered;
                                          Intent, parity, latency, a11y tasks
  .specify/templates/checklist-template.md - checked: no principle references
  .specify/templates/constitution-template.md - checked: generic example only

Follow-ups (on ratification, not before):
  - docs/ops/orchestrator-kit/dispatch-rules.md names "constitution.md 2.0.0";
    bump it to 3.0.0 at CP-2.
  - docs/wiki/overview.md pins this file and cites Principles IV, VI, VIII by
    old number; run /grounding-wiki:wiki-update after the replan merges.
  - Record CP-2's ruling as a decision record and set the Ratified line below.

Migration for work already built: none forced. Specs 001-091 cite old principle
  numbers; they stay historical. Read them through the map above. A spec
  reopened after CP-2 re-runs its Constitution Check against 3.0.0. Code that
  violates new II, V, VII or IX (free-text-only writes, seed JSON, audit loop)
  retires through the R1-R2 cards, not by spec rewrite.

Deferred TODOs:
  - XIII card depth: the dispatch brief says "the next milestone"; P-16
    recommends "the next two". The CP-1 ruling on P-16 sets the number; edit
    XIII to match before CP-2.

Provenance: docs/design/replan-2026-11/{brief,wishlist,target-architecture,
  plan-of-action,decisions-for-ratification}.md and research/*.md (2026-11-06/07).

==================
Version change: 1.0.1 -> 2.0.0
Bump rationale: MAJOR. Principle VI is redefined incompatibly: the
  system-agnostic core and the fate-core conformance module are removed and
  replaced by a 5e-only rule (decision-0010). Principle VIII's "ships no rulebook
  content" is narrowed to proprietary content, so openly licensed SRD 5.2.1 data
  may ship with its required attribution (decision-0012). Principle IV's
  validation clause now names the gate and the 5e engine (decision-0015,
  decision-0017).

Principles amended:
  IV.   Event-Sourced Play, Server Authority - validation clause reworded:
        "validate against the active system module" -> "pass every change
        through the gate and the 5e engine"; pending proposals named as hidden
        information. Obligation unchanged in kind.
  VI.   System-Agnostic Core, 5e First -> 5e Only, Behind an Engine Boundary
        (redefined; conformance suite removed).
  VIII. Operator-Owned Content (NON-NEGOTIABLE) - "ships no rulebook content"
        -> "ships no proprietary rulebook content"; SRD data with attribution
        permitted. Stays NON-NEGOTIABLE.
  I.    Agent-Operable by Construction - rationale text only: the milestone
        reference "(M7-M9)" no longer names the automaton after the 2026-10-25
        ladder; reworded without milestone numbers. No obligation change.

Sections amended:
  - Architecture Constraints: the deferred item "Runtime-pluggable third-party
    system modules" removed (no system-module interface exists any more).
  - Development Workflow and Quality Gates: "system-module conformance
    (Principle VI)" replaced by "5e engine scripted-dice tests (Principle VI)".

Sections removed: none.

Templates requiring updates:
  .specify/templates/plan-template.md   - updated: VI check now "5e boundary";
                                          VIII check names SRD attribution;
                                          stack line says React Router 8 SSR
  .specify/templates/spec-template.md   - updated: CR-004 now a 5e-boundary
                                          requirement; CR-005 wording
  .specify/templates/tasks-template.md  - updated: conformance task replaced by
                                          scripted-dice engine tests and SRD
                                          attribution guard
  .specify/templates/checklist-template.md - checked: no principle references
  .specify/templates/constitution-template.md - checked: generic example only
  README.md / docs                      - checked: no principle references

Migration for work already built: none required. Existing specs carry CR-004
  "system-agnostic" requirements; they forbade 5e assumptions in code that has
  none (scaffold, compose, server, event log, gateway, parser, answerer). They
  remain true and are historical; no spec is rewritten.

Deferred TODOs: none.

Provenance: decision-0010, decision-0012, decision-0015, decision-0017, session
  record doc-0004 (2026-10-25), carried by TASK-0041.

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

the-stacks is a self-hosted D&D 5e platform. A solo player plays a full campaign
with an AI DM. A human table plays with a human or an AI DM, in text or on a
board. A human DM and the AI co-author the campaign. This constitution governs
every spec, plan, and task in the repo.

**Status: ratified (3.0.0), 2026-11-07 at CP-2.** P-nn ids cite `docs/design/replan-2026-11/decisions-for-ratification.md`.

## Core Principles

### I. Agent-Operable by Construction (NON-NEGOTIABLE)

- Every subsystem MUST be operable by an agent as well as a human.
- An agent MUST reach every capability through the same Intents and the same gate a human uses.
- No feature may ship a human-only path.

Rationale: the AI DM and the human DM sit in the same seat. Retrofitting agent
access later means rewriting every subsystem.

Verification: each spec names the Intent kinds an agent sends to drive the feature.

### II. One Intent Vocabulary

- Every write to the world MUST be a typed Intent from the shared `intent` package.
- Typed text, slash commands, buttons, the sheet, board gestures, the AI DM, the human DM and adapters MUST all emit Intents.
- Free text MUST be parsed into Intents. It is never a separate write path.
- Every Intent MUST have a text form, and `parse(toText(i))` MUST round-trip.
- A deterministic planner MUST turn an Intent into engine commands, a refusal, or a needs-ruling request.
- The planner MUST NOT call a model. Only a needs-ruling request reaches an AI or human DM.
- A surface MUST NOT call the planner or the engine directly.

Rationale: a button with nowhere to go but an LLM is slow and unreliable (P-08,
audit §3.2). One frozen contract lets every surface lane build in parallel. A
text form gives accessibility and agent operation for free.

### III. Event-Sourced Play, Server Authority

- A game session IS its event log. Events are typed, ordered by `(session_id, seq)`, and append-only.
- All mutations MUST pass through the server's gate, the planner, and the 5e engine.
- The server MUST append only the events they produce. A refusal appends nothing.
- Model output MUST reach the log only as a ruling Intent, a typed proposal, or a prose slot.
- Hidden information MUST live in events with a `visibility` field, filtered per viewer on the server.
- A client MUST NOT receive information its viewer may not see.
- Events MUST carry a schema version. Projections MUST tolerate unknown types.

Rationale: one authority and one ordered log make replay, reconnect, hidden
information, and agent participation one mechanism rather than four.

### IV. Three Data Planes

Every piece of state MUST live in exactly one plane:

- **Library**: imported books. Immutable after ingestion.
- **Codex**: campaign content. Mutable and versioned.
- **Session**: play. Append-only.

- Cross-plane access MUST go through a declared seam.
- Play reads the codex only through `compile()`. Play changes the codex only through reveal events and draft proposals.
- A forbidden cross-plane import is a CI failure.

Rationale: the planes have incompatible write rules. Blurring them corrupts the
guarantees the other principles depend on.

### V. Many Views, One State

- The text stream, zone view, board, sheet, DM console, notebook, AI context and external exports MUST all be projections of the log and the codex.
- A surface MUST NOT hold game state that other surfaces cannot see.
- Every fact a view shows MUST also appear in the text stream.
- Theater of the mind and the grid MUST share one spatial model: zones always, squares only where a map exists.
- Geometry MUST live in the renderer-free `space` package. The renderer draws; it never decides.
- External exports and adapters MUST be read-only projections. Adapters write only Intents.

Rationale: a second state store is a second source of truth, and they drift (P-02,
P-03, P-09). Text parity keeps screen readers, agents and logs complete.

### VI. 5e Only; the Engine Owns the Numbers

- the-stacks supports D&D 5e and no other game system.
- Mechanics MUST live in one pure engine package: `(state, command, rng) -> events | refusal`.
- The engine MUST NOT perform I/O or call a model. Its RNG MUST be seedable.
- The engine owns every number: dice, HP, AC, DCs, conditions, initiative, slots, rests, positions, reach, range and area hits.
- A model MUST NOT roll, compute, or write a mechanical number.
- Session, library and codex code MUST reach mechanics only through the engine package.
- The project builds no second system and no system-module interface.

Rationale: numbers from code are fast, testable and fair. The boundary also
makes the engine publishable (P-15).

Verification: the boundary check forbids I/O and model imports in the engine.
Scripted-dice tests cover every engine command.

### VII. Narration Around Facts

- Code MUST render every fact row: rolls, damage, life state, conditions, positions and the State line.
- The narrator MUST receive a fact sheet and write prose only into named slots.
- Narration MUST NOT carry digits or state that the fact sheet did not settle.
- Fact rows MUST render before narration and never wait on it.
- A leak or contradiction check runs after narration. A failure appends a correction; it never blocks play.
- Post-hoc auditing MUST NOT be the primary defense against wrong narration.

Rationale: regenerate-then-fallback auditing passed 43–71% on the first attempt
and cost 28–39 s turns (P-12). Correct by construction beats correct by inspection.

### VIII. Campaign Is Data, Co-Authored

- Campaign content MUST be codex entities: a generic base with a typed, Zod-validated payload per kind.
- Each kind MUST declare a playable core (identity, portrayal, hooks) that an agent can play from.
- Entities MUST link through typed links and containment, never through prose references alone.
- Visibility MUST sit on each block and on chosen fields: `dm`, `party`, or `pc:<id>[]`.
- A reveal MUST be an event on the session log. It is never a toggle.
- Every version MUST be append-only and record author (`human:<user>` or `ai:<purpose>`), source (`manual`, `generator:<id>@<seed>`, or `chronicle:<session>`), parent, and status (`draft` or `curated`).
- Generators MUST be hybrid: a seeded code skeleton, model prose, and engine-validated numbers.
- AI-authored content MUST land as a draft through the proposal gate.
- A readiness lint MUST gate "ready for play". It MUST NOT block saving.
- Campaign, table and session MUST be first-class records.
- Generated artifacts MUST be structured data before pixels. A map is a validated `MapPlan`.
- Every generated asset MUST store its prompt, provider and seed.

Rationale: the human DM and the AI author the same campaign and play from it
(P-10, P-11, P-17). Provenance makes co-authoring auditable. Seeds make output
reproducible. Prose blobs are not content.

### IX. UX Is a Quality Bar

- A mechanic resolved in code MUST show its fact rows in under 1 s p95 from a confirmed Intent.
- The first narration token MUST arrive in under 10 s p50.
- A combat round of 4 PCs and 4 monsters MUST take under 60 s of wall time.
- The UI MUST NOT use modals. Use slide-out panels, inline editors and autocomplete dropdowns.
- Every view MUST work at 1280 px and at 390 px.
- Every action MUST be reachable by keyboard and announced to a screen reader.
- Status MUST never rely on colour alone. Pair colour with a word.
- Every ruling MUST show a "why": the rule cited, the DC, and the engine primitive.
- Exploration may use the quiet ring. Combat MUST use explicit turns (P-04).

Rationale: players leave at 30 s waits, and latency is the binding constraint,
not cost (P-14). A table that is slow, hidden behind modals, or opaque in its
rulings is not top-notch.

Verification: the latency gate and the accessibility gate run per milestone (see Quality Gates).

### X. Grounded Claims Carry Citations

- A rules or lore claim from the library MUST carry a source anchor: book, section and quote span.
- The operator MUST be able to click through to the passage.
- The system MUST NOT present an ungrounded assertion as rules truth. Where it improvises, it MUST say so.

Verification: fixture-based retrieval evals run in CI. A retrieval regression fails the build.

### XI. Operator-Owned Content (NON-NEGOTIABLE)

the-stacks ships no proprietary rulebook content. The operator imports their own
lawfully obtained books.

- The project MUST NOT bundle, scrape, or redistribute proprietary content.
- The project MAY ship openly licensed SRD data (SRD 5.2.1, CC-BY-4.0).
- Shipped SRD data MUST carry the license's exact attribution, and a test MUST guard it (decision-0012).
- Records extracted from an operator's imports MUST stay in that operator's database volume.
- Generated output MUST NOT reproduce book text beyond quoted citations shown to the operator who supplied the book.

This principle outranks any feature. A feature that cannot be built within it
does not get built.

### XII. Self-Hostable by Default

- `docker compose up` from a clean clone MUST produce a working install: two containers and a volume, single-tenant.
- Model access is bring-your-own cloud API key.
- All model calls MUST pass through one gateway seam. All image generation MUST pass through one image seam.
- Each model purpose MUST use structured output with a declared schema.
- A local model MUST arrive as a config entry behind an existing seam, never as a rewrite.

Rationale: the audience is public self-hosters. A setup only the author can
reproduce has not shipped.

### XIII. Plan Just-in-Time

- Give every milestone one epic.
- Give deliverable cards for the next two milestones full acceptance criteria (P-16).
- Card later deliverables as stubs: title, outcome, milestone and dependencies. Add criteria at that milestone's planning.
- Every deferral MUST be a card with an ordered place or a revisit trigger (decision-0020).
- Fix a seam contract and freeze it before any lane builds against it.
- Every milestone MUST end in a demo. A milestone with play MUST end in a hosted playtest gate.

Rationale: carding every milestone up front grew the board to 253 cards, and most
later cards needed rewriting (P-16). Detail written before its foundations exist
is fiction.

## Architecture Constraints

These bind until amended. They are ratified decisions, not defaults.

| Concern | Binding choice |
|---|---|
| Language | TypeScript end to end. No Python service in V1. |
| Topology | One Node process: REST, WebSocket, worker loop, agent runtime. |
| Server | Node 22, Hono, `ws` |
| Client | React 19, React Router 8 framework mode, Tailwind v4, Radix/shadcn/ui. SSR for the shell and notebook; play and board routes client-only (decision-0008, P-19). No client state library. |
| Board | PixiJS v8, client-only route, React overlays (P-05). Geometry lives in `space`, not the renderer. |
| Datastore | Postgres 17 with pgvector: relational, vectors, job queue, event log, snapshots, codex |
| ORM | Drizzle, with versioned migrations |
| Validation | Zod, single source for Intents, events, engine commands and codex kinds |
| Model output | Structured output (tool call or JSON schema) per purpose, through the gateway |
| Package seams | `srd`, `dnd5e-engine`, `space`, `intent`, `planner`, `session-model`, `codex-model`. Downstream code depends only on a package's published schema. |
| Auth | Self-rolled session auth. Operator plus invited players. No external IdP. |

Deferred by decision, with the seam that admits them later:

- Splitting the worker into its own container: allowed when jobs measurably starve the event loop, proven by load.
- Local embeddings, local diffusion, ComfyUI: an optional sidecar behind the model or image seam.
- Publishing `dnd5e-engine` and `srd` to npm: at release 1.0 (P-15).
- A live VTT adapter repo: only when the P-07 trigger fires. It speaks the ws protocol and writes Intents only.

Adding a service, a language, or a datastore requires a Complexity Tracking entry
in the plan and an amendment if it contradicts the table above.

## Development Workflow and Quality Gates

- **Specs drive the work.** Specify a feature under `specs/NNN-<feature>/` before building it.
- **One TASK, one PR.** A top-level task maps to one branch and one PR. Subtasks ride the parent's branch.
- **The root checkout is read-only.** Author every change in a worktree under `.worktrees/`. Land it by merge.
- **A status never exceeds its artifacts.** Produce the missing artifact. Never hand-edit derived state.
- **Implementation is dispatched.** Run work at the tier in `.claude/model-tiers.json`. Record `Dispatch: tier=<t> pinned=<id> served=<id>` on the task.
- **Grounding stays fresh.** Re-pin `docs/wiki/` before a change to its pinned sources is done.
- **CI is the gate.** Lint, typecheck, test, build and the boundary check MUST pass on every PR.
- **Engine tests.** Every engine command MUST have scripted-dice tests (VI).
- **Intent contract tests.** Every Intent kind MUST have a schema test, a text round-trip test, and a planner test per outcome (II).
- **Projection parity tests.** Every view MUST be tested against the stream for the same events, per viewer. A hidden-information test MUST show no client receives an unrevealed fact (III, V).
- **Fact-sheet tests.** Narration tests MUST show every digit and state comes from a code-rendered row (VII).
- **Codex tests.** Each kind MUST have a schema test and a readiness-lint test. Generator tests MUST reproduce output from a seed (VIII).
- **Latency gate.** CI MUST record time from confirmed Intent to fact rows on fixture tables. Each milestone playtest MUST measure the IX budgets on the hosted stack. A breach blocks the milestone exit (IX).
- **UX gate.** UI PRs MUST pass an automated accessibility check, render at 1280 px and 390 px, and pass a no-modal lint (IX).
- **Retrieval evals.** Library retrieval changes MUST pass the fixture evals (X).
- **Playtest gate.** A milestone with play MUST pass its hosted playtest with the auditor (XIII).
- **Definition of Done.** All checks green. Every acceptance criterion met or bypassed with a recorded note.

## Governance

This constitution supersedes other practice. Where it conflicts with a habit, the
constitution wins. Where it conflicts with `CLAUDE.md`, raise the conflict as an
amendment rather than choosing silently.

**Amendment procedure.** Propose the change as a decision record on the board.
State the principle affected, the rationale, and the migration for work already
built. An amendment takes effect when the operator ratifies that record and this
file is updated in the same change.

**Proposed text.** A version marked PROPOSED does not bind. The last ratified
version binds until the operator ratifies the proposal. Ratification replaces the
status line and sets the Ratified date.

**Versioning.** Semantic versioning applies to governance:

- MAJOR: a principle is removed, renumbered, or redefined incompatibly.
- MINOR: a principle or section is added, or guidance materially expands.
- PATCH: clarification and wording that does not change obligations.

**Compliance review.** Every plan runs the Constitution Check before Phase 0 and
again after Phase 1 design. Every PR verifies compliance. A warranted violation
goes in the plan's Complexity Tracking table with the simpler alternative and why
it was rejected. An unjustified violation blocks the merge.

**Historical numbering.** Specs written under 1.x or 2.x cite old principle
numbers. Read them through the map in the Sync Impact Report. Do not rewrite them.

**Provenance.** Version 1.0.0 was ratified on 2026-09-22 (backlog `decision-1`).
Version 2.0.0 (2026-10-25) amended IV, VI and VIII. Version 3.0.0 is the
replan-2026-11 rewrite: `docs/design/replan-2026-11/` holds the reasoning; this
file is the obligation.

**Version**: 3.0.0 | **Ratified**: 2026-09-22 (v1.0.0); v3.0.0 2026-11-07 | **Last Amended**: 2026-11-07
