import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";

import * as homeRoute from "../app/routes/home";
import * as loginRoute from "../app/routes/login";
import * as protectedLayoutRoute from "../app/routes/protected-layout";

function buildRouter(initialPath: string) {
  return createMemoryRouter(
    [
      {
        path: "/login",
        Component: loginRoute.default,
        loader: loginRoute.loader,
        action: loginRoute.action,
      },
      {
        path: "/",
        Component: protectedLayoutRoute.default,
        loader: protectedLayoutRoute.loader,
        children: [
          {
            index: true,
            // Home's default export types its props via RR7's file-route
            // codegen (./+types/home), which is stricter than the ad-hoc
            // RouteObject this test builds by hand — a type-only mismatch.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Component: homeRoute.default as any,
            action: homeRoute.action,
            loader: homeRoute.loader,
          },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
}

describe("web auth flow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("unauthenticated route access redirects to login", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(null, { status: 401 }));

    const router = buildRouter("/");
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible());
  });

  it("failed login renders the non-revealing message and does not navigate", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (String(url).includes("/api/auth/login")) {
        return new Response(null, { status: 401 });
      }
      return new Response(null, { status: 401 }); // session check: not authenticated
    });

    const router = buildRouter("/login");
    render(<RouterProvider router={router} />);

    await screen.findByLabelText("Password");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Sign-in failed."));
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  it("successful login submit redirects to the authenticated home", async () => {
    let authenticated = false;

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("/api/auth/login")) {
        authenticated = true;
        return new Response(null, {
          status: 200,
          headers: { "set-cookie": "stacks_v3_session=sealed; HttpOnly; SameSite=Lax; Path=/" },
        });
      }
      if (href.includes("/api/auth/session")) {
        return new Response(null, { status: authenticated ? 200 : 401 });
      }
      if (href.includes("/api/skeleton-checks")) {
        return new Response(JSON.stringify({ runs: [] }), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${href}`);
    });

    const router = buildRouter("/login");
    render(<RouterProvider router={router} />);

    await screen.findByLabelText("Password");
    await userEvent.type(screen.getByLabelText("Password"), "correct-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Run skeleton check" })).toBeVisible(),
    );
  });
});
