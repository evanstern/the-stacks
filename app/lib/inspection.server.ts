import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { closeDatabase, openDatabase } from "~/lib/db/connection";
import { runMigrations } from "~/lib/db/migrations";
import { createCorpusRepository, type Chunk, type DocumentRecord, type DocumentSection, type ImportJob, type ImportJobEvent, type Source } from "~/lib/corpus/repository";
import { createConversationRepository, type Citation, type Message, type RetrievalRun, type WorkflowRun } from "~/lib/conversations/repository";
import { createReviewRepository, type ReviewDecision, type ReviewItem, type ReviewSuggestion } from "~/lib/review/repository";

type Row = Record<string, unknown>;

const rawPreviewBytes = 64 * 1024;

export type RawSourceInspection = {
  storageUri: string | null;
  filePath: string | null;
  readable: boolean;
  sizeBytes: number | null;
  previewText: string | null;
  previewTruncated: boolean;
  message: string;
};

export type ImportInspection = {
  job: ImportJob;
  source: Source | null;
  documents: DocumentRecord[];
  reviewItems: ReviewItem[];
  events: ImportJobEvent[];
};

export type ReviewInspection = {
  item: ReviewItem;
  suggestions: ReviewSuggestion[];
  decisions: ReviewDecision[];
  workflowRuns: WorkflowRun[];
  source: Source | null;
  document: DocumentRecord | null;
};

export type DocumentInspection = {
  document: DocumentRecord;
  source: Source | null;
  sections: DocumentSection[];
  chunks: Chunk[];
};

export type SourceInspection = {
  source: Source;
  importJobs: Array<ImportJob & { events: ImportJobEvent[] }>;
  documents: Array<DocumentRecord & { sections: DocumentSection[]; chunks: Chunk[] }>;
  reviewItems: ReviewItem[];
  rawFile: RawSourceInspection;
};

export type RetrievalTraceInspection = {
  run: RetrievalRun;
  message: Message | null;
  citations: Array<Citation & { chunk: Chunk | null; document: DocumentRecord | null; source: Source | null }>;
};

function listDocumentsForSource(sourceId: string): DocumentRecord[] {
  const db = openDatabase();
  try {
    runMigrations(db);
    return (db.prepare("SELECT id FROM documents WHERE source_id = ? ORDER BY created_at, title").all(sourceId) as Row[]).flatMap((row) => {
      const document = createCorpusRepository(db).getDocument(row.id as string);
      return document ? [document] : [];
    });
  } finally {
    closeDatabase(db);
  }
}

function isTextPreviewCandidate(source: Source, filePath: string): boolean {
  const lowerName = source.originalFilename.toLowerCase();
  const mimeType = source.mimeType?.toLowerCase() ?? "";
  return (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("markdown") ||
    [".json", ".md", ".markdown", ".txt"].some((extension) => lowerName.endsWith(extension)) ||
    filePath.endsWith(".json") ||
    filePath.endsWith(".md") ||
    filePath.endsWith(".markdown") ||
    filePath.endsWith(".txt")
  );
}

function inspectRawSourceFile(source: Source): RawSourceInspection {
  if (!source.storageUri) {
    return {
      storageUri: null,
      filePath: null,
      readable: false,
      sizeBytes: null,
      previewText: null,
      previewTruncated: false,
      message: "No storage URI is recorded for this source.",
    };
  }

  if (!source.storageUri.startsWith("file://")) {
    return {
      storageUri: source.storageUri,
      filePath: null,
      readable: false,
      sizeBytes: null,
      previewText: null,
      previewTruncated: false,
      message: "Only file:// source previews are supported in this inspection view.",
    };
  }

  try {
    const filePath = fileURLToPath(source.storageUri);
    const stat = statSync(filePath);
    const textCandidate = isTextPreviewCandidate(source, filePath.toLowerCase());

    if (!textCandidate) {
      return {
        storageUri: source.storageUri,
        filePath,
        readable: true,
        sizeBytes: stat.size,
        previewText: null,
        previewTruncated: false,
        message: "Raw file appears binary or non-text; showing file metadata and normalized extracted material instead.",
      };
    }

    const preview = readFileSync(filePath, { encoding: "utf8", flag: "r" }).slice(0, rawPreviewBytes);

    return {
      storageUri: source.storageUri,
      filePath,
      readable: true,
      sizeBytes: stat.size,
      previewText: preview,
      previewTruncated: stat.size > rawPreviewBytes,
      message: stat.size > rawPreviewBytes ? `Showing the first ${rawPreviewBytes} characters from the raw text file.` : "Showing raw text file contents.",
    };
  } catch (error) {
    return {
      storageUri: source.storageUri,
      filePath: null,
      readable: false,
      sizeBytes: null,
      previewText: null,
      previewTruncated: false,
      message: error instanceof Error ? error.message : "Raw source file could not be read.",
    };
  }
}

