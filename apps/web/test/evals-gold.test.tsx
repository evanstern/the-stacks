/**
 * T023 (010 US3): the gold bench — labeling standard visible, split badges,
 * the re-confirmation queue linking back to search, prefill from the search
 * affordance, and the create flow posting through the action. fetch stubbed
 * at the web→api seam.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as goldRoute from "../app/routes/evals.gold";
import ProtectedLayout, { loader as protectedLoader } from "../app/routes/protected-layout";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const items = [
  {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    question: "when do opportunity attacks trigger?",
    expected: [{ chunkId: "chunk-1", sourceId: "s-1", contentSha256: "h1" }],
    split: "tuning",
    notes: null,
    createdAt: "2026-07-11T09:00:00.000Z",
    updatedAt: "2026-07-11T09:00:00.000Z",
    needsReconfirmation: false,
  },
  {
    id: "aaaaaaaa-0000-0000-0000-000000000002",
    question: "how does grappling work?",
    expected: [{ chunkId: "chunk-2", sourceId: "s-1", contentSha256: "h2" }],
    split: "heldout",
    notes: "core combat",
    createdAt: "2026-07-11T09:01:00.000Z",
    updatedAt: "2026-07-11T09:01:00.000Z",
    needsReconfirmation: true,
  },
];

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) return jsonResponse({ authenticated: true });
      if (url.includes("/api/evals/gold")) return jsonResponse({ items });
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
          path: "/evals/gold",
          Component: goldRoute.default as never,
          loader: goldRoute.loader as never,
          action: goldRoute.action as never,
        },
      ],
    },
  ]);
  render(<Stub initialEntries={[path]} />);
}

describe("/evals/gold", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the labeling standard, split badges, and the re-confirmation queue", async () => {
    stubFetch();
    renderAt("/evals/gold");

    await waitFor(() => {
      expect(screen.getByText(/Labeling standard/)).toBeInTheDocument();
    });
    const badges = screen.getAllByTestId("split-badge");
    expect(badges[0]).toHaveTextContent("tuning");
    expect(badges[1]).toHaveTextContent("heldout");

    // The flagged item sits in the queue with a search link for re-labeling.
    const queueItem = screen.getByTestId("reconfirm-item");
    expect(queueItem).toHaveTextContent("how does grappling work?");
    expect(screen.getByRole("link", { name: "find the new passage" })).toHaveAttribute(
      "href",
      `/search?q=${encodeURIComponent("how does grappling work?")}`,
    );
  });

  it("prefills the form from the search affordance (?chunkId&q)", async () => {
    stubFetch();
    renderAt("/evals/gold?chunkId=chunk-9&q=stealth%20checks");

    await waitFor(() => {
      expect(screen.getByLabelText("Question")).toHaveValue("stealth checks");
    });
    expect(screen.getByLabelText(/Expected chunk ids/)).toHaveValue("chunk-9");
  });

  it("'Gold set' sits in the nav", async () => {
    stubFetch();
    renderAt("/evals/gold");

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Gold set" })).toHaveAttribute("href", "/evals/gold");
    });
  });
});
