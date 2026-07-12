/**
 * The auth gate — and, since 009, the navigation shell. Every non-login route
 * nests under this layout (routes.ts), so this loader is the ONE place
 * unauthenticated traffic gets turned away — child routes never re-check the
 * session — and the header below is the ONE place navigation renders on every
 * authenticated page (009 FR-001; constitution v2.2.0 Principle V: a page
 * reachable only by typed URL doesn't count as visible).
 *
 * The check itself is a server-side call to the API's session endpoint via
 * lib/api.server.ts (research R9: the API is the sole auth authority; web
 * treats the cookie as opaque). Gotcha: RR7 runs matched loaders in
 * parallel, so a child loader may still fire on an unauthenticated request —
 * the redirect thrown here wins the response, but child loaders must not
 * assume auth; the API rejects their calls with 401 regardless.
 */
import { Link, Outlet, redirect } from "react-router";

import { isAuthenticated } from "~/lib/api.server";
import type { Route } from "./+types/protected-layout";

export async function loader({ request }: Route.LoaderArgs) {
  if (!(await isAuthenticated(request))) {
    throw redirect("/login");
  }
  return null;
}

export default function ProtectedLayout() {
  return (
    <>
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-4xl items-center gap-6 px-8 pt-6 text-sm"
      >
        <span className="font-semibold">The Stacks</span>
        <Link className="underline-offset-4 hover:underline" to="/">
          Home
        </Link>
        <Link className="underline-offset-4 hover:underline" to="/search">
          Search
        </Link>
        <Link className="underline-offset-4 hover:underline" to="/library">
          Library
        </Link>
        <Link className="underline-offset-4 hover:underline" to="/records/retrievals">
          Retrievals
        </Link>
        <Link className="underline-offset-4 hover:underline" to="/evals">
          Evals
        </Link>
        <Link className="underline-offset-4 hover:underline" to="/evals/gold">
          Gold set
        </Link>
      </nav>
      <Outlet />
    </>
  );
}
