import { createHash } from "node:crypto";
import { composeReply, defaultRestate, type FactSheet } from "../fact-sheet.js";
import { type NarrationFacts, unmetRolls } from "../facts.js";
import {
  type CheckInput,
  type CheckIssue,
  checkNarration,
  dropPlan,
  dropSentences,
} from "../narration-check.js";
import type { Node, TurnContext } from "../pipeline/context.js";
import type { ParamsStrip } from "../react-params.js";
import { dmOnlySeedText } from "../seed/views.js";

/**
 * The check node (spec 103 plan D2). Pure: no model call. A leak drops the sentence and appends
 * a `dm` correction; a contradiction ships with a public correction. Nothing blocks play.
 */

/** One correction `submitNarration` submits as an AI-DM `talk` proposal. */
export interface Correction {
  visibility: "dm" | "public";
  text: string;
}

export interface CheckRecord {
  /** Spec 116 FR-010: params keys code stripped from the react reply; absent on rows stored before. */
  stripped?: ParamsStrip[];
  leak: CheckIssue[];
  contradiction: CheckIssue[];
  corrected: boolean;
  shippedProseSha256: string;
  /** The narrate call's error kind when it failed and the reply shipped as rows only. */
  narrateError?: string;
  /** Spec 108 FR-009: ms from the narrate call to its first text delta; null when none arrived. */
  firstTokenMs?: number | null;
  /** Ms from narrate start to the first prose part (restate, describe or ask) sent; null when none. */
  firstProseMs?: number | null;
  /** ISO time of that part. */
  firstProseAt?: string | null;
}

export interface CheckOutput {
  record: CheckRecord;
  /** What `submitNarration` ships; null when there was nothing to narrate. */
  shipped: {
    prose: string;
    text: string;
    actionIds: string[];
    corrections: Correction[];
  } | null;
}

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/** The corrections for a set of issues (plan D2). A digit needs none: the drop is the correction. */
export function correctionsFor(issues: readonly CheckIssue[]): Correction[] {
  const out: Correction[] = [];
  for (const i of issues) {
    if (i.check === "leak") {
      out.push({
        visibility: "dm",
        text: `Correction (hidden): dropped "${i.matched}" — ${i.detail}`,
      });
    } else if (i.kind === "life-state" || i.kind === "dice-language") {
      out.push({ visibility: "public", text: `Correction: ${i.detail}` });
    }
  }
  return out;
}

/** The check input minus the slots; narrate's stream parser and the check node share it. */
export function checkBase(
  ctx: TurnContext,
  facts: NarrationFacts,
  sheet: FactSheet,
): Omit<CheckInput, "slots"> | null {
  const resolved = ctx.results.resolve;
  if (!resolved) return null;
  return {
    rows: sheet.rows.map((r) => r.text).concat(sheet.state ?? []),
    hasRoll:
      facts.actions.some((a) => a.rolls.length > 0) ||
      (facts.npcTurn?.rolls ?? []).length > 0 ||
      (facts.pulled ?? []).some((x) => x.rolls.length > 0) ||
      (facts.direct ?? []).some((x) => x.rolls.length > 0),
    snapshot: resolved.snapshot,
    departedIds: resolved.appendedRows.flatMap((r) => {
      const pl = r.payload as { actorId?: string; after?: string };
      return r.type === "scene-presence.changed" &&
        pl.after === "absent" &&
        pl.actorId
        ? [pl.actorId]
        : [];
    }),
    dmOnlyText: dmOnlySeedText(ctx.seed).map((t) => t.toLowerCase()),
    unmetSuccess: unmetRolls(facts).flatMap((r) =>
      r.unmetSuccess ? [r.unmetSuccess] : [],
    ),
  };
}

export const check: Node<"check"> = async (ctx) => {
  const narration = ctx.results.narrate;
  const resolved = ctx.results.resolve;
  if (!narration || !resolved) {
    return {
      ok: false,
      node: "check",
      calls: [],
      error: { kind: "internal", message: "check ran before narrate" },
    };
  }
  if (narration.skipped) {
    return {
      ok: true,
      node: "check",
      calls: [],
      output: {
        record: {
          leak: [],
          contradiction: [],
          corrected: false,
          shippedProseSha256: sha(""),
        },
        shipped: null,
      },
    };
  }
  const { facts, sheet, slots } = narration;
  const base = checkBase(ctx, facts, sheet);
  if (!base) throw new Error("unreachable: resolve checked above");
  const issues = checkNarration({ ...base, slots });
  const drop = dropPlan(
    issues.filter((i) => i.check === "leak" || i.kind === "digit"),
  );
  const kept = {
    restate: slots.restate,
    describe: dropSentences(slots.describe, drop.sentences, drop.inners),
    ask: sheet.ask ?? dropSentences(slots.ask, drop.sentences, drop.inners),
  };
  // An empty restate slot falls back to the code-written restate.
  if (sheet.slots.includes("restate") && !kept.restate) {
    kept.restate = defaultRestate(sheet);
  }
  // Spec 108: the stream's last parts, from the same kept slots the row ships.
  const { stream, timing } = narration;
  if (stream && timing) {
    for (const p of stream.finish(kept)) {
      if (timing.firstProseMs === null) {
        timing.firstProseMs = Math.round(performance.now() - timing.startedAt);
        timing.firstProseAt = new Date().toISOString();
      }
      ctx.deps.streamNarration?.({ jobId: ctx.job.id, ...p });
    }
  }
  if (timing) {
    ctx.deps.log({
      event: "dm.narrate.first-token",
      jobId: ctx.job.id,
      sessionId: ctx.job.sessionId,
      firstTokenMs: timing.firstTokenMs,
      firstProseMs: timing.firstProseMs,
      firstProseAt: timing.firstProseAt,
    });
  }
  const prose = [kept.restate, kept.describe, kept.ask]
    .filter(Boolean)
    .join("\n\n");
  const corrections = correctionsFor(issues);
  return {
    ok: true,
    node: "check",
    calls: [],
    output: {
      record: {
        leak: issues.filter((i) => i.check === "leak"),
        contradiction: issues.filter((i) => i.check === "contradiction"),
        corrected:
          corrections.length > 0 ||
          drop.sentences.length + drop.inners.size > 0,
        shippedProseSha256: sha(prose),
        ...(timing
          ? {
              firstTokenMs: timing.firstTokenMs,
              firstProseMs: timing.firstProseMs,
              firstProseAt: timing.firstProseAt,
            }
          : {}),
        ...(narration.narrateError
          ? { narrateError: narration.narrateError }
          : {}),
      },
      shipped: {
        prose,
        text: composeReply(kept, sheet),
        actionIds: narration.actionIds,
        corrections,
      },
    },
  };
};
