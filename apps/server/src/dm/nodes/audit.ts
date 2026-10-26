import { createHash } from "node:crypto";
import { z } from "zod";
import {
  DEATH_RECORDED,
  DEATH_WORDS,
  DICE_LANGUAGE,
  EITHER_OR_END,
  LIST_LINE,
  MAX_WORDS,
  NEGATIVE_WORDS,
  namePairsWith,
  POSITIVE_WORDS,
  UNCONSCIOUS_RECORDED,
  UNCONSCIOUS_WORDS,
  wordCount,
} from "../audit-words.js";
import {
  type FactChange,
  type NarrationFacts,
  renderDiceLines,
} from "../facts.js";
import { factualSummary } from "../fallback.js";
import { callJson } from "../pipeline/call.js";
import type {
  ModelCallRecord,
  Node,
  NodeErrorKind,
} from "../pipeline/context.js";
import { buildAuditPrompt, PROMPT_VERSION } from "../prompts/audit.js";
import { PURPOSE_OF } from "../purposes.js";
import { composeText, narrateAttempt } from "./narrate.js";

/**
 * The audit node (contracts/audit.md): deterministic checks, one `dm.audit`
 * call, and the bounded regenerate loop (at most three attempts). A mismatch
 * never ships silently: the fallback summary ships and a flag is recorded.
 */

export const MAX_NARRATION_ATTEMPTS = 3;

export const AUDIT_ISSUE_KINDS = [
  "ledger-mismatch",
  "invented-mechanics",
  "player-agency",
  "doctrine",
  "other",
] as const;
export type AuditIssueKind = (typeof AUDIT_ISSUE_KINDS)[number];

export interface AuditIssue {
  kind: AuditIssueKind;
  detail: string;
}

export const AuditModelOutput = z
  .object({
    verdict: z.enum(["pass", "fail"]),
    issues: z
      .array(
        z.object({
          kind: z.enum(AUDIT_ISSUE_KINDS),
          detail: z.string().min(1).max(300),
        }),
      )
      .max(8),
  })
  .refine((o) => o.verdict === "pass" || o.issues.length > 0);

export interface AuditAttempt {
  attempt: number;
  deterministic: { pass: boolean; issues: AuditIssue[] };
  llm:
    | { verdict: "pass" | "fail"; issues: AuditIssue[] }
    | { skipped: true }
    | { error: NodeErrorKind };
  /** The attempt's prose is not stored; its hash is. */
  proseSha256: string;
}

export interface AuditRecord {
  attempts: AuditAttempt[];
  final: "passed" | "passed-after-regenerate" | "fallback";
  /** True when any attempt failed. */
  flagged: boolean;
  shippedProseSha256: string;
}

export interface AuditOutput {
  record: AuditRecord;
  /** What `submitNarration` ships; null when there was nothing to narrate. */
  shipped: {
    prose: string;
    text: string;
    actionIds: string[];
    fallback: boolean;
    /** Journal body for the audit flag, set only on a fallback. */
    flagBody: string | null;
  } | null;
}

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function lifeStateFacts(facts: NarrationFacts): FactChange[] {
  const all = [
    ...facts.actions.flatMap((a) => a.changes),
    ...(facts.npcTurn?.changes ?? []),
  ];
  return all;
}

/** Pure. Seven checks over one narration. */
export function deterministicChecks(
  facts: NarrationFacts,
  narration: { prose: string; diceLines: readonly string[] },
): { pass: boolean; issues: AuditIssue[] } {
  const { prose } = narration;
  const issues: AuditIssue[] = [];
  const add = (kind: AuditIssueKind, detail: string) =>
    issues.push({ kind, detail });

  if (prose.trim().length === 0) add("doctrine", "The narration is empty.");
  if (/[0-9]/.test(prose)) {
    add(
      "ledger-mismatch",
      "The prose contains digits; numbers live on the dice lines.",
    );
  }

  const hasRoll =
    facts.actions.some((a) => a.rolls.length > 0) ||
    (facts.npcTurn?.rolls.length ?? 0) > 0;
  if (!hasRoll && DICE_LANGUAGE.test(prose)) {
    add(
      "invented-mechanics",
      "The prose names dice or a roll, and this turn had none.",
    );
  }

  const changes = lifeStateFacts(facts);
  const recordsDeath = changes.some(
    (c) => c.kind === "life-state" && c.after === "dead",
  );
  const recordsDown =
    changes.some((c) => c.kind === "life-state" && c.after === "unconscious") ||
    changes.some(
      (c) =>
        c.kind === "condition" &&
        c.condition === "unconscious" &&
        c.op === "applied",
    );
  if (DEATH_WORDS.test(prose) && !recordsDeath) {
    add(
      "ledger-mismatch",
      "The prose says a character dies, and no fact records a death.",
    );
  }
  if (UNCONSCIOUS_WORDS.test(prose) && !recordsDown && !recordsDeath) {
    add(
      "ledger-mismatch",
      "The prose says a character is unconscious, and no fact records it.",
    );
  }
  if (recordsDeath && !DEATH_RECORDED.test(prose)) {
    add("ledger-mismatch", "A fact records a death, and the prose omits it.");
  }
  if (recordsDown && !recordsDeath && !UNCONSCIOUS_RECORDED.test(prose)) {
    add(
      "ledger-mismatch",
      "A fact records a character falling unconscious, and the prose omits it.",
    );
  }

  for (const a of facts.actions) {
    if (!a.characterName || a.outcomes.length !== 1) continue;
    const only = a.outcomes[0];
    const opposite =
      only === "hit" || only === "critical-hit" || only === "success"
        ? NEGATIVE_WORDS
        : POSITIVE_WORDS;
    const parts = a.characterName.split(/\s+/);
    const aliases = [
      ...new Set([a.characterName, parts[0], parts[parts.length - 1]]),
    ].filter((n): n is string => !!n && n.length >= 3);
    if (aliases.some((n) => namePairsWith(prose, n, opposite))) {
      add(
        "ledger-mismatch",
        `The prose pairs ${a.characterName} with the opposite of the recorded ${only}.`,
      );
    }
  }

  if (wordCount(prose) > MAX_WORDS) {
    add(
      "doctrine",
      `The prose is over ${MAX_WORDS} words; aim for one hundred.`,
    );
  }
  if (LIST_LINE.test(prose) || EITHER_OR_END.test(prose.trim())) {
    add(
      "doctrine",
      "The prose has a list line or ends on an either-or question.",
    );
  }

  const expected = renderDiceLines(facts);
  if (
    expected.length !== narration.diceLines.length ||
    expected.some((l, i) => l !== narration.diceLines[i])
  ) {
    add("ledger-mismatch", "The dice lines differ from the renderer's output.");
  }
  return { pass: issues.length === 0, issues };
}

