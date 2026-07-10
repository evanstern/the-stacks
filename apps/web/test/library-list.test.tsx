/**
 * T003 (009 US1): the library listing page and the nav that makes it
 * reachable — rows link to ticket pages (FR-003), empty state points at the
 * upload page (FR-007), paging shows an honest "X of Y" (FR-008), and the
 * protected layout carries navigation on every authenticated page (FR-001).
 * fetch is stubbed at the web→api seam, same pattern as library-upload.test.
 *
 * T018 (US3) extends this file with the evidence columns (plugin, generation,
 * counts, failure treatment, batch entry summaries).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as listRoute from "../app/routes/library";
import ProtectedLayout, { loader as protectedLoader } from "../app/routes/protected-layout";

const SOURCE_ID = "11111111-1111-1111-1111-111111111111";
const BATCH_ID = "22222222-2222-2222-2222-222222222222";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sourceItem(overrides: Record<string, unknown> = {}) {
  return {
    kind: "source",
    id: SOURCE_ID,
    originalFilename: "goblin.html",
    status: "ingested",
    createdAt: "2026-07-09T12:00:00.000Z",
    updatedAt: "2026-07-09T12:00:05.000Z",
    ...overrides,
  };
}

function batchItem(overrides: Record<string, unknown> = {}) {
  return {
    kind: "batch",
    id: BATCH_ID,
    originalFilename: "export.zip",
    status: "expanded",
    createdAt: "2026-07-09T13:00:00.000Z",
    updatedAt: "2026-07-09T13:00:10.000Z",
    ...overrides,
  };
}

function page(items: unknown[], total = items.length, limit = 50, offset = 0) {
  return { items, total, limit, offset };
}

function listStub() {
  return createRoutesStub([
    {
      path: "/library",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Component: listRoute.default as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loader: listRoute.loader as any,
    },
  ]);
}

describe("library listing page", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("lists submissions with identity fields and links each row to its ticket page", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(page([batchItem(), sourceItem()])),
    );

    const Stub = listStub();
    render(<Stub initialEntries={["/library"]} />);

    await waitFor(() => {
      expect(screen.getByText("goblin.html")).toBeInTheDocument();
      expect(screen.getByText("export.zip")).toBeInTheDocument();
    });
    // Every row is a working way back to its detail page — the "lost ticket
    // URL is recoverable" guarantee (US1).
    const rows = screen.getAllByTestId("library-row");
    expect(rows).toHaveLength(2);
    expect(screen.getByRole("link", { name: /goblin\.html/ })).toHaveAttribute(
      "href",
      `/library/uploads/source/${SOURCE_ID}`,
    );
    expect(screen.getByRole("link", { name: /export\.zip/ })).toHaveAttribute(
      "href",
      `/library/uploads/batch/${BATCH_ID}`,
    );
  });

  it("renders an honest empty state pointing at the upload page", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(page([])));

    const Stub = listStub();
    render(<Stub initialEntries={["/library"]} />);

    await waitFor(() => {
      expect(screen.getByTestId("library-empty")).toBeInTheDocument();
    });
    // Scoped inside the empty state: the page header carries its own Upload
    // link, and the empty state must point there too, in its own words.
    expect(
      within(screen.getByTestId("library-empty")).getByRole("link", { name: /upload/i }),
    ).toHaveAttribute("href", "/library/upload");
  });

  it("shows an honest page indicator and working prev/next when more exist (FR-008)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(page([sourceItem()], 120, 50, 50)),
    );

    const Stub = listStub();
    render(<Stub initialEntries={["/library?offset=50"]} />);

    await waitFor(() => {
      expect(screen.getByTestId("library-paging")).toHaveTextContent(/51.*of 120/);
    });
    expect(screen.getByRole("link", { name: /newer/i })).toHaveAttribute(
      "href",
      "/library?offset=0",
    );
    expect(screen.getByRole("link", { name: /older/i })).toHaveAttribute(
      "href",
      "/library?offset=100",
    );
  });
});

describe("protected layout navigation (FR-001)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders Home and Library nav links around every protected page", async () => {
    // The layout loader's session check answers 200 = signed in.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse({ authenticated: true }));

    const Stub = createRoutesStub([
      {
        path: "/",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Component: ProtectedLayout as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        loader: protectedLoader as any,
        children: [{ index: true, Component: () => <p>page body</p> }],
      },
    ]);
    render(<Stub initialEntries={["/"]} />);

    await waitFor(() => {
      expect(screen.getByText("page body")).toBeInTheDocument();
    });
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveTextContent(/home/i);
    expect(nav).toHaveTextContent(/library/i);
    expect(screen.getByRole("link", { name: /library/i })).toHaveAttribute("href", "/library");
  });
});
