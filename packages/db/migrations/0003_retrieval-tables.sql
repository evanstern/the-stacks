CREATE TABLE IF NOT EXISTS "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"corpus_id" uuid NOT NULL,
	"config" jsonb NOT NULL,
	"config_name" text NOT NULL,
	"gold_snapshot" jsonb NOT NULL,
	"status" text NOT NULL,
	"metrics" jsonb,
	"item_outcomes" jsonb,
	"retrieval_run_ids" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gold_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"corpus_id" uuid NOT NULL,
	"question" text NOT NULL,
	"expected" jsonb NOT NULL,
	"split" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retrieval_results" (
	"run_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"chunk_id" text NOT NULL,
	"source_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"content_snapshot" text NOT NULL,
	"anchor_snapshot" jsonb NOT NULL,
	"section_ids" jsonb NOT NULL,
	"content_sha256" text NOT NULL,
	"fts_score" real,
	"vector_score" real,
	"fused_score" real NOT NULL,
	"rerank_score" real,
	"prerank_position" integer,
	CONSTRAINT "retrieval_results_run_id_rank_pk" PRIMARY KEY("run_id","rank")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retrieval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"config" jsonb NOT NULL,
	"corpus_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"embedding_provider" text NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding_dimensions" integer NOT NULL,
	"stage_timings" jsonb NOT NULL,
	"result_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_corpus_id_corpora_id_fk" FOREIGN KEY ("corpus_id") REFERENCES "public"."corpora"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gold_items" ADD CONSTRAINT "gold_items_corpus_id_corpora_id_fk" FOREIGN KEY ("corpus_id") REFERENCES "public"."corpora"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retrieval_results" ADD CONSTRAINT "retrieval_results_run_id_retrieval_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."retrieval_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retrieval_results" ADD CONSTRAINT "retrieval_results_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retrieval_runs" ADD CONSTRAINT "retrieval_runs_corpus_id_corpora_id_fk" FOREIGN KEY ("corpus_id") REFERENCES "public"."corpora"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
