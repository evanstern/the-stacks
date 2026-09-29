import type { ZodError } from "zod";
import { z } from "zod";
import { ValidationError } from "../../errors.js";
import { walkPages } from "./walk.js";

/** specs/012-ddb-parser/data-model.md#ParseInput */
export const ParseInputSchema = z.object({
  book: z.string().trim().min(1),
  pages: z.array(z.string()).min(1),
});
export type ParseInput = z.infer<typeof ParseInputSchema>;

/** specs/012-ddb-parser/data-model.md#Anchor */
export const AnchorSchema = z.object({
  book: z.string(),
  path: z.array(z.string()),
  start: z.number().int().min(0),
  end: z.number().int(),
});
export type Anchor = z.infer<typeof AnchorSchema>;

/** specs/012-ddb-parser/data-model.md#Block */
export const BlockSchema = z.object({
  kind: z.enum(["heading", "prose", "list", "table", "statBlock", "sidebar"]),
  path: z.array(z.string()).min(1),
  text: z.string().min(1),
  anchor: AnchorSchema,
  table: z
    .object({
      caption: z.string().optional(),
      header: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    })
    .optional(),
  statBlock: z
    .object({
      name: z.string(),
      fields: z.array(z.object({ label: z.string(), value: z.string() })),
    })
    .optional(),
});
export type Block = z.infer<typeof BlockSchema>;

/** specs/012-ddb-parser/data-model.md#ParsedBook */
export const ParsedBookSchema = z.object({
  book: z.string(),
  text: z.string(),
  blocks: z.array(BlockSchema).min(1),
});
export type ParsedBook = z.infer<typeof ParsedBookSchema>;

function toIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

/**
 * Turns saved D&D Beyond export pages into a `ParsedBook`. Pure function: no
 * database, network, or file-system access (FR-009, contracts/parser.md #6).
 * Never returns partial output: any failure throws `ValidationError` before
 * a `ParsedBook` is built (data-model.md #Errors).
 *
 * `options.headings: "all"` (specs/017-ingestion-pipeline research R4) makes
 * every `h1`-`h6` a section heading, for generic (non-DDB) HTML. Default
 * `"ddb"` keeps today's DDB-specific behaviour byte-for-byte.
 */
export function parseDdbExport(
  input: ParseInput,
  options?: { headings?: "ddb" | "all" },
): ParsedBook {
  const parsedInput = ParseInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new ValidationError(toIssues(parsedInput.error));
  }
  const { book, pages } = parsedInput.data;

  const { text, blocks } = walkPages(book, pages, options);
  if (blocks.length === 0) {
    throw new ValidationError([
      {
        path: "pages",
        message:
          "No book content found: no D&D Beyond content root or body text in the given pages.",
      },
    ]);
  }

  const parsedOutput = ParsedBookSchema.safeParse({ book, text, blocks });
  if (!parsedOutput.success) {
    throw new ValidationError(toIssues(parsedOutput.error));
  }
  return parsedOutput.data;
}
