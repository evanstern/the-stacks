# Data model: D&D Beyond export parser (spec 012)

In-memory types only. No database tables (TASK-0022 owns storage). Zod schemas are the
source; TypeScript types are inferred (constitution Architecture Constraints: Zod).

## ParseInput

| Field | Type | Rule |
|---|---|---|
| `book` | string | non-empty, trimmed |
| `pages` | string[] | ≥1 HTML page, in reading order |

## ParsedBook

| Field | Type | Rule |
|---|---|---|
| `book` | string | from input |
| `text` | string | the normalized text; every block's span indexes into it |
| `blocks` | Block[] | document order; ≥1 |

## Block

| Field | Type | Rule |
|---|---|---|
| `kind` | `"heading" \| "prose" \| "list" \| "table" \| "statBlock" \| "sidebar"` | |
| `path` | string[] | heading path, book title first; never empty |
| `text` | string | non-empty; equals `ParsedBook.text.slice(anchor.start, anchor.end)` |
| `anchor` | Anchor | |
| `table` | `{ caption?: string; header: string[]; rows: string[][] }` | only when `kind = "table"` |
| `statBlock` | `{ name: string; fields: { label: string; value: string }[] }` | only when `kind = "statBlock"`; values are text, never typed mechanics (CR-004) |

## Anchor

| Field | Type | Rule |
|---|---|---|
| `book` | string | |
| `path` | string[] | same as the block's path |
| `start` | integer | ≥0; UTF-16 offset into `ParsedBook.text` |
| `end` | integer | > start |

Downstream (TASK-0022/0024) stores `book`, `path`, `start`, `end` per chunk; a chunk's span is
a sub-range of its block's span.

## Errors

The parser throws the project's existing `ValidationError` (`apps/server/src/errors.ts`) with
a message naming the problem: empty input, no content root found in any page, or zero blocks produced.
The parser never returns partial output.
