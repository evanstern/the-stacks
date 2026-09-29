import { ValidationError } from "../../errors.js";
import type { Block, ParsedBook } from "../ddb/index.js";
import { ParsedBookSchema } from "../ddb/index.js";

/**
 * A line-based Markdown block splitter (specs/017-ingestion-pipeline
 * research R4, contracts/ingest-modules.md). Produces the same `ParsedBook`
 * shape and invariants as `parseDdbExport` (UTF-16 anchors, `\n\n`-joined
 * text), so the store/chunk path is shared with HTML books.
 *
 * ponytail: setext headings (`Title\n=====`), HTML embedded in Markdown,
 * and nested lists are flattened to their outer form. Add real handling
 * when a real Markdown book needs it (research R4 "Alternatives rejected").
 */

const HEADING_LINE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_LINE = /^\s*(`{3,}|~{3,})/;
const LIST_ITEM_LINE = /^\s*([-*+]|\d+\.)\s+/;

interface WalkState {
  text: string;
  blocks: Block[];
}

function appendBlock(
  state: WalkState,
  kind: Block["kind"],
  path: string[],
  book: string,
  lines: string[],
): void {
  const text = lines.join("\n").trim();
  if (!text) return;
  if (state.text.length > 0) state.text += "\n\n";
  const start = state.text.length;
  state.text += text;
  const end = state.text.length;
  state.blocks.push({ kind, path, text, anchor: { book, path, start, end } });
}

function isSpecialStart(line: string): boolean {
  return (
    line.trim() === "" ||
    HEADING_LINE.test(line) ||
    FENCE_LINE.test(line) ||
    line.includes("|") ||
    LIST_ITEM_LINE.test(line)
  );
}

/**
 * Splits `text` into headings, fenced code blocks (one `prose` block each),
 * tables (consecutive `|` lines), lists (consecutive list-item lines), and
 * blank-line-separated paragraphs (`prose`).
 */
function walkMarkdown(book: string, text: string): WalkState {
  const lines = text.split(/\r\n|\r|\n/);
  const state: WalkState = { text: "", blocks: [] };
  const stack: { level: number; title: string }[] = [];
  const currentPath = () => [book, ...stack.map((s) => s.title)];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = HEADING_LINE.exec(line);
    if (heading) {
      const rank = heading[1].length;
      const title = heading[2].trim();
      while (
        stack.length > 0 &&
        (stack.at(-1) as { level: number }).level >= rank
      ) {
        stack.pop();
      }
      stack.push({ level: rank, title });
      appendBlock(state, "heading", currentPath(), book, [title]);
      i++;
      continue;
    }

    const fence = FENCE_LINE.exec(line);
    if (fence) {
      const marker = fence[1];
      const fenceChar = marker[0];
      const start = i;
      i++;
      while (
        i < lines.length &&
        !(
          lines[i].trim().startsWith(fenceChar.repeat(marker.length)) &&
          lines[i].trim()[0] === fenceChar
        )
      ) {
        i++;
      }
      const end = Math.min(i, lines.length - 1);
      appendBlock(
        state,
        "prose",
        currentPath(),
        book,
        lines.slice(start, end + 1),
      );
      i = end + 1;
      continue;
    }

    if (line.includes("|")) {
      const start = i;
      while (i < lines.length && lines[i].includes("|")) i++;
      appendBlock(state, "table", currentPath(), book, lines.slice(start, i));
      continue;
    }

    if (LIST_ITEM_LINE.test(line)) {
      const start = i;
      while (i < lines.length && LIST_ITEM_LINE.test(lines[i])) i++;
      appendBlock(state, "list", currentPath(), book, lines.slice(start, i));
      continue;
    }

    const start = i;
    while (i < lines.length && !isSpecialStart(lines[i])) i++;
    appendBlock(state, "prose", currentPath(), book, lines.slice(start, i));
  }

  return state;
}

/**
 * Turns a Markdown book's text into a `ParsedBook` (specs/017-ingestion-pipeline
 * contracts/ingest-modules.md). Pure function: no database, network, or
 * file-system access.
 */
export function parseMarkdown(input: {
  book: string;
  text: string;
}): ParsedBook {
  const { book, text } = input;
  const { text: normalizedText, blocks } = walkMarkdown(book, text);

  if (blocks.length === 0) {
    throw new ValidationError([
      { path: "text", message: "No content found in the given Markdown text." },
    ]);
  }

  const parsedOutput = ParsedBookSchema.safeParse({
    book,
    text: normalizedText,
    blocks,
  });
  if (!parsedOutput.success) {
    throw new ValidationError(
      parsedOutput.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    );
  }
  return parsedOutput.data;
}
