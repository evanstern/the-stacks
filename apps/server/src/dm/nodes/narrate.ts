import type { PlanFact } from "../fact-sheet.js";
import {
  buildFactSheet,
  clipProse,
  composeReply,
  dropStockEnding,
  type FactSheet,
  MAX_PROSE_CHARS,
  type NarrationSlots,
  parseSlots,
} from "../fact-sheet.js";
import {
  buildNarrationFacts,
  type NarrationFacts,
  nothingToNarrate,
} from "../facts.js";
import { openFollowUps } from "../follow-ups.js";
import { type CheckIssue, checkNarration } from "../narration-check.js";
import {
  createNarrationStream,
  type NarrationStream,
} from "../narration-stream.js";
import { hasCountClaim } from "../narration-words.js";
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
import { dmOnlySeedText, playerFacingSeed } from "../seed/views.js";
import type { ActorSnapshot } from "../snapshot/index.js";
import type { AssembleOutput } from "./assemble.js";
import { checkBase } from "./check.js";

/**
 * The narrate node (contracts/nodes.md "narrate"). It receives resolved
 * results as facts built by code. It imports no engine value, no RNG and
 * nothing from `gate/` (AC #6; the import-graph test pins it). The model
 * writes digit-free prose; code renders the dice lines (FR-034).
 */

export { clipProse, dropStockEnding, MAX_PROSE_CHARS };

export interface NarrateOutput {
  /** 1..1,200 characters; no digits (FR-034). Empty when skipped. */
  prose: string;
  /** Rendered by code from the facts, never by the model. */
  diceLines: string[];
  /** The template: restate, describe, ask, rows, State line (spec 098); what ships. */
  text: string;
  /** The ids of the actions this narration covers. */
  actionIds: string[];
  /** 1..3 */
  attempt: number;
  /** True when there was nothing to narrate (no model call was made). */
  skipped: boolean;
  facts: NarrationFacts;
  /** The fact sheet (spec 098); empty-slot sheet when skipped. */
  sheet: FactSheet;
  /** The validated slots; `prose` is these joined by a blank line. */
  slots: NarrationSlots;
  /**
   * Refused ruling and `goalNote` texts (spec 051, OQ-2). Always present;
   * empty when nothing was withheld. The check node records them.
   */
  withheld: CheckIssue[];
  /** Set when the narrate call errored; the slots are then empty and the reply is rows only. */
  narrateError: string | null;
  /** Spec 104 FR-018: the window's upper bound `W1`; absent when nothing was narrated. */
  factsThrough?: number;
  /** Spec 108: the stream parser; `check` calls `finish`. Absent when skipped or no stream is wired. */
  stream?: NarrationStream;
  /** Spec 108 FR-009. `check` fills `firstProse*` when the first prose part leaves, and records them. */
  timing?: NarrateTiming;
}

export interface NarrateTiming {
  /** `performance.now()` at narrate start. */
  startedAt: number;
  firstTokenMs: number | null;
  firstProseMs: number | null;
  firstProseAt: string | null;
}

/** The state a withheld-text check runs against (spec 103 plan D3). */
export interface WithholdState {
  snapshot: ActorSnapshot;
  /** `dmOnlySeedText(seed)`, lower-cased. */
  dmOnlyText: readonly string[];
}

/**
 * Checks the ruling texts and the `goalNote` once against S1 and the DM-only seed text.
 * A refused ruling leaves the facts; a refused `goalNote` becomes "".
 */
