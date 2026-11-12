import { parse, toText } from "@the-stacks/intent";
import {
  type Proposal,
  type Proposer,
  RefIdSchema,
  type SessionProjections,
} from "@the-stacks/session-model";
import { z } from "zod";
import type { Gateway } from "../ai/gateway.js";
import type { Gate } from "../gate/index.js";
import type { CompanionJobInput } from "./jobs.js";
import { stampIntent } from "./nodes/interpret.js";
import { CompanionIntentBodySchema, HOLD_ACT_TEXT } from "./nodes/schemas.js";
import { callJson } from "./pipeline/call.js";
import type { ModelCallRecord, RecordedCall } from "./pipeline/context.js";
import { buildCompanionPrompt, PROMPT_VERSION } from "./prompts/companion.js";
import { PURPOSE_OF } from "./purposes.js";
import type { SceneSeed } from "./seed/schema.js";
import { playerFacingSeed } from "./seed/views.js";
import { buildSnapshot, SnapshotOverflowError } from "./snapshot/index.js";

/**
 * AI companions (contracts/companions.md): party members whose controller is
 * `ai-companion`. A companion passes through the same permission matrix and
 * commit authority as a human player. This module and `nodes/resolve.ts` and
 * `chronicle.ts` are the only files under `dm/` that call `gate.submit`.
 */

export const CompanionOutput = z.object({
  say: z.string().min(1).max(400).nullable(),
  comment: z
    .object({
      actionId: RefIdSchema,
      stance: z.enum(["approve", "object", "comment"]),
      text: z.string().min(1).max(400),
    })
    .nullable(),
  act: z
    .object({ text: z.string().min(1).max(400), commit: z.boolean() })
    .nullable(),
  /** One decision per own open action (specs/036-companion-react FR-010, FR-011). */
  pending: z
    .array(
      z
        .object({
          actionId: RefIdSchema,
          decision: z.enum(["commit", "withdraw", "revise"]),
          text: z.string().min(1).max(400).nullable(),
        })
        .refine((d) => d.decision !== "revise" || d.text !== null, {
          message: "a revise decision carries the new text",
          path: ["text"],
        }),
    )
    .max(4),
  /** Spec 107: typed Intent bodies for the companion's own turn, in order. */
  turn: z.array(CompanionIntentBodySchema).max(3).nullable().default(null),
});
export type CompanionOutput = z.infer<typeof CompanionOutput>;

export { HOLD_ACT_TEXT };

export interface CompanionSubmission {
  kind: string;
  ok: boolean;
  code: string | null;
  /** The seqs the gate returned, ascending; `[]` on a refusal. */
  seqs: number[];
}

export interface CompanionPlay {
  companionId: string;
  status: "played" | "skipped" | "invalid-output" | "error";
  submissions: CompanionSubmission[];
}

export interface CompanionResult {
  plays: CompanionPlay[];
  calls: ModelCallRecord[];
}

export interface CompanionDeps {
  gateway: Pick<Gateway, "chat">;
  gate: Pick<Gate, "submit">;
  loadProjections: (sessionId: string) => Promise<SessionProjections>;
  loadSeed: (seedId: string) => SceneSeed;
  /** Ends a `hold`: upserts the session's queued turn job with forceResolve. */
  enqueueTurnForced: (sessionId: string) => Promise<unknown>;
  /** True while this worker holds the lease. */
  fence: () => Promise<boolean>;
  log: (line: Record<string, unknown>) => void;
  recordCall?: (call: RecordedCall) => Promise<void>;
}

export const companionActor = (id: string) => `ai:companion:${id}` as const;

function nextActionId(
  p: SessionProjections,
  companionId: string,
  also: ReadonlySet<string> = new Set(),
): string {
  const prefix = `act-${companionId}-`;
  let n = 0;
  for (const a of p.actions) {
    if (a.actionId.startsWith(prefix)) n += 1;
  }
  let id = `${prefix}${n + 1}`;
  const taken = new Set([...p.actions.map((a) => a.actionId), ...also]);
  while (taken.has(id)) {
    n += 1;
    id = `${prefix}${n + 1}`;
  }
  return id.slice(0, 64);
}

type ActionView = SessionProjections["actions"][number];

const isOpen = (a: ActionView) =>
  a.status === "declared" || a.status === "discussed";

/** The companion's own open actions, oldest first. */
function ownOpenActions(
  p: SessionProjections,
  companionId: string,
): ActionView[] {
  return p.actions
    .filter((a) => a.actor === companionActor(companionId) && isOpen(a))
    .sort((a, b) => a.declaredSeq - b.declaredSeq);
}

/** FR-009: a human comment newer than the companion's own last event on the action. */
function hasUnansweredReaction(a: ActionView, companionId: string): boolean {
  const me = companionActor(companionId);
  const ownLast = Math.max(
    a.declaredSeq,
    ...a.comments.filter((c) => c.actor === me).map((c) => c.seq),
  );
  return a.comments.some((c) => !c.actor.startsWith("ai:") && c.seq > ownLast);
}

