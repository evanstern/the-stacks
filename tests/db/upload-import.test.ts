import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDatabase, openDatabase, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import { queueUploadImport, UploadValidationError } from "../../app/lib/imports/upload.server.js";
import { recordHumanReviewDecision } from "../../app/lib/review/queue.server.js";
import { createReviewRepository } from "../../app/lib/review/repository.js";
import { createSyntheticDocx } from "../imports/docx-fixture.js";
import { createSyntheticPdf } from "../imports/pdf-fixture.js";

let tempDir: string;
let previousDbPath: string | undefined;
let previousUploadDir: string | undefined;
let previousProviderKey: string | undefined;
let previousOpenAiKey: string | undefined;
let previousAnthropicKey: string | undefined;
let previousProviderUrl: string | undefined;

function fileFor(name: string, body: string, type = "text/plain"): File {
  return new File([body], name, { type });
}

function bytesFileFor(name: string, bytes: Uint8Array, type: string): File {
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([body], name, { type });
}

function openTestDatabase(): Database {
  const db = openDatabase(process.env.THE_STACKS_DB_PATH);
  runMigrations(db);
  return db;
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "the-stacks-upload-"));
  previousDbPath = process.env.THE_STACKS_DB_PATH;
  previousUploadDir = process.env.IKIS_UPLOAD_DIR;
  previousProviderKey = process.env.IKIS_REVIEW_LLM_PROVIDER_KEY;
  previousOpenAiKey = process.env.OPENAI_API_KEY;
  previousAnthropicKey = process.env.ANTHROPIC_API_KEY;
  previousProviderUrl = process.env.IKIS_REVIEW_LLM_PROVIDER_URL;
  process.env.THE_STACKS_DB_PATH = join(tempDir, "upload.sqlite");
  process.env.IKIS_UPLOAD_DIR = join(tempDir, "uploads");
  delete process.env.IKIS_REVIEW_LLM_PROVIDER_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.IKIS_REVIEW_LLM_PROVIDER_URL;
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

  if (previousProviderKey === undefined) {
    delete process.env.IKIS_REVIEW_LLM_PROVIDER_KEY;
  } else {
    process.env.IKIS_REVIEW_LLM_PROVIDER_KEY = previousProviderKey;
  }

  if (previousOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = previousOpenAiKey;
  }

  if (previousAnthropicKey === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = previousAnthropicKey;
  }

  if (previousProviderUrl === undefined) {
    delete process.env.IKIS_REVIEW_LLM_PROVIDER_URL;
  } else {
    process.env.IKIS_REVIEW_LLM_PROVIDER_URL = previousProviderUrl;
  }

  rmSync(tempDir, { recursive: true, force: true });
});

