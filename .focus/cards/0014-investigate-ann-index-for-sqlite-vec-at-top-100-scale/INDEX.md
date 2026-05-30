---
schema_version: 2
id: 14
uuid: 019df60d-7b73-7547-a4be-0a4a2eb630e8
title: Investigate ANN index for sqlite-vec at top-100+ scale
type: card
status: archived
priority: p3
project: the-stacks
created: 2026-05-05
---

# Investigate ANN index for sqlite-vec at top-100+ scale

sqlite-vec does brute-force cosine similarity by default. At our
M1 demo scale (top-10, ~90K chunks under Strategy B), this is
trivially fast — sub-second queries. At top-100 (~880K chunks)
it's still acceptable. Beyond that, brute force becomes a
problem.

Estimated query latency at brute force, single-threaded CPU:
- top-10 (Strategy B, ~90K chunks): <1 sec
- top-100 (Strategy B, ~880K chunks): ~1-3 sec
- top-1000 hypothetical: 10-30 sec
- per-trade strategy (~93M chunks): 1-5 min, useless

If we ever want to push past ~1M chunks for a serious dogfood
(Annie's full memory corpus over a long time horizon, or a real
property-management ledger), we'd need an ANN index — HNSW,
IVF, etc.

**Blocked by / triggered by:** any milestone that pushes us past
~1M chunks. M1 demo doesn't hit this. M3 dogfood probably doesn't
either, at least not initially.

## Steps (when this card unblocks)

1. Check what sqlite-vec offers natively (the project ships an
   HNSW-like index in some versions; verify current state)
2. If native is insufficient, evaluate alternatives:
   - sqlite-vss (HNSW via Faiss bindings)
   - DuckDB with VSS extension
   - chromadb (drops the single-binary ethos)
3. Benchmark against a synthetic 1M-vector corpus
4. Document trade-offs in
   `designs/the-stacks-retrieval-scaling.md`

## Done when

- A clear recommendation lives in the design doc for "when scale
  exceeds X chunks, switch retrieval to Y"
- Single-binary ethos preserved if at all possible

## Notes

Filed 2026-05-05 from corpus sizing exercise. Deliberately p3 —
not on the M1/M2/M3 critical path. File-and-forget until volume
forces it.
