# Data model: Hybrid retrieval

No new tables and no migration (research R8). Retrieval reads spec 013's tables and returns
in-memory values. The TypeScript shapes are pinned in [contracts/retrieval.md](contracts/retrieval.md).

## Read sources

| Returned field | Column |
|---|---|
| `chunkId` | `library_chunks.id` |
| `documentId` | `library_chunks.document_id` |
| `kind` | `library_chunks.kind` |
| `text` | `library_chunks.text` |
| `anchor.book` | `library_documents.book` |
| `anchor.path` | `library_chunks.path` |
| `anchor.start` / `anchor.end` | `library_chunks.start_offset` / `end_offset` |
| `fts.score` | `ts_rank_cd(library_chunks.tsv, query)` |
| `vector.score` | `1 - (library_embeddings.embedding <=> $vec)`, rows `WHERE model = $model` |

## Validation rules

- `question`: string, trimmed length ≥ 1 (else `ValidationError`).
- `mode`: `vector` | `fts` | `hybrid`.
- `k`: integer 1..50.
- `RETRIEVAL_EMBED_PURPOSE`: non-empty string. Existence in `AI_PURPOSES` is checked at call
  time by the gateway, not at boot (research R5).

## Ordering

- Each search: best first (`ts_rank_cd` desc / distance asc), ties by chunk id ascending,
  capped at `CANDIDATES = 50`.
- Hybrid: `fuseRrf` score desc, ties by chunk id ascending; then truncated to `k`.
- `rank` on a passage is 1-based within `passages`; `vector.rank` / `fts.rank` are 1-based
  within that search's own candidate list.
