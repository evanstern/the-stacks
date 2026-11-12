import { type Intent, toText } from "@the-stacks/intent";
import {
  ABSENCE_PASS_REASON,
  type ActionAuthority,
  type ActionView,
  currentTurn,
  floorHeld,
  type PartyMemberView,
  type SessionProjections,
  suggestionState,
  type TableMode,
  type TurnRef,
} from "@the-stacks/session-model";
import { type CommitAuthority, commitAuthorityFor } from "./authority.ts";
import { actorLabel, characterLabel, kindLabel } from "./labels.ts";
import { type LedgerItem, toLedgerItems } from "./ledger-format.ts";
import type { PendingProposalView } from "./proposals.ts";
import { type SceneChangeView, sceneChangeView } from "./scene-seeds.ts";
import { type TableModeView, tableModeView } from "./table-mode.ts";

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
  /** Status is declared or discussed. */
  open: boolean;
  /** The viewer may withdraw this open action: its declarer, or the seated DM. */
  canWithdraw: boolean;
  commit: ViewCommitAuthority;
  committed: { actorLabel: string; authority: ActionAuthority } | null;
  resolved: {
    outcome: "applied" | "refused" | "no-effect";
    refusalCode: string | null;
  } | null;
}

export type ViewCommitAuthority =
  | { canCommit: true; authority: ActionAuthority }
  | { canCommit: false; holderLabel: string | null };

/** One line of a DM confirm row (spec 066 FR-011, C-6). */
export interface ConfirmLine {
  itemId: string;
  text: string;
  kindLabel: string;
  /** `stale` and `missing` both read "Superseded". */
  state: "live" | "stale" | "confirmed";
  /** The viewer may 👍 this line: its character's controller, or any human for a party item. */
  canAccept: boolean;
  /** "Kestrel" or "the party" while the line is live and the viewer cannot accept; else null. */
  waitingOn: string | null;
}

export interface ConfirmView {
  suggestionId: string;
  readSeq: number;
  lines: ConfirmLine[];
}

export type TranscriptItem =
  | {
      kind: "talk";
      seq: number;
      actorLabel: string;
      text: string;
      channel: "ic" | "ooc";
      characterId: string | null;
      characterLabel: string | null;
      whisper: boolean;
      /** The line is a player's `@dm` question: highlighted (FR-019). */
      askDm: boolean;
      /** A human DM viewer may turn this `say` line into a suggestion (FR-019). */
      confirmable: boolean;
    }
  | { kind: "aside"; seq: number; text: string }
  | { kind: "confirm"; seq: number; confirm: ConfirmView }
  | {
      /** A player's Intent with no talk row of its own (a deed). */
      kind: "intent";
      seq: number;
      actorLabel: string;
      text: string;
      status: "declared" | "settled" | "needs_ruling" | "answered";
      /** Set for a human DM viewer on a `declared` Intent: **Confirm** sends it again. */
      declaredIntent: Intent | null;
    }
  | { kind: "narration"; seq: number; text: string }
  | { kind: "action"; seq: number; card: ActionCardView }
  | { kind: "floor"; seq: number; text: string };

export interface SpeakerOption {
  /** The character id; null for the DM and the out-of-character entry. */
  id: string | null;
  label: string;
  ooc: boolean;
}

export interface MentionOption {
  /** The text inserted: `@dm` or `@<id>`. */
  token: string;
  label: string;
  /** The actor id `@name` resolves to; null for `@dm`. */
  targetId: string | null;
}

export interface ComposerView {
  /** The viewer's characters (the DM: "DM") then "You (out of character)". No party entry (C-7). */
  speakers: SpeakerOption[];
  mentions: MentionOption[];
  mode: "free" | "turn";
  /** Turn mode and this player holds the turn: Enter commits (FR-022). */
  active: boolean;
  /** The viewer is the human DM. */
  dm: boolean;
  /** False when the viewer controls no party character and is not the DM. */
  canSend: boolean;
  hint: string | null;
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
  /** The seeds for the human DM's scene change; null for a player viewer. */
  sceneChange: SceneChangeView | null;
  /** The human DM's table-mode control state; null for a player viewer. */
  tableMode: TableModeView | null;
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

