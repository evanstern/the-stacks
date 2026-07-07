CREATE TABLE IF NOT EXISTS "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"corpus_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"original_filename" text NOT NULL,
	"status" text DEFAULT 'expanding' NOT NULL,
	"entry_report" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batches_status_check" CHECK ("batches"."status" IN ('expanding', 'expanded', 'failed', 'empty'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"corpus_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"section_ids" jsonb NOT NULL,
	"anchor" jsonb NOT NULL,
	"oversized" boolean DEFAULT false NOT NULL,
	"plugin_name" text NOT NULL,
	"plugin_version" text NOT NULL,
	"embedding" vector,
	"embedding_provider" text,
	"embedding_model" text,
	"embedding_dimensions" integer,
	"fts" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chunks_embedding_stamp_check" CHECK ("chunks"."embedding" IS NULL OR ("chunks"."embedding_provider" IS NOT NULL AND "chunks"."embedding_model" IS NOT NULL AND "chunks"."embedding_dimensions" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "corpora" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "corpora_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"section_index" integer NOT NULL,
	"path" jsonb NOT NULL,
	"kind" text NOT NULL,
	"heading" text,
	"content" text NOT NULL,
	"anchor" jsonb NOT NULL,
	"display_artifact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_sections_kind_check" CHECK ("document_sections"."kind" IN ('prose', 'stat_block', 'table', 'spell_entry', 'unclassified'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingestion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"batch_id" uuid,
	"stage" text NOT NULL,
	"event" text NOT NULL,
	"ok" boolean NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingestion_events_stage_check" CHECK ("ingestion_events"."stage" IN ('intake', 'expand', 'detect', 'extract', 'transform', 'chunk', 'embed', 'index', 'commit')),
	CONSTRAINT "ingestion_events_event_check" CHECK ("ingestion_events"."event" IN ('started', 'completed', 'failed', 'skipped')),
	CONSTRAINT "ingestion_events_scope_check" CHECK ("ingestion_events"."source_id" IS NOT NULL OR "ingestion_events"."batch_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "source_archives" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"byte_size" integer NOT NULL,
	"media_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"corpus_id" uuid NOT NULL,
	"batch_id" uuid,
	"fingerprint" text NOT NULL,
	"original_filename" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"plugin_name" text,
	"plugin_version" text,
	"detect_confidence" real,
	"current_generation" integer DEFAULT 0 NOT NULL,
	"contract_version" text,
	"last_error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_status_check" CHECK ("sources"."status" IN ('queued', 'processing', 'ingested', 'failed', 'empty'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "batches" ADD CONSTRAINT "batches_corpus_id_corpora_id_fk" FOREIGN KEY ("corpus_id") REFERENCES "public"."corpora"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "batches" ADD CONSTRAINT "batches_fingerprint_source_archives_fingerprint_fk" FOREIGN KEY ("fingerprint") REFERENCES "public"."source_archives"("fingerprint") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chunks" ADD CONSTRAINT "chunks_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chunks" ADD CONSTRAINT "chunks_corpus_id_corpora_id_fk" FOREIGN KEY ("corpus_id") REFERENCES "public"."corpora"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_sections" ADD CONSTRAINT "document_sections_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ingestion_events" ADD CONSTRAINT "ingestion_events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ingestion_events" ADD CONSTRAINT "ingestion_events_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sources" ADD CONSTRAINT "sources_corpus_id_corpora_id_fk" FOREIGN KEY ("corpus_id") REFERENCES "public"."corpora"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sources" ADD CONSTRAINT "sources_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sources" ADD CONSTRAINT "sources_fingerprint_source_archives_fingerprint_fk" FOREIGN KEY ("fingerprint") REFERENCES "public"."source_archives"("fingerprint") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "batches_corpus_fingerprint_idx" ON "batches" USING btree ("corpus_id","fingerprint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chunks_source_gen_idx" ON "chunks" USING btree ("source_id","generation");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chunks_corpus_gen_idx" ON "chunks" USING btree ("corpus_id","generation");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chunks_fts_idx" ON "chunks" USING gin ("fts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_sections_source_gen_idx" ON "document_sections" USING btree ("source_id","generation","section_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingestion_events_source_idx" ON "ingestion_events" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingestion_events_batch_idx" ON "ingestion_events" USING btree ("batch_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sources_corpus_fingerprint_idx" ON "sources" USING btree ("corpus_id","fingerprint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sources_plugin_version_idx" ON "sources" USING btree ("plugin_name","plugin_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sources_batch_idx" ON "sources" USING btree ("batch_id");--> statement-breakpoint
-- Seed the single live corpus (D4/FR-022: one corpus in v3, but every source
-- and chunk carries corpus_id so multi-corpus returns cheaply). Hand-appended
-- to the generated migration; ON CONFLICT keeps re-runs no-ops.
INSERT INTO "corpora" ("name") VALUES ('default') ON CONFLICT ("name") DO NOTHING;
