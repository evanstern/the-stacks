import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { DebugBoard } from "~/debug/components/debug-view";
import { emptySnapshot } from "~/debug/snapshot";
import { ev, iso, job, NOW } from "./_fixtures";

const jobs = [
  job({
    id: "ja",
    createdAt: iso(0),
    result: {
      checkpoint: {
        beat: [],
        submissions: [
          { stepRef: "s", key: "k", kind: "x", result: "applied", seqs: [2] },
        ],
      },
    },
  }),
  job({
    id: "jb",
    createdAt: iso(5000),
    result: { checkpoint: { beat: [], submissions: [] } },
  }),
];
const session = () => ({
  snapshot: {
    ...emptySnapshot(),
    events: [ev(1), ev(2), ev(3)],
    jobs: new Map(jobs.map((j) => [j.id, j])),
  },
  projections: {
    actions: [],
    party: [],
    tableMode: { mode: "free" },
    encounter: null,
    proposals: [],
  } as never,
  now: NOW,
  loaded: true,
  retry: { inFlight: false, jobId: null, refusal: null },
  onRetry: () => {},
  loadOlderJobs: () => {},
});
const render = (seq: number | null) =>
  renderToStaticMarkup(
    <DebugBoard
      session={session()}
      initialSelection={{ jobId: null, seq, pinnedSeq: seq }}
    />,
  );

test("a selected seq highlights the job that wrote it and its rows", () => {
  const html = render(2);
  expect(html).toMatch(/data-job-card="ja" data-highlight="true"/);
  expect(html).not.toMatch(/data-job-card="jb" data-highlight/);
  expect(html).toMatch(
    /data-seq="2" data-highlight="true" data-selected="true"/,
  );
});

test("a seq no job wrote highlights no card", () => {
  const html = render(3);
  expect(html).not.toContain('data-job-card="ja" data-highlight');
  expect(html).not.toContain('data-job-card="jb" data-highlight');
});
