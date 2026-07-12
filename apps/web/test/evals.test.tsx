/**
 * T033 (010 US4): the /evals surface — runs list with per-slice headline
 * metrics, the URL-addressable two-run comparison with deltas, honest
 * failed-status rendering, and the empty state pointing at the gold bench.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as evalsRoute from "../app/routes/evals";
import ProtectedLayout, { loader as protectedLoader } from "../app/routes/protected-layout";

const RUN_A = "77777777-7777-7777-7777-777777777771";
const RUN_B = "77777777-7777-7777-7777-777777777772";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const slice = (recallAt10: number, mrr: number) => ({
  items: 9,
  recallAt5: recallAt10 - 0.1,
  recallAt10,
  mrr,
  ndcgAt10: mrr - 0.05,
});

const runA = {
  id: RUN_A,
  configName: "rrf-default",
  status: "completed",
  createdAt: "2026-07-11T10:00:00.000Z",
  completedAt: "2026-07-11T10:00:30.000Z",
  metrics: { tuning: slice(0.9, 0.85), heldout: slice(1.0, 1.0), unresolvableCount: 0 },
};
const runB = {
  ...runA,
  id: RUN_B,
  configName: "weighted-a05",
  metrics: { tuning: slice(0.8, 0.7), heldout: slice(0.9, 0.8), unresolvableCount: 0 },
};
const failedRun = {
  id: "77777777-7777-7777-7777-777777777773",
  configName: "broken",
  status: "failed",
  createdAt: "2026-07-11T09:00:00.000Z",
  completedAt: "2026-07-11T09:00:05.000Z",
  metrics: null,
};

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) return jsonResponse({ authenticated: true });
      if (url.includes(`/api/evals/runs/${RUN_A}`))
        return jsonResponse({ ...runA, config: {}, itemOutcomes: [], retrievalRunIds: [], goldSnapshot: [], error: null });
      if (url.includes(`/api/evals/runs/${RUN_B}`))
        return jsonResponse({ ...runB, config: {}, itemOutcomes: [], retrievalRunIds: [], goldSnapshot: [], error: null });
      if (url.includes("/api/evals/runs")) return jsonResponse({ items: [runA, runB, failedRun] });
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

function renderAt(path: string) {
  const Stub = createRoutesStub([
    {
      Component: ProtectedLayout,
      loader: protectedLoader,
      children: [
        {
          path: "/evals",
          Component: evalsRoute.default as never,
          loader: evalsRoute.loader as never,
          action: evalsRoute.action as never,
        },
      ],
    },
  ]);
  render(<Stub initialEntries={[path]} />);
}

describe("/evals", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists runs with headline metrics and honest failed status", async () => {
    stubFetch();
    renderAt("/evals");

    await waitFor(() => {
      expect(screen.getByText("rrf-default")).toBeInTheDocument();
    });
    expect(screen.getByText("weighted-a05")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    // headline: tuning r@10 of run A
    expect(screen.getAllByText("0.900").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "Evals" })).toHaveAttribute("href", "/evals");
  });

  it("?compare=a,b renders the per-slice delta table", async () => {
    stubFetch();
    renderAt(`/evals?compare=${RUN_A},${RUN_B}`);

    await waitFor(() => {
      expect(screen.getByTestId("comparison")).toBeInTheDocument();
    });
    expect(screen.getByText("rrf-default → weighted-a05")).toBeInTheDocument();
    // tuning recall@10 delta: 0.8 - 0.9 = -0.100
    expect(screen.getAllByText("-0.100").length).toBeGreaterThanOrEqual(1);
  });
});
