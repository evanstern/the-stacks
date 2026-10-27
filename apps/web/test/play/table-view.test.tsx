import { project } from "@the-stacks/session-model";
import { fixtureIds, fixtures } from "@the-stacks/session-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { TableSource } from "~/play/source";
import { TableView } from "~/play/table-view";
import { proposalsFor } from "~/play/use-fixture-table";
import { viewerFor } from "~/play/viewer";

const yes = () => true;
const commands = {
  sendTalk: yes,
  declareAction: yes,
  comment: yes,
  commit: yes,
  withdraw: yes,
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
    presence: null,
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

test("an unseated operator views as a player: no approvals trigger, no modal markup", () => {
  const f = fixtures.find((x) => x.name === "dm-approvals");
  if (!f) throw new Error("fixture missing");
  const viewer = viewerFor(
    { id: "op-unseated", role: "operator" },
    project(f.events, f.viewers.dm),
  );
  expect(viewer).toEqual({ role: "player", userId: "op-unseated" });
  const html = renderToStaticMarkup(
    <TableView source={sourceFor(f, viewer)} />,
  );
  expect(html).not.toContain("Pending proposals");
  expect(html).not.toContain("<dialog");
  expect(html).not.toContain("aria-modal");
});

test("the hidden-entry notice shows for unknown-and-invalid", () => {
  const f = fixtures.find((x) => x.name === "unknown-and-invalid");
  if (!f) throw new Error("fixture missing");
  const html = renderToStaticMarkup(
    <TableView source={sourceFor(f, f.viewers.dm)} />,
  );
  expect(html).toContain("entries not shown");
});

test("presence.recorded rows stay out of the transcript and the ledger", async () => {
  const { presenceMarker } = await import("@the-stacks/session-model/fixtures");
  const viewer = presenceMarker.viewers.dm;
  const html = renderToStaticMarkup(
    <TableView
      source={{
        ...sourceFor(presenceMarker as never, viewer),
        presence: [],
      }}
    />,
  );
  expect(html).toContain("I just joined.");
  expect(html).not.toContain("presence.recorded");
  expect(html).not.toContain("director");
});

test("the Debug link renders only with debugHref, opening a new tab", () => {
  const f = fixtures.find((x) => x.name === "dm-approvals");
  if (!f) throw new Error("fixture missing");
  const href = "/play/s1/debug";
  const withLink = renderToStaticMarkup(
    <TableView source={sourceFor(f, f.viewers.dm)} debugHref={href} />,
  );
  expect(withLink).toMatch(
    /<a [^>]*href="\/play\/s1\/debug"[^>]*target="_blank"[^>]*rel="noopener"/,
  );
  expect(withLink).toContain("Debug");
  const without = renderToStaticMarkup(
    <TableView source={sourceFor(f, f.viewers.dm)} />,
  );
  expect(without).not.toContain("/debug");
  expect(without).not.toMatch(/>Debug</);
});
