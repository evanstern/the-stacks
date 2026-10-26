import { randomUUID } from "node:crypto";
import type { EngineEvent } from "@the-stacks/dnd5e-engine";
import {
  catalog,
  currentVersion,
  type DmSeat,
  DmSeatChangedV1,
  MECHANICS_EVENT_TYPES,
  MechanicsEnvelopeV1,
  mechanicsRows,
  type StoredEvent,
  VisibilitySchema,
} from "@the-stacks/session-model";
import {
  type AppendInput,
  append,
  appendBatch,
  type DbClient,
  type RecordedEvent,
  readLatestOfType,
} from "../events/log.js";

/** Append refusal codes (specs/028-session-model/contracts/session-events.md). */
export type AppendRefusalCode =
  | "UNKNOWN_EVENT_TYPE"
  | "UNKNOWN_EVENT_VERSION"
  | "INVALID_PAYLOAD"
  | "TYPE_MISMATCH"
  | "VISIBILITY_NOT_ALLOWED"
  | "INVALID_VISIBILITY"
  | "CATALOG_TYPE_REQUIRES_GATE";

const MAX_ISSUES = 10;

export class SessionEventRefused extends Error {
  readonly code: AppendRefusalCode;
  readonly issues: string[];

  constructor(code: AppendRefusalCode, issues: string[] = []) {
    super(
      `session event refused: ${code}${issues.length > 0 ? ` (${issues.join("; ")})` : ""}`,
    );
    this.name = "SessionEventRefused";
    this.code = code;
    this.issues = issues.slice(0, MAX_ISSUES);
  }
}

export interface AppendSessionEventInput {
  sessionId: string;
  actor: string;
  type: string;
  payload: unknown;
  /** Default "public". */
  visibility?: string;
}

/** RecordedEvent (Drizzle row, Date ts) to StoredEvent (ISO ts). */
export function toStoredEvent(row: RecordedEvent): StoredEvent {
  return {
    sessionId: row.sessionId,
    seq: row.seq,
    actor: row.actor,
    type: row.type,
    payload: row.payload,
    payloadVersion: row.payloadVersion,
    visibility: row.visibility,
    ts: row.ts.toISOString(),
  };
}

/** Throws a refusal when the row would not be accepted; returns the vetted append input. */
function vet(input: AppendSessionEventInput): AppendInput {
  const visibility = input.visibility ?? "public";
  if (!VisibilitySchema.safeParse(visibility).success) {
    throw new SessionEventRefused("INVALID_VISIBILITY");
  }
  const version = currentVersion(input.type);
  if (version === undefined)
    throw new SessionEventRefused("UNKNOWN_EVENT_TYPE");
  const entry = catalog.find(
    (candidate) =>
      candidate.type === input.type && candidate.version === version,
  );
  if (!entry) throw new SessionEventRefused("UNKNOWN_EVENT_VERSION");

  const parsed = entry.schema.safeParse(input.payload);
  if (!parsed.success) {
    throw new SessionEventRefused(
      "INVALID_PAYLOAD",
      parsed.error.issues.map(
        (issue) =>
          `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`,
      ),
    );
  }
  if (
    entry.schema === MechanicsEnvelopeV1 &&
    (parsed.data as { event: { type: string } }).event.type !== input.type
  ) {
    throw new SessionEventRefused("TYPE_MISMATCH");
  }
  if (entry.visibility === "dm-only" && visibility !== "dm") {
    throw new SessionEventRefused("VISIBILITY_NOT_ALLOWED");
  }
  return {
    sessionId: input.sessionId,
    actor: input.actor,
    type: input.type,
    payload: parsed.data,
    payloadVersion: version,
    visibility,
  };
}

/**
 * Validates against the current catalog version, then calls M0 `append`.
 * Throws `SessionEventRefused`; writes nothing on refusal.
 */
export async function appendSessionEvent(
  db: DbClient,
  input: AppendSessionEventInput,
): Promise<StoredEvent> {
  const vetted = vet(input);
  return toStoredEvent(await append(db, vetted));
}

/**
 * Vets every input against the catalog (any refusal: nothing written), then appends all
 * rows in one `appendBatch`, forwarding `expectedLastSeq`. Throws `SeqConflictError` on a
 * stale expectation.
 */
export async function appendSessionEvents(
  db: DbClient,
  inputs: readonly AppendSessionEventInput[],
  options?: { expectedLastSeq?: number },
): Promise<StoredEvent[]> {
  const vetted = inputs.map(vet);
  const rows = await appendBatch(db, vetted, options);
  return rows.map(toStoredEvent);
}

/**
 * The inert legacy path (ws-delivery.md). Refuses CATALOG_TYPE_REQUIRES_GATE for any
 * catalogued type; otherwise calls M0 `append` unchanged.
 */
export async function appendUncataloguedEvent(
  db: DbClient,
  input: AppendInput,
): Promise<StoredEvent> {
  if (currentVersion(input.type) !== undefined) {
    throw new SessionEventRefused("CATALOG_TYPE_REQUIRES_GATE", [input.type]);
  }
  return toStoredEvent(await append(db, input));
}

/** The session's DM seat: the latest dm.seat.changed row's `after`, else the AI DM. */
export async function loadDmSeat(
  db: DbClient,
  sessionId: string,
): Promise<DmSeat> {
  const row = await readLatestOfType(db, {
    sessionId,
    type: "dm.seat.changed",
  });
  if (!row) return { kind: "ai" };
  const parsed = DmSeatChangedV1.safeParse(row.payload);
  return parsed.success ? parsed.data.after : { kind: "ai" };
}

export interface AppendMechanicsBatchInput {
  sessionId: string;
  actor: string;
  /** One `execute` result, in order; length >= 1. */
  events: readonly EngineEvent[];
  actionId: string | null;
  proposalId: string | null;
  /** Applies to every row of the batch. */
  visibility?: string;
}

export interface AppendMechanicsBatchDeps {
  /** Test seam for failure injection; production omits deps. */
  appendBatch: typeof appendBatch;
}

/**
 * Assigns a batch id, wraps each event with `index` and `count`, validates every envelope
 * against the catalog (refusal writes nothing), then appends all rows atomically through
 * `appendBatch`: consecutive `seq` values, or none (spec FR-021).
 */
export async function appendMechanicsBatch(
  db: DbClient,
  input: AppendMechanicsBatchInput,
  deps: AppendMechanicsBatchDeps = { appendBatch },
): Promise<{ batchId: string; events: StoredEvent[] }> {
  if (input.events.length === 0) {
    throw new SessionEventRefused("INVALID_PAYLOAD", [
      "events: a batch needs at least one event",
    ]);
  }
  const batchId = randomUUID();
  for (const [index, event] of input.events.entries()) {
    if (!MECHANICS_EVENT_TYPES.includes(event.type)) {
      throw new SessionEventRefused("UNKNOWN_EVENT_TYPE", [
        `events.${index}: ${event.type}`,
      ]);
    }
  }
  const planned = mechanicsRows({
    actor: input.actor,
    batchId,
    events: input.events,
    actionId: input.actionId,
    proposalId: input.proposalId,
    visibility: input.visibility ?? "public",
  });
  const vetted = planned.map((row) =>
    vet({ sessionId: input.sessionId, ...row }),
  );
  const rows = await deps.appendBatch(db, vetted);
  return { batchId, events: rows.map(toStoredEvent) };
}
