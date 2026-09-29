import { z } from "zod";
import { ValidationError } from "../../errors.js";

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

/**
 * Turns saved D&D Beyond export pages into a `ParsedBook`. Pure function: no
 * database, network, or file-system access (FR-009, contracts/parser.md #6).
 *
 * Stub — implemented in Phase 3 (specs/012-ddb-parser/tasks.md T011-T012).
 */
export function parseDdbExport(_input: ParseInput): ParsedBook {
  throw new ValidationError([{ path: "(root)", message: "not implemented" }]);
}
