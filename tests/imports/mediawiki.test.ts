import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  importMediaWikiApprovalManifest,
  mediaWikiPageImportAdapter,
  normalizeMediaWikiTitle,
} from "../../app/lib/imports/adapters/mediawiki/index.js";

const fixtureRoot = join(process.cwd(), "fixtures", "mediawiki");

async function fixtureBytes(filename: string): Promise<Uint8Array> {
  return readFile(join(fixtureRoot, filename));
}

describe("MediaWiki page JSON adapter", () => {
  it("normalizes required page fields and preserves raw JSON", async () => {
    const bytes = await fixtureBytes("simple-page.json");
    const result = await mediaWikiPageImportAdapter.import({ filename: "simple-page.json", bytes, sourceId: "fixture-source" });
    const document = result.documents[0];

    expect(result.warnings).toEqual([]);
    expect(document.id).toBe("mediawiki-page-1001");
    expect(document.title).toBe("Sample Page");
    expect(document.sourceFormat).toBe("mediawiki-json");
    expect(document.provenance).toMatchObject({
      filename: "simple-page.json",
      sourceId: "fixture-source",
      title: "Sample Page",
      normalizedTitle: "sample page",
      page_id: 1001,
      revision_id: 2002,
      timestamp: "2026-05-29T00:00:00Z",
      dump_date: "2026-05-29",
      source: "synthetic-mediawiki",
      source_tier: "fixture",
      source_url: "https://example.invalid/wiki/Sample_Page",
      categories: ["Fixture pages", "Synthetic corpus"],
      links: ["Linked Fixture"],
    });
    expect(document.rawMetadata).toMatchObject({
      mediawiki: {
        title: "Sample Page",
        categories: ["Fixture pages", "Synthetic corpus"],
        links: ["Linked Fixture"],
      },
    });
    expect((document.rawMetadata as { rawJson: string }).rawJson).toContain('"page_id": 1001');
    expect(document.normalizedText).toContain("synthetic fixture text");
    expect(document.sections).toEqual([
      expect.objectContaining({
        id: "mediawiki-section-0001",
        ordinal: 0,
        heading: "Sample Page",
        headingPath: ["Sample Page"],
        text: document.normalizedText,
      }),
    ]);
  });

  it("fails malformed page JSON clearly without partial success", async () => {
    await expect(
      mediaWikiPageImportAdapter.import({ filename: "malformed.json", bytes: await fixtureBytes("malformed.json") }),
    ).rejects.toThrow(/Malformed MediaWiki page JSON in malformed\.json/);
  });
});

describe("MediaWiki approval manifest importer", () => {
  it("preserves decisions, policy, counts, and non-strict missing approved pages", async () => {
    const result = await importMediaWikiApprovalManifest({
      manifest: { filename: "approval-manifest.json", bytes: await fixtureBytes("approval-manifest.json") },
      pages: [{ filename: "simple-page.json", bytes: await fixtureBytes("simple-page.json") }],
    });

    expect(result.policy).toEqual({
      name: "synthetic-fixture-policy",
      version: "1.0.0",
      notes: "Public-domain synthetic approval manifest for #19 parity tests.",
    });
    expect(result.counts).toEqual({ approved: 2, rejected: 1, deferred: 1, pages: 1, missing: 1 });
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "missing-approved-page",
        message: "Missing approved page artifact for Missing Approved Page.",
        metadata: { title: "Missing Approved Page", normalizedTitle: "missing approved page" },
      }),
    ]);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].title).toBe("Sample Page");
    expect(result.decisions).toEqual([
      expect.objectContaining({
        id: "mediawiki-decision-approved-sample-page",
        state: "approved",
        title: "Sample Page",
        normalizedTitle: "sample page",
        rationale: "synthetic approved page",
        targetDocumentId: "mediawiki-page-1001",
      }),
      expect.objectContaining({
        id: "mediawiki-decision-approved-missing-approved-page",
        state: "approved",
        title: "Missing Approved Page",
        targetDocumentId: null,
      }),
      expect.objectContaining({ state: "rejected", title: "Rejected Fixture", rationale: "outside synthetic test scope" }),
      expect.objectContaining({ state: "deferred", title: "Deferred Fixture", rationale: "needs human review" }),
    ]);
  });

  it("uses underscore and space equivalence while preserving page display title", async () => {
    const manifestBytes = new TextEncoder().encode(JSON.stringify({
      policy: { name: "lookup-test" },
      approved: [{ title: " Sample_Page ", reason: "equivalent lookup" }],
      rejected: [],
      deferred: [],
    }));

    const result = await importMediaWikiApprovalManifest({
      manifest: { filename: "lookup-manifest.json", bytes: manifestBytes },
      pages: [{ filename: "simple-page.json", bytes: await fixtureBytes("simple-page.json") }],
    });

    expect(normalizeMediaWikiTitle(" Sample_Page ")).toBe("sample page");
    expect(result.counts).toEqual({ approved: 1, rejected: 0, deferred: 0, pages: 1, missing: 0 });
    expect(result.documents[0].title).toBe("Sample Page");
    expect(result.decisions[0]).toMatchObject({ normalizedTitle: "sample page", targetDocumentId: "mediawiki-page-1001" });
  });

  it("fails strict mode when an approved page artifact is missing", async () => {
    await expect(
      importMediaWikiApprovalManifest({
        manifest: { filename: "approval-manifest.json", bytes: await fixtureBytes("approval-manifest.json") },
        pages: [{ filename: "simple-page.json", bytes: await fixtureBytes("simple-page.json") }],
        strict: true,
      }),
    ).rejects.toThrow("missing approved page: Missing Approved Page");
  });

  it("reimports idempotently using stable document and decision upsert keys", async () => {
    const input = {
      manifest: { filename: "approval-manifest.json", bytes: await fixtureBytes("approval-manifest.json") },
      pages: [{ filename: "simple-page.json", bytes: await fixtureBytes("simple-page.json") }],
    };

    const first = await importMediaWikiApprovalManifest(input);
    const second = await importMediaWikiApprovalManifest(input);

    expect(second.upserts).toEqual(first.upserts);
    expect(new Set(second.upserts.documentKeys).size).toBe(second.upserts.documentKeys.length);
    expect(new Set(second.upserts.decisionKeys).size).toBe(second.upserts.decisionKeys.length);
    expect(second.documents.map((document) => document.id)).toEqual(["mediawiki-page-1001"]);
    expect(second.decisions.map((decision) => decision.id)).toEqual([
      "mediawiki-decision-approved-sample-page",
      "mediawiki-decision-approved-missing-approved-page",
      "mediawiki-decision-rejected-rejected-fixture",
      "mediawiki-decision-deferred-deferred-fixture",
    ]);
  });

  it("fails malformed manifest JSON clearly", async () => {
    await expect(
      importMediaWikiApprovalManifest({
        manifest: { filename: "broken-manifest.json", bytes: new TextEncoder().encode('{"approved": [') },
        pages: [],
      }),
    ).rejects.toThrow(/Malformed MediaWiki approval manifest JSON in broken-manifest\.json/);
  });
});
