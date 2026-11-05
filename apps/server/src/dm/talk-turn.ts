import { createHash } from "node:crypto";
import type {
  SessionProjections,
  StoredEvent,
  TranscriptEntry,
} from "@the-stacks/session-model";
import type { NarrationFacts } from "./facts.js";
import { encounterRan, encounterToStart } from "./gates/plan-gate.js";
import type { AuditIssue } from "./nodes/audit.js";
import { deterministicChecks } from "./nodes/audit.js";
import type { DirectorNodeOutput } from "./nodes/director.js";
import type { ResolveOutput } from "./nodes/resolve.js";
import {
  findLandedNarration,
  resolve,
  submitNarration,
} from "./nodes/resolve.js";
import { ReactOutput } from "./nodes/schemas.js";
import { callJson } from "./pipeline/call.js";
import type {
  ModelCallRecord,
  NodeOutputs,
  TurnContext,
  TurnOutcome,
} from "./pipeline/context.js";
import { rosterOf } from "./prompts/common.js";
import { buildReactPrompt, PROMPT_VERSION } from "./prompts/react.js";
import { PURPOSE_OF } from "./purposes.js";
import { dmOnlySeedText, playerFacingSeed } from "./seed/views.js";
import {
  type CodeTrigger,
  capReached,
  codeTriggers,
  isReadable,
  needsModel,
  TALK_CHAIN_CAP,
  type TalkResult,
} from "./talk-triggers.js";

/**
 * The talk path (specs/065-talk-triggers plan D3): a `talk` turn with no
 * committed beat. Assemble ran; this reads the posts, asks `react` once (twice
 * after a code refusal), checks the text in code and ships one narration row.
 * An `escalate` reaction runs resolve's opening move (plan D5) when legal and
 * ships as `scene` otherwise.
 */

/**
 * Plan D5 / FR-011: the mode is free and `encounterToStart` finds the encounter
 * unstarted (it has not run; spec 088) with no encounter running.
 */
export function legalEscalation(
  seed: TurnContext["seed"],
  p: SessionProjections,
  encounterId: string,
): boolean {
  if (p.tableMode.mode !== "free" || p.encounter !== null) return false;
  const enc = encounterToStart(
    seed,
    { tableMode: { to: "turn", encounterId, reason: "" } },
    "talk",
  );
  return enc !== undefined && !encounterRan(p, enc);
}

type TalkPost = Extract<TranscriptEntry, { kind: "talk" }>;

const RANK = { addressed: 3, mentioned: 2, overheard: 1 } as const;

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Step 1: the public IC posts after the last DM narration, up to the trigger. */
function readPosts(
  p: SessionProjections,
  triggerSeq: number | null,
): TalkPost[] {
  const upTo = triggerSeq ?? p.throughSeq;
  let cutoff = 0;
  for (const e of p.transcript) {
    if (e.seq > upTo) break;
    if (e.kind === "narration" && e.actor === "ai:dm") cutoff = e.seq;
  }
  return p.transcript.filter(
    (e): e is TalkPost =>
      e.kind === "talk" &&
      e.seq > cutoff &&
      e.seq <= upTo &&
      isReadable(
        {
          type: "talk",
          actor: e.actor,
          visibility: e.visibility,
          payload: { channel: e.channel },
        } as unknown as StoredEvent,
        p,
      ),
  );
}

/** Merges per-post triggers: one entry per actor, the strongest kind wins. */
function mergeTriggers(all: CodeTrigger[][]): CodeTrigger[] {
  const best = new Map<string, CodeTrigger>();
  for (const t of all.flat()) {
    const cur = best.get(t.actorId);
    if (!cur || RANK[t.kind] > RANK[cur.kind]) best.set(t.actorId, t);
  }
  return [...best.values()];
}

