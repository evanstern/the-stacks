# Contract: `parseDdbExport`

Module: `apps/server/src/library/ddb/index.ts`

```ts
parseDdbExport(input: ParseInput): ParsedBook   // throws ValidationError (apps/server/src/errors.ts)
```

Guarantees (each is a test):

1. **Round-trip**: for every block, `book.text.slice(b.anchor.start, b.anchor.end) === b.text`.
2. **Order**: blocks are in document order; spans strictly increase and never overlap.
3. **Wholeness**: each `<table>` → exactly one `table` block; each stat block → exactly one
   `statBlock` block.
4. **No chrome**: no block contains text from `nav`, `header`, `footer`, `script`, `style`,
   or any selector in the chrome table.
5. **Determinism**: equal input → deep-equal output.
6. **Purity**: no I/O. No imports from `db`, `fs`, `net`, codex, or session.
7. **Offsets** are UTF-16 code units (JS string indices).
