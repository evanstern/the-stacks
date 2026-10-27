import { project } from "@the-stacks/session-model";
import { fixtureIds, fixtures } from "@the-stacks/session-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { initialFrameState, reduceFrame } from "~/play/reduce-frame";
import type { TableSource } from "~/play/source";
import { TableView } from "~/play/table-view";
import { proposalsFor } from "~/play/use-fixture-table";
import { toTableViewModel } from "~/play/view-model";
import type { ServerFrame } from "~/ws/types";

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

type Fixture = (typeof fixtures)[number];
type Viewer = Fixture["viewers"]["dm"];

function actorOf(viewer: Viewer): string {
  return viewer.role === "dm" ? fixtureIds.dmActor : viewer.userId;
}

function fixtureSource(f: Fixture, viewer: Viewer): TableSource {
  return {
    kind: "fixture",
    viewer,
    actor: actorOf(viewer),
    events: f.events,
    status: "fixture",
    caughtUp: true,
    notice: null,
    proposals: proposalsFor(f.events, viewer, new Set()),
    commands,
  };
}

/** Feed events one frame at a time, as the socket does, then replay-complete. */
function liveSource(f: Fixture, viewer: Viewer): TableSource {
  let state = initialFrameState;
  for (const event of f.events) {
    state = reduceFrame(state, {
      type: "event",
      event: event as unknown as Extract<
        ServerFrame,
        { type: "event" }
      >["event"],
    });
  }
  state = reduceFrame(state, {
    type: "replay-complete",
    throughSeq: state.highestSeq,
  });
  return {
    kind: "live",
    viewer,
    actor: actorOf(viewer),
    events: state.events,
    status: "open",
    caughtUp: state.caughtUp,
    notice: state.notice,
    proposals: proposalsFor(f.events, viewer, new Set()),
    commands,
  };
}

const statusText =
  />(Connected|Live|Fixture|Open|Connecting|Reconnecting)[^<]*</gi;

test("fixture and live-shaped sources give the same view model and markup (SC-002)", () => {
  for (const f of fixtures) {
    for (const viewer of [f.viewers.dm, ...f.viewers.players]) {
      const a = fixtureSource(f, viewer);
      const b = liveSource(f, viewer);
      const modelOf = (s: TableSource) =>
        toTableViewModel(project(s.events, s.viewer), {
          actor: s.actor,
          proposals: s.proposals,
        });
      expect(modelOf(b), f.name).toEqual(modelOf(a));
      const strip = (html: string) => html.replace(statusText, "><");
      expect(
        strip(renderToStaticMarkup(<TableView source={b} />)),
        f.name,
      ).toBe(strip(renderToStaticMarkup(<TableView source={a} />)));
    }
  }
});
