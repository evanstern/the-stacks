import type { DebugCall, DebugJob } from "../../app/debug/api-types.ts";
import { toJobView } from "../../app/debug/job-view.ts";

const T0 = Date.parse("2026-10-27T12:00:00.000Z");
export const iso = (o: number) => new Date(T0 + o).toISOString();
export const NOW = T0 + 60_000;

export const job = (over: Partial<DebugJob>): DebugJob => ({
  id: "j1",
  kind: "turn",
  status: "succeeded",
  stage: null,
  attempts: 1,
  input: { trigger: "commit" },
  result: null,
  error: null,
  createdAt: iso(0),
  startedAt: iso(1000),
  heartbeatAt: null,
  finishedAt: iso(6000),
  ...over,
});

export const call = (over: Partial<DebugCall>): DebugCall => ({
  id: 1,
  jobId: "j1",
  jobKind: "turn",
  jobAttempt: 1,
  purpose: "dm.director",
  promptVersion: "v1",
  callAttempt: 1,
  outcome: "ok",
  errorKind: null,
  provider: "fake",
  model: "fake-1",
  inputTokens: 10,
  outputTokens: 5,
  costUsd: 0.01,
  durationMs: 100,
  httpAttempts: 1,
  at: iso(2000),
  ...over,
});

export const view = (
  j: DebugJob,
  ledger: DebugCall[] = [],
  all: DebugJob[] = [],
) => toJobView(j, ledger, NOW, all);

export const ev = (
  seq: number,
  type = "narration",
  actor = "u1",
  visibility = "all",
) => ({
  sessionId: "00000000-0000-4000-8000-000000000000",
  seq,
  actor,
  type,
  payload: { seq },
  payloadVersion: 1,
  visibility,
  ts: iso(seq * 1000),
});
