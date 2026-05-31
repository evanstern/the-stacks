import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { closeDatabase, openDatabase } from "~/lib/db/connection";
import { runMigrations } from "~/lib/db/migrations";
import { createCorpusRepository, type ImportJob } from "~/lib/corpus/repository";
import { normalizePdfOcrDocument, type PdfOcrPage, type PdfOcrQualityMetrics } from "~/lib/imports/adapters/pdf";
import type { JsonValue } from "~/lib/db/rows";
import { persistNormalizedDocumentsForReview } from "~/lib/review/queue.server";
import { createReviewRepository } from "~/lib/review/repository";
import type { ReviewSuggestionServiceConfig } from "~/lib/review/llm-suggestions.server";
import { suggestReviewDecision } from "~/lib/review/llm-suggestions.server";

export type OcrTerminalState = "deferred" | "rejected";

export type OcrEngineResult = {
  engineName: string;
  engineVersion?: string | null;
  pages: PdfOcrPage[];
  warnings?: string[];
  terminalState?: OcrTerminalState;
  evaluation?: OcrEvaluationSummary;
};

export type OcrEngine = {
  recognizePdf(input: { filename: string; bytes: Uint8Array; sourceId: string }): Promise<OcrEngineResult>;
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export type LocalPdfOcrEngineOptions = {
  runCommand?: CommandRunner;
  language?: string;
  density?: number;
  ocrMyPdfMode?: OcrMyPdfMode;
};

export type OcrEngineName = "local-tesseract-poppler" | "ocrmypdf" | "compare-local-ocrmypdf";
export type OcrMyPdfMode = "skip-text" | "redo-ocr" | "force-ocr";

export type OcrEvaluationSummary = {
  selectedEngine: string;
  comparedEngines: Array<{
    engineName: string;
    engineVersion?: string | null;
    pageCount: number;
    extractedPages: number;
    averageConfidence: number | null;
    averageNoiseRatio: number | null;
    averageReadabilityScore: number | null;
    averageChunkabilityScore: number | null;
    score: number;
  }>;
  classification: "ocrmypdf-wins" | "local-tesseract-poppler-wins" | "tie" | "single-engine";
  rationale: string;
};

export type RunOcrJobOptions = {
  engine?: OcrEngine;
  suggestionConfig?: ReviewSuggestionServiceConfig;
  suggest?: typeof suggestReviewDecision;
  useWorkflow?: boolean;
};

export type RunOcrJobResult = {
  importJob: ImportJob;
  reviewItemIds: string[];
  suggestionErrors: string[];
};

const defaultOcrEngine = createConfiguredPdfOcrEngine();

function configuredCommandTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.IKIS_OCR_COMMAND_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
}

