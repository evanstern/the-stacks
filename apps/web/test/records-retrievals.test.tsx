/**
 * T019 (010 US2): the records surfaces — the run list (rows link to
 * receipts, honest empty state, paging counts) and the receipt detail
 * (snapshots render, superseded badge on swept passages, timings and
 * embedding stamp visible). fetch stubbed at the web→api seam.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as listRoute from "../app/routes/records.retrievals";
import * as detailRoute from "../app/routes/records.retrievals.$run";
import ProtectedLayout, { loader as protectedLoader } from "../app/routes/protected-layout";

const RUN_ID = "55555555-5555-5555-5555-555555555555";
const SOURCE_ID = "66666666-6666-6666-6666-666666666666";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const listPage = {
  items: [
    {
      id: RUN_ID,
      query: "grapple",
      origin: "interactive",
      resultCount: 2,
      createdAt: "2026-07-11T09:00:00.000Z",
      configName: "env-default",
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const detail = {
  id: RUN_ID,
  query: "grapple",
  origin: "interactive",
  config: { configName: "env-default", fusion: "rrf", k: 10 },
  embedding: { provider: "local-sidecar", model: "all-MiniLM-L6-v2", dimensions: 384 },
  timings: { embed: 12, fts: 3, vector: 8, fusion: 0, rerank: null },
  createdAt: "2026-07-11T09:00:00.000Z",
  results: [
    {
      rank: 1,
      chunkId: "chunk-live",
      sourceId: SOURCE_ID,
      generation: 1,
      content: "A passage that still exists at the current generation.",
      anchor: { headingTrail: ["Rules"] },
      scores: { fts: 0.4, vector: 0.8, fused: 0.032, rerank: null },
      prerankPosition: null,
      superseded: false,
    },
    {
      rank: 2,
      chunkId: "chunk-swept",
      sourceId: SOURCE_ID,
      generation: 1,
      content: "A passage whose text was rewritten by a later re-ingest.",
      anchor: { headingTrail: ["Rules"] },
      scores: { fts: 0.2, vector: 0.6, fused: 0.016, rerank: null },
      prerankPosition: null,
      superseded: true,
    },
  ],
};

function stubFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) return jsonResponse({ authenticated: true });
      for (const [fragment, body] of Object.entries(routes)) {
        if (url.includes(fragment)) return jsonResponse(body);
      }
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
          path: "/records/retrievals",
          Component: listRoute.default,
          loader: listRoute.loader,
        },
        {
          path: "/records/retrievals/:run",
          Component: detailRoute.default,
          loader: detailRoute.loader,
        },
      ],
    },
  ]);
  render(<Stub initialEntries={[path]} />);
}

describe("/records/retrievals", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists runs with receipt links, config, counts, and 'Retrievals' in the nav", async () => {
    stubFetch({ [`/api/retrieval/runs/${RUN_ID}`]: detail, "/api/retrieval/runs": listPage });
    renderAt("/records/retrievals");

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "grapple" })).toHaveAttribute(
        "href",
        `/records/retrievals/${RUN_ID}`,
      );
    });
    expect(screen.getByText("env-default")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 – 1 of 1/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retrievals" })).toHaveAttribute(
      "href",
      "/records/retrievals",
    );
  });

  it("honest empty state points at /search", async () => {
    stubFetch({ "/api/retrieval/runs": { items: [], total: 0, limit: 50, offset: 0 } });
    renderAt("/records/retrievals");

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "run a search" })).toHaveAttribute("href", "/search");
  });

  it("detail: snapshots render, superseded badge only on the swept passage", async () => {
    stubFetch({ [`/api/retrieval/runs/${RUN_ID}`]: detail, "/api/retrieval/runs": listPage });
    renderAt(`/records/retrievals/${RUN_ID}`);

    await waitFor(() => {
      expect(screen.getByText(/still exists at the current generation/)).toBeInTheDocument();
    });
    expect(screen.getByText(/rewritten by a later re-ingest/)).toBeInTheDocument();
    // exactly ONE superseded badge — the derivation is per-result
    expect(screen.getAllByTestId("superseded-badge")).toHaveLength(1);
    expect(screen.getByTestId("timings").textContent).toContain("rerank —");
    expect(screen.getByText(/local-sidecar\/all-MiniLM-L6-v2@384/)).toBeInTheDocument();
  });
});
