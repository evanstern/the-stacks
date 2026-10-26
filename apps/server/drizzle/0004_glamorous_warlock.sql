ALTER TABLE "jobs" DROP CONSTRAINT "jobs_kind_valid";--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_stage_valid";--> statement-breakpoint
DROP INDEX "jobs_active_book_key";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "book" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "session_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_turn_queued_key" ON "jobs" USING btree ("session_id") WHERE "jobs"."kind" = 'turn' AND "jobs"."status" = 'queued';--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_chronicle_queued_key" ON "jobs" USING btree ("session_id") WHERE "jobs"."kind" = 'chronicle' AND "jobs"."status" = 'queued';--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_session_running_key" ON "jobs" USING btree ("session_id") WHERE "jobs"."kind" IN ('turn', 'companion') AND "jobs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "jobs_dm_session_idx" ON "jobs" USING btree ("session_id","kind","status");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_active_book_key" ON "jobs" USING btree (lower(trim("book"))) WHERE "jobs"."kind" = 'ingest' AND "jobs"."status" IN ('queued', 'running');--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_book_required_for_ingest" CHECK ("jobs"."kind" <> 'ingest' OR "jobs"."book" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_session_required_for_dm" CHECK ("jobs"."kind" = 'ingest' OR "jobs"."session_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_kind_valid" CHECK ("jobs"."kind" IN ('ingest', 'turn', 'companion', 'chronicle'));--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_stage_valid" CHECK ("jobs"."stage" IN ('extract', 'parse', 'store', 'embed', 'assemble', 'director', 'interpret', 'adjudicate', 'resolve', 'narrate', 'audit', 'companion', 'chronicle'));