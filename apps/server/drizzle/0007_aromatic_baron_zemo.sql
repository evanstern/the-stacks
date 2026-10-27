ALTER TABLE "jobs" DROP CONSTRAINT "jobs_kind_valid";--> statement-breakpoint
DROP INDEX "jobs_session_running_key";--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_floor_queued_key" ON "jobs" USING btree ("session_id",("input"->>'check'),coalesce("input"->>'actionId', '')) WHERE "jobs"."kind" = 'floor' AND "jobs"."status" = 'queued';--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_session_running_key" ON "jobs" USING btree ("session_id") WHERE "jobs"."kind" IN ('turn', 'companion', 'floor') AND "jobs"."status" = 'running';--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_kind_valid" CHECK ("jobs"."kind" IN ('ingest', 'turn', 'companion', 'chronicle', 'floor'));