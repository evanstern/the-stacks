import { describe, expect, it } from "vitest";
import { RecordSchemas, SourceRef } from "../src/schema/index.js";
import { KINDS, readData } from "./helpers.js";

describe("source references (AC #6)", () => {
  it.each(KINDS)("%s: every record has a valid SRD 5.2.1 source", (kind) => {
    for (const r of readData(kind)) {
      const parsed = SourceRef.safeParse(r.source);
      expect(parsed.success, `${kind}/${r.id}`).toBe(true);
      expect(r.source.document).toBe("SRD 5.2.1");
      expect(r.source.section.length).toBeGreaterThan(0);
      expect(Number.isInteger(r.source.page)).toBe(true);
    }
  });

  it.each(KINDS)("%s: a record without source fails the schema", (kind) => {
    const first = readData(kind)[0];
    expect(first).toBeDefined();
    const { source: _source, ...withoutSource } = first as Record<
      string,
      unknown
    >;
    expect(RecordSchemas[kind].safeParse(withoutSource).success).toBe(false);
  });

  it("a record with a different document fails the schema", () => {
    const first = readData("spell")[0] as Record<string, unknown>;
    const wrong = {
      ...first,
      source: { document: "Other", section: "x", page: 1 },
    };
    expect(RecordSchemas.spell.safeParse(wrong).success).toBe(false);
  });
});
