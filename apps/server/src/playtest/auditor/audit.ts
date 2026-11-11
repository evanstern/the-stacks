/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import type { LedgerRow, StoredEvent } from "@the-stacks/session-model";
import type { Gateway } from "../../ai/gateway.js";
import { DOCTRINE } from "../../dm/doctrine/doctrine.js";
import type { SceneSeed } from "../../dm/seed/schema.js";
import type { JobItem } from "../export.js";
import { PLAYTEST_AUDIT_PURPOSE } from "../purpose.js";
import { runChecks } from "./checks.js";
import { buildAuditorPrompt } from "./prompt.js";
import {
  AuditorOutput,
  type Finding,
  type FindingKind,
  type Report,
  SEVERITY_OF,
} from "./schema.js";
import { hasScene, type Segment, segment } from "./segments.js";
import { fightStats } from "./stats.js";

/**
 * `runAudit` (specs/032-playtest-harness contracts/auditor.md): the code
 * checks, one `playtest.audit` call per segment with one retry, the DM
 * runtime's audit flags as notes, finding ids, the verdict, the model note.
 */

export interface AuditInput {
  /** DM view, seq order. */
  transcript: StoredEvent[];
  ledger: LedgerRow[];
  jobs: JobItem[];
  seed: SceneSeed | null;
  /** `null` runs the code checks only. */
  gateway: Gateway | null;
  models: Record<string, { provider: string; model: string }>;
  signal?: AbortSignal;
  /** Report metadata the run directory knows; defaults keep the report valid. */
  runId?: string;
  commit?: string;
  now?: () => Date;
}

type Raw = {
  segment: number | null;
  source: Finding["source"];
  check: string | null;
  kind: FindingKind;
  doctrineId: string | null;
  seqs: number[];
  detail: string;
};

type SegmentAuditor = Report["segments"][number]["auditor"];

const DOCTRINE_IDS = new Set(DOCTRINE.map((d) => d.id));

/** Strips one surrounding Markdown code fence, if present. */
function stripFence(text: string): string {
  const m = /^```[A-Za-z0-9_-]*\s*\n([\s\S]*?)\n?```$/.exec(text.trim());
  return m ? (m[1] as string).trim() : text.trim();
}

type CallResult =
  | { ok: true; text: string; inputTokens: number; outputTokens: number }
  | { ok: false; kind: string; inputTokens: number; outputTokens: number };

async function callOnce(
  gateway: Gateway,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<CallResult> {
  let text = "";
  for await (const ev of gateway.chat({
    purpose: PLAYTEST_AUDIT_PURPOSE,
    system,
    messages: [{ role: "user", content: user }],
    signal,
  })) {
    if (ev.type === "text") text += ev.text;
    else if (ev.type === "done") {
      return {
        ok: true,
        text,
        inputTokens: ev.usage.inputTokens,
        outputTokens: ev.usage.outputTokens,
      };
    } else if (ev.type === "error") {
      return {
        ok: false,
        kind: ev.kind,
        inputTokens: ev.usage.inputTokens,
        outputTokens: ev.usage.outputTokens,
      };
    }
  }
  return { ok: false, kind: "upstream", inputTokens: 0, outputTokens: 0 };
}

function parseOutput(
  text: string,
): { ok: true; value: AuditorOutput } | { ok: false; issues: string } {
  let json: unknown;
  try {
    json = JSON.parse(stripFence(text));
  } catch (error) {
    return { ok: false, issues: `not valid JSON: ${(error as Error).message}` };
  }
  const parsed = AuditorOutput.safeParse(json);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; "),
  };
}

const MODEL_NOTE =
  "playtest.audit and dm.narrate resolve to the same provider and model; prefer a different model family for the auditor.";

/** The note detail of a pre-TASK-0272 audit record. */
function legacyDetail(audit: NonNullable<JobItem["audit"]>): string {
  const kinds = [
    ...new Set(
      audit.attempts.flatMap((a) => [
        ...a.deterministic.issues.map((i) => i.kind),
        ...("issues" in a.llm ? a.llm.issues.map((i) => i.kind) : []),
      ]),
    ),
  ];
  return `final: ${audit.final}; attempts: ${audit.attempts.length}; issues: ${kinds.join(", ") || "none"}`;
}

