# Module 5: The Optional Specialist

Write to: `modules/05-optional-specialist.html` — a single `<section class="module" id="module-5">` only.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use the
DOMAIN terms this module introduces — one crisp sentence each, with the governing
Principle/FR in parentheses. Crisp developer metaphors only.
Terms: `cross-encoder` ("a model that scores query+passage JOINTLY — a sharper, slower second opinion than bi-encoder cosine — research R9"), `model role` ("a named env-first configuration; empty provider = role disabled — Principle VII/D14"), `no silent fallback` ("rerank-on with a dead dependency FAILS the search; it never quietly returns the unreranked order — FR-021"), `prerank position` ("where fusion had a result before the reranker moved it — recorded on every receipt line — FR-022").

## Teaching Arc
- **Metaphor:** An optional specialist consultant. The house doctors (two signals + fusion) handle everything; when the consultant is hired (env-configured), they re-examine the top candidates — and if they're hired but unreachable, the clinic REFUSES the appointment rather than quietly pretending they were consulted.
- **Opening hook:** "The reranker isn't on. That's not an oversight — it's the most principled configuration in the repo: nobody has measured it earning its latency yet."
- **Key insight:** Optionality is honest at every layer: disabled role reported on /ready without failing readiness; rerank=on with a disabled role refuses at CONFIG time; a failing scorer fails the SEARCH with no receipt; and the receipt records both orderings when it does run.
- **Why should I care?:** This is the template for every future optional model role — how to add capability without adding silent degradation.

## Canonical vocabulary
`role resolution (disabled|loading|ready|failed)` → `config gate (fail fast)` → `stage (top rerankDepth)` → `re-order` → `record both orderings`

## Screens (5)
1. Hook + group-chat animation: Engine, Config, Sidecar /ready, /v1/rerank — the disabled-role refusal at config time vs the mid-flight failure (503, no receipt).
2. The sidecar side: translation block on apps/ml/src/ml/main.py /v1/rerank (guard-order comment: not-ready → wrong model → infer; ONE error taxonomy).
3. The client: translation block on rerank-client.ts (verbatim envelope translation + the every-id-once internal_fault); callout: a sidecar that broke the every-id promise would silently corrupt rankings — refuse loudly.
4. The stage: translation block on search.ts's rerank block (wiring-bug internal_fault + ties keep fused order + prerank recording).
5. Quiz + handoff to Module 6 (what happened when the whole machine met reality).

## Code Snippets (verbatim, file:line)
**Snippet A** — `apps/ml/src/ml/main.py` (/v1/rerank handler, guard order region)
**Snippet B** — `packages/retrieval/src/rerank-client.ts` (every-id-once check + envelope translation)
**Snippet C** — `packages/retrieval/src/search.ts` (the rerank stage block incl. its doctrine comment)

## Interactive Elements
- [x] Group-chat animation (screen 1)
- [x] Code↔English translations — A, B, C
- [x] Quiz — 3: (1) RETRIEVAL_RERANK=on, RERANKER_PROVIDER empty — where does it fail (config resolution, before any request); (2) sidecar dies mid-search with rerank on — what does the operator see and what's recorded (typed 503 naming the stage; NO receipt — the search didn't complete); (3) why keep prerank positions (FR-022: the receipt must prove what the reranker changed — and the eval program needs both orderings).
- [x] Callouts — /ready additive field (a disabled OPTIONAL role must not fail the stack's healthcheck); the 256-passage contract cap ↔ config validation.
- [x] Glossary tooltips.

## Connections
- **Previous:** Module 4 — the dyno this stage must prove itself on.
- **Next:** Module 6 "The Day-One Finding" — the live story.
- **Tone/style:** accent #dc2626; REAL value: live /ready shows reranker: disabled (evidence.md).
