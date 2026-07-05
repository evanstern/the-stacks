# The Stacks v3 — Grounding Package

This folder is the grounding material for the third iteration of The Stacks. It is written
to be handed to SpecKit (`/specify`) as shared context: it records what exists today (v2),
what v3 is, the decisions already made (with rationale), and the questions deliberately left
open for individual feature specs.

**It contains no code.** Everything here is design intent, constraints, and inventory.

## Contents

| Doc | What it covers |
|---|---|
| [01-vision-and-scope.md](01-vision-and-scope.md) | What The Stacks is, v3 scope (in/out), product principles that must survive the rewrite |
| [02-v2-inventory.md](02-v2-inventory.md) | What v2 actually built, what to port / adapt / drop, and lessons encoded in the code |
| [03-architecture.md](03-architecture.md) | The decided v3 stack and service topology, data stores, error & observability doctrine |
| [04-chat-and-tools.md](04-chat-and-tools.md) | Single-turn vs multi-turn chat, LLM provider layer, memory, tool use, citations |
| [05-ingestion.md](05-ingestion.md) | The extensible ingestion service: plugin model, D&D Beyond ingester, corpus lifecycle |
| [06-eval-program.md](06-eval-program.md) | The embedding/retrieval evaluation program: tracks, method, artifacts |
| [07-dev-experience.md](07-dev-experience.md) | Worktree model, compose/env/port hygiene, SpecKit + Backlog.md workflow, durable artifacts |
| [08-decisions-and-open-questions.md](08-decisions-and-open-questions.md) | Decision log (D1–D14) and the open questions each spec must answer |

## How to use with SpecKit

- Treat `08-decisions-and-open-questions.md` as the constitution-adjacent decision log:
  specs should not relitigate D-numbered decisions without flagging it explicitly.
- Each candidate feature spec listed in doc 08 should cite the relevant sections here
  as its grounding, and pull its open questions from the same doc.
- Backlog.md items should reference the spec they belong to (see doc 07).