export async function runAudit(input: AuditInput): Promise<Report> {
  const transcript = [...input.transcript].sort((a, b) => a.seq - b.seq);
  const segments = segment(transcript, input.ledger);
  const raw: Raw[] = [];
  const reportSegments: Report["segments"] = [];
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  const ctx = { transcript, seed: input.seed };

  const noScene = !hasScene(transcript);
  if (noScene) {
    raw.push({
      segment: null,
      source: "check",
      check: "no-scene",
      kind: "no-scene",
      doctrineId: null,
      seqs: [],
      detail: "The transcript has no scene.changed row; nothing was audited.",
    });
  }

  for (const seg of segments) {
    const results = runChecks(seg, ctx);
    for (const r of results) {
      for (const f of r.findings) {
        raw.push({
          segment: seg.index,
          source: "check",
          check: r.id,
          kind: f.kind,
          doctrineId: null,
          seqs: f.seqs,
          detail: f.detail,
        });
      }
    }
    let auditor: SegmentAuditor = { skipped: true };
    if (input.gateway) {
      auditor = await auditSegment(input.gateway, seg, input, raw, usage);
    }
    reportSegments.push({
      index: seg.index,
      narrationSeq: seg.narrationSeq,
      fromSeq: seg.fromSeq,
      toSeq: seg.toSeq,
      checks: results.map((r) => ({ id: r.id, pass: r.pass })),
      auditor,
    });
  }

  // DM-runtime check hits (spec 103), or the legacy audit flags of older rows, become note findings.
  for (const job of input.jobs) {
    const check = job.check;
    const legacy = job.audit?.flagged ? job.audit : null;
    const hits = check ? [...check.leak, ...check.contradiction] : [];
    if (!(hits.length > 0 || legacy)) continue;
    const next = transcript.find(
      (r) =>
        r.type === "narration" &&
        r.actor === "ai:dm" &&
        new Date(r.ts).getTime() >= new Date(job.createdAt).getTime(),
    );
    const seg = next
      ? segments.find((s) => s.narrationSeq === next.seq)
      : undefined;
    const detail = check
      ? `check: ${hits.map((i) => `${i.check}/${i.kind}`).join(", ")}`
      : legacyDetail(legacy as NonNullable<typeof legacy>);
    raw.push({
      segment: seg?.index ?? null,
      source: "dm-audit",
      check: null,
      kind: "dm-audit-flag",
      doctrineId: null,
      seqs: seg?.narrationSeq ? [seg.narrationSeq] : [],
      detail,
    });
  }

  // Ids: segment index (null last), then source, then first cited seq.
  const sourceOrder = { check: 0, auditor: 1, "dm-audit": 2 } as const;
  const ordered = raw
    .map((r, i) => ({ r, i }))
    .sort(
      (a, b) =>
        (a.r.segment ?? Number.MAX_SAFE_INTEGER) -
          (b.r.segment ?? Number.MAX_SAFE_INTEGER) ||
        sourceOrder[a.r.source] - sourceOrder[b.r.source] ||
        (a.r.seqs[0] ?? Number.MAX_SAFE_INTEGER) -
          (b.r.seqs[0] ?? Number.MAX_SAFE_INTEGER) ||
        a.i - b.i,
    )
    .map(({ r }) => r);
  const findings: Finding[] = ordered.map((r, i) => ({
    id: `F${i + 1}`,
    source: r.source,
    check: r.check,
    kind: r.kind,
    severity: SEVERITY_OF[r.kind],
    segment: r.segment,
    doctrineId: r.doctrineId,
    seqs: r.seqs.slice(0, 20),
    detail: r.detail.slice(0, 400) || "(no detail)",
  }));

  const counts = { fail: 0, warn: 0, note: 0 };
  for (const f of findings) counts[f.severity] += 1;
  const incomplete =
    noScene || reportSegments.some((s) => "error" in s.auditor);
  const verdict: Report["verdict"] = incomplete
    ? "incomplete"
    : counts.fail > 0
      ? "fail"
      : "pass";

  const a = input.models[PLAYTEST_AUDIT_PURPOSE];
  const n = input.models["dm.narrate"];
  const modelNote =
    a && n && a.provider === n.provider && a.model === n.model
      ? MODEL_NOTE
      : null;

  const first = transcript[0];
  return {
    v: 1,
    runId: input.runId ?? "audit",
    sessionId: first?.sessionId ?? "00000000-0000-4000-8000-000000000000",
    seedId: input.seed?.seedId ?? null,
    auditedAt: (input.now ?? (() => new Date()))().toISOString(),
    commit: input.commit ?? "unknown",
    verdict,
    auditorMode: input.gateway ? "model" : "checks-only",
    counts: {
      rows: transcript.length,
      narrations: transcript.filter(
        (r) => r.type === "narration" && r.actor === "ai:dm",
      ).length,
      segments: segments.length,
      rolls: input.ledger.filter((l) => l.kind === "roll").length,
      findings: counts,
    },
    segments: reportSegments,
    findings,
    fight: fightStats(transcript, input.ledger),
    models: input.models,
    modelNote,
    usage: { ...usage, costUsd: null },
  };
}

async function auditSegment(
  gateway: Gateway,
  seg: Segment,
  input: AuditInput,
  raw: Raw[],
  usage: { calls: number; inputTokens: number; outputTokens: number },
): Promise<SegmentAuditor> {
  const prompt = buildAuditorPrompt(seg, input.seed);
  let user = prompt.user;
  let attempts = 0;
  let lastError = "upstream";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    attempts = attempt;
    const res = await callOnce(gateway, prompt.system, user, input.signal);
    usage.calls += 1;
    usage.inputTokens += res.inputTokens;
    usage.outputTokens += res.outputTokens;
    if (!res.ok) {
      lastError = res.kind;
      continue;
    }
    const parsed = parseOutput(res.text);
    if (!parsed.ok) {
      lastError = "parse";
      user = `${prompt.user}\n\nYour previous answer was rejected: ${parsed.issues}. Answer again with valid JSON only.`;
      continue;
    }
    const inSegment = new Set(seg.rows.map((r) => r.seq));
    let discarded = 0;
    let kept = 0;
    for (const f of parsed.value.findings) {
      const seqs = f.seqs.filter((s) => inSegment.has(s));
      if (seqs.length === 0) {
        discarded += 1;
        continue;
      }
      const known = f.doctrineId !== null && DOCTRINE_IDS.has(f.doctrineId);
      const kind: FindingKind =
        f.doctrineId !== null && !known ? "other" : f.kind;
      raw.push({
        segment: seg.index,
        source: "auditor",
        check: null,
        kind,
        doctrineId: known ? f.doctrineId : null,
        seqs,
        detail: f.detail,
      });
      kept += 1;
    }
    return {
      verdict: parsed.value.verdict,
      findings: kept,
      discarded,
      truncated: prompt.truncated,
      attempts,
    };
  }
  return { error: lastError };
}
