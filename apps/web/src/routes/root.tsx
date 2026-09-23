import { Outlet } from "@tanstack/react-router";
import { useIdentity } from "../auth/useAuth";
import { SignInView } from "./sign-in";

/**
 * The identity gate (D3/FR-007): asks the server on every mount (a reload
 * re-mounts the whole app, so this always re-asks) and renders sign-in
 * whenever the answer is "nobody" — for any route, not just "/".
 */
export function RootLayout() {
  const identity = useIdentity();

  if (identity.isPending) {
    return <p>Loading…</p>;
  }
  if (!identity.data) {
    return <SignInView />;
  }
  return <Outlet />;
}
