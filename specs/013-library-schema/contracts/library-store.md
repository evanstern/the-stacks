# Contract: library store

Module: `apps/server/src/library/store.ts`. The only write path into the library plane.

```ts
storeParsedBook(
  db: Db,
  book: ParsedBook,                                   // from library/ddb (ParsedBookSchema)
  meta?: { source?: { files?: string[]; bytes?: number } },
): Promise<{ documentId: string; chunkCount: number; replaced: boolean }>;

attachEmbeddings(
  db: Db,
  rows: { chunkId: string; model: string; dim: number; vector: number[] }[],
): Promise<{ inserted: number }>;
```

## Invariants (each has a test)

1. `storeParsedBook` validates input with `ParsedBookSchema` and, for every block,
   `0 <= start < end <= text.length` and `text.slice(start, end) === block.text`. Any failure
   throws `ValidationError` and writes nothing.
2. One transaction per call. A book whose `lower(trim(book))` matches an existing document
   replaces it: the old document and all its chunks and embeddings are gone after commit;
   `replaced: true`. No reader observes a mix.
3. Chunks are stored in block order with `ordinal` 0..N-1; reading them back ordered by
   `ordinal` reproduces the input blocks' kind, path, text, and anchor.
4. `content_hash` is the sha-256 hex of `book.text`.
5. `attachEmbeddings` rejects (`ValidationError`, nothing written) any row with
   `dim !== 1024` or `vector.length !== 1024`. The whole call is one transaction.
6. A second embedding for the same `(chunkId, model)` is rejected (unique violation surfaces
   as `ConflictError`), and nothing from that call is written.
7. Any UPDATE on `library_documents`, `library_chunks`, or `library_embeddings` raises,
   including from raw SQL.
8. Deleting a document removes its chunks and their embeddings.
9. `tsv` is populated on insert with no extra call; a `@@ plainto_tsquery('english', term)`
   search finds a chunk containing `term`.

Errors use the existing typed errors in `apps/server/src/errors.ts`.
