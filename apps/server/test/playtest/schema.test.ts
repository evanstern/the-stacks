import { describe, expect, it } from "vitest";
import {
  AuditorOutput,
  FINDING_KINDS,
  FindingSchema,
  ReportSchema,
  SEVERITY_OF,
} from "../../src/playtest/auditor/schema.js";

const finding = {
  kind: "doctrine" as const,
  doctrineId: null,
  seqs: [1],
  detail: "x",
};

describe("AuditorOutput", () => {
  it("accepts a pass with no findings", () => {
    expect(
      AuditorOutput.safeParse({ verdict: "pass", findings: [] }).success,
    ).toBe(true);
  });
  it("rejects a fail with no findings", () => {
    expect(
      AuditorOutput.safeParse({ verdict: "fail", findings: [] }).success,
    ).toBe(false);
  });
  it("rejects more than 12 findings", () => {
    const findings = Array.from({ length: 13 }, () => finding);
    expect(AuditorOutput.safeParse({ verdict: "fail", findings }).success).toBe(
      false,
    );
    expect(
      AuditorOutput.safeParse({
        verdict: "fail",
        findings: findings.slice(0, 12),
      }).success,
    ).toBe(true);
  });
});

describe("severity and findings", () => {
  it("SEVERITY_OF covers every kind", () => {
    expect(Object.keys(SEVERITY_OF).sort()).toEqual([...FINDING_KINDS].sort());
  });
  it("a finding id must match F<n>", () => {
    const base = {
      source: "check" as const,
      check: "prose-digits",
      kind: "ledger-contradiction" as const,
      severity: "fail" as const,
      segment: 0,
      doctrineId: null,
      seqs: [3],
      detail: "digit in prose",
    };
    expect(FindingSchema.safeParse({ ...base, id: "F1" }).success).toBe(true);
    expect(FindingSchema.safeParse({ ...base, id: "F" }).success).toBe(false);
    expect(FindingSchema.safeParse({ ...base, id: "X1" }).success).toBe(false);
  });
});

describe("ReportSchema", () => {
  it("round-trips a minimal report", () => {
    const report = {
      v: 1 as const,
      runId: "20260101T000000Z-greyhollow-ford-ci",
      sessionId: "00000000-0000-4000-8000-000000000001",
      seedId: "greyhollow-ford",
      auditedAt: "2026-01-01T00:00:00.000Z",
      commit: "abc1234",
      verdict: "pass" as const,
      auditorMode: "checks-only" as const,
      counts: {
        rows: 0,
        narrations: 0,
        segments: 0,
        rolls: 0,
        findings: { fail: 0, warn: 0, note: 0 },
      },
      segments: [],
      findings: [],
      fight: null,
      models: {},
      modelNote: null,
      usage: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: null },
    };
    const parsed = ReportSchema.parse(report);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(report);
  });
});