export function withholdRefusedInputs(
  facts: NarrationFacts,
  state: WithholdState,
): { facts: NarrationFacts; withheld: CheckIssue[] } {
  const withheld: CheckIssue[] = [];
  const refuse = (label: string, text: string): boolean => {
    const issues = checkNarration({
      slots: { restate: "", describe: text, ask: "" },
      rows: [],
      hasRoll: true,
      snapshot: state.snapshot,
      dmOnlyText: state.dmOnlyText,
      unmetSuccess: [],
      departedIds: [],
    }).filter((c) => c.kind === "life-state" || c.kind === "dm-only-text");
    for (const c of issues) {
      withheld.push({ ...c, detail: `withheld ${label}: ${c.detail}` });
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
      check: "leak",
      kind: "dm-only-text",
      actorIds: [],
      matched: facts.director.goalNote.slice(0, 60),
      sentence: facts.director.goalNote,
      detail: "withheld goalNote: it states a count.",
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
      check: "leak",
      kind: "unmet-success",
      actorIds: [],
      matched: facts.director.goalNote.slice(0, 60),
      sentence: facts.director.goalNote,
      detail:
        "withheld goalNote: a check this beat failed, and the note was written before the dice.",
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

/** The slots as one prose string. */
export function proseOf(slots: NarrationSlots): string {
  return [slots.restate, slots.describe, slots.ask]
    .filter(Boolean)
    .join("\n\n");
}

export type AttemptResult =
  | {
      ok: true;
      prose: string;
      slots: NarrationSlots;
      calls: ModelCallRecord[];
    }
  | { ok: false; error: NodeError; calls: ModelCallRecord[] };

/** One `dm.narrate` call. */
export async function narrateAttempt(
  ctx: TurnContext,
  assembled: AssembleOutput,
  facts: NarrationFacts,
  snapshot: ActorSnapshot,
  sheet: FactSheet,
  live?: {
    onText: (delta: string) => void;
    timing: NarrateTiming;
  },
): Promise<AttemptResult> {
  const prompt = buildNarratePrompt({
    seed: playerFacingSeed(ctx.seed),
    roster: rosterOf(ctx.deps ? assembled.projections.party : []),
    assembled,
    snapshot,
    facts,
    sheet,
  });
  const result = await callText(ctx.deps, {
    purpose: PURPOSE_OF.narrate,
    promptVersion: PROMPT_VERSION,
    system: prompt.system,
    user: prompt.user,
    signal: ctx.signal,
    ...(live ? { onText: live.onText } : {}),
  });
  if (!result.ok) return result;
  if (live) live.timing.firstTokenMs = result.firstTokenMs;
  const slots = parseSlots(result.text, sheet);
  return { ok: true, prose: proseOf(slots), slots, calls: result.calls };
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
    ? "stages" in reading // spec 104 shape; a value import of `hasStages` would pull the engine in
      ? {
          // Spec 104: the monster's Intent stages read as plan lines in the text form the player sees.
          intent: reading.stages[0]?.intent.kind ?? "other",
          steps: reading.stages.map((st) => ({
            reason: st.intent.text ?? st.intent.kind,
          })),
          say: reading.say ?? null,
        }
      : {
          intent: reading.intent,
          steps: npcRuling?.steps ?? reading.steps,
          say: reading.say ?? null,
        }
    : null;
  // ponytail: reads every prior turn checkpoint of the session (one job-table read per narrate).
  // Ceiling: a session with many turn jobs; upgrade is a `limit` on `loadPriorTurnCheckpoints`.
  const beatIds = assembled.beat.map((b) => b.actionId);
  const prior = ctx.deps.loadPriorTurns
    ? await ctx.deps.loadPriorTurns(ctx.job.sessionId, ctx.job.id)
    : [];
  const open = openFollowUps(projections, prior, beatIds);
  // Spec 104 FR-018, FR-019 (plan D6): the planner's facts ride the public `intent.recorded` rows
  // in the window `(W0, W1]`. W1 is the projections this narrate reads; W0 is the newest prior
  // turn's `factsThrough`, else the newest earlier `narration` row (a first beat or a deploy
  // must not re-render history), else 0.
  const w1 = projections.throughSeq;
  let w0 = prior.find((t) => t.checkpoint.factsThrough !== undefined)
    ?.checkpoint.factsThrough;
  if (w0 === undefined) {
    const lastNarration = await ctx.deps.loadEvents(ctx.job.sessionId, {
      afterSeq: 0,
      throughSeq: w1,
      types: ["narration"],
    });
    w0 = lastNarration.at(-1)?.seq ?? 0;
  }
  const carriers =
    w1 > w0
      ? await ctx.deps.loadEvents(ctx.job.sessionId, {
          afterSeq: w0,
          throughSeq: w1,
          types: ["intent.recorded"],
        })
      : [];
  const planFacts: PlanFact[] = carriers
    .filter((r) => r.visibility === "public")
    .sort((x, y) => x.seq - y.seq)
    .flatMap((r) => (r.payload as { facts?: PlanFact[] }).facts ?? []);
  // Spec 066 FR-031: an `intent` turn narrates the engine rows of the direct Intents in the window.
  const directBatches =
    ctx.job.trigger === "intent"
      ? carriers.flatMap((r) => {
          const pl = r.payload as {
            batchId?: string | null;
            intent?: { actor?: { kind?: string; id?: string } };
          };
          if (r.visibility !== "public" || !pl.batchId) return [];
          const id = pl.intent?.actor?.id;
          const name =
            projections.party.find((m) => m.characterId === id)?.name ??
            id ??
            "The scene";
          return [{ name, batchId: pl.batchId }];
        })
      : [];
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
    directBatches,
    turnActorId:
      assembled.projections.tableMode.mode === "turn"
        ? (assembled.projections.encounter?.activeCombatantId ?? null)
        : null,
  });
  const { facts, withheld } = withholdRefusedInputs(built, {
    snapshot: resolve.snapshot,
    dmOnlyText: dmOnlySeedText(ctx.seed).map((t) => t.toLowerCase()),
  });
  const actionIds = facts.actions.map((a) => a.actionId);
  const nameOf = (id: string | null): string => {
    if (id === null) return "The scene";
    return (
      projections.engine.combatants[id]?.name ??
      projections.party.find((m) => m.combatantId === id)?.name ??
      id
    );
  };
  const sheet = buildFactSheet({
    settled: facts,
    beat: assembled.beat,
    projections,
    nameOf,
    submissions: resolve.submissions,
    planFacts,
    ruleTitle: (id) => ctx.deps.srd.getById("rule", id)?.title,
  });

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
        sheet,
        slots: { restate: "", describe: "", ask: "" },
        withheld,
        narrateError: null,
      },
    };
  }

  // Spec 108 D3: the rows leave before the model call; deltas feed the stream parser.
  const send = ctx.deps.streamNarration;
  const base = send ? checkBase(ctx, facts, sheet) : null;
  const timing: NarrateTiming = {
    startedAt: performance.now(),
    firstTokenMs: null,
    firstProseMs: null,
    firstProseAt: null,
  };
  let stream: NarrationStream | undefined;
  let live: Parameters<typeof narrateAttempt>[5];
  if (send && base) {
    const rowsText = sheet.rows
      .map((r) => r.text)
      .concat(sheet.state ?? [])
      .join("\n");
    send({ jobId: ctx.job.id, slot: "rows", text: rowsText });
    stream = createNarrationStream({ ...base, sheet });
    const parser = stream;
    live = {
      timing,
      onText: (delta) => {
        for (const p of parser.push(delta)) {
          if (timing.firstProseMs === null) {
            timing.firstProseMs = Math.round(
              performance.now() - timing.startedAt,
            );
            timing.firstProseAt = new Date().toISOString();
          }
          send({ jobId: ctx.job.id, ...p });
        }
      },
    };
  }
  const result = await narrateAttempt(
    ctx,
    assembled,
    facts,
    resolve.snapshot,
    sheet,
    live,
  );
  if (!result.ok) {
    if (result.error.kind === "aborted" || result.error.kind === "fenced") {
      return {
        ok: false,
        node: "narrate",
        error: result.error,
        calls: result.calls,
      };
    }
    // Spec 103: a narrate error never fails the turn; restate, rows and State ship.
    const slots = parseSlots("", sheet);
    return {
      ok: true,
      node: "narrate",
      calls: result.calls,
      output: {
        prose: proseOf(slots),
        diceLines: sheet.rows.map((r) => r.text),
        text: composeReply(slots, sheet),
        actionIds,
        attempt: 1,
        skipped: false,
        facts,
        sheet,
        slots,
        withheld,
        narrateError: result.error.kind,
        factsThrough: w1,
        ...(stream ? { stream, timing } : {}),
      },
    };
  }
  return {
    ok: true,
    node: "narrate",
    calls: result.calls,
    output: {
      prose: result.prose,
      diceLines: sheet.rows.map((r) => r.text),
      text: composeReply(result.slots, sheet),
      actionIds,
      attempt: 1,
      skipped: false,
      facts,
      sheet,
      slots: result.slots,
      withheld,
      narrateError: null,
      factsThrough: w1,
      ...(stream ? { stream, timing } : {}),
    },
  };
};
