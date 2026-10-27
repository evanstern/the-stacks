import type { EngineCommand } from "@the-stacks/dnd5e-engine";
import { z } from "zod";
import {
  ActionCommentedV1,
  ActionDeclaredV1,
  ActionResolvedV1,
} from "../events/actions.js";
import { JournalEntryAddedV1 } from "../events/journal.js";
import { PartyMemberSchema } from "../events/party.js";
import { SceneSchema } from "../events/scene.js";
import { PresenceReasonSchema } from "../events/scene-presence.js";
import { TableModeSchema } from "../events/table-mode.js";
import { NarrationV1, TalkV1 } from "../events/talk.js";
import { TrackerSchema } from "../events/tracker.js";
import {
  CombatantIdSchema,
  ReasonSchema,
  RefIdSchema,
  VisibilitySchema,
} from "../ids.js";
import { PolicySchema } from "./policy.js";
import { DmSeatSchema } from "./seat.js";

export const ProposalKindSchema = z.enum([
  "talk",
  "action.declare",
  "action.comment",
  "action.commit",
  "action.withdraw",
  "action.resolve",
  "mechanics",
  "narration",
  "table-mode",
  "scene",
  "party",
  "tracker",
  "scene-presence",
  "journal",
  "floor",
]);
export type ProposalKind = z.infer<typeof ProposalKindSchema>;

/** The thirteen kinds the AI DM may propose; the policy table is total over these. */
export const DmProposalKindSchema = ProposalKindSchema.exclude([
  "action.declare",
  "action.withdraw",
]);
export type DmProposalKind = z.infer<typeof DmProposalKindSchema>;

/** Optional fields for the DM's approval panel. */
const ProposalNote = {
  summary: z.string().min(1).max(200).nullable().default(null),
  rationale: z.string().min(1).max(2000).nullable().default(null),
};

export const ProposalSchema = z.discriminatedUnion("kind", [
  // table-side (players, companions, DM)
  z.object({
    kind: z.literal("talk"),
    ...ProposalNote,
    talk: TalkV1,
    visibility: VisibilitySchema.default("public"),
  }),
  z.object({
    kind: z.literal("action.declare"),
    ...ProposalNote,
    action: ActionDeclaredV1,
  }),
  z.object({
    kind: z.literal("action.comment"),
    ...ProposalNote,
    comment: ActionCommentedV1,
  }),
  z.object({
    kind: z.literal("action.commit"),
    ...ProposalNote,
    actionId: RefIdSchema,
    /** `ai:dm` only: commit a stalled party action (specs/049-turn-floor, ruling FT-5). */
    override: z.literal("stall").optional(),
  }),
  z.object({
    kind: z.literal("action.withdraw"),
    ...ProposalNote,
    actionId: RefIdSchema,
  }),
  // DM-side
  z.object({
    kind: z.literal("action.resolve"),
    ...ProposalNote,
    resolution: ActionResolvedV1,
  }),
  z.object({
    kind: z.literal("mechanics"),
    ...ProposalNote,
    command: z.unknown(),
    actionId: RefIdSchema.nullable().default(null),
    visibility: z.enum(["public", "dm"]).default("public"),
  }),
  z.object({
    kind: z.literal("narration"),
    ...ProposalNote,
    narration: NarrationV1,
    visibility: VisibilitySchema.default("public"),
  }),
  z.object({
    kind: z.literal("table-mode"),
    ...ProposalNote,
    reason: ReasonSchema,
    after: TableModeSchema,
  }),
  z.object({
    kind: z.literal("scene"),
    ...ProposalNote,
    reason: ReasonSchema,
    after: SceneSchema.nullable(),
  }),
  z.object({
    kind: z.literal("party"),
    ...ProposalNote,
    reason: ReasonSchema,
    characterId: RefIdSchema,
    after: PartyMemberSchema.nullable(),
  }),
  z.object({
    kind: z.literal("tracker"),
    ...ProposalNote,
    reason: ReasonSchema,
    trackerId: RefIdSchema,
    after: TrackerSchema.nullable(),
    visibility: z.literal("dm").default("dm"),
  }),
  z.object({
    kind: z.literal("scene-presence"),
    ...ProposalNote,
    actorId: RefIdSchema,
    reason: PresenceReasonSchema,
    actionId: RefIdSchema.nullable().default(null),
  }),
  z.object({
    kind: z.literal("journal"),
    ...ProposalNote,
    entry: JournalEntryAddedV1,
    visibility: z.enum(["public", "dm"]).default("public"),
  }),
  z.object({
    kind: z.literal("floor"),
    ...ProposalNote,
    op: z.enum(["end", "take", "return"]),
    turn: z.object({
      round: z.number().int().min(1),
      combatantId: CombatantIdSchema,
    }),
    reason: ReasonSchema,
  }),
]);
export type Proposal = z.infer<typeof ProposalSchema>;

/** Typed builder for producers; the wire schema keeps `command` unknown so the engine validates. */
export function mechanicsProposal(
  command: EngineCommand,
  opts: {
    actionId?: string | null;
    visibility?: "public" | "dm";
    summary?: string;
    rationale?: string;
  } = {},
): Proposal {
  return {
    kind: "mechanics",
    summary: opts.summary ?? null,
    rationale: opts.rationale ?? null,
    command,
    actionId: opts.actionId ?? null,
    visibility: opts.visibility ?? "public",
  };
}

/** A gate request is a proposal or one of four supervision requests. */
export const GateRequestSchema = z.discriminatedUnion("kind", [
  ...ProposalSchema.options,
  z.object({ kind: z.literal("proposal.approve"), proposalId: RefIdSchema }),
  z.object({
    kind: z.literal("proposal.reject"),
    proposalId: RefIdSchema,
    reason: z.string().min(1).max(500).nullable().default(null),
  }),
  z.object({
    kind: z.literal("dm.seat"),
    reason: ReasonSchema,
    after: DmSeatSchema,
  }),
  z.object({
    kind: z.literal("gate.policy"),
    reason: ReasonSchema,
    proposalKind: DmProposalKindSchema,
    policy: PolicySchema,
  }),
]);
export type GateRequest = z.infer<typeof GateRequestSchema>;

/** The 19 `kind` literals of GateRequestSchema. */
export const GATE_REQUEST_KINDS: readonly string[] =
  GateRequestSchema.options.map(
    (option) => (option.shape.kind as unknown as { value: string }).value,
  );

/** The send frame's payloadVersion for a gate request. */
export const GATE_REQUEST_VERSION = 1;

export type Proposer =
  | { kind: "human"; userId: string; role: "operator" | "player" }
  | { kind: "ai"; actor: "ai:dm" }
  | { kind: "ai"; actor: `ai:companion:${string}` };

/** The row actor the gate writes: the user id, or the AI actor string. */
export function actorOf(p: Proposer): string {
  return p.kind === "human" ? p.userId : p.actor;
}
