import type { LedgerRow, StoredEvent } from "@the-stacks/session-model";
import { FakeProvider } from "../../src/ai/adapters/fake.js";
import type { AiConfig } from "../../src/ai/config.js";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import type { SceneSeed } from "../../src/dm/seed/schema.js";
import type { AuditInput } from "../../src/playtest/auditor/audit.js";
import { type JobItem, readRunDir } from "../../src/playtest/export.js";

export const DOCTORED = new URL("./fixtures/doctored", import.meta.url)
  .pathname;

export interface Loaded {
  transcript: StoredEvent[];
  ledger: LedgerRow[];
  jobs: JobItem[];
  seed: SceneSeed;
}

export function loadDoctored(): Loaded {
  const run = readRunDir(DOCTORED);
  return {
    transcript: run.transcript,
    ledger: run.ledger,
    jobs: run.jobs,
    seed: loadSeed("greyhollow-ford"),
  };
}

/** The doctored fixture with every planted problem reverted. */
export function loadClean(): Loaded {
  const d = loadDoctored();
  const edit = (seq: number, f: (t: string) => string) => {
    const row = d.transcript.find((r) => r.seq === seq) as StoredEvent;
    const p = row.payload as { text: string };
    p.text = f(p.text);
  };
  edit(10, (t) => t.replace(" The air feels like a roll of the dice.", ""));
  edit(18, (t) =>
    t
      .replace("3 strands first gnawed", "first gnawed")
      .replace(
        "Tamsin Vale — :",
        "Tamsin Vale — Tamsin searches the ferry-house for whoever cut the bell rope:",
      ),
  );
  edit(26, (t) => t.replace("= 19 vs DC 12", "= 14 vs DC 12"));
  edit(50, (t) => t.replace(" Tamsin falls unconscious.", ""));
  edit(72, (t) =>
    t.replace(
      " He will trade the clapper for safe passage if two goblins fall.",
      "",
    ),
  );
  for (const l of d.ledger) {
    if (l.seq === 15 && l.kind === "roll") {
      l.reason =
        "Tamsin searches the ferry-house for whoever cut the bell rope";
      l.roll.reason = l.reason;
    }
  }
  for (const j of d.jobs) j.audit = null;
  return d;
}

/** A strict fake provider behind a real gateway; responses are chat texts in order. */
export function scriptedGateway(
  responses: (string | { error: "upstream" | "rate_limit" })[],
  opts: { auditModel?: string; narrateModel?: string } = {},
) {
  const provider = new FakeProvider();
  provider.strict = true;
  for (const r of responses) {
    provider.scriptChatFor(
      "playtest.audit",
      typeof r === "string"
        ? [
            { type: "text", text: r },
            { type: "done", usage: { inputTokens: 10, outputTokens: 5 } },
          ]
        : [
            {
              type: "error",
              kind: r.error,
              message: "boom",
              usage: { inputTokens: 0, outputTokens: 0 },
            },
          ],
    );
  }
  const config: AiConfig = {
    providers: { fake: { kind: "fake", baseUrl: "http://fake/x" } },
    purposes: {
      "playtest.audit": {
        provider: "fake",
        model: opts.auditModel ?? "audit-model",
        op: "chat",
      },
      "dm.narrate": {
        provider: "fake",
        model: opts.narrateModel ?? "narrate-model",
        op: "chat",
      },
    },
    prices: {},
  };
  const gateway = createGateway({
    config,
    sink: memorySink(),
    adapters: { fake: () => provider },
  });
  const models: AuditInput["models"] = {
    "playtest.audit": {
      provider: "fake",
      model: opts.auditModel ?? "audit-model",
    },
    "dm.narrate": {
      provider: "fake",
      model: opts.narrateModel ?? "narrate-model",
    },
  };
  return { gateway, provider, models };
}

export const PASS = JSON.stringify({ verdict: "pass", findings: [] });
