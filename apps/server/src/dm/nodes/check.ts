import { createHash } from "node:crypto";
import { composeReply, defaultRestate } from "../fact-sheet.js";
import { unmetRolls } from "../facts.js";
import {
  type CheckIssue,
  checkNarration,
  dropSentences,
} from "../narration-check.js";
import type { Node } from "../pipeline/context.js";
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
  leak: CheckIssue[];
  contradiction: CheckIssue[];
  corrected: boolean;
  shippedProseSha256: string;
  /** The narrate call's error kind when it failed and the reply shipped as rows only. */
  narrateError?: string;
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
  const issues = checkNarration({
    slots,
    rows: sheet.rows.map((r) => r.text).concat(sheet.state ?? []),
    hasRoll:
      facts.actions.some((a) => a.rolls.length > 0) ||
      (facts.npcTurn?.rolls ?? []).length > 0 ||
      (facts.pulled ?? []).some((x) => x.rolls.length > 0),
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
  });
  const drop = issues
    .filter((i) => i.check === "leak" || i.kind === "digit")
    .map((i) => i.sentence);
  const kept = {
    restate: slots.restate,
    describe: dropSentences(slots.describe, drop),
    ask: sheet.ask ?? dropSentences(slots.ask, drop),
  };
  // An empty restate slot falls back to the code-written restate.
  if (sheet.slots.includes("restate") && !kept.restate) {
    kept.restate = defaultRestate(sheet);
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
        corrected: corrections.length > 0 || drop.length > 0,
        shippedProseSha256: sha(prose),
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
