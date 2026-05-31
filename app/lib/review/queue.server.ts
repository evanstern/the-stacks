import { readFile } from "node:fs/promises";

import { closeDatabase, openDatabase, type Database } from "~/lib/db/connection";
import { runMigrations } from "~/lib/db/migrations";
import type { JsonValue } from "~/lib/db/rows";
import { syncDocumentRetrievability } from "~/lib/chunks/indexer";
import { createCorpusRepository, type ImportJob, type Source } from "~/lib/corpus/repository";
import { doclingPdfImportAdapter, docxImportAdapter, epubImportAdapter, markdownImportAdapter, mobiImportAdapter, pdfImportAdapter, textImportAdapter, type ImportAdapter } from "~/lib/imports/adapters";
import { enqueueOcrJobs } from "~/lib/imports/ocr-queue.server";
import type { CorpusReadiness, NormalizedDocument } from "~/lib/imports/adapters/types";
import { uploadAdapterVersion } from "~/lib/imports/upload";
import { suggestReviewDecision, type ReviewSuggestionDraft, type ReviewSuggestionServiceConfig } from "~/lib/review/llm-suggestions.server";
import { createReviewRepository, type ReviewDecision, type ReviewQueueItem } from "~/lib/review/repository";
import { runReviewSuggestionWorkflow, shouldUseFakeWorkflowProvider } from "~/lib/workflows/review.server";

type QueueImportOptions = {
  suggestionConfig?: ReviewSuggestionServiceConfig;
  suggest?: typeof suggestReviewDecision;
  useWorkflow?: boolean;
};

type QueueImportResult = {
  importJob: ImportJob;
  reviewItemIds: string[];
  suggestionErrors: string[];
  ocrJobIds: string[];
};

const adapters: Record<string, ImportAdapter | undefined> = {
  markdown: markdownImportAdapter,
  text: textImportAdapter,
  epub: epubImportAdapter,
  mobi: mobiImportAdapter,
  pdf: pdfImportAdapter,
  "pdf-docling": doclingPdfImportAdapter,
  docx: docxImportAdapter,
};

function pathFromStorageUri(source: Source): string {
  if (!source.storageUri?.startsWith("file://")) {
    throw new Error(`Source ${source.id} does not have a readable file:// storage URI.`);
  }

  return source.storageUri.slice("file://".length);
}

function summaryForText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 320);
}

function statusForCorpusReadiness(readiness: CorpusReadiness | undefined): string {
  return readiness && readiness.state !== "usable" ? readiness.state : "review_needed";
}

function summaryForReview(text: string, readiness: CorpusReadiness | undefined): string {
  if (readiness && readiness.state !== "usable") {
    return `${readiness.state.replace("_", " ")}: ${readiness.reason}`;
  }

  return summaryForText(text);
}

function deterministicReadinessSuggestion(readiness: CorpusReadiness | undefined): ReviewSuggestionDraft | null {
  if (!readiness || readiness.state === "usable") {
    return null;
  }

  return {
    suggestionState: readiness.reviewRecommendation === "reject" ? "suggested_reject" : "suggested_defer",
    rationale: readiness.reason,
    model: "ikis-readiness-policy",
    promptVersion: "pdf-corpus-readiness-v1",
    confidence: 1,
    metadata: { corpusReadiness: readiness },
  };
}

function ocrProvenanceForReview(provenance: JsonValue): JsonValue | undefined {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    return undefined;
  }

  const ocr = provenance.ocr;
  return ocr && typeof ocr === "object" && !Array.isArray(ocr) ? ocr : undefined;
}

