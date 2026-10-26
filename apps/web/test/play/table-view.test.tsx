import { fixtureIds, fixtures } from "@the-stacks/session-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { TableSource } from "~/play/source";
import { TableView } from "~/play/table-view";
import { proposalsFor } from "~/play/use-fixture-table";

const yes = () => true;
const commands = {
  sendTalk: yes,
  declareAction: yes,
  comment: yes,
  commit: yes,
  approve: yes,
  reject: yes,
};

function sourceFor(
  f: (typeof fixtures)[number],
  viewer: (typeof fixtures)[number]["viewers"]["dm"],
): TableSource {
  return {
    kind: "fixture",
    viewer,
    actor: viewer.role === "dm" ? fixtureIds.dmActor : viewer.userId,
    events: f.events,
    status: "fixture",
    caughtUp: true,
    notice: null,
    proposals: proposalsFor(f.events, viewer, new Set()),
    commands,
  };
}

test("TableView renders every fixture for every viewer with no modal markup (AC #6)", () => {
  for (const f of fixtures) {
    for (const viewer of [f.viewers.dm, ...f.viewers.players]) {
      const html = renderToStaticMarkup(
        <TableView source={sourceFor(f, viewer)} />,
      );
      expect(html, f.name).toContain("Message type");
      expect(html).not.toContain("<dialog");
      expect(html).not.toContain("aria-modal");
    }
  }
});

test("only the DM sees the Pending proposals trigger", () => {
  const f = fixtures.find((x) => x.name === "dm-approvals");
  if (!f) throw new Error("fixture missing");
  const player = renderToStaticMarkup(
    <TableView source={sourceFor(f, f.viewers.players[0])} />,
  );
  const dm = renderToStaticMarkup(
    <TableView source={sourceFor(f, f.viewers.dm)} />,
  );
  expect(player).not.toContain("Pending proposals");
  expect(dm).toContain("Pending proposals (3)");
  expect(dm).toContain("Ledger");
});

test("the hidden-entry notice shows for unknown-and-invalid", () => {
  const f = fixtures.find((x) => x.name === "unknown-and-invalid");
  if (!f) throw new Error("fixture missing");
  const html = renderToStaticMarkup(
    <TableView source={sourceFor(f, f.viewers.dm)} />,
  );
  expect(html).toContain("entries not shown");
});
