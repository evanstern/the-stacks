import type { Database } from "../db/connection.js";
import { createId, parseJson, stringifyJson, type JsonValue } from "../db/rows.js";

export type Corpus = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Source = {
  id: string;
  corpusId: string;
  fileHash: string;
  sourceKind: string;
  originalFilename: string;
  mimeType: string | null;
  sizeBytes: number;
  parserAdapter: string;
  parserVersion: string;
  importStatus: string;
  version: number;
  supersedesSourceId: string | null;
  storageUri: string | null;
  metadata: JsonValue;
  createdAt: string;
  updatedAt: string;
};

export type DocumentRecord = {
  id: string;
  corpusId: string;
  sourceId: string;
  title: string;
  authors: string[];
  language: string | null;
  sourceFormat: string;
  provenance: JsonValue;
  rawMetadata: JsonValue;
  normalizedText: string;
  status: string;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentSection = {
  id: string;
  documentId: string;
  parentSectionId: string | null;
  ordinal: number;
  heading: string | null;
  headingPath: string[];
  startOffset: number;
  endOffset: number;
  text: string;
  metadata: JsonValue;
  createdAt: string;
};

export type Chunk = {
  id: string;
  corpusId: string;
  documentId: string;
  sectionId: string | null;
  ordinal: number;
  stableId: string;
  startOffset: number;
  endOffset: number;
  headingPath: string[];
  text: string;
  contentHash: string;
  metadata: JsonValue;
  createdAt: string;
  updatedAt: string;
};

export type ImportJob = {
  id: string;
  corpusId: string;
  sourceId: string | null;
  status: string;
  adapter: string;
  adapterVersion: string;
  warnings: string[];
  errors: string[];
  stats: JsonValue;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportJobEvent = {
  id: string;
  importJobId: string;
  eventType: string;
  message: string;
  progressPct: number | null;
  payload: JsonValue;
  createdAt: string;
};

type Row = Record<string, unknown>;

function mapCorpus(row: Row): Corpus {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapSource(row: Row): Source {
  return {
    id: row.id as string,
    corpusId: row.corpus_id as string,
    fileHash: row.file_hash as string,
    sourceKind: row.source_kind as string,
    originalFilename: row.original_filename as string,
    mimeType: (row.mime_type as string | null) ?? null,
    sizeBytes: row.size_bytes as number,
    parserAdapter: row.parser_adapter as string,
    parserVersion: row.parser_version as string,
    importStatus: row.import_status as string,
    version: row.version as number,
    supersedesSourceId: (row.supersedes_source_id as string | null) ?? null,
    storageUri: (row.storage_uri as string | null) ?? null,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapDocument(row: Row): DocumentRecord {
  return {
    id: row.id as string,
    corpusId: row.corpus_id as string,
    sourceId: row.source_id as string,
    title: row.title as string,
    authors: parseJson(row.authors_json, []),
    language: (row.language as string | null) ?? null,
    sourceFormat: row.source_format as string,
    provenance: parseJson(row.provenance_json, {}),
    rawMetadata: parseJson(row.raw_metadata_json, {}),
    normalizedText: row.normalized_text as string,
    status: row.status as string,
    contentHash: (row.content_hash as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapSection(row: Row): DocumentSection {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    parentSectionId: (row.parent_section_id as string | null) ?? null,
    ordinal: row.ordinal as number,
    heading: (row.heading as string | null) ?? null,
    headingPath: parseJson(row.heading_path_json, []),
    startOffset: row.start_offset as number,
    endOffset: row.end_offset as number,
    text: row.text as string,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at as string,
  };
}

function mapChunk(row: Row): Chunk {
  return {
    id: row.id as string,
    corpusId: row.corpus_id as string,
    documentId: row.document_id as string,
    sectionId: (row.section_id as string | null) ?? null,
    ordinal: row.ordinal as number,
    stableId: row.stable_id as string,
    startOffset: row.start_offset as number,
    endOffset: row.end_offset as number,
    headingPath: parseJson(row.heading_path_json, []),
    text: row.text as string,
    contentHash: row.content_hash as string,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapImportJob(row: Row): ImportJob {
  return {
    id: row.id as string,
    corpusId: row.corpus_id as string,
    sourceId: (row.source_id as string | null) ?? null,
    status: row.status as string,
    adapter: row.adapter as string,
    adapterVersion: row.adapter_version as string,
    warnings: parseJson(row.warnings_json, []),
    errors: parseJson(row.errors_json, []),
    stats: parseJson(row.stats_json, {}),
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapImportJobEvent(row: Row): ImportJobEvent {
  return {
    id: row.id as string,
    importJobId: row.import_job_id as string,
    eventType: row.event_type as string,
    message: row.message as string,
    progressPct: (row.progress_pct as number | null) ?? null,
    payload: parseJson(row.payload_json, {}),
    createdAt: row.created_at as string,
  };
}

export function createCorpusRepository(db: Database) {
  return {
    createCorpus(input: { id?: string; name: string; description?: string | null }): Corpus {
      const id = input.id ?? createId("corpus");
      db.prepare("INSERT INTO corpora (id, name, description) VALUES (?, ?, ?)").run(id, input.name, input.description ?? null);
      return this.getCorpus(id)!;
    },

    getCorpus(id: string): Corpus | null {
      const row = db.prepare("SELECT * FROM corpora WHERE id = ?").get(id) as Row | undefined;
      return row ? mapCorpus(row) : null;
    },

    listCorpora(): Corpus[] {
      return (db.prepare("SELECT * FROM corpora ORDER BY created_at, name").all() as Row[]).map(mapCorpus);
    },

    getOrCreateDefaultCorpus(): Corpus {
      const existing = db.prepare("SELECT * FROM corpora ORDER BY created_at, name LIMIT 1").get() as Row | undefined;

      if (existing) {
        return mapCorpus(existing);
      }

      return this.createCorpus({ name: "ikis.ai workspace", description: "Default self-hosted corpus workspace" });
    },

    createSource(input: {
      id?: string;
      corpusId: string;
      fileHash: string;
      sourceKind: string;
      originalFilename: string;
      mimeType?: string | null;
      sizeBytes: number;
      parserAdapter: string;
      parserVersion: string;
      importStatus: string;
      version?: number;
      supersedesSourceId?: string | null;
      storageUri?: string | null;
      metadata?: JsonValue;
    }): Source {
      const id = input.id ?? createId("source");
      db.prepare(`
        INSERT INTO sources (
          id, corpus_id, file_hash, source_kind, original_filename, mime_type, size_bytes,
          parser_adapter, parser_version, import_status, version, supersedes_source_id, storage_uri, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.corpusId,
        input.fileHash,
        input.sourceKind,
        input.originalFilename,
        input.mimeType ?? null,
        input.sizeBytes,
        input.parserAdapter,
        input.parserVersion,
        input.importStatus,
        input.version ?? 1,
        input.supersedesSourceId ?? null,
        input.storageUri ?? null,
        stringifyJson(input.metadata, {}),
      );
      return this.getSource(id)!;
    },

    getSource(id: string): Source | null {
      const row = db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as Row | undefined;
      return row ? mapSource(row) : null;
    },

    findSourceByIdempotencyKey(input: { corpusId: string; fileHash: string; parserAdapter: string }): Source | null {
      const row = db.prepare("SELECT * FROM sources WHERE corpus_id = ? AND file_hash = ? AND parser_adapter = ?").get(
        input.corpusId,
        input.fileHash,
        input.parserAdapter,
      ) as Row | undefined;
      return row ? mapSource(row) : null;
    },

    listSourcesForCorpus(corpusId: string): Source[] {
      return (db.prepare("SELECT * FROM sources WHERE corpus_id = ? ORDER BY created_at DESC, original_filename").all(corpusId) as Row[]).map(
        mapSource,
      );
    },

    updateSourceStatus(id: string, importStatus: string): Source {
      db.prepare("UPDATE sources SET import_status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(
        importStatus,
        id,
      );
      return this.getSource(id)!;
    },

    createDocument(input: {
      id?: string;
      corpusId: string;
      sourceId: string;
      title: string;
      authors?: string[];
      language?: string | null;
      sourceFormat: string;
      provenance?: JsonValue;
      rawMetadata?: JsonValue;
      normalizedText: string;
      status: string;
      contentHash?: string | null;
    }): DocumentRecord {
      const id = input.id ?? createId("doc");
      db.prepare(`
        INSERT INTO documents (
          id, corpus_id, source_id, title, authors_json, language, source_format,
          provenance_json, raw_metadata_json, normalized_text, status, content_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.corpusId,
        input.sourceId,
        input.title,
        stringifyJson(input.authors, []),
        input.language ?? null,
        input.sourceFormat,
        stringifyJson(input.provenance, {}),
        stringifyJson(input.rawMetadata, {}),
        input.normalizedText,
        input.status,
        input.contentHash ?? null,
      );
      return this.getDocument(id)!;
    },

    getDocument(id: string): DocumentRecord | null {
      const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as Row | undefined;
      return row ? mapDocument(row) : null;
    },

    listDocumentsForCorpus(corpusId: string): DocumentRecord[] {
      return (db.prepare("SELECT * FROM documents WHERE corpus_id = ? ORDER BY created_at, title").all(corpusId) as Row[]).map(
        mapDocument,
      );
    },

    createSection(input: {
      id?: string;
      documentId: string;
      parentSectionId?: string | null;
      ordinal: number;
      heading?: string | null;
      headingPath?: string[];
      startOffset: number;
      endOffset: number;
      text: string;
      metadata?: JsonValue;
    }): DocumentSection {
      const id = input.id ?? createId("section");
      db.prepare(`
        INSERT INTO document_sections (
          id, document_id, parent_section_id, ordinal, heading, heading_path_json,
          start_offset, end_offset, text, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.documentId,
        input.parentSectionId ?? null,
        input.ordinal,
        input.heading ?? null,
        stringifyJson(input.headingPath, []),
        input.startOffset,
        input.endOffset,
        input.text,
        stringifyJson(input.metadata, {}),
      );
      return this.getSection(id)!;
    },

    getSection(id: string): DocumentSection | null {
      const row = db.prepare("SELECT * FROM document_sections WHERE id = ?").get(id) as Row | undefined;
      return row ? mapSection(row) : null;
    },

    listSectionsForDocument(documentId: string): DocumentSection[] {
      return (db.prepare("SELECT * FROM document_sections WHERE document_id = ? ORDER BY ordinal").all(documentId) as Row[]).map(
        mapSection,
      );
    },

    createChunk(input: {
      id?: string;
      corpusId: string;
      documentId: string;
      sectionId?: string | null;
      ordinal: number;
      stableId: string;
      startOffset: number;
      endOffset: number;
      headingPath?: string[];
      text: string;
      contentHash: string;
      metadata?: JsonValue;
    }): Chunk {
      const id = input.id ?? createId("chunk");
      db.prepare(`
        INSERT INTO chunks (
          id, corpus_id, document_id, section_id, ordinal, stable_id, start_offset,
          end_offset, heading_path_json, text, content_hash, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.corpusId,
        input.documentId,
        input.sectionId ?? null,
        input.ordinal,
        input.stableId,
        input.startOffset,
        input.endOffset,
        stringifyJson(input.headingPath, []),
        input.text,
        input.contentHash,
        stringifyJson(input.metadata, {}),
      );
      return this.getChunk(id)!;
    },

    getChunk(id: string): Chunk | null {
      const row = db.prepare("SELECT * FROM chunks WHERE id = ?").get(id) as Row | undefined;
      return row ? mapChunk(row) : null;
    },

    listChunksForDocument(documentId: string): Chunk[] {
      return (db.prepare("SELECT * FROM chunks WHERE document_id = ? ORDER BY ordinal").all(documentId) as Row[]).map(mapChunk);
    },

    createImportJob(input: {
      id?: string;
      corpusId: string;
      sourceId?: string | null;
      status: string;
      adapter: string;
      adapterVersion: string;
      warnings?: string[];
      errors?: string[];
      stats?: JsonValue;
      startedAt?: string | null;
      finishedAt?: string | null;
    }): ImportJob {
      const id = input.id ?? createId("import");
      db.prepare(`
        INSERT INTO import_jobs (
          id, corpus_id, source_id, status, adapter, adapter_version, warnings_json,
          errors_json, stats_json, started_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.corpusId,
        input.sourceId ?? null,
        input.status,
        input.adapter,
        input.adapterVersion,
        stringifyJson(input.warnings, []),
        stringifyJson(input.errors, []),
        stringifyJson(input.stats, {}),
        input.startedAt ?? null,
        input.finishedAt ?? null,
      );
      return this.getImportJob(id)!;
    },

    getImportJob(id: string): ImportJob | null {
      const row = db.prepare("SELECT * FROM import_jobs WHERE id = ?").get(id) as Row | undefined;
      return row ? mapImportJob(row) : null;
    },

    listImportJobsForCorpus(corpusId: string): ImportJob[] {
      return (db.prepare("SELECT * FROM import_jobs WHERE corpus_id = ? ORDER BY created_at DESC").all(corpusId) as Row[]).map(mapImportJob);
    },

    listImportJobsForSource(sourceId: string): ImportJob[] {
      return (db.prepare("SELECT * FROM import_jobs WHERE source_id = ? ORDER BY created_at DESC").all(sourceId) as Row[]).map(mapImportJob);
    },

    updateImportJob(input: { id: string; status: string; warnings?: string[]; errors?: string[]; stats?: JsonValue; finishedAt?: string | null }): ImportJob {
      db.prepare(`
        UPDATE import_jobs
        SET status = ?, warnings_json = COALESCE(?, warnings_json), errors_json = COALESCE(?, errors_json),
            stats_json = COALESCE(?, stats_json), finished_at = COALESCE(?, finished_at),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `).run(
        input.status,
        input.warnings ? stringifyJson(input.warnings, []) : null,
        input.errors ? stringifyJson(input.errors, []) : null,
        input.stats ? stringifyJson(input.stats, {}) : null,
        input.finishedAt ?? null,
        input.id,
      );
      return this.getImportJob(input.id)!;
    },

    createImportJobEvent(input: { id?: string; importJobId: string; eventType: string; message: string; progressPct?: number | null; payload?: JsonValue }): ImportJobEvent {
      const id = input.id ?? createId("import_event");
      db.prepare(`
        INSERT INTO import_job_events (id, import_job_id, event_type, message, progress_pct, payload_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.importJobId,
        input.eventType,
        input.message,
        input.progressPct ?? null,
        stringifyJson(input.payload, {}),
      );
      return this.getImportJobEvent(id)!;
    },

    getImportJobEvent(id: string): ImportJobEvent | null {
      const row = db.prepare("SELECT * FROM import_job_events WHERE id = ?").get(id) as Row | undefined;
      return row ? mapImportJobEvent(row) : null;
    },

    listImportJobEvents(importJobId: string): ImportJobEvent[] {
      return (db.prepare("SELECT * FROM import_job_events WHERE import_job_id = ? ORDER BY created_at, id").all(importJobId) as Row[]).map(mapImportJobEvent);
    },
  };
}
