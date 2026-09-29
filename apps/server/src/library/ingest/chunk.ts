import type { Block, ParsedBook } from "../ddb/index.js";

/**
 * Structure-preserving chunker (specs/017-ingestion-pipeline research R5,
 * contracts/ingest-modules.md). Merges consecutive same-section blocks into
 * one chunk while staying under a character budget; a `table`/`statBlock`
 * block, or a block that would push a merge over budget, is never merged.
 * Pure: no side effects, and `book.text` is returned unchanged.
 *
 * ponytail: character budget, not tokens — TASK-0029 may revisit with a
 * tokenizer estimate if the fixed ratio proves too coarse.
 */

export const CHUNK_MAX_CHARS = 2000;

function isAtomic(block: Block): boolean {
  return block.kind === "table" || block.kind === "statBlock";
}

function samePath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((segment, i) => segment === b[i]);
}

function mergeGroup(book: ParsedBook, group: Block[]): Block {
  if (group.length === 1) return group[0];
  const first = group[0];
  const last = group[group.length - 1];
  const anchor = { ...first.anchor, end: last.anchor.end };
  return {
    kind: "prose",
    path: first.path,
    text: book.text.slice(anchor.start, anchor.end),
    anchor,
  };
}

export function chunkBook(
  book: ParsedBook,
  opts?: { maxChars?: number },
): ParsedBook {
  const maxChars = opts?.maxChars ?? CHUNK_MAX_CHARS;
  const chunks: Block[] = [];
  let group: Block[] = [];

  const flush = () => {
    if (group.length === 0) return;
    chunks.push(mergeGroup(book, group));
    group = [];
  };

  for (const block of book.blocks) {
    if (isAtomic(block)) {
      flush();
      chunks.push(block);
      continue;
    }
    const first = group[0];
    const fitsWithPrevious =
      first !== undefined &&
      samePath(first.path, block.path) &&
      block.anchor.end - first.anchor.start <= maxChars;
    if (!fitsWithPrevious) flush();
    group.push(block);
  }
  flush();

  return { ...book, blocks: chunks };
}
