import { hasCountClaim, STOCK_ENDING } from "../audit-words.js";
import { type ClaimState, checkClaims } from "../claims.js";
import {
  buildNarrationFacts,
  type NarrationFacts,
  nothingToNarrate,
  renderDiceLines,
} from "../facts.js";
import { openFollowUps, priorActionIds } from "../follow-ups.js";
import { callText } from "../pipeline/call.js";
import type {
  ModelCallRecord,
  Node,
  NodeError,
  TurnContext,
} from "../pipeline/context.js";
import { rosterOf } from "../prompts/common.js";
import { buildNarratePrompt, PROMPT_VERSION } from "../prompts/narrate.js";
import { PURPOSE_OF } from "../purposes.js";
import { playerFacingSeed } from "../seed/views.js";
import type { ActorSnapshot } from "../snapshot/index.js";
import type { AssembleOutput } from "./assemble.js";
import type { AuditIssue } from "./audit.js";

/**
 * The narrate node (contracts/nodes.md "narrate"). It receives resolved
 * results as facts built by code. It imports no engine value, no RNG and
 * nothing from `gate/` (AC #6; the import-graph test pins it). The model
 * writes digit-free prose; code renders the dice lines (FR-034).
 */

export const MAX_PROSE_CHARS = 1200;

export interface NarrateOutput {
  /** 1..1,200 characters; no digits (FR-034). Empty when skipped. */
  prose: string;
  /** Rendered by code from the facts, never by the model. */
  diceLines: string[];
  /** prose + "\n\n" + diceLines.join("\n"); what ships. */
  text: string;
  /** The ids of the actions this narration covers. */
  actionIds: string[];
  /** 1..3 */
  attempt: number;
  /** True when there was nothing to narrate (no model call was made). */
  skipped: boolean;
  facts: NarrationFacts;
  /**
   * Refused ruling and `goalNote` texts (spec 051, OQ-2). Always present;
   * empty when nothing was withheld. The audit node records them as advisory.
   */
  withheld: AuditIssue[];
}

/**
 * Checks the ruling texts and the `goalNote` once against S1 and the diff.
 * A refused ruling leaves the facts; a refused `goalNote` becomes "".
 */
export function withholdRefusedInputs(
  facts: NarrationFacts,
  state: ClaimState,
): { facts: NarrationFacts; withheld: AuditIssue[] } {
  const withheld: AuditIssue[] = [];
  const refuse = (label: string, text: string): boolean => {
    // An input text need not name this turn's death or drop, so omission
    // claims do not apply to it; the narration itself still owes them.
    const issues = checkClaims(state, text).issues.filter(
      (c) => c.claim !== "omission",
    );
    for (const c of issues) {
      withheld.push({
        kind: "ledger-mismatch",
        detail: `Actor state: withheld ${label}: ${c.detail}`,
      });
    }
    return issues.length > 0;
  };
  const rulings = facts.rulings.filter(
    (r) => !refuse(`ruling for ${r.actionId}`, r.ruling),
  );
  const actions = facts.actions.map((a) => ({
    ...a,
    followUps: a.followUps.filter(
      (f) => !refuse(`follow-up for ${a.actionId}`, f),
    ),
  }));
  const openFollowUps = facts.openFollowUps?.filter(
    (f) => !refuse(`open follow-up for ${f.name}`, f.text),
  );
  const npcSay = facts.npcTurn?.plan?.say;
  const dropSay = Boolean(npcSay) && refuse("monster line", npcSay as string);
  const refusedNote = refuse("goalNote", facts.director.goalNote);
  // TASK-0214: a count in the note restates DM-only seed text; withhold it.
  const countNote = !refusedNote && hasCountClaim(facts.director.goalNote);
  if (countNote) {
    withheld.push({
      kind: "doctrine",
      detail: `Withheld goalNote: it states a count ("${facts.director.goalNote.slice(0, 60)}").`,
    });
  }
  // TASK-0237: the note is written before the dice; a failed check may have falsified it.
  const failedCheck =
    !refusedNote &&
    !countNote &&
    Boolean(facts.director.goalNote) &&
    facts.actions.some((a) =>
      a.rolls.some((r) => r.band === "failure" || r.band === "severe-failure"),
    );
  if (failedCheck) {
    withheld.push({
      kind: "doctrine",
      detail:
        "Withheld goalNote: a check this beat failed, and the note was written before the dice.",
    });
  }
  const goalNote =
    refusedNote || countNote || failedCheck ? "" : facts.director.goalNote;
  return {
    facts: {
      ...facts,
      actions,
      ...(openFollowUps?.length ? { openFollowUps } : {}),
      rulings,
      ...(dropSay && facts.npcTurn?.plan
        ? {
            npcTurn: {
              ...facts.npcTurn,
              plan: { ...facts.npcTurn.plan, say: null },
            },
          }
        : {}),
      director: { ...facts.director, goalNote },
    },
    withheld,
  };
}

/**
 * Drops a trailing "What do you do?" sentence when a sentence end precedes it
 * (TASK-0214 R5). The audit's literal-ending check stays as the backstop for
 * prose with no earlier sentence.
 */
