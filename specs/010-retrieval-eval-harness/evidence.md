# Evidence: Retrieval & Evaluation Harness (010)

**Converge verdict**: converged (2026-07-11) — zero unbuilt tasks appended; two
success criteria PARTIAL by explicit operator decision (below). Full DB-backed
`pnpm verify`: exit 0, 301 TS tests; sidecar suite 18 pytest + pyright clean.
Live walkthrough executed against this worktree's stack (ports 4500-block,
rebuilt images, real MiniLM embeddings) on 2026-07-11.

## Success criteria

| SC | Verdict | Evidence |
|---|---|---|
| SC-001 verbatim + paraphrase top-5 | ✅ PASS | Fixture: engine suite (verbatim #1, paraphrase top-5 by construction). LIVE with real embeddings: "riposte" → rank 1 (FTS); "striking back after a missed attack" → hit via vector 0.316 with zero shared keywords |
| SC-002 100% runs recorded; receipts outlive re-ingest | ✅ PASS | Every search (incl. gibberish → 0 results) left a `retrieval_runs` row (live runs `080e49f5…`, `8571faef…`); superseded derivation proven in `retrieval-runs.contract.test.ts` against a simulated generation sweep — identical text auto-heals, rewritten text marks |
| SC-003 query → results < 2 s | ✅ PASS | Live wall time 0.09 s (stage timings on the receipt: embed 38 ms, fts 3 ms, vector 4 ms) |
| SC-004 deterministic per-PR slice, floor bites | ✅ PASS | `ci-floor.test.ts` in `pnpm verify` (tuning r@5 1.000 / MRR 0.944 / nDCG 0.916, floors pinned below); bite PROVEN: inverted fusion → held-out MRR 0.667 → red; restored → green |
| SC-005 default traceable to an eval report, ≥30-item gold set, held-out alongside | 🟡 PARTIAL | `docs/eval-reports/010-retrieval-baseline.md`: 3 configs compared (RRF ties weighted-α0.5; α0.7 degrades MRR −0.111 → RRF ships, no calibration knob), held-out reported per slice — over the 12-item FIXTURE set. The ≥30-item operator gold set was **deliberately deferred at the US5 gate** (operator: "fixture-based report") → board TASK-10 |
| SC-006 rerank delta measured; default cites it | 🟡 PARTIAL | Rerank ships OFF citing absence of measurement (the D11-honest default); the on/off comparison awaits a configured `RERANKER_MODEL_ID` → TASK-10. Machinery fully proven: 8 sidecar pytest + 4 client + 4 engine-stage tests incl. no-silent-fallback |

## FR spot-verification

- FR-002 reader predicate: engine test excludes a written-aside generation live.
- FR-008/009 append-only receipts + snapshots: sole-writer module exports exactly
  `recordRetrievalRun`; torn-receipt transaction test; snapshots render post-sweep.
- FR-013 split immutability: PUT refusal test with FR-013's rationale in the message.
- FR-017 deterministic slice: zero model calls, zero network beyond Postgres (fixture
  provider stamp makes cross-contamination structurally impossible).
- FR-021 no silent fallback: failing scorer ⇒ `dependency_down` at the `rerank` seam,
  NO receipt recorded; rerank-on with disabled role refuses at config resolution.
- FR-024 lawful fixtures: the "Emberfall" corpus is invented whole-cloth.

## Visibility avenues (Principle V, verified live)

| Capability | Avenue | Verified |
|---|---|---|
| Search | `/search` in primary nav | live + web test |
| Run receipts | `/records/retrievals[/:id]`, Records nav | live (superseded false on live run) + tests |
| Gold authoring | `/evals/gold` in nav, labeling standard on-page, search affordance | live create + tests |
| Eval runs & compare | `/evals` in nav, `?compare=a,b` URL-addressable | live worker-executed run + tests |
| CI floor | `pnpm verify` output (`[ci-floor]` probe line per run) | CI + local |
| Reranker state | sidecar `/ready` additive field; run records carry model identity | live (`reranker: disabled`) + pytest |

## The harness earning its keep (live finding)

The live walkthrough's one-item eval run scored recall 0 — honestly: "how does a
riposte work" missed where the bare keyword "riposte" hit (FTS AND semantics
dropped "work"; question-vs-page cosine fell under the 0.3 floor). Recorded in
the eval report's known characteristics; **TASK-10's first question** is floor
tuning with real-corpus data. Changing the default without that measurement
would invert D11 — the harness exists precisely to catch this.

## Wiki impact decision

`docs/wiki/retrieval.md` authored (engine doctrine, receipts, gold/harness,
reranker, config; 14 pinned sources) and indexed; `walking-skeleton.md`
re-verified against the 010 diffs (sidecar section gained `/v1/rerank`) and
re-pinned. Freshness gate green: 4 notes.

## Deviations & implementation-discovered parameters

- `RETRIEVAL_MIN_SIMILARITY` (0.3): discovered by the first honest empty-result
  test (nearest-neighbor always answers); subsumed under FR-004's "parameters",
  documented in contracts/api.md §5, data-model, `.env.example`.
- `invalid_input` promoted from API-only to core `ErrorClass`: the stamp
  mismatch is the first domain-level input refusal; 009's rationale revised
  with history kept in `errors.ts` / `apps/api/src/errors.ts` comments.
- contracts/reranker.md: draft-era bespoke codes replaced by the shared
  taxonomy before implementation (amendment note in the contract).
- Live-walkthrough auth: the worktree's `.env` operator hash was locally reset
  to a known password (uncommitted; dies with the worktree).

## Eval-justification chain (FR-019 / D11)

Shipped defaults (`RETRIEVAL_FUSION=rrf`, `RETRIEVAL_RERANK=off`) ←
`docs/eval-reports/010-retrieval-baseline.md` ← eval run receipts
`6e05e95f…`, `b1cf8bae…`, `b0079b04…` ← per-question `origin:"eval"`
retrieval runs. Re-proven on every PR by the CI floor.

## Post-converge addendum (2026-07-12, TASK-10)

The SC-005 deferral resolved on-branch before merge: TASK-10 built a 41-item
gold set (31 tuning / 10 heldout) over the operator's REAL corpus (a saved DDB
"Monsters (G)" page, 36 chunks via ddb-saved-html, + the Emberfall homebrew
page) and re-ran the program — RRF re-confirmed (ties weighted-α0.5 on real
embeddings); `RETRIEVAL_MIN_SIMILARITY` default tuned 0.3 → 0.2 on the measured
knee (the "harness earning its keep" finding below, closed with receipts:
eval runs `7be1e7a6…`, `a2354392…`, `53cf40a3…`). The eval report was
superseded in place. Real data also exposed and fixed two engine bugs
(ddb-saved-html detect vs >64 KiB-preamble saved pages; the worker never
calling `complete()`). SC-006 (rerank on/off) remains open → board TASK-11.

## Feature course

Feature course: docs/courses/010-retrieval-eval-harness/ (Principle VIII —
authored at cycle close via /spec-cycle-course; skilled-developer register,
seeded from this spec's artifacts). The link becomes live when the course
lands; check-spec-artifacts + the course gate enforce it in CI.
