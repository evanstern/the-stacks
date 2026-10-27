import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { project } from "@the-stacks/session-model";
import { fixtureIds, fixtures } from "@the-stacks/session-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProposalList } from "~/play/components/proposal-list";
import type { TableSource } from "~/play/source";
import { TableView } from "~/play/table-view";
import { proposalsFor } from "~/play/use-fixture-table";
import { viewerFor } from "~/play/viewer";

const yes = () => true;
const commands = {
  floor: yes,
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

test("the DM's dm-approvals panel content has two Approve, one Dismiss and the new description", () => {
  const f = fixtures.find((x) => x.name === "dm-approvals");
  if (!f) throw new Error("dm-approvals fixture missing");
  const source = sourceFor(f, f.viewers.dm);
  // The slide-out renders no content while closed, so render the panel body directly.
  const html = renderToStaticMarkup(
    <ProposalList
      proposals={source.proposals}
      onApprove={yes}
      onReject={yes}
    />,
  );
  expect(html.split(">Approve<").length - 1).toBe(2);
  expect(html.split(">Dismiss<").length - 1).toBe(1);
  const src = readFileSync(
    fileURLToPath(new URL("../../app/play/table-view.tsx", import.meta.url)),
    "utf8",
  );
  expect(src).toContain(
    "Approve or reject each proposal. Dismiss a suggestion once you have acted on it.",
  );
});

// ---- spec 049: floor controls ----

function floorSource(
  through: number,
  viewerOf: (
    f: (typeof fixtures)[number],
  ) => (typeof fixtures)[number]["viewers"]["dm"],
  floor: (input: unknown) => boolean = yes,
): TableSource {
  const f = fixtures.find((x) => x.name === "turn-floor");
  if (!f) throw new Error("turn-floor fixture missing");
  const events = f.events.filter((e) => e.seq <= through);
  const viewer = viewerOf(f);
  return {
    ...sourceFor({ ...f, events }, viewer),
    commands: { ...commands, floor },
  };
}

test("the active player sees End turn; others and an AI-seat DM see no floor controls", () => {
  const ana = renderToStaticMarkup(
    <TableView source={floorSource(13, (f) => f.viewers.players[0])} />,
  );
  expect(ana).toContain(">End turn<");
  expect(ana).not.toContain(">Pass<");
  expect(ana).not.toContain(">Take floor<");
  const bram = renderToStaticMarkup(
    <TableView source={floorSource(13, (f) => f.viewers.players[1])} />,
  );
  expect(bram).not.toContain(">End turn<");
  const dm = renderToStaticMarkup(
    <TableView source={floorSource(13, (f) => f.viewers.dm)} />,
  );
  expect(dm).not.toContain(">Pass<");
  expect(dm).not.toContain(">Take floor<");
});

test("the seated DM sees Pass and Take floor, then Pass and Return floor", () => {
  const free = renderToStaticMarkup(
    <TableView source={floorSource(24, (f) => f.viewers.dm)} />,
  );
  expect(free).toContain(">Pass<");
  expect(free).toContain(">Take floor<");
  expect(free).not.toContain(">Return floor<");
  expect(free).not.toContain(">End turn<");
  const held = renderToStaticMarkup(
    <TableView source={floorSource(25, (f) => f.viewers.dm)} />,
  );
  expect(held).toContain(">Pass<");
  expect(held).toContain(">Return floor<");
  expect(held).not.toContain(">Take floor<");
  expect(held).toContain("The DM has the floor");
});

test("the strip and the floor line render with no modal markup", () => {
  const html = renderToStaticMarkup(
    <TableView source={floorSource(25, (f) => f.viewers.players[0])} />,
  );
  expect(html).toContain('aria-label="Turn order"');
  expect(html).toContain("Goblin");
  expect(html).toContain("The DM has the floor");
  expect(html).not.toContain("<dialog");
  expect(html).not.toContain("aria-modal");
  expect(html).not.toContain("confirm(");
});

test("a free-mode table renders no strip and no floor controls", () => {
  const f = fixtures.find((x) => x.name === "talk-only");
  if (!f) throw new Error("fixture missing");
  const html = renderToStaticMarkup(
    <TableView source={sourceFor(f, f.viewers.players[0])} />,
  );
  expect(html).not.toContain('aria-label="Turn order"');
  expect(html).not.toContain("End turn");
});

test("a floor refusal shows inline with its label", () => {
  const f = fixtures.find((x) => x.name === "turn-floor");
  if (!f) throw new Error("turn-floor fixture missing");
  const html = renderToStaticMarkup(
    <TableView
      source={{
        ...floorSource(13, (g) => g.viewers.players[0]),
        notice: "The turn moved on. Try again. (TURN_MOVED)",
      }}
    />,
  );
  expect(html).toContain("The turn moved on");
});
