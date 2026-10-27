import { readFileSync } from "node:fs";
import type { LedgerRow } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { fightStats } from "../../src/playtest/auditor/stats.js";
import { readRunDir } from "../../src/playtest/export.js";
import { loadDoctored } from "./helpers.js";

type ChangeRow = Extract<LedgerRow, { kind: "change" }>;

const isChange = (r: LedgerRow): r is ChangeRow => r.kind === "change";

describe("fightStats reducedToZero", () => {
  it("counts an NPC dropped to 0 HP", () => {
    const d = loadDoctored();
    const row = d.ledger.find(
      (r): r is ChangeRow =>
        isChange(r) && r.type === "hp.changed" && r.seq === 68,
    );
    if (!row) throw new Error("seq 68 hp.changed row missing from fixture");
    row.after = { current: 0, temp: 0 };
    const stats = fightStats(d.transcript, d.ledger);
    expect(stats?.reducedToZero).toEqual(["Goblin lookout"]);
  });

  it("counts a party member dropped to 0 HP", () => {
    const d = loadDoctored();
    const seed = d.ledger.find(
      (r): r is ChangeRow =>
        isChange(r) && r.type === "hp.changed" && r.seq === 68,
    );
    if (!seed) throw new Error("seq 68 hp.changed row missing from fixture");
    const copy = structuredClone(seed);
    copy.subject = "tamsin";
    copy.before = { current: 13, temp: 0 };
    copy.after = { current: 0, temp: 0 };
    d.ledger.push(copy);
    const stats = fightStats(d.transcript, d.ledger);
    expect(stats?.reducedToZero).toEqual(["Tamsin Vale"]);
  });

  it("recomputes the M2 demo session", () => {
    const DEMO = new URL(
      "../../../../docs/design/m2-demo/demo-session",
      import.meta.url,
    ).pathname;
    const run = readRunDir(DEMO);
    const report = JSON.parse(readFileSync(`${DEMO}/report.json`, "utf8")) as {
      fight: Record<string, unknown>;
    };
    const stats = fightStats(run.transcript, run.ledger);
    expect(stats).toEqual({
      ...report.fight,
      reducedToZero: ["Goblin lookout"],
    });
  });
});
