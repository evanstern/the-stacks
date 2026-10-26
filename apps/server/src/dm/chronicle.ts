import type {
  Proposal,
  SessionProjections,
  TranscriptEntry,
} from "@the-stacks/session-model";
import { RefIdSchema } from "@the-stacks/session-model";
import { z } from "zod";
import type { Gateway } from "../ai/gateway.js";
import type { Gate } from "../gate/index.js";
import type { ChronicleJobInput } from "./jobs.js";
import { callJson } from "./pipeline/call.js";
import type { ModelCallRecord } from "./pipeline/context.js";
import { buildChroniclePrompt, PROMPT_VERSION } from "./prompts/chronicle.js";
import { rosterOf } from "./prompts/common.js";
import { PURPOSE_OF } from "./purposes.js";

/**
 * The chronicle (contracts/companions.md "Chronicle"): off the hot path, it
 * turns new narration into journal proposals as `ai:dm`. It is idempotent: a
 * second run with nothing new writes nothing.
 */

export const ChronicleOutput = z.object({
  entries: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        body: z.string().min(1).max(1200),
        sourceActionIds: z.array(RefIdSchema).max(50),
        visibility: z.enum(["public", "dm"]),
      }),
    )
    .max(3),
});
export type ChronicleOutput = z.infer<typeof ChronicleOutput>;

export const CHRONICLE_PREFIX = "chron-";
const AI_DM = { kind: "ai", actor: "ai:dm" } as const;

export interface ChronicleResult {
  entries: number;
  calls: ModelCallRecord[];
}

export interface ChronicleDeps {
  gateway: Pick<Gateway, "chat">;
  gate: Pick<Gate, "submit">;
  loadProjections: (sessionId: string) => Promise<SessionProjections>;
  fence: () => Promise<boolean>;
  log: (line: Record<string, unknown>) => void;
}

/**
 * The highest seq already chronicled: a chronicle proposal's created seq, or
 * a directly applied chronicle journal row's seq. A pending or approved
 * proposal both count, so a second run does not repeat itself.
 */
export function chronicledThrough(p: SessionProjections): number {
  let bound = 0;
  const viaProposal = new Set<string>();
  for (const view of p.proposals) {
    if (view.proposal.kind !== "journal") continue;
    if (!view.proposal.entry.entryId.startsWith(CHRONICLE_PREFIX)) continue;
    viaProposal.add(view.proposal.entry.entryId);
    if (view.status !== "rejected") bound = Math.max(bound, view.createdSeq);
  }
  for (const j of p.journal) {
    if (!j.entryId.startsWith(CHRONICLE_PREFIX)) continue;
    if (viaProposal.has(j.entryId)) continue;
    bound = Math.max(bound, j.seq);
  }
  return bound;
}

function narrations(entries: TranscriptEntry[]) {
  return entries.filter((e) => e.kind === "narration");
}

export async function runChronicleJob(
  deps: ChronicleDeps,
  job: { id: string; input: ChronicleJobInput },
  signal: AbortSignal,
): Promise<ChronicleResult> {
  const { sessionId, throughSeq } = job.input;
  const p = await deps.loadProjections(sessionId);
  const bound = chronicledThrough(p);
  const fresh = p.transcript.filter(
    (e) => e.seq > bound && e.seq <= throughSeq,
  );
  const lastNarration = narrations(fresh).at(-1);
  if (!lastNarration) return { entries: 0, calls: [] };

  const prompt = buildChroniclePrompt({
    transcript: fresh,
    goal: p.scene?.summary ?? "",
    trackerNames: p.trackers.map((t) => t.name),
    roster: rosterOf(p.party),
  });
  const result = await callJson(deps, {
    purpose: PURPOSE_OF.chronicle,
    promptVersion: PROMPT_VERSION,
    system: prompt.system,
    user: prompt.user,
    signal,
    schema: ChronicleOutput,
  });
  if (!result.ok) {
    deps.log({
      event: "dm.chronicle.failed",
      jobId: job.id,
      kind: result.error.kind,
    });
    return { entries: 0, calls: result.calls };
  }

  const short = sessionId.replace(/-/g, "").slice(0, 8);
  const taken = new Set(p.journal.map((j) => j.entryId));
  let written = 0;
  for (const [i, entry] of result.value.entries.entries()) {
    const entryId = `${CHRONICLE_PREFIX}${short}-${lastNarration.seq}${i === 0 ? "" : `-${i}`}`;
    if (taken.has(entryId)) continue;
    if (!(await deps.fence())) break;
    const proposal: Proposal = {
      kind: "journal",
      summary: entry.title.slice(0, 200),
      rationale: null,
      entry: {
        entryId,
        title: entry.title,
        body: entry.body,
        sourceActionIds: entry.sourceActionIds,
      },
      visibility: entry.visibility,
    };
    const res = await deps.gate.submit(sessionId, AI_DM, proposal);
    if (res.ok) written += 1;
    else {
      deps.log({
        event: "dm.chronicle.refused",
        jobId: job.id,
        code: res.refusal.code,
      });
    }
  }
  return { entries: written, calls: result.calls };
}
