import type { Database } from "~/lib/db/connection";
import { createCorpusRepository, type Chunk, type DocumentRecord } from "~/lib/corpus/repository";
import { buildChunkDrafts } from "~/lib/chunks/chunker";

export type IndexDocumentResult = {
  documentId: string;
  indexed: boolean;
  chunks: Chunk[];
  reason: "approved" | "not-approved" | "not-corpus-ready";
};

function documentApprovalState(db: Database, documentId: string): "approved" | "rejected" | "deferred" | "pending" | "suggested" | null {
  const row = db.prepare("SELECT status FROM review_items WHERE target_type = 'document' AND target_id = ? ORDER BY updated_at DESC LIMIT 1").get(documentId) as
    | { status: string }
    | undefined;

  return (row?.status as ReturnType<typeof documentApprovalState>) ?? null;
}

function setDocumentStatus(db: Database, documentId: string, status: string): void {
  db.prepare("UPDATE documents SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(status, documentId);
}

function corpusReadinessState(document: DocumentRecord): string | null {
  const provenance = document.provenance;

  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    return null;
  }

  const readiness = provenance.corpusReadiness;

  if (!readiness || typeof readiness !== "object" || Array.isArray(readiness)) {
    return null;
  }

  return typeof readiness.state === "string" ? readiness.state : null;
}

export function removeDocumentChunks(db: Database, documentId: string): void {
  db.prepare("DELETE FROM chunk_fts WHERE document_id = ?").run(documentId);
  db.prepare("DELETE FROM chunks WHERE document_id = ?").run(documentId);
}

function removeChunksByStableIds(db: Database, stableIds: string[]): void {
  if (stableIds.length === 0) return;

  const placeholders = stableIds.map(() => "?").join(", ");
  db.prepare(`DELETE FROM chunk_fts WHERE chunk_id IN (SELECT id FROM chunks WHERE stable_id IN (${placeholders}))`).run(...stableIds);
  db.prepare(`DELETE FROM chunks WHERE stable_id IN (${placeholders})`).run(...stableIds);
}

export function indexApprovedDocument(db: Database, documentId: string): IndexDocumentResult {
  const corpusRepo = createCorpusRepository(db);
  const document = corpusRepo.getDocument(documentId);

  if (!document) {
    throw new Error(`Document ${documentId} was not found.`);
  }

  if (documentApprovalState(db, documentId) !== "approved") {
    removeDocumentChunks(db, documentId);
    return { documentId, indexed: false, chunks: [], reason: "not-approved" };
  }

  const readinessState = corpusReadinessState(document);

  if (readinessState && readinessState !== "usable") {
    removeDocumentChunks(db, documentId);
    setDocumentStatus(db, document.id, readinessState);
    return { documentId, indexed: false, chunks: [], reason: "not-corpus-ready" };
  }

  const sections = corpusRepo.listSectionsForDocument(document.id);
  const drafts = buildChunkDrafts(document, sections);
  const chunks: Chunk[] = [];

  db.exec("BEGIN");
  try {
    removeDocumentChunks(db, document.id);
    removeChunksByStableIds(db, drafts.map((draft) => draft.stableId));

    for (const draft of drafts) {
      const chunk = corpusRepo.createChunk(draft);
      chunks.push(chunk);
      db.prepare("INSERT INTO chunk_fts (chunk_id, corpus_id, document_id, title, heading_path, text) VALUES (?, ?, ?, ?, ?, ?)").run(
        chunk.id,
        chunk.corpusId,
        chunk.documentId,
        document.title,
        chunk.headingPath.join(" > "),
        chunk.text,
      );
    }

    setDocumentStatus(db, document.id, "indexed");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { documentId, indexed: true, chunks, reason: "approved" };
}

export function syncDocumentRetrievability(db: Database, documentId: string): IndexDocumentResult {
  return indexApprovedDocument(db, documentId);
}

export function approvedDocumentForChunk(db: Database, documentId: string): DocumentRecord | null {
  if (documentApprovalState(db, documentId) !== "approved") {
    return null;
  }

  return createCorpusRepository(db).getDocument(documentId);
}
