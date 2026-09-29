# Data model: Rules answerer

No new table, column, or migration. The answerer reads through `retrieve()` (spec 015) and
writes nothing. The entities below are in-memory, per request.

## Question

| Field | Rule |
|---|---|
| `question` | string; trimmed length 1..2000 (`QUESTION_MAX`) |

## Relevant passage

A `RetrievedPassage` (contracts/retrieval.md in spec 015) that passes `isRelevant`:
`fts !== null || (vector !== null && vector.score >= minSimilarity)`. It gets a prompt number
`p` = its 1-based position among the relevant passages.

## Citation

Built from one verified marker. Every field comes from stored data or arithmetic on it.

| Field | Source |
|---|---|
| `n` | 1-based, first-appearance order of distinct `(chunkId, span.start, span.end)` |
| `chunkId`, `documentId`, `book`, `section`, `passage.kind`, `passage.text` | the passage (`anchor.path` → `section`) |
| `passage.span` | `{anchor.start, anchor.end}` |
| `quoteInPassage` | `locateQuote(passage.text, markerQuote)` |
| `quote` | `passage.text.slice(quoteInPassage.start, quoteInPassage.end)` |
| `span` | `anchor.start + quoteInPassage.start` … `anchor.start + quoteInPassage.end` |

## Answer events

`delta`, `citation`, `done`, `refusal`, `error`: shapes in `contracts/ask-sse.md`.

## State transitions (one request)

```
validate ──invalid──▶ 400 (no stream)
   │
retrieve ──throws──▶ error{retrieval}
   │
filter relevant ──none──▶ refusal{nothing_relevant}      (no model call)
   │
chat stream ─┬─ text ─▶ parser ─▶ delta | citation(verified) | dropped++
             ├─ <refuse/> or error{refusal} ─▶ refusal{model_declined}
             ├─ error{kind} ─▶ error{kind}
             ├─ aborted ─▶ (nothing)
             └─ done ─┬─ citations = 0 ─▶ refusal{unverified}
                      └─ citations > 0 ─▶ done
```

## Configuration

| Variable | Values | Default | Read by |
|---|---|---|---|
| `ASK_MIN_SIMILARITY` | number 0..1 | `0.3` | `loadAnswerConfig`, at boot in `index.ts` |

The answering model is the `AI_PURPOSES` entry named `answering` (op `chat`). Retrieval mode,
k, and embed purpose come from the existing `RETRIEVAL_*` variables.
