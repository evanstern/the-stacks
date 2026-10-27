import type {
  ActionView,
  LedgerRow,
  SessionProjections,
  TranscriptEntry,
} from "@the-stacks/session-model";
import type { SrdKind } from "@the-stacks/srd";
import type { Node, NodeDeps, TurnContext } from "../pipeline/context.js";
import type { SceneSeed } from "../seed/schema.js";
import { type ActorSnapshot, buildSnapshot } from "../snapshot/index.js";

/**
 * The assemble node (contracts/nodes.md "assemble"): no model call, no write.
 * Freezes the beat, derives the NPC turn from state, selects the SRD compact
 * records the prompts will carry, and gathers what resolve needs to resume.
 */

export const TRANSCRIPT_TAIL = 20;
export const MAX_SRD_RECORDS = 8;
/** An action with this many rejected proposals is skipped (edge case "Twice-rejected action"). */
export const REJECTION_LIMIT = 2;

export interface BeatItem {
  actionId: string;
  committedSeq: number;
  actor: string;
  characterId: string | null;
  scope: "character" | "party";
  text: string;
  /** `resolved`: needs narration only (FR-004). */
  status: "committed" | "resolved";
}

export interface SrdSelection {
  kind: "monster" | "spell" | "condition";
  id: string;
  compact: string;
}

export interface AssembleOutput {
  projections: SessionProjections;
  /** S0: the actor snapshot at the start of the turn. */
  snapshot: ActorSnapshot;
  throughSeq: number;
  beat: BeatItem[];
  npcTurn: { combatantId: string; srdMonsterId: string | null } | null;
  presentNpcIds: string[];
  activeEncounterId: string | null;
  srdRecords: SrdSelection[];
  transcriptTail: TranscriptEntry[];
  priorSteps: Record<string, LedgerRow[]>;
  rejections: Record<string, number>;
}

/** Action ids a proposal names, for the narration and rejection scans. */
function proposalActionIds(
  p: SessionProjections["proposals"][number],
): string[] {
  const proposal = p.proposal;
  switch (proposal.kind) {
    case "narration":
      return proposal.narration.actionIds;
    case "action.resolve":
      return [proposal.resolution.actionId];
    case "mechanics":
      return proposal.actionId ? [proposal.actionId] : [];
    default:
      return [];
  }
}

function narratedActionIds(projections: SessionProjections): Set<string> {
  const ids = new Set<string>();
  for (const entry of projections.transcript) {
    if (entry.kind === "narration") {
      for (const id of entry.actionIds) ids.add(id);
    }
  }
  for (const p of projections.proposals) {
    if (p.status === "pending" && p.proposal.kind === "narration") {
      for (const id of p.proposal.narration.actionIds) ids.add(id);
    }
  }
  return ids;
}

function rejectionCounts(
  projections: SessionProjections,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of projections.proposals) {
    if (p.status !== "rejected") continue;
    for (const id of proposalActionIds(p)) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

function toBeatItem(a: ActionView): BeatItem | null {
  if (!a.committed) return null;
  if (a.status !== "committed" && a.status !== "resolved") return null;
  return {
    actionId: a.actionId,
    committedSeq: a.committed.seq,
    actor: a.actor,
    characterId: a.characterId,
    scope: a.scope,
    text: a.text,
    status: a.status,
  };
}

/** Rule 1 and 2: the beat on the first attempt, or the frozen one on a later attempt. */
function selectBeat(
  projections: SessionProjections,
  frozen: string[] | null,
  rejections: Record<string, number>,
): BeatItem[] {
  let items: BeatItem[];
  if (frozen !== null) {
    const byId = new Map(projections.actions.map((a) => [a.actionId, a]));
    items = frozen.flatMap((id) => {
      const a = byId.get(id);
      const item = a ? toBeatItem(a) : null;
      return item ? [item] : [];
    });
  } else {
    const narrated = narratedActionIds(projections);
    items = projections.actions.flatMap((a) => {
      const item = toBeatItem(a);
      if (!item) return [];
      if (item.status === "resolved" && narrated.has(item.actionId)) return [];
      return [item];
    });
  }
  return items
    .filter((i) => (rejections[i.actionId] ?? 0) < REJECTION_LIMIT)
    .sort((a, b) => a.committedSeq - b.committedSeq);
}

/** Rule 4: whose monster turn it is, from state alone. */
function deriveNpcTurn(
  projections: SessionProjections,
  seed: SceneSeed,
  beat: BeatItem[],
): AssembleOutput["npcTurn"] {
  const mode = projections.tableMode;
  const encounter = projections.encounter;
  if (mode.mode !== "turn" || mode.activeActor !== "ai:dm" || !encounter) {
    return null;
  }
  const active = encounter.order.find(
    (o) => o.combatantId === encounter.activeCombatantId,
  );
  if (active?.lifeState !== "conscious") return null;
  const owner = projections.party.find(
    (m) => m.combatantId === active.combatantId,
  );
  if (owner && beat.some((b) => b.characterId === owner.characterId)) {
    return null;
  }
  const monster = seed.encounters
    .flatMap((e) => e.monsters)
    .find((m) => m.combatantId === active.combatantId);
  return {
    combatantId: active.combatantId,
    srdMonsterId: monster?.srdMonsterId ?? null,
  };
}

/** The seed encounter whose monsters are in the engine state, if any. */
function deriveActiveEncounterId(
  projections: SessionProjections,
  seed: SceneSeed,
): string | null {
  if (!projections.encounter) return null;
  const inOrder = new Set(
    projections.encounter.order.map((o) => o.combatantId),
  );
  const found = seed.encounters.find((e) =>
    e.monsters.some((m) => inOrder.has(m.combatantId)),
  );
  return found?.id ?? null;
}

/** Candidate names: every 1..4 word window of the text. */
function nameWindows(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9' -]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= 4 && i + n <= words.length; n++) {
      out.push(words.slice(i, i + n).join(" "));
    }
  }
  return out;
}

