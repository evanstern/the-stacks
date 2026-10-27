import { project } from "@the-stacks/session-model";
import { fixtures } from "@the-stacks/session-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { DebugBoard } from "~/debug/components/debug-view";
import { StateColumn } from "~/debug/components/state-column";
import { createFolder } from "~/debug/scrub";
import { emptySnapshot } from "~/debug/snapshot";

const DM = { role: "dm" } as const;
const stateOf = (html: string) =>
  html.slice(html.indexOf('aria-label="State"'));
const fx = (name: string) => {
  const f = fixtures.find((x) => x.name === name);
  if (!f) throw new Error(name);
  return f;
};
const render = (
  projection: ReturnType<typeof project>,
  pinnedSeq: number | null = null,
) =>
  renderToStaticMarkup(
    <StateColumn
      projection={projection}
      pinnedSeq={pinnedSeq}
      onBackToLive={() => {}}
      onOpenPanel={() => {}}
    />,
  );

test("live shows party, encounter, mode, DM seat and trackers", () => {
  const f = fx("turn-mode-combat");
  const mid = f.events
    .map((e) => e.seq)
    .find(
      (q) =>
        project(
          f.events.filter((e) => e.seq <= q),
          DM,
        ).tableMode.mode === "turn",
    );
  if (mid === undefined) throw new Error("fixture has no turn mode");
  const combat = render(
    project(
      f.events.filter((e) => e.seq <= mid),
      DM,
    ),
  );
  expect(combat).toContain("Ana");
  expect(combat).toContain("Goblin");
  expect(combat).toContain("Mode: turn");
  expect(combat).toContain("Round ");
  expect(combat).toContain("DM seat: AI");
  expect(combat).not.toContain("back to live");
  expect(combat).not.toContain("pinned at seq");
  const secret = render(project(fx("secret-tracker").events, DM));
  expect(secret).toContain("The cult completes the ritual");
});

test("live shows policy overrides, a human seat and pending proposals", () => {
  const html = render(project(fx("dm-approvals").events, DM));
  expect(html).toContain("DM seat: human");
  expect(html).toContain("journal: ask");
  expect(html).toContain("Pending proposals");
  expect(html).not.toContain("No pending proposals");
});

test("pinned shows the badge, the state through the pin and back to live", () => {
  const f = fx("secret-tracker");
  const folder = createFolder(DM);
  const before = f.events.find((e) => e.type === "tracker.changed")?.seq ?? 1;
  const html = render(folder.through(f.events, before - 1), before - 1);
  expect(html).toContain(`pinned at seq ${before - 1}`);
  expect(html).toContain("back to live");
  expect(html).toContain("No trackers.");
});

test("the header carries the four panel triggers", () => {
  const html = render(project(fx("talk-only").events, DM));
  for (const l of ["Seed", "Ledger", "Journal", "Cost"]) {
    expect(html).toContain(`>${l}</button>`);
  }
});

test("the board renders the pin from the selection and folds through it", () => {
  const f = fx("secret-tracker");
  const trackerSeq = f.events.find((e) => e.type === "tracker.changed")?.seq;
  if (trackerSeq === undefined) throw new Error("fixture");
  const session = {
    snapshot: { ...emptySnapshot(), events: f.events },
    projections: project(f.events, DM),
    now: 0,
    loaded: true,
    retry: { inFlight: false, jobId: null, refusal: null },
    onRetry: () => {},
    loadOlderJobs: () => {},
  };
  const pinned = renderToStaticMarkup(
    <DebugBoard
      session={session}
      initialSelection={{ jobId: null, seq: 1, pinnedSeq: trackerSeq - 1 }}
    />,
  );
  expect(pinned).toContain(`data-pinned-seq="${trackerSeq - 1}"`);
  expect(pinned).toContain(`pinned at seq ${trackerSeq - 1}`);
  expect(stateOf(pinned)).not.toContain("The cult completes the ritual");
  const live = renderToStaticMarkup(<DebugBoard session={session} />);
  expect(live).not.toContain("pinned at seq");
  expect(stateOf(live)).toContain("The cult completes the ritual");
});