export function getImportInspection(importJobId: string): ImportInspection | null {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const reviewRepo = createReviewRepository(db);
    const job = corpusRepo.getImportJob(importJobId);

    if (!job) {
      return null;
    }

    const source = job.sourceId ? corpusRepo.getSource(job.sourceId) : null;
    const documents = source ? (db.prepare("SELECT id FROM documents WHERE source_id = ? ORDER BY created_at, title").all(source.id) as Row[]).flatMap((row) => {
      const document = corpusRepo.getDocument(row.id as string);
      return document ? [document] : [];
    }) : [];
    const reviewItems = reviewRepo.listReviewItems(job.corpusId).filter((item) => {
      if (item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) && "importJobId" in item.metadata) {
        return item.metadata.importJobId === job.id;
      }

      return source ? item.targetId === source.id || documents.some((document) => document.id === item.targetId) : false;
    });

    return { job, source, documents, reviewItems, events: corpusRepo.listImportJobEvents(job.id) };
  } finally {
    closeDatabase(db);
  }
}

export function getReviewInspection(reviewItemId: string): ReviewInspection | null {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const reviewRepo = createReviewRepository(db);
    const conversationRepo = createConversationRepository(db);
    const item = reviewRepo.getReviewItem(reviewItemId);

    if (!item) {
      return null;
    }

    const document = item.targetType === "document" ? corpusRepo.getDocument(item.targetId) : null;
    const source = item.targetType === "source" ? corpusRepo.getSource(item.targetId) : document ? corpusRepo.getSource(document.sourceId) : null;

    return {
      item,
      suggestions: reviewRepo.listSuggestions(item.id),
      decisions: reviewRepo.listDecisions(item.id),
      workflowRuns: conversationRepo.listWorkflowRunsForTarget({ targetType: "review_item", targetId: item.id }),
      source,
      document,
    };
  } finally {
    closeDatabase(db);
  }
}

export function getDocumentInspection(documentId: string): DocumentInspection | null {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const document = corpusRepo.getDocument(documentId);

    if (!document) {
      return null;
    }

    return {
      document,
      source: corpusRepo.getSource(document.sourceId),
      sections: corpusRepo.listSectionsForDocument(document.id),
      chunks: corpusRepo.listChunksForDocument(document.id),
    };
  } finally {
    closeDatabase(db);
  }
}

export function getSourceInspection(sourceId: string): SourceInspection | null {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const reviewRepo = createReviewRepository(db);
    const source = corpusRepo.getSource(sourceId);

    if (!source) {
      return null;
    }

    const documents = (db.prepare("SELECT id FROM documents WHERE source_id = ? ORDER BY created_at, title").all(source.id) as Row[]).flatMap((row) => {
      const document = corpusRepo.getDocument(row.id as string);
      if (!document) {
        return [];
      }

      return [{
        ...document,
        sections: corpusRepo.listSectionsForDocument(document.id),
        chunks: corpusRepo.listChunksForDocument(document.id),
      }];
    });
    const reviewItems = reviewRepo.listReviewItems(source.corpusId).filter((item) => {
      if (item.targetId === source.id) {
        return true;
      }

      return documents.some((document) => document.id === item.targetId || document.sections.some((section) => section.id === item.targetId));
    });

    return {
      source,
      importJobs: corpusRepo.listImportJobsForSource(source.id).map((job) => ({ ...job, events: corpusRepo.listImportJobEvents(job.id) })),
      documents,
      reviewItems,
      rawFile: inspectRawSourceFile(source),
    };
  } finally {
    closeDatabase(db);
  }
}

export function getRetrievalTraceInspection(retrievalRunId: string): RetrievalTraceInspection | null {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const conversationRepo = createConversationRepository(db);
    const run = conversationRepo.getRetrievalRun(retrievalRunId);

    if (!run) {
      return null;
    }

    return {
      run,
      message: run.messageId ? conversationRepo.getMessage(run.messageId) : null,
      citations: conversationRepo.listCitations(run.id).map((citation) => ({
        ...citation,
        chunk: citation.chunkId ? corpusRepo.getChunk(citation.chunkId) : null,
        document: citation.documentId ? corpusRepo.getDocument(citation.documentId) : null,
        source: citation.sourceId ? corpusRepo.getSource(citation.sourceId) : null,
      })),
    };
  } finally {
    closeDatabase(db);
  }
}

export { listDocumentsForSource };