/** FR-012: `withdraw` when the latest human stance on the action is `object`, else `commit`. */
function defaultDecision(a: ActionView): "commit" | "withdraw" {
  const human = a.comments.filter((c) => !c.actor.startsWith("ai:"));
  return human.at(-1)?.stance === "object" ? "withdraw" : "commit";
}

function isActive(p: SessionProjections, companionId: string): boolean {
  return (
    p.tableMode.mode === "turn" &&
    p.tableMode.activeActor === companionActor(companionId)
  );
}

const ACT_TEXT_MAX = 2000;

/**
 * Spec 107 D5: stamp each body for the companion, check the text round trip, and join the
 * lines. `ok: false` for no turn, a refused stamp, a lossy round trip or an over-long text.
 */
function turnText(
  turn: CompanionOutput["turn"],
  companionId: string,
  actionId: string,
): { ok: true; text: string } | { ok: false; path: string } {
  if (!turn || turn.length === 0) return { ok: false, path: "turn" };
  const actor = { kind: "companion", id: companionId } as const;
  const lines: string[] = [];
  for (const [n, body] of turn.entries()) {
    const stamp = {
      id: `${actionId}.${n}`,
      actor,
      source: "ai",
      commit: "declared",
    } as const;
    const stamped = stampIntent(body, stamp);
    if (!stamped.ok) return { ok: false, path: `turn.${n}.${stamped.path}` };
    const text = toText(stamped.intent);
    const again = parse(text, stamp);
    if (
      !again.ok ||
      JSON.stringify(again.intent) !== JSON.stringify(stamped.intent)
    ) {
      return { ok: false, path: `turn.${n}.round-trip` };
    }
    lines.push(text);
  }
  const text = lines.join("\n");
  return text.length > ACT_TEXT_MAX
    ? { ok: false, path: "turn.length" }
    : { ok: true, text };
}

