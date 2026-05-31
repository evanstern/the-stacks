CREATE TABLE IF NOT EXISTS import_job_events (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  progress_pct INTEGER CHECK (progress_pct IS NULL OR (progress_pct >= 0 AND progress_pct <= 100)),
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_import_job_events_job_created ON import_job_events(import_job_id, created_at);