export async function normalizeImportForReview(importJobId: string, options: QueueImportOptions = {}): Promise<QueueImportResult> {
  const prepared = prepareImportForNormalization(importJobId);
  const bytes = new Uint8Array(await readFile(pathFromStorageUri(prepared.source)));
  const normalized = await prepared.adapter.import({ filename: prepared.source.originalFilename, bytes, sourceId: prepared.source.id });
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const importJob = corpusRepo.getImportJob(importJobId) ?? prepared.importJob;
    const source = corpusRepo.getSource(prepared.source.id) ?? prepared.source;
    const persisted = await persistNormalizedDocumentsForReview(db, {
      source,
      importJob,
      adapterName: prepared.adapter.name,
      adapterVersion: prepared.adapter.version,
      documents: normalized.documents,
      options,
    });
    const ocrJobIds = normalized.documents
      .filter((document) => document.sourceFormat === "pdf" && document.corpusReadiness?.state === "ocr_needed")
      .map((document) => {
        const stats = {
          parentImportJobId: importJob.id,
          parserAdapter: prepared.adapter.name,
          parserAdapterVersion: prepared.adapter.version,
          parserReadiness: document.corpusReadiness ?? null,
        };

        return corpusRepo.createImportJob({
          corpusId: source.corpusId,
          sourceId: source.id,
          status: "ocr_queued",
          adapter: "pdf-ocr",
          adapterVersion: "pdf-ocr-v1",
          stats,
        }).id;
      });

    const status = persisted.suggestionErrors.length > 0 ? "failed_review_suggestion" : ocrJobIds.length > 0 ? "ocr_needed" : "review_needed";
    const updatedJob = corpusRepo.updateImportJob({
      id: importJob.id,
      status,
      warnings: normalized.warnings.map((warning) => warning.message),
      errors: persisted.suggestionErrors,
      stats: {
        documents: normalized.documents.length,
        reviewItems: persisted.reviewItemIds.length,
        suggestionErrors: persisted.suggestionErrors.length,
        ocrJobs: ocrJobIds.length,
      },
      finishedAt: new Date().toISOString(),
    });
    corpusRepo.updateSourceStatus(source.id, "review_needed");

    try {
      await enqueueOcrJobs(ocrJobIds);
    } catch (error) {
      console.error("[ocr-queue] enqueue failed; OCR job remains queued in SQLite", {
        importJobId: importJob.id,
        ocrJobIds,
        error: error instanceof Error ? error.message : "Unknown OCR queue enqueue failure.",
      });
    }

    return { importJob: updatedJob, reviewItemIds: persisted.reviewItemIds, suggestionErrors: persisted.suggestionErrors, ocrJobIds };
  } finally {
    closeDatabase(db);
  }
}

function prepareImportForNormalization(importJobId: string): { importJob: ImportJob; source: Source; adapter: ImportAdapter } {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const importJob = corpusRepo.getImportJob(importJobId);

    if (!importJob?.sourceId) {
      throw new Error(`Import job ${importJobId} was not found or has no source.`);
    }

    const source = corpusRepo.getSource(importJob.sourceId);

    if (!source) {
      throw new Error(`Source ${importJob.sourceId} was not found.`);
    }

    const adapter = adapters[source.parserAdapter];

    if (!adapter) {
      throw new Error(`No normalization adapter registered for ${source.parserAdapter}.`);
    }

    corpusRepo.updateImportJob({ id: importJob.id, status: "parsing" });
    return { importJob, source, adapter };
  } finally {
    closeDatabase(db);
  }
}

export async function persistNormalizedDocumentsForReview(
  db: Database,
  input: {
    source: Source;
    importJob: ImportJob;
    adapterName: string;
    adapterVersion: string;
    documents: NormalizedDocument[];
    options?: QueueImportOptions;
  },
): Promise<{ reviewItemIds: string[]; suggestionErrors: string[] }> {
  const corpusRepo = createCorpusRepository(db);
  const reviewRepo = createReviewRepository(db);
  const reviewItemIds: string[] = [];
  const suggestionErrors: string[] = [];
  const suggest = input.options?.suggest ?? suggestReviewDecision;

  for (const normalizedDocument of input.documents) {
    const corpusReadiness = normalizedDocument.corpusReadiness;
    const reviewMetadata = {
      importJobId: input.importJob.id,
      sourceId: input.source.id,
      sourceFilename: input.source.originalFilename,
      adapter: input.adapterName,
      adapterVersion: input.adapterVersion,
      ...(corpusReadiness ? { corpusReadiness } : {}),
      ...(input.adapterName === "pdf-ocr" ? { ocr: ocrProvenanceForReview(normalizedDocument.provenance) } : {}),
    };
    const document = corpusRepo.createDocument({
      corpusId: input.source.corpusId,
      sourceId: input.source.id,
      title: normalizedDocument.title,
      authors: normalizedDocument.authors,
      language: normalizedDocument.language,
      sourceFormat: normalizedDocument.sourceFormat,
      provenance: normalizedDocument.provenance,
      rawMetadata: normalizedDocument.rawMetadata,
      normalizedText: normalizedDocument.normalizedText,
      status: statusForCorpusReadiness(corpusReadiness),
    });

    for (const section of normalizedDocument.sections) {
      corpusRepo.createSection({
        documentId: document.id,
        ordinal: section.ordinal,
        parentSectionId: section.parentSectionId,
        heading: section.heading,
        headingPath: section.headingPath,
        startOffset: section.startOffset,
        endOffset: section.endOffset,
        text: section.text,
        metadata: section.metadata,
      });
    }

    const reviewItem = reviewRepo.createReviewItem({
      corpusId: input.source.corpusId,
      targetType: "document",
      targetId: document.id,
      title: `Review ${document.title}`,
      summary: summaryForReview(document.normalizedText, corpusReadiness),
      metadata: reviewMetadata,
    });
    reviewItemIds.push(reviewItem.id);

    const readinessSuggestion = deterministicReadinessSuggestion(corpusReadiness);

    if (readinessSuggestion) {
      reviewRepo.createSuggestion({
        reviewItemId: reviewItem.id,
        suggestionState: readinessSuggestion.suggestionState,
        rationale: readinessSuggestion.rationale,
        model: readinessSuggestion.model,
        promptVersion: readinessSuggestion.promptVersion,
        confidence: readinessSuggestion.confidence,
        metadata: readinessSuggestion.metadata,
      });
      continue;
    }

    const useWorkflow = input.options?.useWorkflow ?? shouldUseFakeWorkflowProvider();

    try {
      if (useWorkflow) {
        await runReviewSuggestionWorkflow(db, { reviewItemId: reviewItem.id });
      } else {
        const suggestion: ReviewSuggestionDraft = await suggest(
          {
            title: document.title,
            targetType: "document",
            summary: reviewItem.summary,
            normalizedText: document.normalizedText,
            metadata: reviewItem.metadata,
          },
          input.options?.suggestionConfig,
        );

        reviewRepo.createSuggestion({
          reviewItemId: reviewItem.id,
          suggestionState: suggestion.suggestionState,
          rationale: suggestion.rationale,
          model: suggestion.model,
          promptVersion: suggestion.promptVersion,
          confidence: suggestion.confidence,
          metadata: suggestion.metadata,
        });
      }
    } catch (error) {
      suggestionErrors.push(error instanceof Error ? error.message : "Review LLM suggestion failed.");
    }
  }

  return { reviewItemIds, suggestionErrors };
}

