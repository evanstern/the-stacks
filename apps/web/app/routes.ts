import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("play/:sessionId", "routes/play.tsx"),
] satisfies RouteConfig;
