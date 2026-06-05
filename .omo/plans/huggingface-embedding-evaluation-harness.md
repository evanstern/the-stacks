# Hugging Face Embedding Evaluation Harness

## TL;DR
> **Summary**: Add a script-first embedding evaluation harness that benchmarks Hugging Face embedding models against this repo's existing ingestion, indexing, and retrieval stack without prematurely turning evaluation code into a production runtime module. Keep reusable provider/runtime pieces inside `main/apps/api/app/`, keep benchmarking entrypoints in `main/scripts/`, and define an explicit promotion path if evaluation later grows into a first-class subsystem.
> **Deliverables**:
> - Folder layout for phase-1 evaluation harness work
> - Clear ownership split between runtime code, scripts, tests, and future package boundaries
> - Initial Hugging Face model shortlist and evaluation flow
> - Promotion criteria for when the harness should move into `app/cli/` or a new sibling package such as `app/evals/`
> - Verification strategy and implementation plan that fit the repo's existing workflow
> **Effort**: M
> **Parallel**: YES - 4 waves
> **Critical Path**: Task 1 -> Task 2 -> Task 3 -> Task 4 -> Final Verification

## Context

### Original Request
The user wants to research and plan how to test new embedding LLMs using Hugging Face, with a long-term option to fine-tune certain tasks for certain models later on. Follow-up architecture discussion clarified the immediate question: where should an embedding evaluation harness live in this repo, and what folder layout should we use now versus later if it grows into a more durable subsystem.

### Research Summary
- The current embedding boundary is `main/apps/api/app/embeddings.py`, which exposes `EmbeddingClient` and currently ships only an `OpenAIEmbeddingClient`.
- Retrieval-time lookup lives in `main/apps/api/app/chat_rag.py` and consumes embeddings plus Qdrant through runtime service dependencies.
- Vector storage/search lives in `main/apps/api/app/qdrant_index.py`, which enforces collection dimension compatibility.
- Compose-backed verification already exists as `main/scripts/etl_live_smoke.py`; this is the closest structural analogue for an embedding evaluation harness that exercises real stack behavior but is not itself runtime application code.
- Runtime workflow boundaries are explicit in `main/docs/wiki/Layer Boundaries.md` and `main/docs/wiki/ETL Architecture.md`: ETL owns ingestion/chunking/indexing flow, retrieval owns query-time lookup, and chat owns session orchestration.
- `main/apps/api/app/cli/corpus_seed.py` shows the repo pattern for operational workflows that deserve a stable operator-facing command surface.
- Existing test coverage in `main/apps/api/tests/test_embeddings.py`, `test_qdrant_indexing.py`, and related fixtures shows the repo prefers runtime service tests under `tests/`, not benchmark harness logic inside production modules.

### Architectural Decisions / Mental Model
- Do not treat model evaluation as a production runtime layer on day one.
- Start with a **script-first harness** that imports stable runtime services.
- Keep production-safe provider abstractions and shared adapters in `main/apps/api/app/`.
- Keep benchmark orchestration, report generation, and corpus/query comparisons in `main/scripts/` until they justify a stronger module boundary.
- If evaluation later gains multiple callers, stable contracts, reusable datasets/metrics, and CI gating, promote it into a dedicated sibling package such as `main/apps/api/app/evals/` rather than burying it inside `app/etl/`.
- Do not put evaluation ownership inside `app/etl/` unless the evaluation logic becomes part of ingestion/runtime ETL behavior itself.

## Work Objectives

### Core Objective
Define and implement a repo-native folder layout for Hugging Face embedding evaluation that supports fast model benchmarking now, preserves clean runtime boundaries, and leaves a deliberate path toward later fine-tuning and a first-class evaluation subsystem if the work grows.

### Deliverables
- New plan-guided folder layout for phase-1 embedding evaluation work.
- Runtime/provider extension points identified under `main/apps/api/app/`.
- Benchmark/evaluation entrypoint placement under `main/scripts/`.
- Test fixture and regression placement under `main/apps/api/tests/`.
- Clear promotion criteria for future moves into `main/apps/api/app/cli/` or `main/apps/api/app/evals/`.

