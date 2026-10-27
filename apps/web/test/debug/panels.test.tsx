import { project } from "@the-stacks/session-model";
import { fixtures } from "@the-stacks/session-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { CallTotals, UsageTotals } from "~/debug/api-types";
import { CostBody } from "~/debug/components/cost-panel";
import { JournalBody } from "~/debug/components/journal-panel";
import { LedgerBody } from "~/debug/components/ledger-panel";
import { SeedBody } from "~/debug/components/seed-panel";
import { createFolder } from "~/debug/scrub";

const DM = { role: "dm" } as const;
const secret = fixtures.find((f) => f.name === "secret-tracker");
if (!secret) throw new Error("fixture");

test("Seed marks dmOnlyPaths fields DM only and leaves others unmarked", () => {
  const html = renderToStaticMarkup(
    <SeedBody
      seed={{
        kind: "ok",
        seedId: "s1",
        seed: { title: "Crypt", secrets: { vault: "behind the altar" } },
        dmOnlyPaths: ["secrets"],
      }}
    />,
  );
  expect(html).toContain("secrets.vault");
  expect(html).toContain("DM only");
  expect(html.match(/DM only/g)).toHaveLength(1);
});

test("Seed says no scene for none and the failure for failed", () => {
  expect(renderToStaticMarkup(<SeedBody seed={{ kind: "none" }} />)).toContain(
    "no scene seed",
  );
  expect(
    renderToStaticMarkup(<SeedBody seed={{ kind: "failed" }} />),
  ).toContain("failed to load");
});

test("Ledger renders rows through the pinned seq", () => {
  const all = project(secret.events, DM).ledger;
  expect(all.length).toBeGreaterThan(0);
  const first = all[0];
  const none = createFolder(DM).through(secret.events, first.seq - 1).ledger;
  expect(renderToStaticMarkup(<LedgerBody rows={none} />)).toContain(
    "Nothing rolled yet.",
  );
  const html = renderToStaticMarkup(<LedgerBody rows={all} />);
  expect(html).toContain(first.reason);
});

test("Journal marks dm-visibility entries", () => {
  const entries = project(secret.events, DM).journal;
  expect(entries.some((e) => e.visibility === "dm")).toBe(true);
  const html = renderToStaticMarkup(<JournalBody entries={entries} />);
  expect(html).toContain("DM only");
  expect(html).toContain(entries[0].title);
  expect(renderToStaticMarkup(<JournalBody entries={[]} />)).toContain(
    "No journal entries.",
  );
});

const t = (calls: number, cost: number, unpriced = 0): UsageTotals => ({
  calls,
  inputTokens: calls * 10,
  outputTokens: calls * 5,
  costUsd: cost,
  unpricedCalls: unpriced,
  durationMs: 0,
});

test("Cost shows totals, by purpose, by model and the unpriced count", () => {
  const totals: CallTotals = {
    all: t(3, 0.03, 2),
    byPurpose: { "dm.director": t(2, 0.02), "dm.narrate": t(1, 0.01) },
    byModel: { "fake-1": t(3, 0.03) },
  };
  const html = renderToStaticMarkup(<CostBody totals={totals} />);
  expect(html).toContain("3 calls");
  expect(html).toContain("$0.0300");
  expect(html).toContain("Unpriced calls: 2");
  expect(html).toContain("dm.director");
  expect(html).toContain("dm.narrate");
  expect(html).toContain("fake-1");
  expect(html).toContain("By purpose");
  expect(html).toContain("By model");
});
