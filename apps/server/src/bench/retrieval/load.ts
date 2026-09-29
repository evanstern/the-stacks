import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ValidationError } from "../../errors.js";
import type { ParsedBook } from "../../library/ddb/index.js";
import { parseMarkdown } from "../../library/ingest/markdown.js";

/**
 * Pure loaders for the retrieval bench (specs/019-retrieval-bench
 * data-model.md, contracts/bench-cli.md). No database, no network.
 */

export const MatrixSchema = z.object({
  name: z.string(),
  models: z
    .array(
      z.object({
        name: z.string(),
        source: z.union([
          z.object({ builtin: z.literal("bow") }),
          z.object({ purpose: z.string() }),
        ]),
        dims: z.array(z.number().int().min(32).max(1024)).min(1),
      }),
    )
    .min(1),
  chunking: z
    .array(z.object({ name: z.string(), maxChars: z.number().int().min(0) }))
    .min(1),
  modes: z.array(z.enum(["vector", "fts", "hybrid"])).min(1),
  k: z.literal(10).default(10),
});
export type Matrix = z.infer<typeof MatrixSchema>;

export const QuestionSchema = z.object({
  id: z.string().regex(/^q\d{3}$/),
  question: z.string().min(5),
  style: z.enum(["lexical", "paraphrase"]),
  expected: z
    .array(
      z.object({
        doc: z.string(),
        quote: z.string().min(20).max(400),
      }),
    )
    .min(1),
});
export type Question = z.infer<typeof QuestionSchema>;
export const QuestionSetSchema = z.array(QuestionSchema).min(50);

export interface ResolvedQuestion {
  id: string;
  question: string;
  style: "lexical" | "paraphrase";
  targets: { doc: string; start: number; end: number }[];
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Deterministic JSON with object keys sorted, so equal configs hash equal. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const entries = Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function issuesFrom(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

export function matrixHash(matrix: Matrix): string {
  return sha256(canonicalJson(matrix));
}

/** Loads and validates a matrix config (contracts/bench-cli.md run step 1). */
export function loadMatrix(filePath: string): Matrix {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const parsed = MatrixSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(issuesFrom(parsed.error));
  return parsed.data;
}

/** Loads every corpus document except ATTRIBUTION.md, book name = file stem. */
export function loadCorpus(dir: string): { books: ParsedBook[]; hash: string } {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "ATTRIBUTION.md")
    .sort();
  const hasher = createHash("sha256");
  const books = files.map((file) => {
    const text = readFileSync(path.join(dir, file), "utf8");
    hasher.update(`${file}\n${text}`);
    return parseMarkdown({ book: file.slice(0, -3), text });
  });
  return { books, hash: hasher.digest("hex") };
}

/**
 * Resolves every question's quotes against the parsed corpus (research R3):
 * a quote must appear exactly once in its target document's text.
 */
export function loadQuestions(
  filePath: string,
  books: ParsedBook[],
): { questions: ResolvedQuestion[]; hash: string } {
  const raw = readFileSync(filePath, "utf8");
  const parsed = QuestionSetSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new ValidationError(issuesFrom(parsed.error));
  const data = parsed.data;

  const seenIds = new Set<string>();
  for (const q of data) {
    if (seenIds.has(q.id)) {
      throw new ValidationError([
        { path: q.id, message: `duplicate question id "${q.id}"` },
      ]);
    }
    seenIds.add(q.id);
  }

  const paraphraseCount = data.filter((q) => q.style === "paraphrase").length;
  if (paraphraseCount * 2 < data.length) {
    throw new ValidationError([
      {
        path: "(root)",
        message: `at least half of ${data.length} questions must be style "paraphrase" (found ${paraphraseCount})`,
      },
    ]);
  }

  const bookByName = new Map(books.map((b) => [b.book, b]));

  const questions = data.map((q) => ({
    id: q.id,
    question: q.question,
    style: q.style,
    targets: q.expected.map((exp) => {
      const book = bookByName.get(exp.doc);
      if (!book) {
        throw new ValidationError([
          {
            path: q.id,
            message: `question "${q.id}" names unknown corpus document "${exp.doc}"`,
          },
        ]);
      }
      const start = book.text.indexOf(exp.quote);
      if (start === -1) {
        throw new ValidationError([
          {
            path: q.id,
            message: `question "${q.id}"'s quote was not found in "${exp.doc}"`,
          },
        ]);
      }
      const nextMatch = book.text.indexOf(exp.quote, start + 1);
      if (nextMatch !== -1) {
        throw new ValidationError([
          {
            path: q.id,
            message: `question "${q.id}"'s quote occurs more than once in "${exp.doc}"`,
          },
        ]);
      }
      return { doc: exp.doc, start, end: start + exp.quote.length };
    }),
  }));

  return { questions, hash: sha256(raw) };
}