export async function runCompanionJob(
  deps: CompanionDeps,
  job: { id: string; input: CompanionJobInput },
  signal: AbortSignal,
): Promise<CompanionResult> {
  const { sessionId, companions, reason } = job.input;
  const plays: CompanionPlay[] = [];
  const calls: ModelCallRecord[] = [];

  for (const companionId of companions) {
    if (signal.aborted || !(await deps.fence())) break;
    const projections = await deps.loadProjections(sessionId);
    const member = projections.party.find(
      (m) =>
        m.characterId === companionId &&
        m.controller.kind === "ai-companion" &&
        m.controller.actor === companionActor(companionId),
    );
    const life = member?.combatant?.lifeState;
    if (
      !member ||
      !projections.scene ||
      life === "dead" ||
      life === "unconscious" ||
      life === "stable"
    ) {
      plays.push({ companionId, status: "skipped", submissions: [] });
      continue;
    }
    let seed: SceneSeed;
    try {
      seed = deps.loadSeed(projections.scene.sceneId);
    } catch {
      plays.push({ companionId, status: "skipped", submissions: [] });
      continue;
    }

    const ownOpen = ownOpenActions(projections, companionId);
    if (
      reason === "react" &&
      !ownOpen.some((a) => hasUnansweredReaction(a, companionId))
    ) {
      plays.push({ companionId, status: "skipped", submissions: [] });
      continue;
    }

    const active = isActive(projections, companionId);
    const turnMode = projections.tableMode.mode === "turn";
    let prompt: ReturnType<typeof buildCompanionPrompt>;
    try {
      prompt = buildCompanionPrompt({
        seed: playerFacingSeed(seed),
        projections,
        snapshot: buildSnapshot(projections, seed),
        characterId: companionId,
        active,
        ownOpenActionIds: ownOpen.map((a) => a.actionId),
      });
    } catch (error) {
      if (!(error instanceof SnapshotOverflowError)) throw error;
      deps.log({
        event: "dm.companion.state-overflow",
        jobId: job.id,
        companionId,
        ...error.detail,
      });
      plays.push({ companionId, status: "error", submissions: [] });
      continue;
    }
    const result = await callJson(deps, {
      purpose: PURPOSE_OF.companion,
      promptVersion: PROMPT_VERSION,
      system: prompt.system,
      user: prompt.user,
      signal,
      schema: CompanionOutput,
    });
    calls.push(...result.calls);

    let output: CompanionOutput;
    let playStatus: CompanionPlay["status"] = "played";
    if (result.ok) {
      output = result.value;
    } else if (
      result.error.kind === "invalid-output" &&
      ((active && turnMode) || ownOpen.length > 0)
    ) {
      // The active companion must still advance the turn, and an open action
      // must still get its default decision (FR-012).
      output = { say: null, comment: null, act: null, pending: [], turn: null };
      if (!(active && turnMode)) playStatus = "invalid-output";
    } else {
      plays.push({
        companionId,
        status:
          result.error.kind === "invalid-output" ? "invalid-output" : "error",
        submissions: [],
      });
      continue;
    }

    // A new act is dropped while the companion had an open action: the run
    // addresses that action first (FR-013).
    if (ownOpen.length > 0 && output.act !== null) {
      deps.log({
        event: "dm.companion.act-dropped",
        jobId: job.id,
        companionId,
        openActionIds: ownOpen.map((a) => a.actionId),
      });
      output = { ...output, act: null };
    }

    // The active companion in turn mode MUST act and commit. With an open
    // action of its own it commits that action instead (FR-014).
    if (active && turnMode && ownOpen.length === 0) {
      // Spec 107 D5: the typed `turn` becomes slash lines; a bad turn takes the hold act.
      const declared = turnText(
        output.turn,
        companionId,
        nextActionId(projections, companionId),
      );
      if (declared.ok) {
        output = { ...output, act: { text: declared.text, commit: true } };
      } else {
        // A null turn (even with an `act`) holds silently otherwise; log it so a playtest sees it.
        deps.log({
          event: "dm.companion.turn-invalid",
          jobId: job.id,
          companionId,
          ...(output.turn === null
            ? { reason: "missing-turn" }
            : { path: declared.path }),
        });
        output = { ...output, act: { text: HOLD_ACT_TEXT, commit: true } };
      }
    }

    const submissions: CompanionSubmission[] = [];
    let committed = false;
    const proposer: Proposer = {
      kind: "ai",
      actor: companionActor(companionId),
    };
    const send = async (proposal: Proposal): Promise<boolean> => {
      if (!(await deps.fence())) return false;
      const res = await deps.gate.submit(sessionId, proposer, proposal);
      if (res.ok && proposal.kind === "action.commit") committed = true;
      submissions.push({
        kind: proposal.kind,
        ok: res.ok,
        code: res.ok ? null : res.refusal.code,
        seqs: res.ok ? res.events.map((e) => e.seq).sort((a, b) => a - b) : [],
      });
      if (!res.ok) {
        deps.log({
          event: "dm.companion.refused",
          jobId: job.id,
          companionId,
          kind: proposal.kind,
          code: res.refusal.code,
        });
      }
      return res.ok;
    };

    if (output.say !== null) {
      await send({
        kind: "talk",
        summary: null,
        rationale: null,
        talk: { text: output.say, channel: "ic", characterId: companionId },
        visibility: "public",
      });
    }
    if (output.comment !== null) {
      const open = projections.actions.find(
        (a) =>
          a.actionId === output.comment?.actionId &&
          a.status !== "resolved" &&
          a.status !== "withdrawn",
      );
      if (open) {
        await send({
          kind: "action.comment",
          summary: null,
          rationale: null,
          comment: {
            actionId: open.actionId,
            stance: output.comment.stance,
            text: output.comment.text,
          },
        });
      }
    }
    // One decision per own open action (FR-011, FR-012). A commit needs turn
    // authority (FR-014); a withdraw or revise does not.
    const mayCommit = !turnMode || active;
    const decisions = new Map(output.pending.map((d) => [d.actionId, d]));
    const minted = new Set<string>();
    for (const open of ownOpen) {
      const explicit = decisions.get(open.actionId);
      const decision = explicit?.decision ?? defaultDecision(open);
      if (!explicit) {
        deps.log({
          event: "dm.companion.default-decision",
          jobId: job.id,
          companionId,
          actionId: open.actionId,
          decision,
        });
      }
      if (decision === "commit") {
        if (mayCommit) {
          await send({
            kind: "action.commit",
            summary: null,
            rationale: null,
            actionId: open.actionId,
          });
        }
        continue;
      }
      const withdrawn = await send({
        kind: "action.withdraw",
        summary: null,
        rationale: null,
        actionId: open.actionId,
      });
      if (decision === "revise" && withdrawn && explicit?.text) {
        const revisedId = nextActionId(projections, companionId, minted);
        minted.add(revisedId);
        const declared = await send({
          kind: "action.declare",
          summary: null,
          rationale: null,
          action: {
            actionId: revisedId,
            characterId: open.characterId,
            scope: open.scope,
            text: explicit.text,
          },
        });
        if (declared && mayCommit) {
          await send({
            kind: "action.commit",
            summary: null,
            rationale: null,
            actionId: revisedId,
          });
        }
      }
    }
    // Phase 3b: the active companion in turn mode that started with an open
    // action and committed nothing (it withdrew) still ends its turn: it takes
    // the hold act, as an active companion with no open action does.
    if (
      active &&
      turnMode &&
      ownOpen.length > 0 &&
      !committed &&
      output.act === null
    ) {
      output = { ...output, act: { text: HOLD_ACT_TEXT, commit: true } };
    }
    if (output.act !== null) {
      const actionId = nextActionId(projections, companionId, minted);
      const declared = await send({
        kind: "action.declare",
        summary: null,
        rationale: null,
        action: {
          actionId,
          characterId: companionId,
          scope: "character",
          text: output.act.text,
        },
      });
      if (declared && output.act.commit) {
        await send({
          kind: "action.commit",
          summary: null,
          rationale: null,
          actionId,
        });
      }
    }
    plays.push({ companionId, status: playStatus, submissions });
  }

  if (reason === "hold" && !signal.aborted) {
    await deps.enqueueTurnForced(sessionId);
  }
  return { plays, calls };
}
