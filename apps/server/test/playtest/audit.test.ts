import { describe, expect, it } from "vitest";
import { runAudit } from "../../src/playtest/auditor/audit.js";
import { renderReport } from "../../src/playtest/auditor/render.js";
import { ReportSchema } from "../../src/playtest/auditor/schema.js";
import { loadClean, loadDoctored, PASS, scriptedGateway } from "./helpers.js";

const NOW = () => new Date("2026-01-01T00:00:00Z");

async function audit(
  d: ReturnType<typeof loadDoctored>,
  gw: ReturnType<typeof scriptedGateway> | null,
) {
  const report = await runAudit({
    transcript: d.transcript,
    ledger: d.ledger,
    jobs: d.jobs,
    seed: d.seed,
    gateway: gw?.gateway ?? null,
    models: gw?.models ?? {},
    now: NOW,
  });
  return ReportSchema.parse(report);
}

const eight = (over: Record<number, string> = {}) =>
  Array.from({ length: 8 }, (_, i) => over[i] ?? PASS);

describe("runAudit", () => {
  it("fails the doctored fixture with exactly the README's findings (checks only)", async () => {
    const report = await audit(loadDoctored(), null);
    expect(report.verdict).toBe("fail");
    expect(report.auditorMode).toBe("checks-only");
    expect(
      report.findings.map((f) => [
        f.segment,
        f.check ?? f.kind,
        f.seqs,
        f.severity,
      ]),
    ).toEqual([
      [0, "dice-language", [10], "fail"],
      [1, "roll-reasons", [15], "fail"],
      [1, "prose-digits", [18], "fail"],
      [2, "dice-lines", [26], "fail"],
      [4, "life-states", [50], "fail"],
      [5, "dm-audit-flag", [61], "note"],
      [6, "hidden-info", [72], "fail"],
    ]);
    expect(report.counts.findings).toEqual({ fail: 6, warn: 0, note: 1 });
    expect(report.segments.every((s) => "skipped" in s.auditor)).toBe(true);
    expect(report.findings[5]?.detail).toContain(
      "final: fallback; attempts: 1",
    );
  });

  it("reads a new job's check record for the dm-audit-flag note (spec 103)", async () => {
    const input = loadDoctored();
    const jobs = input.jobs.map((j) =>
      j.audit?.flagged
        ? {
            ...j,
            audit: null,
            check: {
              leak: [{ check: "leak", kind: "dm-only-text" }],
              contradiction: [{ check: "contradiction", kind: "life-state" }],
              corrected: true,
              shippedProseSha256: "x",
            },
          }
        : j,
    );
    const report = await audit({ ...input, jobs } as never, null);
    const note = report.findings.find((f) => f.kind === "dm-audit-flag");
    expect(note?.detail).toBe(
      "check: leak/dm-only-text, contradiction/life-state",
    );
  });

  it("passes the clean run and fills the fight statistics", async () => {
    const gw = scriptedGateway(eight());
    const report = await audit(loadClean(), gw);
    expect(report.verdict).toBe("pass");
    expect(report.counts.segments).toBe(8);
    expect(report.fight?.attackRolls.players).toBe(3);
    expect(report.fight?.turnModeNarrations).toBe(4);
    // Derived from the fight's ending rows (encounter.ended: "Snag offers the clapper...").
    expect(report.fight?.fledOrBargained).toEqual([
      "Snag offers the clapper for safe passage.",
      "Snag trades the clapper for safe passage and the way is clear.",
    ]);
    expect(report.fight?.fledOrBargainedNote).toBeNull();
    expect(gw.provider.pendingFor("playtest.audit")).toBe(0);
    expect(report.usage.calls).toBe(8);
  });

  it("turns a doctrine finding into a warn that never changes the verdict", async () => {
    const answer = JSON.stringify({
      verdict: "fail",
      findings: [
        {
          kind: "doctrine",
          doctrineId: "short-turns",
          seqs: [45],
          detail: "Long turn.",
        },
      ],
    });
    const report = await audit(
      loadClean(),
      scriptedGateway(eight({ 3: answer })),
    );
    const f = report.findings.filter((x) => x.source === "auditor");
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({
      kind: "doctrine",
      doctrineId: "short-turns",
      severity: "warn",
      segment: 3,
    });
    expect(report.verdict).toBe("pass");
  });

  it("turns an unknown doctrine id into kind other", async () => {
    const answer = JSON.stringify({
      verdict: "fail",
      findings: [
        {
          kind: "doctrine",
          doctrineId: "no-such-rule",
          seqs: [45],
          detail: "x",
        },
      ],
    });
    const report = await audit(
      loadClean(),
      scriptedGateway(eight({ 3: answer })),
    );
    expect(report.findings[0]).toMatchObject({
      kind: "other",
      doctrineId: null,
      severity: "warn",
    });
  });

  it("drops out-of-segment seqs and counts discarded findings", async () => {
    const answer = JSON.stringify({
      verdict: "fail",
      findings: [
        { kind: "other", doctrineId: null, seqs: [999, 45], detail: "kept" },
        { kind: "other", doctrineId: null, seqs: [999], detail: "dropped" },
      ],
    });
    const report = await audit(
      loadClean(),
      scriptedGateway(eight({ 3: answer })),
    );
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.seqs).toEqual([45]);
    expect(report.segments[3]?.auditor).toMatchObject({
      findings: 1,
      discarded: 1,
    });
  });

  it("retries once on bad JSON, then records an error and verdict incomplete", async () => {
    const gw = scriptedGateway([
      "not json",
      "still not json",
      ...eight().slice(1),
    ]);
    const report = await audit(loadClean(), gw);
    expect(report.segments[0]?.auditor).toEqual({ error: "parse" });
    expect(report.verdict).toBe("incomplete");
    expect(report.usage.calls).toBe(9);
  });

  it("retries a gateway error once and then succeeds", async () => {
    const gw = scriptedGateway([{ error: "upstream" }, ...eight()]);
    const report = await audit(loadClean(), gw);
    expect(report.segments[0]?.auditor).toMatchObject({
      verdict: "pass",
      attempts: 2,
    });
    expect(report.verdict).toBe("pass");
  });

  it("parses a fenced JSON answer", async () => {
    const fenced = `\`\`\`json\n${PASS}\n\`\`\``;
    const report = await audit(
      loadClean(),
      scriptedGateway(eight({ 0: fenced })),
    );
    expect(report.segments[0]?.auditor).toMatchObject({ verdict: "pass" });
  });

  it("gives stable finding ids across two runs", async () => {
    const a = await audit(loadDoctored(), null);
    const b = await audit(loadDoctored(), null);
    expect(a.findings).toEqual(b.findings);
    expect(a.findings.map((f) => f.id)).toEqual([
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
    ]);
  });

  it("reports no-scene as incomplete", async () => {
    const d = loadClean();
    d.transcript = d.transcript.filter((r) => r.type !== "scene.changed");
    const report = await audit(d, null);
    expect(report.verdict).toBe("incomplete");
    expect(report.findings.map((f) => f.kind)).toEqual(["no-scene"]);
    expect(report.counts.segments).toBe(0);
  });

  it("keeps prompt text out of both report files", async () => {
    const gw = scriptedGateway(eight());
    const report = await audit(loadClean(), gw);
    const files = JSON.stringify(report) + renderReport(report);
    expect(files).not.toContain("You audit a tabletop game transcript");
    expect(files).not.toContain("short-turns: Keep each turn");
    const call = gw.provider.chatCalls[0];
    expect(call?.request.system).toContain(
      "You audit a tabletop game transcript",
    );
    expect(call?.request.messages[0]?.content).toContain("short-turns");
    expect(call?.request.messages[0]?.content).toContain("[dm-only]");
  });

  it("sets modelNote when the auditor and narrator share a model", async () => {
    const same = await audit(
      loadClean(),
      scriptedGateway(eight(), { auditModel: "m", narrateModel: "m" }),
    );
    expect(same.modelNote).toContain("same provider and model");
    const diff = await audit(loadClean(), scriptedGateway(eight()));
    expect(diff.modelNote).toBeNull();
  });
});
