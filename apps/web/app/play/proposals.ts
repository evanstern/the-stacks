import { toText } from "@the-stacks/intent";
import {
  type PartyMemberView,
  type Proposal,
  type ProposalView,
  pendingProposals,
  project,
  REASON_TO_PRESENCE,
  type StoredEvent,
  type SuggestionView,
  type Viewer,
} from "@the-stacks/session-model";
import { actorLabel, characterLabel, kindLabel } from "./labels.ts";

export interface PendingProposalView {
  proposalId: string;
  /** The proposal kind as the gate names it (for example "narration", "damage.apply"). */
  kind: string;
  /** The policy recorded on the proposal's `proposal.created` row. `suggest` applies nothing. */
  policy: "ask" | "suggest";
  /** One line the DM reads first: what approving would do. */
  summary: string;
  /** The proposing actor id ("ai:dm", "ai:companion:<id>", or a user id). */
  proposer: string;
  /** Display name for the proposer, resolved from the party where possible. */
  proposerLabel: string;
  /** The player action this proposal serves, when any. */
  actionId: string | null;
  /** Ordered label/value rows rendered under the summary. Values are display strings. */
  details: readonly { label: string; value: string }[];
  /** The seq of the event that raised it; the list is ordered by this, oldest first. */
  createdSeq: number;
  ts: string;
}

export interface ProposalCommands {
  /** Returns true when the decision left (live) or applied (fixture). */
  approve(proposalId: string): boolean;
  reject(proposalId: string, reason: string | null): boolean;
}

/** Pending proposals visible to `viewer`, oldest first. Always [] for a player viewer. */
export type SelectPendingProposals = (
  events: readonly StoredEvent[],
  viewer: Viewer,
) => PendingProposalView[];

type Detail = { label: string; value: string };

const FLOOR_OP_LABEL = {
  end: "End the turn",
  take: "Take the floor",
  return: "Return the floor",
} as const;

const VISIBILITY_LABEL: Record<string, string> = {
  public: "Public",
  dm: "DM only",
};

function visibilityLabel(visibility: string): string {
  return VISIBILITY_LABEL[visibility] ?? "One player";
}

function actionIdOf(proposal: Proposal): string | null {
  switch (proposal.kind) {
    case "action.comment":
      return proposal.comment.actionId;
    case "action.commit":
    case "action.withdraw":
      return proposal.actionId;
    case "action.resolve":
      return proposal.resolution.actionId;
    case "scene-presence":
      return proposal.actionId;
    case "mechanics":
      return proposal.actionId;
    case "narration":
      return proposal.narration.actionIds[0] ?? null;
    case "action.declare":
      return proposal.action.actionId;
    case "intent":
      return proposal.intent.id;
    default:
      return null;
  }
}

