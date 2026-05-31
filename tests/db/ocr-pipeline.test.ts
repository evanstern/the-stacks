import { mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDatabase, openDatabase, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import { assessOcrTextQuality, createComparingPdfOcrEngine, createConfiguredPdfOcrEngine, createLocalPdfOcrEngine, createOcrMyPdfEngine, evaluateOcrEngineResults, runOcrJob, type OcrEngine } from "../../app/lib/imports/ocr.server.js";
import { queueUploadImport } from "../../app/lib/imports/upload.server.js";
import { recordHumanReviewDecision } from "../../app/lib/review/queue.server.js";
import { createReviewRepository } from "../../app/lib/review/repository.js";
import { createSyntheticPdf } from "../imports/pdf-fixture.js";

type JsonObject = { [key: string]: unknown };

const usableOcrText = [
  "Recovered scanned PDF text with enough content for review and chunking.",
  "This paragraph contains durable source material that a human reviewer can inspect before approval.",
  "The text has complete words, low noise, and enough substance to create useful corpus chunks.",
  "It describes a fictional creature entry with habitat, behavior, tactics, and reviewable prose for retrieval.",
].join(" ");

let tempDir: string;
let previousDbPath: string | undefined;
let previousUploadDir: string | undefined;

function openTestDatabase(): Database {
  const db = openDatabase(process.env.THE_STACKS_DB_PATH);
  runMigrations(db);
  return db;
}

function bytesFileFor(name: string, bytes: Uint8Array): File {
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([body], name, { type: "application/pdf" });
}

function jsonObject(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "the-stacks-ocr-"));
  previousDbPath = process.env.THE_STACKS_DB_PATH;
  previousUploadDir = process.env.IKIS_UPLOAD_DIR;
  process.env.THE_STACKS_DB_PATH = join(tempDir, "ocr.sqlite");
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

