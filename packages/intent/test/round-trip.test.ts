import { describe, expect, it } from "vitest";
import { VALID } from "../src/fixtures/index.js";
import {
  INTENT_KINDS,
  type Intent,
  IntentSchema,
  parse,
  toText,
} from "../src/index.js";

const ctxOf = (i: Intent) => ({
  id: i.id,
  actor: i.actor,
  source: i.source,
  commit: i.commit,
});

describe("round trip over VALID fixtures", () => {
  for (const k of INTENT_KINDS)
    it(`${k}: parse(toText(i)) equals i`, () => {
      for (const i of VALID[k]) {
        const text = toText(i);
        const r = parse(text, ctxOf(i));
        expect(r, text).toEqual({ ok: true, intent: IntentSchema.parse(i) });
        if (r.ok) expect(toText(r.intent)).toBe(text);
      }
    });
});
