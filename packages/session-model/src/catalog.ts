import { type EngineEvent, EngineEventSchema } from "@the-stacks/dnd5e-engine";
import type { z } from "zod";
import {
  ActionCommentedV1,
  ActionCommittedV1,
  ActionDeclaredV1,
  ActionResolvedV1,
} from "./events/actions.js";
import { DmSeatChangedV1, GatePolicyChangedV1 } from "./events/gate-config.js";
import { JournalEntryAddedV1 } from "./events/journal.js";
import {
  type MechanicsEnvelope,
  MechanicsEnvelopeV1,
} from "./events/mechanics.js";
import { PartyMemberChangedV1 } from "./events/party.js";
import { PresenceRecordedV1 } from "./events/presence.js";
import {
  ProposalApprovedV1,
  ProposalCreatedV1,
  ProposalRejectedV1,
} from "./events/proposals.js";
import { SceneChangedV1 } from "./events/scene.js";
import { TableModeChangedV1 } from "./events/table-mode.js";
import { NarrationV1, TalkV1 } from "./events/talk.js";
import { TrackerChangedV1 } from "./events/tracker.js";
import type { StoredEvent } from "./stored-event.js";

export type EventKind =
  | "talk"
  | "lifecycle"
  | "state-change"
  | "marker"
  | "record"
  | "proposal";

export interface CatalogEntry {
  type: string;
  version: number;
  kind: EventKind;
  visibility: "any" | "dm-only";
  schema: z.ZodType;
  /** The version the server appends today. */
  current: boolean;
}

/** Engine event types that are markers; the other engine types are state changes. */
const ENGINE_MARKER_TYPES: ReadonlySet<string> = new Set([
  "dice.rolled",
  "attack.resolved",
  "check.resolved",
  "rest.completed",
]);

/** The engine's event types, derived from its schema's discriminator options. */
export const MECHANICS_EVENT_TYPES: readonly string[] =
  EngineEventSchema.options.map((option) => {
    const type = option.shape.type as unknown as { value: string };
    return type.value;
  });

function session(
  type: string,
  kind: EventKind,
  schema: z.ZodType,
  visibility: "any" | "dm-only" = "any",
): CatalogEntry {
  return { type, version: 1, kind, visibility, schema, current: true };
}

const sessionEntries: CatalogEntry[] = [
  session("talk", "talk", TalkV1),
  session("narration", "talk", NarrationV1),
  session("action.declared", "lifecycle", ActionDeclaredV1),
  session("action.commented", "lifecycle", ActionCommentedV1),
  session("action.committed", "lifecycle", ActionCommittedV1),
  session("action.resolved", "lifecycle", ActionResolvedV1),
  session("table-mode.changed", "state-change", TableModeChangedV1),
  session("scene.changed", "state-change", SceneChangedV1),
  session("party.member.changed", "state-change", PartyMemberChangedV1),
  session("tracker.changed", "state-change", TrackerChangedV1, "dm-only"),
  session("journal.entry.added", "record", JournalEntryAddedV1),
  session("proposal.created", "proposal", ProposalCreatedV1, "dm-only"),
  session("proposal.approved", "proposal", ProposalApprovedV1, "dm-only"),
  session("proposal.rejected", "proposal", ProposalRejectedV1, "dm-only"),
  session("dm.seat.changed", "state-change", DmSeatChangedV1),
  session("gate.policy.changed", "state-change", GatePolicyChangedV1),
  session("presence.recorded", "marker", PresenceRecordedV1),
];

const mechanicsEntries: CatalogEntry[] = MECHANICS_EVENT_TYPES.map((type) =>
  session(
    type,
    ENGINE_MARKER_TYPES.has(type) ? "marker" : "state-change",
    MechanicsEnvelopeV1,
  ),
);

export const catalog: readonly CatalogEntry[] = [
  ...sessionEntries,
  ...mechanicsEntries,
];