### Definition of Done (verifiable conditions with commands)
- The plan names the exact phase-1 file/folder locations under `main/`.
- The plan explains which logic belongs in runtime modules versus scripts versus tests.
- The plan defines at least one script entrypoint and one Makefile target shape for evaluation work.
- The plan defines explicit promotion criteria for `app/cli/` and `app/evals/`.
- The plan keeps alignment with `main/docs/wiki/Layer Boundaries.md` and does not reassign ETL or retrieval ownership.

### Must Have
- Reuse `main/apps/api/app/embeddings.py` as the provider seam rather than inventing a parallel embedding stack.
- Keep Qdrant dimension handling explicit and model-aware.
- Keep evaluation orchestration outside request-serving runtime code.
- Allow model comparison against the real ingestion/indexing/retrieval path, not only isolated notebook-style vectors.
- Leave a clear on-ramp for later fine-tuning data prep and evaluation reuse.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No premature `app/evals/` package if only one script and one benchmark flow exist.
- No evaluation logic hidden inside `app/chat_rag.py` or request handlers.
- No duplication of embedding request code outside the runtime provider layer.
- No assumption that ETL owns benchmarking or model selection policy.
- No fine-tuning implementation in the first evaluation slice.
- No notebook-only plan that bypasses repo-native scripts, tests, and Make targets.

## Recommended Folder Layout

### Phase 1: Script-First Evaluation Harness
Use this layout first:

```text
main/
├── apps/
│   └── api/
│       ├── app/
│       │   ├── embeddings.py                  # existing provider seam; extend here
│       │   ├── qdrant_index.py                # existing vector index adapter
│       │   ├── chat_rag.py                    # existing retrieval consumer; stays thin
│       │   └── embedding_eval_support.py      # optional shared runtime-safe helpers only if reused by scripts/tests
│       └── tests/
│           ├── test_embeddings.py             # provider behavior tests
│           ├── test_qdrant_indexing.py        # ingestion/index integration tests
│           ├── test_embedding_eval_support.py # only if shared support module exists
│           ├── fixtures/
│           │   └── embedding_eval/            # gold queries, expected hits, tiny corpora
│           └── rag_support.py                 # existing support patterns to emulate where useful
├── scripts/
│   ├── eval_embeddings.py                     # primary benchmark/evaluation entrypoint
│   ├── eval_embedding_report.py               # optional report summarizer if needed
│   └── etl_live_smoke.py                      # existing structural analogue
└── Makefile                                   # add make targets such as eval-embeddings
```

#### Phase-1 ownership split
- `app/embeddings.py`: provider selection, provider config, Hugging Face/Sentence Transformers adapter(s), request normalization, dimension metadata.
- `app/embedding_eval_support.py`: only shared reusable logic that is safe to import from both scripts and tests, such as evaluation record shapes, score calculators, or model-run metadata serializers. Do **not** create this file unless duplication actually appears.
- `scripts/eval_embeddings.py`: top-level benchmark driver. It should load a fixture corpus/query set, run one or more embedding providers/models, index into isolated Qdrant collections if needed, execute retrieval checks, and print/save metrics.
- `apps/api/tests/fixtures/embedding_eval/`: tiny gold datasets, query/expected-hit pairs, and minimal benchmark corpora.
- `apps/api/tests/test_*`: regression tests for provider behavior and any shared evaluation support. The benchmark script itself does not need to be turned into a heavy unit-tested subsystem immediately, but its reusable helpers should be.

### Phase 1.5: Operator-Facing CLI Upgrade
If the script gains a stable command-line contract and repeated operator use, promote only the command surface, not the full subsystem:

```text
main/apps/api/app/cli/
└── embedding_eval.py
```

Use `app/cli/embedding_eval.py` only when the workflow needs:
- stable flags/options across sessions,
- preflight checks,
- evidence/report output conventions,
- repeatable operator invocation similar to `app/cli/corpus_seed.py`.

The CLI should still call shared runtime providers and evaluation helpers; it should not duplicate core logic.

### Phase 2: Promote to a First-Class Evaluation Package Only if Needed
If the work grows into a real subsystem, promote it into a sibling package:

```text
main/apps/api/app/evals/
├── __init__.py
├── contracts.py           # benchmark case/result schemas
├── datasets.py            # dataset/gold-set loaders
├── metrics.py             # retrieval metrics, hit-rate, recall@k, MRR-like helpers
├── runner.py              # orchestrates model runs
├── reports.py             # report rendering/serialization
└── fine_tune_support.py   # later stage only, if training/eval data prep is reused
```

