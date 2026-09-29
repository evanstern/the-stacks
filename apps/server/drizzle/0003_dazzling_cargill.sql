CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'ingest' NOT NULL,
	"book" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claim_token" uuid,
	"heartbeat_at" timestamp with time zone,
	"input" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_kind_valid" CHECK ("jobs"."kind" IN ('ingest')),
	CONSTRAINT "jobs_status_valid" CHECK ("jobs"."status" IN ('queued', 'running', 'succeeded', 'failed')),
	CONSTRAINT "jobs_stage_valid" CHECK ("jobs"."stage" IN ('extract', 'parse', 'store', 'embed'))
);
--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_active_book_key" ON "jobs" USING btree (lower(trim("book"))) WHERE "jobs"."status" IN ('queued', 'running');