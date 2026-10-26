import { describe, expect, it } from "vitest";
import { SRD_DATA_SOURCE } from "../src/attribution.js";
import {
  KINDS,
  normalizeName,
  readData,
  readIndex,
  readJson,
} from "./helpers.js";

// The official SRD 5.2.1 PDF's identity (research.md R1). A change here is a visible diff.
const PDF_SHA256 =
  "8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87";

// Page ranges per kind (data-model.md). Embedded monster stat blocks sit in Magic Items.
const RANGE = {
  monster: [254, 364],
  spell: [107, 175],
  class: [28, 82],
  equipment: [89, 103],
  condition: [176, 191],
} as const;

const index = readIndex();

describe("SRD 5.2.1 index", () => {
  it("records the PDF checksum", () => {
    expect(index.pdfSha256).toBe(PDF_SHA256);
    expect(index.document).toBe("SRD 5.2.1");
  });

  it.each(KINDS)(
    "%s: every index entry lies in the kind's page range",
    (kind) => {
      const [lo, hi] = RANGE[kind];
      for (const e of index.kinds[kind]) {
        if (kind === "monster" && e.embedded) {
          expect(e.page, e.name).toBeGreaterThanOrEqual(204);
          expect(e.page, e.name).toBeLessThanOrEqual(253);
        } else {
          expect(e.page, e.name).toBeGreaterThanOrEqual(lo);
          expect(e.page, e.name).toBeLessThanOrEqual(hi);
        }
      }
    },
  );
});

describe.each(KINDS)("%s records against the index", (kind) => {
  const records = readData(kind);
  const entries = index.kinds[kind];

  it("has exactly as many records as the index has entries", () => {
    expect(records.length).toBe(entries.length);
  });

  it("every record's normalized name is in the index for its kind", () => {
    const names = new Set(entries.map((e) => normalizeName(e.name)));
    for (const r of records) {
      expect(names.has(normalizeName(r.name)), r.name).toBe(true);
    }
  });

  it("every index entry has a record", () => {
    const names = new Set(records.map((r) => normalizeName(r.name)));
    for (const e of entries) {
      expect(names.has(normalizeName(e.name)), e.name).toBe(true);
    }
  });

  it("every record's page matches its index entry and the kind's range", () => {
    const byName = new Map(entries.map((e) => [normalizeName(e.name), e]));
    const [lo, hi] = RANGE[kind];
    for (const r of records) {
      const e = byName.get(normalizeName(r.name));
      expect(r.source.page, r.name).toBe(e?.page);
      if (!e?.embedded) {
        expect(r.source.page, r.name).toBeGreaterThanOrEqual(lo);
        expect(r.source.page, r.name).toBeLessThanOrEqual(hi);
      }
    }
  });
});

describe("verification report", () => {
  const report = readJson("provenance/verification.json") as {
    pdfSha256: string;
    records: {
      kind: string;
      id: string;
      page: number;
      ok: boolean;
      missing: string[];
    }[];
  };

  it("was produced against the same PDF", () => {
    expect(report.pdfSha256).toBe(PDF_SHA256);
  });

  it("has zero mismatches", () => {
    const bad = report.records.filter((r) => !r.ok);
    expect(
      bad.map((r) => `${r.kind}/${r.id}: ${r.missing.join("; ")}`),
    ).toEqual([]);
  });

  it("covers every shipped record", () => {
    const covered = new Set(report.records.map((r) => `${r.kind}/${r.id}`));
    for (const kind of KINDS) {
      for (const r of readData(kind)) {
        expect(covered.has(`${kind}/${r.id}`), `${kind}/${r.id}`).toBe(true);
      }
    }
    const total = KINDS.reduce((n, k) => n + readData(k).length, 0);
    expect(report.records.length).toBe(total);
  });
});

describe("conversion provenance", () => {
  const source = readJson("provenance/source.json") as {
    upstream: { repository: string; commit: string; license: string };
    pdf: { sha256: string };
  };

  it("pins the upstream dataset to one commit", () => {
    expect(source.upstream.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(source.pdf.sha256).toBe(PDF_SHA256);
  });

  it("matches the data-source credit in code", () => {
    expect(SRD_DATA_SOURCE).toEqual({
      name: "Open5e",
      url: source.upstream.repository,
      commit: source.upstream.commit,
      license: source.upstream.license,
    });
  });
});
