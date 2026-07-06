import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as homeRoute from "../app/routes/home";
import * as detailRoute from "../app/routes/skeleton-check-detail";

const RUN_ID = "11111111-1111-1111-1111-111111111111";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("skeleton check UI", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("trigger renders the accepted state without blocking", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string, init?: RequestInit) => {
      const href = String(url);
      // Check the most specific path (detail) before the generic list path,
      // since "/api/skeleton-checks" is a substring of the detail URL too.
      if (href.includes(`/api/skeleton-checks/${RUN_ID}`)) {
        return jsonResponse({
          run: {
            id: RUN_ID,
            status: "accepted",
            createdAt: "2026-07-05T00:00:00Z",
            startedAt: null,
            completedAt: null,
            events: [{ seam: "queued", ok: true, durationMs: 3, detail: {}, at: "2026-07-05T00:00:00Z" }],
          },
        });
      }
      if (href.includes("/api/skeleton-checks") && init?.method === "POST") {
        return jsonResponse({ run: { id: RUN_ID, status: "accepted", createdAt: "2026-07-05T00:00:00Z" } }, 202);
      }
      if (href.includes("/api/skeleton-checks") && !init?.method) {
        return jsonResponse({ runs: [] });
      }
      throw new Error(`unexpected fetch: ${href}`);
    });

    const Stub = createRoutesStub([
      {
        path: "/",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Component: homeRoute.default as any,
        loader: homeRoute.loader as any,
        action: homeRoute.action as any,
      },
      {
        path: "/skeleton-checks/:id",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Component: detailRoute.default as any,
        loader: detailRoute.loader as any,
      },
    ]);
    render(<Stub initialEntries={["/"]} />);

    await userEvent.click(await screen.findByRole("button", { name: "Run skeleton check" }));

    await waitFor(() => expect(screen.getByText("accepted")).toBeVisible());
  });

  it("detail view renders the full six-event trail with timings", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes(`/api/skeleton-checks/${RUN_ID}`)) {
        return jsonResponse({
          run: {
            id: RUN_ID,
            status: "succeeded",
            createdAt: "2026-07-05T00:00:00Z",
            startedAt: "2026-07-05T00:00:01Z",
            completedAt: "2026-07-05T00:00:02Z",
            vector: {
              id: "abc123",
              provider: "local-sidecar",
              model: "sentence-transformers/all-MiniLM-L6-v2",
              dimensions: 384,
              readbackDistance: 0,
            },
            events: [
              { seam: "queued", ok: true, durationMs: 3, detail: {}, at: "t0" },
              { seam: "claimed", ok: true, durationMs: 1204, detail: {}, at: "t1" },
              { seam: "inference", ok: true, durationMs: 88, detail: {}, at: "t2" },
              { seam: "vector_write", ok: true, durationMs: 12, detail: { deduplicated: false }, at: "t3" },
              { seam: "vector_readback", ok: true, durationMs: 9, detail: { distance: 0 }, at: "t4" },
              { seam: "completed", ok: true, durationMs: null, detail: {}, at: "t5" },
            ],
          },
        });
      }
      throw new Error(`unexpected fetch: ${href}`);
    });

    const Stub = createRoutesStub([
      {
        path: "/skeleton-checks/:id",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Component: detailRoute.default as any,
        loader: detailRoute.loader as any,
      },
    ]);
    render(<Stub initialEntries={[`/skeleton-checks/${RUN_ID}`]} />);

    for (const seam of ["queued", "claimed", "inference", "vector_write", "vector_readback", "completed"]) {
      await waitFor(() => expect(screen.getByText(new RegExp(`^${seam} —`))).toBeVisible());
    }
  });

  it("a failed run renders the dependency-down outcome naming the seam", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes(`/api/skeleton-checks/${RUN_ID}`)) {
        return jsonResponse({
          run: {
            id: RUN_ID,
            status: "failed",
            createdAt: "2026-07-05T00:00:00Z",
            startedAt: "2026-07-05T00:00:01Z",
            completedAt: "2026-07-05T00:00:02Z",
            outcome: { class: "dependency_down", seam: "inference", message: "Inference sidecar is not ready." },
            events: [
              { seam: "queued", ok: true, durationMs: 3, detail: {}, at: "t0" },
              { seam: "claimed", ok: true, durationMs: 1204, detail: {}, at: "t1" },
              { seam: "inference", ok: false, durationMs: 15000, detail: {}, at: "t2" },
            ],
          },
        });
      }
      throw new Error(`unexpected fetch: ${href}`);
    });

    const Stub = createRoutesStub([
      {
        path: "/skeleton-checks/:id",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Component: detailRoute.default as any,
        loader: detailRoute.loader as any,
      },
    ]);
    render(<Stub initialEntries={[`/skeleton-checks/${RUN_ID}`]} />);

    await waitFor(() =>
      expect(screen.getByText(/Failed at/)).toHaveTextContent(
        "Failed at inference: Inference sidecar is not ready. (dependency_down)",
      ),
    );
  });
});
