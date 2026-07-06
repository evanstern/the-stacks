/**
 * The auth gate. Every non-login route nests under this layout (routes.ts),
 * so this loader is the ONE place unauthenticated traffic gets turned away —
 * child routes never re-check the session.
 *
 * The check itself is a server-side call to the API's session endpoint via
 * lib/api.server.ts (research R9: the API is the sole auth authority; web
 * treats the cookie as opaque). Gotcha: RR7 runs matched loaders in
 * parallel, so a child loader may still fire on an unauthenticated request —
 * the redirect thrown here wins the response, but child loaders must not
 * assume auth; the API rejects their calls with 401 regardless.
 */
import { Outlet, redirect } from "react-router";

import { isAuthenticated } from "~/lib/api.server";
import type { Route } from "./+types/protected-layout";

export async function loader({ request }: Route.LoaderArgs) {
  if (!(await isAuthenticated(request))) {
    throw redirect("/login");
  }
  return null;
}

export default function ProtectedLayout() {
  return <Outlet />;
}