export const audit: Node<"audit"> = async (ctx) => {
  const narration = ctx.results.narrate;
  const assembled = ctx.results.assemble;
  if (!narration || !assembled) {
    return {
      ok: false,
      node: "audit",
      calls: [],
      error: { kind: "internal", message: "audit ran before narrate" },
    };
  }
  if (narration.skipped) {
    return {
      ok: true,
      node: "audit",
      calls: [],
      output: {
        record: {
          attempts: [],
          final: "passed",
          flagged: false,
          shippedProseSha256: sha(""),
        },
        shipped: null,
      },
    };
  }

  const { facts } = narration;
  const calls: ModelCallRecord[] = [];
  const attempts: AuditAttempt[] = [];
  const allIssues: string[] = [];
  let current = { prose: narration.prose, diceLines: narration.diceLines };
  let issuesSoFar: AuditIssue[] = [];
  let attempt = 1;

  const fallback = (): AuditOutput => {
    const prose = factualSummary(facts);
    const diceLines = renderDiceLines(facts);
    return {
      record: {
        attempts,
        final: "fallback",
        flagged: true,
        shippedProseSha256: sha(prose),
      },
      shipped: {
        prose,
        text: composeText(prose, diceLines),
        actionIds: narration.actionIds,
        fallback: true,
        flagBody:
          allIssues.join("\n").slice(0, 8000) ||
          "The audit could not pass a narration.",
      },
    };
  };

  for (;;) {
    const det = deterministicChecks(facts, current);
    let llm: AuditAttempt["llm"] = { skipped: true };
    let llmFailed = false;
    if (det.pass) {
      const prompt = buildAuditPrompt({ facts, prose: current.prose });
      const res = await callJson(ctx.deps, {
        purpose: PURPOSE_OF.audit,
        promptVersion: PROMPT_VERSION,
        system: prompt.system,
        user: prompt.user,
        schema: AuditModelOutput,
        signal: ctx.signal,
      });
      calls.push(...res.calls);
      if (res.ok) {
        llm = { verdict: res.value.verdict, issues: res.value.issues };
      } else {
        if (res.error.kind === "aborted" || res.error.kind === "fenced") {
          return { ok: false, node: "audit", error: res.error, calls };
        }
        llm = { error: res.error.kind };
        llmFailed = true;
      }
    }
    attempts.push({
      attempt,
      deterministic: det,
      llm,
      proseSha256: sha(current.prose),
    });

    if (det.pass && "verdict" in llm && llm.verdict === "pass") {
      return {
        ok: true,
        node: "audit",
        calls,
        output: {
          record: {
            attempts,
            final: attempt === 1 ? "passed" : "passed-after-regenerate",
            flagged: attempt > 1,
            shippedProseSha256: sha(current.prose),
          },
          shipped: {
            prose: current.prose,
            text: composeText(current.prose, current.diceLines),
            actionIds: narration.actionIds,
            fallback: false,
            flagBody: null,
          },
        },
      };
    }

    const found = [...det.issues, ...("issues" in llm ? llm.issues : [])];
    allIssues.push(
      `Attempt ${attempt}: ${
        llmFailed ? "the audit call failed; " : ""
      }${found.map((i) => `${i.kind}: ${i.detail}`).join(" | ") || "no detail"}`,
    );
    if (llmFailed || attempt >= MAX_NARRATION_ATTEMPTS) {
      return { ok: true, node: "audit", calls, output: fallback() };
    }
    issuesSoFar = [...issuesSoFar, ...found];
    attempt++;
    const regen = await narrateAttempt(ctx, assembled, facts, {
      prose: current.prose,
      issues: issuesSoFar,
    });
    calls.push(...regen.calls);
    if (!regen.ok) {
      if (regen.error.kind === "aborted" || regen.error.kind === "fenced") {
        return { ok: false, node: "audit", error: regen.error, calls };
      }
      allIssues.push(
        `Attempt ${attempt}: regeneration failed (${regen.error.kind})`,
      );
      return { ok: true, node: "audit", calls, output: fallback() };
    }
    current = { prose: regen.prose, diceLines: renderDiceLines(facts) };
  }
};