describe("upload import foundation", () => {
  it("stores an allowed source and queues an import job", async () => {
    const result = await queueUploadImport(fileFor("field-notes.md", "# Field Notes\nSynthetic text.", "text/markdown"));

    expect(result.duplicate).toBe(false);
    expect(result.source.originalFilename).toBe("field-notes.md");
    expect(result.source.importStatus).toBe("queued");
    expect(result.source.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.source.storageUri).toContain("file://");
    expect(result.importJob.status).toBe("failed_review_suggestion");
    expect(result.importJob.sourceId).toBe(result.source.id);
    expect(result.reviewItemIds).toHaveLength(1);
    expect(result.suggestionErrors[0]).toContain("Review LLM provider key is not configured");

    const storedPath = result.source.storageUri?.replace("file://", "") ?? "";
    expect(existsSync(storedPath)).toBe(true);
    await expect(readFile(storedPath, "utf8")).resolves.toContain("Synthetic text.");
  });

  it("rejects unsupported extensions before creating rows", async () => {
    await expect(queueUploadImport(fileFor("notes.doc", "legacy document", "application/msword"))).rejects.toThrow(
      UploadValidationError,
    );

    const db = openTestDatabase();
    try {
      const corpusRepo = createCorpusRepository(db);
      expect(corpusRepo.listCorpora()).toHaveLength(0);
    } finally {
      closeDatabase(db);
    }
  });

  it("imports DOCX through the review queue with paragraph provenance", async () => {
    const result = await queueUploadImport(
      bytesFileFor("sourcebook.docx", createSyntheticDocx(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    );

    expect(result.duplicate).toBe(false);
    expect(result.source.parserAdapter).toBe("docx");
    expect(result.source.metadata).toMatchObject({ allowedExtension: ".docx", originalUploadName: "sourcebook.docx" });
    expect(result.importJob.status).toBe("failed_review_suggestion");
    expect(result.reviewItemIds).toHaveLength(1);
    expect(result.suggestionErrors[0]).toContain("Review LLM provider key is not configured");

    const db = openTestDatabase();
    try {
      const corpusRepo = createCorpusRepository(db);
      const reviewRepo = createReviewRepository(db);
      const documents = corpusRepo.listDocumentsForCorpus(result.source.corpusId);
      expect(documents).toHaveLength(1);
      expect(documents[0]).toMatchObject({
        sourceId: result.source.id,
        title: "Synthetic DOCX Fixture",
        authors: ["Fixture Author"],
        language: "en",
        sourceFormat: "docx",
        provenance: {
          filename: "sourcebook.docx",
          sourceId: result.source.id,
          documentPath: "word/document.xml",
          paragraphCount: 4,
          extraction: "wordprocessingml-text",
        },
      });
      expect(documents[0].rawMetadata).toMatchObject({
        coreProperties: { title: "Synthetic DOCX Fixture", creator: "Fixture Author", language: "en" },
        limitations: expect.arrayContaining([expect.stringContaining("Legacy .doc files")]),
      });
      expect(documents[0].normalizedText).toContain("Reviewable Section");

      const sections = corpusRepo.listSectionsForDocument(documents[0].id);
      expect(sections).toHaveLength(4);
      expect(sections[0]).toMatchObject({
        ordinal: 0,
        heading: "Synthetic DOCX Fixture",
        headingPath: ["Synthetic DOCX Fixture"],
        metadata: { source: "docx-paragraph", paragraphOrdinal: 0, style: "Heading1", headingLevel: 1 },
      });
      expect(sections[2]).toMatchObject({
        ordinal: 2,
        heading: "Reviewable Section",
        headingPath: ["Synthetic DOCX Fixture", "Reviewable Section"],
        metadata: { source: "docx-paragraph", paragraphOrdinal: 2, style: "Heading2", headingLevel: 2 },
      });

      const reviewItems = reviewRepo.listReviewItems(result.source.corpusId);
      expect(reviewItems).toHaveLength(1);
      expect(reviewItems[0]).toMatchObject({ targetType: "document", targetId: documents[0].id, status: "pending" });
      expect(reviewItems[0].metadata).toMatchObject({ adapter: "docx", adapterVersion: "docx-v1", sourceFilename: "sourcebook.docx" });
    } finally {
      closeDatabase(db);
    }
  });

  it("imports PDFs through the review queue with page-level provenance", async () => {
    const result = await queueUploadImport(bytesFileFor("sourcebook.pdf", createSyntheticPdf(), "application/pdf"));

    expect(result.duplicate).toBe(false);
    expect(result.source.parserAdapter).toBe("pdf");
    expect(result.source.metadata).toMatchObject({ allowedExtension: ".pdf", originalUploadName: "sourcebook.pdf" });
    expect(result.importJob.status).toBe("failed_review_suggestion");
    expect(result.reviewItemIds).toHaveLength(1);
    expect(result.suggestionErrors[0]).toContain("Review LLM provider key is not configured");

    const db = openTestDatabase();
    try {
      const corpusRepo = createCorpusRepository(db);
      const reviewRepo = createReviewRepository(db);
      const documents = corpusRepo.listDocumentsForCorpus(result.source.corpusId);
      expect(documents).toHaveLength(1);
      expect(documents[0]).toMatchObject({
        sourceId: result.source.id,
        title: "Synthetic PDF Fixture",
        sourceFormat: "pdf",
        provenance: {
          filename: "sourcebook.pdf",
          sourceId: result.source.id,
          pageCount: 2,
          extractedPages: [1, 2],
          extraction: "text-content-streams",
        },
      });
      expect(documents[0].rawMetadata).toMatchObject({ limitations: expect.arrayContaining([expect.stringContaining("Scanned/image-only PDFs require OCR")]) });
      expect(documents[0].normalizedText).toContain("Page 2\nSecond page text for review");

      const sections = corpusRepo.listSectionsForDocument(documents[0].id);
      expect(sections).toHaveLength(2);
      expect(sections[0]).toMatchObject({
        ordinal: 0,
        heading: "Page 1",
        headingPath: ["Page 1"],
        metadata: { source: "pdf-page", pageNumber: 1, pageObjectId: 3, contentObjectIds: [5] },
      });
      expect(sections[1]).toMatchObject({
        ordinal: 1,
        heading: "Page 2",
        headingPath: ["Page 2"],
        metadata: { source: "pdf-page", pageNumber: 2, pageObjectId: 4, contentObjectIds: [6] },
      });

      const reviewItems = reviewRepo.listReviewItems(result.source.corpusId);
      expect(reviewItems).toHaveLength(1);
      expect(reviewItems[0]).toMatchObject({ targetType: "document", targetId: documents[0].id, status: "pending" });
      expect(reviewItems[0].metadata).toMatchObject({
        adapter: "pdf",
        adapterVersion: "pdf-v1",
        sourceFilename: "sourcebook.pdf",
        corpusReadiness: { state: "usable", reviewRecommendation: "approve" },
      });
    } finally {
      closeDatabase(db);
    }
  });

  it("keeps scanned PDFs out of corpus-ready status and suggests deferral for OCR", async () => {
    const result = await queueUploadImport(bytesFileFor("scanned.pdf", createSyntheticPdf({ pageTexts: [""] }), "application/pdf"));

      expect(result.importJob.status).toBe("ocr_needed");
      expect(result.reviewItemIds).toHaveLength(1);
      expect(result.ocrJobIds).toHaveLength(1);
      expect(result.suggestionErrors).toEqual([]);

    const db = openTestDatabase();
    try {
      const corpusRepo = createCorpusRepository(db);
      const reviewRepo = createReviewRepository(db);
      const [document] = corpusRepo.listDocumentsForCorpus(result.source.corpusId);
      expect(document).toMatchObject({
        sourceFormat: "pdf",
        normalizedText: "",
        status: "ocr_needed",
        provenance: {
          corpusReadiness: {
            state: "ocr_needed",
            reviewRecommendation: "defer",
          },
        },
      });
      expect(corpusRepo.listSectionsForDocument(document.id)).toEqual([]);

      const [reviewItem] = reviewRepo.listPendingQueue(result.source.corpusId);
      expect(reviewItem).toMatchObject({ targetType: "document", targetId: document.id, status: "suggested" });
      expect(reviewItem.summary).toContain("ocr needed:");
      expect(reviewItem.metadata).toMatchObject({ corpusReadiness: { state: "ocr_needed", reviewRecommendation: "defer" } });
      expect(reviewItem.latestSuggestion).toMatchObject({
        suggestionState: "suggested_defer",
        model: "ikis-readiness-policy",
        promptVersion: "pdf-corpus-readiness-v1",
      });

      const approved = recordHumanReviewDecision({ reviewItemId: reviewItem.id, decisionState: "approved", actor: "test-human" });
      expect(approved.decisionState).toBe("approved");
      expect(corpusRepo.getDocument(document.id)?.status).toBe("ocr_needed");
      expect(corpusRepo.listChunksForDocument(document.id)).toEqual([]);
      const ocrJob = corpusRepo.getImportJob(result.ocrJobIds[0]);
      expect(ocrJob).toMatchObject({
        sourceId: result.source.id,
        status: "ocr_queued",
        adapter: "pdf-ocr",
        adapterVersion: "pdf-ocr-v1",
      });
      expect(ocrJob?.stats).toMatchObject({ parentImportJobId: result.importJob.id, parserReadiness: { state: "ocr_needed" } });
    } finally {
      closeDatabase(db);
    }
  });

  it("uses SHA-256 idempotency for duplicate uploads", async () => {
    const first = await queueUploadImport(fileFor("first.txt", "same body"));
    const second = await queueUploadImport(fileFor("second.txt", "same body"));

    expect(second.duplicate).toBe(true);
    expect(second.source.id).toBe(first.source.id);
    expect(second.importJob.id).not.toBe(first.importJob.id);

    const db = openTestDatabase();
    try {
      const corpusRepo = createCorpusRepository(db);
      const reviewRepo = createReviewRepository(db);
      const corpus = corpusRepo.getOrCreateDefaultCorpus();
      expect(corpusRepo.listSourcesForCorpus(corpus.id)).toHaveLength(1);
      expect(corpusRepo.listImportJobsForSource(first.source.id)).toHaveLength(2);
      expect(reviewRepo.listReviewItems(corpus.id)).toHaveLength(2);
    } finally {
      closeDatabase(db);
    }
  });
});
