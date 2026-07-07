/**
 * T030: the upload form's two outcomes — accepted (ticket rendered, linking
 * to the future ticket page) and honestly refused (415 message rendered as
 * content, not an error page). fetch is stubbed at the web→api seam, the
 * same pattern as skeleton-checks.test.tsx.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as uploadRoute from "../app/routes/library.upload";

const SOURCE_ID = "22222222-2222-2222-2222-222222222222";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stub() {
  return createRoutesStub([
    {
      path: "/library/upload",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Component: uploadRoute.default as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      action: uploadRoute.action as any,
    },
  ]);
}

describe("library upload form", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows the claim ticket after an accepted upload", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(
        { ticket: { kind: "source", id: SOURCE_ID }, duplicate: false, status: "queued" },
        201,
      ),
    );

    const Stub = stub();
    render(<Stub initialEntries={["/library/upload"]} />);

    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText<HTMLInputElement>(/file to upload/i),
      new File(["<html>x</html>"], "goblin.html", { type: "text/html" }),
    );
    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByTestId("upload-result")).toHaveTextContent("Accepted");
      expect(screen.getByRole("link", { name: new RegExp(SOURCE_ID) })).toHaveAttribute(
        "href",
        `/library/uploads/source/${SOURCE_ID}`,
      );
    });
  });

  it("renders a typed refusal (415) as a message, not an error page", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(
        { error: { code: "unsupported_type", message: "Unsupported file type: \"rulebook.pdf\"." } },
        415,
      ),
    );

    const Stub = stub();
    render(<Stub initialEntries={["/library/upload"]} />);

    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText<HTMLInputElement>(/file to upload/i),
      new File(["%PDF-1.7"], "rulebook.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByTestId("upload-error")).toHaveTextContent("Unsupported file type");
    });
  });
});
