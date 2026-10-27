CREATE TABLE "dm_model_calls" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dm_model_calls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"job_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"job_kind" text NOT NULL,
	"job_attempt" integer NOT NULL,
	"purpose" text NOT NULL,
	"prompt_version" text NOT NULL,
	"call_attempt" integer NOT NULL,
	"outcome" text NOT NULL,
	"error_kind" text,
	"provider" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" double precision,
	"duration_ms" integer,
	"http_attempts" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dm_model_calls_job_kind_valid" CHECK ("dm_model_calls"."job_kind" IN ('turn', 'companion', 'chronicle')),
	CONSTRAINT "dm_model_calls_call_attempt_valid" CHECK ("dm_model_calls"."call_attempt" IN (1, 2)),
	CONSTRAINT "dm_model_calls_outcome_valid" CHECK ("dm_model_calls"."outcome" IN ('ok', 'invalid-json', 'error', 'aborted'))
);
--> statement-breakpoint
ALTER TABLE "dm_model_calls" ADD CONSTRAINT "dm_model_calls_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dm_model_calls_session_idx" ON "dm_model_calls" USING btree ("session_id","id");--> statement-breakpoint
CREATE INDEX "dm_model_calls_job_idx" ON "dm_model_calls" USING btree ("job_id");