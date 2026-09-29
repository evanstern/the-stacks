-- Hand-added (data-model.md, research R2): pgvector's `vector` type and the
-- HNSW index below need the extension; drizzle-kit can't emit this (T002).
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "library_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"kind" text NOT NULL,
	"path" text[] NOT NULL,
	"text" text NOT NULL,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', "text")) STORED,
	CONSTRAINT "library_chunks_kind_valid" CHECK ("library_chunks"."kind" IN ('heading', 'prose', 'list', 'table', 'statBlock', 'sidebar')),
	CONSTRAINT "library_chunks_span_valid" CHECK ("library_chunks"."start_offset" >= 0 AND "library_chunks"."end_offset" > "library_chunks"."start_offset")
);
--> statement-breakpoint
CREATE TABLE "library_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book" text NOT NULL,
	"text" text NOT NULL,
	"content_hash" text,
	"source" jsonb,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chunk_id" uuid NOT NULL,
	"model" text NOT NULL,
	"dim" integer NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_embeddings_dim_valid" CHECK ("library_embeddings"."dim" = 1024)
);
--> statement-breakpoint
ALTER TABLE "library_chunks" ADD CONSTRAINT "library_chunks_document_id_library_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."library_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_embeddings" ADD CONSTRAINT "library_embeddings_chunk_id_library_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."library_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "library_chunks_document_ordinal_key" ON "library_chunks" USING btree ("document_id","ordinal");--> statement-breakpoint
CREATE INDEX "library_chunks_tsv_idx" ON "library_chunks" USING gin ("tsv");--> statement-breakpoint
CREATE UNIQUE INDEX "library_documents_book_key" ON "library_documents" USING btree (lower(trim("book")));--> statement-breakpoint
CREATE UNIQUE INDEX "library_embeddings_chunk_model_key" ON "library_embeddings" USING btree ("chunk_id","model");--> statement-breakpoint
CREATE INDEX "library_embeddings_model_idx" ON "library_embeddings" USING btree ("model");--> statement-breakpoint
CREATE INDEX "library_embeddings_embedding_idx" ON "library_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
-- Immutability guard (research R4, constitution III): rejects UPDATE on all
-- three library tables at the database level, mirroring events' append-only
-- trigger. DELETE stays allowed (wholesale replace, operator removal) and
-- cascades via each table's ON DELETE CASCADE FK — hand-added, since a
-- trigger isn't expressible in the Drizzle schema (T002).
CREATE FUNCTION "library_immutable"() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'library is immutable after ingestion: % on %', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "library_documents_immutable_guard"
	BEFORE UPDATE ON "library_documents"
	FOR EACH ROW EXECUTE FUNCTION "library_immutable"();
--> statement-breakpoint
CREATE TRIGGER "library_chunks_immutable_guard"
	BEFORE UPDATE ON "library_chunks"
	FOR EACH ROW EXECUTE FUNCTION "library_immutable"();
--> statement-breakpoint
CREATE TRIGGER "library_embeddings_immutable_guard"
	BEFORE UPDATE ON "library_embeddings"
	FOR EACH ROW EXECUTE FUNCTION "library_immutable"();