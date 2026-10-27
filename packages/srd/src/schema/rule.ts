import { z } from "zod";
import { SourceRef } from "./common.js";

/** Heading-path id: slugs joined by "." (slugs never contain "."). */
export const RuleId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$/);

export const RuleBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1) }).strict(),
  z
    .object({
      type: z.literal("list"),
      items: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("table"),
      title: z.string().min(1).nullable(),
      columns: z.array(z.string().min(1)).min(1),
      rows: z.array(z.array(z.string())).min(1),
    })
    .strict()
    .superRefine((table, ctx) => {
      for (const [i, row] of table.rows.entries()) {
        if (row.length !== table.columns.length) {
          ctx.addIssue({
            code: "custom",
            path: ["rows", i],
            message: `row has ${row.length} cells, expected ${table.columns.length}`,
          });
        }
      }
    }),
]);

export const Rule = z
  .object({
    id: RuleId,
    name: z.string().min(1),
    title: z.string().min(1),
    path: z.array(z.string().min(1)).min(1),
    parent: RuleId.nullable(),
    children: z.array(RuleId),
    source: SourceRef,
    pageEnd: z.number().int().min(1).max(364),
    blocks: z.array(RuleBlock),
  })
  .strict()
  .superRefine((rule, ctx) => {
    if (rule.pageEnd < rule.source.page) {
      ctx.addIssue({
        code: "custom",
        path: ["pageEnd"],
        message: "pageEnd is before source.page",
      });
    }
    if (rule.parent !== null && !rule.id.startsWith(`${rule.parent}.`)) {
      ctx.addIssue({
        code: "custom",
        path: ["parent"],
        message: "id does not start with parent + '.'",
      });
    }
  });