export function getReviewQueue(): ReviewQueueItem[] {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const corpus = corpusRepo.getOrCreateDefaultCorpus();
    const reviewRepo = createReviewRepository(db);

    return reviewRepo.listPendingQueue(corpus.id);
  } finally {
    closeDatabase(db);
  }
}

export function recordHumanReviewDecision(input: {
  reviewItemId: string;
  decisionState: ReviewDecision["decisionState"];
  rationale?: string | null;
  actor?: string;
  syncRetrievability?: boolean;
}): ReviewDecision {
  const db = openDatabase();

  try {
    runMigrations(db);
    const reviewRepo = createReviewRepository(db);
    const latestSuggestion = reviewRepo.getLatestSuggestion(input.reviewItemId);

    const decision = reviewRepo.createDecision({
      reviewItemId: input.reviewItemId,
      suggestionId: latestSuggestion?.id ?? null,
      decisionState: input.decisionState,
      rationale: input.rationale ?? null,
      actor: input.actor ?? "local-admin",
      metadata: { source: "review-queue-ui" },
    });

    if (input.syncRetrievability ?? true) {
      syncReviewItemRetrievabilityWithDatabase(db, input.reviewItemId);
    }

    return decision;
  } finally {
    closeDatabase(db);
  }
}

function syncReviewItemRetrievabilityWithDatabase(db: Database, reviewItemId: string): void {
  const reviewItem = createReviewRepository(db).getReviewItem(reviewItemId);

  if (reviewItem?.targetType === "document") {
    syncDocumentRetrievability(db, reviewItem.targetId);
  }
}

export function syncReviewItemRetrievability(reviewItemId: string): void {
  const db = openDatabase();

  try {
    runMigrations(db);
    syncReviewItemRetrievabilityWithDatabase(db, reviewItemId);
  } finally {
    closeDatabase(db);
  }
}

export function createManualReviewItemForSource(sourceId: string): string {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const reviewRepo = createReviewRepository(db);
    const source = corpusRepo.getSource(sourceId);

    if (!source) {
      throw new Error(`Source ${sourceId} was not found.`);
    }

    return reviewRepo.createReviewItem({
      corpusId: source.corpusId,
      targetType: "source",
      targetId: source.id,
      title: `Manual review for ${source.originalFilename}`,
      summary: "LLM normalization did not complete, but this source can still be reviewed manually.",
      metadata: { sourceFilename: source.originalFilename, adapter: source.parserAdapter, adapterVersion: uploadAdapterVersion },
    }).id;
  } finally {
    closeDatabase(db);
  }
}
