/**
 * T015 (010 US1): the /search page — query rides the URL, results render
 * with attribution links, per-signal scores, and the run-receipt link (US2's
 * door); the empty state is honest and points at upload. fetch is stubbed at
 * the web→api seam, same pattern as library-list.test.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as searchRoute from "../app/routes/search";
import ProtectedLayout, { loader as protectedLoader } from "../app/routes/protected-layout";

const RUN_ID = "33333333-3333-3333-3333-333333333333";
const SOURCE_ID = "44444444-4444-4444-4444-444444444444";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function searchResponse(results: unknown[]) {
  return {
    runId: RUN_ID,
    query: "grapple",
    config: { configName: "env-default", fusion: "rrf", k: 10 },
    results,
    timings: { embed: 3, fts: 2, vector: 4, fusion: 0, rerank: null },
  };
}

const hit = {
  rank: 1,
  chunkId: "chunk-grapple",
  sourceId: SOURCE_ID,
  generation: 1,
  content: "The grapple rule: a creature can seize another and hold it in place.",
  anchor: { headingTrail: ["Combat", "Grappling"] },
  scores: { fts: 0.42, vector: 0.91, fused: 0.0325, rerank: null },
  prerankPosition: null,
};

/** Session probe (layout loader) answers ok; the search POST is per-test. */
function stubFetch(searchBody: unknown, searchStatus = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) return jsonResponse({ authenticated: true });
      if (url.includes("/api/retrieval/search")) return jsonResponse(searchBody, searchStatus);
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

function renderSearch(initialPath: string) {
  const Stub = createRoutesStub([
    {
      Component: ProtectedLayout,
      loader: protectedLoader,
      children: [
        {
          path: "/search",
          Component: searchRoute.default,
          loader: searchRoute.loader,
        },
      ],
    },
  ]);
  render(<Stub initialEntries={[initialPath]} />);
}

describe("/search", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders results with passage text, source link, heading trail, scores, and the receipt link", async () => {
    stubFetch(searchResponse([hit]));
    renderSearch("/search?q=grapple");

    await waitFor(() => {
      expect(screen.getByText(/grapple rule/)).toBeInTheDocument();
    });
    const sourceLink = screen.getByRole("link", { name: "view source" });
    expect(sourceLink).toHaveAttribute("href", `/library/uploads/source/${SOURCE_ID}`);
    expect(screen.getByText("Combat › Grappling")).toBeInTheDocument();
    expect(screen.getByText(/vector 0\.910/)).toBeInTheDocument();
    const receipt = screen.getByRole("link", { name: "run receipt" });
    expect(receipt).toHaveAttribute("href", `/records/retrievals/${RUN_ID}`);
  });

  it("honest empty state points at the upload page", async () => {
    stubFetch(searchResponse([]));
    renderSearch("/search?q=zqxv%20kjw");

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /upload the material/ })).toHaveAttribute(
      "href",
      "/library/upload",
    );
  });

  it("no query: just the search box, no API call", async () => {
    stubFetch(searchResponse([hit]));
    renderSearch("/search");

    await waitFor(() => {
      expect(screen.getByRole("searchbox", { name: "Search the library" })).toBeInTheDocument();
    });
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes("/api/retrieval/search"))).toBe(false);
  });

  it("Search sits in the primary nav", async () => {
    stubFetch(searchResponse([]));
    renderSearch("/search");

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
    });
  });
});