function detailsOf(
  proposal: Proposal,
  party: readonly PartyMemberView[],
  suggestions: readonly SuggestionView[] = [],
): Detail[] {
  const who = (id: string | null) => characterLabel(id, party) ?? "None";
  switch (proposal.kind) {
    case "talk":
      return [
        { label: "Text", value: proposal.talk.text },
        {
          label: "Channel",
          value:
            proposal.talk.channel === "ic"
              ? "In character"
              : "Out of character",
        },
        { label: "Speaker", value: who(proposal.talk.characterId) },
        { label: "Visibility", value: visibilityLabel(proposal.visibility) },
      ];
    case "action.declare":
      return [
        { label: "Action", value: proposal.action.text },
        { label: "Character", value: who(proposal.action.characterId) },
        { label: "Scope", value: proposal.action.scope },
      ];
    case "action.comment":
      return [
        { label: "Stance", value: proposal.comment.stance },
        { label: "Comment", value: proposal.comment.text },
      ];
    case "action.commit":
    case "action.withdraw":
      return [{ label: "Action", value: proposal.actionId }];
    case "action.resolve":
      return [
        { label: "Outcome", value: proposal.resolution.outcome },
        {
          label: "Batches",
          value: String(proposal.resolution.batchIds.length),
        },
      ];
    case "mechanics": {
      const cmd = proposal.command as
        | { type?: unknown; reason?: unknown }
        | null
        | undefined;
      const rows: Detail[] = [
        {
          label: "Command",
          value: typeof cmd?.type === "string" ? cmd.type : "unknown",
        },
      ];
      if (typeof cmd?.reason === "string") {
        rows.push({ label: "Reason", value: cmd.reason });
      }
      rows.push({
        label: "Visibility",
        value: visibilityLabel(proposal.visibility),
      });
      return rows;
    }
    case "narration":
      return [
        { label: "Text", value: proposal.narration.text },
        { label: "Visibility", value: visibilityLabel(proposal.visibility) },
      ];
    case "table-mode":
      return [
        { label: "Reason", value: proposal.reason },
        {
          label: "Mode",
          value:
            proposal.after.mode === "free"
              ? "Free"
              : `Turn, ${actorLabel(proposal.after.activeActor, party, "")} first`,
        },
      ];
    case "scene":
      return [
        { label: "Reason", value: proposal.reason },
        {
          label: "Scene",
          value: proposal.after ? proposal.after.title : "Clear the scene",
        },
      ];
    case "party":
      return [
        { label: "Reason", value: proposal.reason },
        {
          label: "Member",
          value: proposal.after
            ? proposal.after.name
            : `Remove ${who(proposal.characterId)}`,
        },
      ];
    case "tracker":
      return [
        { label: "Reason", value: proposal.reason },
        {
          label: "Tracker",
          value: proposal.after
            ? `${proposal.after.name} (${proposal.after.filled}/${proposal.after.segments})`
            : "Remove the tracker",
        },
        { label: "Visibility", value: "DM only" },
      ];
    case "scene-presence":
      return [
        { label: "Actor", value: who(proposal.actorId) },
        { label: "Reason", value: proposal.reason },
        {
          label: "New value",
          value: REASON_TO_PRESENCE[proposal.reason],
        },
        { label: "Visibility", value: "Everyone" },
      ];
    case "journal":
      return [
        { label: "Title", value: proposal.entry.title },
        { label: "Entry", value: proposal.entry.body },
        { label: "Visibility", value: visibilityLabel(proposal.visibility) },
      ];
    case "floor":
      return [
        { label: "Request", value: FLOOR_OP_LABEL[proposal.op] },
        { label: "Reason", value: proposal.reason },
        { label: "Visibility", value: "Everyone" },
      ];
    case "intent":
      return [
        { label: "Intent", value: proposal.intent.kind },
        { label: "Text", value: toText(proposal.intent) },
      ];
    case "action.suggest":
      return [
        { label: "Read seq", value: String(proposal.suggestion.readSeq) },
        ...proposal.suggestion.items.flatMap((item, n) => [
          {
            label: `Item ${n + 1}`,
            value: `${item.text} — ${kindLabel(item.intent.kind)}`,
          },
          { label: `Item ${n + 1} as typed`, value: toText(item.intent) },
        ]),
      ];
    case "action.accept": {
      const item = suggestions
        .find((s) => s.suggestionId === proposal.suggestionId)
        ?.items.find((i) => i.itemId === proposal.itemId);
      return [
        { label: "Suggestion", value: proposal.suggestionId },
        { label: "Item", value: proposal.itemId },
        ...(item ? [{ label: "Text", value: item.text }] : []),
      ];
    }
  }
}

function toView(
  view: ProposalView,
  party: readonly PartyMemberView[],
  suggestions: readonly SuggestionView[],
): PendingProposalView {
  const { proposal } = view;
  const details = detailsOf(proposal, party, suggestions);
  if (proposal.rationale) {
    details.push({ label: "Rationale", value: proposal.rationale });
  }
  return {
    proposalId: view.proposalId,
    kind: proposal.kind,
    policy: view.policy,
    summary: proposal.summary ?? `${proposal.kind} proposal`,
    proposer: view.proposer,
    proposerLabel: actorLabel(view.proposer, party, ""),
    actionId: actionIdOf(proposal),
    details,
    createdSeq: view.createdSeq,
    ts: view.ts,
  };
}

/**
 * Pending proposals from TASK-0045's `proposal.*` events (the DM projection's `proposals`),
 * oldest first. The server delivers those rows only to the seated human DM, and a player
 * viewer's fold drops them, so a player always gets `[]`.
 */
export const selectPendingProposals: SelectPendingProposals = (
  events,
  viewer,
) => {
  if (viewer.role !== "dm") return [];
  const p = project(events, viewer);
  return pendingProposals(p)
    .map((view) => toView(view, p.party, p.suggestions))
    .sort((a, b) => a.createdSeq - b.createdSeq);
};