/** Facts for the code checks: a talk turn has no actions, rolls or events. */
function talkFacts(ctx: TurnContext, p: SessionProjections): NarrationFacts {
  return {
    trigger: "talk",
    actions: [],
    npcTurn: null,
    director: {
      pacing: { tension: "low", spotlight: null, beatId: null },
      goalNote: "",
      sceneEnded: false,
    },
    modeChange: null,
    presentNpcs: [],
    rulings: [],
    clarify: [],
    party: p.party.map((m) => ({
      characterId: m.characterId,
      name: m.name,
      controller: m.controller.kind === "player" ? "human" : "ai-companion",
    })),
    events: [],
    setting: {
      locationName: ctx.seed.location.name,
      openingFraming: ctx.seed.opening.framing,
    },
  };
}

export async function runTalkTurn(
  ctx: TurnContext,
  assembled: NodeOutputs["assemble"],
): Promise<TurnOutcome> {
  const p = assembled.projections;
  const calls: ModelCallRecord[] = [];
  // A reclaim after the opening move landed: the mode is already `turn`, so
  // read the posts as the first attempt saw them (mode free).
  const resumed = ctx.checkpoint.submissions.some((x) =>
    x.key.startsWith("director:"),
  );
  const posts = readPosts(
    resumed ? { ...p, tableMode: { mode: "free" } } : p,
    ctx.job.triggerSeq,
  );
  const perPost = posts.map((e) =>
    codeTriggers(e.text, assembled.snapshot, ctx.seed),
  );
  const triggers = mergeTriggers(perPost);
  const result: TalkResult = {
    posts: posts.map((e) => e.seq),
    codeTriggers: triggers,
    modelTriggers: [],
    outcome: "none",
    reason: "",
  };
  let nextJob: ResolveOutput["nextJob"] = null;
  const done = (shipped: boolean, companions: string[]): TurnOutcome => ({
    status: "talk",
    talk: result,
    companions,
    nextJob,
    shipped,
    calls,
  });
  const fenced = (): TurnOutcome => ({
    status: "failed",
    node: "narrate",
    error: { kind: "fenced", message: "the lease was lost" },
    calls,
  });

  // Step 2: code skips the model when nothing is named and nothing is asked.
  if (!posts.some((e, i) => needsModel(perPost[i] ?? [], e.text))) {
    result.reason = "no present NPC named and no question asked";
    return done(false, []);
  }

  // Reclaim: a landed narration is never shipped twice.
  if (ctx.job.attempt > 1) {
    const landed = await findLandedNarration(ctx, 0);
    if (landed || ctx.checkpoint.narration?.shipped) {
      result.outcome = "reply";
      result.reason = "narration already landed before a reclaim";
      return done(true, []);
    }
  }

  const reachesCap = capReached(p, TALK_CHAIN_CAP - 1);
  const presentNpcIds = assembled.presentNpcIds.filter(
    (id) =>
      assembled.snapshot.actors.find((a) => a.id === id)?.lifeState !== "dead",
  );
  const free = p.tableMode.mode === "free";
  const secrets = dmOnlySeedText(ctx.seed).map((s) => s.toLowerCase());
  const view = playerFacingSeed(ctx.seed);

  const ask = async (prior: { text: string; issues: AuditIssue[] } | null) => {
    const prompt = buildReactPrompt({
      seed: view,
      roster: rosterOf(p.party),
      snapshot: assembled.snapshot,
      posts,
      triggers,
      transcriptTail: assembled.transcriptTail,
      presentNpcIds,
      encounterIds: free
        ? ctx.seed.encounters
            .filter((e) => legalEscalation(ctx.seed, p, e.id))
            .map((e) => e.id)
        : [],
      reachesCap,
      prior,
    });
    return callJson(ctx.deps, {
      purpose: PURPOSE_OF.narrate,
      promptVersion: PROMPT_VERSION,
      system: prompt.system,
      user: prompt.user,
      schema: ReactOutput,
      signal: ctx.signal,
    });
  };
  const refusals = (react: ReactOutput): AuditIssue[] => {
    if (react.outcome === "none") return [];
    const issues: AuditIssue[] = deterministicChecks(
      talkFacts(ctx, p),
      { prose: react.text, diceLines: [] },
      { snapshot: assembled.snapshot, diff: null },
    ).issues;
    const lower = react.text.toLowerCase();
    for (const s of secrets) {
      if (lower.includes(s))
        issues.push({
          kind: "other",
          detail: "The text states something outside the player view.",
        });
    }
    if (
      react.outcome === "reply" &&
      !presentNpcIds.includes(react.speaker ?? "")
    )
      issues.push({
        kind: "doctrine",
        detail: "The speaker is not a present character.",
      });
    return issues;
  };

  // Step 3: one react call; a reclaim reuses the checkpointed output.
  let react = ctx.checkpoint.react ?? null;
  if (!react) {
    const first = await ask(null);
    calls.push(...first.calls);
    if (!first.ok)
      return { status: "failed", node: "narrate", error: first.error, calls };
    react = first.value;
    if (!(await ctx.deps.saveCheckpoint({ ...ctx.checkpoint, react })))
      return fenced();
  }

  // Step 5: code checks; one regenerate, then drop.
  let issues = refusals(react);
  if (issues.length > 0) {
    const second = await ask({ text: react.text, issues });
    calls.push(...second.calls);
    if (!second.ok)
      return { status: "failed", node: "narrate", error: second.error, calls };
    react = second.value;
    if (!(await ctx.deps.saveCheckpoint({ ...ctx.checkpoint, react })))
      return fenced();
    issues = refusals(react);
    if (issues.length > 0) {
      result.reason =
        `refused twice: ${issues.map((i) => i.detail).join(" ")}`.slice(0, 300);
      return done(false, []);
    }
  }

  result.modelTriggers = react.triggers;
  result.reason = react.reason;
  if (react.outcome === "none") return done(false, []);
  result.outcome = react.outcome;
  let checkpoint = { ...ctx.checkpoint, react };

  // Steps 4 and 6: a legal escalation runs resolve's opening move; else scene.
  if (react.outcome === "escalate") {
    // A resumed run has no unstarted encounter left; resolve skips its landed rows.
    const encounterId = react.encounterId ?? "";
    if (!resumed && !legalEscalation(ctx.seed, p, encounterId)) {
      result.outcome = "scene";
    } else {
      const director: DirectorNodeOutput = {
        beat: { decision: "resolve" },
        tableMode: { to: "turn", encounterId, reason: react.reason },
        trackers: [],
        scene: { status: "continue" },
        pacing: { tension: "high", spotlight: null, beatId: null },
        goalNote: "",
        companionPrompts: [],
        overrides: [],
      };
      const opened = await resolve({
        ...ctx,
        checkpoint,
        results: {
          assemble: assembled,
          director,
          interpret: { readings: [] },
          adjudicate: { rulings: [] },
        },
      });
      calls.push(...opened.calls);
      if (!opened.ok)
        return {
          status: "failed",
          node: "resolve",
          error: opened.error,
          calls,
        };
      nextJob = opened.output.nextJob;
      checkpoint = {
        ...checkpoint,
        submissions: opened.output.submissions,
        lastSeq: opened.output.lastSeq,
      };
    }
  }

  // Step 7: ship one narration row, then name the companions to prompt.
  if (!(await ctx.deps.fence())) return fenced();
  const shipped = await submitNarration(
    ctx,
    {
      record: {
        attempts: [],
        final: "passed",
        flagged: false,
        shippedProseSha256: sha(react.text),
      },
      shipped: {
        prose: react.text,
        text: react.text,
        actionIds: [],
        fallback: false,
        flagBody: null,
      },
    },
    checkpoint,
  );
  if (!shipped.ok)
    return { status: "failed", node: "resolve", error: shipped.error, calls };
  const companions =
    reachesCap || result.outcome === "escalate"
      ? []
      : react.companionPrompts.filter((id) =>
          p.party.some(
            (m) => m.characterId === id && m.controller.kind === "ai-companion",
          ),
        );
  return done(shipped.shipped, companions);
}
