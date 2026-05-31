PRAGMA foreign_keys = OFF;

CREATE TABLE import_jobs_next (
  id TEXT PRIMARY KEY,
  corpus_id TEXT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'queued', 'parsing', 'normalized', 'review_needed', 'approved', 'indexed', 'ready', 'failed_parse', 'failed_review_suggestion', 'rejected', 'deferred', 'superseded', 'ocr_needed', 'ocr_queued', 'ocr_running', 'ocr_succeeded', 'ocr_deferred', 'ocr_failed', 'ocr_rejected')),
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

INSERT INTO import_jobs_next (
  id, corpus_id, source_id, status, adapter, adapter_version, warnings_json,
  errors_json, stats_json, started_at, finished_at, created_at, updated_at
)
SELECT
  id, corpus_id, source_id, status, adapter, adapter_version, warnings_json,
  errors_json, stats_json, started_at, finished_at, created_at, updated_at
FROM import_jobs;

DROP TABLE import_jobs;
ALTER TABLE import_jobs_next RENAME TO import_jobs;

CREATE INDEX IF NOT EXISTS idx_import_jobs_corpus_status ON import_jobs(corpus_id, status);

PRAGMA foreign_keys = ON;