function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeoutMs = configuredCommandTimeoutMs();
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${timeoutMs}ms for local PDF OCR.`));
    }, timeoutMs);

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      callback();
    };

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => settle(() => reject(new Error(`${command} is not available for local PDF OCR: ${error.message}`))));
    child.on("close", (code) => {
      const result = { stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") };

      if (code === 0) {
        settle(() => resolve(result));
        return;
      }

      settle(() => reject(new Error(`${command} failed for local PDF OCR with exit code ${code ?? "unknown"}: ${result.stderr.trim() || result.stdout.trim() || "no output"}`)));
    });
  });
}

function parseVersion(output: string): string | null {
  const firstLine = output.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim();
  return firstLine ?? null;
}

function pageNumberFromRenderedImage(filename: string): number | null {
  const match = /-(\d+)\.png$/i.exec(filename);
  return match ? Number(match[1]) : null;
}

function textFromTsv(tsv: string): { text: string; confidence: number | null } {
  const lines = tsv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const words: string[] = [];
  const confidences: number[] = [];

  for (const line of lines.slice(1)) {
    const columns = line.split("\t");
    const confidence = Number(columns[10]);
    const text = columns.slice(11).join("\t").trim();

    if (text.length > 0) {
      words.push(text);
    }

    if (Number.isFinite(confidence) && confidence >= 0) {
      confidences.push(confidence / 100);
    }
  }

  return {
    text: words.join(" "),
    confidence: confidences.length > 0 ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null,
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function wordsIn(text: string): string[] {
  return Array.from(text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu), (match) => match[0]);
}

export function assessOcrTextQuality(text: string): PdfOcrQualityMetrics {
  const normalized = text.replace(/\s+/g, " ").trim();
  const words = wordsIn(normalized);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  const characterCount = normalized.length;
  const wordCount = words.length;
  const averageWordLength = wordCount > 0 ? words.reduce((sum, word) => sum + word.length, 0) / wordCount : 0;
  const suspiciousCharacters = Array.from(normalized).filter((character) => !/[\p{L}\p{N}\s.,;:'"’“”!?()\[\]{}\-–—/&%$#@*+_=<>]/u.test(character)).length;
  const oneCharacterWords = words.filter((word) => word.length === 1).length;
  const noiseRatio = characterCount > 0 ? clamp((suspiciousCharacters + oneCharacterWords * 0.5) / characterCount) : 1;
  const lineCounts = new Map<string, number>();

  for (const line of lines) {
    lineCounts.set(line, (lineCounts.get(line) ?? 0) + 1);
  }

  const repeatedLineRatio = lines.length > 0 ? Array.from(lineCounts.values()).filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0) / lines.length : 0;
  const shortLineRatio = lines.length > 0 ? lines.filter((line) => wordsIn(line).length <= 2).length / lines.length : 1;
  const longEnoughWords = wordCount > 0 ? words.filter((word) => word.length >= 3).length / wordCount : 0;
  const readabilityScore = clamp(longEnoughWords * 0.65 + (1 - noiseRatio) * 0.25 + (1 - repeatedLineRatio) * 0.1);
  const chunkabilityScore = clamp(Math.min(wordCount / 80, 1) * 0.55 + (1 - shortLineRatio) * 0.25 + readabilityScore * 0.2);
  const classification = noiseRatio > 0.18 || readabilityScore < 0.38 ? "noisy" : chunkabilityScore < 0.45 ? "weak" : "usable";

  return {
    characterCount,
    wordCount,
    averageWordLength,
    noiseRatio,
    repeatedLineRatio,
    shortLineRatio,
    readabilityScore,
    chunkabilityScore,
    classification,
  };
}

function splitOcrmyPdfSidecar(text: string): PdfOcrPage[] {
  return text
    .split("\f")
    .map((pageText, index) => ({ pageNumber: index + 1, text: pageText.trim(), confidence: null, quality: assessOcrTextQuality(pageText) }))
    .filter((page, index, pages) => page.text.length > 0 || index < pages.length - 1);
}

export function createLocalPdfOcrEngine(options: LocalPdfOcrEngineOptions = {}): OcrEngine {
  const execute = options.runCommand ?? runCommand;
  const language = options.language ?? process.env.IKIS_OCR_LANGUAGE ?? "eng";
  const density = options.density ?? Number(process.env.IKIS_OCR_DENSITY ?? 200);

  return {
    async recognizePdf(input): Promise<OcrEngineResult> {
      const workDir = await mkdtemp(join(tmpdir(), "ikis-pdf-ocr-"));

      try {
        const pdfPath = join(workDir, "source.pdf");
        const imagePrefix = join(workDir, "page");
        await writeFile(pdfPath, input.bytes);

        const [tesseractVersion, pdftoppmVersion] = await Promise.all([
          execute("tesseract", ["--version"]),
          execute("pdftoppm", ["-v"]),
        ]);

        await execute("pdftoppm", ["-r", String(Number.isFinite(density) && density > 0 ? density : 200), "-png", pdfPath, imagePrefix]);

        const renderedImages = (await readdir(workDir))
          .map((filename) => ({ filename, pageNumber: pageNumberFromRenderedImage(filename) }))
          .filter((image): image is { filename: string; pageNumber: number } => image.pageNumber !== null)
          .sort((left, right) => left.pageNumber - right.pageNumber);

        if (renderedImages.length === 0) {
          return {
            engineName: "local-tesseract-poppler",
            engineVersion: parseVersion(tesseractVersion.stdout || tesseractVersion.stderr),
            pages: [],
            warnings: ["PDF rendering produced no page images for OCR."],
            terminalState: "rejected",
          };
        }

        const pages: PdfOcrPage[] = [];
        const warnings: string[] = [];

        for (const image of renderedImages) {
          const imagePath = join(workDir, image.filename);
          const recognized = await execute("tesseract", [imagePath, "stdout", "-l", language, "--psm", "6", "tsv"]);
          const page = textFromTsv(recognized.stdout);
          pages.push({ pageNumber: image.pageNumber, text: page.text, confidence: page.confidence, quality: assessOcrTextQuality(page.text) });

          if (recognized.stderr.trim().length > 0) {
            warnings.push(`Page ${image.pageNumber}: ${recognized.stderr.trim()}`);
          }
        }

        return {
          engineName: "local-tesseract-poppler",
          engineVersion: parseVersion(tesseractVersion.stdout || tesseractVersion.stderr),
          pages,
          warnings: [
            `Rendered PDF pages with ${parseVersion(pdftoppmVersion.stdout || pdftoppmVersion.stderr) ?? "pdftoppm"}.`,
            ...warnings,
          ],
        };
      } finally {
        await rm(workDir, { recursive: true, force: true });
      }
    },
  };
}

export function createOcrMyPdfEngine(options: LocalPdfOcrEngineOptions = {}): OcrEngine {
  const execute = options.runCommand ?? runCommand;
  const language = options.language ?? process.env.IKIS_OCR_LANGUAGE ?? "eng";
  const mode = options.ocrMyPdfMode ?? configuredOcrMyPdfMode();

  return {
    async recognizePdf(input): Promise<OcrEngineResult> {
      const workDir = await mkdtemp(join(tmpdir(), "ikis-ocrmypdf-"));

      try {
        const pdfPath = join(workDir, "source.pdf");
        const outputPdfPath = join(workDir, "ocr.pdf");
        const sidecarPath = join(workDir, "sidecar.txt");
        await writeFile(pdfPath, input.bytes);

        const version = await execute("ocrmypdf", ["--version"]);
        const recognized = await execute("ocrmypdf", [`--${mode}`, "--output-type", "pdf", "--sidecar", sidecarPath, "-l", language, pdfPath, outputPdfPath]);
        const sidecar = await readFile(sidecarPath, "utf8");
        const pages = splitOcrmyPdfSidecar(sidecar);

        return {
          engineName: "ocrmypdf",
          engineVersion: parseVersion(version.stdout || version.stderr),
          pages,
          warnings: recognized.stderr.trim().length > 0 ? [recognized.stderr.trim()] : [],
        };
      } finally {
        await rm(workDir, { recursive: true, force: true });
      }
    },
  };
}

function configuredOcrMyPdfMode(env: NodeJS.ProcessEnv = process.env): OcrMyPdfMode {
  const mode = env.IKIS_OCRMYPDF_MODE?.trim() || "force-ocr";

  if (mode === "skip-text" || mode === "redo-ocr" || mode === "force-ocr") {
    return mode;
  }

  throw new Error(`Unsupported IKIS_OCRMYPDF_MODE ${mode}. Use skip-text, redo-ocr, or force-ocr.`);
}

function summarizeOcrResult(result: OcrEngineResult): OcrEvaluationSummary["comparedEngines"][number] {
  const pagesWithText = result.pages.filter((page) => page.text.trim().length > 0);
  const averageConfidence = average(pagesWithText.map((page) => page.confidence).filter((confidence): confidence is number => typeof confidence === "number"));
  const averageNoiseRatio = average(pagesWithText.map((page) => page.quality?.noiseRatio).filter((value): value is number => typeof value === "number"));
  const averageReadabilityScore = average(pagesWithText.map((page) => page.quality?.readabilityScore).filter((value): value is number => typeof value === "number"));
  const averageChunkabilityScore = average(pagesWithText.map((page) => page.quality?.chunkabilityScore).filter((value): value is number => typeof value === "number"));
  const extractionCoverage = result.pages.length > 0 ? pagesWithText.length / result.pages.length : 0;
  const confidenceScore = averageConfidence ?? 0.55;
  const score = clamp(extractionCoverage * 0.25 + confidenceScore * 0.2 + (1 - (averageNoiseRatio ?? 0.5)) * 0.2 + (averageReadabilityScore ?? 0) * 0.2 + (averageChunkabilityScore ?? 0) * 0.15);

  return {
    engineName: result.engineName,
    engineVersion: result.engineVersion,
    pageCount: result.pages.length,
    extractedPages: pagesWithText.length,
    averageConfidence,
    averageNoiseRatio,
    averageReadabilityScore,
    averageChunkabilityScore,
    score,
  };
}

export function evaluateOcrEngineResults(results: OcrEngineResult[]): OcrEvaluationSummary {
  const comparedEngines = results.map(summarizeOcrResult).sort((left, right) => right.score - left.score);
  const [best, runnerUp] = comparedEngines;
  const delta = best && runnerUp ? best.score - runnerUp.score : 0;
  const classification = comparedEngines.length < 2
    ? "single-engine"
    : delta < 0.05
      ? "tie"
      : best.engineName === "ocrmypdf"
        ? "ocrmypdf-wins"
        : "local-tesseract-poppler-wins";

  return {
    selectedEngine: best?.engineName ?? "none",
    comparedEngines,
    classification,
    rationale: comparedEngines.length < 2
      ? "Only one OCR engine result was available for evaluation."
      : `${best.engineName} scored ${best.score.toFixed(3)} versus ${runnerUp.engineName} at ${runnerUp.score.toFixed(3)} across extraction coverage, confidence, noise, readability, and chunkability.`,
  };
}

export function createComparingPdfOcrEngine(options: LocalPdfOcrEngineOptions = {}): OcrEngine {
  const localEngine = createLocalPdfOcrEngine(options);
  const ocrMyPdfEngine = createOcrMyPdfEngine(options);

  return {
    async recognizePdf(input): Promise<OcrEngineResult> {
      const [localSettled, ocrMyPdfSettled] = await Promise.allSettled([localEngine.recognizePdf(input), ocrMyPdfEngine.recognizePdf(input)]);
      const results = [localSettled, ocrMyPdfSettled]
        .filter((settled): settled is PromiseFulfilledResult<OcrEngineResult> => settled.status === "fulfilled")
        .map((settled) => settled.value);
      const failures = [
        { engineName: "local-tesseract-poppler", settled: localSettled },
        { engineName: "ocrmypdf", settled: ocrMyPdfSettled },
      ].flatMap(({ engineName, settled }) => settled.status === "rejected"
        ? [`${engineName} failed during OCR comparison: ${settled.reason instanceof Error ? settled.reason.message : "unknown OCR error"}`]
        : []);

      if (results.length === 0) {
        throw new Error(failures.join("; ") || "All OCR engines failed during comparison.");
      }

      const evaluation = evaluateOcrEngineResults(results);
      const selected = results.find((result) => result.engineName === evaluation.selectedEngine) ?? results[0];

      return {
        ...selected,
        warnings: [
          ...(selected.warnings ?? []),
          ...failures,
          `OCR engine comparison: ${evaluation.classification}; ${evaluation.rationale}`,
        ],
        evaluation,
      };
    },
  };
}

export function createConfiguredPdfOcrEngine(env: NodeJS.ProcessEnv = process.env): OcrEngine {
  const engineName = (env.IKIS_OCR_ENGINE?.trim() || "local-tesseract-poppler") as OcrEngineName;

  if (engineName === "ocrmypdf") {
    return createOcrMyPdfEngine();
  }

  if (engineName === "compare-local-ocrmypdf") {
    return createComparingPdfOcrEngine();
  }

  if (engineName !== "local-tesseract-poppler") {
    throw new Error(`Unsupported IKIS_OCR_ENGINE ${engineName}. Use local-tesseract-poppler, ocrmypdf, or compare-local-ocrmypdf.`);
  }

  return createLocalPdfOcrEngine();
}

function pathFromStorageUri(storageUri: string | null): string {
  if (!storageUri?.startsWith("file://")) {
    throw new Error("OCR source does not have a readable file:// storage URI.");
  }

  return storageUri.slice("file://".length);
}

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectStats(value: JsonValue): { [key: string]: JsonValue } {
  return isObject(value) ? value : {};
}

function statusForOcrOutput(result: OcrEngineResult): "ocr_succeeded" | "ocr_deferred" | "ocr_rejected" {
  if (result.terminalState === "rejected") {
    return "ocr_rejected";
  }

  if (result.terminalState === "deferred") {
    return "ocr_deferred";
  }

  return "ocr_succeeded";
}

export async function runOcrJob(importJobId: string, options: RunOcrJobOptions = {}): Promise<RunOcrJobResult> {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const reviewRepo = createReviewRepository(db);
    const importJob = corpusRepo.getImportJob(importJobId);

    if (!importJob?.sourceId) {
      throw new Error(`OCR import job ${importJobId} was not found or has no source.`);
    }

    if (importJob.adapter !== "pdf-ocr") {
      throw new Error(`Import job ${importJob.id} uses ${importJob.adapter}, not pdf-ocr.`);
    }

    const source = corpusRepo.getSource(importJob.sourceId);

    if (!source) {
      throw new Error(`Source ${importJob.sourceId} was not found.`);
    }

    corpusRepo.updateImportJob({ id: importJob.id, status: "ocr_running" });

    try {
      const bytes = new Uint8Array(await readFile(pathFromStorageUri(source.storageUri)));
      const result = await (options.engine ?? defaultOcrEngine).recognizePdf({ filename: source.originalFilename, bytes, sourceId: source.id });
      const existingStats = objectStats(importJob.stats);
      const parserReadiness = existingStats.parserReadiness;
      const normalizedDocument = normalizePdfOcrDocument({
        filename: source.originalFilename,
        sourceId: source.id,
        engineName: result.engineName,
        engineVersion: result.engineVersion ?? null,
        pages: result.pages,
        evaluation: result.evaluation ?? null,
        parserEvidence: isObject(parserReadiness) ? parserReadiness.evidence : undefined,
      });
      const outputStatus = statusForOcrOutput(result);
      const ocrStatus = outputStatus === "ocr_succeeded" && normalizedDocument.corpusReadiness?.state !== "usable"
        ? "ocr_deferred"
        : outputStatus;
      const persisted = outputStatus === "ocr_rejected"
        ? {
          reviewItemIds: [reviewRepo.createReviewItem({
            corpusId: source.corpusId,
            targetType: "source",
            targetId: `${source.id}:ocr:${importJob.id}`,
            title: `OCR review for ${source.originalFilename}`,
            summary: "ocr rejected: OCR could not recover useful text for this PDF under the supported fallback path.",
            metadata: {
              importJobId: importJob.id,
              sourceId: source.id,
              sourceFilename: source.originalFilename,
              adapter: "pdf-ocr",
              adapterVersion: importJob.adapterVersion,
              ocrStatus: "ocr_rejected",
              corpusReadiness: normalizedDocument.corpusReadiness ?? null,
            },
          }).id],
          suggestionErrors: [],
        }
        : await persistNormalizedDocumentsForReview(db, {
          source,
          importJob,
          adapterName: "pdf-ocr",
          adapterVersion: importJob.adapterVersion,
          documents: [normalizedDocument],
          options,
        });
      const updatedJob = corpusRepo.updateImportJob({
        id: importJob.id,
        status: ocrStatus,
        warnings: result.warnings ?? [],
        errors: persisted.suggestionErrors,
        stats: {
          ...existingStats,
          ocrEngine: result.engineName,
          ocrEngineVersion: result.engineVersion ?? null,
          ocrEvaluation: result.evaluation ?? null,
          pages: result.pages.length,
          extractedPages: result.pages.filter((page) => page.text.trim().length > 0).map((page) => page.pageNumber),
          corpusReadiness: normalizedDocument.corpusReadiness ?? null,
          reviewItems: persisted.reviewItemIds.length,
          suggestionErrors: persisted.suggestionErrors.length,
        },
        finishedAt: new Date().toISOString(),
      });
      corpusRepo.updateSourceStatus(source.id, "review_needed");

      return { importJob: updatedJob, reviewItemIds: persisted.reviewItemIds, suggestionErrors: persisted.suggestionErrors };
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF OCR failed.";
      const reviewItem = reviewRepo.createReviewItem({
        corpusId: source.corpusId,
        targetType: "source",
        targetId: `${source.id}:ocr:${importJob.id}`,
        title: `OCR review for ${source.originalFilename}`,
        summary: `ocr failed: ${message}`,
        metadata: {
          importJobId: importJob.id,
          sourceId: source.id,
          sourceFilename: source.originalFilename,
          adapter: "pdf-ocr",
          adapterVersion: importJob.adapterVersion,
          ocrStatus: "ocr_failed",
          error: message,
        },
      });
      const failedJob = corpusRepo.updateImportJob({
        id: importJob.id,
        status: "ocr_failed",
        errors: [message],
        stats: { ...objectStats(importJob.stats), failure: message },
        finishedAt: new Date().toISOString(),
      });

      corpusRepo.updateSourceStatus(source.id, "review_needed");

      return { importJob: failedJob, reviewItemIds: [reviewItem.id], suggestionErrors: [message] };
    }
  } finally {
    closeDatabase(db);
  }
}