/** Rule 5: monsters first, then spells and conditions named in the beat, up to the cap. */
function selectSrd(
  deps: Pick<NodeDeps, "srd">,
  projections: SessionProjections,
  seed: SceneSeed,
  beat: BeatItem[],
  npcTurn: AssembleOutput["npcTurn"],
  activeEncounterId: string | null,
): SrdSelection[] {
  const out: SrdSelection[] = [];
  const seen = new Set<string>();
  const add = (kind: SrdKind, id: string): void => {
    if (kind !== "monster" && kind !== "spell" && kind !== "condition") return;
    const key = `${kind}/${id}`;
    if (seen.has(key) || out.length >= MAX_SRD_RECORDS) return;
    const compact = deps.srd.compact(kind, id);
    if (compact === undefined) return;
    seen.add(key);
    out.push({ kind, id, compact });
  };

  const encounter = seed.encounters.find((e) => e.id === activeEncounterId);
  for (const m of encounter?.monsters ?? []) add("monster", m.srdMonsterId);
  if (npcTurn?.srdMonsterId) add("monster", npcTurn.srdMonsterId);

  const text = beat.map((b) => b.text).join(" . ");
  for (const window of nameWindows(text)) {
    const spell = deps.srd.getByName("spell", window);
    if (spell) add("spell", spell.id);
    const condition = deps.srd.getByName("condition", window);
    if (condition) add("condition", condition.id);
  }

  const onCombatants = new Set<string>();
  for (const member of projections.party) {
    for (const c of member.combatant?.conditions ?? []) {
      onCombatants.add(c.condition);
    }
  }
  for (const o of projections.encounter?.order ?? []) {
    for (const c of o.conditions) onCombatants.add(c.condition);
  }
  for (const key of onCombatants) {
    const condition = deps.srd.getById("condition", key);
    if (condition) add("condition", condition.id);
  }
  return out;
}

function priorStepsFor(
  projections: SessionProjections,
  beat: BeatItem[],
): Record<string, LedgerRow[]> {
  const out: Record<string, LedgerRow[]> = {};
  const ids = new Set(beat.map((b) => b.actionId));
  for (const row of projections.ledger) {
    if (row.actionId && ids.has(row.actionId)) {
      const rows = out[row.actionId] ?? [];
      rows.push(row);
      out[row.actionId] = rows;
    }
  }
  return out;
}

export const assemble: Node<"assemble"> = async (ctx: TurnContext) => {
  const projections = await ctx.deps.loadProjections(ctx.job.sessionId);
  const rejections = rejectionCounts(projections);
  const beat = selectBeat(projections, ctx.checkpoint.beat, rejections);
  const npcTurn = deriveNpcTurn(projections, ctx.seed, beat);
  const activeEncounterId = deriveActiveEncounterId(projections, ctx.seed);

  const presentNpcIds: string[] = [];
  for (const b of ctx.seed.beats) {
    for (const id of b.npcIds) {
      if (!presentNpcIds.includes(id)) presentNpcIds.push(id);
    }
  }

  return {
    ok: true,
    node: "assemble",
    calls: [],
    output: {
      projections,
      snapshot: buildSnapshot(projections, ctx.seed),
      throughSeq: projections.throughSeq,
      beat,
      npcTurn,
      presentNpcIds,
      activeEncounterId,
      srdRecords: selectSrd(
        ctx.deps,
        projections,
        ctx.seed,
        beat,
        npcTurn,
        activeEncounterId,
      ),
      transcriptTail: projections.transcript.slice(-TRANSCRIPT_TAIL),
      priorSteps: priorStepsFor(projections, beat),
      rejections,
    },
  };
};