/** Session-native types (the catalog minus the engine's types). */
export const SESSION_EVENT_TYPES: readonly string[] = sessionEntries.map(
  (entry) => entry.type,
);

export function catalogEntry(
  type: string,
  version: number,
): CatalogEntry | undefined {
  return catalog.find(
    (entry) => entry.type === type && entry.version === version,
  );
}

export function currentVersion(type: string): number | undefined {
  return catalog.find((entry) => entry.type === type && entry.current)?.version;
}

type Envelope = Pick<StoredEvent, "seq" | "actor" | "visibility" | "ts">;

type SessionPayloads = {
  talk: z.infer<typeof TalkV1>;
  narration: z.infer<typeof NarrationV1>;
  "action.declared": z.infer<typeof ActionDeclaredV1>;
  "action.commented": z.infer<typeof ActionCommentedV1>;
  "action.committed": z.infer<typeof ActionCommittedV1>;
  "action.resolved": z.infer<typeof ActionResolvedV1>;
  "table-mode.changed": z.infer<typeof TableModeChangedV1>;
  "scene.changed": z.infer<typeof SceneChangedV1>;
  "party.member.changed": z.infer<typeof PartyMemberChangedV1>;
  "tracker.changed": z.infer<typeof TrackerChangedV1>;
  "journal.entry.added": z.infer<typeof JournalEntryAddedV1>;
  "proposal.created": z.infer<typeof ProposalCreatedV1>;
  "proposal.approved": z.infer<typeof ProposalApprovedV1>;
  "proposal.rejected": z.infer<typeof ProposalRejectedV1>;
  "dm.seat.changed": z.infer<typeof DmSeatChangedV1>;
  "gate.policy.changed": z.infer<typeof GatePolicyChangedV1>;
  "presence.recorded": z.infer<typeof PresenceRecordedV1>;
};

export type SessionNativeEvent = {
  [K in keyof SessionPayloads]: Envelope & {
    type: K;
    payload: SessionPayloads[K];
  };
}[keyof SessionPayloads];

export type MechanicsEvent = Envelope & {
  type: EngineEvent["type"];
  payload: MechanicsEnvelope;
};

/** Every catalog entry's typed payload, with the row's envelope fields. */
export type SessionEvent = SessionNativeEvent | MechanicsEvent;

export type DecodeResult =
  | { status: "known"; kind: EventKind; event: SessionEvent }
  | { status: "unknown-type" }
  | { status: "unknown-version" }
  | { status: "invalid"; issues: string[] };

const MAX_ISSUES = 10;

function invalid(issues: string[]): DecodeResult {
  return { status: "invalid", issues: issues.slice(0, MAX_ISSUES) };
}

/** Decodes one stored row against the catalog. Never throws. */
export function decodeEvent(stored: StoredEvent): DecodeResult {
  try {
    const sameType = catalog.filter((entry) => entry.type === stored.type);
    if (sameType.length === 0) return { status: "unknown-type" };
    const entry = sameType.find(
      (candidate) => candidate.version === stored.payloadVersion,
    );
    if (!entry) return { status: "unknown-version" };
    const parsed = entry.schema.safeParse(stored.payload);
    if (!parsed.success) {
      return invalid(
        parsed.error.issues.map(
          (issue) =>
            `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`,
        ),
      );
    }
    if (
      entry.schema === MechanicsEnvelopeV1 &&
      (parsed.data as MechanicsEnvelope).event.type !== stored.type
    ) {
      return invalid([
        `type mismatch: row type "${stored.type}" differs from payload.event.type "${(parsed.data as MechanicsEnvelope).event.type}"`,
      ]);
    }
    const event = {
      type: stored.type,
      seq: stored.seq,
      actor: stored.actor,
      visibility: stored.visibility,
      ts: stored.ts,
      payload: parsed.data,
    } as SessionEvent;
    return { status: "known", kind: entry.kind, event };
  } catch (error) {
    return invalid([error instanceof Error ? error.message : "decode failed"]);
  }
}