Do this only when all of the following are true:
- there are multiple evaluation entrypoints or callers,
- benchmark cases and result schemas have become stable contracts,
- dataset/metric logic is reused across scripts and tests,
- CI or release gates consume the results,
- fine-tuning prep/eval is starting to share abstractions with benchmark runs.

## Initial Evaluation Shape

### Model shortlist for the first benchmark wave
- Fast baseline: `all-MiniLM-L6-v2`
- Quality baseline: `all-mpnet-base-v2`
- Retrieval-tuned candidate: one `multi-qa-*` model
- Retrieval-tuned candidate: one `msmarco-*` model

If multilingual retrieval becomes a real requirement later, add `paraphrase-multilingual-mpnet-base-v2` or `LaBSE` in a later wave rather than bloating the first slice.

### Metrics to capture first
- Retrieval hit-rate@k / recall@k against a small gold set
- Top-hit correctness for exact expected chunk retrieval
- Mean latency per embedding batch and per query
- Collection/vector dimension compatibility
- Ingestion/index success rate for each candidate model

### Gold-set shape
Start with a tiny repo-native fixture set under `main/apps/api/tests/fixtures/embedding_eval/`:
- representative TTRPG-style source chunks
- representative user questions
- expected relevant chunk IDs or source titles
- a few hard negatives with lexical overlap but wrong semantic meaning

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: keep runtime/provider correctness under pytest, keep benchmark runs under `scripts/` with deterministic fixture-driven output where possible.
- Framework: pytest, Makefile targets, optional compose-backed Qdrant/Postgres when the evaluation path needs real index verification.
- Evidence: `.omo/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves
> Target: 3-5 tasks per wave. Keep phase-1 changes thin and avoid premature subsystem design.

Wave 1: Tasks 1-2 — runtime provider seam + phase-1 folder layout.
Wave 2: Tasks 3-4 — benchmark script + fixture dataset.
Wave 3: Tasks 5-6 — metrics/report output + Makefile/test wiring.
Wave 4: Tasks 7-8 — promotion-path docs + full verification.

### Dependency Matrix (full, all tasks)
- Task 1 blocks Tasks 2-8.
- Task 2 blocks Tasks 3-8.
- Task 3 blocks Tasks 4-8.
- Task 4 blocks Tasks 5-8.
- Task 5 blocks Tasks 6-8.
- Task 6 blocks Tasks 7-8.
- Final verification blocks completion.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 2 tasks → `unspecified-high`
- Wave 2 → 2 tasks → `unspecified-high`
- Wave 3 → 2 tasks → `unspecified-high`
- Wave 4 → 2 tasks → `writing`, `unspecified-high`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Extend the Runtime Embedding Provider Seam for Hugging Face

  **What to do**: Update `main/apps/api/app/embeddings.py` and related config so the runtime embedding seam can select between OpenAI and Hugging Face/Sentence Transformers providers. Preserve current OpenAI behavior while adding model/provider configuration, dimension awareness, and provider-specific initialization boundaries.
  **Must NOT do**: Do not duplicate provider logic inside scripts. Do not couple provider selection to retrieval routes or benchmark-only code.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: runtime service boundary extension with provider abstraction.
  - Skills: [] - no special skill required.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: Tasks 2-8 | Blocked By: none

  **References**:
  - Pattern: `main/apps/api/app/embeddings.py` - existing provider seam.
  - Pattern: `main/apps/api/app/config.py` - settings location.
  - Pattern: `main/apps/api/tests/test_embeddings.py` - current provider behavior coverage.

  **Acceptance Criteria**:
  - [ ] Runtime embedding provider selection is explicit and test-covered.
  - [ ] OpenAI behavior remains intact.
  - [ ] Hugging Face provider config is isolated from benchmark orchestration.

  **QA Scenarios**:
  ```
  Scenario: OpenAI provider still works through the shared seam
    Tool: Bash
    Steps: run the embedding provider test suite after the refactor
    Expected: Existing OpenAI provider tests still pass.
    Evidence: .omo/evidence/task-1-openai-provider.log

  Scenario: Hugging Face provider can be selected explicitly
    Tool: Bash
    Steps: run provider selection tests with Hugging Face settings fixtures
    Expected: The runtime seam returns the Hugging Face implementation without route-specific conditionals.
    Evidence: .omo/evidence/task-1-hf-provider.log
  ```

  **Commit**: YES | Message: `feat(embeddings): add pluggable huggingface provider seam` | Files: `main/apps/api/app/**`, `main/apps/api/tests/**`

- [x] 2. Finalize the Phase-1 Folder Layout and Shared Support Boundary

  **What to do**: Decide whether any shared support module beyond `embeddings.py` is truly needed. If duplication appears between scripts and tests, add a narrow helper module such as `main/apps/api/app/embedding_eval_support.py`; otherwise keep phase 1 simpler and let the benchmark script call runtime services directly.
  **Must NOT do**: Do not create `app/evals/` yet. Do not move benchmark orchestration into runtime modules.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: package-boundary decision with scope discipline.
  - Skills: [] - no special skill required.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: Tasks 3-8 | Blocked By: Task 1

  **References**:
  - Pattern: `main/scripts/etl_live_smoke.py` - script-first harness analogue.
  - Pattern: `main/apps/api/tests/rag_support.py` - test support helper precedent.
  - Pattern: `main/apps/api/app/cli/corpus_seed.py` - CLI promotion precedent.

  **Acceptance Criteria**:
  - [ ] The folder layout decision is explicit.
  - [ ] Shared support code, if created, is narrow and reused by more than one caller.
  - [ ] Benchmark orchestration remains outside runtime request-serving paths.

  **QA Scenarios**:
  ```
  Scenario: Runtime modules stay thin
    Tool: Bash
    Steps: inspect modified module boundaries and run targeted tests
    Expected: Benchmark orchestration is not embedded in request-serving modules.
    Evidence: .omo/evidence/task-2-module-boundary.log

  Scenario: Shared helper exists only if justified
    Tool: Bash
    Steps: inspect call sites for any new helper module
    Expected: If a helper exists, it is imported by more than one caller and contains no top-level benchmark driver code.
    Evidence: .omo/evidence/task-2-shared-helper.log
  ```

  **Commit**: YES | Message: `refactor(eval): establish script-first evaluation layout` | Files: `main/apps/api/app/**`, `main/apps/api/tests/**`, `main/scripts/**`

- [x] 3. Add the Benchmark Entry Script Under `main/scripts/`

  **What to do**: Create `main/scripts/eval_embeddings.py` as the primary evaluation entrypoint. It should accept an explicit model/provider selection, run the evaluation against a small gold set, create isolated Qdrant collection names when model dimensions differ, and emit machine-readable plus human-readable results.
  **Must NOT do**: Do not hardcode a single model. Do not reuse production collections unsafely across incompatible vector dimensions.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: operational benchmark harness over runtime services.
  - Skills: [] - no special skill required.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Tasks 4-8 | Blocked By: Tasks 1-2

  **References**:
  - Pattern: `main/scripts/etl_live_smoke.py` - script structure and verification style.
  - Pattern: `main/apps/api/app/qdrant_index.py` - collection dimension safety.

  **Acceptance Criteria**:
  - [ ] The script can run at least two candidate models through the same benchmark path.
  - [ ] The script isolates collection/dimension collisions safely.
  - [ ] The script produces comparable metrics across models.

  **QA Scenarios**:
  ```
  Scenario: Two models can be compared in one run shape
    Tool: Bash
    Steps: run the benchmark script twice with two model selections against the same fixture set
    Expected: Both runs complete and produce comparable result files/console output.
    Evidence: .omo/evidence/task-3-model-comparison.log

  Scenario: Dimension mismatch is handled safely
    Tool: Bash
    Steps: run the benchmark script with models that emit different dimensions
    Expected: The script uses isolated collections or a documented safe strategy instead of corrupting a shared collection.
    Evidence: .omo/evidence/task-3-dimension-safety.log
  ```

  **Commit**: YES | Message: `feat(eval): add embedding benchmark script` | Files: `main/scripts/**`, `main/apps/api/app/**`, `main/apps/api/tests/**`

- [x] 4. Create a Tiny Gold Evaluation Fixture Set

  **What to do**: Add a small deterministic corpus and query/expected-hit fixture set under `main/apps/api/tests/fixtures/embedding_eval/`. Cover a few representative TTRPG-style retrieval tasks and include at least one hard negative.
  **Must NOT do**: Do not use large opaque datasets in the first slice. Do not rely on manual judgment instead of explicit expected hits.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: evaluation-fixture design grounded in repo domain behavior.
  - Skills: [] - no special skill required.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Tasks 5-8 | Blocked By: Tasks 1-3

  **References**:
  - Pattern: `main/apps/api/tests/fixtures/**` - fixture placement.
  - Pattern: `main/apps/api/tests/test_qdrant_indexing.py` - ingestion/index verification style.

  **Acceptance Criteria**:
  - [ ] The fixture corpus is small, deterministic, and checked in.
  - [ ] Queries have explicit expected hits.
  - [ ] At least one hard negative is present.

  **QA Scenarios**:
  ```
  Scenario: Gold set can drive deterministic evaluation
    Tool: Bash
    Steps: run the benchmark harness against the fixture set
    Expected: The same expected-hit checks work repeatably across runs.
    Evidence: .omo/evidence/task-4-gold-set.log

  Scenario: Hard negative prevents lexical-only false confidence
    Tool: Bash
    Steps: run evaluation on a hard-negative query case
    Expected: The report distinguishes relevant from lexically similar but incorrect chunks.
    Evidence: .omo/evidence/task-4-hard-negative.log
  ```

  **Commit**: YES | Message: `test(eval): add embedding evaluation gold fixtures` | Files: `main/apps/api/tests/**`

- [x] 5. Add Metrics, Report Output, and Makefile Wiring

  **What to do**: Add the first evaluation metrics and a stable invocation shape, likely a `make eval-embeddings` target. Capture retrieval hit-rate/recall-style metrics, latency, and model metadata in output that can be compared across runs.
  **Must NOT do**: Do not add CI gating yet unless the benchmark is stable and deterministic enough. Do not overbuild dashboards in the first slice.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: operational verification/report wiring.
  - Skills: [] - no special skill required.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: Tasks 6-8 | Blocked By: Tasks 1-4

  **References**:
  - Pattern: `main/README.md` - verification command surface.
  - Pattern: `main/Makefile` - task exposure.

  **Acceptance Criteria**:
  - [ ] A stable evaluation command exists.
  - [ ] Output includes model metadata plus retrieval metrics.
  - [ ] Output is comparable across runs.

  **QA Scenarios**:
  ```
  Scenario: Make target runs the evaluation harness
    Tool: Bash
    Steps: run the new Makefile target or documented command
    Expected: It invokes the benchmark harness successfully.
    Evidence: .omo/evidence/task-5-make-eval.log

  Scenario: Report output captures comparable metrics
    Tool: Bash
    Steps: inspect the generated output from at least two model runs
    Expected: Metrics and model identifiers are present in a stable shape.
    Evidence: .omo/evidence/task-5-report-shape.log
  ```

  **Commit**: YES | Message: `feat(eval): add metrics and make target` | Files: `main/Makefile`, `main/scripts/**`, `main/apps/api/app/**`, `main/apps/api/tests/**`

- [x] 6. Lock Regression Coverage for Shared Evaluation Logic

  **What to do**: Add pytest coverage for any shared helper/module logic used by the benchmark harness, especially metric calculations, provider/model metadata handling, and collection naming/dimension safety.
  **Must NOT do**: Do not try to unit-test every console-printing branch of the top-level script. Focus on reusable logic.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: regression coverage around reusable evaluation primitives.
  - Skills: [] - no special skill required.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: Tasks 7-8 | Blocked By: Tasks 1-5

  **References**:
  - Pattern: `main/apps/api/tests/test_embeddings.py` - provider behavior coverage.
  - Pattern: `main/apps/api/tests/test_qdrant_indexing.py` - index safety coverage.

  **Acceptance Criteria**:
  - [ ] Shared evaluation logic is under pytest coverage.
  - [ ] Collection naming/dimension safety is test-covered.
  - [ ] Metric calculation is test-covered.

  **QA Scenarios**:
  ```
  Scenario: Shared evaluation helpers pass regression tests
    Tool: Bash
    Steps: run the evaluation-focused pytest subset
    Expected: Tests pass and cover the shared evaluation logic.
    Evidence: .omo/evidence/task-6-eval-tests.log

  Scenario: Different model dimensions remain safe under test
    Tool: Bash
    Steps: run tests that simulate multiple provider/model dimension combinations
    Expected: Safe collection naming/selection logic prevents collisions.
    Evidence: .omo/evidence/task-6-dimension-tests.log
  ```

  **Commit**: YES | Message: `test(eval): cover shared evaluation logic` | Files: `main/apps/api/tests/**`, `main/apps/api/app/**`

- [x] 7. Document the Promotion Path to `app/cli/` or `app/evals/`

  **What to do**: Update the relevant wiki/plan notes so future agents know when to keep evaluation script-first versus when to promote it into `app/cli/` or a dedicated `app/evals/` package.
  **Must NOT do**: Do not create the bigger package just because the documentation mentions it.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: boundary/promotion-rule documentation.
  - Skills: [] - no special skill required.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: Task 8 | Blocked By: Tasks 1-6

  **References**:
  - Pattern: `main/docs/wiki/Layer Boundaries.md` - ownership split.
  - Pattern: `main/apps/api/app/cli/corpus_seed.py` - CLI precedent.

  **Acceptance Criteria**:
  - [ ] Promotion criteria are explicit.
  - [ ] Documentation makes script-vs-cli-vs-package ownership clear.
  - [ ] ETL/retrieval ownership lines remain intact.

  **QA Scenarios**:
  ```
  Scenario: Promotion rules are unambiguous
    Tool: Bash
    Steps: inspect the updated docs/plan text after edits
    Expected: A future executor can tell when to keep the harness in scripts and when to promote it.
    Evidence: .omo/evidence/task-7-promotion-rules.log

  Scenario: Evaluation ownership does not drift into ETL
    Tool: Bash
    Steps: inspect the updated docs/plan against Layer Boundaries
    Expected: ETL/retrieval/chat ownership remains unchanged.
    Evidence: .omo/evidence/task-7-boundary-check.log
  ```

  **Commit**: YES | Message: `docs(eval): record evaluation promotion path` | Files: `main/docs/wiki/**`, `.omo/plans/**`

- [x] 8. Run End-to-End Evaluation Verification

  **What to do**: Run the relevant pytest subset, then execute the evaluation harness against the fixture set with at least two models and capture evidence that the architecture works as planned: shared runtime provider seam, script-first orchestration, safe collection handling, and comparable output.
  **Must NOT do**: Do not claim success from unit tests alone. Do not skip the actual benchmark run.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: end-to-end verification across provider, script, fixtures, and metrics.
  - Skills: [] - no special skill required.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: final verification | Blocked By: Tasks 1-7

  **References**:
  - Pattern: `main/README.md` - verification guidance.
  - Pattern: `main/scripts/etl_live_smoke.py` - end-to-end harness style.

  **Acceptance Criteria**:
  - [ ] Evaluation-focused tests pass.
  - [ ] The benchmark harness runs successfully against the fixture set.
  - [ ] Two model outputs can be compared from saved evidence.

  **QA Scenarios**:
  ```
  Scenario: Evaluation regression tests pass
    Tool: Bash
    Steps: run the evaluation-focused pytest subset
    Expected: Tests pass cleanly.
    Evidence: .omo/evidence/task-8-eval-pytest.log

  Scenario: Real benchmark comparison succeeds
    Tool: Bash
    Steps: run the evaluation harness with two candidate models against the gold fixtures
    Expected: Both runs complete, stay collection-safe, and produce comparable metrics.
    Evidence: .omo/evidence/task-8-benchmark-compare.log
  ```

  **Commit**: YES | Message: `chore(eval): verify embedding evaluation harness` | Files: `.omo/evidence/**`

## Final Verification Wave
- Run `pytest` over the embedding/evaluation-focused subset.
- Run the benchmark harness against the checked-in fixture corpus.
- Review file placement and ensure no benchmark orchestration leaked into request-serving modules.
- Confirm docs/plan text still matches the runtime layer boundaries.

## Commit Strategy
- Commit runtime provider seam separately from benchmark script work if possible.
- Keep fixture additions and report/Makefile wiring isolated enough that regressions are easy to inspect.
- Do not mix future fine-tuning work into the first harness branch.

## Success Criteria
- The repo has a concrete, script-first embedding evaluation path.
- Hugging Face models can be compared through the existing runtime stack.
- Runtime boundaries remain clean.
- The promotion path to `app/cli/` or `app/evals/` is explicit instead of speculative.
- The plan leaves a clean foundation for future fine-tuning without forcing that complexity into phase 1.
