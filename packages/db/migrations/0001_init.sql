CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_by" text,
	"claimed_at" timestamp with time zone,
	"last_error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_status_check" CHECK ("jobs"."status" IN ('queued', 'claimed', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skeleton_check_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skeleton_check_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"run_id" uuid NOT NULL,
	"seam" text NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skeleton_check_events_seam_check" CHECK ("skeleton_check_events"."seam" IN ('queued', 'claimed', 'inference', 'vector_write', 'vector_readback', 'completed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skeleton_check_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"status" text DEFAULT 'accepted' NOT NULL,
	"input_text" text NOT NULL,
	"outcome" jsonb,
	"vector_id" text,
	"readback_distance" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "skeleton_check_runs_status_check" CHECK ("skeleton_check_runs"."status" IN ('accepted', 'running', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skeleton_vectors" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"embedding" vector NOT NULL,
	"embedding_provider" text NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding_dimensions" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skeleton_check_events" ADD CONSTRAINT "skeleton_check_events_run_id_skeleton_check_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."skeleton_check_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skeleton_check_runs" ADD CONSTRAINT "skeleton_check_runs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skeleton_check_runs" ADD CONSTRAINT "skeleton_check_runs_vector_id_skeleton_vectors_id_fk" FOREIGN KEY ("vector_id") REFERENCES "public"."skeleton_vectors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_status_run_at_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skeleton_check_events_run_id_id_idx" ON "skeleton_check_events" USING btree ("run_id","id");