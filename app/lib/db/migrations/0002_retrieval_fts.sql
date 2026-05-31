CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
  chunk_id UNINDEXED,
  corpus_id UNINDEXED,
  document_id UNINDEXED,
  title,
  heading_path,
  text,
  tokenize = 'porter unicode61'
);

CREATE INDEX IF NOT EXISTS idx_chunks_stable_id ON chunks(stable_id);
CREATE INDEX IF NOT EXISTS idx_review_items_target_status ON review_items(target_type, target_id, status);
