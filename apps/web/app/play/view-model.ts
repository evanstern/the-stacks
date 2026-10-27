import {
  type ActionAuthority,
  type ActionView,
  currentTurn,
  floorHeld,
  type PartyMemberView,
  type SessionProjections,
  type TableMode,
  type TurnRef,
} from "@the-stacks/session-model";
import { type CommitAuthority, commitAuthorityFor } from "./authority.ts";
import { actorLabel, characterLabel } from "./labels.ts";
import { type LedgerItem, toLedgerItems } from "./ledger-format.ts";
import type { PendingProposalView } from "./proposals.ts";
import { type SignoffRowView, signoffRows } from "./signoff.ts";

export interface OrderEntry {
  combatantId: string;
  label: string;
  isActive: boolean;
  isNext: boolean;
  /** The viewer controls this combatant's character. */
  isViewer: boolean;
}

export type ModeView =
  | { mode: "free" }
  | {
      mode: "turn";
      activeActor: string;
      activeLabel: string;
      isViewersTurn: boolean;
      /** The seated human DM holds the floor (spec 049). */
      held: boolean;
      /** One entry per combatant in initiative order; [] with no encounter. */
      order: OrderEntry[];
    };

/** Which floor buttons this viewer sees, and the turn each request carries. */
export interface FloorControls {
  endTurn: boolean;
  pass: boolean;
  take: boolean;
  return: boolean;
  turn: TurnRef | null;
}

export interface ActionCardView {
  actionId: string;
  characterLabel: string | null;
  actorLabel: string;
  scope: "character" | "party";
  text: string;
  status: ActionView["status"];
  comments: {
    seq: number;
    actorLabel: string;
    stance: "comment" | "approve" | "object";
    text: string;
  }[];
  /** Status is declared or discussed. */
  open: boolean;
  /** The viewer may withdraw this open action: its declarer, or the seated DM. */
  canWithdraw: boolean;
  /** The viewer's own open character action in turn mode while another player is active. */
  commitsOnOwnTurn: boolean;
  /** The comment input reads "Suggest an alternative": a party member on the active player's action. */
  suggest: boolean;
  commit: ViewCommitAuthority;
  /** Per-player sign-off rows; null for character scope, closed actions and one-human parties. */
  signoff: SignoffRowView[] | null;
  committed: { actorLabel: string; authority: ActionAuthority } | null;
  resolved: {
    outcome: "applied" | "refused" | "no-effect";
    refusalCode: string | null;
  } | null;
}

export type ViewCommitAuthority =
  | { canCommit: true; authority: ActionAuthority }
  | { canCommit: false; holderLabel: string | null };

export type TranscriptItem =
  | {
      kind: "talk";
      seq: number;
      actorLabel: string;
      text: string;
      channel: "ic" | "ooc";
      characterLabel: string | null;
      whisper: boolean;
    }
  | { kind: "narration"; seq: number; text: string }
  | { kind: "action"; seq: number; card: ActionCardView }
  | { kind: "floor"; seq: number; text: string };

export interface ComposerView {
  characters: { characterId: string; label: string }[];
  actionAvailable: boolean;
  actionHint: string | null;
}

export interface TableViewModel {
  scene: { title: string; location: string | null } | null;
  mode: ModeView;
  floor: FloorControls;
  transcript: TranscriptItem[];
  ledger: LedgerItem[];
  proposals: PendingProposalView[];
  composer: ComposerView;
  hiddenCount: number;
  isDm: boolean;
}

export interface ViewModelInput {
  /** The actor id this viewer writes as. */
  actor: string;
  proposals: readonly PendingProposalView[];
  /** User ids at the table; null or omitted when presence is unknown. */
  present?: readonly string[] | null;
}

function toViewAuthority(
  commit: CommitAuthority,
  label: (actorId: string) => string,
): ViewCommitAuthority {
  return commit.canCommit
    ? commit
    : {
        canCommit: false,
        holderLabel: commit.holder === null ? null : label(commit.holder),
      };
}

/** The name the badge and the floor line use for the actor whose turn it is. */
function turnLabel(
  mode: Extract<TableMode, { mode: "turn" }>,
  party: readonly PartyMemberView[],
  viewerActor: string,
): string {
  const byCharacter =
    mode.activeCharacterId === null
      ? undefined
      : party.find((m) => m.characterId === mode.activeCharacterId);
  return byCharacter?.name ?? actorLabel(mode.activeActor, party, viewerActor);
}

function isOpen(status: ActionView["status"]): boolean {
  return status === "declared" || status === "discussed";
}

