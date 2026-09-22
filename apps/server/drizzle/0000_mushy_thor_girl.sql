CREATE TABLE "events" (
	"session_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"actor" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_version" integer NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_session_id_seq_pk" PRIMARY KEY("session_id","seq"),
	CONSTRAINT "events_seq_positive" CHECK ("events"."seq" > 0),
	CONSTRAINT "events_payload_version_positive" CHECK ("events"."payload_version" > 0)
);
--> statement-breakpoint
-- Append-only guard (data-model.md, constitution IV): rejects UPDATE and
-- DELETE on events at the database level, not just in this application's
-- code path — hand-added, since a trigger isn't expressible in the Drizzle
-- schema (T009).
CREATE FUNCTION "events_append_only"() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'events is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "events_append_only_guard"
	BEFORE UPDATE OR DELETE ON "events"
	FOR EACH ROW EXECUTE FUNCTION "events_append_only"();
