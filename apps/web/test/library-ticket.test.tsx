/**
 * T035: the ticket page renders an ingested source (counts + trail) and a
 * failed source's scrubbed lastError. fetch stubbed at the web→api seam.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ticketRoute from "../app/routes/library.uploads.$ticket";

const SOURCE_ID = "22222222-2222-2222-2222-222222222222";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubAt(url: string) {
  const Stub = createRoutesStub([
    {
      path: "/library/uploads/:kind/:id",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Component: ticketRoute.default as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loader: ticketRoute.loader as any,
    },
  ]);
  return render(<Stub initialEntries={[url]} />);
}

describe("upload ticket page", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders an ingested source with counts and the event trail", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        ticket: { kind: "source", id: SOURCE_ID },
        source: {
          originalFilename: "goblin.html",
          status: "ingested",
          plugin: { name: "ddb-saved-html", version: "1.0.0", confidence: 0.95 },
          generation: 1,
          counts: { sections: 4, chunks: 2 },
          lastError: null,
        },
        events: [
          { stage: "detect", event: "completed", ok: true, detail: {}, durationMs: 12, at: "2026-07-07T00:00:00Z" },
          { stage: "commit", event: "completed", ok: true, detail: {}, durationMs: 3, at: "2026-07-07T00:00:01Z" },
        ],
      }),
    );

    stubAt(`/library/uploads/source/${SOURCE_ID}`);

    await waitFor(() => {
      expect(screen.getByTestId("source-status")).toHaveTextContent("ingested");
      expect(screen.getByTestId("source-status")).toHaveTextContent("4 sections");
      expect(screen.getByTestId("source-status")).toHaveTextContent("2 indexed passages");
      expect(within(screen.getByTestId("event-trail")).getAllByRole("row")).toHaveLength(2);
    });
  });

  it("renders a failed source's scrubbed, stage-attributed lastError", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        ticket: { kind: "source", id: SOURCE_ID },
        source: {
          originalFilename: "hollow.html",
          status: "failed",
          plugin: { name: "ddb-saved-html", version: "1.0.0", confidence: 0.95 },
          generation: 0,
          counts: { sections: 0, chunks: 0 },
          lastError: {
            class: "unsupported_type",
            stage: "extract",
            message: "DDB saved HTML did not contain extractable article text.",
          },
        },
        events: [
          { stage: "extract", event: "failed", ok: false, detail: {}, durationMs: 8, at: "2026-07-07T00:00:00Z" },
        ],
      }),
    );

    stubAt(`/library/uploads/source/${SOURCE_ID}`);

    await waitFor(() => {
      expect(screen.getByTestId("last-error")).toHaveTextContent("extract");
      expect(screen.getByTestId("last-error")).toHaveTextContent("extractable article text");
    });
  });
});