export function dropStockEnding(prose: string): string {
  const m = STOCK_ENDING.exec(prose.trim());
  if (!m) return prose;
  const t = prose.trim();
  // Strip the opening quote of a quoted stock line.
  const head = t
    .slice(0, m.index)
    .replace(/["'\u201c\u2018]+$/, "")
    .trimEnd();
  return /[.!?]["'\u201d\u2019]*$/.test(head) ? head : prose;
}

/** Cuts prose to the cap at a sentence end when one exists. */
export function clipProse(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_PROSE_CHARS) return trimmed;
  const cut = trimmed.slice(0, MAX_PROSE_CHARS);
  const end = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
  );
  return end > 200 ? cut.slice(0, end + 1) : cut;
}

export function composeText(
  prose: string,
  diceLines: readonly string[],
): string {
  return diceLines.length > 0 ? `${prose}\n\n${diceLines.join("\n")}` : prose;
}

export type AttemptResult =
  | { ok: true; prose: string; calls: ModelCallRecord[] }
  | { ok: false; error: NodeError; calls: ModelCallRecord[] };

/** One `dm.narrate` call; regeneration passes the prior text and issues. */
export async function narrateAttempt(
  ctx: TurnContext,
  assembled: AssembleOutput,
  facts: NarrationFacts,
  snapshot: ActorSnapshot,
  prior: { prose: string; issues: AuditIssue[] } | null,
): Promise<AttemptResult> {
  const prompt = buildNarratePrompt({
    seed: playerFacingSeed(ctx.seed),
    roster: rosterOf(ctx.deps ? assembled.projections.party : []),
    assembled,
    snapshot,
    facts,
    prior,
  });
  const result = await callText(ctx.deps, {
    purpose: PURPOSE_OF.narrate,
    promptVersion: PROMPT_VERSION,
    system: prompt.system,
    user: prompt.user,
    signal: ctx.signal,
  });
  if (!result.ok) return result;
  const clipped = clipProse(result.text);
  // A clarify question may end the prose; leave it whole.
  const prose = facts.clarify.length > 0 ? clipped : dropStockEnding(clipped);
  return { ok: true, prose, calls: result.calls };
}

export const narrate: Node<"narrate"> = async (ctx) => {
  const { assemble: assembled, director, resolve } = ctx.results;
  if (!assembled || !director || !resolve) {
    return {
      ok: false,
      node: "narrate",
      calls: [],
      error: { kind: "internal", message: "narrate ran before resolve" },
    };
  }
  const projections = await ctx.deps.loadProjections(ctx.job.sessionId);
  const clarify = (ctx.results.interpret?.readings ?? []).flatMap((r) =>
    r.actionId && r.clarify
      ? [{ actionId: r.actionId, question: r.clarify }]
      : [],
  );
  const followUps: Record<string, string[]> = {};
  for (const r of ctx.results.interpret?.readings ?? []) {
    if (r.actionId) followUps[r.actionId] = r.followUps;
  }
  for (const r of ctx.results.adjudicate?.rulings ?? []) {
    if (r.actionId) followUps[r.actionId] = r.followUps;
  }
  const reading = (ctx.results.interpret?.readings ?? []).find(
    (r) => r.actionId === null,
  );
  const npcRuling = (ctx.results.adjudicate?.rulings ?? []).find(
    (r) => r.actionId === null,
  );
  const npcPlan = reading
    ? {
        intent: reading.intent,
        steps: npcRuling?.steps ?? reading.steps,
        say: reading.say ?? null,
      }
    : null;
  // ponytail: reads every prior turn checkpoint of the session (one job-table read per narrate
  // when a member has an open action). Ceiling: a session with many turn jobs; upgrade is a
  // `limit` on `loadPriorTurnCheckpoints`.
  const beatIds = assembled.beat.map((b) => b.actionId);
  const prior =
    ctx.deps.loadPriorTurns && priorActionIds(projections, beatIds).size > 0
      ? await ctx.deps.loadPriorTurns(ctx.job.sessionId, ctx.job.id)
      : [];
  const open = openFollowUps(projections, prior, beatIds);
  const built = buildNarrationFacts({
    trigger: ctx.job.trigger,
    seed: playerFacingSeed(ctx.seed),
    beatNpcIds: (ctx.job.trigger === "scene-start"
      ? // Scene start (spec 076): the first beat's declaration, not the Director's beat.
        ctx.seed.npcs
          .map((n) => n.id)
          .filter((id) => ctx.seed.beats[0]?.presence[id] !== "absent")
      : (ctx.seed.beats.find((b) => b.id === director.pacing.beatId)?.npcIds ??
        assembled.presentNpcIds)
    ).filter(
      (id) =>
        resolve.snapshot.actors.find((a) => a.id === id)?.presence !== "absent",
    ),
    projections,
    beat: assembled.beat,
    director,
    adjudicate: ctx.results.adjudicate ?? null,
    resolve,
    presentNpcIds: assembled.presentNpcIds,
    modeBefore: assembled.projections.tableMode.mode,
    appendedRows: resolve.appendedRows,
    clarify,
    followUps,
    openFollowUps: open,
    npcPlan,
    turnActorId:
      assembled.projections.tableMode.mode === "turn"
        ? (assembled.projections.encounter?.activeCombatantId ?? null)
        : null,
  });
  const { facts, withheld } = withholdRefusedInputs(built, {
    snapshot: resolve.snapshot,
    diff: resolve.diff,
  });
  const actionIds = facts.actions.map((a) => a.actionId);

  if (nothingToNarrate(facts)) {
    return {
      ok: true,
      node: "narrate",
      calls: [],
      output: {
        prose: "",
        diceLines: [],
        text: "",
        actionIds,
        attempt: 1,
        skipped: true,
        facts,
        withheld,
      },
    };
  }

  const result = await narrateAttempt(
    ctx,
    assembled,
    facts,
    resolve.snapshot,
    null,
  );
  if (!result.ok) {
    return {
      ok: false,
      node: "narrate",
      error: result.error,
      calls: result.calls,
    };
  }
  const diceLines = renderDiceLines(facts);
  return {
    ok: true,
    node: "narrate",
    calls: result.calls,
    output: {
      prose: result.prose,
      diceLines,
      text: composeText(result.prose, diceLines),
      actionIds,
      attempt: 1,
      skipped: false,
      facts,
      withheld,
    },
  };
};
