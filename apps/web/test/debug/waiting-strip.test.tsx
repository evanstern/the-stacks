import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { WaitingStrip } from "~/debug/components/waiting-strip";
import type { RetryState } from "~/debug/use-debug-session";
import type { WaitingSummary } from "~/debug/waiting";

const base: WaitingSummary = {
  active: [],
  uncommitted: [],
  mode: { kind: "free" },
  proposals: [],
  holds: [],
  latestFailure: null,
  stuck: false,
  showRetry: false,
};
const idle: RetryState = { inFlight: false, jobId: null, refusal: null };
const render = (s: Partial<WaitingSummary>, r: Partial<RetryState> = {}) =>
  renderToStaticMarkup(
    <WaitingStrip
      summary={{ ...base, ...s }}
      retry={{ ...idle, ...r }}
      onRetry={() => {}}
    />,
  );

test("empty reads nothing queued and has no retry", () => {
  const html = render({});
  expect(html).toContain("nothing queued");
  expect(html).not.toContain("Retry the turn");
});

test("a running job shows kind, stage, attempts and heartbeat age", () => {
  const html = render({
    active: [
      {
        id: "j1",
        kind: "turn",
        stage: "narrate-check",
        attempts: 2,
        heartbeatAgeMs: 4000,
      },
    ],
  });
  expect(html).toContain("turn");
  expect(html).toContain("stage narrate-check");
  expect(html).toContain("attempts 2");
  expect(html).toContain("4 s");
  expect(html).not.toContain("nothing queued");
});

test("actions, mode, proposals, holds and the failure render", () => {
  const html = render({
    uncommitted: [{ actionId: "a", actorLabel: "Mira", status: "declared" }],
    mode: { kind: "turn", actorLabel: "Mira", round: 2 },
    proposals: [{ proposalId: "p", kind: "roll", policy: "dm-approves" }],
    holds: [
      { turnJobId: "t1", companionJobId: "c1", companionStatus: "running" },
    ],
    latestFailure: {
      jobId: "t0",
      node: "adjudicate",
      kind: "invalid-json",
      message: "bad",
      finishedAt: "2026-10-27T12:00:00.000Z",
    },
  });
  expect(html).toContain("Mira (declared)");
  expect(html).toContain("Turn mode: Mira");
  expect(html).toContain("roll (dm-approves)");
  expect(html).toContain("Held turn t1");
  expect(html).toContain("invalid-json at adjudicate");
});

test("retry renders only when showRetry; disabled in flight", () => {
  expect(render({ showRetry: true })).toContain("Retry the turn");
  const busy = render({ showRetry: true }, { inFlight: true });
  expect(busy).toContain("disabled");
});

test("the returned job id and a refusal render inline", () => {
  expect(render({ showRetry: true }, { jobId: "j9" })).toContain(
    "Queued job j9",
  );
  const html = render({ showRetry: true }, { refusal: "A turn is running." });
  expect(html).toContain("A turn is running.");
  expect(html).toContain('role="alert"');
});
