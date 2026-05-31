PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS corpora (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  corpus_id TEXT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
  file_hash TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  parser_adapter TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  import_status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  storage_uri TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (corpus_id, file_hash, parser_adapter)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  corpus_id TEXT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors_json TEXT NOT NULL DEFAULT '[]',
  language TEXT,
  source_format TEXT NOT NULL,
  provenance_json TEXT NOT NULL DEFAULT '{}',
  raw_metadata_json TEXT NOT NULL DEFAULT '{}',
  normalized_text TEXT NOT NULL,
  status TEXT NOT NULL,
  content_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS document_sections (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_section_id TEXT REFERENCES document_sections(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  heading TEXT,
  heading_path_json TEXT NOT NULL DEFAULT '[]',
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset >= start_offset),
  text TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (document_id, ordinal)
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  corpus_id TEXT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES document_sections(id) ON DELETE SET NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  stable_id TEXT NOT NULL UNIQUE,
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset >= start_offset),
  heading_path_json TEXT NOT NULL DEFAULT '[]',
  text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (document_id, ordinal)
);

CREATE TABLE IF NOT EXISTS review_items (
  id TEXT PRIMARY KEY,
  corpus_id TEXT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('source', 'document', 'section', 'import_proposal')),
  target_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'suggested', 'approved', 'rejected', 'deferred')),
  title TEXT NOT NULL,
  summary TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS review_suggestions (
  id TEXT PRIMARY KEY,
  review_item_id TEXT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
  suggestion_state TEXT NOT NULL CHECK (suggestion_state IN ('suggested_approve', 'suggested_reject', 'suggested_defer')),
  rationale TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS review_decisions (
  id TEXT PRIMARY KEY,
  review_item_id TEXT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
  suggestion_id TEXT REFERENCES review_suggestions(id) ON DELETE SET NULL,
  decision_state TEXT NOT NULL CHECK (decision_state IN ('approved', 'rejected', 'deferred')),
  rationale TEXT,
  actor TEXT NOT NULL,
  decided_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  corpus_id TEXT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'queued', 'parsing', 'normalized', 'review_needed', 'approved', 'indexed', 'ready', 'failed_parse', 'failed_review_suggestion', 'rejected', 'deferred', 'superseded')),
  adapter TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  errors_json TEXT NOT NULL DEFAULT '[]',
  stats_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  corpus_id TEXT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  model TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS retrieval_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  corpus_id TEXT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  retrieval_mode TEXT NOT NULL,
  retrieved_chunks_json TEXT NOT NULL DEFAULT '[]',
  scores_json TEXT NOT NULL DEFAULT '{}',
  model_inputs_json TEXT NOT NULL DEFAULT '{}',
  prompt_context_hash TEXT,
  final_answer TEXT,
  no_evidence INTEGER NOT NULL DEFAULT 0 CHECK (no_evidence IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS citations (
  id TEXT PRIMARY KEY,
  retrieval_run_id TEXT NOT NULL REFERENCES retrieval_runs(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  chunk_id TEXT REFERENCES chunks(id) ON DELETE SET NULL,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  quote TEXT,
  rationale TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (retrieval_run_id, ordinal)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  corpus_id TEXT REFERENCES corpora(id) ON DELETE CASCADE,
  workflow_kind TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  status TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  input_refs_json TEXT NOT NULL DEFAULT '[]',
  output_refs_json TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sources_corpus_status ON sources(corpus_id, import_status);
CREATE INDEX IF NOT EXISTS idx_documents_corpus_status ON documents(corpus_id, status);
CREATE INDEX IF NOT EXISTS idx_sections_document ON document_sections(document_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_chunks_corpus_document ON chunks(corpus_id, document_id);
CREATE INDEX IF NOT EXISTS idx_review_items_corpus_status ON review_items(corpus_id, status);
CREATE INDEX IF NOT EXISTS idx_review_suggestions_item ON review_suggestions(review_item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_review_decisions_item ON review_decisions(review_item_id, decided_at);
CREATE INDEX IF NOT EXISTS idx_import_jobs_corpus_status ON import_jobs(corpus_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_retrieval_runs_corpus ON retrieval_runs(corpus_id, created_at);
CREATE INDEX IF NOT EXISTS idx_citations_retrieval ON citations(retrieval_run_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_thread ON workflow_runs(thread_id);