  const humanDm = isDm && p.gate.seat.kind === "human";
  const actionsById = new Map(p.actions.map((a) => [a.actionId, a]));
  const transcript: TranscriptItem[] = [];
  for (const entry of p.transcript) {
    if (entry.kind === "talk") {
      const carrier = p.intents.find(
        (v) => v.seq === entry.seq + 1 && v.actor === entry.actor,
      );
      if (entry.actor === "ai:dm" && entry.channel === "ooc") {
        transcript.push({ kind: "aside", seq: entry.seq, text: entry.text });
        continue;
      }
      transcript.push({
        kind: "talk",
        seq: entry.seq,
        actorLabel: label(entry.actor),
        text: entry.text,
        channel: entry.channel,
        characterId: entry.characterId,
        characterLabel: characterLabel(entry.characterId, party),
        whisper: entry.visibility !== "public" && entry.visibility !== "dm",
        askDm: carrier?.intent.kind === "ask_dm",
        confirmable:
          humanDm &&
          entry.channel === "ic" &&
          carrier?.intent.kind === "say" &&
          entry.characterId !== null,
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
          open: isOpen(action.status),
          canWithdraw:
            isOpen(action.status) && (isDm || action.actor === input.actor),
          // FR-023: no player holds a Commit in turn mode; Enter commits (the DM's stays).
          commit:
            tableMode.mode === "turn" && viewer.role === "player"
              ? { canCommit: false, holderLabel: null }
              : toViewAuthority(
                  commitAuthorityFor(action, tableMode, viewer, party, present),
                  label,
                ),
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
    const absent =
      row.actor === "ai:dm" &&
      row.reason === ABSENCE_PASS_REASON &&
      row.before !== null &&
      typeof row.before === "object" &&
      (row.before as TableMode).mode === "turn"
        ? (row.before as Extract<TableMode, { mode: "turn" }>)
        : null;
    const heldRow =
      seat.kind === "human" &&
      after.activeActor === seat.userId &&
      after.activeCharacterId === null;
    transcript.push({
      kind: "floor",
      seq: row.seq,
      text: heldRow
        ? "The DM has the floor"
        : absent?.activeCharacterId
          ? `${turnLabel(absent, party, input.actor)} is away; ${
              viewer.role === "player" && after.activeActor === viewer.userId
                ? "your turn."
                : `the turn passes to ${turnLabel(after, party, input.actor)}.`
            }`
          : viewer.role === "player" && after.activeActor === viewer.userId
            ? "Your turn"
            : `${turnLabel(after, party, input.actor)}'s turn`,
    });
  }
  const mineOf = (characterId: string): boolean =>
    viewer.role === "player" &&
    party.some(
      (m) =>
        m.characterId === characterId &&
        m.controller.kind === "player" &&
        m.controller.userId === viewer.userId,
    );
  const humanController = (characterId: string): boolean =>
    party.some(
      (m) => m.characterId === characterId && m.controller.kind === "player",
    );
  for (const sug of p.suggestions) {
    const lines: ConfirmLine[] = sug.items.map((item) => {
      const st = suggestionState(p, item.intent.id);
      const state = st === "missing" ? "stale" : st;
      const who = item.intent.actor;
      const partyItem =
        item.intent.kind === "attempt" && item.intent.params.scope === "party";
      const canAccept =
        state === "live" &&
        viewer.role === "player" &&
        (partyItem
          ? party.some(
              (m) =>
                m.controller.kind === "player" &&
                m.controller.userId === viewer.userId,
            )
          : who.kind === "pc" && mineOf(who.id));
      return {
        itemId: item.itemId,
        text: item.text,
        kindLabel: kindLabel(item.intent.kind),
        state,
        canAccept,
        waitingOn:
          state === "live" && !canAccept
            ? partyItem
              ? "the party"
              : who.kind === "pc" && humanController(who.id)
                ? (characterLabel(who.id, party) ?? who.id)
                : null
            : null,
      };
    });
    transcript.push({
      kind: "confirm",
      seq: sug.seq,
      confirm: { suggestionId: sug.suggestionId, readSeq: sug.readSeq, lines },
    });
  }
  const suggestionIds = p.suggestions.map((s) => `${s.suggestionId}.`);
  const NO_ROW = new Set(["say", "say_to", "emote", "ooc", "party", "ask_dm"]);
  for (const v of p.intents) {
    if (
      v.intent.actor.kind !== "pc" ||
      NO_ROW.has(v.intent.kind) ||
      suggestionIds.some((id) => v.id.startsWith(id)) ||
      p.actions.some((a) => v.id.startsWith(`${a.actionId}.`))
    ) {
      continue;
    }
    transcript.push({
      kind: "intent",
      seq: v.seq,
      actorLabel: label(v.actor),
      text: toText(v.intent),
      status: v.status,
      declaredIntent:
        humanDm && v.status === "declared" ? (v.intent as Intent) : null,
    });
  }
  transcript.sort((a, b) => a.seq - b.seq);

  const controlled =
    viewer.role === "player"
      ? party.filter(
          (m) =>
            m.controller.kind === "player" &&
            m.controller.userId === viewer.userId,
        )
      : [];
  const speakers: SpeakerOption[] = [
    ...(isDm ? [{ id: null, label: "DM", ooc: false }] : []),
    ...controlled.map((m) => ({
      id: m.characterId,
      label: m.name,
      ooc: false,
    })),
    { id: null, label: "You (out of character)", ooc: true },
  ];
  const mentions: MentionOption[] = [
    { token: "@dm", label: "DM", targetId: null },
    ...party.map((m) => ({
      token: `@${m.characterId}`,
      label: m.name,
      targetId: m.characterId,
    })),
    ...(p.encounter?.order ?? [])
      .filter((o) => !party.some((m) => m.combatantId === o.combatantId))
      .map((o) => ({
        token: `@${o.combatantId}`,
        label: o.name,
        targetId: o.combatantId,
      })),
  ];
  const canSend = isDm || controlled.length > 0;

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
    composer: {
      speakers,
      mentions,
      mode: tableMode.mode,
      active: mode.mode === "turn" && mode.isViewersTurn,
      dm: isDm,
      canSend,
      hint: canSend
        ? null
        : "You control no party character, so you cannot send a line.",
    },
    hiddenCount:
      d.skippedUnknownType + d.skippedUnknownVersion + d.skippedInvalid,
    isDm,
    sceneChange: isDm
      ? sceneChangeView(p, new Set(input.proposals.map((v) => v.proposalId)))
      : null,
    tableMode: isDm ? tableModeView(p) : null,
  };
}
