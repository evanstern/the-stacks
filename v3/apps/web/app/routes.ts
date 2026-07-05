import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  layout("routes/protected-layout.tsx", [
    index("routes/home.tsx"),
    route("skeleton-checks/:id", "routes/skeleton-check-detail.tsx"),
  ]),
] satisfies RouteConfig;
