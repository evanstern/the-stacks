import { z } from "zod";
import { IntentBodySchema } from "./nodes/schemas.js";

/** One top-level `params` key removed from a confirm item (spec 116 FR-008, FR-010). */
export interface ParamsStrip {
  kind: "params-stripped";
  item: number;
  bodyKind: string;
  key: string;
}

/** Allowed `params` keys per body kind; null when that params schema is not strict (never stripped). */
const KNOWN = new Map<string, Set<string> | null>(
  IntentBodySchema.options.map((m) => {
    const params = m.shape.params as unknown;
    const strict =
      params instanceof z.ZodObject &&
      params.def.catchall instanceof z.ZodNever;
    return [
      m.shape.kind.value as string,
      strict ? new Set(Object.keys((params as z.ZodObject).shape)) : null,
    ];
  }),
);

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * Drops top-level `params` keys the confirm item's kind schema does not list (spec 116 D2).
 * Keys only: values are never read, known keys and nested values are kept, input is not mutated.
 */
export function stripParams(json: unknown): {
  json: unknown;
  strips: ParamsStrip[];
} {
  if (!isObj(json) || !Array.isArray(json.confirm)) return { json, strips: [] };
  const strips: ParamsStrip[] = [];
  const confirm = json.confirm.map((item: unknown, i: number) => {
    if (!isObj(item) || !isObj(item.body)) return item;
    const { body } = item;
    const allowed =
      typeof body.kind === "string" ? KNOWN.get(body.kind) : undefined;
    if (!allowed || !isObj(body.params)) return item;
    const extra = Object.keys(body.params).filter((k) => !allowed.has(k));
    if (extra.length === 0) return item;
    for (const key of extra)
      strips.push({
        kind: "params-stripped",
        item: i,
        bodyKind: body.kind as string,
        key,
      });
    const params = Object.fromEntries(
      Object.entries(body.params).filter(([k]) => allowed.has(k)),
    );
    return { ...item, body: { ...body, params } };
  });
  return strips.length === 0
    ? { json, strips }
    : { json: { ...json, confirm }, strips };
}