describe("PDF OCR fallback pipeline", () => {
  it("uses local Poppler and Tesseract commands as the default OCR engine shape", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const engine = createLocalPdfOcrEngine({
      runCommand: async (command, args) => {
        calls.push({ command, args });

        if (command === "tesseract" && args[0] === "--version") {
          return { stdout: "tesseract 5.5.1\n", stderr: "" };
        }

        if (command === "pdftoppm" && args[0] === "-v") {
          return { stdout: "", stderr: "pdftoppm version 24.12.0\n" };
        }

        if (command === "pdftoppm") {
          const outputPrefix = args[args.length - 1];
          await writeFile(`${outputPrefix}-1.png`, new Uint8Array([137, 80, 78, 71]));
          await writeFile(`${outputPrefix}-2.png`, new Uint8Array([137, 80, 78, 71]));
          return { stdout: "", stderr: "" };
        }

        if (command === "tesseract") {
          const pageNumber = /-(\d+)\.png$/.exec(args[0])?.[1] ?? "0";
          return {
            stdout: [
              "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
              `5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t92\tRecovered`,
              `5\t1\t1\t1\t1\t2\t11\t0\t10\t10\t88\tpage-${pageNumber}`,
            ].join("\n"),
            stderr: "",
          };
        }

        throw new Error(`unexpected command ${command}`);
      },
    });

    const result = await engine.recognizePdf({ filename: "scan.pdf", bytes: createSyntheticPdf({ pageTexts: [""] }), sourceId: "source-test" });

    expect(result).toMatchObject({
      engineName: "local-tesseract-poppler",
      engineVersion: "tesseract 5.5.1",
      pages: [
        { pageNumber: 1, text: "Recovered page-1", confidence: 0.9, quality: { classification: "weak" } },
        { pageNumber: 2, text: "Recovered page-2", confidence: 0.9, quality: { classification: "weak" } },
      ],
    });
    expect(result.warnings?.[0]).toContain("pdftoppm version 24.12.0");
    expect(calls.map((call) => call.command)).toEqual(["tesseract", "pdftoppm", "pdftoppm", "tesseract", "tesseract"]);
  });

  it("runs OCRmyPDF locally and splits sidecar output into page-level OCR pages", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const engine = createOcrMyPdfEngine({
      runCommand: async (command, args) => {
        calls.push({ command, args });

        if (command === "ocrmypdf" && args[0] === "--version") {
          return { stdout: "16.10.4\n", stderr: "" };
        }

        if (command === "ocrmypdf") {
          const sidecarPath = args[args.indexOf("--sidecar") + 1];
          await writeFile(sidecarPath, "Readable OCRmyPDF first page with enough words for review and chunking.\fSecond OCRmyPDF page stays clear and human readable.");
          return { stdout: "", stderr: "Tagged PDF output retained locally." };
        }

        throw new Error(`unexpected command ${command}`);
      },
    });

    const result = await engine.recognizePdf({ filename: "scan.pdf", bytes: createSyntheticPdf({ pageTexts: [""] }), sourceId: "source-test" });

    expect(result).toMatchObject({
      engineName: "ocrmypdf",
      engineVersion: "16.10.4",
      pages: [
        { pageNumber: 1, text: expect.stringContaining("Readable OCRmyPDF first page"), confidence: null, quality: { classification: "usable" } },
        { pageNumber: 2, text: expect.stringContaining("Second OCRmyPDF page"), confidence: null, quality: { classification: "usable" } },
      ],
      warnings: ["Tagged PDF output retained locally."],
    });
    expect(calls.map((call) => call.command)).toEqual(["ocrmypdf", "ocrmypdf"]);
    expect(calls[1].args).toContain("--force-ocr");
  });

  it("allows OCRmyPDF mode selection without losing local engine boundaries", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const engine = createOcrMyPdfEngine({
      ocrMyPdfMode: "redo-ocr",
      runCommand: async (command, args) => {
        calls.push({ command, args });

        if (command === "ocrmypdf" && args[0] === "--version") {
          return { stdout: "16.10.4\n", stderr: "" };
        }

        if (command === "ocrmypdf") {
          const sidecarPath = args[args.indexOf("--sidecar") + 1];
          await writeFile(sidecarPath, "Readable redo OCR output with enough text for review.");
          return { stdout: "", stderr: "" };
        }

        throw new Error(`unexpected command ${command}`);
      },
    });

    await engine.recognizePdf({ filename: "scan.pdf", bytes: createSyntheticPdf({ pageTexts: [""] }), sourceId: "source-test" });

    expect(calls[1].args).toContain("--redo-ocr");
  });

  it("selects and compares configured OCR engines without hardcoding one path", async () => {
    expect(createConfiguredPdfOcrEngine({ IKIS_OCR_ENGINE: "local-tesseract-poppler" })).toBeTruthy();
    expect(createConfiguredPdfOcrEngine({ IKIS_OCR_ENGINE: "ocrmypdf" })).toBeTruthy();
    expect(createConfiguredPdfOcrEngine({ IKIS_OCR_ENGINE: "compare-local-ocrmypdf" })).toBeTruthy();
    expect(() => createConfiguredPdfOcrEngine({ IKIS_OCR_ENGINE: "cloud-ocr" })).toThrow(/Unsupported IKIS_OCR_ENGINE/);
  });

  it("classifies OCRmyPDF quality against local Tesseract/Poppler using noise and chunkability gates", async () => {
    const evaluation = evaluateOcrEngineResults([
      {
        engineName: "local-tesseract-poppler",
        engineVersion: "tesseract 5.5.1",
        pages: [{ pageNumber: 1, text: "A | | l l 0 0 ???", confidence: 0.38, quality: assessOcrTextQuality("A | | l l 0 0 ???") }],
      },
      {
        engineName: "ocrmypdf",
        engineVersion: "16.10.4",
        pages: [{ pageNumber: 1, text: "This OCRmyPDF page is readable enough for human review and chunkable corpus ingestion.", confidence: null, quality: assessOcrTextQuality("This OCRmyPDF page is readable enough for human review and chunkable corpus ingestion.") }],
      },
    ]);

    expect(evaluation.classification).toBe("ocrmypdf-wins");
    expect(evaluation.selectedEngine).toBe("ocrmypdf");
    expect(evaluation.comparedEngines[0].averageNoiseRatio).toBeLessThan(evaluation.comparedEngines[1].averageNoiseRatio!);

    const calls: Array<{ command: string; args: string[] }> = [];
    const engine = createComparingPdfOcrEngine({
      runCommand: async (command, args) => {
        calls.push({ command, args });

        if (command === "tesseract" && args[0] === "--version") {
          return { stdout: "tesseract 5.5.1\n", stderr: "" };
        }

        if (command === "pdftoppm" && args[0] === "-v") {
          return { stdout: "", stderr: "pdftoppm version 24.12.0\n" };
        }

        if (command === "pdftoppm") {
          const outputPrefix = args[args.length - 1];
          await writeFile(`${outputPrefix}-1.png`, new Uint8Array([137, 80, 78, 71]));
          return { stdout: "", stderr: "" };
        }

        if (command === "tesseract") {
          return {
            stdout: [
              "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
              "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t31\t|",
              "5\t1\t1\t1\t1\t2\t11\t0\t10\t10\t30\t?",
            ].join("\n"),
            stderr: "",
          };
        }

        if (command === "ocrmypdf" && args[0] === "--version") {
          return { stdout: "16.10.4\n", stderr: "" };
        }

        if (command === "ocrmypdf") {
          const sidecarPath = args[args.indexOf("--sidecar") + 1];
          await writeFile(sidecarPath, "This OCRmyPDF page is readable enough for human review and chunkable corpus ingestion.");
          return { stdout: "", stderr: "" };
        }

        throw new Error(`unexpected command ${command}`);
      },
    });

    const result = await engine.recognizePdf({ filename: "scan.pdf", bytes: createSyntheticPdf({ pageTexts: [""] }), sourceId: "source-test" });

    expect(result.engineName).toBe("ocrmypdf");
    expect(result.evaluation).toMatchObject({ classification: "ocrmypdf-wins", selectedEngine: "ocrmypdf" });
    expect(result.warnings?.at(-1)).toContain("OCR engine comparison: ocrmypdf-wins");
    expect(calls.map((call) => call.command)).toContain("ocrmypdf");
  });

  it("keeps comparison reviewable when OCRmyPDF fails but local Tesseract succeeds", async () => {
    const engine = createComparingPdfOcrEngine({
      runCommand: async (command, args) => {
        if (command === "tesseract" && args[0] === "--version") {
          return { stdout: "tesseract 5.5.1\n", stderr: "" };
        }

        if (command === "pdftoppm" && args[0] === "-v") {
          return { stdout: "", stderr: "pdftoppm version 24.12.0\n" };
        }

        if (command === "pdftoppm") {
          const outputPrefix = args[args.length - 1];
          await writeFile(`${outputPrefix}-1.png`, new Uint8Array([137, 80, 78, 71]));
          return { stdout: "", stderr: "" };
        }

        if (command === "tesseract") {
          return {
            stdout: [
              "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
              "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t87\tFallback",
              "5\t1\t1\t1\t1\t2\t11\t0\t10\t10\t83\ttext",
            ].join("\n"),
            stderr: "",
          };
        }

        if (command === "ocrmypdf" && args[0] === "--version") {
          return { stdout: "16.10.4\n", stderr: "" };
        }

        if (command === "ocrmypdf") {
          throw new Error("generated PDF is invalid");
        }

        throw new Error(`unexpected command ${command}`);
      },
    });

    const result = await engine.recognizePdf({ filename: "scan.pdf", bytes: createSyntheticPdf({ pageTexts: [""] }), sourceId: "source-test" });

    expect(result.engineName).toBe("local-tesseract-poppler");
    expect(result.evaluation).toMatchObject({ classification: "single-engine", selectedEngine: "local-tesseract-poppler" });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("ocrmypdf failed during OCR comparison: generated PDF is invalid")]));
  });

  it("runs queued OCR output through normal document review and corpus readiness", async () => {
    const upload = await queueUploadImport(bytesFileFor("scan.pdf", createSyntheticPdf({ pageTexts: [""] })));
    const engine: OcrEngine = {
      async recognizePdf(input) {
        expect(input.filename).toBe("scan.pdf");
        expect(input.bytes.length).toBeGreaterThan(0);
        return {
          engineName: "test-ocr",
          engineVersion: "1.0.0",
          pages: [
            { pageNumber: 1, text: usableOcrText, confidence: 0.94, quality: assessOcrTextQuality(usableOcrText) },
          ],
          evaluation: {
            selectedEngine: "test-ocr",
            comparedEngines: [{ engineName: "test-ocr", pageCount: 1, extractedPages: 1, averageConfidence: 0.94, averageNoiseRatio: 0, averageReadabilityScore: 0.8, averageChunkabilityScore: 0.6, score: 0.9 }],
            classification: "single-engine",
            rationale: "fixture",
          },
        };
      },
    };

    const result = await runOcrJob(upload.ocrJobIds[0], {
      engine,
      suggest: async () => ({
        suggestionState: "suggested_approve",
        rationale: "OCR text is reviewable.",
        model: "test-review-model",
        promptVersion: "review-import-v1",
        confidence: 0.8,
        metadata: { test: true },
      }),
    });

    expect(result.importJob.status).toBe("ocr_succeeded");
    expect(result.reviewItemIds).toHaveLength(1);
    expect(result.suggestionErrors).toEqual([]);

    const db = openTestDatabase();
    try {
      const corpusRepo = createCorpusRepository(db);
      const reviewRepo = createReviewRepository(db);
      const documents = corpusRepo.listDocumentsForCorpus(upload.source.corpusId);
      const ocrDocument = documents.find((document) => jsonObject(document.provenance).extraction === "ocr");
      expect(ocrDocument).toMatchObject({
        sourceId: upload.source.id,
        sourceFormat: "pdf",
        status: "review_needed",
        provenance: {
          extraction: "ocr",
          ocr: { engine: "test-ocr", engineVersion: "1.0.0", evaluation: { classification: "single-engine", selectedEngine: "test-ocr" } },
          corpusReadiness: { state: "usable", reviewRecommendation: "approve" },
        },
      });
      expect(ocrDocument?.normalizedText).toContain("Page 1\nRecovered scanned PDF text");

      const sections = corpusRepo.listSectionsForDocument(ocrDocument!.id);
      expect(sections).toHaveLength(1);
      expect(sections[0]).toMatchObject({ metadata: { source: "pdf-ocr-page", pageNumber: 1, ocrEngine: "test-ocr", confidence: 0.94 } });
      expect(jsonObject(sections[0].metadata).quality).toMatchObject({ classification: "usable" });

      const reviewItem = reviewRepo.getReviewItem(result.reviewItemIds[0]);
      expect(reviewItem).toMatchObject({ targetType: "document", targetId: ocrDocument?.id, status: "suggested" });
      expect(reviewItem?.metadata).toMatchObject({ adapter: "pdf-ocr", corpusReadiness: { state: "usable" }, ocr: { engine: "test-ocr", evaluation: { classification: "single-engine" } } });
      expect(result.importJob.stats).toMatchObject({ ocrEvaluation: { classification: "single-engine", selectedEngine: "test-ocr" } });

      recordHumanReviewDecision({ reviewItemId: reviewItem!.id, decisionState: "approved", actor: "test-human" });
      expect(corpusRepo.getDocument(ocrDocument!.id)?.status).toBe("indexed");
      expect(corpusRepo.listChunksForDocument(ocrDocument!.id).length).toBeGreaterThan(0);
    } finally {
      closeDatabase(db);
    }
  });

  it("defers OCR output that is present but too thin or weak for corpus approval", async () => {
    const upload = await queueUploadImport(bytesFileFor("thin-scan.pdf", createSyntheticPdf({ pageTexts: [""] })));

    const result = await runOcrJob(upload.ocrJobIds[0], {
      engine: {
        async recognizePdf() {
          return {
            engineName: "test-ocr",
            engineVersion: "1.0.0",
            pages: [
              { pageNumber: 1, text: "tiny text", confidence: null, quality: assessOcrTextQuality("tiny text") },
              { pageNumber: 2, text: "tiny text", confidence: null, quality: assessOcrTextQuality("tiny text") },
            ],
          };
        },
      },
    });

    expect(result.importJob.status).toBe("ocr_deferred");

    const db = openTestDatabase();
    try {
      const corpusRepo = createCorpusRepository(db);
      const ocrDocument = corpusRepo.listDocumentsForCorpus(upload.source.corpusId).find((document) => jsonObject(document.provenance).extraction === "ocr");
      expect(ocrDocument?.provenance).toMatchObject({ corpusReadiness: { state: "deferred", reviewRecommendation: "defer" } });
    } finally {
      closeDatabase(db);
    }
  });

  it("keeps OCR failures observable with a reviewable source item", async () => {
    const upload = await queueUploadImport(bytesFileFor("failed-scan.pdf", createSyntheticPdf({ pageTexts: [""] })));

    const result = await runOcrJob(upload.ocrJobIds[0], {
      engine: {
        async recognizePdf() {
          throw new Error("ocr binary unavailable");
        },
      },
    });

    expect(result.importJob.status).toBe("ocr_failed");
    expect(result.suggestionErrors).toEqual(["ocr binary unavailable"]);
    expect(result.reviewItemIds).toHaveLength(1);

    const db = openTestDatabase();
    try {
      const reviewRepo = createReviewRepository(db);
      const reviewItem = reviewRepo.getReviewItem(result.reviewItemIds[0]);
      expect(reviewItem).toMatchObject({
        targetType: "source",
        status: "pending",
        summary: "ocr failed: ocr binary unavailable",
        metadata: { adapter: "pdf-ocr", ocrStatus: "ocr_failed", error: "ocr binary unavailable" },
      });
    } finally {
      closeDatabase(db);
    }
  });
});
