import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { HomeView } from "./routes/home";
import { PlayView } from "./routes/play";
import { RootLayout } from "./routes/root";

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeView,
});

// D6: the session id rides the URL — no registry exists to look it up
// through, so both browsers reach one session by opening the same link.
const playRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/play/$sessionId",
  component: PlayView,
});

const routeTree = rootRoute.addChildren([indexRoute, playRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
