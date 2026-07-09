/**
 * Route manifest — the whole URL surface of the web app in one glance.
 *
 * The shape here IS the auth model: /login is the only public route; every
 * other route nests under protected-layout.tsx, whose loader is the single
 * place that redirects unauthenticated requests to /login. Adding a new
 * protected page means adding it inside the layout() block — nothing else.
 */
import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  layout("routes/protected-layout.tsx", [
    index("routes/home.tsx"),
    route("skeleton-checks/:id", "routes/skeleton-check-detail.tsx"),
    route("library/upload", "routes/library.upload.tsx"),
    route("library/uploads/:kind/:id", "routes/library.uploads.$ticket.tsx"),
  ]),
] satisfies RouteConfig;
