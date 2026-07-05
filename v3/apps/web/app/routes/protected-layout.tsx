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
