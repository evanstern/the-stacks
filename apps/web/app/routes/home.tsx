import { redirect } from "react-router";
import { stacksContext } from "~/context";
import type { Route } from "./+types/home";

/**
 * `/` (FR-004): sends a signed-in operator to Ask and a signed-in player to
 * Table. The root gate already renders sign-in for nobody — this loader's
 * own `null` return only covers that transient case, since root never
 * mounts this route's component when `user` is null.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = await context.get(stacksContext).identity();
  if (user) {
    return redirect(user.role === "operator" ? "/ask" : "/play");
  }
  return null;
}

// A component is required so React Router treats "/" as a document route,
// not a resource route (`build/server` would otherwise answer with the
// loader's raw JSON). Unreachable in practice: the loader above always
// redirects a signed-in person, and root renders <SignIn/> for nobody
// without ever rendering this route's Outlet.
export default function Home() {
  return null;
}
