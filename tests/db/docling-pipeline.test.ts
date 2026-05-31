import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDatabase, openDatabase, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import { createDoclingPdfImportAdapter } from "../../app/lib/imports/adapters/docling.js";
import { queueUploadImport } from "../../app/lib/imports/upload.server.js";
import { createSyntheticPdf } from "../imports/pdf-fixture.js";

let tempDir: string;
let previousDbPath: string | undefined;
let previousUploadDir: string | undefined;

function openTestDatabase(): Database {
  const db = openDatabase(process.env.THE_STACKS_DB_PATH);
  runMigrations(db);
  return db;
}

function pdfFileFor(name: string): File {
  const bytes = createSyntheticPdf({ pageTexts: [""] });
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([body], name, { type: "application/pdf" });
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "the-stacks-docling-"));
  previousDbPath = process.env.THE_STACKS_DB_PATH;
  previousUploadDir = process.env.IKIS_UPLOAD_DIR;
  process.env.THE_STACKS_DB_PATH = join(tempDir, "docling.sqlite");
  process.env.IKIS_UPLOAD_DIR = join(tempDir, "uploads");
});

afterEach(() => {
  if (previousDbPath === undefined) {
    delete process.env.THE_STACKS_DB_PATH;
  } else {
    process.env.THE_STACKS_DB_PATH = previousDbPath;
  }

  if (previousUploadDir === undefined) {
    delete process.env.IKIS_UPLOAD_DIR;
  } else {
    process.env.IKIS_UPLOAD_DIR = previousUploadDir;
  }

  rmSync(tempDir, { recursive: true, force: true });
});

describe("Docling PDF extraction experiment", () => {
  it("normalizes Docling Markdown and JSON into reviewable layout-aware sections", async () => {
    const adapter = createDoclingPdfImportAdapter({
      runCommand: async (command, args) => {
        expect(command).toMatch(/docling$/);

        if (args[0] === "--version") {
          return { stdout: "docling 2.42.0\n", stderr: "" };
        }

        const outputDir = args[args.indexOf("--output") + 1];
        await mkdir(outputDir, { recursive: true });
        await writeFile(join(outputDir, "monster.md"), [
          "# Adult Red Dragon",
          "",
          "| STR | DEX | CON | INT | WIS | CHA |",
          "| --- | --- | --- | --- | --- | --- |",
          "| 27 (+8) | 10 (+0) | 25 (+7) | 16 (+3) | 13 (+1) | 21 (+5) |",
          "",
          "Armor Class 19 (natural armor)",
          "Hit Points 256 (19d12 + 133)",
          "Speed 40 ft., climb 40 ft., fly 80 ft.",
        ].join("\n"));
        await writeFile(join(outputDir, "monster.json"), JSON.stringify({ texts: [{ label: "section_header" }], tables: [{ rows: 3 }] }));

        return { stdout: "", stderr: "table structure detected" };
      },
    });

    const result = await adapter.import({ filename: "adult-red-dragon.pdf", bytes: createSyntheticPdf({ pageTexts: [""] }), sourceId: "source-test" });
    const document = result.documents[0];

    expect(document.provenance).toMatchObject({ extraction: "docling-layout", docling: { engine: "docling", engineVersion: "docling 2.42.0" } });
    expect(document.normalizedText).toContain("| STR | DEX | CON | INT | WIS | CHA |");
    expect(document.normalizedText).toContain("Armor Class 19");
    expect(document.corpusReadiness).toMatchObject({ state: "usable", reviewRecommendation: "approve" });
    expect(document.sections[0]).toMatchObject({
      heading: "Adult Red Dragon",
      metadata: { source: "pdf-docling-markdown", containsMarkdownTable: true, containsStatBlockHints: true },
    });
    expect(result.warnings).toEqual([{ code: "docling-stderr", message: "table structure detected" }]);
  });

  it("routes selected PDF uploads through the background pdf-docling queue", async () => {
    const result = await queueUploadImport(pdfFileFor("monster-chunk.pdf"), { pdfExtraction: "docling" });

    expect(result.source.parserAdapter).toBe("pdf-docling");
    expect(result.importJob.adapter).toBe("pdf-docling");
    expect(result.importJob.status).toBe("queued");
    expect(result.ocrJobIds).toEqual([result.importJob.id]);
    expect(result.message).toContain("Docling layout extraction queued");

    const db = openTestDatabase();
    try {
      const corpusRepo = createCorpusRepository(db);
      const source = corpusRepo.getSource(result.source.id);
      expect(source?.metadata).toMatchObject({ allowedExtension: ".pdf" });
    } finally {
      closeDatabase(db);
    }
  });
});
