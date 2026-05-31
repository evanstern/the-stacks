import { closeDatabase, openDatabase } from "~/lib/db/connection";
import { runMigrations } from "~/lib/db/migrations";
import { createCorpusRepository, type Chunk, type DocumentRecord, type DocumentSection, type ImportJob, type Source } from "~/lib/corpus/repository";
import { createConversationRepository, type Citation, type Message, type RetrievalRun, type WorkflowRun } from "~/lib/conversations/repository";
import { createReviewRepository, type ReviewDecision, type ReviewItem, type ReviewSuggestion } from "~/lib/review/repository";

type Row = Record<string, unknown>;

export type ImportInspection = {
  job: ImportJob;
  source: Source | null;
  documents: DocumentRecord[];
  reviewItems: ReviewItem[];
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

    return { job, source, documents, reviewItems };
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