/** Every value the table renders, derived from the projections. Pure and total. */
export function toTableViewModel(
  p: SessionProjections,
  input: ViewModelInput,
): TableViewModel {
  const { viewer, party, tableMode } = p;
  const isDm = viewer.role === "dm";
  const label = (actorId: string) => actorLabel(actorId, party, input.actor);
  const present = input.present ?? null;

  const held = floorHeld(p);
  const turn = currentTurn(p);
  let mode: ModeView = { mode: "free" };
  if (tableMode.mode === "turn") {
    const encounter = p.encounter;
    const next =
      encounter && encounter.order.length > 1
        ? encounter.order[(encounter.turnIndex + 1) % encounter.order.length]
        : undefined;
    const order: OrderEntry[] = (encounter?.order ?? []).map((o) => {
      const member = party.find((m) => m.combatantId === o.combatantId);
      return {
        combatantId: o.combatantId,
        label: o.name,
        isActive: o.combatantId === encounter?.activeCombatantId,
        isNext: o.combatantId === next?.combatantId,
        isViewer:
          viewer.role === "player" &&
          member?.controller.kind === "player" &&
          member.controller.userId === viewer.userId,
      };
    });
    mode = {
      mode: "turn",
      activeActor: tableMode.activeActor,
      activeLabel: turnLabel(tableMode, party, ""),
      isViewersTurn:
        viewer.role === "player" && viewer.userId === tableMode.activeActor,
      held,
      order,
    };
  }
  const turnMode = mode.mode === "turn" && turn !== null;
  const dmControls = turnMode && isDm && p.gate.seat.kind === "human";
  const floor: FloorControls = {
    endTurn: turnMode && mode.mode === "turn" && mode.isViewersTurn && !held,
    pass: dmControls,
    take: dmControls && !held,
    return: dmControls && held,
    turn,
  };

  const actionsById = new Map(p.actions.map((a) => [a.actionId, a]));
  const transcript: TranscriptItem[] = [];
  for (const entry of p.transcript) {
    if (entry.kind === "talk") {
      transcript.push({
        kind: "talk",
        seq: entry.seq,
        actorLabel: label(entry.actor),
        text: entry.text,
        channel: entry.channel,
        characterLabel: characterLabel(entry.characterId, party),
        whisper: entry.visibility !== "public" && entry.visibility !== "dm",
      });
    } else if (entry.kind === "narration") {
      transcript.push({ kind: "narration", seq: entry.seq, text: entry.text });
    } else if (entry.kind === "action.declared") {
      const action = actionsById.get(entry.actionId);
      if (!action) continue;
      transcript.push({
        kind: "action",
        seq: entry.seq,
        card: {
          actionId: action.actionId,
          characterLabel: characterLabel(action.characterId, party),
          actorLabel: label(action.actor),
          scope: action.scope,
          text: action.text,
          status: action.status,
          comments: action.comments.map((c) => ({
            seq: c.seq,
            actorLabel: label(c.actor),
            stance: c.stance,
            text: c.text,
          })),
          open: isOpen(action.status),
          canWithdraw:
            isOpen(action.status) && (isDm || action.actor === input.actor),
          commitsOnOwnTurn:
            isOpen(action.status) &&
            action.scope === "character" &&
            tableMode.mode === "turn" &&
            viewer.role === "player" &&
            action.actor === viewer.userId &&
            tableMode.activeActor !== viewer.userId,
          suggest:
            isOpen(action.status) &&
            action.scope === "character" &&
            tableMode.mode === "turn" &&
            viewer.role === "player" &&
            party.some(
              (m) =>
                m.controller.kind === "player" &&
                m.controller.userId === viewer.userId,
            ) &&
            action.actor === tableMode.activeActor &&
            tableMode.activeActor !== viewer.userId,
          commit: toViewAuthority(
            commitAuthorityFor(action, tableMode, viewer, party, present),
            label,
          ),
          signoff: isOpen(action.status)
            ? signoffRows(action, party, present, viewer, label)
            : null,
          committed: action.committed
            ? {
                actorLabel: label(action.committed.actor),
                authority: action.committed.authority,
              }
            : null,
          resolved: action.resolved
            ? {
                outcome: action.resolved.outcome,
                refusalCode: action.resolved.refusalCode,
              }
            : null,
        },
      });
    }
  }

  for (const row of p.ledger) {
    if (row.kind !== "change" || row.type !== "table-mode.changed") continue;
    const after = row.after as TableMode;
    if (after.mode !== "turn") continue;
    const seat = p.gate.seat;
    const heldRow =
      seat.kind === "human" &&
      after.activeActor === seat.userId &&
      after.activeCharacterId === null;
    transcript.push({
      kind: "floor",
      seq: row.seq,
      text: heldRow
        ? "The DM has the floor"
        : viewer.role === "player" && after.activeActor === viewer.userId
          ? "Your turn"
          : `${turnLabel(after, party, input.actor)}'s turn`,
    });
  }
  transcript.sort((a, b) => a.seq - b.seq);

  const characters =
    viewer.role === "player"
      ? party
          .filter(
            (m) =>
              m.controller.kind === "player" &&
              m.controller.userId === viewer.userId,
          )
          .map((m) => ({ characterId: m.characterId, label: m.name }))
      : [];
  const actionAvailable = characters.length > 0;
  let actionHint: string | null = null;
  if (!actionAvailable) {
    actionHint = isDm
      ? "The DM commits or overrides actions; it does not declare them."
      : "You control no party character, so you cannot declare an action.";
  }

  const d = p.diagnostics;
  return {
    scene: p.scene
      ? { title: p.scene.title, location: p.scene.location }
      : null,
    mode,
    floor,
    transcript,
    ledger: toLedgerItems(p.ledger),
    proposals: isDm ? [...input.proposals] : [],
    composer: { characters, actionAvailable, actionHint },
    hiddenCount:
      d.skippedUnknownType + d.skippedUnknownVersion + d.skippedInvalid,
    isDm,
  };
}
