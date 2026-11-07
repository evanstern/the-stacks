# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Answer each gate for this feature. A "no" MUST be justified in Complexity Tracking
or the plan does not proceed.

- [ ] **I. Agent-operable** — names the Intent kinds an agent sends to drive this
      feature. No human-only path.
- [ ] **II. One Intent vocabulary** — every write is a typed Intent with a text
      form; free text parses to Intents; the planner calls no model; no surface
      calls the planner or engine directly.
- [ ] **III. Event sourcing** — play changes are append-only typed events through
      gate, planner and engine; versioned; hidden information carries visibility
      and is filtered on the server.
- [ ] **IV. Data planes** — every piece of new state belongs to exactly one plane
      (library, codex, session). Cross-plane access goes through a declared seam.
- [ ] **V. Many views, one state** — every new view is a projection; its facts also
      appear in the stream; geometry lives in `space`; exports are read-only.
- [ ] **VI. Engine owns the numbers** — mechanics and positions live only in the
      pure 5e engine; no model writes a number; scripted-dice tests ship.
- [ ] **VII. Narration around facts** — code renders every fact row; the model
      writes only prose slots from a fact sheet; fact rows never wait on prose.
- [ ] **VIII. Campaign is data** — new content is a codex kind with a typed payload,
      playable core, typed links, block visibility and versioned provenance; AI
      output lands as a draft through the gate; assets store prompt, provider, seed.
- [ ] **IX. UX quality bar** — states the latency budget it touches (fact rows
      < 1 s p95, first token < 10 s p50); no modals; 1280 px and 390 px; keyboard
      and screen-reader reachable; rulings show a "why".
- [ ] **X. Citations** — any library-derived claim carries a source anchor, and
      retrieval changes ship fixture-based evals.
- [ ] **XI. Operator-owned content** — ships no proprietary rulebook content;
      shipped SRD data carries its attribution; reproduces no book text beyond
      cited quotes. NON-NEGOTIABLE.
- [ ] **XII. Self-hostable** — works from `docker compose up`; model and image
      access stay behind their seams; model output is structured; no new container
      without proven need.
- [ ] **XIII. Just-in-time** — the feature belongs to the current milestone; any
      deferral is a card with an order or a trigger; seam contracts it builds on
      are frozen.

**Stack conformance** — the feature stays within the Architecture Constraints
table (TypeScript, one Node process, Hono, React Router 8, PixiJS for the board
only, Postgres, Drizzle, Zod, the declared package seams). Any departure is an
amendment, not a plan decision.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
